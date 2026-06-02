import {
  Scene, HemisphericLight, DirectionalLight, PointLight,
  MeshBuilder, StandardMaterial, Color3, Color4, Vector3,
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

    // Tunnel shaft extending north (visual only, no collision needed)
    const tCenter = ROOM_D / 2 + TUNNEL_LEN / 2;

    const tunnelTop = MeshBuilder.CreateBox('tunnel-top', { width: TUNNEL_W, height: WALL_T, depth: TUNNEL_LEN }, s);
    tunnelTop.position = new Vector3(0, ROOM_H + WALL_T / 2, tCenter);
    tunnelTop.material = tunnelMat;

    const tunnelL = MeshBuilder.CreateBox('tunnel-left', { width: WALL_T, height: ROOM_H, depth: TUNNEL_LEN }, s);
    tunnelL.position = new Vector3(-TUNNEL_W / 2, ROOM_H / 2, tCenter);
    tunnelL.material = tunnelMat;

    const tunnelR = MeshBuilder.CreateBox('tunnel-right', { width: WALL_T, height: ROOM_H, depth: TUNNEL_LEN }, s);
    tunnelR.position = new Vector3(TUNNEL_W / 2, ROOM_H / 2, tCenter);
    tunnelR.material = tunnelMat;

    // Tunnel floor — dark, so the shaft reads as a solid void from above
    const tunnelFloor = MeshBuilder.CreateBox('tunnel-floor', { width: TUNNEL_W, height: 0.1, depth: TUNNEL_LEN }, s);
    tunnelFloor.position = new Vector3(0, 0, tCenter);
    tunnelFloor.material = tunnelMat;

    // End cap — seals the far end of the tunnel
    const tunnelEnd = MeshBuilder.CreateBox('tunnel-end', { width: TUNNEL_W, height: ROOM_H, depth: WALL_T }, s);
    tunnelEnd.position = new Vector3(0, ROOM_H / 2, ROOM_D / 2 + TUNNEL_LEN);
    tunnelEnd.material = tunnelMat;

    // Tunnel meshes are lit only by the dedicated mouth light (see _buildLighting)
    this._tunnelMeshes = [tunnelTop, tunnelL, tunnelR, tunnelFloor, tunnelEnd];

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

    // Keep the room lights off the tunnel so it doesn't get flat global fill —
    // the tunnel is lit only by its own mouth light below.
    const roomLights = [ambient, overhead, bulb1, bulb2];
    for (const light of roomLights) {
      light.excludedMeshes.push(...this._tunnelMeshes);
    }

    // Mouth light — sits just inside the tunnel entrance and falls off with
    // distance, so the near corridor reads as concrete grey (matching the room)
    // and recedes into black deeper in.
    const mouth = new PointLight('tunnel-mouth', new Vector3(0, 2.5, ROOM_D / 2 + 2.5), this.scene);
    mouth.diffuse            = new Color3(1.0, 0.94, 0.82); // warm, matches room bulbs
    mouth.intensity          = 1.6;
    mouth.range              = 18;
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
