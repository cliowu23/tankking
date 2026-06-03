import {
  Scene, HemisphericLight, DirectionalLight, PointLight,
  MeshBuilder, StandardMaterial, Color3, Color4, Vector3, Mesh, VertexBuffer,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import DriverCharacter from '../entities/DriverCharacter.js';
import { makeMats, buildWorkbench, buildQMCrates, buildMapTable, buildRadioShelf } from './HangarProps.js';

const ROOM_W   = 30;    // width (X)
const ROOM_D   = 40;    // depth (Z), north = positive Z
const ROOM_H   = 5;     // ceiling height
const WALL_T   = 0.5;   // wall thickness
const TUNNEL_W = 5;     // tunnel opening width, centered on north wall
const TUNNEL_LEN = 24;  // extended so fog fade reaches full black naturally

export default class HangarScene {
  constructor(engine, onDeploy) {
    this.scene    = new Scene(engine);
    this.onDeploy = onDeploy;

    this.scene.clearColor        = new Color4(0.04, 0.04, 0.06, 1.0);
    this.scene.collisionsEnabled = true;

    this._buildRoom();
    this._buildLighting();
    this._buildStations();

    this._setupDriver();
    this._setupGameLoop();
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
    floorMat.mainColor           = new Color3(0.13, 0.12, 0.11);
    floorMat.lineColor           = new Color3(0.09, 0.08, 0.07);
    floorMat.opacity             = 1.0;
    floorMat.backFaceCulling     = false;

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

    // Shade the bore via vertex colours for a "lit road into shadow" read:
    //   • ROOF in shadow — the higher up the arch, the darker (ceiling is dark)
    //   • recedes with DEPTH — lit at the mouth, black deep in
    // Local Y is the length axis (→ world Z depth); world height = 1.5 - localZ.
    {
      const positions = bore.getVerticesData(VertexBuffer.PositionKind);
      const colors    = [];
      for (let i = 0; i < positions.length; i += 3) {
        const ly      = positions[i + 1];
        const lz      = positions[i + 2];
        const worldY  = 1.5 - lz;                                       // 0 at floor → 5 at roof peak
        const tRoof   = Math.max(0, Math.min(1, worldY / 5));          // 0 floor, 1 roof
        const tDepth  = Math.max(0, Math.min(1, (ly + TUNNEL_LEN / 2) / TUNNEL_LEN)); // 0 mouth, 1 far
        const shade   = (1.0 - 0.85 * tRoof) * (1.0 - 0.8 * tDepth);   // dark roof × recede
        colors.push(shade, shade, shade, 1);
      }
      bore.setVerticesData(VertexBuffer.ColorKind, colors);
      bore.useVertexColors = true;
    }

    // Flat asphalt road inside the bore — the lit surface receding into shadow
    const tunnelFloor = MeshBuilder.CreateBox('tunnel-floor', { width: TUNNEL_W, height: 0.1, depth: TUNNEL_LEN }, s);
    tunnelFloor.position = new Vector3(0, 0, tCenter);
    tunnelFloor.material = asphaltMat;

    // Fade the road to black with depth so it recedes into the tunnel
    {
      const positions = tunnelFloor.getVerticesData(VertexBuffer.PositionKind);
      const colors    = [];
      for (let i = 0; i < positions.length; i += 3) {
        const lz     = positions[i + 2];                              // box local z = depth
        const tDepth = Math.max(0, Math.min(1, (lz + TUNNEL_LEN / 2) / TUNNEL_LEN));
        const shade  = 1.0 - 0.85 * tDepth;                           // mouth lit → far black
        colors.push(shade, shade, shade, 1);
      }
      tunnelFloor.setVerticesData(VertexBuffer.ColorKind, colors);
      tunnelFloor.useVertexColors = true;
    }

    // Tunnel meshes are lit only by the dedicated mouth light (see _buildLighting)
    this._tunnelMeshes = [bore, tunnelFloor];

    // Invisible wall at tunnel entrance — blocks driver from walking in
    const tunnelGate = MeshBuilder.CreateBox('tunnel-gate', {
      width: TUNNEL_W, height: ROOM_H, depth: 0.2,
    }, s);
    tunnelGate.position        = new Vector3(0, ROOM_H / 2, ROOM_D / 2 + 0.2);
    tunnelGate.isVisible       = false;
    tunnelGate.checkCollisions = true;
  }

  _buildLighting() {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.55;
    ambient.diffuse     = new Color3(0.85, 0.80, 0.70);
    ambient.groundColor = new Color3(0.15, 0.14, 0.12);

    const overhead = new DirectionalLight('overhead', new Vector3(-0.3, -1, 0.5), this.scene);
    overhead.intensity = 0.4;
    overhead.position  = new Vector3(5, 15, 0);

    const bulb1 = new PointLight('bulb1', new Vector3(0, 4.5, 5), this.scene);
    bulb1.diffuse   = new Color3(1.0, 0.92, 0.78);
    bulb1.intensity = 0.8;
    bulb1.range     = 18;

    const bulb2 = new PointLight('bulb2', new Vector3(0, 4.5, -5), this.scene);
    bulb2.diffuse   = new Color3(1.0, 0.92, 0.78);
    bulb2.intensity = 0.6;
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
    // Low to the ground so light pools on the road and lower walls; the high
    // arch roof stays in shadow (reinforced by the bore's roof vertex shading).
    const mouth = new PointLight('tunnel-mouth', new Vector3(0, 0.8, ROOM_D / 2 + 2.5), this.scene);
    mouth.diffuse            = new Color3(1.0, 0.94, 0.82); // warm, matches room bulbs
    mouth.intensity          = 1.5;
    mouth.range              = 16;
    mouth.includedOnlyMeshes = this._tunnelMeshes;
  }

  _buildStations() {
    const s = this.scene;

    this._stationDefs = {
      map:      { id: 'map',      label: 'INTERACT', title: 'TACTICAL MAP',  body: 'MISSION SELECT\nComing soon.',         showDeploy: true  },
      radio:    { id: 'radio',    label: 'INTERACT', title: 'RADIO / INTEL', body: 'STAND BY FOR BRIEFING.\nComing soon.', showDeploy: false },
      mechanic: { id: 'mechanic', label: 'INTERACT', title: 'MECHANIC',      body: 'UPGRADES & REPAIRS\nComing soon.',     showDeploy: false },
      qm:       { id: 'qm',       label: 'INTERACT', title: 'QUARTERMASTER', body: 'AMMO & SUPPLIES\nComing soon.',        showDeploy: false },
    };

    const propMats = makeMats(s);
    this._stationMeshes = [
      { mesh: buildMapTable(s,   -11,  17.5, propMats), data: this._stationDefs.map      },
      { mesh: buildRadioShelf(s,  11,  17.5, propMats), data: this._stationDefs.radio    },
      { mesh: buildWorkbench(s,  -14,  0,    propMats), data: this._stationDefs.mechanic },
      { mesh: buildQMCrates(s,    14,  0,    propMats), data: this._stationDefs.qm       },
    ];

    const tankMat = new StandardMaterial('tank-bay', s);
    tankMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
    tankMat.specularColor = new Color3(0.1,  0.1,  0.1);

    const hull = MeshBuilder.CreateBox('tank-hull', { width: 3, height: 1.2, depth: 5 }, s);
    hull.position = new Vector3(0, 0.6, 16);
    hull.material = tankMat;

    const turret = MeshBuilder.CreateBox('tank-turret', { width: 2, height: 0.8, depth: 2.2 }, s);
    turret.position = new Vector3(0, 1.6, 16);
    turret.material = tankMat;

    const barrel = MeshBuilder.CreateBox('tank-barrel', { width: 0.25, height: 0.25, depth: 3 }, s);
    barrel.position = new Vector3(0, 1.65, 18.2);
    barrel.material = tankMat;

    this._tankPosition = new Vector3(0, 0, 16);
  }

  _setupDriver() {
    this.driver = new DriverCharacter(this.scene);
  }

  _setupGameLoop() {
    this._nearStation = null;
    this._panelOpen   = false;

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
        // Keep camera locked onto driver, offset slightly north to centre the room view
        this.driver.camera.target.set(
          this.driver.mesh.position.x,
          this.driver.mesh.position.y,
          this.driver.mesh.position.z + 5
        );
      }
    });
  }

  _checkProximity(prompt, promptLabel) {
    const pos = this.driver.position;

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
    this._panelOpen = true;
    document.getElementById('hangar-prompt').style.display    = 'none';
    document.getElementById('hangar-panel-title').textContent = station.title;
    document.getElementById('hangar-panel-body').textContent  = station.body;
    document.getElementById('hangar-panel-deploy').style.display =
      station.showDeploy ? 'block' : 'none';
    document.getElementById('hangar-panel').style.display = 'flex';
  }

  closePanel() {
    this._panelOpen   = false;
    this._nearStation = null;
    document.getElementById('hangar-panel').style.display = 'none';
  }

  mountTank() {
    this.driver.hide();
    document.getElementById('hangar-prompt').style.display = 'none';
    // Brief pause so the driver visually disappears before the transition fires
    this._mountTimer = setTimeout(() => this.onDeploy(), 500);
  }

  dispose() {
    clearTimeout(this._mountTimer);
    if (this._loopObserver) this.scene.onBeforeRenderObservable.remove(this._loopObserver);
    if (this.driver) this.driver.dispose();
    this.scene.dispose();
  }
}
