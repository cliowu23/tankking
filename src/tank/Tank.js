import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, DynamicTexture } from '@babylonjs/core';
import { shortAngle } from '../utils/mathUtils.js';
import { hullFootprint } from '../utils/meshBounds.js';
import { makeShieldState, stepShield, shieldDamageMultiplier, SHIELD_MOVE_MULT } from './shield.js';
import { stepThrottle, turnRateAt } from './movement.js';
import { audio } from '../core/audio/AudioManager.js';

// --- Engine audio: throttle-driven RPM → pitch (revving). Tune live. ---
const ENGINE_IDLE_RATE   = 1.0;   // playbackRate at idle = true recorded pitch
const ENGINE_REV_RANGE   = 0.5;   // added at redline → top pitch ~1.5 (diesel stays believable)
const ENGINE_RPM_ATTACK  = 6;     // RPM climb rate on the gas (higher = snappier rev-up)
const ENGINE_RPM_RELEASE = 2.5;   // slower spool-down when coasting (engines fall off gently)
const ENGINE_GAS_REV     = 0.45;  // instant RPM floor while on throttle (revs before speed builds)
const ENGINE_SPEED_REV   = 0.60;  // RPM contribution from sustained speed (cruise sits revved)

export default class Tank {
  constructor(scene, x, z) {
    this.scene = scene;

    // --- Tuning ---
    this.mass             = 1;
    this.speed            = 0;
    // Collision knockback (decaying velocity, separate from drive speed) so a ram bumps the
    // tank without crushing its control — see ArenaScene._checkCollisions (impulse-based).
    this.knockX           = 0;
    this.knockZ           = 0;
    this.knockDrag        = 28;   // units/s² — a ram knock fades in ~0.2-0.3s
    this._halfW           = 1.2;  // collision half-extents — refit to the model via fitCollisionToModel()
    this._halfD           = 1.6;
    this.rotY             = 0; // start facing north (+Z, away from camera)
    this.acceleration     = 4.5;   // slow spool-up (~3.5s to top) = heavy machine
    this.maxSpeed         = 16;    // real top speed (just under old boost)
    this.drag             = 20;   // units/s² — high so tank stops fast when gas released (not slidey)
    this.brakeDecel       = 28;   // units/s² — active braking when input opposes motion (> drag)
    this.rotateSpeed      = 2.1;    // rad/s
    this.maxFuel          = 100;
    this.fuel             = 100;
    this.fuelRecharge     = 18;
    this.tapCost          = 18;
    this.tapDashDist      = 3.0;
    this.tapDashExit      = 18;
    this.holdBoostAccel   = 30;
    this.holdFuelDrain    = 20;
    this.boostMaxSpeed    = 19;
    this.boostDecay       = 15;   // units/s² bleed from boostMaxSpeed back to maxSpeed
    this.momentumDuration = 0.175;  // seconds to coast at boost speed after releasing
    this.turretSpeed      = 72 * Math.PI / 180; // rad/s — 72°/s traverse rate
    this.dispersion       = 0;   // radians — set by fire control system module

    this.maxHp            = 340;
    this.hp               = 340;
    this.alive            = true;

    this.bounds           = 48;   // playable half-extent; zones override (e.g. World 1 = 140)
    this.spawnX           = x;    // reset() returns here, not to a hardcoded origin
    this.spawnZ           = z;

    this._momentumTimer   = 0;    // counts down while coasting after boost release

    this.isDashing        = false;
    this.dashVx           = 0;
    this.dashVz           = 0;
    this.dashTimeLeft     = 0;
    this.dashExitSpeed    = 0;


    // Lock-on target: set from ArenaScene each frame
    this.lockTarget       = null; // Vector3 or null

    // Turret world-space aim angle (traverses at turretSpeed toward cursor)
    this.turretAimAngle   = 0;

    // Barrel elevation in radians (0 = flat, positive = muzzle up)
    this.barrelElevation  = 0;

    // --- Root transform (position + hull rotation) ---
    this.root = new TransformNode('tank_root', scene);
    this.root.position.set(x, 0, z);

    // --- Materials ---
    this.hullMat = new StandardMaterial('tankHull', scene);
    this.hullMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
    this.hullMat.specularColor = new Color3(0.05, 0.15, 0.30);
    const hullMat = this.hullMat;

    const turretMat = new StandardMaterial('tankTurret', scene);
    turretMat.diffuseColor  = new Color3(0.08, 0.32, 0.75);
    turretMat.specularColor = new Color3(0.03, 0.10, 0.25);

    const trackMat = new StandardMaterial('tankTrack', scene);
    trackMat.diffuseColor  = new Color3(0.12, 0.12, 0.12);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    // Animated tread texture — scrolled each frame by ArenaScene update loop
    this.treadTex = new DynamicTexture('tread', { width: 16, height: 128 }, scene);
    const tc = this.treadTex.getContext();
    for (let i = 0; i < 16; i++) {
      tc.fillStyle = i % 2 === 0 ? '#1e1e1e' : '#2d2d2d';
      tc.fillRect(0, i * 8, 16, 8);
    }
    this.treadTex.update();
    this.treadTex.uScale = 1;
    this.treadTex.vScale = 3;
    trackMat.diffuseTexture = this.treadTex;

    // --- Hull — single rectangular prism ---
    this.hull = MeshBuilder.CreateBox('tankHullMesh', { width: 2.40, height: 0.65, depth: 2.50 }, scene);
    this.hull.position.set(0, 0.325, 0);
    this.hull.material = hullMat;
    this.hull.parent = this.root;

    const trackLeft = MeshBuilder.CreateBox('tankTrackLeft', { width: 0.28, height: 0.65, depth: 3.25 }, scene);
    trackLeft.position.set(-1.34, 0.325, 0);
    trackLeft.material = trackMat;
    trackLeft.parent = this.root;

    const trackRight = MeshBuilder.CreateBox('tankTrackRight', { width: 0.28, height: 0.65, depth: 3.25 }, scene);
    trackRight.position.set(1.34, 0.325, 0);
    trackRight.material = trackMat;
    trackRight.parent = this.root;

    const skirtLeft = MeshBuilder.CreateBox('tankSkirtLeft', { width: 0.07, height: 0.25, depth: 2.90 }, scene);
    skirtLeft.position.set(-1.50, 0.125, 0);
    skirtLeft.material = trackMat;
    skirtLeft.parent = this.root;

    const skirtRight = MeshBuilder.CreateBox('tankSkirtRight', { width: 0.07, height: 0.25, depth: 2.90 }, scene);
    skirtRight.position.set(1.50, 0.125, 0);
    skirtRight.material = trackMat;
    skirtRight.parent = this.root;

    // Road wheels — 4 per side, visible below tracks
    const wheelZOffsets = [-1.0, -0.33, 0.33, 1.0];
    for (const wz of wheelZOffsets) {
      for (const wx of [-1.34, 1.34]) {
        const w = MeshBuilder.CreateCylinder(`wheel_${wx}_${wz}`, { height: 0.10, diameter: 0.32, tessellation: 10 }, scene);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.18, wz);
        w.material = trackMat;
        w.parent = this.root;
      }
    }

    // --- Turret pivot — rotates independently from hull ---
    this.turretPivot = new TransformNode('turretPivot', scene);
    this.turretPivot.position.set(0, 0.55, 0); // top of hull — unchanged, game logic depends on this
    this.turretPivot.parent = this.root;

    // Box-based turret — angular low-poly shape
    const turretBody = MeshBuilder.CreateBox('tankTurretBody', { width: 1.15, height: 0.38, depth: 1.20 }, scene);
    turretBody.position.set(0, 0.16, 0.05);
    turretBody.material = turretMat;
    turretBody.parent = this.turretPivot;

    const turretRoof = MeshBuilder.CreateBox('tankTurretRoof', { width: 1.00, height: 0.12, depth: 1.00 }, scene);
    turretRoof.position.set(0, 0.38, 0.00);
    turretRoof.material = turretMat;
    turretRoof.parent = this.turretPivot;

    // Angled front face of turret
    const turretFaceSlope = MeshBuilder.CreateBox('tankTurretFace', { width: 1.10, height: 0.34, depth: 0.18 }, scene);
    turretFaceSlope.position.set(0, 0.22, 0.62);
    turretFaceSlope.rotation.x = -Math.PI * 0.12;
    turretFaceSlope.material = turretMat;
    turretFaceSlope.parent = this.turretPivot;

    // Mantlet
    const mantlet = MeshBuilder.CreateCylinder('tankMantlet', { height: 0.28, diameter: 0.65, tessellation: 10 }, scene);
    mantlet.rotation.x = Math.PI / 2;
    mantlet.position.set(0, 0.16, 0.72);
    mantlet.material = turretMat;
    mantlet.parent = this.turretPivot;

    // Commander's cupola
    const cupola = MeshBuilder.CreateCylinder('tankCupola', { height: 0.16, diameterBottom: 0.35, diameterTop: 0.28, tessellation: 8 }, scene);
    cupola.position.set(0.12, 0.42, -0.10);
    cupola.material = turretMat;
    cupola.parent = this.turretPivot;

    // --- Barrel pivot — elevation rotates around this point ---
    this.barrelPivot = new TransformNode('barrelPivot', scene);
    this.barrelPivot.position.set(0, 0.3, 0.6); // unchanged — game logic depends on this
    this.barrelPivot.parent = this.turretPivot;

    // Tapered barrel
    this.barrel = MeshBuilder.CreateCylinder('tankBarrelMesh', { height: 2.4, diameterBottom: 0.18, diameterTop: 0.12, tessellation: 8 }, scene);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.set(0, 0, 1.2);
    this.barrel.material = turretMat;
    this.barrel.parent = this.barrelPivot;

    // Muzzle brake — wider cap at barrel tip
    const muzzleBrake = MeshBuilder.CreateCylinder('tankMuzzleBrake', { height: 0.18, diameter: 0.26, tessellation: 8 }, scene);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0, 2.28);
    muzzleBrake.material = turretMat;
    muzzleBrake.parent = this.barrelPivot;

    this._shadowMeshes = [this.hull, trackLeft, trackRight, turretBody, turretRoof, mantlet, this.barrel];

    // --- Input ---
    this.keys = { w: false, s: false, a: false, d: false, shift: false, q: false };
    this._justPressedShift = false;

    this._onKeyDown = (e) => {
      if (e.code === 'KeyW')  this.keys.w = true;
      if (e.code === 'KeyS')  this.keys.s = true;
      if (e.code === 'KeyA')  this.keys.a = true;
      if (e.code === 'KeyD')  this.keys.d = true;
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !this.keys.shift) this._justPressedShift = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;
      if (e.code === 'KeyQ' && !this.keys.q) this._qPressed = true;
      if (e.code === 'KeyQ') this.keys.q = true;
    };
    this._onKeyUp = (e) => {
      if (e.code === 'KeyW')  this.keys.w     = false;
      if (e.code === 'KeyS')  this.keys.s     = false;
      if (e.code === 'KeyA')  this.keys.a     = false;
      if (e.code === 'KeyD')  this.keys.d     = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
      if (e.code === 'KeyQ') this.keys.q = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    // --- Shield (Q): burst + mitigation, shares the fuel meter ---
    this.shield    = makeShieldState();
    this._qPressed = false;          // edge-trigger latch, consumed each update

    const shieldMat = new StandardMaterial('shieldBubble', scene);
    shieldMat.diffuseColor    = new Color3(0.3, 0.7, 1.0);
    shieldMat.emissiveColor   = new Color3(0.15, 0.45, 0.9);
    shieldMat.alpha           = 0.28;
    shieldMat.backFaceCulling = false;
    this.shieldBubble = MeshBuilder.CreateSphere('shieldBubble', { diameter: 4.2, segments: 12 }, scene);
    this.shieldBubble.position.set(0, 0.6, 0);
    this.shieldBubble.material   = shieldMat;
    this.shieldBubble.parent     = this.root;
    this.shieldBubble.isVisible  = false;
    this.shieldBubble.isPickable = false;
  }

  get halfW()    { return this._halfW; }
  get halfD()    { return this._halfD; }
  get position() { return this.root.position; }

  // Fit the collision box to the selected tank. Prefers the hull part's AUTHORED footprint
  // (exact, incl. length); falls back to measuring the model (for GLB tanks without a part).
  fitCollisionToModel(declared) {
    // Guard against NaN/degenerate extents (e.g. a calibration hull with no real
    // footprint): a NaN halfW slips through the `overlap <= 0` collision guard and
    // poisons the tank position to NaN → camera targets NaN → black/sky screen.
    // Use Number.isFinite so we fall back to the constructor defaults instead.
    if (declared && Number.isFinite(declared.halfW) && Number.isFinite(declared.halfD)) {
      this._halfW = declared.halfW; this._halfD = declared.halfD; return;
    }
    const f = hullFootprint(this.root.getChildMeshes());
    if (f && Number.isFinite(f.halfW) && Number.isFinite(f.halfD)) {
      this._halfW = f.halfW; this._halfD = f.halfD;
    }
    // else: keep the constructor defaults (1.2 / 1.6) — never NaN.
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount * shieldDamageMultiplier(this.shield));
    if (amount > 0) audio.play(amount >= 20 ? 'tank.hit_heavy' : 'tank.hit_light');
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.speed = 0;
    audio.play('tank.destroyed');
    audio.stopLoop('tank.engine');
    this.hullMat.diffuseColor  = new Color3(0.15, 0.12, 0.08);
    this.hullMat.emissiveColor = new Color3(0.05, 0.03, 0.01);
  }

  reset() {
    this.hp    = this.maxHp;
    this.alive = true;
    this.speed = 0;
    this.knockX = 0;
    this.knockZ = 0;
    this.rotY  = 0;
    this.turretAimAngle  = 0;
    this.barrelElevation = 0;
    this.fuel  = this.maxFuel;
    this.shield.active = false;
    this.shield.timeLeft = 0;
    this._qPressed = false;
    if (this.shieldBubble) this.shieldBubble.isVisible = false;
    this.root.position.set(this.spawnX, 0, this.spawnZ);
    this.root.rotation.y = 0;
    this.hullMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
    this.hullMat.emissiveColor = new Color3(0, 0, 0);
  }

  addShadows(shadowGen) {
    for (const m of this._shadowMeshes) shadowGen.addShadowCaster(m);
  }

  update(dt) {
    if (!this.alive) return;

    // --- Shield step (before movement so the slow applies this frame) ---
    const prevShieldActive = this.shield.active;
    const { fuelSpent } = stepShield(this.shield, dt, this._qPressed, this.fuel);
    this.fuel = Math.max(0, this.fuel - fuelSpent);
    this._qPressed = false;
    this.shieldBubble.isVisible = this.shield.active;
    // Shield audio: edge-triggered activate/break + a hold loop while up.
    if (this.shield.active && !prevShieldActive) {
      audio.play('tank.shield_activate');
      audio.startLoop('tank.shield_loop');
    } else if (!this.shield.active && prevShieldActive) {
      audio.play('tank.shield_break');
      audio.stopLoop('tank.shield_loop');
    }
    const shieldMove = this.shield.active ? SHIELD_MOVE_MULT : 1;

    // --- Engine RPM (throttle-driven): revs up on the gas, spools down coasting ---
    const speedRatio = Math.min(1, Math.abs(this.speed) / this.maxSpeed);
    const onGas      = this.keys.w || this.keys.s;
    const boosting   = this.dashTimeLeft > 0 || Math.abs(this.speed) > this.maxSpeed * 1.01;
    let rpmTarget    = speedRatio * ENGINE_SPEED_REV + (onGas ? ENGINE_GAS_REV : 0);
    if (boosting) rpmTarget = 1;
    rpmTarget = Math.min(1, rpmTarget);
    const prevRpm = this._rpm ?? 0;
    // Asymmetric smoothing: climb fast on the gas, fall gently off it (no zipper noise).
    const rpmRate = rpmTarget > prevRpm ? ENGINE_RPM_ATTACK : ENGINE_RPM_RELEASE;
    this._rpm = prevRpm + (rpmTarget - prevRpm) * Math.min(1, rpmRate * dt);
    audio.setPlaybackRate('tank.engine', ENGINE_IDLE_RATE + this._rpm * ENGINE_REV_RANGE);

    // --- Engine swell: louder/fuller with speed (throttled to avoid click thrash) ---
    const engineTarget = 0.05 + 0.40 * speedRatio;
    if (this._engineVol === undefined || Math.abs(engineTarget - this._engineVol) > 0.04) {
      this._engineVol = engineTarget;
      audio.setVolume('tank.engine', engineTarget);
    }

    // --- Low-fuel warning: periodic beep while fuel is critical ---
    if (this.fuel < 20) {
      this._lowFuelT = (this._lowFuelT ?? 0) - dt;
      if (this._lowFuelT <= 0) { audio.play('tank.low_fuel'); this._lowFuelT = 1.6; }
    } else this._lowFuelT = 0;

    // --- Dash ---
    if (this.dashTimeLeft > 0) {
      this.dashTimeLeft -= dt;
      this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + this.dashVx * dt));
      this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + this.dashVz * dt));
      if (this.dashTimeLeft <= 0) {
        this.isDashing    = false;
        this.speed        = this.dashExitSpeed;
      }
      this._justPressedShift = false;
      this.root.rotation.y   = this.rotY;
      this._updateTurret(dt);
      return;
    }

    // --- Rotation (tight at crawl, wide at full tilt) ---
    const turn = turnRateAt(this.speed, this.maxSpeed, this.rotateSpeed);
    if (this.keys.a) this.rotY -= turn * dt;
    if (this.keys.d) this.rotY += turn * dt;

    const forward = new Vector3(Math.sin(this.rotY), 0, Math.cos(this.rotY));

    // --- Acceleration / braking (S brakes harder than coasting; no glide) ---
    this.speed = stepThrottle(this.speed, this.keys.w, this.keys.s, dt, this);
    // Hard cap only at boostMaxSpeed; bleed back to maxSpeed is handled below
    this.speed = Math.max(-(this.boostMaxSpeed * 0.5), Math.min(this.boostMaxSpeed, this.speed));

    // --- Boost ---
    const boostTapped = this._justPressedShift;
    const boostHeld   = this.keys.shift;

    if (boostTapped && this.fuel >= this.tapCost) {
        const reversing    = this.keys.s;
        const dist         = reversing ? -(this.tapDashDist * 0.8) : this.tapDashDist;
        const exitSpd      = reversing ? -(this.tapDashExit  * 0.8) : this.tapDashExit;
        const DURATION     = 0.14;
        this.dashVx        = forward.x * (dist / DURATION);
        this.dashVz        = forward.z * (dist / DURATION);
        this.dashTimeLeft  = DURATION;
        this.dashExitSpeed = exitSpd;
        this.isDashing     = true;
        this.fuel         -= this.tapCost;
        this.scene._onCameraShake?.(0.07, 0.3);
      }

      if (boostHeld && this.fuel > 0) {
        const reversing = this.keys.s;
        const accel = reversing ? -(this.holdBoostAccel * 0.8) : this.holdBoostAccel;
        const cap   = reversing ? -(this.boostMaxSpeed  * 0.8) : this.boostMaxSpeed;
        this.speed  += accel * dt;
        this.speed   = reversing ? Math.max(this.speed, cap) : Math.min(this.speed, cap);
        this.fuel    = Math.max(0, this.fuel - this.holdFuelDrain * dt);
        this._momentumTimer = this.momentumDuration; // keep resetting while held
      }

    // --- Boost momentum bleed ---
    if (!boostHeld) {
      const absSpeed = Math.abs(this.speed);
      if (absSpeed > this.maxSpeed) {
        if (this._momentumTimer > 0) {
          // Coast phase: don't slow down yet
          this._momentumTimer -= dt;
        } else {
          // Decay phase: bleed speed back toward maxSpeed at boostDecay rate
          const sign      = Math.sign(this.speed);
          const cap       = sign * this.maxSpeed;
          const bleedRate = this.boostDecay * dt;
          this.speed      = sign * Math.max(Math.abs(cap), absSpeed - bleedRate);
        }
      } else {
        this._momentumTimer = 0;
      }
    }

    if (!boostHeld && this.fuel < this.maxFuel) {
      this.fuel = Math.min(this.maxFuel, this.fuel + this.fuelRecharge * dt);
    }

    // --- Apply velocity (shield slows you while held up) ---
    const vx = forward.x * this.speed * shieldMove;
    const vz = forward.z * this.speed * shieldMove;
    this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + vx * dt));
    this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + vz * dt));

    // collision knockback (decaying), additive to drive — a ram shoves the tank without
    // crushing its drive speed, so it can steer away instead of getting stun-locked.
    if (this.knockX !== 0 || this.knockZ !== 0) {
      this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + this.knockX * dt));
      this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + this.knockZ * dt));
      const ks = Math.hypot(this.knockX, this.knockZ);
      const dec = Math.min(ks, this.knockDrag * dt);
      this.knockX -= (this.knockX / ks) * dec;
      this.knockZ -= (this.knockZ / ks) * dec;
    }

    this.root.rotation.y = this.rotY;

    this._updateTurret(dt);
    this._justPressedShift = false;
  }

  // Apply a collision impulse (units/s), capped so a big hit can't fling the tank wildly.
  applyKnockback(kx, kz) {
    this.knockX += kx; this.knockZ += kz;
    const m = Math.hypot(this.knockX, this.knockZ), CAP = 16;
    if (m > CAP) { this.knockX = this.knockX / m * CAP; this.knockZ = this.knockZ / m * CAP; }
  }

  _updateTurret(dt) {
    // Compute turret pivot world XZ analytically: local offset rotated by hull angle,
    // then scaled by root.scaling (GLB tanks have non-1 scale). Works for any tank.
    const tp    = this.turretPivot.position; // hull-local, pre-scale
    const scale = this.root.scaling.x;       // uniform scale set during GLB load (1.0 for primitives)
    const cosY  = Math.cos(this.rotY);
    const sinY  = Math.sin(this.rotY);
    const pivotX = this.root.position.x + (tp.x * cosY + tp.z * sinY) * scale;
    const pivotZ = this.root.position.z + (-tp.x * sinY + tp.z * cosY) * scale;

    if (this.lockTarget) {
      // Lock-on: traverse at limited rate toward locked enemy
      const targetAim = Math.atan2(this.lockTarget.x - pivotX, this.lockTarget.z - pivotZ);
      const diff      = shortAngle(this.turretAimAngle, targetAim);
      const maxTurn   = this.turretSpeed * dt;
      this.turretAimAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
    } else {
      // Mouse aim: intersect cursor ray with the barrel's firing plane (y = barrel tip height)
      // rather than y=0 ground. The shot travels flat at tipY, so this plane is exactly where
      // the shell passes — no camera-tilt overshoot regardless of what mesh is under the cursor.
      const tipY = this.root.position.y
        + this.turretPivot.position.y
        + this.barrelPivot.position.y;
      const ray = this.scene.createPickingRay(
        this.scene.pointerX, this.scene.pointerY, null, this.scene.activeCamera,
      );
      if (ray && Math.abs(ray.direction.y) > 0.0001) {
        const t         = (tipY - ray.origin.y) / ray.direction.y;
        const hitX      = ray.origin.x + t * ray.direction.x;
        const hitZ      = ray.origin.z + t * ray.direction.z;
        const targetAim = Math.atan2(hitX - pivotX, hitZ - pivotZ);
        const diff      = shortAngle(this.turretAimAngle, targetAim);
        const maxTurn   = this.turretSpeed * dt;
        this.turretAimAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
      }
    }

    this.turretPivot.rotation.y  = this.turretAimAngle - this.rotY;
    this.barrelPivot.rotation.x  = -this.barrelElevation; // negative tilts muzzle up
  }
}
