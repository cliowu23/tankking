// src/world/ChaffEnemy.js
// World 1 chaff: a tiny legged SCOUT-BOT whose glowing red eye fires laser
// bolts — the King's disposable swarm and the horde on-ramp (Duckov spider-bot
// energy). Extends AIEnemy and reuses its state machine; swaps the single-shell
// cannon for an eye-laser that fires a STREAM of bolts (big pool + wide
// tolerance + short interval, in readable bursts).
//
// Visuals are a primitive placeholder (the real walker model is a separate
// visuals-session task): a low gunmetal body on four animated spider legs, and
// a sensor dome on the turret pivot carrying the red eye that tracks + fires.
// Silhouette is deliberately SMALL + legged to contrast the rolling tank
// elites — a swarm reads instantly as a different threat tier.
//
// Each laser hit is small CHIP; the threat is volume, so bolts live in
// this.shells and the existing enemy-shell hit path applies this.shellDamage
// with no special-casing.
import { MeshBuilder, StandardMaterial, Color3, Color4, TransformNode, Vector3, Matrix, Quaternion } from '@babylonjs/core';
import AIEnemy from './AIEnemy.js';
import LaserBolt from '../combat/LaserBolt.js';
import { loadEnemyTemplate } from './enemyModels.js';
import { audio } from '../core/audio/AudioManager.js';

const LASER_POOL     = 14;                  // bolts in flight at once (stream needs depth)
const LASER_HSPEED   = 60;                  // bolt travels faster than a shell (35)
const LASER_SPREAD   = 4.5 * Math.PI / 180; // azimuth cone — a dodgeable stream, not a beam
const LASER_RANGE    = 40;                  // despawn distance
const LASER_INTERVAL = 0.10;                // seconds between bolts while bursting (10/s)
const LASER_BURST    = 5;                   // bolts per burst before a short regroup pause
const LASER_REGROUP  = 0.7;                 // pause between bursts (readable, not a wall)
const LASER_AIM_TOL  = 14 * Math.PI / 180;  // wide — fires when roughly on target

const GAIT_FREQ  = 1.7;   // leg-cycle speed per unit of ground speed (skitter cadence)
const GAIT_SWING = 0.55;  // radians the legs swing fore-aft
const GAIT_BOB   = 0.035; // body bob amplitude while moving

const BODY_STEEL = [0.40, 0.43, 0.47];   // cold gunmetal — the King's machine palette
const LEG_DARK   = [0.12, 0.13, 0.15];
const EYE_RED    = [1.0, 0.12, 0.10];
const DEATH_TINT = [0.10, 0.10, 0.11];

export default class ChaffEnemy extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      hp: 30,            // dies in ~1 player shot (34 dmg)
      damage: 5,         // CHIP per laser bolt
      aiSpeed: 9,        // fast
      optimalRange: 9,   // gets in your face
      aggroRange: 30,    // notices you from far
      cooldown: LASER_INTERVAL,
      ...opts,
      noPrimitiveVisuals: true,   // we draw our own walker below
    });

    this._halfW        = 0.62;         // small footprint — it's a little bot
    this._halfD        = 0.62;
    this._rotateSpeed  = 2.6;          // skitter: turns far quicker than a tank
    this._aimTolerance = LASER_AIM_TOL;
    this._tipOffset    = 0.12;         // bolt spawn just ahead of the eye lens
    this._eyeFlash     = 0;            // 0..1, brightens the eye briefly on each shot
    this._burstLeft    = LASER_BURST;
    this._gaitPhase = 0; this._gaitSpeed = 0; this._legs = [];

    // Replace the inherited 4-shell cannon pool with a laser-bolt pool.
    for (const s of this.shells) s.deactivate?.();
    this.shells = Array.from({ length: LASER_POOL }, () => new LaserBolt(scene));

    // Load the Blender GLB; fall back to the primitive walker if it fails.
    this.ready = this._buildComposedChaff(scene).catch((e) => {
      console.error('[chaff] GLB load failed, using placeholder:', e);
      this.root.scaling.setAll(1.07);
      this._buildWalker(scene);
      this.barrelPivot.position.set(0, 0.32, 0.30);
      this._barrelBaseZ = 0.30;
      return this;
    });
  }

  _cmat(name, rgb, emissive = false) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = new Color3(...rgb);
    if (emissive) { m.emissiveColor = new Color3(...rgb); m.disableLighting = true; }
    else m.specularColor = new Color3(0.18, 0.20, 0.24);
    return m;
  }

  async _buildComposedChaff(scene) {
    const tpl = await loadEnemyTemplate(scene, 'chaff', { body: BODY_STEEL, dark: LEG_DARK, eye: EYE_RED });
    const id = (ChaffEnemy._n = (ChaffEnemy._n || 0) + 1);

    // Holder flips front (eye) to +Z local + lifts the feet onto the ground.
    this._holder = new TransformNode('chaffHolder', scene);
    this._holder.parent = this.root;
    this._holder.rotation.y = Math.PI;
    this._holder.position.y = 0.03;
    this._holderBaseY = 0.03;

    this.eyeMat = this._cmat('chEye', EYE_RED, true);   // per-enemy eye glow
    this._tint = [];
    const made = [];
    for (const part of tpl.parts) {
      let node;
      if (part.isEye) {
        node = part.mesh.clone(`cEye_${id}`, null);
        node.setEnabled(true); node.material = this.eyeMat; this.eye = node;
      } else {
        node = part.mesh.createInstance(`c_${part.name}_${id}`);   // GPU-batched; geometry shared
        node.instancedBuffers.color = new Color4(1, 1, 1, 1); this._tint.push(node);
      }
      node.rotationQuaternion = new Quaternion();
      part.matrix.decompose(node.scaling, node.rotationQuaternion, node.position);
      node.parent = this._holder; node.isPickable = false;
      const nm = part.name.toLowerCase();
      if (nm.startsWith('body')) this.hull = node;
      if (nm.startsWith('dome')) this.turret = node;
      made.push({ node, name: part.name, isEye: part.isEye });
    }
    // Dome + eye + socket → turret pivot so the eye tracks the player.
    for (const m of made) {
      const nm = m.name.toLowerCase();
      if (m.isEye || nm.startsWith('dome') || nm.startsWith('eye')) m.node.setParent(this.turretPivot);
    }
    // Beam muzzle = the eye lens (bbox centre), in turret-pivot space.
    if (this.eye) {
      this.turretPivot.computeWorldMatrix(true);
      this.eye.computeWorldMatrix(true);
      const eyeW = this.eye.getBoundingInfo().boundingBox.centerWorld;
      const inv = Matrix.Invert(this.turretPivot.getWorldMatrix());
      const eyeLocal = Vector3.TransformCoordinates(eyeW, inv);
      this.barrelPivot.position.copyFrom(eyeLocal);
      this._barrelBaseZ = eyeLocal.z;
    }

    // Rig the 4 legs: a hip-pivot per leg, re-parent that leg's segment instances
    // under it, so _animateLegs swings them (diagonal-trot skitter).
    this._legs = [];
    this._holder.computeWorldMatrix(true);
    const holderInv = Matrix.Invert(this._holder.getWorldMatrix());
    for (let i = 0; i < 4; i++) {
      const hip = made.find(m => m.name.toLowerCase().startsWith(`hip_${i}`));
      if (!hip) continue;
      hip.node.computeWorldMatrix(true);
      const hipW = hip.node.getBoundingInfo().boundingBox.centerWorld;
      const pivot = new TransformNode(`chaffLegPivot${i}_${id}`, scene);
      pivot.parent = this._holder;
      pivot.position = Vector3.TransformCoordinates(hipW, holderInv);
      for (const seg of ['hip', 'thigh', 'knee', 'shin', 'foot']) {
        const lm = made.find(m => m.name.toLowerCase().startsWith(`${seg}_${i}`));
        if (lm) lm.node.setParent(pivot);
      }
      const sx = Math.sign(pivot.position.x) || 1;
      const sz = Math.sign(pivot.position.z) || 1;
      this._legs.push({ pivot, sx, phaseOffset: sx * sz > 0 ? Math.PI : 0 });
    }

    this.hpBarBg.position.y = 1.95;
    this.hpBarFill.position.y = 1.95;
    return this;
  }

  _buildWalker(scene) {
    this.hullMat = new StandardMaterial('chaffBody', scene);
    this.hullMat.diffuseColor  = new Color3(...BODY_STEEL);
    this.hullMat.specularColor = new Color3(0.18, 0.20, 0.24);

    const legMat = new StandardMaterial('chaffLeg', scene);
    legMat.diffuseColor = new Color3(...LEG_DARK);

    const eyeMat = new StandardMaterial('chaffEye', scene);
    eyeMat.diffuseColor    = new Color3(...EYE_RED);
    eyeMat.emissiveColor   = new Color3(...EYE_RED);
    eyeMat.disableLighting = true;

    // Central body — a low OCTAGONAL prism raised on the legs (~0.7 off ground).
    // An 8-sided cylinder reads as an octagon from the top-down camera; rotate a
    // flat face forward and elongate slightly fore-aft so it isn't a plain disc.
    this.hull = MeshBuilder.CreateCylinder('chaffBodyMesh', { height: 0.42, diameter: 1.08, tessellation: 8 }, scene);
    this.hull.rotation.y = Math.PI / 8;   // flat face toward +z (forward)
    this.hull.scaling.set(1.0, 1.0, 1.08); // slight fore-aft elongation
    this.hull.position.set(0, 0.72, 0);
    this.hull.material = this.hullMat;
    this.hull.parent = this.root;

    // Four legs in a sprawled SPIDER stance — feet plant at the four corners
    // OUTSIDE the body so all four read distinctly from the top-down camera
    // (tucked-under legs merged into two from above). Each leg is on a hip
    // pivot; _animateLegs swings them for a walking gait. Diagonal trot:
    // opposite corners step together.
    this._legs = [];
    this._gaitPhase = 0;
    this._gaitSpeed = 0;
    this._bodyBaseY = this.hull.position.y;
    const legZ = [-0.44, 0.44];
    const legX = [-0.44, 0.44];
    for (const lz of legZ) {
      for (const lx of legX) {
        const sx = Math.sign(lx), sz = Math.sign(lz);
        // Hip joint at the body corner; rotating it swings the whole leg.
        const hip = new TransformNode(`chaffHip_${lx}_${lz}`, scene);
        hip.position.set(lx, 0.66, lz);   // roots tucked INSIDE the body so legs connect
        const restZ    =  sx * 0.70;  // splay feet OUT to the side, away from body
        const restX    = -sz * 0.56;  // splay feet fore/aft, away from body ends
        hip.rotation.z = restZ;
        hip.rotation.x = restX;
        hip.parent = this.root;

        // Upper "thigh" + lower "shin" hang under the hip, reaching the ground.
        const upper = MeshBuilder.CreateCylinder('chaffLegU', { height: 0.5, diameter: 0.15, tessellation: 6 }, scene);
        upper.position.set(0, -0.22, 0);
        upper.material = legMat;
        upper.parent = hip;

        const lower = MeshBuilder.CreateCylinder('chaffLegL', { height: 0.5, diameter: 0.12, tessellation: 6 }, scene);
        lower.position.set(0, -0.58, 0);
        lower.material = legMat;
        lower.parent = hip;

        // Diagonal pairs share a phase (sx*sz > 0 → PI offset from the other pair).
        const phaseOffset = sx * sz > 0 ? Math.PI : 0;
        this._legs.push({ hip, restX, restZ, sx, phaseOffset });
      }
    }

    // Sensor head: a dark dome on the turret pivot that swivels to track the
    // player, with a glowing red eye on its front. The eye IS the weapon — it
    // fires the laser bolts (no gun). Very Duckov spider-bot.
    this.turret = MeshBuilder.CreateSphere('chaffSensorDome', { diameter: 0.58, segments: 10 }, scene);
    this.turret.scaling.set(1.0, 0.7, 1.05);
    this.turret.position.set(0, 0.32, 0.05);
    this.turret.material = this.hullMat;
    this.turret.parent = this.turretPivot;

    this.eyeMat = eyeMat;
    this.eye = MeshBuilder.CreateSphere('chaffEye', { diameter: 0.24, segments: 10 }, scene);
    this.eye.scaling.set(1.1, 1.1, 0.6);
    this.eye.position.set(0, 0.32, 0.30);   // front of the dome
    this.eye.material = eyeMat;
    this.eye.parent = this.turretPivot;
  }

  // Only the body + sensor dome cast shadows (the eye is emissive, the legs are
  // thin); override so the inherited addShadows doesn't touch a removed barrel.
  addShadows(shadowGen) {
    if (this.hull && !this.hull.isAnInstance)   shadowGen.addShadowCaster(this.hull);
    if (this.turret && !this.turret.isAnInstance) shadowGen.addShadowCaster(this.turret);
  }

  // Fire a single laser bolt from the eye with azimuth spread, in bursts so the
  // stream stays readable (the player must be able to boost across the gaps).
  _fire() {
    const bolt = this.shells.find(s => !s.active);
    if (!bolt) return;
    const tip = this._barrelTip();
    const spread = (Math.random() - 0.5) * 2 * LASER_SPREAD;
    const aim = this.turretAimAngle + spread;
    bolt.fire(
      tip.x, tip.y, tip.z,
      Math.sin(aim) * LASER_HSPEED, 0, Math.cos(aim) * LASER_HSPEED,
      LASER_RANGE,
    );
    audio.play('enemy.chaff_laser_fire', { emitter: this.root });

    // Burst cadence: after LASER_BURST bolts, take a longer regroup pause.
    this._burstLeft -= 1;
    if (this._burstLeft <= 0) {
      this._burstLeft = LASER_BURST;
      this.fireCooldown = LASER_REGROUP;
    } else {
      this.fireCooldown = LASER_INTERVAL;
    }
    this._eyeFlash = 1;   // eye pulses bright on the shot (no recoil — it's a laser)
  }

  update(dt, playerPos) {
    super.update(dt, playerPos);
    if (this.alive) {
      this._moveBeep(dt);   // fast high beep-beep-beep while it advances
      this._animateLegs(dt);
      this._updateEye(dt);
    }
  }

  // Fast movement blip: only while actually moving (distance/sec over threshold).
  _moveBeep(dt) {
    const STEP_INTERVAL = 0.28, MOVE_THRESH = 0.6;
    const { x, z } = this.root.position;
    const sp = (this._bpx !== undefined) ? Math.hypot(x - this._bpx, z - this._bpz) / Math.max(dt, 1e-3) : 0;
    this._bpx = x; this._bpz = z;
    this._stepT = (this._stepT ?? 0) - dt;
    if (sp > MOVE_THRESH && this._stepT <= 0) {
      audio.play('enemy.chaff_step', { emitter: this.root });
      this._stepT = STEP_INTERVAL;
    }
  }

  // Pulse the eye brighter right after a shot, decaying back to its base glow.
  _updateEye(dt) {
    if (this._eyeFlash > 0) this._eyeFlash = Math.max(0, this._eyeFlash - dt / 0.12);
    const g = 1 + this._eyeFlash * 1.6;
    this.eyeMat.emissiveColor.set(EYE_RED[0] * g, EYE_RED[1] * g, EYE_RED[2] * g);
  }

  // Procedural skitter: legs swing fore-aft at a cadence tied to ground speed,
  // diagonal pairs in antiphase, plus a small body bob. Eases to a still stance
  // when stopped so a stationary bot doesn't twitch.
  _animateLegs(dt) {
    const moving = Math.abs(this.speed);
    this._gaitSpeed += (moving - this._gaitSpeed) * Math.min(1, dt * 8);
    this._gaitPhase += this._gaitSpeed * GAIT_FREQ * dt;
    const amp = Math.min(1, this._gaitSpeed / 4);

    if (this._legs.length && this._legs[0].pivot) {
      // GLB walker: swing each rigged hip pivot fore-aft (diagonal trot), with a
      // small outward lift on the forward half + a body bob — the skitter.
      const swing = 0.34 * amp;
      for (const leg of this._legs) {
        const ph = this._gaitPhase + leg.phaseOffset;
        leg.pivot.rotation.x = Math.sin(ph) * swing;
        leg.pivot.rotation.z = leg.sx * Math.max(0, Math.cos(ph)) * 0.18 * amp;
      }
      if (this._holder) this._holder.position.y = this._holderBaseY + Math.abs(Math.sin(this._gaitPhase)) * 0.05 * amp;
    } else if (this._legs.length) {
      // Primitive walker fallback: swing each hip pivot for the skitter.
      const swing = GAIT_SWING * amp;
      for (const leg of this._legs) {
        const ph = this._gaitPhase + leg.phaseOffset;
        leg.hip.rotation.x = leg.restX + Math.sin(ph) * swing;
        leg.hip.rotation.z = leg.restZ + leg.sx * Math.max(0, Math.cos(ph)) * 0.35 * amp;
      }
      this.hull.position.y = this._bodyBaseY + Math.abs(Math.sin(this._gaitPhase)) * GAIT_BOB * amp;
    }
  }

  _deathVisuals() {
    audio.play('enemy.chaff_death', { emitter: this.root });
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(0.18, 0.18, 0.20, 1);
    else if (this.hullMat) {   // primitive fallback
      this.hullMat.diffuseColor.set(...DEATH_TINT);
      this.hullMat.emissiveColor = new Color3(0.02, 0.01, 0.0);
      this.legMat?.diffuseColor.set(0.06, 0.06, 0.07);
    }
    if (this.eyeMat) this.eyeMat.emissiveColor.set(0.04, 0.01, 0.01);
  }

  _reviveVisuals() {
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(1, 1, 1, 1);
    else if (this.hullMat) {
      this.hullMat.diffuseColor.set(...BODY_STEEL);
      this.hullMat.emissiveColor = new Color3(0, 0, 0);
      this.legMat?.diffuseColor.set(...LEG_DARK);
    }
    if (this.eyeMat) this.eyeMat.emissiveColor.set(...EYE_RED);
  }
}
