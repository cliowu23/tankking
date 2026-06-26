import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode } from '@babylonjs/core';
import Shell from '../combat/Shell.js';
import { shortAngle, hpColor } from '../utils/mathUtils.js';

const HSPEED = 35;
const BURY_DEPTH = 1.9;   // how far an emerger sinks below ground while hidden, before it rises/claws up
// Per-instance tint multiplier used for the stun blink. Instanced meshes can't take
// a per-instance material/emissive, but their tint channel (a MULTIPLY) can be driven
// above 1 to push diffuse colors up toward white. ~7× whites out gunmetal/dark parts.
const STUN_FLASH_GAIN = 7;

// --- §③ AI foundation: PATROL roaming + group spacing ---
const PATROL_SPEED_MULT = 0.5;   // roam at half aiSpeed — relaxed, not charging
const LEASH_DEFAULT     = 10;    // wander radius around the anchor if a patrol omits `leash`
const WANDER_ARRIVE     = 1.5;   // within this of the goal point → reached (advance / repick)
const WANDER_REPICK     = 4;     // seconds before forcing a fresh wander point (anti-loiter)
// "Light confidence" (W1): a unit with no nearby allies, or this wounded, plays cautious
// (kites instead of holding ground). The encirclement/high-aggression layers are W2+.
const CAUTIOUS_HP_FRAC  = 0.35;

export default class AIEnemy {
  // opts tune the unit (zone band tuning) and select behavior:
  //   hp, damage, cooldown, aiSpeed, optimalRange, aggroRange, bounds,
  //   ambush (start hidden, tight trigger radius, springs on nearby fire),
  //   noPrimitiveVisuals (subclass supplies its own meshes via _buildVisuals override)
  constructor(scene, x, z, opts = {}) {
    this.scene = scene;

    this.maxHp = opts.hp ?? 100;
    this.hp    = this.maxHp;
    this.alive = true;
    this.mass  = 4;
    this.staticFrictionThreshold = 1.0;
    this.vx    = 0;
    this.vz    = 0;
    this.bounds = opts.bounds ?? 48;   // playable half-extent; zones override
    this.shellDamage = opts.damage ?? 34;   // applied by ArenaScene._checkShellHits

    this._aiSpeed              = opts.aiSpeed ?? 4.5;
    this._rotateSpeed          = 1.2;
    this._turretSpeed          = 55 * Math.PI / 180;
    this._optimalRange         = opts.optimalRange ?? 15;
    this._aggroRange           = opts.aggroRange ?? 22;   // detect roughly on-screen only — shooting (hearNoise) wakes them from further, so this can stay tight
    this._aimTolerance         = 5 * Math.PI / 180;
    this._fireCooldownDuration = opts.cooldown ?? 2.0;

    this._ambush       = !!opts.ambush;
    this._ambushRadius = opts.ambushRadius ?? 14;
    // Dug-in emplacement flags: a _static unit never moves/separates (holds its anchor); a
    // _fixedAimAngle (world radians) locks the turret to one lane instead of tracking. Used by
    // PlasmaTurret — see turretBunker. Default null/false → normal mobile, tracking enemy.
    this._static        = !!opts.static;
    this._fixedAimAngle = (opts.fixedAim ?? null);
    // Emergence: a hidden POI unit reveals itself on wake (EMERGE state) instead of sliding out.
    //   'burrow' — buried below ground, CLAWS UP in place (saved for future burrow-bots).
    //   'door'   — waits INSIDE the building, then DRIVES OUT the front door in single file
    //              (staggered by _exitOrder, along the door normal _exitNormal). W1 POI vibe.
    this._emerge       = !!opts.emerge;
    this._emergeStyle  = opts.emerge === 'door' ? 'door' : (opts.emerge ? 'burrow' : null);
    this._exitNormal   = opts.door || null;     // { nx, nz } outward through the doorway
    this._exitOrder    = opts.exitOrder ?? 0;    // queue position → exit stagger
    this._emergeT      = 0;
    this._emergeDur    = 0.7;   // burrow: seconds to rise out
    this._hidden       = false; // emergers are fully UN-RENDERED until they reveal (set after the rig is built)

    // Patrol config from the spawn layer: either { anchor:[x,z], leash } (wander an
    // area) or { route:[[x,z]…], loop } (walk waypoints). Null = static IDLE/AMBUSH.
    this._patrol       = opts.patrol || null;
    this._wanderTarget = null;   // [x,z] current wander goal (anchor mode)
    this._wanderT      = 0;      // countdown to forced repick
    this._routeIdx     = 0;      // current waypoint (route mode)
    this._routeDir     = 1;      // ping-pong direction for non-looping routes
    // Group steering, written each frame by ArenaScene's pre-pass, consumed in update().
    this._sepX = 0; this._sepZ = 0;   // separation nudge (anti-clump)
    this._nearbyAllies = 0;           // living allies in range (feeds light confidence)

    this.rotY            = Math.PI; // face south toward player spawn
    this.speed           = 0;
    this.turretAimAngle  = Math.PI;
    this.barrelElevation = 0;
    this._initialState   = this._patrol ? 'PATROL' : (this._ambush ? 'AMBUSH' : 'IDLE');
    this.state           = this._initialState;
    this.fireCooldown    = 1.5; // brief delay before first shot
    this._recoil         = 0;
    this._stunTimer = 0;   // > 0 while frozen by a parry

    // Recoil baseline + muzzle length — primitive defaults; subclasses
    // (SentinelEnemy/ChaffEnemy) overwrite these to point at their own muzzle.
    this._barrelBaseZ = 0.6;
    this._tipOffset   = 1.6;
    this._halfW       = 1.0;
    this._halfD       = 1.9;   // match the composed hull length (was 1.4 → clipping)

    // --- Rig (game logic drives these three nodes; visuals hang off them) ---
    this.root = new TransformNode('aiEnemy_root', scene);
    this.root.position.set(x, this._emergeStyle === 'burrow' ? -BURY_DEPTH : 0, z);   // burrow emergers start buried; door emergers wait inside the building
    this.root.rotation.y = Math.PI;

    this.turretPivot = new TransformNode('aiTurretPivot', scene);
    this.turretPivot.position.set(0, 0.55, 0);
    this.turretPivot.parent = this.root;

    this.barrelPivot = new TransformNode('aiBarrelPivot', scene);
    this.barrelPivot.position.set(0, 0.3, 0.6);
    this.barrelPivot.parent = this.turretPivot;

    if (!opts.noPrimitiveVisuals) this._buildVisuals(scene);

    // Silverfish rule: a hidden emerger is not drawn AT ALL until it activates. Disabling the
    // root suppresses every descendant (mesh + shadow) at render time — even subclass meshes
    // and GLB nodes attached after this point, since Babylon checks the ancestor chain. The
    // targeting gates in ArenaScene skip _hidden units too, so it can't be locked, shot, or
    // rammed while inside. It reveals the instant it starts driving out (see _emergeDoor) or
    // clawing up (burrow), so you never see it lying in wait through a wall gap or shadow.
    if (this._emerge) { this._hidden = true; this.root.setEnabled(false); }

    // --- Health bar ---
    const bgMat = new StandardMaterial('aiHpBgMat', scene);
    bgMat.diffuseColor  = new Color3(0.08, 0.08, 0.08);
    bgMat.emissiveColor = new Color3(0.05, 0.05, 0.05);

    this.hpBarBg = MeshBuilder.CreateBox('aiHpBarBg', { width: 2.2, height: 0.1, depth: 0.1 }, scene);
    this.hpBarBg.position.set(0, 1.55, 0);
    this.hpBarBg.material = bgMat;
    this.hpBarBg.parent = this.root;

    this.hpFillMat = new StandardMaterial('aiHpFillMat', scene);
    this.hpFillMat.diffuseColor  = new Color3(0.1, 0.85, 0.1);
    this.hpFillMat.emissiveColor = new Color3(0.0, 0.35, 0.0);

    this.hpBarFill = MeshBuilder.CreateBox('aiHpBarFill', { width: 2.0, height: 0.11, depth: 0.11 }, scene);
    this.hpBarFill.position.set(0, 1.55, 0);
    this.hpBarFill.material = this.hpFillMat;
    this.hpBarFill.parent = this.root;

    // Stun tell = a fast bright blink over the whole unit. Instanced enemies drive
    // their per-instance tint above 1 (whites out diffuse); primitives fall back to
    // a white emissive flash. See _setStunFlash.
    this._blinkMeshes = null;
    this._blinkT      = 0;
    this._blinkOn     = false;

    // --- Own shell pool (separate from player's) ---
    this.shells = Array.from({ length: 4 }, () => new Shell(scene));
  }

  // Primitive box-tank visuals on the rig. Subclasses (e.g. SentinelEnemy)
  // pass noPrimitiveVisuals and attach their own meshes instead.
  _buildVisuals(scene) {
    this.hullMat = new StandardMaterial('aiHull', scene);
    this.hullMat.diffuseColor  = new Color3(0.95, 0.42, 0.04);
    this.hullMat.specularColor = new Color3(0.08, 0.14, 0.02);

    const turretMat = new StandardMaterial('aiTurret', scene);
    turretMat.diffuseColor  = new Color3(0.80, 0.32, 0.03);
    turretMat.specularColor = new Color3(0.06, 0.10, 0.02);

    const trackMat = new StandardMaterial('aiTrack', scene);
    trackMat.diffuseColor  = new Color3(0.12, 0.12, 0.12);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    const aiHullLower = MeshBuilder.CreateBox('aiHullLower', { width: 2.30, height: 0.20, depth: 2.90 }, scene);
    aiHullLower.position.set(0, 0.10, 0);
    aiHullLower.material = this.hullMat;
    aiHullLower.parent = this.root;

    this.hull = MeshBuilder.CreateBox('aiHullMesh', { width: 2.20, height: 0.52, depth: 2.90 }, scene);
    this.hull.position.set(0, 0.36, 0);
    this.hull.material = this.hullMat;
    this.hull.parent = this.root;

    const aiTrackLeft = MeshBuilder.CreateBox('aiTrackLeft', { width: 0.28, height: 0.65, depth: 3.00 }, scene);
    aiTrackLeft.position.set(-1.04, 0.325, 0);
    aiTrackLeft.material = trackMat;
    aiTrackLeft.parent = this.root;

    const aiTrackRight = MeshBuilder.CreateBox('aiTrackRight', { width: 0.28, height: 0.65, depth: 3.00 }, scene);
    aiTrackRight.position.set(1.04, 0.325, 0);
    aiTrackRight.material = trackMat;
    aiTrackRight.parent = this.root;

    this.turret = MeshBuilder.CreateSphere('aiTurretMesh', { diameter: 1.5, segments: 8 }, scene);
    this.turret.scaling.set(0.95, 0.55, 1.05);
    this.turret.position.set(0, 0.22, 0.05);
    this.turret.material = turretMat;
    this.turret.parent = this.turretPivot;

    const aiMantlet = MeshBuilder.CreateCylinder('aiMantlet', { height: 0.30, diameter: 0.72, tessellation: 10 }, scene);
    aiMantlet.rotation.x = Math.PI / 2;
    aiMantlet.position.set(0, 0.18, 0.72);
    aiMantlet.material = turretMat;
    aiMantlet.parent = this.turretPivot;

    this.barrel = MeshBuilder.CreateCylinder('aiBarrelMesh', { height: 2.4, diameterBottom: 0.18, diameterTop: 0.12, tessellation: 8 }, scene);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.set(0, 0, 1.2);
    this.barrel.material = turretMat;
    this.barrel.parent = this.barrelPivot;
  }

  get halfW()    { return this._halfW; }
  get halfD()    { return this._halfD; }
  get position() { return this.root.position; }
  getVelocity()  {
    return {
      x: Math.sin(this.rotY) * this.speed + this.vx,
      z: Math.cos(this.rotY) * this.speed + this.vz,
    };
  }

  // Transition out of a waiting state: a buried lurker CLAWS UP first (EMERGE), everyone else
  // engages immediately (APPROACH).
  _wake() {
    if (this.state === 'AMBUSH' && this._emerge) { this.state = 'EMERGE'; this._emergeT = 0; }
    else this.state = 'APPROACH';
  }

  // Wake a hidden ambusher when the player fires nearby.
  hearNoise(pos, radius = 30) {
    if (!this.alive || (this.state !== 'AMBUSH' && this.state !== 'PATROL')) return;
    const d = Math.hypot(pos.x - this.root.position.x, pos.z - this.root.position.z);
    if (d <= radius) this._wake();
  }

  // Snap an unaware unit to engage — taking a hit, or a shell whizzing past, gives
  // away the player even from outside normal detection range.
  alert() {
    if (!this.alive) return;
    if (this.state === 'IDLE' || this.state === 'AMBUSH' || this.state === 'PATROL') this._wake();
  }

  // Freeze this unit (parry result). Stacks by taking the longer remaining time.
  stun(seconds) {
    if (!this.alive) return;
    this._stunTimer = Math.max(this._stunTimer, seconds);
    this.speed = 0;
    // Gather the unit's visible meshes (skip the HP bar) for the primitive fallback.
    this._blinkMeshes = this.root.getChildMeshes().filter(m => !/HpBar/i.test(m.name));
    this._blinkT  = 0;
    this._blinkOn = false;
    this._setStunFlash(true);
  }

  // Advance the white-blink flicker while stunned (fast on/off cadence).
  _blinkStun(dt) {
    this._blinkT -= dt;
    if (this._blinkT <= 0) {
      this._blinkOn = !this._blinkOn;
      this._blinkT  = 0.08;
      this._setStunFlash(this._blinkOn);
    }
  }

  // Blink the model bright toward white. Enemies are GPU-instanced, so we can't
  // swap a material/emissive per-instance — but the per-instance tint channel
  // (instancedBuffers.color, a MULTIPLY, also used for death-darkening) can be
  // driven ABOVE 1 to push diffuse colors up to white. Primitive (non-instanced)
  // enemies fall back to a white emissive flash on their own materials.
  _setStunFlash(on) {
    if (this._tint && this._tint.length) {
      const v = on ? STUN_FLASH_GAIN : 1;
      for (const n of this._tint) {
        if (n.instancedBuffers && n.instancedBuffers.color) n.instancedBuffers.color.set(v, v, v, 1);
      }
      return;
    }
    if (!this._blinkMeshes) return;
    for (const m of this._blinkMeshes) {
      const mat = m.material;
      if (!mat || !mat.emissiveColor) continue;
      if (on) {
        if (mat._stunEmissive === undefined) mat._stunEmissive = mat.emissiveColor.clone();
        mat.emissiveColor.set(1, 1, 1);
      } else if (mat._stunEmissive !== undefined) {
        mat.emissiveColor.copyFrom(mat._stunEmissive);
        mat._stunEmissive = undefined;
      }
    }
  }

  _hideStunTell() {
    this._setStunFlash(false);
  }

  addShadows(shadowGen) {
    if (!this.hull) return;   // composed visuals manage their own (blob) shadows
    shadowGen.addShadowCaster(this.hull);
    shadowGen.addShadowCaster(this.turret);
    shadowGen.addShadowCaster(this.barrel);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.alert();   // getting hit always gives away the player
    this.hp = Math.max(0, this.hp - amount);
    this._updateHealthBar();
    if (this.hp <= 0) this._die();
  }

  reset(x, z) {
    this.hp    = this.maxHp;
    this.alive = true;
    this.vx    = 0;
    this.vz    = 0;
    this.speed = 0;
    this.rotY  = Math.PI;
    this.turretAimAngle  = Math.PI;
    this.barrelElevation = 0;
    this.state           = this._initialState;
    this._emergeT        = 0;
    this._wanderTarget   = null;
    this._wanderT        = 0;
    this._routeIdx       = 0;
    this._routeDir       = 1;
    this._sepX = 0; this._sepZ = 0;
    this._nearbyAllies   = 0;
    this.fireCooldown    = 1.5;
    this._recoil         = 0;
    this._stunTimer = 0;
    this._hideStunTell();
    this.barrelPivot.position.z = this._barrelBaseZ;
    this.staticFrictionThreshold = 1.0;
    this.root.position.set(x, this._emergeStyle === 'burrow' ? -BURY_DEPTH : 0, z);   // re-hide an emerger on respawn
    this._reviveVisuals();
    this.hpBarBg.isVisible   = true;
    this.hpBarFill.isVisible = true;
    this._updateHealthBar();
    // Re-hide an emerger on respawn (else it'd stand revealed in its AMBUSH spot); a plain
    // enemy that was somehow hidden gets re-enabled.
    if (this._emerge) { this._hidden = true; this.root.setEnabled(false); }
    else if (!this.root.isEnabled()) { this._hidden = false; this.root.setEnabled(true); }
  }

  _reviveVisuals() {
    if (!this.hullMat) return;
    this.hullMat.diffuseColor  = new Color3(0.95, 0.42, 0.04);
    this.hullMat.emissiveColor = new Color3(0, 0, 0);
  }

  update(dt, playerPos) {
    // Apply collision knockback even when dead
    const vspeed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    if (vspeed > 0.001) {
      const drag  = vspeed > 0.4 ? 1.5 : 120;
      const decel = Math.min(vspeed, drag * dt);
      this.vx -= (this.vx / vspeed) * decel;
      this.vz -= (this.vz / vspeed) * decel;
    } else {
      this.vx = 0; this.vz = 0;
    }

    if (!this.alive) {
      this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + this.vx * dt));
      this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + this.vz * dt));
      return;
    }

    // --- Stunned: frozen (no AI/turret/fire), still shovable by knockback ---
    if (this._stunTimer > 0) {
      this._stunTimer -= dt;
      this._blinkStun(dt);
      this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + this.vx * dt));
      this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + this.vz * dt));
      this.root.rotation.y = this.rotY;
      if (this._stunTimer <= 0) this._hideStunTell();
      return;
    }

    const dx   = playerPos.x - this.root.position.x;
    const dz   = playerPos.z - this.root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // --- State transitions ---
    // AMBUSH = hidden idle with a tight trigger radius (also sprung by hearNoise).
    if ((this.state === 'IDLE' || this.state === 'PATROL') && dist <= this._aggroRange) {
      this.state = 'APPROACH';
    } else if (this.state === 'AMBUSH' && dist <= this._ambushRadius) {
      this._wake();   // emergers go to EMERGE (claw up first), others straight to APPROACH
    } else if (this.state === 'EMERGE') {
      // Revealing from hiding, then engage. Style 'door': drive out the front door in single file.
      this._emergeT += dt;
      if (this._emergeStyle === 'door') {
        this._emergeDoor(dt);
      } else {
        this._reveal();   // claw-up reveal: enable now (still below ground), the rise lifts it into view
        this._emergeVisual(Math.min(1, this._emergeT / this._emergeDur));
        if (this._emergeT >= this._emergeDur) this.state = 'APPROACH';
      }
    } else if (this.state === 'APPROACH' && dist <= this._optimalRange + 4) {
      this.state = 'COMBAT';
    } else if (this.state === 'COMBAT') {
      if (dist > this._optimalRange + 8) this.state = 'APPROACH';
      if (dist < this._optimalRange - 4) this.state = 'RETREAT';
    } else if (this.state === 'RETREAT' && dist >= this._optimalRange) {
      this.state = 'COMBAT';
    }

    // --- Per-state movement ---
    const angleToPlayer = Math.atan2(dx, dz);

    if (this.state === 'IDLE' || this.state === 'AMBUSH' || this.state === 'EMERGE') {
      // do nothing — waiting (IDLE/AMBUSH) or clawing up in place (EMERGE)

    } else if (this.state === 'PATROL') {
      // Roam toward the current goal (route waypoint or wander point) at a relaxed pace.
      const goal = this._patrolGoal(dt);
      if (goal) {
        const goalAngle   = Math.atan2(goal.x - this.root.position.x, goal.z - this.root.position.z);
        const hullDiff    = shortAngle(this.rotY, goalAngle);
        this.rotY += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), this._rotateSpeed * dt);
        const patrolSpeed = this._aiSpeed * PATROL_SPEED_MULT;
        this.speed = Math.abs(hullDiff) < Math.PI / 2
          ? Math.min(this.speed + 6 * dt, patrolSpeed)
          : Math.max(this.speed - 6 * dt, 0);
      } else {
        this.speed = Math.max(this.speed - 6 * dt, 0);
      }

    } else if (this.state === 'APPROACH') {
      const hullDiff    = shortAngle(this.rotY, angleToPlayer);
      const maxHullTurn = this._rotateSpeed * dt;
      this.rotY += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), maxHullTurn);
      this.speed = Math.abs(hullDiff) < Math.PI / 2
        ? Math.min(this.speed + 6 * dt, this._aiSpeed)
        : Math.max(this.speed - 6 * dt, 0);

    } else if (this.state === 'COMBAT') {
      // Light confidence (W1): a lone or wounded scout kites instead of holding ground —
      // backs off and waits rather than trading head-on. (Encirclement/press is W2+.)
      const cautious = this._nearbyAllies === 0 || this.hp < this.maxHp * CAUTIOUS_HP_FRAC;
      if (cautious) {
        const awayAngle = angleToPlayer + Math.PI;
        const hullDiff  = shortAngle(this.rotY, awayAngle);
        this.rotY += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), this._rotateSpeed * dt);
        this.speed = Math.max(this.speed - 6 * dt, -this._aiSpeed * 0.5);
      } else {
        this.speed = this.speed > 0
          ? Math.max(0, this.speed - 8 * dt)
          : Math.min(0, this.speed + 8 * dt);
      }

    } else if (this.state === 'RETREAT') {
      const awayAngle   = angleToPlayer + Math.PI;
      const hullDiff    = shortAngle(this.rotY, awayAngle);
      const maxHullTurn = this._rotateSpeed * dt;
      this.rotY += Math.sign(hullDiff) * Math.min(Math.abs(hullDiff), maxHullTurn);
      this.speed = Math.max(this.speed - 6 * dt, -this._aiSpeed * 0.7);
    }

    // --- Apply position (forward drive + knockback + group-separation nudge) ---
    // Separation only applies to active units, so static IDLE/AMBUSH guards hold their
    // anchor. The nudge is set by ArenaScene's pre-pass and consumed (zeroed) here, so a
    // stale value can't accumulate; the stun path returns earlier, so stunned units don't drift.
    const active  = this.state !== 'IDLE' && this.state !== 'AMBUSH' && this.state !== 'EMERGE';
    // _static units (dug-in emplacements) never drive, get knocked, or separate — they hold their
    // exact anchor. The hull rotation is still applied so a fixed-aim turret can face its lane.
    const sepX    = (active && !this._static) ? this._sepX : 0;
    const sepZ    = (active && !this._static) ? this._sepZ : 0;
    const forward = new Vector3(Math.sin(this.rotY), 0, Math.cos(this.rotY));
    if (!this._static) {
      this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + (forward.x * this.speed + this.vx + sepX) * dt));
      this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + (forward.z * this.speed + this.vz + sepZ) * dt));
    }
    this.root.rotation.y = this.rotY;
    this._sepX = 0; this._sepZ = 0;

    this._updateTurret(dt, playerPos);

    // --- Fire ---
    this.fireCooldown -= dt;
    if (this._shouldFire() && this.fireCooldown <= 0) {
      const aimDiff = Math.abs(shortAngle(this.turretAimAngle, angleToPlayer));
      if (aimDiff < this._aimTolerance) {
        this._fire();
      }
    }
  }

  // Which states this unit opens fire in. Base = hold-and-shoot: only once it has
  // settled into COMBAT at its optimal range. Subclasses widen this — e.g. a chaff
  // scout suppresses while still closing (APPROACH) for constant pressure.
  _shouldFire() { return this.state === 'COMBAT'; }

  // Current PATROL goal as {x,z}: walks route waypoints (loop or ping-pong), or picks
  // wander points within `leash` of the anchor. Advances/repicks as the unit arrives.
  _patrolGoal(dt) {
    if (!this._patrol) return null;
    const px = this.root.position.x, pz = this.root.position.z;

    const route = this._patrol.route;
    if (route && route.length) {
      const wp = route[this._routeIdx];
      if (Math.hypot(wp[0] - px, wp[1] - pz) < WANDER_ARRIVE) {
        if (this._patrol.loop) {
          this._routeIdx = (this._routeIdx + 1) % route.length;
        } else {
          if (this._routeIdx + this._routeDir >= route.length || this._routeIdx + this._routeDir < 0) {
            this._routeDir *= -1;
          }
          this._routeIdx += this._routeDir;
        }
      }
      const g = route[this._routeIdx];
      return { x: g[0], z: g[1] };
    }

    // Anchor + leash wander.
    const anchor = this._patrol.anchor || [px, pz];
    const leash  = this._patrol.leash ?? LEASH_DEFAULT;
    this._wanderT -= dt;
    if (!this._wanderTarget || this._wanderT <= 0 ||
        Math.hypot(this._wanderTarget[0] - px, this._wanderTarget[1] - pz) < WANDER_ARRIVE) {
      const a   = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * leash;   // uniform over the disc
      this._wanderTarget = [anchor[0] + Math.sin(a) * rad, anchor[1] + Math.cos(a) * rad];
      this._wanderT = WANDER_REPICK;
    }
    return { x: this._wanderTarget[0], z: this._wanderTarget[1] };
  }

  // Reveal: rise the whole unit out of the ground over t:0→1 (generic for any enemy type — the
  // chaff additionally scrambles its legs + puffs dust via an override). Small pop at the top.
  _emergeVisual(t) {
    const e = t * t * (3 - 2 * t);
    this.root.position.y = -BURY_DEPTH * (1 - e) + Math.sin(Math.min(1, t) * Math.PI) * 0.10;
  }

  // 'door' reveal: each unit waits its turn (exitOrder stagger) inside the building, then DRIVES
  // OUT through the doorway along the door normal — so a queue of bots files out single-file.
  // Movement is via speed+rotY (applied by the generic position step), so the legs animate.
  _emergeDoor(dt) {
    const STAGGER = 0.45, DRIVE_TIME = 0.75, SPEED = 5;
    const delay = this._exitOrder * STAGGER;
    if (this._emergeT < delay) { this.speed = 0; return; }   // still HIDDEN inside, waiting its turn
    this._reveal();                                          // pop into existence in the doorway as it starts to move
    const n = this._exitNormal;
    if (n) this.rotY = Math.atan2(n.nx, n.nz);               // face outward through the door
    this.speed = SPEED;                                      // generic step drives it out the door
    if (this._emergeT - delay >= DRIVE_TIME) this.state = 'APPROACH';
  }

  // Bring a hidden emerger back into the render (and into play). Idempotent.
  _reveal() {
    if (!this._hidden) return;
    this._hidden = false;
    this.root.setEnabled(true);
  }

  _updateTurret(dt, playerPos) {
    // Fixed-aim emplacements (dug-in turrets) never track — the gun covers one locked lane.
    if (this._fixedAimAngle != null) { this.turretAimAngle = this._fixedAimAngle; return; }
    if (this.state === 'IDLE' || this.state === 'AMBUSH' || this.state === 'EMERGE') return;   // hold while hidden / clawing up

    // Relaxed turret while roaming: face travel direction, not the player.
    let targetAim;
    if (this.state === 'PATROL') {
      targetAim = this.rotY;
    } else {
      const dx  = playerPos.x - this.root.position.x;
      const dz  = playerPos.z - this.root.position.z;
      targetAim = Math.atan2(dx, dz);
    }
    const diff      = shortAngle(this.turretAimAngle, targetAim);
    const maxTurn   = this._turretSpeed * dt;
    this.turretAimAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);

    if (this.state === 'COMBAT') {
      const targetElev = this._elevationForHeight(playerPos.y + 0.75);
      this.barrelElevation += (targetElev - this.barrelElevation) * (1 - Math.exp(-10 * dt));
    } else {
      this.barrelElevation *= Math.exp(-8 * dt);
    }

    this.turretPivot.rotation.y = this.turretAimAngle - this.rotY;
    this.barrelPivot.rotation.x = -this.barrelElevation;

    if (this._recoil > 0) {
      this._recoil = Math.max(0, this._recoil - dt / 0.22);
      const t    = this._recoil;
      const kick = t < 0.5 ? (1 - t * 2) * 0.30 : (t * 2 - 1) * -0.30;
      this.barrelPivot.position.z = this._barrelBaseZ + kick;
    }
  }

  _barrelTip() {
    return Vector3.TransformCoordinates(
      new Vector3(0, 0, this._tipOffset),
      this.barrelPivot.getWorldMatrix(),
    );
  }

  _elevationForHeight(targetY) {
    const pivotY = this.barrelPivot.getAbsolutePosition().y;
    const ratio  = (targetY - pivotY) / this._tipOffset;
    return Math.asin(Math.max(-1, Math.min(1, ratio)));
  }

  _fire() {
    const shell = this.shells.find(s => !s.active);
    if (!shell) return;
    const tip = this._barrelTip();
    const aim = this.turretAimAngle;
    shell.fire(
      tip.x, tip.y, tip.z,
      Math.sin(aim) * HSPEED,
      0,
      Math.cos(aim) * HSPEED,
      45,
    );
    this.fireCooldown = this._fireCooldownDuration;
    this._recoil = 1.0;
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    this.hpBarFill.scaling.x  = r;
    this.hpBarFill.position.x = (r - 1) * 1.0;
    const { red, green } = hpColor(r);
    this.hpFillMat.diffuseColor  = new Color3(red * 0.8, green * 0.8, 0);
    this.hpFillMat.emissiveColor = new Color3(red * 0.3, green * 0.3, 0);
  }

  _die() {
    this.alive = false;
    this.speed = 0;
    this._stunTimer = 0;
    this._hideStunTell();
    this._deathVisuals();
    this.hpBarBg.isVisible   = false;
    this.hpBarFill.isVisible = false;
  }

  _deathVisuals() {
    if (!this.hullMat) return;
    this.hullMat.diffuseColor  = new Color3(0.12, 0.04, 0.04);
    this.hullMat.emissiveColor = new Color3(0.04, 0.01, 0.01);
  }
}
