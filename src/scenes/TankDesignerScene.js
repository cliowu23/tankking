import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, Matrix, DynamicTexture, TransformNode, SceneLoader, Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { applyModelPaint } from '../utils/modelPaint.js';

const PAD_Y = 0.06;

export default class TankDesignerScene {
  constructor(engine, onExit) {
    this._engine = engine;
    this._onExit = onExit;
    this.scene   = new Scene(engine);
    this.scene.clearColor = new Color4(0.84, 0.90, 0.96, 1.0);

    this._turretPivot      = null;
    this._barrelPivot      = null;
    this._toDispose        = [];
    this._activeBtn        = null;
    this._selectedBtn      = null; // button for the confirmed selection
    this._keys             = {};
    this._barrelUp         = -0.349;
    this._barrelDown       =  0.175;
    this._previewFilename  = null; // what's currently showing in the 3D view
    this._selectedFilename = localStorage.getItem('selectedTank') || 'm26_pershing_war_thunder.glb';

    this._setupCamera();
    this._setupLighting();
    this._setupRoom();
    this._setupControls();
    this._setupUI();
    this._populateSidebar();
  }

  _setupCamera() {
    const canvas = this._engine.getRenderingCanvas();
    this.camera = new ArcRotateCamera('designCam',
      -Math.PI / 4, 0.72, 12, new Vector3(0, 1.5, 0), this.scene);
    this.camera.lowerRadiusLimit      = 2;
    this.camera.upperRadiusLimit      = 50;
    this.camera.lowerBetaLimit        = 0.05;
    this.camera.upperBetaLimit        = Math.PI / 2.05;
    this.camera.wheelDeltaPercentage  = 0.01; // smooth scroll zoom
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

    // ── Blueprint pad ─────────────────────────────────────────────────────
    const padTex = new DynamicTexture('padTex', { width: 512, height: 512 }, this.scene);
    const ctx    = padTex.getContext();

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

    // Center crosshair — forward direction indicator
    ctx.strokeStyle = '#7aaedd';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(256, 130); ctx.lineTo(256, 382); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(130, 256); ctx.lineTo(382, 256); ctx.stroke();
    ctx.fillStyle    = '#2a5a90';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = 'bold 13px monospace';
    ctx.fillText('FWD', 256, 112);

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

  _setupControls() {
    this._onKeyDown = (e) => { this._keys[e.code] = true; };
    this._onKeyUp   = (e) => { this._keys[e.code] = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    this.scene.registerBeforeRender(() => {
      if (!this._turretPivot) return;
      const dt = this._engine.getDeltaTime() / 1000;

      // Turret traverse
      if (this._keys['KeyA']) this._turretPivot.rotation.y -= 1.2 * dt;
      if (this._keys['KeyD']) this._turretPivot.rotation.y += 1.2 * dt;

      // Barrel elevation — negative X = up, positive X = down (matches ArenaScene)
      // _barrelUp / _barrelDown are set per-model from manifest elevationDeg / depressionDeg
      if (this._barrelPivot) {
        if (this._keys['KeyW'])
          this._barrelPivot.rotation.x = Math.max(this._barrelUp,  this._barrelPivot.rotation.x - 0.5 * dt);
        if (this._keys['KeyS'])
          this._barrelPivot.rotation.x = Math.min(this._barrelDown, this._barrelPivot.rotation.x + 0.5 * dt);
      }

      // Keyboard zoom (= to zoom in, - to zoom out)
      if (this._keys['Equal'] || this._keys['NumpadAdd'])
        this.camera.radius = Math.max(2,  this.camera.radius - 10 * dt);
      if (this._keys['Minus'] || this._keys['NumpadSubtract'])
        this.camera.radius = Math.min(50, this.camera.radius + 10 * dt);
    });
  }

  _setupUI() {
    document.getElementById('designer-exit-btn').addEventListener('click', () => this._onExit());
    document.getElementById('designer-confirm-btn').addEventListener('click', () => this.confirmSelection());
  }

  confirmSelection() {
    if (!this._previewFilename) return; // nothing previewed yet (primitive shown)
    localStorage.setItem('selectedTank', this._previewFilename);
    this._selectedFilename = this._previewFilename;
    if (this._selectedBtn) this._selectedBtn.classList.remove('selected');
    if (this._activeBtn)  { this._activeBtn.classList.add('selected'); this._selectedBtn = this._activeBtn; }
    this._onExit();
  }

  _populateSidebar() {
    fetch('/models/manifest.json')
      .then(r => r.json())
      .catch(() => ({}))
      .then(manifest => {
        const sidebar = document.getElementById('designer-sidebar');
        sidebar.innerHTML = '';

        const titleEl = document.createElement('div');
        titleEl.className = 'ds-title';
        titleEl.textContent = 'MODELS';
        sidebar.appendChild(titleEl);

        const divEl = document.createElement('div');
        divEl.className = 'ds-divider';
        sidebar.appendChild(divEl);

        let autoBtn = null, autoConfig = null;

        for (const [filename, config] of Object.entries(manifest)) {
          const label = filename
            .replace('.glb', '')
            .replace(/_war_thunder/gi, '')
            .replace(/_/g, ' ')
            .trim()
            .toUpperCase();

          const btn = document.createElement('button');
          btn.className = 'shape-btn';
          btn.textContent = label;

          if (filename === this._selectedFilename) {
            btn.classList.add('selected');
            this._selectedBtn = btn;
            autoBtn    = btn;
            autoConfig = config;
          }

          btn.addEventListener('click', () => this._loadModel(filename, config, btn, label));
          sidebar.appendChild(btn);
        }

        // Auto-load the saved selection (or first available GLB)
        if (autoBtn) {
          this._loadModel(this._selectedFilename, autoConfig, autoBtn, autoBtn.textContent);
        } else {
          const firstEntry = Object.entries(manifest)[0];
          if (firstEntry) {
            const [fn, cfg] = firstEntry;
            const firstBtn = sidebar.querySelector('.shape-btn');
            this._loadModel(fn, cfg, firstBtn, firstBtn?.textContent ?? fn);
          }
        }
      });
  }

  _loadPrimitive(btn) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    if (btn) { btn.classList.add('active'); this._activeBtn = btn; }

    this._clearCurrentModel();

    const hullMat = new StandardMaterial('primHull', this.scene);
    hullMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
    hullMat.specularColor = new Color3(0.05, 0.15, 0.30);

    const turretMat = new StandardMaterial('primTurret', this.scene);
    turretMat.diffuseColor  = new Color3(0.08, 0.32, 0.75);
    turretMat.specularColor = new Color3(0.03, 0.10, 0.25);

    const trackMat = new StandardMaterial('primTrack', this.scene);
    trackMat.diffuseColor  = new Color3(0.12, 0.12, 0.12);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    const modelRoot = new TransformNode('primRoot', this.scene);
    modelRoot.position.set(0, PAD_Y + 0.01, 0);

    const turretPivot = new TransformNode('primTurretPivot', this.scene);
    turretPivot.position.set(0, 0.55, 0);
    turretPivot.parent = modelRoot;
    this._turretPivot = turretPivot;

    const barrelPivot = new TransformNode('primBarrelPivot', this.scene);
    barrelPivot.position.set(0, 0.3, 0.6);
    barrelPivot.parent = turretPivot;
    this._barrelPivot = barrelPivot;

    const add = (mesh) => {
      mesh.receiveShadows = true;
      this.shadowGen.addShadowCaster(mesh);
      this._toDispose.push(mesh);
      return mesh;
    };

    // Hull
    const hullLower = MeshBuilder.CreateBox('primHullLower', { width: 2.55, height: 0.20, depth: 3.20 }, this.scene);
    hullLower.position.set(0, 0.10, 0); hullLower.material = hullMat; hullLower.parent = modelRoot; add(hullLower);

    const hull = MeshBuilder.CreateBox('primHull', { width: 2.40, height: 0.50, depth: 3.20 }, this.scene);
    hull.position.set(0, 0.35, 0); hull.material = hullMat; hull.parent = modelRoot; add(hull);

    const hullTop = MeshBuilder.CreateBox('primHullTop', { width: 2.20, height: 0.08, depth: 2.40 }, this.scene);
    hullTop.position.set(0, 0.615, -0.20); hullTop.material = hullMat; hullTop.parent = modelRoot; add(hullTop);

    const frontSlope = MeshBuilder.CreateBox('primFrontSlope', { width: 2.20, height: 0.65, depth: 0.55 }, this.scene);
    frontSlope.position.set(0, 0.35, 1.30); frontSlope.rotation.x = -Math.PI * 0.22;
    frontSlope.material = hullMat; frontSlope.parent = modelRoot; add(frontSlope);

    const engineDeck = MeshBuilder.CreateBox('primEngineDeck', { width: 1.80, height: 0.10, depth: 0.70 }, this.scene);
    engineDeck.position.set(0, 0.62, -1.20); engineDeck.material = hullMat; engineDeck.parent = modelRoot; add(engineDeck);

    const trackL = MeshBuilder.CreateBox('primTrackL', { width: 0.28, height: 0.65, depth: 3.25 }, this.scene);
    trackL.position.set(-1.26, 0.325, 0); trackL.material = trackMat; trackL.parent = modelRoot; add(trackL);

    const trackR = MeshBuilder.CreateBox('primTrackR', { width: 0.28, height: 0.65, depth: 3.25 }, this.scene);
    trackR.position.set(1.26, 0.325, 0); trackR.material = trackMat; trackR.parent = modelRoot; add(trackR);

    const skirtL = MeshBuilder.CreateBox('primSkirtL', { width: 0.07, height: 0.25, depth: 2.90 }, this.scene);
    skirtL.position.set(-1.42, 0.125, 0); skirtL.material = trackMat; skirtL.parent = modelRoot; add(skirtL);

    const skirtR = MeshBuilder.CreateBox('primSkirtR', { width: 0.07, height: 0.25, depth: 2.90 }, this.scene);
    skirtR.position.set(1.42, 0.125, 0); skirtR.material = trackMat; skirtR.parent = modelRoot; add(skirtR);

    for (const wz of [-1.0, -0.33, 0.33, 1.0]) {
      for (const wx of [-1.26, 1.26]) {
        const w = MeshBuilder.CreateCylinder(`primWheel_${wx}_${wz}`, { height: 0.10, diameter: 0.32, tessellation: 10 }, this.scene);
        w.rotation.z = Math.PI / 2; w.position.set(wx, 0.18, wz);
        w.material = trackMat; w.parent = modelRoot; add(w);
      }
    }

    // Turret
    const turretBody = MeshBuilder.CreateBox('primTurretBody', { width: 1.15, height: 0.38, depth: 1.20 }, this.scene);
    turretBody.position.set(0, 0.16, 0.05); turretBody.material = turretMat; turretBody.parent = turretPivot; add(turretBody);

    const turretRoof = MeshBuilder.CreateBox('primTurretRoof', { width: 1.00, height: 0.12, depth: 1.00 }, this.scene);
    turretRoof.position.set(0, 0.38, 0.00); turretRoof.material = turretMat; turretRoof.parent = turretPivot; add(turretRoof);

    const turretFace = MeshBuilder.CreateBox('primTurretFace', { width: 1.10, height: 0.34, depth: 0.18 }, this.scene);
    turretFace.position.set(0, 0.22, 0.62); turretFace.rotation.x = -Math.PI * 0.12;
    turretFace.material = turretMat; turretFace.parent = turretPivot; add(turretFace);

    const mantlet = MeshBuilder.CreateCylinder('primMantlet', { height: 0.28, diameter: 0.65, tessellation: 10 }, this.scene);
    mantlet.rotation.x = Math.PI / 2; mantlet.position.set(0, 0.16, 0.72);
    mantlet.material = turretMat; mantlet.parent = turretPivot; add(mantlet);

    const cupola = MeshBuilder.CreateCylinder('primCupola', { height: 0.16, diameterBottom: 0.35, diameterTop: 0.28, tessellation: 8 }, this.scene);
    cupola.position.set(0.12, 0.42, -0.10); cupola.material = turretMat; cupola.parent = turretPivot; add(cupola);

    // Barrel
    const barrel = MeshBuilder.CreateCylinder('primBarrel', { height: 2.4, diameterBottom: 0.18, diameterTop: 0.12, tessellation: 8 }, this.scene);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, 1.2);
    barrel.material = turretMat; barrel.parent = barrelPivot; add(barrel);

    const muzzle = MeshBuilder.CreateCylinder('primMuzzle', { height: 0.18, diameter: 0.26, tessellation: 8 }, this.scene);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0, 2.28);
    muzzle.material = turretMat; muzzle.parent = barrelPivot; add(muzzle);

    this._toDispose.push(modelRoot, turretPivot, barrelPivot, hullMat, turretMat, trackMat);

    // Generic tank limits for the primitive placeholder
    this._barrelUp   = -20 * Math.PI / 180; // −20° (up)
    this._barrelDown =  10 * Math.PI / 180; // +10° (down)
    barrelPivot.rotation.x = 0;

    this.camera.target = new Vector3(0, 0.8, 0);
    this.camera.radius = 10;
    this.camera.alpha  = -Math.PI / 4;
    this.camera.beta   = 0.72;
  }

  _clearCurrentModel() {
    for (const item of this._toDispose) {
      if (item) item.dispose();
    }
    this._toDispose   = [];
    this._turretPivot = null;
    this._barrelPivot = null;
  }

  _loadModel(filename, config, btn, label) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    btn.classList.add('active');
    this._activeBtn      = btn;
    this._previewFilename = filename;

    this._clearCurrentModel();

    const rootName   = config.root       ?? 'Sketchfab_model';
    const turretName = config.turret     ?? 'turret';
    const mountName  = config.mount      ?? 'mount';
    const facingAxis = config.facingAxis ?? '+X';
    const yRotMap    = { '+Z': 0, '+X': -Math.PI / 2, '-Z': Math.PI, '-X': Math.PI / 2 };
    const yRot       = yRotMap[facingAxis] ?? -Math.PI / 2;

    btn.textContent = 'LOADING…';
    btn.style.opacity = '0.5';

    SceneLoader.ImportMeshAsync('', '/models/', filename, this.scene).then(result => {
      const glbRoot    = result.transformNodes.find(n => n.name === rootName)
        ?? result.transformNodes.find(n => n.name !== '__root__' && !n.parent);
      const turretNode = result.transformNodes.find(n => n.name === turretName)
        ?? result.transformNodes.find(n => /turret|tower|gun.base/i.test(n.name));
      const mountNode  = result.transformNodes.find(n => n.name === mountName)
        ?? result.transformNodes.find(n => /mount|barrel|gun|cannon|tube|weapon/i.test(n.name));

      if (!glbRoot) { console.error(`[Inspector] no root in ${filename}`); return; }

      // Track meshes for disposal on model switch (rendered geometry must go).
      // Transform nodes are intentionally NOT disposed — orphaning them avoids
      // corrupting Babylon's node registry, which breaks reloads of the same GLB.
      this._toDispose.push(...result.meshes);

      // 1. Orientation
      const correction = Quaternion.RotationAxis(Vector3.Up(), yRot);
      glbRoot.rotationQuaternion = glbRoot.rotationQuaternion
        ? correction.multiply(glbRoot.rotationQuaternion)
        : correction;

      // 2. Force world matrices
      result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      // 3. Bounding box
      let minX=Infinity, minY=Infinity, minZ=Infinity;
      let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
      for (const m of result.meshes) {
        if (m.name === '__root__') continue;
        const w = m.getBoundingInfo().boundingBox;
        if (w.minimumWorld.x < minX) minX = w.minimumWorld.x;
        if (w.minimumWorld.y < minY) minY = w.minimumWorld.y;
        if (w.minimumWorld.z < minZ) minZ = w.minimumWorld.z;
        if (w.maximumWorld.x > maxX) maxX = w.maximumWorld.x;
        if (w.maximumWorld.y > maxY) maxY = w.maximumWorld.y;
        if (w.maximumWorld.z > maxZ) maxZ = w.maximumWorld.z;
      }

      // 4. Scale — same formula as arena for 1:1 comparison
      const targetWidth = config.targetWidth ?? 2.4;
      const scale = targetWidth / (maxX - minX);
      const offX  = -((maxX + minX) / 2) * scale;
      const offY  = -minY * scale;
      const offZ  = -((maxZ + minZ) / 2) * scale + (config.zCenterAdjust ?? 0);

      // 5. Create inspector pivot nodes
      const modelRoot   = new TransformNode('inspRoot',   this.scene);
      const turretPivot = new TransformNode('inspTurret', this.scene);
      const barrelPivot = new TransformNode('inspBarrel', this.scene);
      modelRoot.position.set(0, PAD_Y + 0.01, 0);
      turretPivot.position.set(0, 0.55, 0);
      barrelPivot.position.set(0, 0.3,  0);
      turretPivot.parent = modelRoot;
      barrelPivot.parent = turretPivot;
      this._toDispose.push(modelRoot, turretPivot, barrelPivot);
      this._turretPivot = turretPivot;
      this._barrelPivot = barrelPivot;

      // 6. Attach GLB to inspector root
      glbRoot.parent = modelRoot;
      glbRoot.scaling.setAll(scale);
      glbRoot.position.set(offX, offY, offZ);

      result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      result.meshes.forEach(m => m.computeWorldMatrix(true));

      const turretAbsPos = turretNode ? turretNode.absolutePosition.clone() : null;
      const mountAbsPos  = mountNode  ? mountNode.absolutePosition.clone()  : null;

      // 7a. Turret pivot — same logic as arena loader
      if (turretNode) {
        turretNode.setParent(turretPivot);
        const rootInv = Matrix.Invert(modelRoot.getWorldMatrix());
        const localPos = Vector3.TransformCoordinates(turretAbsPos, rootInv);
        const pivotZShift = config.turretPivotZOffset ?? 0;
        turretPivot.position.x = config.centerTurretX ? 0 : localPos.x;
        turretPivot.position.z = localPos.z + pivotZShift;
        if (localPos.y > 0.3) {
          turretPivot.position.y = localPos.y;
        } else {
          console.warn(`[Inspector] ${filename}: turretNode y=${localPos.y.toFixed(3)} — empty may be misplaced in Blender (expected > 0.3). Geometry preserved at original position but rotation pivot will be off.`);
        }
        turretPivot.computeWorldMatrix(true);
        // Compute local offset that keeps geometry at its original world position.
        // When the "turret" empty is correctly placed, this ≈ (0,0,-pivotZShift).
        // When the empty is at the wrong height (near ground), this prevents the
        // geometry from jumping to turretPivot's height.
        const tpInv = Matrix.Invert(turretPivot.getWorldMatrix());
        const localInPivot = Vector3.TransformCoordinates(turretAbsPos, tpInv);
        turretNode.position.set(localInPivot.x, localInPivot.y, localInPivot.z);
        turretNode.computeWorldMatrix(true);
        result.transformNodes.forEach(n => n.computeWorldMatrix(true));
      }

      // 7b. Barrel pivot
      if (mountNode) {
        mountNode.setParent(barrelPivot);
        const tpInv = Matrix.Invert(turretPivot.getWorldMatrix());
        const localPos = Vector3.TransformCoordinates(mountAbsPos, tpInv);
        barrelPivot.position.x = 0;
        barrelPivot.position.z = localPos.z;
        if (localPos.y > 0) barrelPivot.position.y = localPos.y;
        barrelPivot.computeWorldMatrix(true);
        mountNode.position.setAll(0);
      }

      // 8. Shadows
      for (const m of result.meshes) {
        if (m.name === '__root__') continue;
        this.shadowGen.addShadowCaster(m);
        m.receiveShadows = true;
      }

      // 8.5. Paint — body panels get manifest paintColor (matte), tracks/optics left original
      applyModelPaint(result.meshes, config, this.scene);

      // 9. Set accurate elevation limits from manifest (degrees → radians)
      const toRad = d => d * Math.PI / 180;
      this._barrelUp   = -toRad(config.elevationDeg  ?? 20);
      this._barrelDown =  toRad(config.depressionDeg ?? 10);
      // Reset barrel to rest when switching models
      barrelPivot.rotation.x = 0;

      // 10. Auto-frame camera
      const modelH = (maxY - minY) * scale;
      this.camera.target = new Vector3(0, modelH * 0.45, 0);
      this.camera.radius = Math.max(6, modelH * 3.2);

      // 10. Log pivot values — paste directly into manifest.json for tuning
      const tp = turretPivot.position;
      const bp = barrelPivot.position;
      console.log(`[Inspector] ${filename}: scale=${scale.toFixed(4)}, w=${(maxX-minX).toFixed(2)}`);
      console.log(`[Inspector] turretPivot: x=${tp.x.toFixed(3)} y=${tp.y.toFixed(3)} z=${tp.z.toFixed(3)}`);
      console.log(`[Inspector] barrelPivot: x=${bp.x.toFixed(3)} y=${bp.y.toFixed(3)} z=${bp.z.toFixed(3)}`);

      btn.textContent = label;
      btn.style.opacity = '';
    }).catch(e => {
      console.error(`[Inspector] ${filename} failed:`, e);
      btn.textContent = label;
      btn.style.opacity = '';
    });
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    this.scene.dispose();
  }
}
