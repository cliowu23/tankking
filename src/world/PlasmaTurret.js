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
const STUN_SECONDS  = 1.4;   // player freeze on a clean beam hit — the punish for not dodging/parrying
const LEAD_MAX      = 12;    // cap on how far ahead of a moving player the gun leads (u)
const DEATH_BURST_R = 5.5;   // explosion radius when it dies
const TELEGRAPH     = 0.4;   // final pre-fire window: aim LOCKS + glow flares + 2-stage beep — the dodge cue
// 2-stage warning beep (reuses the sentinel/mortar charge tone — that lower pitch, kept low):
const BEEP1_RATE    = 1.0;   // stage 1 (telegraph start): the normal low tone
const BEEP2_RATE    = 1.25;  // stage 2 (just before fire): a touch higher = "NOW", still in the low family
const BEEP2_LEAD    = 0.14;  // how long before the shot the stage-2 tick fires
const SCREEN_MARGIN = 0.02;
const GUN_FILE  = 'turret-gun.glb';
const BASE_FILE = 'turret-bunker.glb';

export default class PlasmaTurret extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      ...opts,
      noPrimitiveVisuals: true,           // the base is the POI prop; the gun loads below
      static: true,                       // dug in — the body never moves (gun stays on the base)
      aggroRange: opts.aggroRange ?? 40,  // engage as you near the stronghold
    });
    this.hp = this.maxHp = opts.hp ?? 170;          // ~5 clean shots to crack (34 dmg ea; ~3-4 with crits)
    this.shellDamage = opts.damage ?? 60;           // heavy plasma hit
    this.hitStun     = opts.hitStun ?? STUN_SECONDS; // a connecting beam STUNS the player (ArenaScene applies)
    this._deathBurstR = DEATH_BURST_R;               // ArenaScene fires the explosion on death
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
    this._bodyMeshes = [];                            // gun + base meshes — swapped to a dead material on death
    this._pvx = 0; this._pvz = 0; this._prevP = null; // smoothed player velocity, for leading the shot
    this.hpBarBg.position.y = this.hpBarFill.position.y = 3.6;  // float the bar above the tall bunker+gun
    this._buildChargeGlow(scene);
    // selfBase = also build the static armoured BASE (for the Dev Arena, where there's no POI prop).
    // As a road POI the base is the POI prop, so the enemy only needs the gun.
    this.ready = this._buildModel(scene, !!opts.selfBase);
  }

  async _buildModel(scene, selfBase) {
    if (selfBase) await this._loadInto(scene, BASE_FILE, this.root);          // static base on the (hull-locked) body
    this._gunRoot = await this._loadInto(scene, GUN_FILE, this.turretPivot);  // gun on the aiming pivot → yaw-tracks
    this._findMuzzle();   // locate the real cannon tip — the separate bore mesh sits in a DIFFERENT
    return this;          // GLB node frame (~1.45 off the barrel), so we derive the muzzle from the cannon itself
  }

  // Find the cannon barrel and its muzzle point from GEOMETRY (the authored bore mesh is parented
  // under a different node than the barrel and lands ~1.45 off-axis — so we ignore it and take the
  // gun mesh that protrudes furthest forward, then the centroid of its forward-most vertex ring).
  _findMuzzle() {
    let best = null, bestZ = -Infinity, bestPos = null;
    for (const m of this.turretPivot.getChildMeshes()) {
      if (!/TurretGun/i.test(m.name)) continue;             // gun primitives only (skip the stray bore disk)
      const pos = m.getVerticesData('position'); if (!pos) continue;
      let maxZ = -Infinity; for (let i = 0; i < pos.length; i += 3) if (pos[i + 2] > maxZ) maxZ = pos[i + 2];
      if (maxZ > bestZ) { bestZ = maxZ; best = m; bestPos = pos; }   // the cannon sticks out furthest (+Z = forward)
    }
    if (!best) return;
    this._cannonMesh = best;
    let sx = 0, sy = 0, sz = 0, n = 0;                       // centroid of the muzzle-ring verts → the bore centre
    for (let i = 0; i < bestPos.length; i += 3) {
      if (bestPos[i + 2] > bestZ - 0.5) { sx += bestPos[i]; sy += bestPos[i + 1]; sz += bestPos[i + 2]; n++; }
    }
    this._muzzleLocal = new Vector3(sx / n, sy / n, sz / n); // in the cannon mesh's own frame → always on the barrel
    if (this._boreMesh) this._boreMesh.setEnabled(false);    // hide the off-axis authored bore disk
  }

  // Import a GLB and parent it under `parent`, flattening its materials to match the base prop.
  async _loadInto(scene, file, parent) {
    const res = await SceneLoader.ImportMeshAsync('', '/assets/models/props/', file, scene);
    const root = res.meshes.find(m => m.name === '__root__') || (res.meshes[0] && res.meshes[0].parent);
    if (root) { root.parent = parent; root.position.set(0, 0, 0); }
    for (const m of res.meshes) {
      if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
      const c = m.material && (m.material.albedoColor || m.material.diffuseColor);
      const rgb = c ? [c.r, c.g, c.b] : [0.4, 0.4, 0.4];
      m.material = this._gunMat(scene, rgb);
      m.isPickable = false;
      this._bodyMeshes.push(m);                        // for the death darken (swap, not mutate shared mats)
      if (/bore/i.test(m.name)) this._boreMesh = m;   // the real muzzle disk — the glow/beam snap to it
      if (!root) m.parent = parent;
    }
    return root;
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
    this._telegraphed = false; this._beep2 = false; this._lockedAim = null;   // fresh charge: not committed yet
    this.fireCooldown = 999;
    audio.play('enemy.sentinel_beam_charge', { emitter: this.root });
  }

  update(dt, playerPos) {
    this._trackVel(dt, playerPos);     // smooth the player's velocity for leading
    super.update(dt, playerPos);       // tracks the player (turretPivot yaw) + runs the base fire gate
    if (!this.alive) { if (this._glow) this._glow.setEnabled(false); return; }
    this._updateCharge(dt);
    this._updateGlow(dt);
  }

  _trackVel(dt, p) {
    if (this._prevP && dt > 0) {
      const vx = (p.x - this._prevP.x) / dt, vz = (p.z - this._prevP.z) / dt;
      const a = 1 - Math.exp(-6 * dt);                 // low-pass so a single jitter frame can't swing the lead
      this._pvx += (vx - this._pvx) * a;
      this._pvz += (vz - this._pvz) * a;
    }
    this._prevP = { x: p.x, z: p.z };
  }

  // LEAD the shot: aim where the player will be when the beam ARRIVES (travel time = dist / speed),
  // using smoothed velocity and capped. Hold a straight line and you get clipped; juke as it fires
  // (charge glow near full) and the beam streaks through empty grass — the timing dodge.
  _aimTarget(p) {
    // Telegraph: hold the committed line (a far point along the locked angle) so dodging works.
    if (this._lockedAim != null) {
      return { x: this.root.position.x + Math.sin(this._lockedAim) * 100, y: p.y,
               z: this.root.position.z + Math.cos(this._lockedAim) * 100 };
    }
    const dx = p.x - this.root.position.x, dz = p.z - this.root.position.z;
    const lead = Math.hypot(dx, dz) / BEAM_SPEED;
    let lx = this._pvx * lead, lz = this._pvz * lead;
    const ld = Math.hypot(lx, lz);
    if (ld > LEAD_MAX) { lx = lx / ld * LEAD_MAX; lz = lz / ld * LEAD_MAX; }
    return { x: p.x + lx, y: p.y, z: p.z + lz };
  }

  // Death look: big explosion is spawned by ArenaScene (via _deathBurstR); here we just turn the
  // machine DARK (placeholder dead-metal), swapping each body mesh to a shared dead material so we
  // never mutate the cached propflat mats shared with other props. Kills the charge + glow too.
  _deathVisuals() {
    let dead = this.scene.getMaterialByName('turretDeadMat');
    if (!dead) {
      dead = new StandardMaterial('turretDeadMat', this.scene);
      dead.diffuseColor  = new Color3(0.09, 0.07, 0.07);
      dead.specularColor = new Color3(0.02, 0.02, 0.02);
      dead.emissiveColor = new Color3(0.02, 0.006, 0.006);
    }
    for (const m of this._bodyMeshes) m.material = dead;
    this._charging = false;
    if (this._glow) this._glow.setEnabled(false);
  }

  _updateCharge(dt) {
    if (!this._charging) return;
    this._chargeT += dt;
    // Final telegraph (last TELEGRAPH s): COMMIT the aim (stop leading) + flare + 2-stage beep.
    // The locked line + flare (see _updateGlow) is the "dodge NOW" window — break your vector and you
    // clear the beam; the gun no longer follows you.
    // Stage 1 — lock + flare start + first (low) warning beep.
    if (!this._telegraphed && this._chargeT >= CHARGE_TIME - TELEGRAPH) {
      this._telegraphed = true;
      this._lockedAim = this.turretAimAngle;
      audio.play('enemy.sentinel_beam_charge', { emitter: this.root, rate: BEEP1_RATE });
    }
    // Stage 2 — the final "fire now" tick a beat before the beam.
    if (!this._beep2 && this._chargeT >= CHARGE_TIME - BEEP2_LEAD) {
      this._beep2 = true;
      audio.play('enemy.sentinel_beam_charge', { emitter: this.root, rate: BEEP2_RATE });
    }
    if (this._chargeT >= CHARGE_TIME) this._release();
  }

  // Muzzle = the cannon barrel's own forward tip (its mesh-local muzzle point pushed through its
  // world matrix), so the glow + beam ALWAYS leave the visible barrel. Direction = turret centre → tip.
  _muzzle() {
    this._cannonMesh.computeWorldMatrix(true);
    const pos = Vector3.TransformCoordinates(this._muzzleLocal, this._cannonMesh.getWorldMatrix());
    const dx = pos.x - this.root.position.x, dz = pos.z - this.root.position.z;
    const len = Math.hypot(dx, dz) || 1;
    return { pos, dir: new Vector3(dx / len, 0, dz / len) };
  }

  _release() {
    this._charging = false; this._chargeT = 0;
    this._lockedAim = null; this._telegraphed = false; this._beep2 = false;   // resume tracking/leading next charge
    if (!this._cannonMesh) return;   // gun not loaded yet
    const mz = this._muzzle();
    const beam = this.shells.find(s => !s.active);
    if (beam) beam.fire(mz.pos.x, this._beamY, mz.pos.z, mz.dir.x * BEAM_SPEED, 0, mz.dir.z * BEAM_SPEED, BEAM_RANGE);
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
    if (!this._cannonMesh) { this._glow.setEnabled(false); return; }   // wait for the gun (with its barrel) to load
    if (this._flash > 0) this._flash = Math.max(0, this._flash - dt / 0.18);
    if (this._charging || this._flash > 0) {
      this._glow.setEnabled(true);
      this._glow.setAbsolutePosition(this._muzzle().pos);            // snap to the real muzzle disk
      const t = this._charging ? Math.min(1, this._chargeT / CHARGE_TIME) : 0;
      let scale = 0.3 + t * 1.0 + this._flash * 0.9;
      // Telegraph FLARE: the core swells hard over the final window — the visual "dodge now" cue.
      if (this._charging && this._chargeT >= CHARGE_TIME - TELEGRAPH) {
        const tg = Math.min(1, (this._chargeT - (CHARGE_TIME - TELEGRAPH)) / TELEGRAPH);   // 0 → 1 across it
        scale += tg * 1.9;
      }
      this._glow.scaling.setAll(scale);
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
