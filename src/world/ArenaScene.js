import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, Matrix, DynamicTexture, GlowLayer, TransformNode, SceneLoader,
  Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { applyModelPaint, makePaintMaterial } from '../utils/modelPaint.js';
import { attachCrt } from '../core/crtFilter.js';
import { hpColor, yRotForFacing } from '../utils/mathUtils.js';
import { worldBounds } from '../utils/meshBounds.js';
import { measureBasket } from '../tank/parts/measureBasket.js';
import { assembleTank } from '../tank/parts/assembleTank.js';
import { PARTS_BY_ID, DEFAULT_LOADOUT, validLoadout } from '../tank/parts/index.js';
import Tank from '../tank/Tank.js';
import SentinelEnemy from './SentinelEnemy.js';
import ChaffEnemy from './ChaffEnemy.js';
import MortarEnemy from './MortarEnemy.js';
import Shell from '../combat/Shell.js';
import { GridMaterial } from '@babylonjs/materials';
import ArenaVFX from './ArenaVFX.js';
import TrackMarks from './TrackMarks.js';
import SalvageCrate from './SalvageCrate.js';
import ExtractionZone from './ExtractionZone.js';
import { ARENA_LOOT, PICKUP_RADIUS } from './arenaLoot.js';
import { bankSalvage } from '../core/runState.js';
import { audio } from '../core/audio/AudioManager.js';
import { music } from '../core/audio/MusicManager.js';
import { buildWorld1 } from './zones/World1Builder.js';
import { buildRoadLeg } from './zones/RoadBuilder.js';
import { SHIELD_STUN_DURATION } from '../tank/shield.js';

// Hull-follow camera (Long Road): the view yaws to keep the hull's forward up-screen, so
// off-angle/branching roads read as "straight ahead". Reversing keeps facing up-the-road
// because rotY doesn't flip. Defaults dialed in via camera-mockup.html; live-tunable on
// window.__arena (`camera.beta`, `camera.radius`, `_camYawSmooth`).
// Lock-on is disabled for now — planned as a future module upgrade. Flip to true
// to restore hold-F lock-on (the full mechanic + ring rendering is left intact).
const LOCKON_ENABLED     = false;
const CAM_BETA           = 0.6;   // tilt (was a fixed 0.5 top-down)
const CAM_RADIUS         = 48;    // distance (zoomed out a tad from 42)
const CAM_YAW_SMOOTH_TIME = 0.40; // critically-damped yaw smoothTime (s): bigger = more lag/smoother
// Hitting an enemy wakes its whole squad within this radius. Counterweight to the
// tightened on-screen aggro: the player out-ranges a scout's detection, so picking
// one off can't be free — its packmates turn on you the moment you draw blood.
const PACK_ALERT_RADIUS  = 40;
// World-1 mortar support odds (mid/deep bands only — the near on-ramp stays gentle).
const MORTAR_SUPPORT_CHANCE = 0.40;   // a sentinel group brings artillery support
const MORTAR_SQUAD_CHANCE   = 0.12;   // rare: a chaff squad rolls a lone mortar

export default class ArenaScene {
  constructor(engine, onExtract, zone = null) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.48, 0.78, 1.0, 1.0);
    this._onExtract = onExtract ?? null;
    // Zone config (e.g. zones/world1.js). Null = the legacy placeholder arena.
    this.zone = zone;

    this.scene._onCameraShake = (duration, intensity) => this._triggerShake(duration, intensity);
    this._shakeTime      = 0;
    this._shakeIntensity = 0;

    this.lockedEnemy      = null;
    this._fHeld           = false;
    this._fHoldTime       = 0;
    this._fDidLock        = false;
    this._prevLockedEnemy = null;
    this._fadeOutTime     = 0;
    this._lockSnapTime    = -1; // seconds since snap fired; -1 = inactive
    this._cancelFadeTime     = -1;
    this._cancelFadeEnemy    = null;
    this._cancelFadeAlpha    = 0;
    this._cancelFadeHoldTime = 0;

    // Persistent camera target position for soft follow — starts on the spawn
    this._camX = zone?.spawn.x ?? 0;
    this._camZ = zone?.spawn.z ?? 0;

    this._paused = false;

    // Long Road boundary corridor (invisible walls following the road), or null.
    this._corridor = zone?.corridor ?? null;

    this._obstacles = [];
    this._barrelPivotBaseZ = 0.6; // updated after GLB loads to the actual trunnion position

    // Resolves when the player tank's async model work is done (or immediately
    // for the primitive). The deploy loading screen awaits this before fading.
    this.ready = new Promise(res => { this._readyResolve = res; });
    this._poiReady = null;   // set by the road branch of _setupGround (async GLB POI props)

    this._setupCamera();
    this._setupLighting();
    this._setupGround();
    this._setupEnvironment();
    this._setupSky();
    this._setupHazards();
    this._setupEntities();
    this._setupExtraction();
    // Fold the async POI-prop build (GLB templates) into ready so the deploy loading
    // screen waits for the thicket to appear, not pop in after the world fades up.
    if (this._poiReady) this.ready = Promise.all([this.ready, this._poiReady]);
    // this._setupDevLabels();
    this._setupLockOn();
    this._setupFiring();
    this.vfx = new ArenaVFX(this.scene);
    this.trackMarks = new TrackMarks(this.scene);
    this._setupGameLoop();
  }

  _setupCamera() {
    // Hull-follow: yaw the view to keep the hull's forward up-screen (Long Road).
    this._camHeading      = this.zone?.spawn?.facing ?? 0;   // smoothed yaw the cam tracks
    this._camHeadingVel   = 0;                               // spring velocity state
    this._camYawSmoothTime = CAM_YAW_SMOOTH_TIME;            // live-tunable (seconds)
    // Phone/portrait pulls the camera back (wider view); desktop = ×1 (unchanged).
    const camRadius = CAM_RADIUS * (window.__camZoom ? window.__camZoom() : 1);
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2 - this._camHeading, CAM_BETA, camRadius,
      new Vector3(this._camX, 0, this._camZ), this.scene);
    this._crt = attachCrt(this.camera);   // arcade/CRT post-process (toggled live via Settings)
  }

  _setupLighting() {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.85;
    ambient.diffuse     = new Color3(1.0, 0.97, 0.88);
    ambient.groundColor = new Color3(0.28, 0.52, 0.10);

    // Zone lighting matches the approved world1-mockup (high-noon, softer sun) —
    // the old arena sun at 1.1 washes the dirt paths to white.
    this.dirLight = new DirectionalLight('dir',
      this.zone ? new Vector3(0.15, -1, 0.12) : new Vector3(-0.5, -1.4, -0.5), this.scene);
    this.dirLight.intensity = this.zone ? 0.65 : 1.1;
    this.dirLight.position  = new Vector3(12, 20, 12);

    this.shadowGen = new ShadowGenerator(2048, this.dirLight);
    this.shadowGen.bias       = 0.0001;
    this.shadowGen.normalBias = 0.02;
    // Mac/Chrome (ANGLE→Metal) renders blur-ESM float-texture shadow maps BLANK,
    // which reads as "no shadows". Default to the basic depth map + Poisson sampling
    // (a plain depth texture ANGLE handles reliably). Cycle types live from the console:
    //   window.__arena.setShadowType('basic'|'poisson'|'pcf'|'pcss'|'blur-esm')
    this.setShadowType('poisson');

    // Warm green bounce from below — grass reflection
    const fillLight = new HemisphericLight('fill', new Vector3(0, -1, 0), this.scene);
    fillLight.diffuse   = new Color3(0.20, 0.45, 0.10);
    fillLight.intensity = 0.15;
  }

  // Live shadow-map filter switch — diagnoses which type actually renders on a
  // given GPU. Mac/ANGLE chokes on float-texture ESM; basic/poisson/pcf use plain
  // depth textures. Call from the console: window.__arena.setShadowType('pcf').
  setShadowType(type) {
    const sg = this.shadowGen;
    if (!sg) return type;
    sg.useBlurExponentialShadowMap      = false;
    sg.useExponentialShadowMap          = false;
    sg.useBlurCloseExponentialShadowMap = false;
    sg.useCloseExponentialShadowMap     = false;
    sg.usePoissonSampling               = false;
    sg.usePercentageCloserFiltering     = false;
    sg.useContactHardeningShadow        = false;
    switch (type) {
      case 'basic':    break;                                    // hard depth map — most compatible
      case 'poisson':  sg.usePoissonSampling = true; break;      // soft, depth-based, compatible
      case 'pcf':      sg.usePercentageCloserFiltering = true;
                       sg.filteringQuality = ShadowGenerator.QUALITY_HIGH; break;
      case 'pcss':     sg.useContactHardeningShadow = true;
                       sg.contactHardeningLightSizeUVRatio = 0.06; break;
      case 'blur-esm': sg.useBlurExponentialShadowMap = true; break; // the type that fails on Mac
      default:         sg.usePoissonSampling = true; type = 'poisson'; break;
    }
    this._shadowType = type;
    console.log('[shadow] type =', type, '— do you see tank/tree shadows on the ground?');
    return type;
  }

  _setupGround() {
    if (this.zone?.kind === 'road') {
      // The Long Road: a procedural, textured road leg (RoadBuilder) instead of the
      // bounded World1 field. Same art pipeline (dirt-path ribbon, grass, trees).
      const built = buildRoadLeg(this.scene, this.zone);
      this._obstacles.push(...built.obstacles);
      for (const m of built.shadowCasters) this.shadowGen.addShadowCaster(m);
      if (built.propsReady) {
        this._poiReady = built.propsReady.then(({ obstacles, shadowCasters }) => {
          this._obstacles.push(...obstacles);
          for (const m of shadowCasters) this.shadowGen.addShadowCaster(m);
        });
      }
      return;
    }
    if (this.zone) {
      // The zone builder constructs the whole environment: sculpted terrain,
      // biome dressing, POIs, the south tunnel + safe zone, the Keep vista.
      // Its AABBs feed the existing obstacle collision system.
      const built = buildWorld1(this.scene, this.zone);
      this._obstacles.push(...built.obstacles);
      for (const m of built.shadowCasters) this.shadowGen.addShadowCaster(m);
      return;
    }
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100, subdivisions: 1 }, this.scene);

    // Arena grid using GridMaterial — dedicated shader, no texture hacks needed
    const mat = new GridMaterial('groundMat', this.scene);
    mat.majorUnitFrequency  = 5;               // bold line every 5 units
    mat.minorUnitVisibility = 0.35;            // subtle minor lines between
    mat.gridRatio           = 1;               // 1 unit per grid cell
    mat.mainColor           = new Color3(0.28, 0.28, 0.34);  // dark slate base
    mat.lineColor           = new Color3(0.85, 0.85, 0.95);  // near-white lines
    mat.opacity             = 1.0;
    mat.backFaceCulling     = false;
    ground.material = mat;
    ground.receiveShadows = true;

    // Inner editable terrain — sits on top of outer ground, subdivided for height sculpting
    this.terrainMesh = MeshBuilder.CreateGround('terrain', {
      width: 48, height: 48, subdivisions: 10, updatable: true,
    }, this.scene);
    this.terrainMesh.position.y = 0.01;
    this.terrainMesh.material      = mat;
    this.terrainMesh.receiveShadows = true;
  }

  _setupEnvironment() {
    if (this.zone) return;   // zones have no arena walls — borders are terrain (M3)
    const wallMat = new StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor  = new Color3(0.95, 0.82, 0.30);
    wallMat.specularColor = new Color3(0.08, 0.08, 0.08);

    const stripeMat = new StandardMaterial('stripeDecalMat', this.scene);
    stripeMat.diffuseColor  = new Color3(0.90, 0.10, 0.08);
    stripeMat.specularColor = new Color3(0.0, 0.0, 0.0);

    // [name, w, h, d, x, y, z]
    const wallDefs = [
      ['wallN', 102, 2.2, 1.2,    0, 1.1, -50],
      ['wallS', 102, 2.2, 1.2,    0, 1.1,  50],
      ['wallE', 1.2, 2.2, 102,   50, 1.1,   0],
      ['wallW', 1.2, 2.2, 102,  -50, 1.1,   0],
    ];
    for (const [name, w, h, d, x, y, z] of wallDefs) {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
      wall.position.set(x, y, z);
      wall.material = wallMat;
      wall.receiveShadows = true;
      this.shadowGen.addShadowCaster(wall);
    }

    // Red accent stripe near top of each wall's interior face
    const stripeDefs = [
      ['stripeN', 102,  0.30, 0.06,    0, 1.85, -49.4],
      ['stripeS', 102,  0.30, 0.06,    0, 1.85,  49.4],
      ['stripeE', 0.06, 0.30, 102,  49.4, 1.85,     0],
      ['stripeW', 0.06, 0.30, 102, -49.4, 1.85,     0],
    ];
    for (const [name, w, h, d, x, y, z] of stripeDefs) {
      const stripe = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
      stripe.position.set(x, y, z);
      stripe.material = stripeMat;
    }
  }

  _setupSky() {
    // Top-down camera (y=34, beta=0.5) sees the ground as the dominant surface.
    // The clearColor IS the sky — it fills all pixels outside the arena ground.
    if (this.zone) {
      const [r, g, b] = this.zone.palette.sky;
      this.scene.clearColor = new Color4(r, g, b, 1.0);
      // Atmospheric haze — colour matches sky horizon so far terrain fades naturally
      this.scene.fogMode    = Scene.FOGMODE_EXP2;
      this.scene.fogColor   = new Color3(Math.min(1, r + 0.04), Math.min(1, g + 0.02), b);
      this.scene.fogDensity = 0.004;
      return;   // sky dome + clouds live in the zone builder
    }
    this.scene.clearColor = new Color4(0.48, 0.78, 1.0, 1.0);

    // Clouds positioned outside the arena perimeter at low altitude so
    // the elevated camera actually sees them around the arena edges.
    const cloudMat = new StandardMaterial('cloudMat', this.scene);
    cloudMat.diffuseColor    = new Color3(1, 1, 1);
    cloudMat.emissiveColor   = new Color3(0.90, 0.93, 0.98);
    cloudMat.disableLighting = true;

    // [centerX, centerY, centerZ, scale]
    const cloudDefs = [
      [  10, 5,  80, 10],
      [ -80, 4,  35,  8],
      [  80, 5, -15,  9],
      [ -45, 4,  85, 11],
      [  65, 5,  70,  8],
      [ -65, 4, -70,  7],
    ];
    const puffLayout = [
      [  0.0, 0.0, 0, 1.00],
      [  2.2, 0.3, 0, 0.80],
      [ -2.0, 0.2, 0, 0.75],
      [  0.5, 1.4, 0, 0.65],
    ];
    for (const [cx, cy, cz, scale] of cloudDefs) {
      const root = new TransformNode(`cloud_${cx}_${cz}`, this.scene);
      root.position.set(cx, cy, cz);
      for (const [px, py, pz, pr] of puffLayout) {
        const puff = MeshBuilder.CreateSphere(`puff_${cx}_${px}`, {
          diameter: pr * scale * 2, segments: 5,
        }, this.scene);
        puff.position.set(px * scale, py * scale, pz * scale);
        puff.material   = cloudMat;
        puff.parent     = root;
        puff.isPickable = false;
      }
    }
  }

  _setupHazards() {
    if (this.zone) {
      // Green Fields has no lava. Empty zone list keeps _checkHazards a no-op;
      // the game loop guards _updateLavaTex/_lavaGlow on this._lavaTex.
      this.lavaZones = [];
      this._lavaTex  = null;
      return;
    }
    const TS = 16; // 16×16 pixel grid — Minecraft scale

    // Animated lava texture
    this._lavaTex = new DynamicTexture('lavaTex', { width: TS, height: TS }, this.scene, false);
    this._lavaTex.updateSamplingMode(1); // NEAREST — hard pixel edges

    const lavaMat = new StandardMaterial('lavaMat', this.scene);
    lavaMat.disableLighting = true;
    lavaMat.diffuseTexture  = this._lavaTex;
    lavaMat.emissiveTexture = this._lavaTex;

    const lava = MeshBuilder.CreateBox('lavaPool', { width: 10, height: 0.1, depth: 10 }, this.scene);
    lava.position.set(-15, 0.05, 0);
    lava.material = lavaMat;

    // Seed heat grid with random values
    this._lavaGrid  = Array.from({ length: TS }, () =>
      Array.from({ length: TS }, () => Math.random()),
    );
    this._lavaFrame = 0;

    this.lavaZones = [{ x: -15, z: 0, halfW: 5, halfD: 5, dps: 80 }];

    // Glow — only affects the lava mesh
    this._lavaGlow = new GlowLayer('lavaGlow', this.scene);
    this._lavaGlow.intensity = 0.8;
    this._lavaGlow.addIncludedOnlyMesh(lava);

  }

  _updateLavaTex() {
    const TS    = 16;
    const grid  = this._lavaGrid;

    // Throttle to every 3 rendered frames for the slow Minecraft lava feel
    this._lavaFrame++;
    if (this._lavaFrame % 3 !== 0) return;

    // Cellular automaton — each cell blends with neighbours + random heat injections
    const next = grid.map(row => [...row]);
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const l = grid[y][(x - 1 + TS) % TS];
        const r = grid[y][(x + 1) % TS];
        const u = grid[(y - 1 + TS) % TS][x];
        const d = grid[(y + 1) % TS][x];
        let v = grid[y][x] * 0.4 + l * 0.15 + r * 0.15 + u * 0.15 + d * 0.15;
        if (Math.random() < 0.04) v = 0.6 + Math.random() * 0.4; // random heat spike
        next[y][x] = Math.max(0.05, Math.min(1.0, v));
      }
    }
    this._lavaGrid = next;

    // Draw pixel-by-pixel using a 6-stop lava palette
    const ctx = this._lavaTex.getContext();
    const img = ctx.createImageData(TS, TS);
    const px  = img.data;
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const v = this._lavaGrid[y][x];
        let r, g, b;
        if      (v < 0.20) { r=40;  g=0;   b=60; }
        else if (v < 0.38) { r=130; g=0;   b=100; }
        else if (v < 0.55) { r=220; g=30;  b=140; }
        else if (v < 0.70) { r=255; g=100; b=30; }
        else if (v < 0.85) { r=255; g=200; b=30; }
        else               { r=255; g=240; b=180; }
        const i = (y * TS + x) * 4;
        px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this._lavaTex.update();
  }

  _setupEntities() {
    const spawn  = this.zone?.spawn ?? { x: 0, z: 0 };
    const bounds = this.zone?.bounds.half ?? 48;

    this.tank = new Tank(this.scene, spawn.x, spawn.z);
    audio.attachListener(this.tank.root); // 3D audio relative to the player
    audio.startLoop('tank.engine', { emitter: this.tank.root }); // idle hum; swells with speed
    // (grassy-zone ambience TBD — pending cozy-grassland ambient research; sea bed reserved for a coastal leg)
    this.tank.bounds = bounds;
    this.tank.addShadows(this.shadowGen);

    // One unified enemy array. Zone: every spawn in the config becomes a
    // Sentinel-bot with its band's tuning (ambushers start hidden in the tall
    // grass). Dev arena: a lone Sentinel + a chaff ring to fight.
    if (this.zone) {
      const tuning = this.zone.bandTuning;
      this.enemies = [];
      this._spawnDefs = [];   // kept index-aligned with enemies for _restart
      const add = (enemy, x, z) => {
        enemy.addShadows?.(this.shadowGen);
        this.enemies.push(enemy);
        this._spawnDefs.push([x, z]);
      };
      // Scatter n points randomly around a centre (random angle + radius → an
      // organic spread, not an even ring that reads as "organized").
      const scatter = (cx, cz, n, r) => {
        const out = [];
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const rad = r * (0.35 + Math.random() * 0.65);
          out.push([cx + Math.sin(a) * rad, cz + Math.cos(a) * rad]);
        }
        return out;
      };
      // patrol: null = static; { route, loop } = shared waypoint path; { leash } = each
      // unit wanders an area anchored to its own spawn point (leash optional → default).
      const spawnChaff = (cx, cz, n, patrol = null) => {
        for (const [px, pz] of scatter(cx, cz, n, 3.2)) {
          let p = null;
          if (patrol) p = patrol.route ? patrol : { anchor: [px, pz], leash: patrol.leash };
          add(new ChaffEnemy(this.scene, px, pz, { bounds, patrol: p }), px, pz);
        }
      };
      const spawnSentinels = (cx, cz, n, t, ambush) => {
        for (const [px, pz] of scatter(cx, cz, n, 3.6))
          add(new SentinelEnemy(this.scene, px, pz, { hp: t.hp, damage: t.dmg, cooldown: t.cooldown, ambush, bounds }), px, pz);
      };
      // Artillery support: place n mortar(s) set BACK from the squad (deeper into the
      // field, +Z away from the player's southern approach) so they lob over their own
      // line rather than standing in it.
      const spawnMortarSupport = (cx, cz, n = 1) => {
        for (let i = 0; i < n; i++) {
          const px = cx + (Math.random() - 0.5) * 8;
          const pz = cz + 10 + Math.random() * 6;   // 10–16u deeper than the squad
          add(new MortarEnemy(this.scene, px, pz, { bounds }), px, pz);
        }
      };
      // Each former single-tank spawn becomes a spider-bot pack; POI markers become
      // a heavier encounter — either 2 Sentinels or a big 8-strong spider swarm. Mid/deep
      // encounters can additionally bring a Mortar-bot: likely behind a Sentinel group
      // (artillery support), rarely behind a spider squad. The 'near' on-ramp stays gentle.
      for (const e of this.zone.enemies) {
        const t = tuning[e.band] || tuning.mid;
        const escalated = e.band !== 'near';   // gate artillery to mid/deep depth
        if (e.poi) {
          if (Math.random() < 0.5) {
            spawnSentinels(e.x, e.z, 2, t, e.mode === 'ambush');
            if (escalated && Math.random() < MORTAR_SUPPORT_CHANCE) spawnMortarSupport(e.x, e.z, 1);
          } else {
            spawnChaff(e.x, e.z, 3 + Math.floor(Math.random() * 3));   // 3–5 spider bots (5 max)
            if (escalated && Math.random() < MORTAR_SQUAD_CHANCE) spawnMortarSupport(e.x, e.z, 1);
          }
        } else if (e.mode === 'patrol') {
          // §③: roaming pack — shared route if authored, else per-unit area wander.
          const patrol = e.route ? { route: e.route, loop: e.loop } : { leash: e.leash };
          spawnChaff(e.x, e.z, 3 + Math.floor(Math.random() * 2), patrol);
          if (escalated && Math.random() < MORTAR_SQUAD_CHANCE) spawnMortarSupport(e.x, e.z, 1);
        } else {
          spawnChaff(e.x, e.z, 3 + Math.floor(Math.random() * 2));   // 3–4 spider bots
          if (escalated && Math.random() < MORTAR_SQUAD_CHANCE) spawnMortarSupport(e.x, e.z, 1);
        }
      }
      // Any explicitly-seeded chaff from the zone config.
      for (const c of (this.zone.chaff ?? [])) add(new ChaffEnemy(this.scene, c.x, c.z, { bounds }), c.x, c.z);
      // The loading screen waits for the player AND the composed enemies.
      this.ready = Promise.all([this.ready, ...this.enemies.map(e => e.ready)]);
    } else {
      // Dev arena (the grid blank room) = a clean enemy-testing sandbox with a live
      // spawn menu (pick the mix on the fly). Only rotY-capable enemies spawn here.
      this.enemies = [];
      this._spawnDefs = [];
      this._devBounds = bounds;
      this._spawnDevSet({ chaff: 6, sentinel: 1, mortar: 2 });   // sensible default mix
      this._buildDevSpawnMenu();
    }


    // Pause / restart
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code !== 'Escape') return;
      if (window.__state !== 'GAME' && window.__state !== 'PAUSED') return;
      this._paused = !this._paused;
      window.__state = this._paused ? 'PAUSED' : 'GAME';
      document.getElementById('pause').style.display = this._paused ? 'flex' : 'none';
      if (this._paused) { music.fadePause(); audio.pauseAll(); } // fade music + all sfx to silence
      else { music.fadeResume(); audio.resumeAll(); }            // fade everything back up
    });
    // NOTE: the #pause-restart and #death-restart buttons are owned solely by
    // main.js (it restarts the scene, restores the HUD, and restarts the music).
    // They used to be bound here too, which fired _restart() twice per click —
    // removed. ESC (above) is the only restart-adjacent handler this scene owns.

    // Fetch model manifest then load — manifest provides node name overrides per model
    fetch('/assets/models/manifest.json')
      .then(r => r.json())
      .catch(() => ({}))
      .then(manifest => {
        const modelFile = localStorage.getItem('selectedTank') || 'composed';
        if (modelFile === 'primitive') {
          // Primitive Tank.js entity already has turretPivot/barrelPivot — nothing to load
          document.getElementById('controls-start').textContent = 'PRESS ENTER TO BATTLE';
          this._readyResolve();
          return;
        }
        // Composed modular tank — also the fallback for any selectedTank no longer in the
        // manifest (e.g. the removed whole-GLB M26), so a stale save can't 404.
        if (modelFile === 'composed' || !manifest[modelFile]) {
          const loadout = validLoadout(JSON.parse(localStorage.getItem('selectedLoadout') || 'null'));
          this._loadPlayerComposed(loadout);
          return;
        }
        this._loadPlayerGLB(modelFile, manifest[modelFile] ?? {});
      });
  }

  _loadPlayerGLB(modelFile = 'm26_pershing_war_thunder.glb', config = {}) {
    const rootName   = config.root        ?? 'Sketchfab_model';
    const turretName = config.turret      ?? 'turret';
    const mountName  = config.mount       ?? 'mount';
    const facingAxis = config.facingAxis  ?? '+X';

    // Map facing axis → Y rotation that aligns model toward game +Z forward
    const yRot = yRotForFacing(facingAxis);

    const startBtn = document.getElementById('controls-start');
    startBtn.textContent = 'LOADING…';
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '0.4';

    SceneLoader.ImportMeshAsync('', '/assets/models/tanks/', modelFile, this.scene).then(result => {
      // Exact name match first, then fuzzy fallback so any well-named GLB works
      const glbRoot    = result.transformNodes.find(n => n.name === rootName)
        ?? result.transformNodes.find(n => n.name !== '__root__' && n.parent == null);
      const turretNode = result.transformNodes.find(n => n.name === turretName)
        ?? result.transformNodes.find(n => /turret|tower|gun.base/i.test(n.name));
      const mountNode  = result.transformNodes.find(n => n.name === mountName)
        ?? result.transformNodes.find(n => /mount|barrel|gun|cannon|tube|weapon/i.test(n.name));

      if (!glbRoot) { console.error(`GLB load: no root node found in ${modelFile}`); return; }

      // --- 1. Correct orientation from facingAxis → game +Z ---
      const correction = Quaternion.RotationAxis(Vector3.Up(), yRot);
      if (glbRoot.rotationQuaternion) {
        glbRoot.rotationQuaternion = correction.multiply(glbRoot.rotationQuaternion);
      } else {
        glbRoot.rotationQuaternion = correction;
      }

      // --- 2. Force world matrices after rotation so bounding box is correct ---
      result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      // --- 3. Bounding box in world space (model still at origin) ---
      const { minX, minY, minZ, maxX, maxY, maxZ } =
        worldBounds(result.meshes, m => m.name !== '__root__');

      // Scale to targetWidth (default 2.4) — barrel overhang is intentional
      const modelW      = maxX - minX;
      const modelD      = maxZ - minZ;
      const targetWidth = config.targetWidth ?? 2.4;
      const scale       = targetWidth / modelW;
      const offX   = -((maxX + minX) / 2) * scale;
      const offY   = -minY * scale;
      // zCenterAdjust shifts the whole model forward so hull center sits at Z≈0
      // (default centers barrel midpoint; use manifest override to center hull instead)
      const offZ   = -((maxZ + minZ) / 2) * scale + (config.zCenterAdjust ?? 0);

      // --- 4. Hide ALL primitive placeholder meshes under tank.root before attaching GLB ---
      this.scene.meshes
        .filter(m => m.isDescendantOf(this.tank.root))
        .forEach(m => { m.isVisible = false; });

      // --- 5. Attach glbRoot directly to tank.root ---
      glbRoot.parent = this.tank.root;
      glbRoot.scaling.setAll(scale);
      glbRoot.position.set(offX, offY, offZ);

      // --- 6. Force world matrices with new parent chain ---
      result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      // Capture world positions BEFORE re-parenting so we can correct pivot centers.
      // turretNode origin = turret ring center; mountNode origin = barrel trunnion.
      const turretAbsPos = turretNode ? turretNode.absolutePosition.clone() : null;
      const mountAbsPos  = mountNode  ? mountNode.absolutePosition.clone()  : null;

      // --- 7a. Turret → turretPivot, then move pivot to the detected basket (ring) centre ---
      if (turretNode) {
        // Pivot about the turret's basket centre so it spins in place, not the GLB `turret`
        // empty (which sits behind the dome). Same adaptive detection as the designer +
        // assembleTank: measureBasket finds the dome centre and strips the forward-jutting gun.
        const turretMeshes = result.meshes.filter(m => m.isDescendantOf(turretNode));
        const basket = measureBasket(turretMeshes, turretAbsPos.z);   // basket centre, world XZ
        turretNode.setParent(this.tank.turretPivot);
        // GLB node origins sit at the model's base plane (y≈0), so absolutePosition.y
        // is not useful for height. Only correct X and Z (the "too far forward" issue).
        const rootInv = Matrix.Invert(this.tank.root.getWorldMatrix());
        const localPos    = Vector3.TransformCoordinates(turretAbsPos, rootInv);  // empty (height)
        const basketLocal = Vector3.TransformCoordinates(basket.center, rootInv); // pivot XZ
        const pivotZShift = config.turretPivotZOffset ?? 0;   // optional manual nudge (default 0)
        this.tank.turretPivot.position.x = config.centerTurretX ? 0 : basketLocal.x;
        this.tank.turretPivot.position.z = basketLocal.z + pivotZShift;
        // Use GLB turret node Y if it carries meaningful height (explicitly placed pivot),
        // otherwise fall back to Tank.js default (0.55) for models where node Y ≈ 0.
        if (localPos.y > 0.3) {
          this.tank.turretPivot.position.y = localPos.y;
        } else {
          console.warn(`[GLB] ${modelFile}: turretNode y=${localPos.y.toFixed(3)} — empty may be misplaced in Blender (expected > 0.3). Geometry preserved at original position but rotation pivot will be off.`);
        }
        this.tank.turretPivot.computeWorldMatrix(true);
        // Compute local offset that keeps geometry at its original world position.
        // When the "turret" empty is correctly placed, this ≈ (0,0,-pivotZShift).
        // When the empty is at the wrong height (near ground), this prevents geometry
        // from jumping to turretPivot's height. Same fix as TankDesignerScene.
        const tpInvT = Matrix.Invert(this.tank.turretPivot.getWorldMatrix());
        const localInPivot = Vector3.TransformCoordinates(turretAbsPos, tpInvT);
        turretNode.position.set(localInPivot.x, localInPivot.y, localInPivot.z);
        turretNode.computeWorldMatrix(true);
        // Propagate to all descendants (mountNode is still under turretNode)
        result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      }

      // --- 7b. Mount → barrelPivot, then move pivot to barrel trunnion XZ ---
      if (mountNode) {
        mountNode.setParent(this.tank.barrelPivot);
        // Same logic: only correct X and Z, keep Y=0.3 (barrel height above ring)
        const tpInv = Matrix.Invert(this.tank.turretPivot.getWorldMatrix());
        const localPos = Vector3.TransformCoordinates(mountAbsPos, tpInv);
        this.tank.barrelPivot.position.x = 0; // force center — small X drift is a coord-system artifact
        this.tank.barrelPivot.position.z = localPos.z;
        // Use GLB mount node Y if present (explicitly placed pivot), else keep Tank.js default 0.3
        if (localPos.y > 0) this.tank.barrelPivot.position.y = localPos.y;
        this.tank.barrelPivot.computeWorldMatrix(true);
        mountNode.position.setAll(0);
        this._barrelPivotBaseZ = this.tank.barrelPivot.position.z;
        this._barrelTipOffset  = config.barrelTipOffset ?? 1.8;
      }

      // --- 8. Shadows ---
      for (const m of result.meshes) {
        if (m.name === '__root__') continue;
        this.shadowGen.addShadowCaster(m);
        m.receiveShadows = true;
      }

      // --- 8.5. Paint — body panels get manifest paintColor (matte), tracks/optics left original
      applyModelPaint(result.meshes, config, this.scene);

      const tp = this.tank.turretPivot.position;
      const bp = this.tank.barrelPivot.position;
      console.log(`[GLB] ${modelFile} loaded: scale=${scale.toFixed(4)}, w=${modelW.toFixed(2)}, d=${modelD.toFixed(2)}`);
      console.log(`[GLB] turretPivot: x=${tp.x.toFixed(3)} y=${tp.y.toFixed(3)} z=${tp.z.toFixed(3)}`);
      console.log(`[GLB] barrelPivot (turret-local): x=${bp.x.toFixed(3)} y=${bp.y.toFixed(3)} z=${bp.z.toFixed(3)}`);

      startBtn.textContent = 'PRESS ENTER TO BATTLE';
      startBtn.style.pointerEvents = '';
      startBtn.style.opacity = '';
      this.tank.fitCollisionToModel();   // fit the hitbox to the loaded GLB hull
      this._readyResolve();
    }).catch(e => {
      console.error(`[GLB] ${modelFile} load failed:`, e);
      startBtn.textContent = 'PRESS ENTER TO BATTLE';
      startBtn.style.pointerEvents = '';
      startBtn.style.opacity = '';
      this._readyResolve();
    });
  }

  // Build the modular tank (hull + turret + cannon) straight onto the Tank entity's pivots, so
  // all existing gameplay — hull movement, turret aim, elevation, recoil, lock-on — drives it
  // unchanged. assembleTank handles the adaptive ring pivot, scaling and grounding.
  _loadPlayerComposed(loadout) {
    const startBtn = document.getElementById('controls-start');
    startBtn.textContent = 'LOADING…';
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '0.4';

    // Hide the primitive placeholder meshes before the composed parts attach to tank.root.
    this.scene.meshes
      .filter(m => m.isDescendantOf(this.tank.root))
      .forEach(m => { m.isVisible = false; });

    // Barrel painted to match the turret body (blue M26, red T-44) so the gun reads as part of
    // the same tank — same rule the designer uses, not a hardcoded colour.
    const paint = JSON.parse(localStorage.getItem('selectedPaint') || 'null');  // player paint or null
    const bodyCol = paint ?? PARTS_BY_ID[loadout.turret]?.paintColor ?? [0.12, 0.42, 0.88];
    const cannonMat = makePaintMaterial(this.scene, bodyCol);

    assembleTank(this.scene, loadout, { cannon: cannonMat }, {
      target: { root: this.tank.root, turretPivot: this.tank.turretPivot, barrelPivot: this.tank.barrelPivot },
      paint,
    }).then(assembled => {
      const { hullBuilt, turretBuilt, cannonBuilt } = assembled.parts;
      const allMeshes = [...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes];

      // Recoil baseline + muzzle tip (derived from the cannon geometry — no hardcoded offset).
      this._barrelPivotBaseZ = this.tank.barrelPivot.position.z;
      this._barrelTipOffset  = this._measureBarrelTip(cannonBuilt.meshes);

      for (const m of allMeshes) {
        this.shadowGen.addShadowCaster(m);
        m.receiveShadows = true;
      }

      console.log(`[Composed] ${loadout.hull}+${loadout.turret}+${loadout.cannon} loaded: scale=${assembled.scale.toFixed(3)}, barrelTip=${this._barrelTipOffset.toFixed(2)}`);
      startBtn.textContent = 'PRESS ENTER TO BATTLE';
      startBtn.style.pointerEvents = '';
      startBtn.style.opacity = '';
      this.tank.fitCollisionToModel(assembled.footprint);   // authored hull footprint (fallback: measure)
      this._readyResolve();
    }).catch(e => {
      console.error('[Composed] assembly failed for', loadout, e);
      startBtn.textContent = 'PRESS ENTER TO BATTLE';
      startBtn.style.pointerEvents = '';
      startBtn.style.opacity = '';
      this._readyResolve();
    });
  }

  // Muzzle tip = furthest +Z of the cannon, in barrelPivot-local space (what _barrelTip expects).
  _measureBarrelTip(cannonMeshes) {
    this.tank.barrelPivot.computeWorldMatrix(true);
    const inv = Matrix.Invert(this.tank.barrelPivot.getWorldMatrix());
    let maxZ = 0;
    for (const m of cannonMeshes) {
      m.computeWorldMatrix(true);
      for (const corner of m.getBoundingInfo().boundingBox.vectorsWorld) {
        const local = Vector3.TransformCoordinates(corner, inv);
        if (local.z > maxZ) maxZ = local.z;
      }
    }
    return maxZ || 1.8;
  }

  _setupLockOn() {
    const ringMat = new StandardMaterial('lockRingMat', this.scene);
    ringMat.diffuseColor  = new Color3(0.8, 0.0, 0.0);
    ringMat.emissiveColor = new Color3(1.0, 0.0, 0.0);
    ringMat.alpha = 0.9;

    this.lockRing = MeshBuilder.CreateTorus('lockRing', {
      diameter: 3.8, thickness: 0.18, tessellation: 40,
    }, this.scene);
    // Torus default axis is Y — ring already lies flat in XZ plane, no rotation needed
    this.lockRing.rotation.x = 0;
    this.lockRing.isVisible  = false;
    this.lockRing.material   = ringMat;

    // Second ring used only for the quick fade-out when switching / unlocking
    const fadeMat = new StandardMaterial('fadeRingMat', this.scene);
    fadeMat.diffuseColor  = new Color3(0.8, 0.0, 0.0);
    fadeMat.emissiveColor = new Color3(1.0, 0.0, 0.0);
    fadeMat.alpha = 0;
    this.fadeRing = MeshBuilder.CreateTorus('fadeRing', {
      diameter: 3.8, thickness: 0.18, tessellation: 40,
    }, this.scene);
    this.fadeRing.rotation.x = 0;
    this.fadeRing.isVisible  = false;
    this.fadeRing.material   = fadeMat;

    this._lockPulseTime = 0;
    this._aimEl = document.getElementById('aim-indicator');

    window.addEventListener('keydown', (e) => {
      if (!LOCKON_ENABLED) return;   // lock-on disabled (future module)
      if (e.code !== 'KeyF' || this._fHeld) return;
      this._fHeld       = true;
      this._fHoldTime   = 0;
      this._fDidLock    = false;
      this._lockPulseTime = 0; // restart pulse animation each hold attempt
    });

    window.addEventListener('keyup', (e) => {
      if (e.code !== 'KeyF') return;
      if (!this._fDidLock) {
        if (this.lockedEnemy) {
          // Tap unlock — fade out current target
          this._prevLockedEnemy = this.lockedEnemy;
          this._fadeOutTime     = 0;
          this.lockedEnemy      = null;
        } else {
          // Released early without completing lock — fade out candidate ring from wherever it was
          this._cancelFadeEnemy    = this._nearestToCursor();
          this._cancelFadeAlpha    = this.lockRing.material.alpha;
          this._cancelFadeHoldTime = this._fHoldTime; // continue shrink from here
          this._cancelFadeTime     = 0;
        }
      }
      this._fHeld = false;
    });
  }

  // Nearest LIVING enemy that is actively engaging the player (state past IDLE/
  // AMBUSH). All enemy types extend AIEnemy, so this aggro check is universal.
  // Used by the mobile auto-aim so you can't target enemies outside their aggro.
  _nearestAggroedEnemy() {
    const px = this.tank.position.x, pz = this.tank.position.z;
    let best = null, bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.state === 'IDLE' || e.state === 'AMBUSH') continue;   // hasn't aggroed onto us
      const d = (e.position.x - px) ** 2 + (e.position.z - pz) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  _nearestToCursor() {
    let cx = this.tank.position.x;
    let cz = this.tank.position.z;
    const ray = this.scene.createPickingRay(
      this.scene.pointerX, this.scene.pointerY, null, this.camera,
    );
    if (ray && Math.abs(ray.direction.y) > 0.0001) {
      const t = -ray.origin.y / ray.direction.y;
      cx = ray.origin.x + t * ray.direction.x;
      cz = ray.origin.z + t * ray.direction.z;
    }
    let nearest = null, bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.position.x - cx, enemy.position.z - cz);
      if (d < bestDist) { bestDist = d; nearest = enemy; }
    }
    return nearest;
  }

  _lockOnNearestToCursor() {
    const next = this._nearestToCursor();
    if (this.lockedEnemy && this.lockedEnemy !== next) {
      this._prevLockedEnemy = this.lockedEnemy;
      this._fadeOutTime     = 0;
    }
    this.lockedEnemy   = next;
    this._lockSnapTime = 0; // kick off snap animation
  }

  _checkObstacleCollisions() {
    if (!this.tank.alive) return;
    const t = this.tank;
    for (const obs of this._obstacles) {
      const dx = t.position.x - obs.position.x;
      const dz = t.position.z - obs.position.z;
      const overlapX = (t.halfW + obs.halfW) - Math.abs(dx);
      const overlapZ = (t.halfD + obs.halfD) - Math.abs(dz);
      // `> 0` (not `<= 0`) so a NaN overlap is skipped, never added to position.
      if (!(overlapX > 0) || !(overlapZ > 0)) continue;
      t.speed *= 0.25;
      if (overlapX < overlapZ) {
        t.root.position.x += overlapX * Math.sign(dx);
      } else {
        t.root.position.z += overlapZ * Math.sign(dz);
      }
    }
  }

  _setupGameLoop() {
    let lastTime = performance.now();

    this.scene.registerBeforeRender(() => {
      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.05);
      lastTime  = now;

      if (this._paused) return;

      // Hold-F lock-on: fire after 0.7 s
      if (this._fHeld && !this._fDidLock) {
        this._fHoldTime += dt;
        if (this._fHoldTime >= 0.7) {
          this._fDidLock = true;
          this._lockOnNearestToCursor();
        }
      }

      // Mobile (Soul-Knight style): the turret auto-locks the nearest enemy that
      // is actually aggroed onto the player — you can't snipe enemies outside
      // their own aggro range. Desktop keeps manual mouse aim (this is skipped).
      if (window.__mobile && window.__mobile.active) {
        this.lockedEnemy = this._nearestAggroedEnemy();
      }

      // Pass lock target to tank — use predicted position for moving targets
      if (this.lockedEnemy) {
        this.tank.lockTarget = this._predictTargetPos(this.lockedEnemy);
      } else if (window.__mobile && window.__mobile.active) {
        // No aggroed target → rest the gun facing the hull's heading.
        this.tank.lockTarget = {
          x: this.tank.position.x + Math.sin(this.tank.rotY) * 20,
          z: this.tank.position.z + Math.cos(this.tank.rotY) * 20,
        };
      } else {
        this.tank.lockTarget = null;
      }

      this.tank.update(dt);
      this._clampCorridor();
      this.trackMarks.update(dt, this.tank);   // drop/fade ground marks at the final position

      // Group-steering pre-pass (§③): per living enemy, sum an inverse-distance
      // separation nudge from packmates (anti-clump) and count nearby allies (feeds
      // light "confidence" — lone scouts kite). N² over the small living pack = cheap.
      // Encirclement/high-aggression layers are deferred to W2+ (see design doc).
      const SEP_RADIUS = 6, SEP_MAX = 2.5;
      for (const e of this.enemies) {
        if (!e.alive) { e._sepX = 0; e._sepZ = 0; e._nearbyAllies = 0; continue; }
        let sx = 0, sz = 0, allies = 0;
        for (const o of this.enemies) {
          if (o === e || !o.alive) continue;
          const dx = e.position.x - o.position.x, dz = e.position.z - o.position.z;
          const d2 = dx * dx + dz * dz;
          if (d2 >= SEP_RADIUS * SEP_RADIUS || d2 < 1e-4) continue;
          allies++;
          const d = Math.sqrt(d2), w = (SEP_RADIUS - d) / SEP_RADIUS;   // 1 when overlapping → 0 at edge
          sx += (dx / d) * w; sz += (dz / d) * w;
        }
        const mag = Math.hypot(sx, sz);
        if (mag > 1e-4) {
          const strength = Math.min(mag, 1) * SEP_MAX;   // smooth 0→cap; reaches SEP_MAX when crowded
          e._sepX = (sx / mag) * strength; e._sepZ = (sz / mag) * strength;
        } else { e._sepX = 0; e._sepZ = 0; }
        e._nearbyAllies = allies;
      }

      let _aliveEnemies = 0;
      for (const enemy of this.enemies) {
        enemy.update(dt, this.tank.position);
        if (enemy.shells) for (const s of enemy.shells) s.update(dt);
        if (enemy.alive) _aliveEnemies++;
      }
      // Combat music intensity swells with the number of live threats (throttled).
      this._musicT = (this._musicT ?? 0) - dt;
      if (this._musicT <= 0) { music.setIntensity(Math.min(1, _aliveEnemies / 5)); this._musicT = 0.5; }

      // Barrel elevation disabled for flat-shot mode — re-enable with _elevationForHeight when arc shots return
      this.tank.barrelElevation = 0;

      // Barrel recoil: kick back on fire, spring back to rest over 0.22s (no overshoot)
      if (this.tank._recoil > 0) {
        this.tank._recoil = Math.max(0, this.tank._recoil - dt / 0.22);
        const kick = -0.30 * this.tank._recoil;
        this.tank.barrelPivot.position.z = this._barrelPivotBaseZ + kick;
      }

      if (this._lavaTex) {
        this._updateLavaTex();
        this._lavaGlow.intensity = 0.5 + Math.sin(performance.now() / 600) * 0.35;
      }
      this._checkHazards(dt);
      this._checkCollisions();
      this._checkObstacleCollisions();
      const _cdBefore = this._fireCooldown;
      this._fireCooldown = Math.max(0, this._fireCooldown - dt);
      if (_cdBefore > 0 && this._fireCooldown === 0) audio.play('tank.reload', { emitter: this.tank.root }); // cannon ready
      for (const shell of this.shells) shell.update(dt);
      this._checkShellHits();
      this._checkMortarSplash();
      this._updateExtraction(dt);
      this._updateContainers();
      this.vfx.update(dt);
      this._updateLockRing(dt);
      this._updateAimIndicator();
      this._updateCamera(dt);
      this._updateHUD();
    });
  }

  _updateLockRing(dt) {
    // Mobile uses ONLY the white corner brackets (#aim-indicator) as the lock
    // cue. Suppress the legacy red lock-on ring, which the auto-lock would
    // otherwise draw under every targeted enemy. Desktop is unchanged.
    if (window.__mobile && window.__mobile.active) {
      if (this.lockRing) this.lockRing.isVisible = false;
      if (this.fadeRing) this.fadeRing.isVisible = false;
      return;
    }
    const FADE_OUT = 0.2;
    // Cache candidate once per frame
    const candidate = (this._fHeld && !this._fDidLock) ? this._nearestToCursor() : null;

    // --- fadeRing: holds old target steady during switch, then fades it out ---
    if (this._prevLockedEnemy) {
      this._fadeOutTime += dt;
      const t = this._fadeOutTime / FADE_OUT;
      if (t < 1) {
        this.fadeRing.isVisible          = true;
        this.fadeRing.position.x         = this._prevLockedEnemy.position.x;
        this.fadeRing.position.y         = 0.04;
        this.fadeRing.position.z         = this._prevLockedEnemy.position.z;
        this.fadeRing.material.alpha     = 0.9 * (1 - t);
      } else {
        this.fadeRing.isVisible = false;
        this._prevLockedEnemy   = null;
      }
    } else if (candidate && this.lockedEnemy && candidate !== this.lockedEnemy) {
      // Mid-switch: keep old locked target visible on fadeRing while candidate builds
      this.fadeRing.isVisible          = true;
      this.fadeRing.position.x         = this.lockedEnemy.position.x;
      this.fadeRing.position.y         = 0.04;
      this.fadeRing.position.z         = this.lockedEnemy.position.z;
      this.fadeRing.material.alpha         = 0.9;
      this.fadeRing.material.emissiveColor = new Color3(1, 0, 0);
    } else {
      this.fadeRing.isVisible = false;
    }

    // --- lockRing: candidate closing in during lock-in, solid red when locked ---
    // Skip candidate animation if it's the same as the already-locked enemy (tap-to-unlock case)
    if (candidate && candidate !== this.lockedEnemy) {
      const progress = this._fHoldTime / 0.7;
      const rem      = 1 - progress;
      // Ring closes in: 2.5× → 1× quadratic ease (fast start, slows as it locks)
      this.lockRing.scaling.setAll(1 + 0.9 * rem * rem);
      this.lockRing.material.alpha         = 0.15 + progress * 0.75;
      this.lockRing.material.emissiveColor = new Color3(1, rem * 0.5, 0);
      this.lockRing.isVisible  = true;
      this.lockRing.position.x = candidate.position.x;
      this.lockRing.position.y = 0.04;
      this.lockRing.position.z = candidate.position.z;
    } else if (this._cancelFadeTime >= 0) {
      // Early F release — fade the candidate ring out from wherever it was
      this._cancelFadeTime += dt;
      const t = this._cancelFadeTime / 0.2;
      if (t < 1) {
        // Continue shrinking from where it was when F was released
        const virtualProgress = Math.min((this._cancelFadeHoldTime + this._cancelFadeTime) / 0.7, 1);
        const rem = 1 - virtualProgress;
        this.lockRing.isVisible          = true;
        this.lockRing.scaling.setAll(1 + 0.9 * rem * rem);
        this.lockRing.material.alpha         = this._cancelFadeAlpha * (1 - t);
        this.lockRing.material.emissiveColor = new Color3(1, 0.3, 0);
        this.lockRing.position.x = this._cancelFadeEnemy.position.x;
        this.lockRing.position.y = 0.04;
        this.lockRing.position.z = this._cancelFadeEnemy.position.z;
      } else {
        this._cancelFadeTime  = -1;
        this._cancelFadeEnemy = null;
        this.lockRing.scaling.setAll(1);
        this.lockRing.isVisible = false;
      }

    } else if (this.lockedEnemy) {
      this.lockRing.material.alpha         = 0.9;
      this.lockRing.material.emissiveColor = new Color3(1, 0, 0);
      this.lockRing.isVisible  = true;
      this.lockRing.position.x = this.lockedEnemy.position.x;
      this.lockRing.position.y = 0.04;
      this.lockRing.position.z = this.lockedEnemy.position.z;

      // Snap animation: ring overshoots to 1.5× then eases back to 1× over 0.15s
      if (this._lockSnapTime >= 0) {
        this._lockSnapTime += dt;
        const t     = Math.min(this._lockSnapTime / 0.15, 1);
        const ease  = 1 - (1 - t) * (1 - t);        // quadratic ease-out
        const scale = 1.5 - 0.5 * ease;              // 1.5 → 1.0
        this.lockRing.scaling.setAll(scale);
        if (t >= 1) this._lockSnapTime = -1;
      } else {
        this.lockRing.scaling.setAll(1);
      }
    } else {
      this.lockRing.scaling.setAll(1);
      this.lockRing.isVisible = false;
    }
  }

  _updateAimIndicator() {
    if (!this._aimEl) return;
    // Hide the aim bracket whenever we're not actively aiming — paused, extracting,
    // or dead. (_updateExtraction runs earlier in the same frame, so without this
    // guard a just-completed extract re-shows the bracket and leaves it stuck.)
    if (this._paused || this._extracting || !this.tank.alive) {
      this._aimEl.style.display = 'none';
      return;
    }
    // Mobile auto-aim: the brackets mark the auto-locked enemy. With nothing
    // locked there's no cursor to track, so hide them rather than parking the
    // brackets at a stale screen point.
    if (window.__mobile && window.__mobile.active && !this.lockedEnemy) {
      this._aimEl.style.display = 'none';
      return;
    }
    // Barrel firing plane height — same formula as Tank._updateTurret so everything is consistent
    const tipY = this.tank.root.position.y
      + this.tank.turretPivot.position.y
      + this.tank.barrelPivot.position.y;

    // Reference point: locked enemy or cursor on barrel firing plane
    let tx, tz;
    if (this.lockedEnemy) {
      tx = this.lockedEnemy.position.x;
      tz = this.lockedEnemy.position.z;
    } else {
      tx = this.tank.position.x;
      tz = this.tank.position.z;
      const ray = this.scene.createPickingRay(
        this.scene.pointerX, this.scene.pointerY, null, this.camera,
      );
      if (ray && Math.abs(ray.direction.y) > 0.0001) {
        const t = (tipY - ray.origin.y) / ray.direction.y;
        tx = ray.origin.x + t * ray.direction.x;
        tz = ray.origin.z + t * ray.direction.z;
      }
    }

    // Use turret pivot XZ as origin (matches _updateTurret), range to barrel-plane cursor point
    const tp    = this.tank.turretPivot.position;
    const scale = this.tank.root.scaling.x;
    const cosY  = Math.cos(this.tank.rotY);
    const sinY  = Math.sin(this.tank.rotY);
    const pivotX = this.tank.position.x + (tp.x * cosY + tp.z * sinY) * scale;
    const pivotZ = this.tank.position.z + (-tp.x * sinY + tp.z * cosY) * scale;
    const dx    = tx - pivotX;
    const dz    = tz - pivotZ;
    const range = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
    const aim   = this.tank.turretAimAngle;
    const landPos = new Vector3(
      pivotX + Math.sin(aim) * range,
      tipY,
      pivotZ + Math.cos(aim) * range,
    );

    // Project 3D → CSS pixels
    const engine = this.scene.getEngine();
    const screen = Vector3.Project(
      landPos,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(
        engine.getRenderWidth(true),
        engine.getRenderHeight(true),
      ),
    );

    const dpr = window.devicePixelRatio || 1;
    this._aimEl.style.display = 'block';
    this._aimEl.style.left    = (screen.x / dpr) + 'px';
    this._aimEl.style.top     = (screen.y / dpr) + 'px';
  }

  _checkHazards(dt) {
    if (!this.tank.alive) return;
    for (const zone of this.lavaZones) {
      const dx = Math.abs(this.tank.position.x - zone.x);
      const dz = Math.abs(this.tank.position.z - zone.z);
      if (dx < zone.halfW && dz < zone.halfD) {
        this.tank.takeDamage(zone.dps * dt);
        if (!this.tank.alive) this._showDeath();
        break;
      }
    }
  }

  _showDeath() {
    this._paused = true;
    window.__state = 'DEAD';
    this._aimEl.style.display = 'none';
    music.stop();       // world/combat music ends on death (defeat sting plays over the fade)
    music.playDefeat(); // short descending downer when the death screen appears
    document.getElementById('death').style.display = 'flex';
  }

  _restart() {
    for (let i = 0; i < this.enemies.length; i++) {
      const [x, z] = this._spawnDefs[i];
      this.enemies[i].reset(x, z);
    }
    this.tank.reset();
    audio.startLoop('tank.engine', { emitter: this.tank.root }); // engine was stopped on death
    this.lockedEnemy      = null;
    this._prevLockedEnemy = null;
    this.lockRing.isVisible  = false;
    this.fadeRing.isVisible  = false;
    this._aimEl.style.display = 'none';
    for (const crate of this._crates) crate.reset();
    this._extractZone.reset();
    if (this._containers) for (const c of this._containers) c.looted = false;
    this._nearContainer = null;
    if (this._lootPrompt) this._lootPrompt.style.display = 'none';
    this._runSalvage = 0;
    this._extracting = false;
  }

  _setupExtraction() {
    this._runSalvage = 0;
    this._extracting = false;

    const crates  = this.zone?.loot ?? ARENA_LOOT.salvageCrates;
    const extract = this.zone?.extraction ?? ARENA_LOOT.extractionZone;

    this._crates = crates.map((c) => {
      const crate = new SalvageCrate(this.scene, c);
      crate.addShadows(this.shadowGen);
      return crate;
    });

    this._extractZone = new ExtractionZone(this.scene, extract);

    // E-lootable containers (POI chests): proximity prompt + E (handled in main.js) → salvage.
    this._containers = (this.zone?.containers ?? []).map((c) => ({
      x: c.x, z: c.z, value: c.value | 0, radius: c.radius ?? 5, looted: false,
    }));
    this._nearContainer = null;
    this._lootPrompt = this._ensureLootPrompt();
  }

  // One reused DOM prompt (no per-scene listener/element leak). Built in JS so we never
  // touch index.html (a parallel session has uncommitted edits there).
  _ensureLootPrompt() {
    let el = document.getElementById('loot-prompt');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loot-prompt';
      el.textContent = '[ E ]  LOOT';
      el.style.cssText = 'position:absolute;left:50%;bottom:150px;transform:translateX(-50%);' +
        'font-family:monospace;font-size:18px;letter-spacing:3px;color:#ffd23a;' +
        'text-shadow:0 0 6px #000,0 0 12px #ffb000;z-index:25;display:none;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.style.display = 'none';
    return el;
  }

  // Proximity check for E-loot containers; sets this._nearContainer + toggles the prompt.
  _updateContainers() {
    if (!this._containers || !this._containers.length) { this._nearContainer = null; return; }
    let near = null;
    if (this.tank.alive && !this._extracting) {
      for (const c of this._containers) {
        if (c.looted) continue;
        const dx = this.tank.position.x - c.x, dz = this.tank.position.z - c.z;
        if (dx * dx + dz * dz <= c.radius * c.radius) { near = c; break; }
      }
    }
    this._nearContainer = near;
    if (this._lootPrompt) this._lootPrompt.style.display = near ? 'block' : 'none';
  }

  // Called from main.js on the E key when in range of a container.
  lootNearbyContainer() {
    const c = this._nearContainer;
    if (!c || c.looted) return;
    c.looted = true;
    this._runSalvage += c.value;
    music.playPickup(); // salvage coin ding
    this._nearContainer = null;
    if (this._lootPrompt) this._lootPrompt.style.display = 'none';
  }

  _updateExtraction(dt) {
    for (const crate of this._crates) crate.update(dt);

    if (!this.tank.alive || this._extracting) {
      this._updateExtractionHUD(false);
      return;
    }

    // Drive-over pickups
    for (const crate of this._crates) {
      if (crate.collected) continue;
      const dx = this.tank.position.x - crate.position.x;
      const dz = this.tank.position.z - crate.position.z;
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
        crate.collect();
        this._runSalvage += crate.value;
        music.playPickup(); // salvage coin ding
      }
    }

    // Extraction channel
    const inside = this._extractZone.contains(this.tank.position);
    const done   = this._extractZone.update(dt, inside);
    this._updateExtractionHUD(inside);
    if (done) this._extract();
  }

  _extract() {
    this._extracting = true;
    this._paused     = true;
    window.__state   = 'EXTRACTED';
    const banked = bankSalvage(this._runSalvage);
    if (this._aimEl) this._aimEl.style.display = 'none';
    if (this._lootPrompt) this._lootPrompt.style.display = 'none';
    if (this._onExtract) this._onExtract(this._runSalvage, banked);
  }

  _updateExtractionHUD(inside) {
    const sal = document.getElementById('hud-salvage');
    if (sal) sal.textContent = `SALVAGE: ${this._runSalvage}`;
    const ind = document.getElementById('extract-indicator');
    if (ind) {
      ind.style.display = inside ? 'block' : 'none';
      const bar = document.getElementById('extract-progress-fill');
      if (bar) bar.style.width = `${Math.round(this._extractZone.progress * 100)}%`;
    }
  }

  // Impulse-based elastic collision over ORIENTED boxes (OBB/SAT) — the box rotates with each
  // tank so it matches the visual hull at any angle (no more driving through when turned). Uses
  // RELATIVE velocity, only impulses when CLOSING (so separating stops re-hitting → no stun-lock).
  _checkCollisions() {
    const t = this.tank;
    const pBox = { cx: t.position.x, cz: t.position.z, hw: t.halfW, hd: t.halfD, rot: t.rotY };
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const eBox = { cx: enemy.position.x, cz: enemy.position.z, hw: enemy.halfW, hd: enemy.halfD, rot: enemy.rotY };
      const hit = this._obbOverlap(eBox, pBox);   // normal points enemy → player
      if (!hit) continue;
      const { nx, nz, pen } = hit;

      // Positional separation, split by inverse mass (lighter player moves more).
      const mP = t.mass, mE = enemy.mass;
      const wP = mE / (mP + mE), wE = mP / (mP + mE);
      t.root.position.x     += nx * pen * wP;  t.root.position.z     += nz * pen * wP;
      enemy.root.position.x -= nx * pen * wE;  enemy.root.position.z -= nz * pen * wE;

      // Relative velocity along the normal (negative = closing).
      const pv = { x: Math.sin(t.rotY) * t.speed + t.knockX, z: Math.cos(t.rotY) * t.speed + t.knockZ };
      const ev = enemy.getVelocity();
      const rvn = (pv.x - ev.x) * nx + (pv.z - ev.z) * nz;
      if (rvn < 0) {
        const REST = 0.25;                                  // restitution — a bumpy thud, not a bounce
        const j = -(1 + REST) * rvn / (1 / mP + 1 / mE);
        t.applyKnockback(nx * j / mP, nz * j / mP);         // player: a decaying bump, keeps drive control
        enemy.vx -= nx * j / mE; enemy.vz -= nz * j / mE;   // enemy shoved back by its share
        if (enemy.speed) enemy.speed *= 0.5;                // bleed the rammer's drive so it doesn't re-charge instantly
        const impact = Math.min(1, Math.abs(rvn) / 8);
        this._triggerShake(0.06 + impact * 0.06, 0.15 + impact * 0.30);
      }
    }
  }

  // Separating Axis Theorem for two oriented boxes. Each box: {cx,cz,hw,hd,rot} where the
  // hull's WIDTH is along local X and LENGTH along local Z (forward = (sin rot, cos rot)).
  // Returns { nx, nz, pen } (unit normal A→B + penetration depth) or null if not overlapping.
  _obbOverlap(A, B) {
    const ax = { x: Math.cos(A.rot), z: -Math.sin(A.rot) }, az = { x: Math.sin(A.rot), z: Math.cos(A.rot) };
    const bx = { x: Math.cos(B.rot), z: -Math.sin(B.rot) }, bz = { x: Math.sin(B.rot), z: Math.cos(B.rot) };
    const dcx = B.cx - A.cx, dcz = B.cz - A.cz;
    let minOv = Infinity, nx = 0, nz = 0;
    for (const L of [ax, az, bx, bz]) {
      const rA = A.hw * Math.abs(ax.x * L.x + ax.z * L.z) + A.hd * Math.abs(az.x * L.x + az.z * L.z);
      const rB = B.hw * Math.abs(bx.x * L.x + bx.z * L.z) + B.hd * Math.abs(bz.x * L.x + bz.z * L.z);
      const ov = rA + rB - Math.abs(dcx * L.x + dcz * L.z);
      if (ov <= 0) return null;                  // a separating axis exists → no collision
      if (ov < minOv) { minOv = ov; nx = L.x; nz = L.z; }
    }
    if (dcx * nx + dcz * nz < 0) { nx = -nx; nz = -nz; }   // point the normal A → B
    return { nx, nz, pen: minOv };
  }

  _triggerShake(duration, intensity) {
    this._shakeTime      = duration;
    this._shakeIntensity = intensity;
  }

  _updateCamera(dt) {
    // --- 1. Aim offset: pull frame toward cursor (30%, clamped to 3.5 u) ---
    let aimX = 0, aimZ = 0;
    const ray = this.scene.createPickingRay(
      this.scene.pointerX, this.scene.pointerY, null, this.camera,
    );
    if (ray && Math.abs(ray.direction.y) > 0.0001) {
      const t  = -ray.origin.y / ray.direction.y;
      const cx = ray.origin.x + t * ray.direction.x;
      const cz = ray.origin.z + t * ray.direction.z;
      const rawX = (cx - this.tank.position.x) * 0.3;
      const rawZ = (cz - this.tank.position.z) * 0.3;
      const len  = Math.sqrt(rawX * rawX + rawZ * rawZ) || 1;
      const scale = Math.min(len, 4.8) / len;
      aimX = rawX * scale;
      aimZ = rawZ * scale;
    }

    // --- 2. Movement lead: push frame ahead in travel direction (clamped to 1.5 u) ---
    const rawLeadX = Math.sin(this.tank.rotY) * this.tank.speed * 0.12;
    const rawLeadZ = Math.cos(this.tank.rotY) * this.tank.speed * 0.12;
    const leadLen  = Math.sqrt(rawLeadX * rawLeadX + rawLeadZ * rawLeadZ) || 1;
    const leadScale = Math.min(leadLen, 1.5) / leadLen;
    const leadX = rawLeadX * leadScale;
    const leadZ = rawLeadZ * leadScale;

    // --- 3. Soft follow: exponential lerp toward desired target ---
    const desiredX = this.tank.position.x + aimX + leadX;
    const desiredZ = this.tank.position.z + aimZ + leadZ;
    const smooth   = 1 - Math.exp(-7 * dt);
    this._camX += (desiredX - this._camX) * smooth;
    this._camZ += (desiredZ - this._camZ) * smooth;

    // --- 4. Road-aligned yaw: the view follows the ROAD's direction (centerline tangent at
    // the tank), NOT the hull — so steering doesn't whip the camera (far less motion-sick),
    // and it always faces up-the-road. The cursor pull above (aimX/aimZ) gives the minor
    // dynamic framing shift. A critically-damped spring keeps the slow road curves smooth.
    // -PI/2 - heading maps road-forward → up-screen. Falls back to hull if there's no road.
    const roadH = this._roadHeading();
    if (roadH != null) {
      this._camHeading = this._smoothDampAngle(this._camHeading, roadH, dt);
    } else {
      this._camHeading = 0;   // no road (dev arena / open field) → camera fixed facing north
    }
    this.camera.alpha = -Math.PI / 2 - this._camHeading;

    // --- Apply with shake on top ---
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const s = this._shakeIntensity;
      this.camera.target.set(
        this._camX + (Math.random() - 0.5) * s,
        0,
        this._camZ + (Math.random() - 0.5) * s,
      );
    } else {
      this.camera.target.set(this._camX, 0, this._camZ);
    }
  }

  // Critically-damped angle smoothing (Unity-style SmoothDampAngle). Velocity-stateful so
  // the camera eases in AND out of turns (no initial jerk) and lags slightly. Angle-aware:
  // always takes the short way around. `_camYawSmoothTime` ≈ seconds to settle.
  _smoothDampAngle(current, target, dt) {
    const st = Math.max(0.0001, this._camYawSmoothTime);
    const omega = 2 / st;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let change = current - target;
    while (change >  Math.PI) change -= 2 * Math.PI;   // shortest signed delta
    while (change < -Math.PI) change += 2 * Math.PI;
    const targetAdj = current - change;
    let temp = (this._camHeadingVel + omega * change) * dt;
    this._camHeadingVel = (this._camHeadingVel - omega * temp) * exp;
    return targetAdj + (change + temp) * exp;
  }

  // Heading of the ROAD at the tank: tangent of the nearest centerline segment, pointing
  // forward (the centerline runs spawn→checkpoint). Returns null off-road zones (no corridor).
  _roadHeading() {
    const c = this._corridor;
    if (!c || !c.centerline || c.centerline.length < 2) return null;
    const pts = c.centerline, t = this.tank.position;
    let best = Infinity, bi = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az;
      const L2 = dx * dx + dz * dz || 1;
      let s = ((t.x - ax) * dx + (t.z - az) * dz) / L2; s = s < 0 ? 0 : s > 1 ? 1 : s;
      const px = ax + dx * s, pz = az + dz * s, d2 = (t.x - px) ** 2 + (t.z - pz) ** 2;
      if (d2 < best) { best = d2; bi = i; }
    }
    const a = pts[bi], b = pts[bi + 1];
    return Math.atan2(b[0] - a[0], b[1] - a[1]);   // road-forward heading (game convention)
  }

  // Long Road invisible walls: keep the tank within `half` of the road centerline — a
  // corridor that bounds rear, sides, and front (rounded caps at the road ends) in one check.
  _clampCorridor() {
    const c = this._corridor;
    if (!c) return;
    const t = this.tank.position, pts = c.centerline;
    let best = Infinity, bx = 0, bz = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], dx = pts[i+1][0] - ax, dz = pts[i+1][1] - az;
      const L2 = dx*dx + dz*dz || 1;
      let s = ((t.x - ax)*dx + (t.z - az)*dz) / L2; s = s < 0 ? 0 : s > 1 ? 1 : s;
      const px = ax + dx*s, pz = az + dz*s, d2 = (t.x - px)**2 + (t.z - pz)**2;
      if (d2 < best) { best = d2; bx = px; bz = pz; }
    }
    const d = Math.sqrt(best);
    if (d > c.half) { const k = c.half / d; t.x = bx + (t.x - bx) * k; t.z = bz + (t.z - bz) * k; }
    // hard wall right behind spawn — can't reverse down the approach you came in on
    if (c.southLimit != null && t.z < c.southLimit) t.z = c.southLimit;
  }

  _updateHUD() {
    const fuelRatio = this.tank.fuel / this.tank.maxFuel;
    const redline   = this.tank.energy?.redline;
    const fill = document.getElementById('hud-fill');
    if (fill) {
      // No min floor — the bar must read truly empty on a full drain.
      fill.style.width = `${Math.max(0, fuelRatio * 100)}%`;
      // backgroundColor (not the `background` shorthand) so the CSS segmentation
      // gradient (repeating-linear-gradient on #hud-fill) survives the recolor.
      fill.style.backgroundColor = redline ? '#aa2a2a' : fuelRatio < 0.3 ? '#ff4444' : '#44aaff';
    }

    const hpRatio = this.tank.hp / this.tank.maxHp;
    const hpFill  = document.getElementById('hud-hp-fill');
    if (hpFill) {
      hpFill.style.width = `${Math.max(1, hpRatio * 100)}%`;
      const { red, green } = hpColor(hpRatio);
      hpFill.style.backgroundColor = `rgb(${Math.round(red*220)},${Math.round(green*220)},40)`;
    }
  }

  _setupFiring() {
    this.shells        = Array.from({ length: 10 }, () => new Shell(this.scene));
    this._fireCooldown = 0;
    this.tank._recoil  = 0;

    document.getElementById('renderCanvas').addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this._paused) return;
      if (this._fireCooldown <= 0) this._shoot();
    });
  }

  _barrelTip() {
    return Vector3.TransformCoordinates(
      new Vector3(0, 0, this._barrelTipOffset ?? 1.8),
      this.tank.barrelPivot.getWorldMatrix(),
    );
  }

  _predictTargetPos(target) {
    const tip = this._barrelTip();
    const vel = target.getVelocity();
    const dx0 = target.position.x - tip.x;
    const dz0 = target.position.z - tip.z;

    // Pass 1: flight time from current distance
    let t  = Math.max(0.1, Math.sqrt(dx0 * dx0 + dz0 * dz0) / 16);
    let px = target.position.x + vel.x * t;
    let pz = target.position.z + vel.z * t;

    // Pass 2: refine using distance to the predicted position so the
    // elevation formula and the lead both use the same flight time
    const dx1 = px - tip.x;
    const dz1 = pz - tip.z;
    t  = Math.max(0.1, Math.sqrt(dx1 * dx1 + dz1 * dz1) / 16);
    px = target.position.x + vel.x * t;
    pz = target.position.z + vel.z * t;

    return { x: px, z: pz };
  }

  _shoot() {
    const shell = this.shells.find(s => !s.active);
    if (!shell) return;

    const tip    = this._barrelTip();
    const HSPEED = 35;
    const aim      = this.tank.turretAimAngle;
    const azSpread = (Math.random() - 0.5) * 2 * this.tank.dispersion;
    const vx = Math.sin(aim + azSpread) * HSPEED;
    const vz = Math.cos(aim + azSpread) * HSPEED;

    shell.fire(tip.x, tip.y, tip.z, vx, 0, vz, 45);
    audio.play('tank.cannon_fire', { emitter: this.tank.root });
    this.vfx.spawnMuzzleFlash(tip);
    this._triggerShake(0.06, 0.2);
    this._fireCooldown = 0.3;
    this.tank._recoil = 1.0;

    // Gunfire is loud — wake any ambusher within earshot.
    for (const e of this.enemies) e.hearNoise?.(this.tank.position, 30);
  }


  // Wake every living enemy within PACK_ALERT_RADIUS of `hit` (it included). Lets a
  // single landed/landing shot rouse a scout's whole squad, so the player can't farm
  // them one by one from beyond their (deliberately on-screen) detection range.
  _alertPack(hit) {
    const ox = hit.position.x, oz = hit.position.z, r2 = PACK_ALERT_RADIUS * PACK_ALERT_RADIUS;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - ox, dz = e.position.z - oz;
      if (dx * dx + dz * dz <= r2) e.alert?.();
    }
  }

  // --- Dev-arena spawn menu (zoneless sandbox only) ---------------------------------
  // Spawn a mix of enemies in tidy rows ahead of the player. `replace` clears the
  // current field first (SPAWN); false appends to it (ADD).
  _spawnDevSet(counts, replace = true) {
    if (replace) this._clearEnemies();
    const bounds = this._devBounds ?? 48;
    const ctor = { chaff: ChaffEnemy, sentinel: SentinelEnemy, mortar: MortarEnemy };
    const rows = [['sentinel', counts.sentinel | 0, 40], ['mortar', counts.mortar | 0, 30], ['chaff', counts.chaff | 0, 20]];
    for (const [type, n, baseZ] of rows) {
      for (let i = 0; i < n; i++) {
        const spread = n === 1 ? 0 : (i / (n - 1) - 0.5);
        const x = spread * Math.min(40, 8 + n * 4);
        const z = baseZ + (i % 2) * 4;
        const e = new ctor[type](this.scene, x, z, { bounds });
        e.addShadows?.(this.shadowGen);
        this.enemies.push(e);
        this._spawnDefs.push([x, z]);
      }
    }
  }

  // Dispose the current enemy field (subtrees + their shell meshes), keeping the
  // shared GLB templates. Used by the dev SPAWN/CLEAR buttons.
  _clearEnemies() {
    for (const e of this.enemies) {
      if (this.lockedEnemy === e) this.lockedEnemy = null;
      if (e.shells) for (const s of e.shells) { s.mesh?.dispose(); s._tail?.dispose?.(); s._halo?.dispose?.(); s.halo?.dispose?.(); }
      e.hpBarBg?.dispose(); e.hpBarFill?.dispose();
      e.root?.dispose();   // recurses children, leaves shared template materials alone
    }
    this.enemies = [];
    this._spawnDefs = [];
  }

  _buildDevSpawnMenu() {
    document.getElementById('dev-spawn-menu')?.remove();
    const counts = { chaff: 6, sentinel: 1, mortar: 2 };
    const bs = 'background:#15303a;color:#bfe;border:1px solid #2a6;border-radius:3px;padding:3px 8px;cursor:pointer;font:inherit;font-size:11px;';
    const el = document.createElement('div');
    el.id = 'dev-spawn-menu';
    el.style.cssText = 'position:fixed;top:64px;right:12px;z-index:50;background:rgba(8,14,20,0.92);' +
      'border:1px solid #2a6;border-radius:6px;padding:10px 12px;font-family:inherit;color:#cfe;' +
      'font-size:12px;min-width:178px;box-shadow:0 4px 18px rgba(0,0,0,0.55);';
    const types = [['chaff', 'CHAFF'], ['sentinel', 'SENTINEL'], ['mortar', 'MORTAR']];
    el.innerHTML = '<div style="color:#6fd;letter-spacing:1px;margin-bottom:8px;">DEV · SPAWN</div>';
    for (const [key, label] of types) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:5px 0;';
      row.innerHTML = `<span style="opacity:.85">${label}</span>` +
        `<span style="display:flex;align-items:center;gap:6px;">` +
        `<button data-d="${key}" style="${bs}">−</button>` +
        `<span id="dev-c-${key}" style="min-width:16px;text-align:center;">${counts[key]}</span>` +
        `<button data-i="${key}" style="${bs}">+</button></span>`;
      el.appendChild(row);
    }
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;margin-top:9px;';
    btns.innerHTML =
      `<button id="dev-spawn" style="${bs}flex:1;color:#9fe;border-color:#3b8;">SPAWN</button>` +
      `<button id="dev-add" style="${bs}">ADD</button>` +
      `<button id="dev-clear" style="${bs}color:#f99;border-color:#a55;">CLEAR</button>`;
    el.appendChild(btns);
    document.body.appendChild(el);

    const setC = (k, v) => { counts[k] = Math.max(0, Math.min(30, v)); el.querySelector(`#dev-c-${k}`).textContent = counts[k]; };
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => setC(b.dataset.i, counts[b.dataset.i] + 1));
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => setC(b.dataset.d, counts[b.dataset.d] - 1));
    el.querySelector('#dev-spawn').onclick = () => this._spawnDevSet({ ...counts }, true);
    el.querySelector('#dev-add').onclick = () => this._spawnDevSet({ ...counts }, false);
    el.querySelector('#dev-clear').onclick = () => this._clearEnemies();
    this.scene.onDisposeObservable.addOnce(() => el.remove());
    this._devMenuEl = el;
  }

  // Mortar shells detonate on landing with a radial splash (full centre damage
  // falling to ~1/3 at the edge). Shield mitigates as usual, and parrying the blast
  // (bubble up while in radius) stuns the mortar. Explosion VFX + a heavy shake fire
  // regardless of whether the player was caught.
  _checkMortarSplash() {
    const t = this.tank;
    for (const enemy of this.enemies) {
      if (!enemy.shells) continue;
      for (const shell of enemy.shells) {
        if (!shell.isMortar || !shell.exploded) continue;
        shell.clearExplosion();
        this.vfx.spawnPlasmaBurst(shell.position.clone(), shell.splashRadius);   // explosion == splash circle
        this._triggerShake(0.22, 0.7);
        if (!t.alive) continue;
        const d = Math.hypot(t.position.x - shell.position.x, t.position.z - shell.position.z);
        if (d <= shell.splashRadius) {
          const frac = 1 - d / shell.splashRadius;                 // 1 centre → 0 edge
          if (t.shield?.active) enemy.stun?.(SHIELD_STUN_DURATION);
          t.takeDamage(shell.splashDamage * (0.34 + 0.66 * frac)); // mitigation auto-applied while shielded
          if (!t.alive) this._showDeath();
        }
      }
    }
  }

  _checkShellHits() {
    // Enemy shells hitting the player — every enemy's pool, per-enemy damage
    outer:
    for (const enemy of this.enemies) {
      if (!enemy.shells) continue;
      for (const shell of enemy.shells) {
        if (!shell.active) continue;
        if (shell.isMortar) continue;   // arcing shells hit via radial splash, not this AABB path
        if (shell.position.y < 0 || shell.position.y > 1.6) continue;
        const dx = shell.position.x - this.tank.position.x;
        const dz = shell.position.z - this.tank.position.z;
        if (Math.abs(dx) < 0.25 + this.tank.halfW && Math.abs(dz) < 0.25 + this.tank.halfD) {
          shell.deactivate();
          // Parry: any attack absorbed by the active bubble stuns its source.
          // Works for Shell / EyeBeam / LaserBolt alike — all share enemy.shells.
          if (this.tank.shield?.active) enemy.stun?.(SHIELD_STUN_DURATION);
          this.tank.takeDamage(enemy.shellDamage ?? 34);   // mitigation auto-applied while shielded
          this._triggerShake(0.18, 0.55);
          if (!this.tank.alive) this._showDeath();
          break outer;
        }
      }
    }

    const allTargets = this.enemies;
    const SHELL_ALERT_R2 = 7 * 7;   // a player shell whizzing this close alerts an unaware enemy

    for (const shell of this.shells) {
      if (!shell.active) continue;

      for (const enemy of allTargets) {
        if (!enemy.alive) continue;
        const dx = shell.position.x - enemy.position.x;
        const dz = shell.position.z - enemy.position.z;
        // Near-miss: a shot streaking past gives the player away (no break — one shell can pass several).
        if (dx * dx + dz * dz < SHELL_ALERT_R2) enemy.alert?.();
        if (Math.abs(dx) < enemy.halfW && Math.abs(dz) < enemy.halfD) {
          const speed      = Math.hypot(shell.vx, shell.vz);
          const perpDist   = speed > 0 ? Math.abs(dx * shell.vz - dz * shell.vx) / speed : 999;
          const isCritical = perpDist < 0.4;
          const damage     = isCritical ? 51 : 34;
          this.vfx.spawnTankImpact(shell.position.clone(), isCritical);
          shell.deactivate();
          enemy.takeDamage(damage);
          this._alertPack(enemy);   // drawing blood turns the whole nearby squad on you
          this._triggerShake(isCritical ? 0.12 : 0.06, isCritical ? 0.4 : 0.15);
          music[isCritical ? 'playHitCrit' : 'playHitmark'](); // hitmarker feedback
          if (!enemy.alive && this.lockedEnemy === enemy) {
            this._prevLockedEnemy = enemy;
            this._fadeOutTime     = 0;
            this.lockedEnemy      = null;
          }
          break;
        }
      }
    }
  }
}
