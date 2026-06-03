import {
  Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  ShadowGenerator, MeshBuilder, StandardMaterial, Color3, Color4,
  Vector3, Matrix, DynamicTexture, GlowLayer, TransformNode, SceneLoader,
  Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { applyModelPaint } from '../utils/modelPaint.js';
import Tank from '../entities/Tank.js';
import Enemy from '../entities/Enemy.js';
import AIEnemy from '../entities/AIEnemy.js';
import Shell from '../entities/Shell.js';
import { GridMaterial } from '@babylonjs/materials';

const NORMAL_SPARK_VELS = [
  { vx:  0.0, vy: 5.2, vz:  0.0 },
  { vx:  2.6, vy: 4.6, vz:  0.0 },
  { vx: -2.6, vy: 4.6, vz:  0.0 },
  { vx:  0.0, vy: 4.6, vz:  2.6 },
  { vx:  0.0, vy: 4.6, vz: -2.6 },
  { vx:  1.8, vy: 4.3, vz:  1.8 },
  { vx: -1.8, vy: 4.3, vz: -1.8 },
];
const NORMAL_SPARK_GRAVITY = 14;  // units/s² downward (Babylon Y-up)
const NORMAL_SPARK_TRAIL   = 0.07; // seconds of trail behind spark head

export default class ArenaScene {
  constructor(engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.48, 0.78, 1.0, 1.0);

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

    // Persistent camera target position for soft follow
    this._camX = 0;
    this._camZ = 0;

    this._paused = false;

    this._obstacles = [];
    this._barrelPivotBaseZ = 0.6; // updated after GLB loads to the actual trunnion position

    this._setupCamera();
    this._setupLighting();
    this._setupGround();
    this._setupEnvironment();
    this._setupSky();
    this._setupHazards();
    this._setupEntities();
    // this._setupDevLabels();
    this._setupLockOn();
    this._setupFiring();
    this._setupVFX();
    this._setupGameLoop();
  }

  _setupCamera() {
    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.5, 39, Vector3.Zero(), this.scene);
  }

  _setupLighting() {
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity   = 0.85;
    ambient.diffuse     = new Color3(1.0, 0.97, 0.88);
    ambient.groundColor = new Color3(0.28, 0.52, 0.10);

    this.dirLight = new DirectionalLight('dir', new Vector3(-0.5, -1.4, -0.5), this.scene);
    this.dirLight.intensity = 1.1;
    this.dirLight.position  = new Vector3(12, 20, 12);

    this.shadowGen = new ShadowGenerator(1024, this.dirLight);
    this.shadowGen.useBlurExponentialShadowMap = true;

    // Warm green bounce from below — grass reflection
    const fillLight = new HemisphericLight('fill', new Vector3(0, -1, 0), this.scene);
    fillLight.diffuse   = new Color3(0.20, 0.45, 0.10);
    fillLight.intensity = 0.15;
  }

  _setupGround() {
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
    this.tank = new Tank(this.scene, 0, 0);
    this.tank.addShadows(this.shadowGen);

    this._enemySpawns = [
      [  0.0, -25.5],
      [-21.9, -10.3],
      [ 19.2, -13.9],
      [-13.6,  16.7],
      [ 16.2,  14.7],
    ];
    this.enemies = this._enemySpawns.map(([x, z]) => {
      const e = new Enemy(this.scene, x, z);
      e.addShadows(this.shadowGen);
      return e;
    });

    this.aiEnemy = new AIEnemy(this.scene, 0, 42);
    this.aiEnemy.addShadows(this.shadowGen);


    // Pause / restart
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code !== 'Escape') return;
      if (window.__state !== 'GAME' && window.__state !== 'PAUSED') return;
      this._paused = !this._paused;
      window.__state = this._paused ? 'PAUSED' : 'GAME';
      document.getElementById('pause').style.display = this._paused ? 'flex' : 'none';
    });
    document.getElementById('pause-restart').addEventListener('click', () => {
      this._restart();
      this._paused = false;
      window.__state = 'GAME';
      document.getElementById('pause').style.display = 'none';
    });

    document.getElementById('death-restart').addEventListener('click', () => {
      this._restart();
      this._paused = false;
      window.__state = 'GAME';
      document.getElementById('death').style.display = 'none';
    });

    // Fetch model manifest then load — manifest provides node name overrides per model
    fetch('/models/manifest.json')
      .then(r => r.json())
      .catch(() => ({}))
      .then(manifest => {
        const modelFile = localStorage.getItem('selectedTank') || 'm26_pershing_war_thunder.glb';
        if (modelFile === 'primitive') {
          // Primitive Tank.js entity already has turretPivot/barrelPivot — nothing to load
          document.getElementById('controls-start').textContent = 'PRESS ENTER TO BATTLE';
          return;
        }
        this._loadPlayerGLB(modelFile, manifest[modelFile] ?? {});
      });
  }

  _loadPlayerGLB(modelFile = 't-55ak.glb', config = {}) {
    const rootName   = config.root        ?? 'Sketchfab_model';
    const turretName = config.turret      ?? 'turret';
    const mountName  = config.mount       ?? 'mount';
    const facingAxis = config.facingAxis  ?? '+X';

    // Map facing axis → Y rotation that aligns model toward game +Z forward
    const yRotMap = { '+Z': 0, '+X': -Math.PI / 2, '-Z': Math.PI, '-X': Math.PI / 2 };
    const yRot = yRotMap[facingAxis] ?? -Math.PI / 2;

    const startBtn = document.getElementById('controls-start');
    startBtn.textContent = 'LOADING…';
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '0.4';

    SceneLoader.ImportMeshAsync('', '/models/', modelFile, this.scene).then(result => {
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
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
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

      // --- 7a. Turret → turretPivot, then move pivot to actual turret ring ---
      if (turretNode) {
        turretNode.setParent(this.tank.turretPivot);
        // GLB node origins sit at the model's base plane (y≈0), so absolutePosition.y
        // is not useful for height. Only correct X and Z (the "too far forward" issue).
        const rootInv = Matrix.Invert(this.tank.root.getWorldMatrix());
        const localPos = Vector3.TransformCoordinates(turretAbsPos, rootInv);
        const pivotZShift = config.turretPivotZOffset ?? 0;
        this.tank.turretPivot.position.x = config.centerTurretX ? 0 : localPos.x;
        this.tank.turretPivot.position.z = localPos.z + pivotZShift;
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
    }).catch(e => {
      console.error(`[GLB] ${modelFile} load failed:`, e);
      startBtn.textContent = 'PRESS ENTER TO BATTLE';
      startBtn.style.pointerEvents = '';
      startBtn.style.opacity = '';
    });
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
    const candidates = [...this.enemies, this.aiEnemy];
    for (const enemy of candidates) {
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
      if (overlapX <= 0 || overlapZ <= 0) continue;
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

      // Pass lock target to tank — use predicted position for moving targets
      if (this.lockedEnemy) {
        this.tank.lockTarget = this._predictTargetPos(this.lockedEnemy);
      } else {
        this.tank.lockTarget = null;
      }

      this.tank.update(dt);

      for (const enemy of this.enemies) {
        enemy.update(dt);
      }
      this.aiEnemy.update(dt, this.tank.position);
      for (const s of this.aiEnemy.shells) s.update(dt);

      // Barrel elevation disabled for flat-shot mode — re-enable with _elevationForHeight when arc shots return
      this.tank.barrelElevation = 0;

      // Barrel recoil: kick back on fire, spring back to rest over 0.22s (no overshoot)
      if (this.tank._recoil > 0) {
        this.tank._recoil = Math.max(0, this.tank._recoil - dt / 0.22);
        const kick = -0.30 * this.tank._recoil;
        this.tank.barrelPivot.position.z = this._barrelPivotBaseZ + kick;
      }

      this._updateLavaTex();
      this._lavaGlow.intensity = 0.5 + Math.sin(performance.now() / 600) * 0.35;
      this._checkHazards(dt);
      this._checkCollisions();
      this._checkObstacleCollisions();
      this._fireCooldown = Math.max(0, this._fireCooldown - dt);
      for (const shell of this.shells) shell.update(dt);
      this._checkShellHits();
      this._updateVFX(dt);
      this._updateLockRing(dt);
      this._updateAimIndicator();
      this._updateCamera(dt);
      this._updateHUD();
    });
  }

  _updateLockRing(dt) {
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
    document.getElementById('death').style.display = 'flex';
  }

  _restart() {
    for (let i = 0; i < this.enemies.length; i++) {
      const [x, z] = this._enemySpawns[i];
      this.enemies[i].reset(x, z);
    }
    this.aiEnemy.reset(0, 42);
    this.tank.reset();
    this.lockedEnemy      = null;
    this._prevLockedEnemy = null;
    this.lockRing.isVisible  = false;
    this.fadeRing.isVisible  = false;
    this._aimEl.style.display = 'none';
  }

  _checkCollisions() {
    const t = this.tank;

    for (const enemy of [...this.enemies, this.aiEnemy]) {
      if (!enemy.alive) continue;
      const dx = t.position.x - enemy.position.x;
      const dz = t.position.z - enemy.position.z;

      const overlapX = (t.halfW + enemy.halfW) - Math.abs(dx);
      const overlapZ = (t.halfD + enemy.halfD) - Math.abs(dz);

      if (overlapX <= 0 || overlapZ <= 0) continue;

      const impactSpeed = Math.abs(t.speed);

      if (impactSpeed < enemy.staticFrictionThreshold) {
        t.speed *= 0.4;
        this._separate(t, enemy, dx, dz, overlapX, overlapZ, 0.5);
        continue;
      }

      const alreadyBroken = enemy.staticFrictionThreshold === 0;
      enemy.staticFrictionThreshold = 0;
      t.speed *= 0.2;

      const pushMult = alreadyBroken ? 3.5 : 2.2;
      const pushSpd  = impactSpeed * (t.mass / enemy.mass) * pushMult;
      const fwd      = new Vector3(Math.sin(t.rotY), 0, Math.cos(t.rotY));
      enemy.vx = fwd.x * pushSpd;
      enemy.vz = fwd.z * pushSpd;

      this._separate(t, enemy, dx, dz, overlapX, overlapZ, 0.7);
      this._triggerShake(0.11, 0.4);
    }
  }

  _separate(tank, enemy, dx, dz, overlapX, overlapZ, ratio) {
    if (overlapX < overlapZ) {
      const sep = overlapX * Math.sign(dx);
      tank.root.position.x  +=  sep * ratio;
      enemy.root.position.x -= sep * (1 - ratio);
    } else {
      const sep = overlapZ * Math.sign(dz);
      tank.root.position.z  +=  sep * ratio;
      enemy.root.position.z -= sep * (1 - ratio);
    }
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

  _updateHUD() {
    const fuelRatio = this.tank.fuel / this.tank.maxFuel;
    const fill = document.getElementById('hud-fill');
    if (fill) {
      fill.style.width      = `${Math.max(1, fuelRatio * 100)}%`;
      fill.style.background = fuelRatio < 0.3 ? '#ff4444' : '#44aaff';
    }

    const hpRatio = this.tank.hp / this.tank.maxHp;
    const hpFill  = document.getElementById('hud-hp-fill');
    if (hpFill) {
      hpFill.style.width      = `${Math.max(1, hpRatio * 100)}%`;
      const r = hpRatio < 0.5 ? 1.0 : 2 * (1 - hpRatio);
      const g = hpRatio > 0.5 ? 1.0 : 2 * hpRatio;
      hpFill.style.background = `rgb(${Math.round(r*220)},${Math.round(g*220)},40)`;
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
    this._spawnMuzzleFlash(tip);
    this._triggerShake(0.06, 0.2);
    this._fireCooldown = 0.3;
    this.tank._recoil = 1.0;
  }


  _setupVFX() {
    this._activeVFX = [];

    // Muzzle flash — 1 sphere
    const flashMat = new StandardMaterial('muzzleFlashMat', this.scene);
    flashMat.diffuseColor    = new Color3(1.0, 0.85, 0.1);
    flashMat.emissiveColor   = new Color3(1.0, 0.9, 0.2);
    flashMat.disableLighting = true;
    this._muzzleFlashMesh = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 1.0, segments: 5 }, this.scene);
    this._muzzleFlashMesh.material   = flashMat;
    this._muzzleFlashMesh.isVisible  = false;
    this._muzzleFlashMesh.isPickable = false;
    this._muzzleFlashMesh._vfxActive = false;

    // --- Tank impact pools (4 slots) ---
    this._tankCores = [];
    for (let i = 0; i < 4; i++) {
      const mat = new StandardMaterial(`tankCoreMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 0.85, 0.3);
      mat.emissiveColor   = new Color3(1.0, 0.75, 0.1);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankCore_${i}`, { diameter: 1.0, segments: 6 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankCores.push(mesh);
    }

    this._tankFireBlobs = [];
    for (let i = 0; i < 16; i++) {
      const mat = new StandardMaterial(`tankFireMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 0.45, 0.05);
      mat.emissiveColor   = new Color3(0.9, 0.30, 0.0);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankFire_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankFireBlobs.push(mesh);
    }

    this._tankSmokes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new StandardMaterial(`tankSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.25, 0.22, 0.20);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`tankSmoke_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._tankSmokes.push(mesh);
    }

    // --- Normal impact pools (4 slots: 1 flash + 7 sparks + 2 smokes each) ---
    this._normalFlashes = [];
    for (let i = 0; i < 4; i++) {
      const mat = new StandardMaterial(`normalFlashMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 1.0, 1.0);
      mat.emissiveColor   = new Color3(0.9, 0.95, 1.0);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalFlash_${i}`, { diameter: 1.0, segments: 5 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalFlashes.push(mesh);
    }

    // 4 slots × 7 sparks = 28 updatable line meshes
    this._normalSparks = [];
    for (let i = 0; i < 28; i++) {
      const line = MeshBuilder.CreateLines(`normalSpark_${i}`, {
        points: [Vector3.Zero(), new Vector3(0, 0.01, 0)],
        colors: [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)],
        updatable: true,
      }, this.scene);
      line.isVisible  = false;
      line.isPickable = false;
      line._vfxActive = false;
      this._normalSparks.push(line);
    }

    // Pre-allocated Vector3/Color4 arrays for spark line updates (avoids GC)
    this._sparkPts = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [Vector3.Zero(), Vector3.Zero()])
    );
    this._sparkCols = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)])
    );

    this._normalSmokes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new StandardMaterial(`normalSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.82, 0.82, 0.85);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalSmoke_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalSmokes.push(mesh);
    }

    // Blast ring disc — expands flat and fades (pressure shockwave)
    const discMat = new StandardMaterial('muzzleDiscMat', this.scene);
    discMat.diffuseColor    = new Color3(1.0, 0.90, 0.5);
    discMat.emissiveColor   = new Color3(1.0, 0.85, 0.3);
    discMat.disableLighting = true;
    discMat.backFaceCulling = false;
    this._muzzleDisc = MeshBuilder.CreateDisc('muzzleDisc', { radius: 0.5, tessellation: 16 }, this.scene);
    this._muzzleDisc.rotation.x   = Math.PI / 2; // lay flat
    this._muzzleDisc.material     = discMat;
    this._muzzleDisc.isVisible    = false;
    this._muzzleDisc.isPickable   = false;
    this._muzzleDisc._vfxActive   = false;

    // Muzzle smoke — 2 spheres that rise and fade after the flash
    this._muzzleSmokes = [];
    for (let i = 0; i < 2; i++) {
      const mat = new StandardMaterial(`muzzleSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.85, 0.82, 0.78);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`muzzleSmoke_${i}`, { diameter: 1.0, segments: 5 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._muzzleSmokes.push(mesh);
    }
  }

  _spawnMuzzleFlash(pos) {
    // Layer 1: bright core sphere
    const flash = this._muzzleFlashMesh;
    if (!flash._vfxActive) {
      flash._vfxActive = true;
      flash.isVisible  = true;
      flash.position.copyFrom(pos);
      flash.scaling.setAll(0.4);
      flash.material.alpha         = 1.0;
      flash.material.diffuseColor  = new Color3(1.0, 0.97, 0.85);
      flash.material.emissiveColor = new Color3(1.0, 0.95, 0.7);
      this._activeVFX.push({ type: 'muzzleFlash', mesh: flash, t: 0, duration: 0.12 });
    }

    // Layer 2: expanding blast ring
    const disc = this._muzzleDisc;
    if (!disc._vfxActive) {
      disc._vfxActive = true;
      disc.isVisible  = true;
      disc.position.copyFrom(pos);
      disc.scaling.setAll(0.2);
      disc.material.alpha = 0.75;
      this._activeVFX.push({ type: 'muzzleDisc', mesh: disc, t: 0, duration: 0.10 });
    }

    // Layer 3: two smoke puffs that rise after the flash
    for (let i = 0; i < 2; i++) {
      const smoke = this._muzzleSmokes[i];
      if (!smoke._vfxActive) {
        smoke._vfxActive = true;
        smoke.isVisible  = true;
        smoke.position.set(pos.x + (i === 0 ? 0.1 : -0.1), pos.y, pos.z + (i === 0 ? 0.1 : -0.1));
        smoke.scaling.setAll(0.3);
        smoke.material.alpha = 0.0;
        this._activeVFX.push({
          type: 'muzzleSmoke', mesh: smoke, t: 0, duration: 0.55,
          ox: smoke.position.x, oy: smoke.position.y, oz: smoke.position.z,
        });
      }
    }
  }

  _spawnNormalImpact(pos) {
    let slot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._normalFlashes[i]._vfxActive) { slot = i; break; }
    }
    if (slot === -1) return;

    const oy    = Math.max(0.3, pos.y);
    const flash = this._normalFlashes[slot];
    flash._vfxActive = true;
    flash.isVisible  = true;
    flash.position.set(pos.x, oy, pos.z);
    flash.scaling.setAll(0.5);
    flash.material.alpha = 1.0;

    const sparks = [];
    for (let s = 0; s < 7; s++) {
      const mesh = this._normalSparks[slot * 7 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      sparks.push(mesh);
    }

    const smokes = [];
    for (let s = 0; s < 2; s++) {
      const mesh = this._normalSmokes[slot * 2 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x + (s === 0 ? 0.12 : -0.12), oy, pos.z + (s === 0 ? 0.08 : -0.08));
      mesh.scaling.setAll(0.3);
      mesh.material.alpha = 0.0;
      smokes.push(mesh);
    }

    this._activeVFX.push({
      type: 'normalImpact', slot, flash, sparks, smokes,
      t: 0, duration: 0.75, ox: pos.x, oy, oz: pos.z,
    });
  }

  _spawnTankImpact(pos, isCritical = false) {
    if (!isCritical) {
      this._spawnNormalImpact(pos);
      return;
    }

    let slot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._tankCores[i]._vfxActive) { slot = i; break; }
    }
    if (slot === -1) return;

    const oy   = Math.max(0.3, pos.y);
    const core = this._tankCores[slot];
    core._vfxActive = true;
    core.isVisible  = true;
    core.position.set(pos.x, oy, pos.z);
    core.scaling.setAll(0.8);
    core.material.alpha = 1.0;

    const fireBlobs = [];
    for (let b = 0; b < 4; b++) {
      const mesh = this._tankFireBlobs[slot * 4 + b];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x, oy, pos.z);
      mesh.scaling.setAll(0.1);
      mesh.material.alpha = 1.0;
      fireBlobs.push(mesh);
    }

    const smokeBlobs = [];
    for (let s = 0; s < 2; s++) {
      const mesh = this._tankSmokes[slot * 2 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x + (s === 0 ? 0.15 : -0.15), oy, pos.z + (s === 0 ? 0.1 : -0.1));
      mesh.scaling.setAll(0.4);
      mesh.material.alpha = 0.0;
      smokeBlobs.push(mesh);
    }

    // Find a free spark slot (independent from the fireball slot)
    let sparkSlot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._normalSparks[i * 7]._vfxActive) { sparkSlot = i; break; }
    }
    const sparks = [];
    if (sparkSlot !== -1) {
      for (let s = 0; s < 7; s++) {
        const mesh = this._normalSparks[sparkSlot * 7 + s];
        mesh._vfxActive = true;
        mesh.isVisible  = true;
        sparks.push(mesh);
      }
    }

    this._activeVFX.push({
      type: 'tankImpact', slot, core, fireBlobs, smokeBlobs, sparks, sparkSlot,
      t: 0, duration: 0.65, ox: pos.x, oy, oz: pos.z,
    });
  }

  _updateVFX(dt) {
    for (let i = this._activeVFX.length - 1; i >= 0; i--) {
      const entry = this._activeVFX[i];
      entry.t += dt;

      if (entry.t >= entry.duration) {
        if (entry.type === 'tankImpact') {
          entry.core.isVisible  = false; entry.core._vfxActive = false;
          for (const b of entry.fireBlobs)  { b.isVisible = false; b._vfxActive = false; }
          for (const b of entry.smokeBlobs) { b.isVisible = false; b._vfxActive = false; }
          for (const s of entry.sparks)     { s.isVisible = false; s._vfxActive = false; }
        } else if (entry.type === 'normalImpact') {
          entry.flash.isVisible  = false; entry.flash._vfxActive = false;
          for (const s of entry.sparks) { s.isVisible = false; s._vfxActive = false; }
          for (const s of entry.smokes) { s.isVisible = false; s._vfxActive = false; }
        } else {
          entry.mesh.isVisible  = false;
          entry.mesh._vfxActive = false;
        }
        this._activeVFX.splice(i, 1);
        continue;
      }

      const p = entry.t / entry.duration;

      if (entry.type === 'muzzleFlash') {
        if (p < 0.4) {
          const phase = p / 0.4;
          entry.mesh.scaling.setAll(0.4 + phase * 0.8);  // 0.4 → 1.2
          entry.mesh.material.alpha = 1.0;
        } else {
          const phase = (p - 0.4) / 0.6;
          entry.mesh.scaling.setAll(1.2 + phase * 0.3);  // 1.2 → 1.5
          entry.mesh.material.alpha = 1.0 - phase;
        }
      } else if (entry.type === 'muzzleDisc') {
        entry.mesh.scaling.setAll(0.2 + p * 2.3);     // 0.2 → 2.5
        entry.mesh.material.alpha = 0.75 * (1 - p);   // fade to 0
      } else if (entry.type === 'muzzleSmoke') {
        const delay = 0.08;
        if (entry.t < delay) {
          entry.mesh.material.alpha = 0;
        } else {
          const sp    = (entry.t - delay) / (entry.duration - delay);
          const eased = 1 - (1 - sp) * (1 - sp);
          entry.mesh.position.y = entry.oy + eased * 0.8;
          entry.mesh.scaling.setAll(0.3 + eased * 0.8);
          entry.mesh.material.alpha = sp < 0.5
            ? sp * 1.4
            : 0.7 * (1 - (sp - 0.5) / 0.5);
        }
      } else if (entry.type === 'tankImpact') {
        const eased      = 1 - (1 - p) * (1 - p);
        const maxCore   = 2.4;
        const maxRadius = 2.8;
        const maxLift   = 1.2;
        const maxFire   = 1.2;

        // Core: bright fireball, fades by 46%
        if (p < 0.46) {
          const cp = p / 0.46;
          entry.core.scaling.setAll(0.8 + eased * (maxCore - 0.8));
          entry.core.material.alpha = 1.0 - cp;
        } else {
          entry.core.isVisible = false;
        }

        // Fire blobs: scatter out and fade by 55%
        for (let b = 0; b < 4; b++) {
          const angle = b * Math.PI * 0.55;
          entry.fireBlobs[b].position.set(
            entry.ox + Math.sin(angle) * eased * maxRadius,
            entry.oy + eased * maxLift,
            entry.oz + Math.cos(angle) * eased * maxRadius,
          );
          entry.fireBlobs[b].scaling.setAll(eased * maxFire);
          if (p < 0.55) {
            entry.fireBlobs[b].isVisible    = true;
            entry.fireBlobs[b].material.alpha = p < 0.35 ? 1.0 : 1.0 - (p - 0.35) / 0.20;
          } else {
            entry.fireBlobs[b].isVisible = false;
          }
        }

        // Smoke: delayed, rises slowly, lingers until end
        const smokeDelay = 0.20;
        for (let s = 0; s < 2; s++) {
          if (entry.t < smokeDelay) {
            entry.smokeBlobs[s].material.alpha = 0;
          } else {
            const sp    = (entry.t - smokeDelay) / (entry.duration - smokeDelay);
            const seased = 1 - (1 - sp) * (1 - sp);
            entry.smokeBlobs[s].position.y = entry.oy + seased * 1.5;
            entry.smokeBlobs[s].scaling.setAll(0.4 + seased * 1.0);
            entry.smokeBlobs[s].material.alpha = sp < 0.4
              ? sp * 1.5
              : 0.6 * (1 - (sp - 0.4) / 0.6);
          }
        }

        // Arc sparks (same physics as normalImpact)
        if (entry.sparkSlot !== -1) {
          const st = entry.t;
          for (let s = 0; s < 7; s++) {
            const vel  = NORMAL_SPARK_VELS[s];
            const mesh = entry.sparks[s];
            const pts  = this._sparkPts[entry.sparkSlot][s];
            const cols = this._sparkCols[entry.sparkSlot][s];
            const tt   = Math.max(0, st - NORMAL_SPARK_TRAIL);

            pts[1].set(
              entry.ox + vel.vx * st,
              entry.oy + vel.vy * st - 0.5 * NORMAL_SPARK_GRAVITY * st * st,
              entry.oz + vel.vz * st,
            );
            pts[0].set(
              entry.ox + vel.vx * tt,
              entry.oy + vel.vy * tt - 0.5 * NORMAL_SPARK_GRAVITY * tt * tt,
              entry.oz + vel.vz * tt,
            );

            const sparkFade = Math.max(0, 1 - p / 0.75);
            cols[0].set(1, 1, 1, sparkFade * 0.4);
            cols[1].set(1, 0.9, 0.3, sparkFade);

            if (sparkFade > 0 && pts[1].y > -1) {
              mesh.isVisible = true;
              MeshBuilder.CreateLines(`normalSpark_${entry.sparkSlot * 7 + s}`, {
                points: pts, colors: cols, instance: mesh,
              });
            } else {
              mesh.isVisible = false;
            }
          }
        }
      } else if (entry.type === 'normalImpact') {
        const eased = 1 - (1 - p) * (1 - p);

        // Flash: scale up fast, fade out fully by p=0.5
        const ff = Math.max(0, 1 - p / 0.5);
        entry.flash.scaling.setAll(0.5 + eased * 1.5);  // 0.5 → 2.0
        entry.flash.material.alpha = ff;
        if (ff <= 0) entry.flash.isVisible = false;

        // Sparks: arc physics + trail line update
        const st = entry.t;
        for (let s = 0; s < 7; s++) {
          const vel  = NORMAL_SPARK_VELS[s];
          const mesh = entry.sparks[s];
          const pts  = this._sparkPts[entry.slot][s];
          const cols = this._sparkCols[entry.slot][s];

          const tt = Math.max(0, st - NORMAL_SPARK_TRAIL);

          // Head position at current time
          pts[1].set(
            entry.ox + vel.vx * st,
            entry.oy + vel.vy * st - 0.5 * NORMAL_SPARK_GRAVITY * st * st,
            entry.oz + vel.vz * st,
          );
          // Tail position at (t - trail)
          pts[0].set(
            entry.ox + vel.vx * tt,
            entry.oy + vel.vy * tt - 0.5 * NORMAL_SPARK_GRAVITY * tt * tt,
            entry.oz + vel.vz * tt,
          );

          const sparkFade = Math.max(0, 1 - p / 0.75);
          cols[0].set(1, 1, 1, sparkFade * 0.4);          // tail: white, dim
          cols[1].set(1, 0.9, 0.3, sparkFade);             // head: yellow, bright

          if (sparkFade > 0 && pts[1].y > -1) {
            mesh.isVisible = true;
            MeshBuilder.CreateLines(`normalSpark_${entry.slot * 7 + s}`, {
              points: pts,
              colors: cols,
              instance: mesh,
            });
          } else {
            mesh.isVisible = false;
          }
        }

        // Smoke: same pattern as tankImpact smokes
        const smokeDelay = 0.18;
        for (let s = 0; s < 2; s++) {
          if (entry.t < smokeDelay) {
            entry.smokes[s].material.alpha = 0;
          } else {
            const sp     = (entry.t - smokeDelay) / (entry.duration - smokeDelay);
            const seased = 1 - (1 - sp) * (1 - sp);
            entry.smokes[s].position.y = entry.oy + seased * 1.2;
            entry.smokes[s].scaling.setAll(0.3 + seased * 0.9);
            entry.smokes[s].material.alpha = sp < 0.4
              ? sp * 1.2
              : 0.48 * (1 - (sp - 0.4) / 0.6);
          }
        }
      }
    }
  }

  _checkShellHits() {
    // AI shells hitting the player
    for (const shell of this.aiEnemy.shells) {
      if (!shell.active) continue;
      if (shell.position.y < 0 || shell.position.y > 1.6) continue;
      const dx = shell.position.x - this.tank.position.x;
      const dz = shell.position.z - this.tank.position.z;
      if (Math.abs(dx) < 0.25 + this.tank.halfW && Math.abs(dz) < 0.25 + this.tank.halfD) {
        shell.deactivate();
        this.tank.takeDamage(34);
        this._triggerShake(0.18, 0.55);
        if (!this.tank.alive) this._showDeath();
        break;
      }
    }

    const allTargets = [...this.enemies, this.aiEnemy];

    for (const shell of this.shells) {
      if (!shell.active) continue;

      for (const enemy of allTargets) {
        if (!enemy.alive) continue;
        const dx = shell.position.x - enemy.position.x;
        const dz = shell.position.z - enemy.position.z;
        if (Math.abs(dx) < enemy.halfW && Math.abs(dz) < enemy.halfD) {
          const speed      = Math.hypot(shell.vx, shell.vz);
          const perpDist   = speed > 0 ? Math.abs(dx * shell.vz - dz * shell.vx) / speed : 999;
          const isCritical = perpDist < 0.4;
          const damage     = isCritical ? 51 : 34;
          this._spawnTankImpact(shell.position.clone(), isCritical);
          shell.deactivate();
          enemy.takeDamage(damage);
          this._triggerShake(isCritical ? 0.12 : 0.06, isCritical ? 0.4 : 0.15);
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
