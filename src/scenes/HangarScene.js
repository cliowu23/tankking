import {
  Scene, HemisphericLight, DirectionalLight,
  MeshBuilder, StandardMaterial, Color3, Color4, Vector3,
} from '@babylonjs/core';
import DriverCharacter from '../entities/DriverCharacter.js';

const ROOM_W   = 30;    // width (X)
const ROOM_D   = 40;    // depth (Z), north = positive Z
const ROOM_H   = 5;     // ceiling height
const WALL_T   = 0.5;   // wall thickness
const TUNNEL_W = 5;     // tunnel opening width, centered on north wall
const TUNNEL_LEN = 14;  // tunnel shaft extending north beyond the room wall

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
    concrete.diffuseColor  = new Color3(0.28, 0.28, 0.30);
    concrete.specularColor = new Color3(0.04, 0.04, 0.04);

    const floorMat = new StandardMaterial('floor', s);
    floorMat.diffuseColor  = new Color3(0.18, 0.18, 0.20);
    floorMat.specularColor = new Color3(0.02, 0.02, 0.02);

    const tunnelMat = new StandardMaterial('tunnel', s);
    tunnelMat.diffuseColor    = new Color3(0.10, 0.10, 0.11);
    tunnelMat.specularColor   = new Color3(0.01, 0.01, 0.01);
    tunnelMat.backFaceCulling = false;

    // Floor
    const floor = MeshBuilder.CreateGround('floor', { width: ROOM_W, height: ROOM_D }, s);
    floor.material        = floorMat;
    floor.checkCollisions = true;

    // Ceiling
    const ceiling = MeshBuilder.CreateBox('ceiling', { width: ROOM_W, height: WALL_T, depth: ROOM_D }, s);
    ceiling.position      = new Vector3(0, ROOM_H + WALL_T / 2, 0);
    ceiling.material      = concrete;
    ceiling.checkCollisions = true;

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
  }

  _buildLighting() {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.6;
    ambient.diffuse     = new Color3(0.88, 0.82, 0.72);
    ambient.groundColor = new Color3(0.10, 0.10, 0.12);

    const overhead = new DirectionalLight('overhead', new Vector3(0, -1, 0.3), this.scene);
    overhead.intensity = 0.5;
    overhead.position  = new Vector3(0, 12, -4);
  }

  _buildStations() {
    const s = this.scene;

    const stationMat = new StandardMaterial('station', s);
    stationMat.diffuseColor  = new Color3(0.22, 0.22, 0.26);
    stationMat.specularColor = new Color3(0.08, 0.08, 0.08);

    const tankMat = new StandardMaterial('tank-bay', s);
    tankMat.diffuseColor  = new Color3(0.12, 0.42, 0.88); // cobalt — matches player tank colour
    tankMat.specularColor = new Color3(0.1,  0.1,  0.1);

    // Station interaction data — read by the E-key handler in main.js
    this._stationDefs = {
      map:      { id: 'map',      label: 'INTERACT', title: 'TACTICAL MAP',  body: 'MISSION SELECT\nComing soon.',         showDeploy: true  },
      radio:    { id: 'radio',    label: 'INTERACT', title: 'RADIO / INTEL', body: 'STAND BY FOR BRIEFING.\nComing soon.', showDeploy: false },
      mechanic: { id: 'mechanic', label: 'INTERACT', title: 'MECHANIC',      body: 'UPGRADES & REPAIRS\nComing soon.',     showDeploy: false },
      qm:       { id: 'qm',       label: 'INTERACT', title: 'QUARTERMASTER', body: 'AMMO & SUPPLIES\nComing soon.',        showDeploy: false },
    };

    // Station props and their world positions
    this._stationMeshes = [
      this._makeStation('map',      new Vector3(-11, 0.5, 17.5), { width: 2.5, height: 1.0, depth: 1.2 }, stationMat, s),
      this._makeStation('radio',    new Vector3( 11, 0.5, 17.5), { width: 2.5, height: 1.0, depth: 1.2 }, stationMat, s),
      this._makeStation('mechanic', new Vector3(-14, 0.5, 0),    { width: 1.2, height: 1.0, depth: 3.5 }, stationMat, s),
      this._makeStation('qm',       new Vector3( 14, 0.5, 0),    { width: 1.2, height: 1.0, depth: 3.5 }, stationMat, s),
    ];

    // Tank placeholder in bay
    const hull = MeshBuilder.CreateBox('tank-hull', { width: 3, height: 1.2, depth: 5 }, s);
    hull.position = new Vector3(0, 0.6, 16);
    hull.material = tankMat;

    const turret = MeshBuilder.CreateBox('tank-turret', { width: 2, height: 0.8, depth: 2.2 }, s);
    turret.position = new Vector3(0, 1.6, 16);
    turret.material = tankMat;

    const barrel = MeshBuilder.CreateBox('tank-barrel', { width: 0.25, height: 0.25, depth: 3 }, s);
    barrel.position = new Vector3(0, 1.65, 18.2);
    barrel.material = tankMat;

    // Tank proximity position (centroid used for distance checks)
    this._tankPosition = new Vector3(0, 0, 16);
  }

  _makeStation(id, position, size, mat, scene) {
    const mesh = MeshBuilder.CreateBox(`station-${id}`, size, scene);
    mesh.position        = position;
    mesh.material        = mat;
    mesh.checkCollisions = true;
    return { mesh, data: this._stationDefs[id] };
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
