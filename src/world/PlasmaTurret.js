// src/world/PlasmaTurret.js
// The turret-bunker's gun made LIVE: a dug-in Automaton cannon emplacement. STATIC and locked to
// a single firing LANE (the road its cannon points down). When the player crosses that lane in
// range, the muzzle plasma core CHARGES (a swelling glow tell, ~CHARGE_TIME) then UNLEASHES one
// heavy beam down the lane — read the tell and clear the line. Destructible (tanky): shoot it
// enough and it goes dark. The turret-bunker GLB is the visual (no own body); this drives the
// charge tell + beam + HP.
//
// Extends AIEnemy purely for the free HP / takeDamage / hit-detection / shells plumbing. The
// _static + _fixedAim flags (AIEnemy) keep it planted and stop the turret tracking, so the base
// fire gate only trips when the player is inside the locked lane (aimDiff < _aimTolerance).
import { MeshBuilder, StandardMaterial, Color3, Constants, Vector3, Matrix } from '@babylonjs/core';
import AIEnemy from './AIEnemy.js';
import EyeBeam from '../combat/EyeBeam.js';
import { audio } from '../core/audio/AudioManager.js';

const CHARGE_TIME = 1.6;   // slow, heavy wind-up (vs the Sentinel's 1.1) — a big tell you can clear
const BEAM_SPEED  = 72;
const BEAM_RANGE  = 64;
const POOL        = 3;
const SCREEN_MARGIN = 0.02;

export default class PlasmaTurret extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      ...opts,
      noPrimitiveVisuals: true,           // the turret-bunker prop is the visual
      static: true,                       // dug in — never moves
      fixedAim: opts.fireAngle ?? 0,      // locked lane (world radians), set by the POI to face the road
      aggroRange: opts.aggroRange ?? 38,  // engage as you near the stronghold (kept on-screen-ish)
    });
    this.hp = this.maxHp = opts.hp ?? 240;          // tanky emplacement — real fire to crack it
    this.shellDamage = opts.damage ?? 60;           // heavy plasma hit
    this._fireCooldownDuration = opts.cooldown ?? 2.6;
    this._aimTolerance = opts.fireArc ?? 0.55;      // ~31° half-arc — fires when you're in the lane
    this._optimalRange = (opts.aggroRange ?? 38) + 6; // enter COMBAT across its whole range (it can't close)
    this.shells = Array.from({ length: POOL }, () => new EyeBeam(scene));

    this._fireAngle  = opts.fireAngle ?? 0;
    this._muzzleDist = opts.muzzleDist ?? 3.0;      // beam emits from the cannon muzzle, out front
    this._beamY      = 1.15;
    this._charging   = false;
    this._chargeT    = 0;
    this._flash      = 0;
    this._buildChargeGlow(scene);
  }

  // It can't close to COMBAT range by moving (it's static), so it opens fire the moment it's aware.
  _shouldFire() { return this.state === 'COMBAT' || this.state === 'APPROACH' || this.state === 'RETREAT'; }

  // BEGIN a charge instead of an instant shot (the dodge tell); released from update().
  _fire() {
    if (this._charging || !this._onScreen()) return;   // never beam from fully off-screen
    this._charging = true; this._chargeT = 0;
    this.fireCooldown = 999;
    audio.play('enemy.sentinel_beam_charge', { emitter: this.root });
  }

  update(dt, playerPos) {
    super.update(dt, playerPos);
    if (!this.alive) { if (this._glow) this._glow.setEnabled(false); return; }
    this._updateCharge(dt);
    this._updateGlow(dt);
  }

  _updateCharge(dt) {
    if (!this._charging) return;
    this._chargeT += dt;
    if (this._chargeT >= CHARGE_TIME) this._release();   // commits the shot down the lane
  }

  _release() {
    this._charging = false; this._chargeT = 0;
    const a = this._fireAngle;
    const mx = this.root.position.x + Math.sin(a) * this._muzzleDist;
    const mz = this.root.position.z + Math.cos(a) * this._muzzleDist;
    const beam = this.shells.find(s => !s.active);
    if (beam) beam.fire(mx, this._beamY, mz, Math.sin(a) * BEAM_SPEED, 0, Math.cos(a) * BEAM_SPEED, BEAM_RANGE);
    this._flash = 1;
    audio.play('enemy.sentinel_beam_fire', { emitter: this.root });
    this.fireCooldown = this._fireCooldownDuration;
  }

  // Muzzle plasma core: a small additive sphere at the cannon mouth that SWELLS through the
  // charge and pops on release. Shared material (fixed hot colour); each turret tells via its
  // own mesh SCALE so they charge independently with no cross-glow. Parented to root so the
  // arena's _clearEnemies (root.dispose) reaps it.
  _buildChargeGlow(scene) {
    let mat = scene.getMaterialByName('plasmaGlowMat');
    if (!mat) {
      mat = new StandardMaterial('plasmaGlowMat', scene);
      mat.emissiveColor   = new Color3(1.0, 0.45, 0.20);
      mat.diffuseColor    = new Color3(0, 0, 0);
      mat.disableLighting = true;
      mat.alpha           = 0.8;
      mat.alphaMode       = Constants.ALPHA_ADD;
      mat.backFaceCulling = false;
    }
    this._glow = MeshBuilder.CreateSphere('plasmaGlow', { diameter: 1, segments: 8 }, scene);
    this._glow.material   = mat;
    this._glow.isPickable = false;
    this._glow.parent     = this.root;        // reaped on root.dispose()
    this._glow.setEnabled(false);
  }

  _updateGlow(dt) {
    const a = this._fireAngle;
    const mx = this.root.position.x + Math.sin(a) * this._muzzleDist;
    const mz = this.root.position.z + Math.cos(a) * this._muzzleDist;
    this._glow.setAbsolutePosition(new Vector3(mx, this._beamY, mz));   // world-anchored at the muzzle (immune to root rot)
    if (this._flash > 0) this._flash = Math.max(0, this._flash - dt / 0.18);
    if (this._charging || this._flash > 0) {
      this._glow.setEnabled(true);
      const t = this._charging ? Math.min(1, this._chargeT / CHARGE_TIME) : 0;
      this._glow.scaling.setAll(0.3 + t * 1.0 + this._flash * 0.9);     // swells through charge, pops on fire
    } else {
      this._glow.setEnabled(false);
    }
  }

  // Is the turret on-screen? (don't beam from fully off-screen — fairness). Mirrors SentinelEnemy.
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
