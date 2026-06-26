import {
  Scene, HemisphericLight, DirectionalLight, PointLight,
  MeshBuilder, StandardMaterial, Color3, Color4, Vector3, Mesh, SceneLoader,
  DynamicTexture, PointerEventTypes,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { GridMaterial } from '@babylonjs/materials';
import DriverCharacter, { DRIVER_DEFAULT, ATTACH_SLOTS, normalizeDriverConfig } from './DriverCharacter.js';
import { makeMats, buildWorkbench, buildQMCrates, addBlob } from './HangarProps.js';
import { makeWorldWall } from './hangarColliders.js';
import { buildLounge } from './HangarLounge.js';
import { buildKitchen } from './HangarKitchen.js';
import { buildMapTable } from './HangarMapTable.js';
import { buildRadio } from './HangarRadio.js';
import { POSTER_DESIGNS } from './posterArt.js';
import { audio } from '../core/audio/AudioManager.js';
import { music } from '../core/audio/MusicManager.js';
import { applyModelPaint, makePaintMaterial } from '../utils/modelPaint.js';
import { attachCrt } from '../core/crtFilter.js';
import { worldBounds } from '../utils/meshBounds.js';
import { buildPrimitiveTank } from '../tank/primitiveTank.js';
import { assembleTank } from '../tank/parts/assembleTank.js';
import { PARTS_BY_ID, DEFAULT_LOADOUT, validLoadout } from '../tank/parts/index.js';

const ROOM_W   = 24;    // width (X)
const ROOM_D   = 32;    // depth (Z), north = positive Z
const ROOM_H   = 5;     // ceiling height
const WALL_T   = 0.15;  // wall thickness
const TUNNEL_W = 5;     // tunnel opening width, centered on north wall
const TUNNEL_LEN = 24;  // extended so fog fade reaches full black naturally

export default class HangarScene {
  constructor(engine, onDeploy, onExit) {
    this.scene    = new Scene(engine);
    this.onDeploy = onDeploy;
    this.onExit   = onExit;

    this.scene.clearColor        = new Color4(0.04, 0.04, 0.06, 1.0);
    this.scene.collisionsEnabled = true;

    this._buildRoom();
    this._buildLighting();
    this._buildStations();
    this._setupBlobShadows();   // fake grounding shadows (work on any GPU)

    this._setupDriver();
    this._setupGameLoop();
    this._setupInteractables();   // clickable poster (room decor) + desk radio (music jukebox)

    // Resolves once the async loads (driver GLBs + the displayed tank) settle — the
    // entry iris holds the cover until then, so the hangar reveals fully built (no
    // pop-in). allSettled so a single failed load can't hang the reveal.
    this.ready = Promise.allSettled([
      this.driver && this.driver.ready,
      this._tankReady,
    ].filter(Boolean)).then(() => {});
  }

  _buildRoom() {
    const s = this.scene;

    const concrete = new StandardMaterial('concrete', s);
    concrete.diffuseColor  = new Color3(0.38, 0.36, 0.33);
    concrete.specularColor = new Color3(0.03, 0.03, 0.03);

    const floorMat = new GridMaterial('floor', s);
    floorMat.gridRatio           = 2.5;   // 2.5-unit slabs
    floorMat.majorUnitFrequency  = 1;     // bold line every slab
    floorMat.minorUnitVisibility = 0;     // no minor lines — clean grout only
    floorMat.mainColor           = new Color3(0.20, 0.18, 0.16);  // lighter slab so blob shadows read
    floorMat.lineColor           = new Color3(0.13, 0.12, 0.10);
    floorMat.opacity             = 1.0;
    floorMat.backFaceCulling     = false;
    floorMat.maxSimultaneousLights = 8;  // so accent-light pools land on the floor

    // Tunnel material — lit concrete. The shaft is lit ONLY by a dedicated
    // mouth light (set up in _buildLighting) that falls off into blackness,
    // so the corridor reads as receding into darkness rather than a flat wall.
    const tunnelMat = new StandardMaterial('tunnel', s);
    tunnelMat.diffuseColor    = new Color3(0.38, 0.36, 0.33); // matches room concrete
    tunnelMat.specularColor   = new Color3(0, 0, 0);
    tunnelMat.backFaceCulling = false;

    // Tunnel road — asphalt, the lit surface that recedes into the tunnel.
    // Kept fairly dark but light enough to read when the low mouth light pools
    // on it. The roof/ceiling above stays in shadow (see bore vertex colours).
    const asphaltMat = new StandardMaterial('tunnel-asphalt', s);
    asphaltMat.diffuseColor  = new Color3(0.16, 0.15, 0.14);
    asphaltMat.specularColor = new Color3(0, 0, 0);

    // Floor
    const floor = MeshBuilder.CreateGround('floor', { width: ROOM_W, height: ROOM_D }, s);
    floor.material        = floorMat;
    floor.checkCollisions = true;

    // South wall (solid)
    const wallS = MeshBuilder.CreateBox('wall-s', { width: ROOM_W, height: ROOM_H, depth: WALL_T }, s);
    wallS.position      = new Vector3(0, ROOM_H / 2, -ROOM_D / 2);
    wallS.material      = concrete;
    wallS.checkCollisions = true;

    // West wall
    const wallW = MeshBuilder.CreateBox('wall-w', { width: WALL_T, height: ROOM_H, depth: ROOM_D }, s);
    wallW.position      = new Vector3(-ROOM_W / 2, ROOM_H / 2, 0);
    wallW.material      = concrete;
    wallW.checkCollisions = true;

    // East wall
    const wallE = MeshBuilder.CreateBox('wall-e', { width: WALL_T, height: ROOM_H, depth: ROOM_D }, s);
    wallE.position      = new Vector3(ROOM_W / 2, ROOM_H / 2, 0);
    wallE.material      = concrete;
    wallE.checkCollisions = true;

    // North wall — two pieces flanking the 5-unit tunnel gap
    const sideW = (ROOM_W - TUNNEL_W) / 2; // 12.5 each
    const wallNL = MeshBuilder.CreateBox('wall-n-l', { width: sideW, height: ROOM_H, depth: WALL_T }, s);
    wallNL.position      = new Vector3(-(TUNNEL_W / 2 + sideW / 2), ROOM_H / 2, ROOM_D / 2);
    wallNL.material      = concrete;
    wallNL.checkCollisions = true;

    const wallNR = MeshBuilder.CreateBox('wall-n-r', { width: sideW, height: ROOM_H, depth: WALL_T }, s);
    wallNR.position      = new Vector3(TUNNEL_W / 2 + sideW / 2, ROOM_H / 2, ROOM_D / 2);
    wallNR.material      = concrete;
    wallNR.checkCollisions = true;

    // Tunnel shaft extending north (visual only, no collision needed).
    // Starts flush at the BACK face of the north wall (tFront) so the tunnel
    // geometry never overlaps the wall pieces (which would z-fight).
    const tFront  = ROOM_D / 2 + WALL_T / 2;       // back face of north wall
    const tCenter = tFront + TUNNEL_LEN / 2;

    // Rounded bore — a cylinder laid along Z, rendered inside-out (BACKSIDE)
    // with the far end capped. Bottom half sits below the floor so what shows
    // is a smooth arch rising from the floor instead of blocky corners.
    const bore = MeshBuilder.CreateCylinder('tunnel-bore', {
      height: TUNNEL_LEN,
      diameter: 7,
      tessellation: 40,
      cap: Mesh.CAP_END,
      sideOrientation: Mesh.BACKSIDE,
    }, s);
    bore.rotation.x = Math.PI / 2;                  // lay the axis along Z (CAP_END → far end)
    bore.position   = new Vector3(0, 1.5, tCenter);
    bore.material   = tunnelMat;

    // Support ribs — darker arched bands at intervals that protrude inward from
    // the bore, giving the smooth tube real structural definition (an outline
    // separating each section of wall/roof) like a reinforced mine tunnel.
    const ribMat = new StandardMaterial('tunnel-rib', s);
    ribMat.diffuseColor  = new Color3(0.55, 0.53, 0.48); // lighter than the bore so ribs read as bands
    ribMat.specularColor = new Color3(0, 0, 0);

    const ribs = [];
    const RIB_ZS = [tFront + 0.6, tFront + 4, tFront + 8, tFront + 12];
    for (let i = 0; i < RIB_ZS.length; i++) {
      const rib = MeshBuilder.CreateTorus(`tunnel-rib-${i}`, {
        diameter: 6.6, thickness: 0.45, tessellation: 40,
      }, s);
      rib.rotation.x = Math.PI / 2;                  // stand the ring up across the tunnel
      rib.position   = new Vector3(0, 1.5, RIB_ZS[i]);
      rib.material   = ribMat;
      ribs.push(rib);
    }

    // Flat asphalt road inside the bore — the lit surface receding into shadow.
    // Extends south to overlap the room floor so there's no gap at the threshold.
    const floorStart  = ROOM_D / 2 - 0.3;          // 0.3u into the room
    const floorEnd    = tFront + TUNNEL_LEN;
    const tunnelFloor = MeshBuilder.CreateBox('tunnel-floor', {
      width: TUNNEL_W, height: 0.1, depth: floorEnd - floorStart,
    }, s);
    tunnelFloor.position = new Vector3(0, 0, (floorStart + floorEnd) / 2);
    tunnelFloor.material = asphaltMat;

    // Tunnel meshes are lit only by the dedicated mouth light (see _buildLighting)
    this._tunnelMeshes = [bore, tunnelFloor, ...ribs];

    // Invisible wall at tunnel entrance — blocks driver from walking in
    const tunnelGate = MeshBuilder.CreateBox('tunnel-gate', {
      width: TUNNEL_W, height: ROOM_H, depth: 0.2,
    }, s);
    tunnelGate.position        = new Vector3(0, ROOM_H / 2, ROOM_D / 2 + 0.2);
    tunnelGate.isVisible       = false;
    tunnelGate.checkCollisions = true;
  }

  _buildLighting() {
    // Flat fill kept deliberately low so the warm accent lights (bay spot, east
    // fill, lounge lamp, kitchen bar + caged light) read as pools against a dark
    // bunker rather than being washed out by even illumination.
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.45;   // lifted so the floor reads enough for blob shadows to show
    ambient.diffuse     = new Color3(0.82, 0.78, 0.68);
    ambient.groundColor = new Color3(0.14, 0.13, 0.11);

    const overhead = new DirectionalLight('overhead', new Vector3(-0.3, -1, 0.5), this.scene);
    overhead.intensity = 0.20;
    overhead.position  = new Vector3(5, 15, 0);

    const bulb1 = new PointLight('bulb1', new Vector3(0, 4.5, 5), this.scene);
    bulb1.diffuse   = new Color3(1.0, 0.92, 0.78);
    bulb1.intensity = 0.80;
    bulb1.range     = 18;

    const bulb2 = new PointLight('bulb2', new Vector3(0, 4.5, -5), this.scene);
    bulb2.diffuse   = new Color3(1.0, 0.92, 0.78);
    bulb2.intensity = 0.65;
    bulb2.range     = 14;

    // Keep only the strong directional + bulbs off the tunnel so the deep end
    // can fall into shadow. The soft hemispheric ambient still reaches every
    // tunnel face (including the room-facing rim and roof) so nothing reads as
    // pure black around the opening.
    const shadowLights = [overhead, bulb1, bulb2];
    for (const light of shadowLights) {
      light.excludedMeshes.push(...this._tunnelMeshes);
    }

    // Mouth light — sits just inside the tunnel entrance and falls off with
    // distance, so the near corridor glows warm and recedes into darkness.
    // Central so the curved bore and the ribs shade evenly across the arch
    // rather than pooling a hotspot on the floor.
    const mouth = new PointLight('tunnel-mouth', new Vector3(0, 2.4, ROOM_D / 2 + 3), this.scene);
    mouth.diffuse            = new Color3(1.0, 0.94, 0.82); // warm, matches room bulbs
    mouth.intensity          = 1.8;
    mouth.range              = 18;
    mouth.includedOnlyMeshes = this._tunnelMeshes;

    // East-side fill — the QM corner at (11, 0) sits in the overhead light's shadow.
    // A soft low-hanging bulb on the east wall lifts the rack out of darkness without
    // creating a competing hotspot on the west side.
    const eastFill = new PointLight('east-fill', new Vector3(10.5, 3.2, 0), this.scene);
    eastFill.diffuse   = new Color3(1.0, 0.90, 0.75);
    eastFill.intensity = 0.9;
    eastFill.range     = 12;

    // Tank bay spot — overhead light aimed at the parked M26 so it reads as the
    // hero piece of the room. Kept warm to match the bulb palette.
    const baySpot = new PointLight('bay-spot', new Vector3(0, 5, 10), this.scene);
    baySpot.diffuse   = new Color3(1.0, 0.93, 0.80);
    baySpot.intensity = 1.9;
    baySpot.range     = 14;
  }

  // Fake "blob" grounding shadows — soft dark ovals on the floor under each prop.
  // Real-time shadow maps don't render on some GPUs (including the dev machine),
  // so blobs guarantee a grounded look everywhere and suit the bright art style.
  // Each blob is sized to the prop's world X/Z footprint.
  _setupBlobShadows() {
    const drop = (root, opts = {}) => {
      const meshes = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0 && m.isVisible);
      if (!meshes.length) return;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      meshes.forEach((m) => {
        m.computeWorldMatrix(true);
        const bb = m.getBoundingInfo().boundingBox;
        minX = Math.min(minX, bb.minimumWorld.x); maxX = Math.max(maxX, bb.maximumWorld.x);
        minZ = Math.min(minZ, bb.minimumWorld.z); maxZ = Math.max(maxZ, bb.maximumWorld.z);
      });
      const pad = opts.pad ?? 0.15;
      addBlob(this.scene, this._blobMat,
        (minX + maxX) / 2, (minZ + maxZ) / 2,
        (maxX - minX) / 2 + pad, (maxZ - minZ) / 2 + pad,
        { y: opts.y ?? 0.03 });
    };

    // Compact stations get one blob each. The kitchen and the NW planning desk
    // place their own per-item blobs (props are spread out, so one big blob would
    // look wrong), and the lounge already sits on a rug, so none are dropped here.
    ['wb-root', 'qm-root'].forEach((n) => {
      const r = this.scene.getTransformNodeByName(n);
      if (r) drop(r);
    });
    this._blobDrop = drop; // reused for the async tank
  }

  _buildStations() {
    const s = this.scene;

    this._stationDefs = {
      map:      { id: 'map',      label: 'INTERACT',  title: 'TACTICAL MAP',  body: 'MISSION SELECT\n\nWORLD 1 — the Long Road\nDEV ARENA — enemy testing', showDeploy: true  },
      radio:    { id: 'radio',    label: 'INTERACT',  title: 'RADIO / INTEL', body: 'STAND BY FOR BRIEFING.\nComing soon.', showDeploy: false },
      mechanic: { id: 'mechanic', label: 'INTERACT',  title: 'MECHANIC',      body: 'UPGRADES & REPAIRS\nComing soon.',     showDeploy: false },
      qm:       { id: 'qm',       label: 'INTERACT',  title: 'QUARTERMASTER', body: 'AMMO & SUPPLIES\nComing soon.',        showDeploy: false },
      lounge:   { id: 'lounge',   label: 'CUSTOMIZE', title: 'LOUNGE' },
      kitchen:  { id: 'kitchen',  label: 'INTERACT',  title: 'GALLEY',        body: 'MESS & RATIONS\nComing soon.',        showDeploy: false },
    };

    const propMats = makeMats(s);
    this._blobMat = propMats.blob;
    const _wb = buildWorkbench(s, -11, -2, propMats);
    const _qm = buildQMCrates(s,   11,  0, propMats);
    this._stationMeshes = [
      { mesh: _wb.trigger, data: this._stationDefs.mechanic },
      { mesh: _qm.trigger, data: this._stationDefs.qm       },
    ];

    // NW-corner planning desk — the redesigned tactical map. Hand-tuned layout
    // baked into HangarMapTable.js, scaled into the corner like lounge/kitchen.
    this._map = buildMapTable(s, propMats);
    this._stationMeshes.push({ mesh: this._map.trigger, data: this._stationDefs.map });

    // NE-corner radio / intercept station (quest-giver comms hub) — baked into
    // HangarRadio.js. Carries the swappable north-wall poster (this._radio.setPoster).
    this._radio = buildRadio(s, propMats);
    this._stationMeshes.push({ mesh: this._radio.trigger, data: this._stationDefs.radio });
    // Poster: if the player deliberately pinned one via the 5-click chooser, honor
    // it; otherwise show a fresh random design each hangar visit.
    try {
      const pinned   = localStorage.getItem('radioPosterPinned') === '1';
      const saved    = localStorage.getItem('radioPoster');
      const savedImg = localStorage.getItem('radioPosterImg');
      if (pinned && saved === 'photo' && savedImg) {
        const im = new Image(); im.onload = () => this._radio.setCustomPhoto(im); im.src = savedImg;
      } else if (pinned && saved && POSTER_DESIGNS.includes(saved)) {
        this._radio.setPoster(saved);
      } else {
        this._applyRandomPoster();
      }
    } catch (e) { /* ignore */ }

    // SW-corner lounge — furniture is fixed/hand-tuned (baked into
    // HangarLounge.js, no longer customizable). Pressing E opens the character
    // customization panel (driver look) via openLounge().
    this._lounge = buildLounge(s, propMats);
    this._stationMeshes.push({ mesh: this._lounge.trigger, data: this._stationDefs.lounge });

    // SE-corner kitchen — static INTERACT station (galley/mess), scaled into the
    // corner the same way as the lounge.
    this._kitchen = buildKitchen(s, propMats);
    this._stationMeshes.push({ mesh: this._kitchen.trigger, data: this._stationDefs.kitchen });

    // Perimeter collision buffers — user-marked in hangar-collision-editor.html
    // (world-space): a solid edge just inside each room wall so the player can't
    // clip into the walls. Room-level, so they live here rather than in a station.
    [
      { cx: 11.87, cz: -2.98, w: 0.23, d: 26.26 },  // east
      { cx: -0.09, cz: -15.89, w: 23.86, d: 0.67 }, // south
      { cx: -11.75, cz: -0.25, w: 0.50, d: 32.12 }, // west
      { cx: -0.06, cz: 15.72, w: 23.88, d: 0.44 },  // north
    ].forEach((b, i) => makeWorldWall(s, `room-buffer-${i}`, b));

    // Tank-bay blocker — solid footprint around the parked tank so the player can't walk through it.
    makeWorldWall(s, 'tank-bay-wall', { cx: -0.07, cz: 10.32, w: 3.66, d: 5.34 });

    this._tankPosition = new Vector3(0, 0, 10);
    this._buildBayGeometry();
    this._buildBayProps(propMats);
    this._tankReady = this._loadTankDisplay();   // async GLB — tracked for the ready gate
    this._buildExitDoor();
    this._buildExitFloorMark();
  }

  async _loadTankDisplay() {
    const s = this.scene;
    let filename = localStorage.getItem('selectedTank') || 'composed';

    let manifest;
    try {
      manifest = await fetch('/assets/models/manifest.json').then(r => r.json());
    } catch (e) {
      console.warn('[Hangar] manifest fetch failed', e);
      return;
    }
    // Stale selectedTank no longer in the manifest (e.g. the removed whole-GLB M26) → composed.
    // 'primitive' is the boxy DEFAULT TANK — it isn't in the manifest, so keep it from
    // falling through to composed (that mismatch is the bug this branch fixes).
    if (filename !== 'composed' && filename !== 'primitive' && !manifest[filename]) filename = 'composed';

    // Primitive (DEFAULT TANK) — the same boxy placeholder the designer previews and the
    // arena spawns. Built from shared geometry, scaled onto the plinth like the GLB display.
    if (filename === 'primitive') {
      const prim = buildPrimitiveTank(s, { simpleBarrel: true });
      const meshes = prim.meshes.filter(m => m.getTotalVertices() > 0);
      prim.root.position.set(0, 0, 0);
      prim.root.computeWorldMatrix(true);
      const { minX, maxX } = worldBounds(meshes);
      const rawW = maxX - minX;
      if (rawW > 0) prim.root.scaling.setAll(3.2 / rawW);
      prim.root.computeWorldMatrix(true);
      const { minY } = worldBounds(meshes);
      prim.root.position.set(0, -minY, 10);
      if (this._blobDrop) this._blobDrop(prim.root, { y: 0.035 });
      return;
    }

    // Composed (modular) tank — rebuild the saved hull+turret+cannon loadout, scaled onto the
    // plinth like the single-GLB display. Mirrors how the arena rebuilds the player tank.
    if (filename === 'composed') {
      const loadout = validLoadout(JSON.parse(localStorage.getItem('selectedLoadout') || 'null'));
      // Honour the player's chosen paint so the hangar display matches the designer/arena
      // (same rule as ArenaScene._loadPlayerComposed); fall back to the turret's own colour.
      const paint = JSON.parse(localStorage.getItem('selectedPaint') || 'null');
      const bodyCol = paint ?? PARTS_BY_ID[loadout.turret]?.paintColor ?? [0.12, 0.42, 0.88];
      const cannonMat = makePaintMaterial(s, bodyCol);
      let assembled;
      try {
        assembled = await assembleTank(s, loadout, { cannon: cannonMat }, { paint });
      } catch (e) { console.warn('[Hangar] composed assembly failed', e); return; }

      const meshes = [
        ...assembled.parts.hullBuilt.meshes,
        ...assembled.parts.turretBuilt.meshes,
        ...assembled.parts.cannonBuilt.meshes,
      ].filter(m => m.getTotalVertices() > 0);

      // Scale to the same display width GLBs use (~3.2), then sit it on the plinth at z=10.
      assembled.root.position.set(0, 0, 0);
      const { minX, maxX } = worldBounds(meshes);
      const rawW = maxX - minX;
      if (rawW > 0) assembled.root.scaling.setAll(3.2 / rawW);
      assembled.root.computeWorldMatrix(true);
      const { minY } = worldBounds(meshes);
      assembled.root.position.set(0, -minY, 10);

      if (this._blobDrop) this._blobDrop(assembled.root, { y: 0.035 });
      return;
    }

    const config = manifest[filename];
    if (!config) return;

    let result;
    try {
      result = await SceneLoader.ImportMeshAsync('', '/assets/models/tanks/', filename, s);
    } catch (e) {
      console.warn('[Hangar] tank GLB failed to load:', e);
      return;
    }

    const glbRoot = result.transformNodes.find(n => n.name === config.root);
    if (!glbRoot) return;

    // T-55 faces +X in its GLB — rotate so it faces north (+Z) like the M26
    if (config.facingAxis === '+X') glbRoot.rotation.y = -Math.PI / 2;

    // Compute scale from targetWidth; fall back for tanks that don't declare one
    const validMeshes = result.meshes.filter(m => m.getTotalVertices() > 0);
    let scale = 0.8;
    if (config.targetWidth && validMeshes.length) {
      const { minX, maxX } = worldBounds(validMeshes);
      const rawW = maxX - minX;
      if (rawW > 0) scale = config.targetWidth / rawW;
    }
    glbRoot.scaling.setAll(scale);

    // Re-compute after scale, then sit the tank on top of the plinth (y=0.25)
    const { minY } = worldBounds(validMeshes);
    glbRoot.position.set(0, 0 - minY, 10);

    applyModelPaint(result.meshes, config, s);

    // The tank loads after _setupBlobShadows ran, so drop its blob now.
    if (this._blobDrop) this._blobDrop(glbRoot, { y: 0.035 });
  }

  _buildBayGeometry() {
    const s = this.scene;

    // Concrete pad — lighter zone that marks the vehicle bay from the dark floor
    const padMat = new StandardMaterial('bay-pad', s);
    padMat.diffuseColor  = new Color3(0.22, 0.20, 0.18);
    padMat.specularColor = new Color3(0.02, 0.02, 0.02);
    const pad = MeshBuilder.CreateBox('bay-pad', { width: 12, height: 0.02, depth: 9 }, s);
    pad.position = new Vector3(0, 0.01, 10);
    pad.material = padMat;

    // Yellow safety stripes around the pad perimeter
    const stripeMat = new StandardMaterial('bay-stripe', s);
    stripeMat.diffuseColor  = new Color3(0.78, 0.62, 0.04);
    stripeMat.specularColor = new Color3(0.04, 0.04, 0.04);

    // Stripes sit 0.5u inset from the new pad edge (pad: x ±6, z 5.5–14.5).
    // E/W stripes anchor the box; N/S width fits between them minus corner overlap.
    const ST = 0.12;
    const stripeData = [
      { name: 'stripe-n', w: 11 - ST * 2, h: 0.03, d: ST, x: 0,           z: 14.0          },
      { name: 'stripe-s', w: 11 - ST * 2, h: 0.03, d: ST, x: 0,           z:  6.0          },
      { name: 'stripe-e', w: ST,           h: 0.03, d: 8,  x:  5.5 - ST/2, z: 10            },
      { name: 'stripe-w', w: ST,           h: 0.03, d: 8,  x: -5.5 + ST/2, z: 10            },
    ];
    for (const { name, w, h, d, x, z } of stripeData) {
      const stripe = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, s);
      stripe.position = new Vector3(x, 0.03, z);
      stripe.material = stripeMat;
    }

  }

  _buildBayProps(propMats) {
    const s = this.scene;

    // Drain tray — dark oil-stained rectangle under the tank
    const trayMat = new StandardMaterial('drain-tray', s);
    trayMat.diffuseColor  = new Color3(0.08, 0.07, 0.06);
    trayMat.specularColor = new Color3(0.06, 0.06, 0.06);
    const tray = MeshBuilder.CreateBox('drain-tray', { width: 4, height: 0.04, depth: 6.5 }, s);
    tray.position = new Vector3(0, 0.03, 10);
    tray.material = trayMat;

    // Rolling mechanic cart — sits east of the tank on the pad, easy to read from above
    const cartMat = new StandardMaterial('cart-body', s);
    cartMat.diffuseColor  = new Color3(0.18, 0.26, 0.14); // olive-green like cabinet
    cartMat.specularColor = new Color3(0.03, 0.03, 0.03);
    const cartTopMat = new StandardMaterial('cart-top', s);
    cartTopMat.diffuseColor  = new Color3(0.24, 0.22, 0.20); // worn metal work surface
    cartTopMat.specularColor = new Color3(0.06, 0.06, 0.06);

    const CART_X = 3.5;
    const CART_Z = 6.8;
    const cartBody = MeshBuilder.CreateBox('cart-body', { width: 1.4, height: 0.85, depth: 0.9 }, s);
    cartBody.position = new Vector3(CART_X, 0.68, CART_Z);
    cartBody.material = cartMat;
    const cartSurface = MeshBuilder.CreateBox('cart-surface', { width: 1.3, height: 0.05, depth: 0.8 }, s);
    cartSurface.position = new Vector3(CART_X, 1.125, CART_Z);
    cartSurface.material = cartTopMat;
    const cartDrawer = MeshBuilder.CreateBox('cart-drawer', { width: 1.2, height: 0.65, depth: 0.05 }, s);
    cartDrawer.position = new Vector3(CART_X, 0.63, CART_Z - 0.45 - 0.025);
    cartDrawer.material = propMats.darkMetal;
    const cartHandle = MeshBuilder.CreateBox('cart-handle', { width: 0.35, height: 0.07, depth: 0.04 }, s);
    cartHandle.position = new Vector3(CART_X, 0.63, CART_Z - 0.45 - 0.06);
    cartHandle.material = cartTopMat;
    const wheelMat = propMats.darkMetal;
    const wheelPositions = [[-0.55, -0.38], [0.55, -0.38], [-0.55, 0.38], [0.55, 0.38]];
    for (let i = 0; i < wheelPositions.length; i++) {
      const [wx, wz] = wheelPositions[i];
      const wheel = MeshBuilder.CreateCylinder(`cart-wheel-${i}`, { diameter: 0.18, height: 0.12, tessellation: 8 }, s);
      wheel.rotation.x = Math.PI / 2;
      wheel.position   = new Vector3(CART_X + wx, 0.25, CART_Z + wz);
      wheel.material   = wheelMat;
    }

    // Tool cabinet — dark green body with drawer detail
    const cabinetMat = new StandardMaterial('cabinet', s);
    cabinetMat.diffuseColor  = new Color3(0.18, 0.26, 0.14);
    cabinetMat.specularColor = new Color3(0.02, 0.02, 0.02);
    // Cabinet — north wall
    const CABINET_Z = 15.75;
    const cabinet = MeshBuilder.CreateBox('cabinet', { width: 0.75, height: 1.8, depth: 1.5 }, s);
    cabinet.position = new Vector3(-3.5, 0.9, CABINET_Z);
    cabinet.material = cabinetMat;

    const drawerMat = new StandardMaterial('cabinet-drawer', s);
    drawerMat.diffuseColor  = new Color3(0.22, 0.30, 0.17);
    drawerMat.specularColor = new Color3(0.02, 0.02, 0.02);
    const handleMat = propMats.darkMetal;
    // Drawers on south face (toward tank)
    const DRAWER_Z = CABINET_Z - 0.75 - 0.01;
    const drawerYs = [-0.5, 0, 0.5];
    for (let i = 0; i < drawerYs.length; i++) {
      const drawer = MeshBuilder.CreateBox(`drawer-${i}`, { width: 0.55, height: 0.22, depth: 0.06 }, s);
      drawer.position = new Vector3(-3.5, 0.9 + drawerYs[i], DRAWER_Z);
      drawer.material = drawerMat;
      const handle = MeshBuilder.CreateBox(`handle-${i}`, { width: 0.15, height: 0.07, depth: 0.06 }, s);
      handle.position = new Vector3(-3.5, 0.9 + drawerYs[i], DRAWER_Z - 0.05);
      handle.material = handleMat;
    }

    // Parts crates — north wall
    const CRATE_Z = 15.75;
    const crateBot = MeshBuilder.CreateBox('crate-bot', { width: 1.2, height: 0.8, depth: 1.0 }, s);
    crateBot.position = new Vector3(3.5, 0.4, CRATE_Z);
    crateBot.material = propMats.crate;
    const crateTop = MeshBuilder.CreateBox('crate-top', { width: 0.9, height: 0.6, depth: 0.75 }, s);
    crateTop.position = new Vector3(3.5, 1.1, CRATE_Z);
    crateTop.material = propMats.crateMed;

    // Oil drums — two side-by-side west of the tank; instantly readable from above
    const drumBodyMat = new StandardMaterial('drum-body', s);
    drumBodyMat.diffuseColor  = new Color3(0.15, 0.14, 0.13); // dark steel
    drumBodyMat.specularColor = new Color3(0.08, 0.08, 0.08);
    const drumBandMat = new StandardMaterial('drum-band', s);
    drumBandMat.diffuseColor  = new Color3(0.22, 0.20, 0.18); // slightly lighter ring
    drumBandMat.specularColor = new Color3(0.04, 0.04, 0.04);
    const drumLidMat = new StandardMaterial('drum-lid', s);
    drumLidMat.diffuseColor  = new Color3(0.22, 0.28, 0.14); // olive-green top
    drumLidMat.specularColor = new Color3(0.02, 0.02, 0.02);

    // Drums at south edge of pad — form the left side of the prop wall facing the tank
    const drumPositions = [{ x: -5.0, z: 6.4 }, { x: -4.2, z: 6.4 }];
    for (let i = 0; i < drumPositions.length; i++) {
      const { x: dx, z: dz } = drumPositions[i];
      const body = MeshBuilder.CreateCylinder(`drum-body-${i}`, { diameter: 0.72, height: 1.0, tessellation: 12 }, s);
      body.position = new Vector3(dx, 0.5, dz);
      body.material = drumBodyMat;
      const band = MeshBuilder.CreateCylinder(`drum-band-${i}`, { diameter: 0.78, height: 0.12, tessellation: 12 }, s);
      band.position = new Vector3(dx, 0.5, dz);
      band.material = drumBandMat;
      const lid = MeshBuilder.CreateCylinder(`drum-lid-${i}`, { diameter: 0.68, height: 0.06, tessellation: 12 }, s);
      lid.position = new Vector3(dx, 1.03, dz);
      lid.material = drumLidMat;
    }
  }

  _buildExitDoor() {
    const s = this.scene;
    const wallZ = -ROOM_D / 2; // = -16
    // Door on the EXTERIOR face — camera swings south as player approaches,
    // revealing the outside of the wall where the door sits.
    const faceZ = wallZ - 0.5; // = -16.5, just outside the wall

    // Frame — lighter concrete colour
    const frameMat = new StandardMaterial('exit-frame', s);
    frameMat.diffuseColor  = new Color3(0.50, 0.47, 0.43);
    frameMat.specularColor = new Color3(0.03, 0.03, 0.03);
    const jambL = MeshBuilder.CreateBox('exit-jamb-l', { width: 0.3, height: 3.6, depth: 0.3 }, s);
    jambL.position = new Vector3(-1.25, 1.8, faceZ);
    jambL.material = frameMat;
    const jambR = MeshBuilder.CreateBox('exit-jamb-r', { width: 0.3, height: 3.6, depth: 0.3 }, s);
    jambR.position = new Vector3(1.25, 1.8, faceZ);
    jambR.material = frameMat;
    const lintel = MeshBuilder.CreateBox('exit-lintel', { width: 2.8, height: 0.3, depth: 0.3 }, s);
    lintel.position = new Vector3(0, 3.45, faceZ);
    lintel.material = frameMat;

    // Door panel — sits slightly south of the frame (exterior face visible)
    const doorMat = new StandardMaterial('exit-door', s);
    doorMat.diffuseColor  = new Color3(0.28, 0.27, 0.25);
    doorMat.specularColor = new Color3(0.04, 0.04, 0.04);
    const door = MeshBuilder.CreateBox('exit-door', { width: 2.2, height: 3.2, depth: 0.12 }, s);
    door.position = new Vector3(0, 1.7, faceZ - 0.06);
    door.material = doorMat;

    // Hinges (3) — left side
    const hingeMat = new StandardMaterial('exit-hinge', s);
    hingeMat.diffuseColor  = new Color3(0.58, 0.54, 0.50);
    hingeMat.specularColor = new Color3(0.1, 0.1, 0.1);
    for (let i = 0; i < 3; i++) {
      const hinge = MeshBuilder.CreateBox(`exit-hinge-${i}`, { width: 0.08, height: 0.22, depth: 0.18 }, s);
      hinge.position = new Vector3(-1.0, 0.55 + i * 1.0, faceZ - 0.05);
      hinge.material = hingeMat;
    }

    // Handle — right side
    const handleMat = new StandardMaterial('exit-handle', s);
    handleMat.diffuseColor  = new Color3(0.70, 0.65, 0.58);
    handleMat.specularColor = new Color3(0.15, 0.15, 0.15);
    const handle = MeshBuilder.CreateBox('exit-handle', { width: 0.08, height: 0.5, depth: 0.14 }, s);
    handle.position = new Vector3(0.85, 1.6, faceZ - 0.14);
    handle.material = handleMat;

    // Exterior light above the door
    const doorLight = new PointLight('door-light', new Vector3(0, 4.5, faceZ - 1.5), s);
    doorLight.diffuse   = new Color3(0.9, 0.85, 0.78);
    doorLight.intensity = 0.8;
    doorLight.range     = 10;

    // Proximity trigger — player walks up to south wall from inside
    this._exitDoorPos = new Vector3(0, 0, wallZ + 2.0);
  }

  _buildExitFloorMark() {
    const s = this.scene;
    // Flush with south wall (z=-16), extending northward into the room
    const W = 5.5, D = 5.5;
    const CX = 0, CZ = -ROOM_D / 2 + D / 2; // south edge at z=-16
    const Y = 0.015;
    const BT = 0.13;

    // Two-red diagonal fill — dark red base, brighter red 45° stripes, no black
    const TEX = 512;
    const dynTex = new DynamicTexture('exit-zone-tex', { width: TEX, height: TEX }, s, false);
    const ctx = dynTex.getContext();
    ctx.fillStyle = '#1e1e1e';      // dark gray base
    ctx.fillRect(0, 0, TEX, TEX);
    ctx.strokeStyle = '#3a3a3a';    // slightly lighter gray stripes
    ctx.lineWidth = 44;
    for (let i = -6; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 90, 0);
      ctx.lineTo(i * 90 + TEX, TEX);
      ctx.stroke();
    }
    dynTex.update();

    const fillMat = new StandardMaterial('exit-zone-fill', s);
    fillMat.diffuseTexture = dynTex;
    fillMat.specularColor  = new Color3(0, 0, 0);
    const inner = W - BT * 2;
    const fill = MeshBuilder.CreatePlane('exit-zone-fill', { width: inner, height: inner }, s);
    fill.rotation.x = Math.PI / 2;
    fill.position   = new Vector3(CX, Y + 0.005, CZ);
    fill.material   = fillMat;

    // Border
    const borderMat = new StandardMaterial('exit-zone-border', s);
    borderMat.diffuseColor  = new Color3(0.28, 0.28, 0.28);
    borderMat.specularColor = new Color3(0, 0, 0);
    [
      { w: W,  d: BT, x: CX,               z: CZ + D/2 - BT/2 }, // north
      { w: W,  d: BT, x: CX,               z: CZ - D/2 + BT/2 }, // south
      { w: BT, d: D,  x: CX - W/2 + BT/2,  z: CZ              }, // west
      { w: BT, d: D,  x: CX + W/2 - BT/2,  z: CZ              }, // east
    ].forEach((b, i) => {
      const bar = MeshBuilder.CreateBox(`exit-bar-${i}`, { width: b.w, height: 0.025, depth: b.d }, s);
      bar.position = new Vector3(b.x, Y, b.z);
      bar.material = borderMat;
    });

    // Corner L-brackets
    const cornerMat = new StandardMaterial('exit-zone-corner', s);
    cornerMat.diffuseColor  = new Color3(0.40, 0.40, 0.40);
    cornerMat.specularColor = new Color3(0, 0, 0);
    const CL = 0.7;
    [
      { x: -W/2, z:  D/2, sx:  1, sz: -1 },
      { x:  W/2, z:  D/2, sx: -1, sz: -1 },
      { x: -W/2, z: -D/2, sx:  1, sz:  1 },
      { x:  W/2, z: -D/2, sx: -1, sz:  1 },
    ].forEach(({ x, z, sx, sz }, i) => {
      const ha = MeshBuilder.CreateBox(`exit-ch-${i}`, { width: CL, height: 0.04, depth: 0.13 }, s);
      ha.position = new Vector3(CX + x + sx * CL/2, Y + 0.01, CZ + z);
      ha.material = cornerMat;
      const va = MeshBuilder.CreateBox(`exit-cv-${i}`, { width: 0.13, height: 0.04, depth: CL }, s);
      va.position = new Vector3(CX + x, Y + 0.01, CZ + z + sz * CL/2);
      va.material = cornerMat;
    });
  }

  _setupDriver() {
    this.driver = new DriverCharacter(this.scene);
    // Phone/portrait pulls the hangar camera back too (its north-offset is
    // radius * _camNorthRatio, so it stays framed). Desktop = ×1 (unchanged).
    if (window.__camZoom) this.driver.camera.radius *= window.__camZoom();
    attachCrt(this.driver.camera);   // arcade/CRT post-process (toggled live via Settings)
    this._driverConfig = this._loadDriverConfig();
    // Apply the saved look once the default model finishes loading; adopt back the
    // APPLIED config (the driver clears slots whose pieces failed to load).
    this.driver.ready
      .then(() => this.driver.applyConfig(this._driverConfig))
      .then(applied => { if (applied) this._adoptDriverConfig(applied); });

    // Click-on-part nav (only while the lounge panel is open): click a body region
    // of the driver to jump the panel to that section. The clicked region is
    // resolved on the tap itself (scene.pick is reliable for dynamically-grafted
    // meshes in Babylon 7.x), so there's no per-frame hover work or highlight.
    this.scene.onPointerObservable.add((pi) => {
      if (!this._panelOpen || pi.type !== PointerEventTypes.POINTERTAP) return;
      const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY)?.pickedMesh;
      const region = this.driver.regionOfMesh(hit);
      if (region) window.dispatchEvent(new CustomEvent('crewpart', { detail: { region } }));
    });
  }

  _adoptDriverConfig(applied) {
    this._driverConfig = { ...applied };
    try { localStorage.setItem('driverConfig', JSON.stringify(this._driverConfig)); } catch (e) { /* ignore */ }
  }

  // ── Driver customization (mirrors the lounge config plumbing) ────────────────
  _loadDriverConfig() {
    let cfg = { ...DRIVER_DEFAULT };
    try {
      const saved = JSON.parse(localStorage.getItem('driverConfig'));
      if (saved && saved.head && saved.body) cfg = normalizeDriverConfig(saved);
    } catch (e) { /* fall through to default */ }
    return cfg;
  }

  getDriverConfig() { return this._driverConfig; }

  // Merge a partial change. Presets: { character } drives head+body together;
  // wardrobe slots (hair/headwear/face/back) set attachments. Persists + live-applies.
  setDriverConfig(partial) {
    if (partial.character) {
      this._driverConfig.head = this._driverConfig.body = partial.character;
    }
    if (partial.head) this._driverConfig.head = partial.head;
    if (partial.body) this._driverConfig.body = partial.body;
    if (partial.skin) this._driverConfig.skin = partial.skin;
    if (partial.accessory !== undefined) partial.face = partial.accessory; // legacy key
    for (const slot of Object.keys(ATTACH_SLOTS)) {
      if (partial[slot] !== undefined) this._driverConfig[slot] = partial[slot];
    }
    // Persist the APPLIED config (the driver clears slots that fail to load),
    // so a dead piece id can't get stuck in localStorage and retry forever.
    this.driver.applyConfig(this._driverConfig)
      .then(applied => { if (applied) this._adoptDriverConfig(applied); });
    try { localStorage.setItem('driverConfig', JSON.stringify(this._driverConfig)); } catch (e) { /* ignore */ }
    return this._driverConfig;
  }

  _setupGameLoop() {
    this._nearStation = null;
    this._panelOpen   = false;
    // North framing offset as a fraction of cam radius (lower = character more
    // centered, higher = more room shown above them). Tune live via window.__hangar.
    this._camNorthRatio = 0.18;

    const prompt      = document.getElementById('hangar-prompt');
    const promptLabel = document.getElementById('hangar-prompt-label');

    let prev = performance.now();
    this._loopObserver = this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt  = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      if (!this._panelOpen) {
        this.driver.update(dt);
        this._checkProximity(prompt, promptLabel);
        // Keep camera locked onto driver, offset north to frame the room. Offset
        // scales with zoom (_camNorthRatio * radius) so framing survives any
        // CAM_RADIUS change — don't hardcode the offset.
        this.driver.camera.target.set(
          this.driver.mesh.position.x,
          this.driver.mesh.position.y,
          this.driver.mesh.position.z + this.driver.camera.radius * this._camNorthRatio
        );
      }
    });
  }

  _checkProximity(prompt, promptLabel) {
    const pos = this.driver.position;

    // Exit door check
    if (Vector3.Distance(pos, this._exitDoorPos) < 3.0) {
      prompt.style.display    = 'flex';
      promptLabel.textContent = 'EXIT';
      this._nearStation       = { id: 'exit' };
      return;
    }

    // Tank check first — mount prompt, no panel
    if (Vector3.Distance(pos, this._tankPosition) < 3.5) {
      prompt.style.display    = 'flex';
      promptLabel.textContent = 'MOUNT';
      this._nearStation       = { id: 'tank' };
      return;
    }

    // Station checks
    let nearest  = null;
    let nearDist = Infinity;
    for (const { mesh, data } of this._stationMeshes) {
      const d = Vector3.Distance(pos, mesh.position);
      if (d < 3.5 && d < nearDist) {
        nearDist = d;
        nearest  = data;
      }
    }

    if (nearest) {
      prompt.style.display    = 'flex';
      promptLabel.textContent = nearest.label;
      this._nearStation       = nearest;
    } else {
      prompt.style.display = 'none';
      this._nearStation    = null;
    }
  }

  openPanel(station) {
    audio.play('ui.interact'); // E-press station interaction blip
    this._panelOpen = true;
    document.getElementById('hangar-prompt').style.display    = 'none';
    document.getElementById('hangar-panel-title').textContent = station.title;
    document.getElementById('hangar-panel-body').textContent  = station.body;
    document.getElementById('hangar-panel-deploy').style.display =
      station.showDeploy ? 'block' : 'none';
    const devBtn = document.getElementById('hangar-panel-deploy-dev');
    if (devBtn) devBtn.style.display = station.showDeploy ? 'block' : 'none';
    document.getElementById('hangar-panel').style.display = 'flex';
  }

  closePanel() {
    if (this._loungeOpen) { this._closeLounge(); return; }
    this._panelOpen   = false;
    this._nearStation = null;
    document.getElementById('hangar-panel').style.display = 'none';
  }

  // ── Lounge character customization panel (driver look) ──────────────────────
  openLounge() {
    this._panelOpen  = true;   // pause driver + freeze follow-cam target
    this._loungeOpen = true;
    document.getElementById('hangar-prompt').style.display = 'none';
    document.getElementById('lounge-panel').style.display  = 'flex';

    // Stand the driver in the open area in front of the couch (NE of the
    // SW-corner couch, on the rug, clear of the coffee table) so it doesn't clip
    // the furniture while being customized. Saved + restored on close.
    this._driverHomePos = this.driver.mesh.position.clone();
    this._driverHomeRot = this.driver.mesh.rotation.y;
    const lc = this._lounge.center;
    this.driver.mesh.position.set(lc.x + 2.0, 0.9, lc.z + 2.0);

    // Frame the driver from the front like a character sheet so the look being
    // edited is clearly visible. Snap to a known facing and orbit to a 3/4 front
    // view; the follow-cam + driver.update are frozen while the panel is open.
    this.driver.mesh.rotation.y = 0;   // turn the driver to face the camera (front +Z)
    const c = this.driver.camera;
    this._camSaved = {
      alpha: c.alpha, beta: c.beta, radius: c.radius,
      lower: c.lowerRadiusLimit, upper: c.upperRadiusLimit,
      betaLower: c.lowerBetaLimit, betaUpper: c.upperBetaLimit,
      panning: c.panningSensibility,
      target: c.getTarget().clone(),
    };
    const focus = this.driver.mesh.position.clone(); focus.y += 0.9;
    c.setTarget(focus);          // set target FIRST — setTarget recomputes alpha/beta
    c.alpha  = Math.PI * 0.6;    // just off straight-front for a 3/4 view
    c.beta   = 1.15;             // lower angle so we see the face, not the top of the head
    c.radius = 6.5;

    // Let the player orbit the driver with mouse drags, but LOCK zoom (radius
    // pinned) and clamp beta so the camera can't dip under the floor or flip
    // fully top-down. Panning is disabled so the driver stays centred.
    c.lowerRadiusLimit = c.upperRadiusLimit = 6.5;
    c.lowerBetaLimit = 0.25;
    c.upperBetaLimit = 1.5;
    c.panningSensibility = 0;
    c.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }

  _closeLounge() {
    this._loungeOpen  = false;
    this._panelOpen   = false;
    this._nearStation = null;
    document.getElementById('lounge-panel').style.display = 'none';
    // Put the driver back where it was standing before customization.
    if (this._driverHomePos) {
      this.driver.mesh.position.copyFrom(this._driverHomePos);
      this.driver.mesh.rotation.y = this._driverHomeRot;
      this._driverHomePos = null;
    }
    const c = this.driver.camera, sv = this._camSaved;
    c.detachControl();           // hand the camera back to the code-driven follow loop
    if (sv) {
      c.lowerRadiusLimit = sv.lower;
      c.upperRadiusLimit = sv.upper;
      c.lowerBetaLimit   = sv.betaLower;
      c.upperBetaLimit   = sv.betaUpper;
      c.panningSensibility = sv.panning;
      c.setTarget(sv.target);   // FIRST — setTarget recomputes alpha/beta, so pin them after
      c.alpha  = sv.alpha;
      c.beta   = sv.beta;
      c.radius = sv.radius;
    }
  }

  exitToMenu() {
    document.getElementById('hangar-prompt').style.display = 'none';
    this._nearStation = null;
    if (this.onExit) this.onExit();
  }

  mountTank() {
    this.driver.hide();
    document.getElementById('hangar-prompt').style.display = 'none';
    // Brief pause so the driver visually disappears before the transition fires
    this._mountTimer = setTimeout(() => this.onDeploy(), 500);
  }

  // Pick a random poster design for this visit (NOT persisted — re-rolls on each
  // hangar entry). 'photo' only joins the pool if the player uploaded a custom image.
  _applyRandomPoster() {
    let savedImg = null;
    try { savedImg = localStorage.getItem('radioPosterImg'); } catch (e) { /* ignore */ }
    const pool = POSTER_DESIGNS.filter(d => d !== 'photo' || savedImg);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === 'photo' && savedImg) {
      const im = new Image(); im.onload = () => this._radio.setCustomPhoto(im); im.src = savedImg;
    } else {
      this._radio.setPoster(pick);
    }
  }

  // ── Clickable hangar interactables (single shared pointer observer + reticle):
  //    • the radio-station POSTER (NE wall) → room-decor chooser
  //    • the planning-desk RADIO (NW) → room-music jukebox
  //    Hovering either swaps the reticle to a "click" indicator; one click opens
  //    its menu. One observer avoids the two fighting over the cursor reticle. ──
  _setupInteractables() {
    const reticle = document.getElementById('reticle');
    const poster  = this._radio && this._radio.posterMesh;
    const radioGrp = this._map && this._map.radio;
    if (!poster && !radioGrp) return;

    const ORIG_RETICLE = reticle ? reticle.innerHTML : '';
    const CLICK_RETICLE =
      '<svg width="40" height="40" viewBox="0 0 40 40">'
      + '<circle cx="20" cy="20" r="6" fill="none" stroke="#00eedd" stroke-width="2"/>'
      + '<circle cx="20" cy="20" r="2.5" fill="#00eedd"/>'
      + '<line x1="20" y1="3" x2="20" y2="9" stroke="#00eedd" stroke-width="2"/>'
      + '<line x1="20" y1="31" x2="20" y2="37" stroke="#00eedd" stroke-width="2"/>'
      + '<line x1="3" y1="20" x2="9" y2="20" stroke="#00eedd" stroke-width="2"/>'
      + '<line x1="31" y1="20" x2="37" y2="20" stroke="#00eedd" stroke-width="2"/></svg>';

    let hovering = false;
    const setHover = (on) => { if (on === hovering) return; hovering = on; if (reticle) reticle.innerHTML = on ? CLICK_RETICLE : ORIG_RETICLE; };
    this._restoreReticle = () => { if (reticle) reticle.innerHTML = ORIG_RETICLE; };

    const btnCss = 'background:#0a1824;color:#7fc8d4;border:1px solid #1b4250;padding:8px 9px;'
      + 'font-family:inherit;font-size:8px;letter-spacing:1px;cursor:none;margin-top:4px;';
    const panelCss = (id) => 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:30;display:none;'
      + 'flex-direction:column;gap:8px;padding:14px 16px;width:300px;background:rgba(0,8,20,0.95);'
      + "border:1px solid #00e5ff;box-shadow:0 0 24px rgba(0,229,255,0.25);font-family:'Press Start 2P',monospace;";

    // shared open-state: only one menu up at a time; observer dormant while open
    let openMenuId = null;   // 'poster' | 'radio' | null
    const closeAll = () => {
      if (this._posterMenu) this._posterMenu.style.display = 'none';
      if (this._radioMenu)  this._radioMenu.style.display  = 'none';
      openMenuId = null;
    };

    // ── POSTER chooser (room decor) ──────────────────────────────────────────
    if (poster) {
      const persist = (design, img) => { try { localStorage.setItem('radioPoster', design); localStorage.setItem('radioPosterPinned', '1'); if (img !== null) localStorage.setItem('radioPosterImg', img); } catch (e) { /* quota */ } };
      const menu = document.createElement('div'); menu.id = 'poster-menu'; menu.style.cssText = panelCss('poster');
      menu.innerHTML =
          '<div style="color:#00e5ff;font-size:10px;letter-spacing:2px;">POSTER</div>'
        + '<div style="color:#2f6470;font-size:7px;letter-spacing:1px;margin-bottom:6px;">PICK A DESIGN · OR UPLOAD YOUR OWN</div>'
        + '<div id="pm-row" style="display:flex;flex-wrap:wrap;gap:6px;"></div>'
        + '<button id="pm-random">RANDOM EACH VISIT</button>'
        + '<button id="pm-upload">UPLOAD YOUR OWN</button>'
        + '<button id="pm-close">CLOSE</button>'
        + '<input id="pm-file" type="file" accept="image/*" style="display:none">';
      document.body.appendChild(menu);
      this._posterMenu = menu;
      const row = menu.querySelector('#pm-row');
      [['wanted', 'WANTED'], ['fields', 'FIELDS'], ['morale', 'MORALE'], ['photo', 'PHOTO']].forEach(([d, label]) => {
        const b = document.createElement('button'); b.textContent = label; b.style.cssText = btnCss + 'flex:1 1 44%;text-align:center;';
        b.onclick = () => { this._radio.setPoster(d); persist(d, null); closeAll(); }; row.appendChild(b);
      });
      const fileIn = menu.querySelector('#pm-file');
      menu.querySelector('#pm-random').style.cssText = btnCss;
      menu.querySelector('#pm-upload').style.cssText = btnCss;
      menu.querySelector('#pm-close').style.cssText  = btnCss;
      menu.querySelector('#pm-random').onclick = () => { try { localStorage.removeItem('radioPosterPinned'); } catch (e) { /* ignore */ } this._applyRandomPoster(); closeAll(); };
      menu.querySelector('#pm-upload').onclick = () => fileIn.click();
      menu.querySelector('#pm-close').onclick  = () => closeAll();
      fileIn.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return;
        const rd = new FileReader(); rd.onload = () => { const im = new Image();
          im.onload = () => { this._radio.setCustomPhoto(im); persist('photo', rd.result); closeAll(); }; im.src = rd.result; };
        rd.readAsDataURL(f); };
    }

    // ── RADIO jukebox (room music) ───────────────────────────────────────────
    if (radioGrp) {
      const TRACKS = [['shuffle', 'SHUFFLE (RANDOM)'], ['a', 'COZY LO-FI'], ['c', "TINKER'S SHUFFLE"], ['e3', 'LOUNGE LIFT'], ['g', 'DUST MOTES'], ['h', 'LOW POWER']];
      const menu = document.createElement('div'); menu.id = 'radio-menu'; menu.style.cssText = panelCss('radio');
      menu.innerHTML =
          '<div style="color:#00e5ff;font-size:10px;letter-spacing:2px;">ROOM MUSIC</div>'
        + '<div style="color:#2f6470;font-size:7px;letter-spacing:1px;margin-bottom:6px;">PICK A TRACK FOR THE HANGAR</div>'
        + '<div id="rm-row" style="display:flex;flex-direction:column;gap:4px;"></div>'
        + '<button id="rm-close">CLOSE</button>';
      document.body.appendChild(menu);
      this._radioMenu = menu;
      const row = menu.querySelector('#rm-row');
      const refresh = () => {   // highlight the active track (or SHUFFLE when none pinned)
        const active = music.hangarTrack || 'shuffle';
        row.querySelectorAll('button').forEach(b => {
          const on = b.dataset.id === active;
          b.style.cssText = btnCss + 'text-align:left;' + (on ? 'border-color:#00eedd;color:#00eedd;background:#06222a;' : '');
        });
      };
      TRACKS.forEach(([id, label]) => {
        const b = document.createElement('button'); b.dataset.id = id; b.textContent = label; b.style.cssText = btnCss + 'text-align:left;';
        b.onclick = () => { music.setHangarTrack(id === 'shuffle' ? null : id); audio.play('ui.select'); refresh(); };  // play live, stay open to sample
        row.appendChild(b);
      });
      menu.querySelector('#rm-close').style.cssText = btnCss;
      menu.querySelector('#rm-close').onclick = () => closeAll();
      this._refreshRadioMenu = refresh;
    }

    const openPoster = () => { if (!this._posterMenu) return; closeAll(); this._posterMenu.style.display = 'flex'; openMenuId = 'poster'; setHover(false); };
    const openRadio  = () => { if (!this._radioMenu) return; closeAll(); if (this._refreshRadioMenu) this._refreshRadioMenu(); this._radioMenu.style.display = 'flex'; openMenuId = 'radio'; setHover(false); };

    const hitTest = (mesh) => {
      if (!mesh) return null;
      if (poster && mesh === poster) return 'poster';
      if (radioGrp && mesh.isDescendantOf(radioGrp)) return 'radio';
      return null;
    };

    this._interObserver = this.scene.onPointerObservable.add((pi) => {
      if (this._panelOpen || openMenuId) { setHover(false); return; }   // dormant while a panel/menu is up
      if (pi.type === PointerEventTypes.POINTERMOVE) {
        const p = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        setHover(!!(p && p.hit && hitTest(p.pickedMesh)));
      } else if (pi.type === PointerEventTypes.POINTERPICK) {
        const which = pi.pickInfo && pi.pickInfo.hit ? hitTest(pi.pickInfo.pickedMesh) : null;
        if (which === 'poster') openPoster();
        else if (which === 'radio') openRadio();
      }
    });
  }

  dispose() {
    clearTimeout(this._mountTimer);
    if (this._loopObserver) this.scene.onBeforeRenderObservable.remove(this._loopObserver);
    if (this._interObserver) this.scene.onPointerObservable.remove(this._interObserver);
    if (this._restoreReticle) this._restoreReticle();
    if (this._posterMenu) this._posterMenu.remove();
    if (this._radioMenu) this._radioMenu.remove();
    if (this.driver) this.driver.dispose();
    this.scene.dispose();
  }
}
