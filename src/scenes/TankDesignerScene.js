import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, DynamicTexture,
} from '@babylonjs/core';

const PAD_Y = 0.06;

export default class TankDesignerScene {
  constructor(engine, onExit) {
    this._engine = engine;
    this._onExit = onExit;
    this.scene   = new Scene(engine);
    this.scene.clearColor = new Color4(0.84, 0.90, 0.96, 1.0);

    this._setupCamera();
    this._setupLighting();
    this._setupRoom();
    this._setupUI();
  }

  _setupCamera() {
    const canvas = this._engine.getRenderingCanvas();
    this.camera = new ArcRotateCamera('designCam',
      -Math.PI / 4, 0.82, 30, new Vector3(0, 2, 0), this.scene);
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 55;
    this.camera.lowerBetaLimit   = 0.15;
    this.camera.upperBetaLimit   = Math.PI / 2.05;
    this.camera.attachControl(canvas, true);
  }

  _setupLighting() {
    const ambient = new HemisphericLight('amb', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.88;
    ambient.diffuse     = new Color3(1.0, 0.98, 0.95);
    ambient.groundColor = new Color3(0.62, 0.70, 0.80);

    const sun = new DirectionalLight('sun', new Vector3(-0.55, -1, -0.35), this.scene);
    sun.intensity = 0.50;
    sun.diffuse   = new Color3(1.0, 0.97, 0.90);
    sun.position  = new Vector3(10, 20, 10);

    this.shadowGen = new ShadowGenerator(1024, sun);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.setDarkness(0.22);
  }

  _setupRoom() {
    // ── Table ─────────────────────────────────────────────────────────────
    const woodMat = new StandardMaterial('woodMat', this.scene);
    woodMat.diffuseColor  = new Color3(0.86, 0.74, 0.52);
    woodMat.specularColor = new Color3(0.22, 0.16, 0.08);
    woodMat.specularPower = 30;

    const top = MeshBuilder.CreateBox('tableTop', { width: 26, height: 0.6, depth: 18 }, this.scene);
    top.position.set(0, -0.30, 0);
    top.material = woodMat;
    top.receiveShadows = true;
    this.shadowGen.addShadowCaster(top);

    for (const [x, z] of [[-11.5, -7.5], [11.5, -7.5], [-11.5, 7.5], [11.5, 7.5]]) {
      const leg = MeshBuilder.CreateBox(`leg${x}`, { width: 0.5, height: 5, depth: 0.5 }, this.scene);
      leg.position.set(x, -3.1, z);
      leg.material = woodMat;
    }

    // ── Blueprint pad with Under Construction text ────────────────────────
    const padTex = new DynamicTexture('padTex', { width: 512, height: 512 }, this.scene);
    const ctx    = padTex.getContext();

    // Paper base
    ctx.fillStyle = '#f7f8fb';
    ctx.fillRect(0, 0, 512, 512);

    // Fine grid
    ctx.strokeStyle = '#ccdff5';
    ctx.lineWidth = 0.7;
    for (let i = 0; i <= 32; i++) {
      const v = i * 16;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(512, v); ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = '#7aaedd';
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) {
      const v = i * 64;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(512, v); ctx.stroke();
    }

    // Under Construction text
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#2a5a90';
    ctx.font         = 'bold 34px monospace';
    ctx.fillText('UNDER CONSTRUCTION', 256, 230);
    ctx.fillStyle = '#7aaedd';
    ctx.font      = '16px monospace';
    ctx.fillText('tank designer — coming soon', 256, 278);

    padTex.update();

    const padMat = new StandardMaterial('padMat', this.scene);
    padMat.diffuseTexture = padTex;
    padMat.specularColor  = new Color3(0.08, 0.08, 0.08);
    padMat.specularPower  = 10;

    const pad = MeshBuilder.CreateBox('blueprintPad', { width: 18, height: 0.05, depth: 13 }, this.scene);
    pad.position.set(0, PAD_Y / 2, 0);
    pad.material       = padMat;
    pad.receiveShadows = true;
    this.shadowGen.addShadowCaster(pad);

    const shadowMat = new StandardMaterial('padShadowMat', this.scene);
    shadowMat.diffuseColor = new Color3(0.60, 0.58, 0.52);
    const padShadow = MeshBuilder.CreateBox('padShadow', { width: 18.3, height: 0.03, depth: 13.3 }, this.scene);
    padShadow.position.set(0.18, PAD_Y / 2 - 0.04, 0.18);
    padShadow.material   = shadowMat;
    padShadow.isPickable = false;

    // ── Props ─────────────────────────────────────────────────────────────
    const rulerMat = new StandardMaterial('rulerMat', this.scene);
    rulerMat.diffuseColor  = new Color3(0.95, 0.93, 0.82);
    rulerMat.specularColor = new Color3(0.2, 0.18, 0.12);
    const ruler = MeshBuilder.CreateBox('ruler', { width: 12, height: 0.06, depth: 0.7 }, this.scene);
    ruler.position.set(3.5, PAD_Y + 0.04, 7.2);
    ruler.rotation.y   = 0.08;
    ruler.material     = rulerMat;
    ruler.receiveShadows = true;
    ruler.isPickable   = false;
    this.shadowGen.addShadowCaster(ruler);

    const tickMat = new StandardMaterial('tickMat', this.scene);
    tickMat.diffuseColor = new Color3(0.30, 0.28, 0.22);
    for (let i = 0; i <= 10; i++) {
      const isMajor = i % 5 === 0;
      const tick = MeshBuilder.CreateBox(`tick${i}`, { width: 0.04, height: 0.07, depth: isMajor ? 0.35 : 0.20 }, this.scene);
      tick.parent = ruler;
      tick.position.set(-5.0 + i * 1.0, 0.065, 0);
      tick.material   = tickMat;
      tick.isPickable = false;
    }

    const pencilMat = new StandardMaterial('pencilMat', this.scene);
    pencilMat.diffuseColor = new Color3(0.98, 0.85, 0.18);
    const pencilBody = MeshBuilder.CreateCylinder('pencilBody', { diameter: 0.2, height: 6.5, tessellation: 6 }, this.scene);
    pencilBody.position.set(-9.0, PAD_Y + 0.1, -7.5);
    pencilBody.rotation.z = Math.PI / 2;
    pencilBody.rotation.y = 0.25;
    pencilBody.material   = pencilMat;
    pencilBody.receiveShadows = true;
    pencilBody.isPickable  = false;
    this.shadowGen.addShadowCaster(pencilBody);

    const tipMat = new StandardMaterial('tipMat', this.scene);
    tipMat.diffuseColor = new Color3(0.22, 0.20, 0.18);
    const tip = MeshBuilder.CreateCylinder('pencilTip', { diameterTop: 0, diameterBottom: 0.2, height: 0.6, tessellation: 6 }, this.scene);
    tip.parent     = pencilBody;
    tip.position.set(0, 3.55, 0);
    tip.material   = tipMat;
    tip.isPickable = false;

    const eraserMat = new StandardMaterial('eraserMat', this.scene);
    eraserMat.diffuseColor  = new Color3(0.96, 0.72, 0.72);
    eraserMat.specularColor = new Color3(0.1, 0.06, 0.06);
    const eraser = MeshBuilder.CreateBox('eraser', { width: 1.2, height: 0.38, depth: 0.55 }, this.scene);
    eraser.position.set(-10.5, PAD_Y + 0.19, 7.0);
    eraser.rotation.y   = -0.15;
    eraser.material     = eraserMat;
    eraser.receiveShadows = true;
    eraser.isPickable   = false;
    this.shadowGen.addShadowCaster(eraser);

    const squareMat = new StandardMaterial('squareMat', this.scene);
    squareMat.diffuseColor = new Color3(0.72, 0.88, 0.98);
    squareMat.alpha = 0.82;
    const setSquare = MeshBuilder.CreateBox('setSquare', { width: 3.5, height: 0.04, depth: 3.0 }, this.scene);
    setSquare.position.set(10.5, PAD_Y + 0.03, -6.5);
    setSquare.rotation.y = 0.55;
    setSquare.material   = squareMat;
    setSquare.isPickable = false;
  }

  _setupUI() {
    document.getElementById('designer-exit-btn').addEventListener('click', () => this._onExit());
  }

  dispose() {
    this.scene.dispose();
  }
}
