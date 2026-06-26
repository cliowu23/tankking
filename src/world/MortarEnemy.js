// src/world/MortarEnemy.js
// World 1 heavy: the Mortar-bot. A Sentinel-sized, SIX-legged artillery walker
// (OG-9 spider-droid lineage: a central armored core the legs radiate from, with a
// rear-deck mortar). It holds at mid-range and lobs a single heavy ARCING shell at
// your locked ground position — AREA splash you dodge by leaving the marked blast
// ring. Punishes standing still / predictable kiting (the gap the chaff tick + the
// sentinel beam don't cover). Telegraphed: it locks the spot, the muzzle/eye wind up
// red→white, a ground ring fills — and you can KILL it mid-charge to cancel the shot.
//
// Extends AIEnemy; mirrors SentinelEnemy's charge pattern (override _fire to BEGIN a
// charge, release from update). Visuals load from mortar.glb (clean GLB seam, same as
// chaff/sentinel); legs are rigged + swung procedurally (no skeleton).
import { StandardMaterial, Color3, Color4, TransformNode, Vector3, Matrix, Quaternion } from '@babylonjs/core';
import AIEnemy from './AIEnemy.js';
import MortarShell from '../combat/MortarShell.js';
import { loadEnemyTemplate } from './enemyModels.js';
import { shortAngle } from '../utils/mathUtils.js';
import { audio } from '../core/audio/AudioManager.js';

const SHELL_POOL    = 2;
const CHARGE_TIME   = 0.9;    // wind-up tell before it lobs (s)
const FLIGHT_TIME   = 0.85;   // shell airtime (you watch it arc + the ring)
const ARC_PEAK      = 6.5;    // shell apex height
const SPLASH_RADIUS = 4.5;
const LEAD_MAX      = 16;     // cap on how far ahead of the player the lob will lead (u)
const RECOVERY      = 1.6;    // exposed window after a shot
const MODEL_SCALE   = 0.72;   // tune to Sentinel scale
const SCREEN_MARGIN = 0.03;

const BODY  = [0.40, 0.43, 0.47];
const DARK  = [0.12, 0.13, 0.15];
const TRIM  = [0.85, 0.45, 0.08];   // amber accents
const EYE   = [1.0, 0.12, 0.10];
const MUZ   = [0.85, 0.35, 0.10];   // idle muzzle ember
const DEATH_TINT = [0.10, 0.10, 0.11];

const GAIT_SWEEP = 0.28;   // radians a leg steps fore-aft (azimuthal swing around Y)
const GAIT_LIFT  = 0.50;   // radians a foot lifts during its swing half (arc, not drag)
const _qLift = new Quaternion();   // per-frame scratch (synchronous, safe to share)
const _qSweep = new Quaternion();

export default class MortarEnemy extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      hp: 70,
      damage: 60,           // splash CENTRE damage (falloff to ~1/3 at the edge, in ArenaScene)
      aiSpeed: 3.5,         // slow — artillery, only repositions
      optimalRange: 30,     // long hold — it lobs from the back of the field
      aggroRange: 46,       // detects/positions from far; the _onScreen gate still bars off-screen lobs
      cooldown: RECOVERY,
      ...opts,
      noPrimitiveVisuals: true,
    });

    this._halfW = 1.5; this._halfD = 1.5;
    this._rotateSpeed  = 1.1;
    this._aimTolerance = 16 * Math.PI / 180;   // artillery — only roughly needs to face you

    this._charging = false;
    this._chargeT  = 0;
    this._eyeFlash = 0;
    this._pvx = 0; this._pvz = 0;              // tracked player velocity (for target leading)
    this._legs = []; this._gaitPhase = 0; this._gaitSpeed = 0;

    for (const s of this.shells) s.deactivate?.();
    this.shells = Array.from({ length: SHELL_POOL }, () => new MortarShell(scene));

    this.ready = this._buildComposed(scene).catch((e) => {
      console.error('[mortar] GLB load failed:', e);
      return this;
    });
  }

  _mat(name, rgb, emissive = false) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = new Color3(...rgb);
    if (emissive) { m.emissiveColor = new Color3(...rgb); m.disableLighting = true; }
    else m.specularColor = new Color3(0.16, 0.18, 0.21);
    return m;
  }

  // Artillery is immune to the shield parry-stun — you can't bubble-stun a Mortar; you
  // dodge its lob and punish its recovery instead.
  stun() {}

  async _buildComposed(scene) {
    const tpl = await loadEnemyTemplate(scene, 'mortar', { body: BODY, dark: DARK, trim: TRIM, eye: EYE });
    const id = (MortarEnemy._n = (MortarEnemy._n || 0) + 1);

    const holder = new TransformNode('mortarHolder', scene);
    holder.parent = this.root;
    holder.rotation.y = 0;                // model is already built eye/mortar-forward (+Z); no flip
    holder.scaling.setAll(MODEL_SCALE);
    holder.position.y = 0;
    this._holder = holder;

    this.eyeMat = this._mat('mortarEyeGlow', EYE, true);
    this.muzMat = this._mat('mortarMuzGlow', MUZ, true);
    this._tint = [];
    const made = [];
    for (const part of tpl.parts) {
      const nm = part.name.toLowerCase();
      let node;
      if (part.isEye) {
        node = part.mesh.clone(`m_${part.name}_${id}`, null);   // cloned: own emissive, per-enemy
        node.setEnabled(true);
        node.material = nm.startsWith('muzzle') ? this.muzMat : this.eyeMat;
        if (nm.startsWith('muzzle')) this.muzzle = node; else this.eye = node;
      } else {
        node = part.mesh.createInstance(`m_${part.name}_${id}`);
        node.instancedBuffers.color = new Color4(1, 1, 1, 1);
        this._tint.push(node);
      }
      node.rotationQuaternion = new Quaternion();
      part.matrix.decompose(node.scaling, node.rotationQuaternion, node.position);
      node.parent = holder; node.isPickable = false;
      if (nm.startsWith('core')) this.hull = node;
      made.push({ node, name: nm });
    }

    // Rig the 6 legs: a pivot at each hip (shoulder) joint; reparent that leg's
    // thigh/knee/shin under it so _animateLegs swings the whole limb from the body.
    holder.computeWorldMatrix(true);
    const holderInv = Matrix.Invert(holder.getWorldMatrix());
    for (let i = 0; i < 6; i++) {
      const hip = made.find(m => m.name === `hip_${i}`);
      if (!hip) continue;
      hip.node.computeWorldMatrix(true);
      const hipW = hip.node.getBoundingInfo().boundingBox.centerWorld;
      const pivot = new TransformNode(`mortarLeg${i}_${id}`, scene);
      pivot.parent = holder;
      pivot.position = Vector3.TransformCoordinates(hipW, holderInv);
      pivot.rotationQuaternion = new Quaternion();   // driven by _animateLegs
      for (const seg of ['thigh', 'knee', 'shin']) {
        const lm = made.find(m => m.name === `${seg}_${i}`);
        if (lm) lm.node.setParent(pivot);
      }
      // Per-leg outward azimuth → the horizontal axis we pitch the limb around to LIFT the
      // foot. Each radial leg arcs up cleanly along its own direction instead of all six
      // pitching the same body-forward way (the old uniform rotation.x dragged side legs).
      // Axis is oriented (−cos, 0, +sin) so a POSITIVE lift angle raises the foot upward
      // (the opposite sign would drive it into the ground — see cross-product with outward).
      const ang = Math.atan2(pivot.position.x, pivot.position.z);
      const liftAxis = new Vector3(-Math.cos(ang), 0, Math.sin(ang));
      this._legs.push({ pivot, phase: (i % 2) * Math.PI, liftAxis });   // alternate tripod phase
    }

    this.hpBarBg.position.y = 3.0;
    this.hpBarFill.position.y = 3.0;
    return this;
  }

  addShadows(shadowGen) {
    if (this.hull && !this.hull.isAnInstance) shadowGen.addShadowCaster(this.hull);
  }

  // Begin the wind-up (don't fire yet). Lock the ground point under the player NOW,
  // so the shot is dodged during charge+flight. Never lob from off-screen.
  _fire() {
    if (this._charging || !this.eye) return;
    if (!this._onScreen()) return;
    this._charging = true; this._chargeT = 0;
    this.fireCooldown = 999;            // parked; release sets the real recovery
    audio.play('enemy.sentinel_beam_charge', { emitter: this.root });   // reuse charge SFX for now
  }

  update(dt, playerPos) {
    this._lastPlayer = playerPos;
    // Track the player's (smoothed) velocity so the lob can LEAD a moving target.
    const dtc = Math.max(dt, 1e-3);
    if (this._prevPX !== undefined) {
      const vx = (playerPos.x - this._prevPX) / dtc, vz = (playerPos.z - this._prevPZ) / dtc;
      const k = Math.min(1, dt * 8);
      this._pvx = (this._pvx ?? 0) + (vx - (this._pvx ?? 0)) * k;
      this._pvz = (this._pvz ?? 0) + (vz - (this._pvz ?? 0)) * k;
    }
    this._prevPX = playerPos.x; this._prevPZ = playerPos.z;
    super.update(dt, playerPos);
    if (!this.alive) return;
    // Artillery keeps its body (and the rear mortar + eye) facing you, even while
    // holding in COMBAT (the base stops turning there) — so it aims and reads right.
    if (this.state !== 'IDLE' && this.state !== 'AMBUSH' && this.state !== 'PATROL') {
      const a = Math.atan2(playerPos.x - this.root.position.x, playerPos.z - this.root.position.z);
      const d = shortAngle(this.rotY, a);
      this.rotY += Math.sign(d) * Math.min(Math.abs(d), this._rotateSpeed * dt);
      this.root.rotation.y = this.rotY;
    }
    this._updateCharge(dt);
    this._updateGlow(dt);
    this._animateLegs(dt);
  }

  _updateCharge(dt) {
    if (!this._charging) return;
    if (this.state === 'IDLE' || this.state === 'AMBUSH' || this.state === 'PATROL') {
      this._charging = false; this._chargeT = 0; this.fireCooldown = 0.5;
      return;
    }
    this._chargeT += dt;
    if (this._chargeT >= CHARGE_TIME) this._release();
  }

  _release() {
    this._charging = false; this._chargeT = 0;
    const shell = this.shells.find(s => !s.active);
    if (shell && this.muzzle) {
      this.muzzle.computeWorldMatrix(true);
      const m = this.muzzle.getBoundingInfo().boundingBox.centerWorld;
      // LEAD the shot: aim where the player will be when it lands (pos + vel × airtime).
      // A constant-heading runner gets hit; you dodge by CHANGING direction mid-flight.
      const px = this._lastPlayer?.x ?? this.root.position.x;
      const pz = this._lastPlayer?.z ?? this.root.position.z;
      let tx = px + (this._pvx ?? 0) * FLIGHT_TIME;
      let tz = pz + (this._pvz ?? 0) * FLIGHT_TIME;
      const ldx = tx - px, ldz = tz - pz, ld = Math.hypot(ldx, ldz);
      if (ld > LEAD_MAX) { tx = px + ldx / ld * LEAD_MAX; tz = pz + ldz / ld * LEAD_MAX; }  // cap a boost-dash overshoot
      shell.fire(m.x, m.y, m.z, tx, tz, FLIGHT_TIME, ARC_PEAK, SPLASH_RADIUS, this.shellDamage);
    }
    this._eyeFlash = 1;
    audio.play('enemy.sentinel_beam_fire', { emitter: this.root });
    this.fireCooldown = this._fireCooldownDuration;
  }

  _onScreen() {
    const cam = this.scene.activeCamera;
    if (!cam) return true;
    const eng = this.scene.getEngine();
    const w = eng.getRenderWidth(), h = eng.getRenderHeight();
    const p = Vector3.Project(this.root.position, Matrix.Identity(), this.scene.getTransformMatrix(),
      cam.viewport.toGlobal(w, h));
    if (p.z < 0 || p.z > 1) return false;
    return p.x >= w * SCREEN_MARGIN && p.x <= w * (1 - SCREEN_MARGIN) &&
           p.y >= h * SCREEN_MARGIN && p.y <= h * (1 - SCREEN_MARGIN);
  }

  // Eye + muzzle wind up red→orange→white-hot during the charge, flash on release.
  _updateGlow(dt) {
    if (this._eyeFlash > 0) this._eyeFlash = Math.max(0, this._eyeFlash - dt / 0.16);
    let r, g, b;
    if (this._charging) {
      const t = Math.min(1, this._chargeT / CHARGE_TIME);
      const pulse = 1 + Math.sin(this._chargeT * (6 + t * 20)) * 0.2 * t;
      r = 1.0 * pulse; g = (0.12 + t * 0.85) * pulse; b = (0.10 + t * t * 0.9) * pulse;
    } else {
      const f = 1 + this._eyeFlash * 2.4;
      r = EYE[0] * f; g = EYE[1] * f; b = EYE[2] * f;
    }
    this.eyeMat?.emissiveColor.set(r, g, b);
    // muzzle echoes the wind-up (amber base, brightening with the charge/flash)
    const mf = this._charging ? (1 + Math.min(1, this._chargeT / CHARGE_TIME) * 2.5) : (1 + this._eyeFlash * 3);
    this.muzMat?.emissiveColor.set(MUZ[0] * mf, MUZ[1] * mf, MUZ[2] * mf);
  }

  // Spider gait: each leg arcs its foot UP during the swing half and plants it for the
  // stance half (lift = max(0,cos) bump while sweeping forward; drags back when planted),
  // tripod-phased (even/odd legs antiphase) so three feet always carry the body. Lift is
  // about each leg's own outward axis, sweep is azimuthal (around Y) — radial-spider true.
  // A subtle body bob + roll rides the gait; a faint idle shimmer keeps the holding
  // artillery alive rather than a frozen statue; charging digs the whole rig down to brace.
  _animateLegs(dt) {
    const moving = Math.abs(this.speed);
    this._gaitSpeed += (moving - this._gaitSpeed) * Math.min(1, dt * 6);
    this._gaitPhase += this._gaitSpeed * 1.6 * dt;
    this._idleT = (this._idleT || 0) + dt;
    const amp   = Math.min(1, this._gaitSpeed / 3);
    const brace = this._charging ? 1 : 0;
    const idle  = (1 - amp) * (1 - brace);   // idle sway only when not walking / charging
    for (const leg of this._legs) {
      const ph = this._gaitPhase + leg.phase;
      const sweep = Math.sin(ph) * GAIT_SWEEP * amp;
      let lift = Math.max(0, Math.cos(ph)) * GAIT_LIFT * amp;
      lift += Math.sin(this._idleT * 1.1 + leg.phase) * 0.02 * idle;   // faint idle breath
      lift -= brace * 0.12;                                            // dig in to brace
      Quaternion.RotationAxisToRef(leg.liftAxis, lift, _qLift);
      Quaternion.RotationYawPitchRollToRef(sweep, 0, 0, _qSweep);
      _qSweep.multiplyToRef(_qLift, leg.pivot.rotationQuaternion);     // sweep ∘ lift
    }
    if (this._holder) {
      this._holder.position.y = -Math.abs(Math.sin(this._gaitPhase)) * 0.05 * amp
                              + Math.sin(this._idleT * 1.2) * 0.03 * idle
                              - brace * 0.12;
      this._holder.rotation.z = Math.sin(this._gaitPhase) * 0.025 * amp;
    }
  }

  reset(x, z) {
    super.reset(x, z);
    this._charging = false; this._chargeT = 0; this._eyeFlash = 0;
  }

  _deathVisuals() {
    audio.play('enemy.sentinel_death', { emitter: this.root });
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(0.20, 0.20, 0.22, 1);
    this.eyeMat?.emissiveColor.set(0.04, 0.01, 0.01);
    this.muzMat?.emissiveColor.set(0.04, 0.02, 0.01);
  }
  _reviveVisuals() {
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(1, 1, 1, 1);
    this.eyeMat?.emissiveColor.set(...EYE);
    this.muzMat?.emissiveColor.set(...MUZ);
  }
}
