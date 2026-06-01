import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, DynamicTexture } from '@babylonjs/core';

// Shortest signed angle between two angles (radians)
function shortAngle(from, to) {
  let d = ((to - from) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d;
}

export default class Tank {
  constructor(scene, x, z) {
    this.scene = scene;

    // --- Tuning ---
    this.mass             = 1;
    this.speed            = 0;
    this.rotY             = 0; // start facing north (+Z, away from camera)
    this.acceleration     = 6;
    this.maxSpeed         = 8;
    this.drag             = 4;
    this.rotateSpeed      = 2.1;    // rad/s
    this.maxFuel          = 100;
    this.fuel             = 100;
    this.fuelRecharge     = 18;
    this.tapCost          = 18;
    this.tapDashDist      = 3.0;
    this.tapDashExit      = 16;
    this.holdBoostAccel   = 30;
    this.holdFuelDrain    = 20;
    this.boostMaxSpeed    = 18;
    this.boostDecay       = 15;   // units/s² bleed from boostMaxSpeed back to maxSpeed
    this.momentumDuration = 0.175;  // seconds to coast at boost speed after releasing
    this.turretSpeed      = 72 * Math.PI / 180; // rad/s — 72°/s traverse rate
    this.dispersion       = 0;   // radians — set by fire control system module

    this.maxHp            = 340;
    this.hp               = 340;
    this.alive            = true;

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

    // --- Hull group ---
    const hullLower = MeshBuilder.CreateBox('tankHullLower', { width: 2.55, height: 0.20, depth: 3.20 }, scene);
    hullLower.position.set(0, 0.10, 0);
    hullLower.material = hullMat;
    hullLower.parent = this.root;

    this.hull = MeshBuilder.CreateBox('tankHullMesh', { width: 2.40, height: 0.50, depth: 3.20 }, scene);
    this.hull.position.set(0, 0.35, 0);
    this.hull.material = hullMat;
    this.hull.parent = this.root;

    // Top deck — shortened at front to leave room for the slope plate
    const hullTop = MeshBuilder.CreateBox('tankHullTop', { width: 2.20, height: 0.08, depth: 2.40 }, scene);
    hullTop.position.set(0, 0.615, -0.20);
    hullTop.material = hullMat;
    hullTop.parent = this.root;

    // Angled front armor plate — the #1 low-poly tank silhouette cue
    const hullFrontSlope = MeshBuilder.CreateBox('tankFrontSlope', { width: 2.20, height: 0.65, depth: 0.55 }, scene);
    hullFrontSlope.position.set(0, 0.35, 1.30);
    hullFrontSlope.rotation.x = -Math.PI * 0.22;
    hullFrontSlope.material = hullMat;
    hullFrontSlope.parent = this.root;

    // Rear engine deck
    const engineDeck = MeshBuilder.CreateBox('tankEngineDeck', { width: 1.80, height: 0.10, depth: 0.70 }, scene);
    engineDeck.position.set(0, 0.62, -1.20);
    engineDeck.material = hullMat;
    engineDeck.parent = this.root;

    const trackLeft = MeshBuilder.CreateBox('tankTrackLeft', { width: 0.28, height: 0.65, depth: 3.25 }, scene);
    trackLeft.position.set(-1.26, 0.325, 0);
    trackLeft.material = trackMat;
    trackLeft.parent = this.root;

    const trackRight = MeshBuilder.CreateBox('tankTrackRight', { width: 0.28, height: 0.65, depth: 3.25 }, scene);
    trackRight.position.set(1.26, 0.325, 0);
    trackRight.material = trackMat;
    trackRight.parent = this.root;

    const skirtLeft = MeshBuilder.CreateBox('tankSkirtLeft', { width: 0.07, height: 0.25, depth: 2.90 }, scene);
    skirtLeft.position.set(-1.42, 0.125, 0);
    skirtLeft.material = trackMat;
    skirtLeft.parent = this.root;

    const skirtRight = MeshBuilder.CreateBox('tankSkirtRight', { width: 0.07, height: 0.25, depth: 2.90 }, scene);
    skirtRight.position.set(1.42, 0.125, 0);
    skirtRight.material = trackMat;
    skirtRight.parent = this.root;

    // Road wheels — 4 per side, visible below tracks
    const wheelZOffsets = [-1.0, -0.33, 0.33, 1.0];
    for (const wz of wheelZOffsets) {
      for (const wx of [-1.26, 1.26]) {
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

    this._shadowMeshes = [hullLower, this.hull, hullTop, hullFrontSlope, engineDeck, trackLeft, trackRight, turretBody, turretRoof, mantlet, this.barrel];

    // --- Input ---
    this.keys = { w: false, s: false, a: false, d: false, shift: false };
    this._justPressedShift = false;

    this._onKeyDown = (e) => {
      if (e.code === 'KeyW')  this.keys.w = true;
      if (e.code === 'KeyS')  this.keys.s = true;
      if (e.code === 'KeyA')  this.keys.a = true;
      if (e.code === 'KeyD')  this.keys.d = true;
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !this.keys.shift) this._justPressedShift = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;
    };
    this._onKeyUp = (e) => {
      if (e.code === 'KeyW')  this.keys.w     = false;
      if (e.code === 'KeyS')  this.keys.s     = false;
      if (e.code === 'KeyA')  this.keys.a     = false;
      if (e.code === 'KeyD')  this.keys.d     = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  get halfW()    { return 1.2; }
  get halfD()    { return 1.6; }
  get position() { return this.root.position; }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.speed = 0;
    this.hullMat.diffuseColor  = new Color3(0.15, 0.12, 0.08);
    this.hullMat.emissiveColor = new Color3(0.05, 0.03, 0.01);
  }

  reset() {
    this.hp    = this.maxHp;
    this.alive = true;
    this.speed = 0;
    this.rotY  = 0;
    this.turretAimAngle  = 0;
    this.barrelElevation = 0;
    this.fuel  = this.maxFuel;
    this.root.position.set(0, 0, 0);
    this.root.rotation.y = 0;
    this.hullMat.diffuseColor  = new Color3(0.55, 0.55, 0.55);
    this.hullMat.emissiveColor = new Color3(0, 0, 0);
  }

  addShadows(shadowGen) {
    for (const m of this._shadowMeshes) shadowGen.addShadowCaster(m);
  }

  update(dt) {
    if (!this.alive) return;

    // --- Dash ---
    if (this.dashTimeLeft > 0) {
      this.dashTimeLeft -= dt;
      this.root.position.x = Math.max(-48, Math.min(48, this.root.position.x + this.dashVx * dt));
      this.root.position.z = Math.max(-48, Math.min(48, this.root.position.z + this.dashVz * dt));
      if (this.dashTimeLeft <= 0) {
        this.isDashing    = false;
        this.speed        = this.dashExitSpeed;
      }
      this._justPressedShift = false;
      this.root.rotation.y   = this.rotY;
      this._updateTurret(dt);
      return;
    }

    // --- Rotation ---
    if (this.keys.a) this.rotY -= this.rotateSpeed * dt;
    if (this.keys.d) this.rotY += this.rotateSpeed * dt;

    const forward = new Vector3(Math.sin(this.rotY), 0, Math.cos(this.rotY));

    // --- Acceleration ---
    if (this.keys.w) {
      this.speed += this.acceleration * dt;
    } else if (this.keys.s) {
      this.speed -= this.acceleration * dt;
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.drag * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.drag * dt);
    }
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

    // --- Apply velocity ---
    const vx = forward.x * this.speed;
    const vz = forward.z * this.speed;
    this.root.position.x = Math.max(-48, Math.min(48, this.root.position.x + vx * dt));
    this.root.position.z = Math.max(-48, Math.min(48, this.root.position.z + vz * dt));
    this.root.rotation.y = this.rotY;

    this._updateTurret(dt);
    this._justPressedShift = false;
  }

  _updateTurret(dt) {
    // Use turret pivot world position as the aim origin — it's the actual centre of rotation,
    // and sits slightly forward of the tank root. Computing angles from root caused a lateral
    // offset when aiming 90° to either side.
    const pivot = this.turretPivot.getAbsolutePosition();

    if (this.lockTarget) {
      // Lock-on: traverse at limited rate toward locked enemy
      const targetAim = Math.atan2(this.lockTarget.x - pivot.x, this.lockTarget.z - pivot.z);
      const diff      = shortAngle(this.turretAimAngle, targetAim);
      const maxTurn   = this.turretSpeed * dt;
      this.turretAimAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
    } else {
      // Mouse aim: traverse at limited rate toward cursor
      const ray = this.scene.createPickingRay(
        this.scene.pointerX, this.scene.pointerY, null, this.scene.activeCamera,
      );
      if (ray && Math.abs(ray.direction.y) > 0.0001) {
        const t         = -ray.origin.y / ray.direction.y;
        const hitX      = ray.origin.x + t * ray.direction.x;
        const hitZ      = ray.origin.z + t * ray.direction.z;
        const targetAim = Math.atan2(hitX - pivot.x, hitZ - pivot.z);
        const diff      = shortAngle(this.turretAimAngle, targetAim);
        const maxTurn   = this.turretSpeed * dt;
        this.turretAimAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
      }
    }

    this.turretPivot.rotation.y  = this.turretAimAngle - this.rotY;
    this.barrelPivot.rotation.x  = -this.barrelElevation; // negative tilts muzzle up
  }
}
