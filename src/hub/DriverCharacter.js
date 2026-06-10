import {
  MeshBuilder, ArcRotateCamera, SceneLoader, Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const SPEED = 5; // units/sec
const MODEL_DIR = '/assets/models/characters/';

// Kenney "Mini Characters" (CC0). Each character GLB is rigged on an identical
// rig (root/legs/torso/arms/head — SAME bone order across all 12, so meshes can
// be grafted between them with no skin-index remap) and ships NATIVE baked anims
// (idle/walk/…). Each char = two skinned meshes: `body-mesh` (torso+limbs+outfit)
// and `head-mesh` (head+hair+face). Accessories are static meshes attached to the
// head bone. So: pick a body, graft any character's head onto it, add an accessory.
export const DRIVER_CHARACTERS = [
  'character-male-a', 'character-male-b', 'character-male-c',
  'character-male-d', 'character-male-e', 'character-male-f',
  'character-female-a', 'character-female-b', 'character-female-c',
  'character-female-d', 'character-female-e', 'character-female-f',
  'char-calib',    // Batch C0 calibration dummy (original) — remove after C1 ships
  'char-driver-a', // Batch C1 — first ORIGINAL character (CHARACTER_MODEL_SPEC)
];
export const DRIVER_ACCESSORIES = ['none', 'aid-glasses', 'aid-sunglasses', 'aid-mask'];

export const DRIVER_OPTIONS = {
  head: DRIVER_CHARACTERS, body: DRIVER_CHARACTERS, accessory: DRIVER_ACCESSORIES,
};
export const DRIVER_DEFAULT = {
  head: 'character-male-a', body: 'character-male-a', accessory: 'none',
};

// Model is ~0.67u tall in bind pose → scale to fill the 1.8u capsule.
const MODEL_SCALE = 2.5;
const MODEL_YAW   = 0;   // loaded model faces game +Z (forward = movement dir)
const TURN_SPEED  = 14;  // rad/sec — body eases toward the (8-dir) heading

export default class DriverCharacter {
  constructor(scene) {
    this.scene = scene;

    // Invisible collision capsule — the thing that moves; the model parents to it.
    this.mesh = MeshBuilder.CreateCapsule('driver', { radius: 0.3, height: 1.8 }, scene);
    this.mesh.position        = new Vector3(0, 0.9, -6);
    this.mesh.isVisible       = false;
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid       = new Vector3(0.3, 0.9, 0.3);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.9, 0);

    this.modelRoot = MeshBuilder.CreateBox('driver-modelRoot', { size: 0.001 }, scene);
    this.modelRoot.isVisible = false;
    this.modelRoot.parent    = this.mesh;
    this.modelRoot.position.set(0, -0.9, 0);
    this.modelRoot.scaling.setAll(MODEL_SCALE);
    this.modelRoot.rotation.y = MODEL_YAW;

    this.camera = new ArcRotateCamera('driver-cam', -Math.PI / 2, 0.62, 24, this.mesh.position.clone(), scene);
    this.camera.lowerRadiusLimit = 24;
    this.camera.upperRadiusLimit = 24;
    scene.activeCamera = this.camera;

    this._keys      = {};
    this._vy        = 0;
    this._targetYaw = 0;
    this._onKeyDown = (e) => { this._keys[e.code] = true; };
    this._onKeyUp   = (e) => { this._keys[e.code] = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);

    this._base         = null;   // { root, bodyMesh, headMesh(native), skeleton, charId }
    this._swappedHead  = null;   // foreign head grafted on (null = native head)
    this._headBone     = null;
    this._accessoryRoot = null;
    this._animGroups   = [];
    this._animState    = null;
    this._applyChain   = Promise.resolve();
    this._visible      = true;

    this._config = { ...DRIVER_DEFAULT };
    this.ready = this._applyConfigNow(this._config, true);
  }

  // ── model loading ───────────────────────────────────────────────────────────
  async _loadBase(bodyId) {
    const res = await SceneLoader.ImportMeshAsync('', MODEL_DIR, `${bodyId}.glb`, this.scene);
    this._disposeBase();

    const root = res.meshes[0]; // glTF __root__
    root.parent = this.modelRoot;
    const bodyMesh = res.meshes.find(m => /body-mesh/i.test(m.name)) ?? null;
    const headMesh = res.meshes.find(m => /head-mesh/i.test(m.name)) ?? null;
    const skeleton = res.skeletons[0] ?? null;

    this._animGroups = res.animationGroups ?? [];
    this._animGroups.forEach(g => g.stop());     // Kenney auto-plays clip 0; stop it
    this._animState = null;

    this._base     = { root, bodyMesh, headMesh, skeleton, charId: bodyId };
    this._headBone = skeleton?.bones.find(b => /(^|[^a-z])head/i.test(b.name)) ?? null;

    this._playAnim('idle');
    if (!this._visible) root.setEnabled(false);
  }

  // Graft the chosen character's head onto the base skeleton (or use the native one).
  // Kenney rigs share bone order, so a plain `skeleton =` rebind works (no remap).
  async _setHead(headId) {
    if (this._swappedHead) { this._swappedHead.dispose(false, true); this._swappedHead = null; }
    if (!this._base) return;

    if (headId === this._base.charId) {        // native head
      this._base.headMesh?.setEnabled(true);
      return;
    }
    this._base.headMesh?.setEnabled(false);
    const res = await SceneLoader.ImportMeshAsync('', MODEL_DIR, `${headId}.glb`, this.scene);
    const newHead = res.meshes.find(m => /head-mesh/i.test(m.name));
    if (newHead) {
      newHead.parent   = this._base.root;
      newHead.skeleton = this._base.skeleton;
      newHead.setEnabled(this._visible);
      this._swappedHead = newHead;
    }
    res.skeletons.forEach(s => s.dispose());
    res.animationGroups.forEach(g => g.dispose());
    res.meshes[0].dispose(false, false);       // __root__ + leftover body-mesh; keep shared material
  }

  async _setAccessory(name) {
    if (this._accessoryRoot) { this._accessoryRoot.dispose(false, true); this._accessoryRoot = null; }
    if (!name || name === 'none') return;
    const res = await SceneLoader.ImportMeshAsync('', MODEL_DIR, `${name}.glb`, this.scene);
    const root = res.meshes[0];
    this._accessoryRoot = root;
    if (this._headBone && this._base?.bodyMesh) {
      root.attachToBone(this._headBone, this._base.bodyMesh);
    } else {
      root.parent = this.modelRoot;
    }
    root.setEnabled(this._visible);
  }

  _playAnim(clip, loop = true) {
    if (this._animState === clip) return;
    const g = this._animGroups.find(a => a.name === clip);
    if (!g) return;
    this._animGroups.forEach(a => { if (a !== g) a.stop(); });
    g.start(loop, 1.0, g.from, g.to);
    this._animState = clip;
  }

  _disposeBase() {
    if (this._swappedHead) { this._swappedHead.dispose(false, true); this._swappedHead = null; }
    this._animGroups.forEach(g => g.dispose());
    this._animGroups = [];
    if (this._base) {
      this._base.skeleton?.dispose();
      this._base.root?.dispose(false, true);
      this._base = null;
    }
    this._headBone  = null;
    this._animState = null;
  }

  // ── customization ────────────────────────────────────────────────────────────
  applyConfig(partial = {}) {
    this._applyChain = this._applyChain
      .then(() => this._applyConfigNow(partial))
      .catch(err => console.error('[DriverCharacter] applyConfig failed:', err));
    return this._applyChain;
  }

  async _applyConfigNow(partial, initial = false) {
    const prev    = this._config;
    const next    = { ...prev, ...partial };
    const changed = k => initial || next[k] !== prev[k];
    this._config  = next;

    if (changed('body'))                       await this._loadBase(next.body);
    if (changed('body') || changed('head'))    await this._setHead(next.head);
    if (changed('body') || changed('accessory')) await this._setAccessory(next.accessory);
    return { ...this._config };
  }

  getConfig() { return { ...this._config }; }

  // ── per-frame ────────────────────────────────────────────────────────────────
  update(dt) {
    const fwd   = this._keys['KeyW'] || this._keys['ArrowUp'];
    const back  = this._keys['KeyS'] || this._keys['ArrowDown'];
    const left  = this._keys['KeyA'] || this._keys['ArrowLeft'];
    const right = this._keys['KeyD'] || this._keys['ArrowRight'];

    let dx = 0, dz = 0;
    if (fwd)   dz += 1;
    if (back)  dz -= 1;
    if (left)  dx -= 1;
    if (right) dx += 1;

    this._vy -= 9.8 * dt;
    this.mesh.moveWithCollisions(new Vector3(dx * SPEED * dt, this._vy * dt, dz * SPEED * dt));
    if (this.mesh.position.y <= 0.9 + 0.01) { this._vy = 0; this.mesh.position.y = 0.9; }

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      this._targetYaw = Math.atan2(dx / len, dz / len);
      this._playAnim('walk');
    } else {
      this._targetYaw = this.mesh.rotation.y;
      this._playAnim('idle');
    }

    let diff = this._targetYaw - this.mesh.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const step = TURN_SPEED * dt;
    this.mesh.rotation.y += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
  }

  get position() { return this.mesh.position; }

  hide() { this._visible = false; this.modelRoot.setEnabled(false); }
  show() { this._visible = true;  this.modelRoot.setEnabled(true); }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
    if (this._accessoryRoot) this._accessoryRoot.dispose(false, true);
    this._disposeBase();
    this.modelRoot.dispose();
    this.mesh.dispose();
    this.camera.dispose();
  }
}
