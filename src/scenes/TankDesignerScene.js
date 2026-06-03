import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, Matrix, DynamicTexture, TransformNode, SceneLoader, Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { applyModelPaint } from '../utils/modelPaint.js';
import { PARTS, PARTS_BY_ID } from '../parts/index.js';
import { assembleTank } from '../parts/assembleTank.js';

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

    // Cannon parts state
    this._equippedCannon          = 'cannon-90mm'; // last selected part ID
    this._cannonRoot              = null;
    this._cannonMeshes            = [];            // meshes belonging to the active part
    this._glbBarrelMeshes         = [];            // original GLB barrel meshes (hidden when part active)
    this._turretMat               = null;
    this._activeModelConfig       = null;           // manifest config for the current model
    this._glbBarrelCenterX        = 0;             // world X of the GLB barrel — cannon parts align to this
    this._modelCannonZOffset      = 0;             // fallback (overridden per-cannon via _activeModelConfig)
    this._cannonDropdown          = null;
    this._hideCannonDropdownTimer = null;
    this._lastPointerX          = 0;
    this._lastPointerY          = 0;

    // Track pointer position for dropdown placement
    this._onPointerMove = (e) => { this._lastPointerX = e.clientX; this._lastPointerY = e.clientY; };
    window.addEventListener('pointermove', this._onPointerMove);

    this._setupCamera();
    this._setupLighting();
    this._setupRoom();
    this._setupControls();
    this._setupUI();
    this._setupCannonDropdown();
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
  }

  _resetHint() {
    const hint = document.getElementById('designer-bottom-hint');
    if (hint) hint.textContent = '[ E ] CONFIRM SELECTION   |   [ ESC ] BACK';
  }

  confirmSelection() {
    if (!this._previewFilename) return;
    localStorage.setItem('selectedTank', this._previewFilename);
    this._selectedFilename = this._previewFilename;
    if (this._selectedBtn) this._selectedBtn.classList.remove('selected');
    if (this._activeBtn)  { this._activeBtn.classList.add('selected'); this._selectedBtn = this._activeBtn; }
    const hint = document.getElementById('designer-bottom-hint');
    if (hint) hint.textContent = '✓ SELECTED  —  [ ESC ] BACK TO MENU';
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

        // DEFAULT TANK — always first
        const primBtn = document.createElement('button');
        primBtn.className = 'shape-btn';
        primBtn.textContent = 'DEFAULT TANK';
        if (this._selectedFilename === 'primitive') {
          primBtn.classList.add('selected');
          this._selectedBtn = primBtn;
        }
        primBtn.addEventListener('click', () => {
          this._loadPrimitive(primBtn);
          this._previewFilename = 'primitive';
          this._resetHint();
        });
        sidebar.appendChild(primBtn);

        // COMPOSED tanks — built from swappable hull + turret + cannon parts
        const composedEntries = [
          ['M26 (COMPOSED)',  { hull: 'hull-m26', turret: 'turret-m26', cannon: 'cannon-90mm'  }],
          ['T-55 (COMPOSED)', { hull: 'hull-t55', turret: 'turret-t55', cannon: 'cannon-100mm' }],
          // Cross-tank mix entries are pending coordinate-system normalisation in the
          // extraction pipeline (M26 old-pipeline vs T-55 new-pipeline use different Babylon
          // height axes).  Re-enable after extract-parts.py adds +90°X normalisation step.
        ];
        for (const [label, loadout] of composedEntries) {
          const cb = document.createElement('button');
          cb.className = 'shape-btn';
          cb.textContent = label;
          cb.addEventListener('click', () => {
            this._loadComposed(cb, loadout);
            this._previewFilename = 'composed';
            this._resetHint();
          });
          sidebar.appendChild(cb);
        }

        const div2 = document.createElement('div');
        div2.className = 'ds-divider';
        sidebar.appendChild(div2);

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

        // Auto-load the saved selection
        if (this._selectedFilename === 'primitive') {
          this._loadPrimitive(primBtn);
          this._previewFilename = 'primitive';
        } else if (autoBtn) {
          this._loadModel(this._selectedFilename, autoConfig, autoBtn, autoBtn.textContent);
        } else {
          const firstEntry = Object.entries(manifest)[0];
          if (firstEntry) {
            const [fn, cfg] = firstEntry;
            const firstBtn = sidebar.querySelectorAll('.shape-btn')[2]; // skip primBtn + divider
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
    this._turretMat = turretMat;

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

    // Hull — single rectangular prism
    const hull = MeshBuilder.CreateBox('primHull', { width: 2.40, height: 0.65, depth: 2.50 }, this.scene);
    hull.position.set(0, 0.325, 0); hull.material = hullMat; hull.parent = modelRoot; add(hull);

    const trackL = MeshBuilder.CreateBox('primTrackL', { width: 0.28, height: 0.65, depth: 3.25 }, this.scene);
    trackL.position.set(-1.34, 0.325, 0); trackL.material = trackMat; trackL.parent = modelRoot; add(trackL);

    const trackR = MeshBuilder.CreateBox('primTrackR', { width: 0.28, height: 0.65, depth: 3.25 }, this.scene);
    trackR.position.set(1.34, 0.325, 0); trackR.material = trackMat; trackR.parent = modelRoot; add(trackR);

    const skirtL = MeshBuilder.CreateBox('primSkirtL', { width: 0.07, height: 0.25, depth: 2.90 }, this.scene);
    skirtL.position.set(-1.50, 0.125, 0); skirtL.material = trackMat; skirtL.parent = modelRoot; add(skirtL);

    const skirtR = MeshBuilder.CreateBox('primSkirtR', { width: 0.07, height: 0.25, depth: 2.90 }, this.scene);
    skirtR.position.set(1.50, 0.125, 0); skirtR.material = trackMat; skirtR.parent = modelRoot; add(skirtR);

    for (const wz of [-1.0, -0.33, 0.33, 1.0]) {
      for (const wx of [-1.34, 1.34]) {
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

    this._toDispose.push(modelRoot, turretPivot, barrelPivot, hullMat, turretMat, trackMat);

    // Barrel — async GLB load; fire-and-forget (appears shortly after tank loads)
    this._activeModelConfig  = { cannonOffsets: { 'cannon-90mm': { z: -0.6 }, 'cannon-100mm': { z: -0.35 } } };
    this._buildCannon(this._equippedCannon, turretMat).catch(e =>
      console.error('[cannon] build failed:', e)
    );

    // Generic tank limits for the primitive placeholder
    this._barrelUp   = -20 * Math.PI / 180; // −20° (up)
    this._barrelDown =  10 * Math.PI / 180; // +10° (down)
    barrelPivot.rotation.x = 0;

    this.camera.target = new Vector3(0, 0.8, 0);
    this.camera.radius = 10;
    this.camera.alpha  = -Math.PI / 4;
    this.camera.beta   = 0.72;
  }

  // Composed tank — built from swappable hull + turret + cannon parts via assembleTank.
  // Proves the mount-point/composition architecture; supports cross-mixing parts.
  _loadComposed(btn, loadout = { hull: 'hull-m26', turret: 'turret-m26', cannon: 'cannon-90mm' }) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    if (btn) { btn.classList.add('active'); this._activeBtn = btn; }

    this._clearCurrentModel();

    // Hull + turret self-paint (textures tinted via applyModelPaint). Barrel = flat body color.
    const cannonMat = new StandardMaterial('compCannon', this.scene);
    cannonMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
    cannonMat.specularColor = new Color3(0.05, 0.06, 0.07);
    cannonMat.specularPower = 8;
    this._toDispose.push(cannonMat);

    assembleTank(this.scene, loadout, { cannon: cannonMat })
      .then(tank => {
        // assembleTank grounds the tank (root.position.y = -minY); keep that, add pad offset
        tank.root.position.x = 0;
        tank.root.position.z = 0;
        tank.root.position.y += PAD_Y + 0.01;
        this._turretPivot = tank.turretPivot;
        this._barrelPivot = tank.barrelPivot;

        // Track everything for disposal + shadows
        const allMeshes = [
          ...tank.parts.hullBuilt.meshes,
          ...tank.parts.turretBuilt.meshes,
          ...tank.parts.cannonBuilt.meshes,
        ];
        for (const m of allMeshes) {
          m.receiveShadows = true;
          this.shadowGen.addShadowCaster(m);
        }
        this._toDispose.push(
          tank.root, tank.turretPivot, tank.barrelPivot,
          tank.parts.hullBuilt.root, tank.parts.turretBuilt.root, tank.parts.cannonBuilt.root,
          ...allMeshes,
        );

        // M26 elevation limits
        this._barrelUp   = -20 * Math.PI / 180;
        this._barrelDown =  10 * Math.PI / 180;
        tank.barrelPivot.rotation.x = 0;
      })
      .catch(e => console.error('[composed] assembly failed:', e));

    this.camera.target = new Vector3(0, 0.8, 0);
    this.camera.radius = 10;
    this.camera.alpha  = -Math.PI / 4;
    this.camera.beta   = 0.72;
  }

  _clearCurrentModel() {
    // Cannon part is tracked separately — dispose before main model
    if (this._cannonRoot) {
      for (const m of this._cannonMeshes) {
        if (!m.isDisposed()) m.dispose();
      }
      this._cannonRoot.dispose();
      this._cannonRoot   = null;
      this._cannonMeshes = [];
    }
    // Restore GLB barrel visibility before the model gets disposed
    for (const m of this._glbBarrelMeshes) {
      if (!m.isDisposed()) m.setEnabled(true);
    }
    for (const item of this._toDispose) {
      if (item) item.dispose();
    }
    this._toDispose        = [];
    this._turretPivot      = null;
    this._barrelPivot      = null;
    this._turretMat        = null;
    this._glbBarrelMeshes  = [];
    this._glbBarrelCenterX = 0;
  }

  _loadModel(filename, config, btn, label) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    btn.classList.add('active');
    this._activeBtn       = btn;
    this._previewFilename = filename;
    this._resetHint();

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
        barrelPivot.position.x = config.barrelPivotX ?? 0;
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

      // 8.6. Cannon swap support — track original barrel meshes and create a paint-matched
      //      material so the cannon part blends with the tank's paint scheme.
      if (config.barrelMeshNames?.length) {
        this._glbBarrelMeshes = result.meshes.filter(m =>
          config.barrelMeshNames.includes(m.name)
        );
        // Read world-space X center of the GLB barrel so cannon parts align to it exactly.
        if (this._glbBarrelMeshes.length) {
          this._glbBarrelMeshes.forEach(m => m.computeWorldMatrix(true));
          const xSum = this._glbBarrelMeshes.reduce((s, m) =>
            s + m.getBoundingInfo().boundingBox.centerWorld.x, 0
          );
          this._glbBarrelCenterX = xSum / this._glbBarrelMeshes.length;
        }
        const [r, g, b] = config.paintColor ?? [0.5, 0.5, 0.5];
        const mat = new StandardMaterial('cannonGLBMat', this.scene);
        mat.diffuseColor  = new Color3(r, g, b);
        mat.specularColor = new Color3(0.04, 0.04, 0.04);
        this._turretMat = mat;
        this._toDispose.push(mat);
      }
      this._activeModelConfig = config;

      // Native cannon = the GLB's own barrel, just labelled. No part swap needed.
      if (config.nativeCannon) {
        this._equippedCannon = config.nativeCannon;
      }

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

  // ── Cannon parts ────────────────────────────────────────────────────────

  async _buildCannon(partId, material) {
    // Dispose existing cannon if any
    if (this._cannonRoot) {
      for (const m of this._cannonMeshes) {
        if (!m.isDisposed()) m.dispose();
      }
      this._cannonRoot.dispose();
      this._cannonRoot   = null;
      this._cannonMeshes = [];
    }

    const part = PARTS_BY_ID[partId];
    if (!part || !this._barrelPivot) return;

    // Hide the GLB's own barrel meshes so the part takes their place
    for (const m of this._glbBarrelMeshes) {
      if (!m.isDisposed()) m.setEnabled(false);
    }

    const { root, meshes } = await part.build(this.scene, material);
    root.parent = this._barrelPivot;
    const off = this._activeModelConfig?.cannonOffsets?.[partId] ?? {};
    // X: use the GLB barrel's actual world center when available (auto-aligns to
    // mantlet), plus an optional manifest `x` nudge for fine adjustment.
    root.position.x = (this._glbBarrelMeshes.length ? this._glbBarrelCenterX : 0) + (off.x ?? 0);
    root.position.z = off.z ?? this._modelCannonZOffset;
    if (off.scale) root.scaling.setAll(off.scale);

    for (const m of meshes) {
      m.receiveShadows = true;
      this.shadowGen.addShadowCaster(m);
    }

    this._cannonRoot    = root;
    this._cannonMeshes  = meshes;
    this._equippedCannon = partId;

    // Barrel elevation limits from part stats
    const toRad = d => d * Math.PI / 180;
    this._barrelUp   = -toRad(part.stats.elevation  ?? 20);
    this._barrelDown =  toRad(part.stats.depression ?? 10);
  }

  _restoreOriginal() {
    if (!this._glbBarrelMeshes.length) return;
    if (this._cannonRoot) {
      for (const m of this._cannonMeshes) { if (!m.isDisposed()) m.dispose(); }
      this._cannonRoot.dispose();
      this._cannonRoot   = null;
      this._cannonMeshes = [];
    }
    for (const m of this._glbBarrelMeshes) {
      if (!m.isDisposed()) m.setEnabled(true);
    }
    this._equippedCannon = null;
  }

  async _swapCannon(partId) {
    if (partId === this._equippedCannon) return;
    const isNative = partId === this._activeModelConfig?.nativeCannon;
    if (isNative) {
      // Native cannon = the original GLB barrel; just restore it and re-label
      this._restoreOriginal();
      this._equippedCannon = partId;
    } else {
      if (!this._turretMat) return;
      await this._buildCannon(partId, this._turretMat);
    }
    // Sync active state in dropdown
    if (this._cannonDropdown) {
      this._cannonDropdown.querySelectorAll('.cannon-dropdown-item').forEach(el => {
        el.classList.toggle('active', el.dataset.partId === partId);
      });
    }
  }

  _setupCannonDropdown() {
    const dd = document.createElement('div');
    dd.className   = 'cannon-dropdown';
    dd.style.display = 'none';

    const title = document.createElement('div');
    title.className   = 'cannon-dropdown-title';
    title.textContent = 'CANNON';
    dd.appendChild(title);

    // ORIGINAL — restore the GLB's own barrel; only shown on GLB models
    const origItem = document.createElement('div');
    origItem.className      = 'cannon-dropdown-item';
    origItem.dataset.partId = 'original';
    origItem.style.display  = 'none'; // hidden until a GLB with barrelMeshNames is loaded
    const origName = document.createElement('span');
    origName.className = 'cannon-dd-name'; origName.textContent = 'ORIGINAL';
    const origStats = document.createElement('span');
    origStats.className = 'cannon-dd-stats'; origStats.textContent = 'stock barrel';
    origItem.appendChild(origName); origItem.appendChild(origStats);
    origItem.addEventListener('click', () => { this._restoreOriginal(); this._hideCannonDropdown(); });
    dd.appendChild(origItem);

    for (const part of PARTS.cannons) {
      const item = document.createElement('div');
      item.className      = 'cannon-dropdown-item';
      item.dataset.partId = part.id;
      if (part.id === this._equippedCannon) item.classList.add('active');

      const name = document.createElement('span');
      name.className   = 'cannon-dd-name';
      name.textContent = part.name;

      const stats = document.createElement('span');
      stats.className   = 'cannon-dd-stats';
      stats.textContent = `${part.stats.caliber}mm  ·  barrel ${part.stats.barrelLength} units`;

      item.appendChild(name);
      item.appendChild(stats);
      item.addEventListener('click', () => {
        this._swapCannon(part.id);
        this._hideCannonDropdown();
      });
      dd.appendChild(item);
    }

    dd.addEventListener('mouseenter', () => clearTimeout(this._hideCannonDropdownTimer));
    dd.addEventListener('mouseleave', () => {
      this._hideCannonDropdownTimer = setTimeout(() => this._hideCannonDropdown(), 120);
    });

    this._cannonDropdown = dd;
    document.body.appendChild(dd);

    // Hover detection via per-frame scene.pick() — more reliable than onPointerObservable's
    // cached pickInfo which misses dynamically-built meshes in Babylon.js 7.x.
    let _wasOver = false;
    this.scene.registerBeforeRender(() => {
      const hoverTargets = [...this._cannonMeshes, ...this._glbBarrelMeshes];
      if (hoverTargets.length === 0) return;
      const hit  = this.scene.pick(this.scene.pointerX, this.scene.pointerY)?.pickedMesh;
      const over = hoverTargets.includes(hit);
      if (over && !_wasOver) {
        clearTimeout(this._hideCannonDropdownTimer);
        this._showCannonDropdown(this._lastPointerX ?? 0, this._lastPointerY ?? 0);
      } else if (!over && _wasOver) {
        clearTimeout(this._hideCannonDropdownTimer);
        this._hideCannonDropdownTimer = setTimeout(() => this._hideCannonDropdown(), 320);
      }
      _wasOver = over;
    });
  }

  _showCannonDropdown(x, y) {
    const dd = this._cannonDropdown;
    if (!dd) return;
    const hasGLB    = this._glbBarrelMeshes.length > 0;
    const hasNative = !!this._activeModelConfig?.nativeCannon;
    dd.querySelectorAll('.cannon-dropdown-item').forEach(el => {
      if (el.dataset.partId === 'original') {
        // Hide ORIGINAL when the tank has a native cannon (native = original, just labelled)
        el.style.display = (hasGLB && !hasNative) ? '' : 'none';
        el.classList.toggle('active', hasGLB && !hasNative && this._cannonRoot === null);
      } else {
        el.classList.toggle('active', el.dataset.partId === this._equippedCannon);
      }
    });
    dd.style.display = 'block';
    // Position right of cursor, clamp to viewport
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 18;
    let top  = y - 10;
    // Rough size estimate; actual layout may vary slightly
    if (left + 210 > vw - margin) left = x - 210;
    if (top  + 120 > vh - margin) top  = vh - 120 - margin;
    dd.style.left = left + 'px';
    dd.style.top  = top  + 'px';
  }

  _hideCannonDropdown() {
    if (this._cannonDropdown) this._cannonDropdown.style.display = 'none';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  dispose() {
    window.removeEventListener('keydown',     this._onKeyDown);
    window.removeEventListener('keyup',       this._onKeyUp);
    window.removeEventListener('pointermove', this._onPointerMove);
    if (this._cannonDropdown) { this._cannonDropdown.remove(); this._cannonDropdown = null; }
    this.scene.dispose();
  }
}
