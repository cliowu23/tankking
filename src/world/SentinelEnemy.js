// src/world/SentinelEnemy.js
// World 1's standard grunt: the Sentinel-bot. A BOTW-Guardian-inspired machine —
// a single big tracking EYE in a rounded armored dome, mounted as the "turret" on
// a low, wide rolling chassis. Replaces the old painted-red light tank so every
// W1 enemy reads as one of the King's machines (cold gunmetal, glowing eye, no
// heraldry); the player tank stays the warm human outlier.
//
// Weapon is a CHARGED eye-beam, not a gun: the eye winds up (red → orange →
// white-hot tell, ~CHARGE_TIME), then discharges one heavy EyeBeam. You read the
// tell and roll out of the firing line — a "dodge the beam" duel, not shell-trading.
//
// Extends AIEnemy and reuses its state machine + turret tracking; swaps the
// single-shell cannon for the eye-beam (override _fire to BEGIN a charge, release
// it from update). Each hit applies this.shellDamage via the existing enemy-shell
// hit path in ArenaScene._checkShellHits — no special-casing.
//
// VISUALS ARE A PLACEHOLDER built from primitives (the real model is a separate
// Blender GLB task). _buildPlaceholder is the seam: when the GLB lands, swap it
// for an async _buildComposed (load chassis → root, dome → turretPivot) and set
// this.ready to that promise — the beam/charge logic below is model-agnostic.
import { MeshBuilder, StandardMaterial, Color3, Color4, TransformNode, Vector3, Matrix, Quaternion } from '@babylonjs/core';
import AIEnemy from './AIEnemy.js';
import EyeBeam from '../combat/EyeBeam.js';
import { loadEnemyTemplate } from './enemyModels.js';
import { audio } from '../core/audio/AudioManager.js';

// Mesh names (Blender object names) that belong on the rotating turret/dome.
const TURRET_PARTS = ['dome', 'eye', 'eyering', 'eyesocket', 'antenna', 'anttip'];
const isTurretMesh = (n) => { n = (n || '').toLowerCase(); return TURRET_PARTS.some(t => n === t || n.startsWith(t + '.') || n.startsWith(t + '_')); };

const BEAM_POOL   = 3;                  // single heavy shot + recovery — no stream needed
const BEAM_HSPEED = 80;                 // fast: it's dodged via the tell, not the bolt
const BEAM_RANGE  = 60;                 // despawn distance
const CHARGE_TIME = 1.1;                // wind-up tell before the beam releases (s)

const BODY_STEEL = [0.40, 0.43, 0.47];  // cold gunmetal — the King's machine palette
const TRIM_STEEL = [0.50, 0.53, 0.57];  // lighter steel — fenders, sprockets, deck trim
const DARK_METAL = [0.12, 0.13, 0.15];  // tracks, wheels, cowl, antenna
const EYE_BASE   = [1.0, 0.12, 0.10];   // idle red eye glow
const DEATH_TINT = [0.10, 0.10, 0.11];

export default class SentinelEnemy extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      aiSpeed: 4.5,        // planted/heavy — slower than the old light tank
      optimalRange: 16,    // hangs back and beams you
      aggroRange: 26,
      ...opts,
      noPrimitiveVisuals: true,   // we draw our own placeholder below
    });

    this._halfW = 1.30;  // chassis footprint ~2.6 wide (slab overhangs the tracks)
    this._halfD = 1.80;  // ~3.6 long (sloped nose + rear plate)
    this._rotateSpeed  = 1.0;                  // turns slowly (it's a heavy bot)
    this._aimTolerance = 8 * Math.PI / 180;    // commits to a charge when roughly on target
    this._tipOffset    = 0.12;                 // bolt spawn just ahead of the eye lens

    // Charge bookkeeping (drives the wind-up tell + the discharge flash).
    this._charging = false;
    this._chargeT  = 0;
    this._eyeFlash = 0;        // 0..1, bright flash on discharge, decays to idle

    // Swap the inherited 4-shell cannon pool for an eye-beam pool.
    for (const s of this.shells) s.deactivate?.();
    this.shells = Array.from({ length: BEAM_POOL }, () => new EyeBeam(scene));

    // Load the Blender GLB; fall back to the primitive placeholder if it fails.
    this.ready = this._buildComposed(scene).catch((e) => {
      console.error('[sentinel] GLB load failed, using placeholder:', e);
      this._buildPlaceholder(scene);
      this.barrelPivot.position.set(0, this._eyeLocal.y, this._eyeLocal.z);
      this._barrelBaseZ = this._eyeLocal.z;
      return this;
    });
  }

  // Make one of our flat StandardMaterials (matches the game look; PBR washes out).
  _mat(name, rgb, spec = [0.16, 0.18, 0.21], emissive = false) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = new Color3(...rgb);
    if (emissive) { m.emissiveColor = new Color3(...rgb); m.disableLighting = true; }
    else m.specularColor = new Color3(...spec);
    return m;
  }

  async _buildComposed(scene) {
    const tpl = await loadEnemyTemplate(scene, 'sentinel',
      { body: BODY_STEEL, dark: DARK_METAL, trim: TRIM_STEEL, eye: EYE_BASE });
    const id = (SentinelEnemy._n = (SentinelEnemy._n || 0) + 1);

    // Holder flips the model 180° (front/eye → +Z local) + lifts the tracks onto the ground.
    const holder = new TransformNode('sentinelHolder', scene);
    holder.parent = this.root;
    holder.rotation.y = Math.PI;
    holder.position.y = 0.25;

    this.eyeMat = this._mat('sentEye', EYE_BASE, null, true);   // per-enemy eye glow
    this._tint = [];                                            // instances we death-tint
    const made = [];
    for (const part of tpl.parts) {
      let node;
      if (part.isEye) {
        node = part.mesh.clone(`sEye_${id}`, null);   // cloned (own material) so each bot charges independently
        node.setEnabled(true);
        node.material = this.eyeMat;
        this.eye = node;
      } else {
        node = part.mesh.createInstance(`s_${part.name}_${id}`);   // GPU-batched; geometry shared
        node.instancedBuffers.color = new Color4(1, 1, 1, 1);
        this._tint.push(node);
      }
      node.rotationQuaternion = new Quaternion();
      part.matrix.decompose(node.scaling, node.rotationQuaternion, node.position);   // model-space layout
      node.parent = holder;
      node.isPickable = false;
      const nm = part.name.toLowerCase();
      if (nm.startsWith('hull')) this.hull = node;
      if (nm.startsWith('dome')) this.turret = node;
      made.push({ node, name: part.name, isEye: part.isEye });
    }

    // Dome/eye → turret pivot (preserve world) so the eye tracks the player.
    for (const m of made) if (m.isEye || isTurretMesh(m.name)) m.node.setParent(this.turretPivot);

    // Beam muzzle = the eye lens (bbox centre, not the baked node origin), in turret-pivot space.
    if (this.eye) {
      this.turretPivot.computeWorldMatrix(true);
      this.eye.computeWorldMatrix(true);
      const eyeW = this.eye.getBoundingInfo().boundingBox.centerWorld;
      const inv = Matrix.Invert(this.turretPivot.getWorldMatrix());
      const eyeLocal = Vector3.TransformCoordinates(eyeW, inv);
      this.barrelPivot.position.copyFrom(eyeLocal);
      this._barrelBaseZ = eyeLocal.z;
    }

    this.hpBarBg.position.y = 2.95;
    this.hpBarFill.position.y = 2.95;
    return this;
  }

  _buildPlaceholder(scene) {
    this.bodyMat = new StandardMaterial('sentinelBody', scene);
    this.bodyMat.diffuseColor  = new Color3(...BODY_STEEL);
    this.bodyMat.specularColor = new Color3(0.18, 0.20, 0.24);

    this.darkMat = new StandardMaterial('sentinelDark', scene);
    this.darkMat.diffuseColor  = new Color3(...DARK_METAL);
    this.darkMat.specularColor = new Color3(0.05, 0.05, 0.06);

    this.trimMat = new StandardMaterial('sentinelTrim', scene);
    this.trimMat.diffuseColor  = new Color3(...TRIM_STEEL);
    this.trimMat.specularColor = new Color3(0.20, 0.22, 0.26);

    this.eyeMat = new StandardMaterial('sentinelEye', scene);
    this.eyeMat.diffuseColor    = new Color3(...EYE_BASE);
    this.eyeMat.emissiveColor   = new Color3(...EYE_BASE);
    this.eyeMat.disableLighting = true;

    // --- Chassis (Tiger-inspired: hull tub + overhanging slab superstructure,
    // stepped sloped glacis, road wheels, fenders, side skirts, rear exhausts) ---
    const TRACK_X = 1.18;
    // Small local builders so the symmetric track gear stays DRY.
    const part = (name, w, h, d, x, y, z, mat, rx = 0) => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      m.material = mat;
      m.parent = this.root;
      return m;
    };
    const wheel = (name, dia, x, y, z, mat) => {
      const m = MeshBuilder.CreateCylinder(name, { height: 0.18, diameter: dia, tessellation: 12 }, scene);
      m.rotation.z = Math.PI / 2;   // axle runs across the hull
      m.position.set(x, y, z);
      m.material = mat;
      m.parent = this.root;
      return m;
    };

    // Lower hull tub (rides between the tracks).
    part('sentinelTub', 1.95, 0.42, 3.0, 0, 0.30, 0, this.bodyMat);
    // Upper superstructure — the slab box that OVERHANGS the tracks (Tiger signature).
    this.hull = part('sentinelHull', 2.6, 0.46, 2.5, 0, 0.62, 0, this.bodyMat);
    // Stepped front: sloped glacis over a near-vertical lower nose plate.
    part('sentinelGlacis', 2.3, 0.55, 0.95, 0, 0.55, 1.42, this.bodyMat, -0.62);
    part('sentinelNose',   2.05, 0.50, 0.16, 0, 0.30, 1.55, this.bodyMat, 0.18);
    // Angled rear plate + twin exhaust stubs.
    part('sentinelRear', 2.3, 0.5, 0.18, 0, 0.55, -1.45, this.bodyMat, 0.30);
    for (const sx of [-1, 1]) {
      const ex = MeshBuilder.CreateCylinder('sentinelExhaust', { height: 0.5, diameter: 0.16, tessellation: 8 }, scene);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(sx * 0.7, 0.62, -1.62);
      ex.material = this.darkMat;
      ex.parent = this.root;
    }
    // Track band + interleaved road wheels + drive sprocket/idler + fender + skirt (mirrored).
    for (const sx of [-1, 1]) {
      part('sentinelTrack', 0.40, 0.50, 3.3, sx * TRACK_X, 0.28, 0, this.darkMat);
      for (let i = 0; i < 5; i++) wheel('sentinelWheel', 0.50, sx * TRACK_X, 0.30, -1.3 + i * 0.65, this.darkMat);
      wheel('sentinelSprocket', 0.62, sx * TRACK_X, 0.33,  1.55, this.trimMat);
      wheel('sentinelIdler',    0.60, sx * TRACK_X, 0.33, -1.55, this.trimMat);
      part('sentinelFender', 0.55, 0.08, 3.5, sx * (TRACK_X + 0.02), 0.58, 0, this.trimMat);
      part('sentinelSkirt',  0.06, 0.40, 2.3, sx * 1.34, 0.60, 0.1, this.darkMat);
    }
    // Deck details: a collar seating the eye-dome + a vent grille + a hatch.
    const collar = MeshBuilder.CreateCylinder('sentinelCollar', { height: 0.12, diameter: 1.4, tessellation: 16 }, scene);
    collar.position.set(0, 0.86, 0);
    collar.material = this.bodyMat;
    collar.parent = this.root;
    part('sentinelVent',  0.5, 0.10, 0.7, -0.7, 0.87, -0.7, this.darkMat);
    part('sentinelHatch', 0.5, 0.12, 0.5,  0.65, 0.88, -0.6, this.trimMat);
    // Front sensor visor slit on the glacis.
    part('sentinelVisor', 1.0, 0.12, 0.1, 0, 0.62, 1.62, this.darkMat);

    // --- Eye-dome on the turret pivot (swivels to track the player) ---
    // turretPivot sits at y≈0.55; everything here is local to it.
    this.turret = MeshBuilder.CreateSphere('sentinelDome', { diameter: 1.5, segments: 12 }, scene);
    this.turret.scaling.set(1.05, 0.80, 1.15);   // flattened armored dome
    this.turret.position.set(0, 0.45, 0.0);
    this.turret.material = this.bodyMat;
    this.turret.parent = this.turretPivot;

    // Dark cowl/brow over the eye — gives the single eye a menacing hood.
    const cowl = MeshBuilder.CreateBox('sentinelCowl', { width: 1.05, height: 0.30, depth: 0.55 }, scene);
    cowl.position.set(0, 0.66, 0.62);
    cowl.rotation.x = -0.35;
    cowl.material = this.darkMat;
    cowl.parent = this.turretPivot;

    // The eye: a big emissive lens on the dome front. This is the muzzle.
    this._eyeLocal = { y: 0.42, z: 0.78 };
    this.eye = MeshBuilder.CreateSphere('sentinelEyeLens', { diameter: 0.58, segments: 12 }, scene);
    this.eye.scaling.set(1.15, 1.05, 0.55);
    this.eye.position.set(0, this._eyeLocal.y, this._eyeLocal.z);
    this.eye.material = this.eyeMat;
    this.eye.parent = this.turretPivot;

    // Networked-machine motif: a thin antenna stub on top of the dome.
    const antenna = MeshBuilder.CreateCylinder('sentinelAntenna', { height: 0.7, diameter: 0.06, tessellation: 6 }, scene);
    antenna.position.set(0.32, 1.0, -0.2);
    antenna.material = this.darkMat;
    antenna.parent = this.turretPivot;

    // Raise the hp bar above the dome silhouette.
    const barY = 2.1;
    this.hpBarBg.position.y = barY;
    this.hpBarFill.position.y = barY;
  }

  // Body + dome + tracks cast shadows; the eye is emissive and the antenna is
  // thin. Override so inherited addShadows doesn't reach for a removed barrel.
  addShadows(shadowGen) {
    // Instanced GLB meshes don't take real-time shadow maps here (target GPU uses
    // blob shadows anyway); only the primitive fallback's real meshes do.
    if (this.hull && !this.hull.isAnInstance)   shadowGen.addShadowCaster(this.hull);
    if (this.turret && !this.turret.isAnInstance) shadowGen.addShadowCaster(this.turret);
  }

  // _fire (called by AIEnemy when in COMBAT, off cooldown, roughly aimed) BEGINS
  // the wind-up rather than firing. The beam is released from update() once the
  // charge completes; park fireCooldown so the base loop won't retrigger mid-charge.
  _fire() {
    if (this._charging) return;
    this._charging = true;
    this._chargeT  = 0;
    this.fireCooldown = 999;
    audio.play('enemy.sentinel_beam_charge', { emitter: this.root }); // the dodge tell
  }

  update(dt, playerPos) {
    super.update(dt, playerPos);
    if (this.alive) {
      if (!this._whir) this._whir = audio.attachLoop('enemy.sentinel_whir', this.root); // lazy: retries until ready
      this._updateCharge(dt);
      this._updateEye(dt);
    }
  }

  _updateCharge(dt) {
    if (!this._charging) return;
    // Abort the wind-up if the player slips out of the fight (fled / broke LoS).
    if (this.state !== 'COMBAT') {
      this._charging = false;
      this._chargeT  = 0;
      this.fireCooldown = 0.4;
      return;
    }
    this._chargeT += dt;
    if (this._chargeT >= CHARGE_TIME) this._releaseBeam();
  }

  _releaseBeam() {
    this._charging = false;
    this._chargeT  = 0;
    const beam = this.shells.find(s => !s.active);
    if (beam) {
      const tip = this._barrelTip();
      const aim = this.turretAimAngle;
      // Clamp emit height: the eye sits near the y<1.6 hit-gate ceiling, so keep
      // the flat beam under it (on a fat beam the offset from the lens is invisible).
      const ty = Math.min(tip.y, 1.45);
      beam.fire(
        tip.x, ty, tip.z,
        Math.sin(aim) * BEAM_HSPEED, 0, Math.cos(aim) * BEAM_HSPEED,
        BEAM_RANGE,
      );
    }
    this._eyeFlash = 1;                              // bright discharge flash
    audio.play('enemy.sentinel_beam_fire', { emitter: this.root });
    this.fireCooldown = this._fireCooldownDuration;  // recovery before next charge
  }

  // Eye glow: idle red → winds up orange → white-hot pulsing during the charge →
  // a bright discharge flash that decays back to idle red.
  _updateEye(dt) {
    if (this._eyeFlash > 0) this._eyeFlash = Math.max(0, this._eyeFlash - dt / 0.14);
    let r, g, b;
    if (this._charging) {
      const t = Math.min(1, this._chargeT / CHARGE_TIME);
      const pulse = 1 + Math.sin(this._chargeT * (6 + t * 18)) * 0.18 * t;
      r = 1.0 * pulse;
      g = (0.12 + t * 0.85) * pulse;       // red → orange
      b = (0.10 + t * t * 0.85) * pulse;   // ramps late → white-hot
    } else {
      const f = 1 + this._eyeFlash * 2.2;
      r = EYE_BASE[0] * f; g = EYE_BASE[1] * f; b = EYE_BASE[2] * f;
    }
    this.eyeMat.emissiveColor.set(r, g, b);
  }

  reset(x, z) {
    super.reset(x, z);
    this._charging = false;
    this._chargeT  = 0;
    this._eyeFlash = 0;
  }

  _deathVisuals() {
    audio.play('enemy.sentinel_death', { emitter: this.root });
    audio.detachLoop(this._whir); this._whir = null;
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(0.22, 0.22, 0.24, 1);
    else if (this.bodyMat) {   // primitive fallback
      this.bodyMat.diffuseColor.set(...DEATH_TINT);
      this.trimMat.diffuseColor.set(0.09, 0.09, 0.10);
      this.darkMat.diffuseColor.set(0.06, 0.06, 0.07);
    }
    if (this.eyeMat) this.eyeMat.emissiveColor.set(0.04, 0.01, 0.01);   // eye goes dark
  }

  _reviveVisuals() {
    if (this._tint) for (const n of this._tint) n.instancedBuffers.color.set(1, 1, 1, 1);
    else if (this.bodyMat) {
      this.bodyMat.diffuseColor.set(...BODY_STEEL);
      this.trimMat.diffuseColor.set(...TRIM_STEEL);
      this.darkMat.diffuseColor.set(...DARK_METAL);
    }
    if (this.eyeMat) this.eyeMat.emissiveColor.set(...EYE_BASE);
  }
}
