// src/world/PlasmaTurret.js
// The turret-bunker's gun made LIVE and AIMING. The static armoured BASE is the POI prop; this
// enemy loads the GUN (turret-gun.glb) onto AIEnemy's turretPivot so it YAW-TRACKS the player like
// a real tank turret, then charges (a swelling plasma core at the muzzle, ~CHARGE_TIME) and
// UNLEASHES a heavy beam down the line of the gun. Destructible (tanky). Read the tell and clear
// the line, or kill it.
//
// Extends AIEnemy for the HP / takeDamage / hit-detection / shells / turret-aim plumbing. `_static`
// keeps the body planted (the gun stays seated on the base); the gun yaws via turretPivot, whose
// rotation is rotY-compensated so the cannon always points at turretAimAngle regardless of the
// (unused, invisible) hull heading.
import { MeshBuilder, StandardMaterial, Color3, Constants, Vector3, Matrix, SceneLoader, TransformNode } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import AIEnemy from './AIEnemy.js';
import EyeBeam from '../combat/EyeBeam.js';
import { audio } from '../core/audio/AudioManager.js';

const CHARGE_TIME = 1.6;   // slow, heavy wind-up (vs the Sentinel's 1.1) — a big tell you can clear
const BEAM_SPEED  = 72;
const BEAM_RANGE  = 64;
const POOL        = 3;
const SCREEN_MARGIN = 0.02;
const BORE_DIST = 3.98;    // cannon bore offset from the turret centre (model), along the aim
const BORE_Y    = 2.46;    // bore height (glow); the beam itself flies lower to stay under the hit gate
const GUN_FILE  = 'turret-gun.glb';

export default class PlasmaTurret extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      ...opts,
      noPrimitiveVisuals: true,           // the base is the POI prop; the gun loads below
      static: true,                       // dug in — the body never moves (gun stays on the base)
      aggroRange: opts.aggroRange ?? 40,  // engage as you near the stronghold
    });
    this.hp = this.maxHp = opts.hp ?? 240;          // tanky emplacement — real fire to crack it
    this.shellDamage = opts.damage ?? 60;           // heavy plasma hit
    this._fireCooldownDuration = opts.cooldown ?? 2.6;
    this._aimTolerance = 0.14;                       // ~8° — fires once the gun is roughly on the player
    this._turretSpeed = 1.6;                         // SLOW heavy yaw (rad/s) — a turret you can outrun
    this._optimalRange = (opts.aggroRange ?? 40) + 6;
    this.shells = Array.from({ length: POOL }, () => new EyeBeam(scene));

    this._beamY    = 1.3;                            // beam flies at hit height (under the y<1.6 gate)
    this._charging = false;
    this._chargeT  = 0;
    this._flash    = 0;
    this.turretPivot.position.set(0, 0, 0);          // gun carries its own height; pivot at the bunker axis
    this._buildChargeGlow(scene);
    this.ready = this._buildGun(scene);
  }

  // Load the gun GLB and seat it on the turretPivot so AIEnemy's turret aim yaws it onto the player.
  async _buildGun(scene) {
    const res = await SceneLoader.ImportMeshAsync('', '/assets/models/props/', GUN_FILE, scene);
    const root = res.meshes.find(m => m.name === '__root__') || res.meshes[0].parent;
    if (root) { root.parent = this.turretPivot; root.position.set(0, 0, 0); }
    for (const m of res.meshes) {
      if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
      const c = m.material && (m.material.albedoColor || m.material.diffuseColor);
      const rgb = c ? [c.r, c.g, c.b] : [0.4, 0.4, 0.4];
      m.material = this._gunMat(scene, rgb);
      m.isPickable = false;
      if (!root) m.parent = this.turretPivot;
    }
    return this;
  }

  // Flat material matching the base prop (reuse loadProp's cached flats so base + gun match);
  // the red (optic/bore) reads as powered = emissive.
  _gunMat(scene, rgb) {
    const key = `propflat_${rgb.map(v => v.toFixed(2)).join('_')}`;
    let m = scene.getMaterialByName(key);
    if (m) return m;
    m = new StandardMaterial(key, scene);
    m.diffuseColor = new Color3(...rgb);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    if (rgb[0] > 0.6 && rgb[1] < 0.3) m.emissiveColor = new Color3(0.85, 0.07, 0.07);   // red → glow
    return m;
  }

  // It can't close to COMBAT by moving (static), so it opens fire the moment it's aware + aimed.
  _shouldFire() { return this.state === 'COMBAT' || this.state === 'APPROACH' || this.state === 'RETREAT'; }

  _fire() {
    if (this._charging || !this._onScreen()) return;
    this._charging = true; this._chargeT = 0;
    this.fireCooldown = 999;
    audio.play('enemy.sentinel_beam_charge', { emitter: this.root });
  }

  update(dt, playerPos) {
    super.update(dt, playerPos);       // tracks the player (turretPivot yaw) + runs the base fire gate
    if (!this.alive) { if (this._glow) this._glow.setEnabled(false); return; }
    this._updateCharge(dt);
    this._updateGlow(dt);
  }

  _updateCharge(dt) {
    if (!this._charging) return;
    this._chargeT += dt;
    if (this._chargeT >= CHARGE_TIME) this._release();
  }

  // Muzzle world point = the bore, along the gun's CURRENT aim (turretAimAngle), so it tracks.
  _muzzle() {
    const a = this.turretAimAngle;
    return { x: this.root.position.x + Math.sin(a) * BORE_DIST, y: BORE_Y, z: this.root.position.z + Math.cos(a) * BORE_DIST };
  }

  _release() {
    this._charging = false; this._chargeT = 0;
    const a = this.turretAimAngle;
    const mz = this._muzzle();
    const beam = this.shells.find(s => !s.active);
    if (beam) beam.fire(mz.x, this._beamY, mz.z, Math.sin(a) * BEAM_SPEED, 0, Math.cos(a) * BEAM_SPEED, BEAM_RANGE);
    this._flash = 1;
    audio.play('enemy.sentinel_beam_fire', { emitter: this.root });
    this.fireCooldown = this._fireCooldownDuration;
  }

  // Muzzle plasma core: a swelling additive sphere at the (moving) bore — the per-turret charge
  // tell. Shared material (fixed hot colour); each turret tells via its own mesh SCALE.
  _buildChargeGlow(scene) {
    let mat = scene.getMaterialByName('plasmaGlowMat');
    if (!mat) {
      mat = new StandardMaterial('plasmaGlowMat', scene);
      mat.emissiveColor = new Color3(1.0, 0.45, 0.20);
      mat.diffuseColor = new Color3(0, 0, 0);
      mat.disableLighting = true; mat.alpha = 0.8; mat.alphaMode = Constants.ALPHA_ADD; mat.backFaceCulling = false;
    }
    this._glow = MeshBuilder.CreateSphere('plasmaGlow', { diameter: 1, segments: 8 }, scene);
    this._glow.material = mat; this._glow.isPickable = false; this._glow.parent = this.root; this._glow.setEnabled(false);
  }

  _updateGlow(dt) {
    const mz = this._muzzle();
    this._glow.setAbsolutePosition(new Vector3(mz.x, mz.y, mz.z));
    if (this._flash > 0) this._flash = Math.max(0, this._flash - dt / 0.18);
    if (this._charging || this._flash > 0) {
      this._glow.setEnabled(true);
      const t = this._charging ? Math.min(1, this._chargeT / CHARGE_TIME) : 0;
      this._glow.scaling.setAll(0.3 + t * 1.0 + this._flash * 0.9);
    } else {
      this._glow.setEnabled(false);
    }
  }

  _onScreen() {
    const cam = this.scene.activeCamera;
    if (!cam) return true;
    const eng = this.scene.getEngine();
    const w = eng.getRenderWidth(), h = eng.getRenderHeight();
    const p = Vector3.Project(this.root.position, Matrix.Identity(), this.scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
    if (p.z < 0 || p.z > 1) return false;
    return p.x >= w * SCREEN_MARGIN && p.x <= w * (1 - SCREEN_MARGIN) && p.y >= h * SCREEN_MARGIN && p.y <= h * (1 - SCREEN_MARGIN);
  }
}
