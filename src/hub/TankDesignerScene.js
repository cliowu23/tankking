import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, Matrix, DynamicTexture, TransformNode, SceneLoader, Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { applyModelPaint, makePaintMaterial } from '../utils/modelPaint.js';
import { yRotForFacing } from '../utils/mathUtils.js';
import { buildPrimitiveTank } from '../tank/primitiveTank.js';
import { worldBounds } from '../utils/meshBounds.js';
import { PARTS, PARTS_BY_ID, DEFAULT_LOADOUT, validLoadout } from '../tank/parts/index.js';
import { assembleTank } from '../tank/parts/assembleTank.js';
import { audio } from '../core/audio/AudioManager.js';
import { attachCrt } from '../core/crtFilter.js';
import { measureBasket } from '../tank/parts/measureBasket.js';
import SentinelEnemy from '../world/SentinelEnemy.js';
import ChaffEnemy from '../world/ChaffEnemy.js';

const PAD_Y = 0.06;

export default class TankDesignerScene {
  constructor(engine, onExit) {
    this._engine = engine;
    this._onExit = onExit;
    this.scene   = new Scene(engine);
    this.scene.clearColor = new Color4(0.84, 0.90, 0.96, 1.0);
    if (import.meta.env?.DEV) window.__designer = this; // debug hook (matches __hangar/__arena)

    this._turretPivot      = null;
    this._barrelPivot      = null;
    this._toDispose        = [];
    this._activeBtn        = null;
    this._selectedBtn      = null; // button for the confirmed selection
    this._keys             = {};
    this._barrelUp         = -0.349;
    this._barrelDown       =  0.175;
    this._previewFilename  = null; // what's currently showing in the 3D view
    this._selectedFilename = localStorage.getItem('selectedTank') || 'composed';

    // Cannon parts state
    this._equippedCannon          = DEFAULT_LOADOUT.cannon;
    this._cannonRoot              = null;
    this._cannonMeshes            = [];
    this._glbBarrelMeshes         = [];
    this._turretMat               = null;
    this._activeModelConfig       = null;
    this._glbBarrelCenterX        = 0;
    this._modelCannonZOffset      = 0;
    this._cannonDropdown          = null;
    this._hideCannonDropdownTimer = null;

    // Modular parts state
    this._equippedHull            = DEFAULT_LOADOUT.hull;
    this._equippedTurret          = DEFAULT_LOADOUT.turret;
    this._selectedPaint           = JSON.parse(localStorage.getItem('selectedPaint') || 'null'); // [r,g,b] or null
    this._isComposedMode          = false;
    this._turretMeshesComposed    = [];
    this._turretDropdown          = null;
    this._hideTurretDropdownTimer = null;
    this._activeHullBtn           = null;

    this._lastPointerX = 0;
    this._lastPointerY = 0;

    // Track pointer position for dropdown placement
    this._onPointerMove = (e) => { this._lastPointerX = e.clientX; this._lastPointerY = e.clientY; };
    window.addEventListener('pointermove', this._onPointerMove);

    this._setupCamera();
    this._setupLighting();
    this._setupRoom();
    this._setupControls();
    this._setupUI();
    this._setupCannonDropdown();
    this._setupTurretDropdown();
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
    // Arrow keys are reserved for tank-list navigation — unbind them from the camera
    // (otherwise navigating also pans/tilts the view). Mouse drag + wheel still work.
    this.camera.keysUp = []; this.camera.keysDown = [];
    this.camera.keysLeft = []; this.camera.keysRight = [];
    attachCrt(this.camera);   // arcade/CRT post-process (toggled live via Settings)
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

  // Arrow-key navigation: step to the previous/next sidebar entry and load it
  // (reuses each button's own click handler). dir = +1 (down) / -1 (up).
  cycleSelection(dir) {
    const sidebar = document.getElementById('designer-sidebar');
    if (!sidebar) return;
    const btns = [...sidebar.querySelectorAll('.shape-btn')];
    if (!btns.length) return;
    // Drive purely off a tracked index — button types set different "active" vars
    // (_activeBtn vs _activeHullBtn), so reading _activeBtn would stick/skip. Seed
    // from whatever's currently highlighted on the first press.
    if (this._navIndex == null) {
      const cur = sidebar.querySelector('.shape-btn.active, .shape-btn.selected');
      this._navIndex = Math.max(0, btns.indexOf(cur));
    }
    const idx = (this._navIndex + dir + btns.length) % btns.length;
    this._navIndex = idx;
    const next = btns[idx];
    next.click();
    next.scrollIntoView({ block: 'nearest' });
    audio.play('ui.hover');   // soft tick as you move through the list
  }

  confirmSelection() {
    if (!this._previewFilename) return;
    audio.play('ui.select');   // confirm blip on E-select
    localStorage.setItem('selectedTank', this._previewFilename);
    this._selectedFilename = this._previewFilename;
    // Composed mode ('composed') needs the actual parts saved so the arena/hangar can rebuild it.
    if (this._isComposedMode) {
      localStorage.setItem('selectedLoadout', JSON.stringify({
        hull:   this._equippedHull,
        turret: this._equippedTurret,
        cannon: this._equippedCannon || DEFAULT_LOADOUT.cannon,
      }));
    }
    if (this._selectedBtn) this._selectedBtn.classList.remove('selected');
    if (this._activeBtn)  { this._activeBtn.classList.add('selected'); this._selectedBtn = this._activeBtn; }
    const hint = document.getElementById('designer-bottom-hint');
    if (hint) hint.textContent = '✓ SELECTED  —  [ ESC ] BACK TO MENU';
  }

  _populateSidebar() {
    fetch('/assets/models/manifest.json')
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

        // HULL selector — click a hull to rebuild the composed tank
        const hullTitleEl = document.createElement('div');
        hullTitleEl.className = 'ds-title';
        hullTitleEl.textContent = 'HULL';
        sidebar.appendChild(hullTitleEl);

        for (const hull of PARTS.hulls) {
          const hb = document.createElement('button');
          hb.className = 'shape-btn';
          hb.textContent = hull.name.toUpperCase();
          if (hull.id === this._equippedHull) {
            hb.classList.add('active');
            this._activeHullBtn = hb;
          }
          hb.addEventListener('click', () => {
            if (this._activeHullBtn) this._activeHullBtn.classList.remove('active');
            hb.classList.add('active');
            this._activeHullBtn = hb;
            this._equippedHull  = hull.id;
            // Adopt the equipped turret's natural gun so the cannon matches the turret.
            const turret = PARTS_BY_ID[this._equippedTurret];
            if (turret?.defaultCannon) this._equippedCannon = turret.defaultCannon;
            this._rebuildComposed();
          });
          sidebar.appendChild(hb);
        }

        // PAINT selector — recolours the whole composed tank; persists to selectedPaint.
        const paintTitle = document.createElement('div');
        paintTitle.className = 'ds-title';
        paintTitle.textContent = 'PAINT';
        sidebar.appendChild(paintTitle);

        const paintRow = document.createElement('div');
        paintRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:6px 4px;';
        const PAINT_PRESETS = [
          ['Cobalt',   [0.12, 0.42, 0.88]],
          ['Crimson',  [0.80, 0.12, 0.10]],
          ['Forest',   [0.18, 0.45, 0.22]],
          ['Sand',     [0.78, 0.66, 0.40]],
          ['Charcoal', [0.16, 0.17, 0.20]],
          ['Plum',     [0.46, 0.20, 0.56]],
          ['Default',  null],
        ];
        const applyPaint = (rgb) => {
          this._selectedPaint = rgb;
          try { localStorage.setItem('selectedPaint', JSON.stringify(rgb)); } catch (e) { /* ignore */ }
          this._rebuildComposed();
        };
        for (const [pname, rgb] of PAINT_PRESETS) {
          const sw = document.createElement('button');
          sw.title = pname;
          sw.style.cssText = 'width:24px;height:24px;border:1px solid #00e5ff55;border-radius:3px;cursor:pointer;' +
            (rgb ? `background:rgb(${rgb.map(c => Math.round(c * 255)).join(',')});`
                 : 'background:repeating-linear-gradient(45deg,#555,#555 4px,#333 4px,#333 8px);');
          sw.addEventListener('click', () => applyPaint(rgb));
          paintRow.appendChild(sw);
        }
        const customPaint = document.createElement('input');
        customPaint.type = 'color';
        customPaint.value = '#3a6bdf';
        customPaint.title = 'Custom colour';
        customPaint.style.cssText = 'width:30px;height:24px;padding:0;border:1px solid #00e5ff55;border-radius:3px;cursor:pointer;background:none;';
        customPaint.addEventListener('input', () => {
          const h = customPaint.value;
          applyPaint([parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]);
        });
        paintRow.appendChild(customPaint);
        sidebar.appendChild(paintRow);

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

        // ENEMIES — dev-only VIEWER (not selectable as the player tank). Lets us
        // eyeball the King's-machine models on the plinth alongside the tanks.
        const enemyDiv = document.createElement('div');
        enemyDiv.className = 'ds-divider';
        sidebar.appendChild(enemyDiv);
        const enemyTitle = document.createElement('div');
        enemyTitle.className = 'ds-title';
        enemyTitle.textContent = 'ENEMIES · VIEW';
        sidebar.appendChild(enemyTitle);
        for (const [kind, name] of [['sentinel', 'SENTINEL-BOT'], ['chaff', 'CHAFF SCOUT']]) {
          const eb = document.createElement('button');
          eb.className = 'shape-btn';
          eb.textContent = name;
          eb.addEventListener('click', () => this._loadEnemy(kind, eb));
          sidebar.appendChild(eb);
        }

        // Auto-load the saved selection
        if (this._selectedFilename === 'primitive') {
          this._loadPrimitive(primBtn);
          this._previewFilename = 'primitive';
        } else if (autoBtn) {
          this._loadModel(this._selectedFilename, autoConfig, autoBtn, autoBtn.textContent);
        } else {
          // Default: load the modular composed tank
          this._rebuildComposed();
        }
      });
  }

  _loadPrimitive(btn) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    if (btn) { btn.classList.add('active'); this._activeBtn = btn; }

    this._clearCurrentModel();

    // Shared geometry (see src/tank/primitiveTank.js). The designer adds the real cannon
    // GLB onto the barrel pivot below, so it opts out of the builder's simple barrel.
    const prim = buildPrimitiveTank(this.scene, { simpleBarrel: false });
    prim.root.position.set(0, PAD_Y + 0.01, 0);
    this._turretPivot = prim.turretPivot;
    this._barrelPivot = prim.barrelPivot;
    this._turretMat   = prim.materials.turret;

    for (const mesh of prim.meshes) { this.shadowGen.addShadowCaster(mesh); }
    this._toDispose.push(
      ...prim.meshes, prim.root, prim.turretPivot, prim.barrelPivot,
      prim.materials.hull, prim.materials.turret, prim.materials.track,
    );

    // Barrel — async GLB load; fire-and-forget (appears shortly after tank loads)
    this._activeModelConfig  = { cannonOffsets: {} };  // per-cannon nudges (WT-era entries retired)
    this._buildCannon(this._equippedCannon, prim.materials.turret).catch(e =>
      console.error('[cannon] build failed:', e)
    );

    // Generic tank limits for the primitive placeholder
    this._barrelUp   = -20 * Math.PI / 180; // −20° (up)
    this._barrelDown =  10 * Math.PI / 180; // +10° (down)
    prim.barrelPivot.rotation.x = 0;

    this.camera.target = new Vector3(0, 0.8, 0);
    this.camera.radius = 10;
    this.camera.alpha  = -Math.PI / 4;
    this.camera.beta   = 0.72;
  }

  _rebuildComposed() {
    this._isComposedMode   = true;
    this._previewFilename  = 'composed';
    this._resetHint();
    this._loadComposed(null, {
      hull:   this._equippedHull,
      turret: this._equippedTurret,
      cannon: this._equippedCannon || DEFAULT_LOADOUT.cannon,
    });
  }

  // Composed tank — built from swappable hull + turret + cannon parts via assembleTank.
  _loadComposed(btn, loadout = DEFAULT_LOADOUT) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    if (btn) { btn.classList.add('active'); this._activeBtn = btn; }
    this._isComposedMode = true;

    this._clearCurrentModel();

    // Barrel is painted the body color of the equipped turret (red T-44, blue M26) so it
    // reads as part of the tank, matching the hull/turret paint.
    const paint = this._selectedPaint ?? null;   // player paint, or null = each part's own colour
    const bodyCol = paint ?? PARTS_BY_ID[loadout.turret]?.paintColor ?? [0.12, 0.42, 0.88];
    const cannonMat = makePaintMaterial(this.scene, bodyCol);  // shared painted-metal finish

    assembleTank(this.scene, loadout, { cannon: cannonMat }, { paint })
      .then(tank => {
        tank.root.position.x = 0;
        tank.root.position.z = 0;
        tank.root.position.y += PAD_Y + 0.01;
        this._turretPivot = tank.turretPivot;
        this._barrelPivot = tank.barrelPivot;

        // Expose meshes for hover dropdowns
        this._turretMeshesComposed = tank.parts.turretBuilt.meshes;
        this._cannonMeshes         = tank.parts.cannonBuilt.meshes;

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

  // Spawn an enemy on the plinth purely to LOOK at it (dev viewer). Enemies use
  // the AIEnemy rig, not the composed-parts system, so we instantiate the class,
  // strip its combat bits (hp bar, projectile pool), face it at the camera, and
  // track every mesh for disposal. View-only: _previewFilename stays null so the
  // SELECT/confirm path treats it as un-pickable as a player tank.
  _loadEnemy(kind, btn) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    if (btn) { btn.classList.add('active'); this._activeBtn = btn; }

    this._clearCurrentModel();

    const EnemyClass = kind === 'chaff' ? ChaffEnemy : SentinelEnemy;
    const enemy = new EnemyClass(this.scene, 0, 0, { bounds: 9999 });
    this._enemyInstance = enemy;

    // Enemies default to facing south (rotY = π); face the plinth camera like the tanks.
    enemy.rotY = 0;
    enemy.root.rotation.y = 0;
    enemy.turretAimAngle = 0;
    if (enemy.turretPivot) enemy.turretPivot.rotation.y = 0;
    enemy.root.position.set(0, PAD_Y + 0.01, 0);

    // Hide the combat HUD + drop the projectile pool — this is a static turntable.
    if (enemy.hpBarBg)   enemy.hpBarBg.isVisible = false;
    if (enemy.hpBarFill) enemy.hpBarFill.isVisible = false;
    for (const s of (enemy.shells || [])) { s.deactivate?.(); s.mesh?.dispose(false, true); }
    enemy.shells = [];

    // A/D rotate the turret/eye-dome (same control as the tanks).
    this._turretPivot = enemy.turretPivot || null;
    this._barrelPivot = enemy.barrelPivot || null;

    const meshes = enemy.root.getChildMeshes(false);
    for (const m of meshes) this.shadowGen.addShadowCaster(m);
    // Push every mesh (so _clearCurrentModel frees each material/texture) + the rig nodes.
    this._toDispose.push(...meshes, enemy.root, enemy.turretPivot, enemy.barrelPivot);

    // Not a selectable player tank.
    this._previewFilename = null;
    const hint = document.getElementById('designer-bottom-hint');
    if (hint) hint.textContent = 'VIEW ONLY — enemy model  ·  [ A / D ] rotate turret  ·  [ ESC ] back to menu';
  }

  _clearCurrentModel() {
    this._enemyInstance = null;
    // Gather every material on the things we're about to dispose. Babylon's
    // mesh.dispose() leaves materials + their textures resident in GPU memory,
    // so on repeated model switches the GPU steadily leaks multi-MB GLB textures
    // until the renderer OOMs. We free them explicitly below.
    const mats = new Set();
    const collectMat = (m) => { if (m && m.material) mats.add(m.material); };

    // Cannon part is tracked separately — dispose before main model
    if (this._cannonRoot) {
      for (const m of this._cannonMeshes) {
        collectMat(m);
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
      collectMat(item);
    }
    for (const item of this._toDispose) {
      if (item && !(item.isDisposed && item.isDisposed())) item.dispose();
    }
    // Free materials and their textures (forceDisposeTextures = true)
    for (const mat of mats) {
      if (mat && !(mat.isDisposed && mat.isDisposed())) mat.dispose(false, true);
    }
    this._toDispose              = [];
    this._turretPivot            = null;
    this._barrelPivot            = null;
    this._turretMat              = null;
    this._glbBarrelMeshes        = [];
    this._glbBarrelCenterX       = 0;
    this._turretMeshesComposed   = [];
    this._cannonMeshes           = [];
  }

  _loadModel(filename, config, btn, label) {
    if (this._activeBtn) this._activeBtn.classList.remove('active');
    btn.classList.add('active');
    this._activeBtn       = btn;
    this._previewFilename = filename;
    this._isComposedMode  = false;
    this._resetHint();

    this._clearCurrentModel();

    const rootName   = config.root       ?? 'Sketchfab_model';
    const turretName = config.turret     ?? 'turret';
    const mountName  = config.mount      ?? 'mount';
    const facingAxis = config.facingAxis ?? '+X';
    const yRot       = yRotForFacing(facingAxis);

    btn.textContent = 'LOADING…';
    btn.style.opacity = '0.5';

    SceneLoader.ImportMeshAsync('', '/assets/models/tanks/', filename, this.scene).then(result => {
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
      const { minX, minY, minZ, maxX, maxY, maxZ } =
        worldBounds(result.meshes, m => m.name !== '__root__');

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

      // 7a. Turret pivot — pivot about the turret's detected basket (ring) centre so it spins
      //     in place, instead of the GLB's `turret` empty which sits behind the dome. The same
      //     adaptive detection assembleTank uses: measureBasket finds the dome centre and strips
      //     the forward-protruding gun (dome straddles the ring, the barrel/MG don't).
      if (turretNode) {
        const turretMeshes = result.meshes.filter(m => m.isDescendantOf(turretNode));
        const basket  = measureBasket(turretMeshes, turretAbsPos.z);   // basket centre, world XZ
        turretNode.setParent(turretPivot);
        const rootInv     = Matrix.Invert(modelRoot.getWorldMatrix());
        const localPos    = Vector3.TransformCoordinates(turretAbsPos, rootInv);  // empty (height)
        const basketLocal = Vector3.TransformCoordinates(basket.center, rootInv); // pivot XZ
        const pivotZShift = config.turretPivotZOffset ?? 0;   // optional manual nudge (default 0)
        turretPivot.position.x = config.centerTurretX ? 0 : basketLocal.x;
        turretPivot.position.z = basketLocal.z + pivotZShift;
        console.log(`[Inspector] ${filename} basket pivot z=${(basketLocal.z + pivotZShift).toFixed(3)} (empty z=${localPos.z.toFixed(3)}) from ${basket.domeMeshes.length} dome meshes`);
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
    if (this._isComposedMode) {
      this._equippedCannon = partId;
      this._rebuildComposed();
      return;
    }
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

  // ── Turret hover-dropdown (composed mode only) ────────────────────────────

  _setupTurretDropdown() {
    const dd = document.createElement('div');
    dd.className   = 'cannon-dropdown'; // reuse same CSS
    dd.style.display = 'none';

    const title = document.createElement('div');
    title.className   = 'cannon-dropdown-title';
    title.textContent = 'TURRET';
    dd.appendChild(title);

    for (const part of PARTS.turrets) {
      const item = document.createElement('div');
      item.className      = 'cannon-dropdown-item';
      item.dataset.partId = part.id;
      if (part.id === this._equippedTurret) item.classList.add('active');

      const name = document.createElement('span');
      name.className   = 'cannon-dd-name';
      name.textContent = part.name;

      const stats = document.createElement('span');
      stats.className   = 'cannon-dd-stats';
      stats.textContent = part.stats?.traverseSpeed
        ? `traverse ${part.stats.traverseSpeed}°/s`
        : 'standard turret';

      item.appendChild(name);
      item.appendChild(stats);
      item.addEventListener('click', () => {
        this._equippedTurret = part.id;
        if (part.defaultCannon) this._equippedCannon = part.defaultCannon;
        this._rebuildComposed();
        this._hideTurretDropdown();
      });
      dd.appendChild(item);
    }

    dd.addEventListener('mouseenter', () => clearTimeout(this._hideTurretDropdownTimer));
    dd.addEventListener('mouseleave', () => {
      this._hideTurretDropdownTimer = setTimeout(() => this._hideTurretDropdown(), 120);
    });

    this._turretDropdown = dd;
    document.body.appendChild(dd);

    let _wasOver = false;
    this.scene.registerBeforeRender(() => {
      if (!this._isComposedMode || this._turretMeshesComposed.length === 0) return;
      const hit  = this.scene.pick(this.scene.pointerX, this.scene.pointerY)?.pickedMesh;
      const over = this._turretMeshesComposed.includes(hit);
      if (over && !_wasOver) {
        clearTimeout(this._hideTurretDropdownTimer);
        this._showTurretDropdown(this._lastPointerX ?? 0, this._lastPointerY ?? 0);
      } else if (!over && _wasOver) {
        clearTimeout(this._hideTurretDropdownTimer);
        this._hideTurretDropdownTimer = setTimeout(() => this._hideTurretDropdown(), 320);
      }
      _wasOver = over;
    });
  }

  _showTurretDropdown(x, y) {
    const dd = this._turretDropdown;
    if (!dd) return;
    dd.querySelectorAll('.cannon-dropdown-item').forEach(el => {
      el.classList.toggle('active', el.dataset.partId === this._equippedTurret);
    });
    dd.style.display = 'block';
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 18;
    let top  = y - 10;
    if (left + 210 > vw - margin) left = x - 210;
    if (top  + 120 > vh - margin) top  = vh - 120 - margin;
    dd.style.left = left + 'px';
    dd.style.top  = top  + 'px';
  }

  _hideTurretDropdown() {
    if (this._turretDropdown) this._turretDropdown.style.display = 'none';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  dispose() {
    window.removeEventListener('keydown',     this._onKeyDown);
    window.removeEventListener('keyup',       this._onKeyUp);
    window.removeEventListener('pointermove', this._onPointerMove);
    if (this._cannonDropdown) { this._cannonDropdown.remove(); this._cannonDropdown = null; }
    if (this._turretDropdown) { this._turretDropdown.remove(); this._turretDropdown = null; }
    this.scene.dispose();
  }
}
