import {
  MeshBuilder, ArcRotateCamera, SceneLoader, Vector3, Color3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const SPEED       = 7;   // units/sec — walk (was 5; bumped between old walk and the dropped sprint)
const CAM_RADIUS  = 20;  // fixed follow-cam distance (locked zoom); was 24
const MODEL_DIR = '/assets/models/characters/';

// Native characters (CHARACTER_MODEL_SPEC). Each character GLB is rigged on the
// shared rig (root/legs/torso/arms/head — SAME bone order, so meshes graft
// between characters with no skin-index remap) and ships baked anims (idle/walk/…).
// Each char = two skinned meshes: `body-mesh` (torso+limbs+outfit) and `head-mesh`
// (head+hair+face). Wardrobe pieces are static meshes attached to a bone. So: pick
// a body, graft a character's head onto it, add wardrobe. The Kenney "Mini
// Characters" CC0 set was the build reference only — purged once natives landed.
export const DRIVER_CHARACTERS = [
  'char-calib',    // Batch C0 calibration dummy
  'char-driver-a', // Batch C1 — first ORIGINAL character (CHARACTER_MODEL_SPEC)
];
// Legacy Kenney aid-* face accessories were purged; the `face` wardrobe slot
// (glasses/shades/beard/stache) replaces them.
export const DRIVER_ACCESSORIES = ['none'];

// Wardrobe attachment slots (CHARACTER_MODEL_SPEC customization section).
// Each is a static GLB attached to a bone; pieces authored at the bone origin
// (Blender Z=up, -Y=front — calibrated 2026-06-11, markers landed 1:1).
export const ATTACH_SLOTS = {
  hair:     { boneRe: /(^|[^a-z])head/i },
  headwear: { boneRe: /(^|[^a-z])head/i },
  face:     { boneRe: /(^|[^a-z])head/i },   // eyewear (glasses / shades)
  // Facial hair is its own head-bone slot so a beard/stache can be worn together
  // with eyewear (e.g. shades + beard).
  facialhair: { boneRe: /(^|[^a-z])head/i },
  back:     { boneRe: /torso/i },
  // Bedroll is a satchel add-on, not a standalone back piece — it rides the same
  // torso bone alongside the satchel and only renders when the satchel is equipped
  // (coupling enforced in _applyConfigNow). See normalizeDriverConfig for migration.
  bedroll:  { boneRe: /torso/i },
};
const WARDROBE_DIR = MODEL_DIR + 'wardrobe/';
// Legacy Kenney accessories live in the characters/ root, wardrobe pieces in wardrobe/.
const attachmentDir = id => (id.startsWith('aid-') ? MODEL_DIR : WARDROBE_DIR);

export const DRIVER_OPTIONS = {
  head: DRIVER_CHARACTERS, body: DRIVER_CHARACTERS, accessory: DRIVER_ACCESSORIES,
};
export const DRIVER_DEFAULT = {
  head: 'char-driver-a', body: 'char-driver-a',
  hair: 'none', headwear: 'none', face: 'none', facialhair: 'none', back: 'none', bedroll: 'none',
  skin: '#eebb94',   // tints the skinMat material (skin verts authored white)
};

// The only back piece the bedroll add-on pairs with.
export const BEDROLL_HOST = 'back-satchel';

// Wardrobe slots that live on the head — used to classify a picked mesh into a
// customization region (head vs body) for the click-to-section panel nav.
const HEAD_SLOTS = ['hair', 'headwear', 'face', 'facialhair'];

// Stale/legacy config guard: maps the old `accessory` key to the `face` slot and
// fills missing slots — old localStorage saves keep working.
export function normalizeDriverConfig(cfg) {
  const c = { ...DRIVER_DEFAULT, ...(cfg ?? {}) };
  if (cfg?.accessory && (!cfg.face || cfg.face === 'none')) c.face = cfg.accessory;
  delete c.accessory;
  // Legacy: bedroll used to be a standalone back piece. Migrate old saves to the
  // satchel + bedroll pairing so the bedroll never appears on its own.
  if (c.back === 'back-bedroll') { c.back = BEDROLL_HOST; c.bedroll = 'back-bedroll'; }
  // Coupling: the bedroll only exists as a satchel add-on.
  if (c.back !== BEDROLL_HOST) c.bedroll = 'none';
  return c;
}

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
    this.mesh.isPickable      = false;   // picks pass through to the actual body/head meshes
    this.mesh.checkCollisions = true;
    this.mesh.ellipsoid       = new Vector3(0.3, 0.9, 0.3);
    this.mesh.ellipsoidOffset = new Vector3(0, 0.9, 0);

    this.modelRoot = MeshBuilder.CreateBox('driver-modelRoot', { size: 0.001 }, scene);
    this.modelRoot.isVisible = false;
    this.modelRoot.isPickable = false;
    this.modelRoot.parent    = this.mesh;
    this.modelRoot.position.set(0, -0.9, 0);
    this.modelRoot.scaling.setAll(MODEL_SCALE);
    this.modelRoot.rotation.y = MODEL_YAW;

    this.camera = new ArcRotateCamera('driver-cam', -Math.PI / 2, 0.62, CAM_RADIUS, this.mesh.position.clone(), scene);
    this.camera.lowerRadiusLimit = CAM_RADIUS;
    this.camera.upperRadiusLimit = CAM_RADIUS;
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
    this._slotBones    = {};     // slot -> bone (resolved per ATTACH_SLOTS on base load)
    this._attachRoots  = {};     // slot -> attached GLB root
    this._animGroups   = [];
    this._animState    = null;
    this._applyChain   = Promise.resolve();
    this._visible      = true;

    this._config = { ...DRIVER_DEFAULT };
    this.ready = this._applyConfigNow(this._config, true);
  }

  // ── model loading ───────────────────────────────────────────────────────────
  async _loadBase(bodyId) {
    let res;
    try {
      res = await SceneLoader.ImportMeshAsync('', MODEL_DIR, `${bodyId}.glb`, this.scene);
    } catch (e) {
      console.warn(`[DriverCharacter] body '${bodyId}' failed to load — falling back to default`, e);
      this._config.body = DRIVER_DEFAULT.body;
      if (bodyId === DRIVER_DEFAULT.body) return;     // default itself missing: keep current
      return this._loadBase(DRIVER_DEFAULT.body);
    }
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
    this._slotBones = {};
    for (const [slot, def] of Object.entries(ATTACH_SLOTS)) {
      this._slotBones[slot] = skeleton?.bones.find(b => def.boneRe.test(b.name)) ?? null;
    }

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
    let res;
    try {
      res = await SceneLoader.ImportMeshAsync('', MODEL_DIR, `${headId}.glb`, this.scene);
    } catch (e) {
      console.warn(`[DriverCharacter] head '${headId}' failed to load — using native head`, e);
      this._config.head = this._base.charId;
      this._base.headMesh?.setEnabled(true);
      return;
    }
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

  async _setAttachment(slot, name) {
    if (this._attachRoots[slot]) { this._attachRoots[slot].dispose(false, true); this._attachRoots[slot] = null; }
    if (!name || name === 'none') return;
    let res;
    try {
      res = await SceneLoader.ImportMeshAsync('', attachmentDir(name), `${name}.glb`, this.scene);
    } catch (e) {
      console.warn(`[DriverCharacter] ${slot} piece '${name}' failed to load — clearing slot`, e);
      this._config[slot] = 'none';
      return;
    }
    const root = res.meshes[0];
    this._attachRoots[slot] = root;
    const bone = this._slotBones[slot] ?? this._headBone;
    if (bone && this._base?.bodyMesh) {
      root.attachToBone(bone, this._base.bodyMesh);
    } else {
      root.parent = this.modelRoot;
    }
    root.setEnabled(this._visible);
  }

  // Color-wheel skin: skin verts are WHITE on a dedicated 'skinMat' — tinting the
  // material albedo IS the skin tone (dark verts like eyes multiply to stay dark).
  // Kenney heads (textured, no skinMat) are left untouched.
  _applySkin(hex) {
    if (!hex) return;
    const head = this._swappedHead ?? this._base?.headMesh;
    const mat = head?.material;
    if (!mat || !/skinMat/i.test(mat.name)) return;
    const c = Color3.FromHexString(hex).toLinearSpace();
    if (mat.albedoColor !== undefined) mat.albedoColor = c;
    else if (mat.diffuseColor !== undefined) mat.diffuseColor = c;
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
    if (partial.accessory !== undefined) {        // legacy key → face slot
      partial = { ...partial, face: partial.accessory };
      delete partial.accessory;
    }
    const prev    = this._config;
    const next    = { ...prev, ...partial };
    // Bedroll rides the satchel — drop it whenever the back piece isn't the satchel.
    if (next.back !== BEDROLL_HOST) next.bedroll = 'none';
    const changed = k => initial || next[k] !== prev[k];
    this._config  = next;

    if (changed('body'))                    await this._loadBase(next.body);
    if (changed('body') || changed('head')) await this._setHead(next.head);
    for (const slot of Object.keys(ATTACH_SLOTS)) {
      if (changed('body') || changed(slot)) await this._setAttachment(slot, next[slot]);
    }
    if (changed('skin') || changed('head') || changed('body')) this._applySkin(next.skin);
    return { ...this._config };
  }

  getConfig() { return { ...this._config }; }

  // ── Click-to-section nav helpers (used by the hangar customizer) ─────────────
  // Classify a picked scene mesh into a customization region: 'head' | 'body' | null.
  regionOfMesh(m) {
    if (!m) return null;
    if (m === (this._swappedHead ?? this._base?.headMesh)) return 'head';
    if (m === this._base?.bodyMesh) return 'body';
    for (const [slot, root] of Object.entries(this._attachRoots)) {
      if (!root) continue;
      for (let p = m; p; p = p.parent) {
        if (p === root) return HEAD_SLOTS.includes(slot) ? 'head' : 'body';
      }
    }
    return null;
  }

  // All renderable meshes belonging to a region (for the hover highlight).
  regionMeshes(region) {
    const out = [];
    const push = (msh) => { if (msh?.getTotalVertices?.() > 0) out.push(msh); };
    const slots = region === 'head' ? HEAD_SLOTS : ['back', 'bedroll'];
    push(region === 'head' ? (this._swappedHead ?? this._base?.headMesh) : this._base?.bodyMesh);
    for (const slot of slots) {
      const root = this._attachRoots[slot];
      if (root) { push(root); root.getChildMeshes().forEach(push); }
    }
    return out;
  }

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
    for (const r of Object.values(this._attachRoots)) r?.dispose(false, true);
    this._attachRoots = {};
    this._disposeBase();
    this.modelRoot.dispose();
    this.mesh.dispose();
    this.camera.dispose();
  }
}
