import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { hpColor } from '../utils/mathUtils.js';

export default class Enemy {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mass = 4;
    this.staticFrictionThreshold = 1.0;
    this.vx = 0;
    this.vz = 0;
    this.bounds = 48;   // playable half-extent; zones override (e.g. World 1 = 140)

    this.maxHp = 100;
    this.hp    = 100;
    this.alive = true;

    this.root = new TransformNode('enemy_root', scene);
    this.root.position.set(x, 0, z);

    this.hullMat = new StandardMaterial('enemyHull', scene);
    this.hullMat.diffuseColor  = new Color3(0.92, 0.12, 0.08);
    this.hullMat.specularColor = new Color3(0.06, 0.04, 0.04);

    const turretMat = new StandardMaterial('enemyTurret', scene);
    turretMat.diffuseColor  = new Color3(0.75, 0.08, 0.06);
    turretMat.specularColor = new Color3(0.05, 0.03, 0.02);

    const trackMat = new StandardMaterial('enemyTrack', scene);
    trackMat.diffuseColor  = new Color3(0.12, 0.12, 0.12);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    const hullLower = MeshBuilder.CreateBox('enemyHullLower', { width: 2.10, height: 0.18, depth: 2.90 }, scene);
    hullLower.position.set(0, 0.09, 0);
    hullLower.material = this.hullMat;
    hullLower.parent = this.root;

    this.hull = MeshBuilder.CreateBox('enemyHullMesh', { width: 2.00, height: 0.48, depth: 2.80 }, scene);
    this.hull.position.set(0, 0.33, 0);
    this.hull.material = this.hullMat;
    this.hull.parent = this.root;

    const trackL = MeshBuilder.CreateBox('enemyTrackLeft', { width: 0.26, height: 0.62, depth: 2.95 }, scene);
    trackL.position.set(-0.98, 0.31, 0);
    trackL.material = trackMat;
    trackL.parent = this.root;

    const trackR = MeshBuilder.CreateBox('enemyTrackRight', { width: 0.26, height: 0.62, depth: 2.95 }, scene);
    trackR.position.set(0.98, 0.31, 0);
    trackR.material = trackMat;
    trackR.parent = this.root;

    // Egg-shaped turret on a simple pivot (static — no rotation needed)
    const turretPivot = new TransformNode('enemyTurretPivot', scene);
    turretPivot.position.set(0, 0.48, 0);
    turretPivot.parent = this.root;

    this.turret = MeshBuilder.CreateSphere('enemyTurretMesh', { diameter: 1.3, segments: 8 }, scene);
    this.turret.scaling.set(0.90, 0.52, 1.0);
    this.turret.position.set(0, 0.20, 0.05);
    this.turret.material = turretMat;
    this.turret.parent = turretPivot;

    const enemyMantlet = MeshBuilder.CreateCylinder('enemyMantlet', { height: 0.25, diameter: 0.65, tessellation: 10 }, scene);
    enemyMantlet.rotation.x = Math.PI / 2;
    enemyMantlet.position.set(0, 0.16, 0.65);
    enemyMantlet.material = turretMat;
    enemyMantlet.parent = turretPivot;

    this.barrel = MeshBuilder.CreateCylinder('enemyBarrelMesh', { height: 2.0, diameterBottom: 0.17, diameterTop: 0.10, tessellation: 8 }, scene);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.set(0, 0.14, -1.65);
    this.barrel.material = turretMat;
    this.barrel.parent = turretPivot;

    // --- Health bar ---
    const bgMat = new StandardMaterial('hpBgMat', scene);
    bgMat.diffuseColor  = new Color3(0.08, 0.08, 0.08);
    bgMat.emissiveColor = new Color3(0.05, 0.05, 0.05);

    this.hpBarBg = MeshBuilder.CreateBox('hpBarBg', { width: 2.2, height: 0.1, depth: 0.1 }, scene);
    this.hpBarBg.position.set(0, 1.55, 0);
    this.hpBarBg.material = bgMat;
    this.hpBarBg.parent = this.root;

    this.hpFillMat = new StandardMaterial('hpFillMat', scene);
    this.hpFillMat.diffuseColor  = new Color3(0.1, 0.85, 0.1);
    this.hpFillMat.emissiveColor = new Color3(0.0, 0.35, 0.0);

    this.hpBarFill = MeshBuilder.CreateBox('hpBarFill', { width: 2.0, height: 0.11, depth: 0.11 }, scene);
    this.hpBarFill.position.set(0, 1.55, 0);
    this.hpBarFill.material = this.hpFillMat;
    this.hpBarFill.parent = this.root;
  }

  get halfW()    { return 1.0; }
  get halfD()    { return 1.4; }
  get position() { return this.root.position; }
  getVelocity()  { return { x: this.vx, z: this.vz }; }

  addShadows(shadowGen) {
    shadowGen.addShadowCaster(this.hull);
    shadowGen.addShadowCaster(this.turret);
    shadowGen.addShadowCaster(this.barrel);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this._updateHealthBar();
    if (this.hp <= 0) this._die();
  }

  _updateHealthBar() {
    const r = this.hp / this.maxHp;
    // Drain left-to-right: scale x and offset position so left edge stays fixed
    this.hpBarFill.scaling.x  = r;
    this.hpBarFill.position.x = (r - 1) * 1.0; // 1.0 = half of bar width (2.0)

    // Green → yellow → red
    const { red, green } = hpColor(r);
    this.hpFillMat.diffuseColor  = new Color3(red * 0.8, green * 0.8, 0);
    this.hpFillMat.emissiveColor = new Color3(red * 0.3, green * 0.3, 0);
  }

  reset(x, z) {
    this.hp    = this.maxHp;
    this.alive = true;
    this.vx    = 0;
    this.vz    = 0;
    this.staticFrictionThreshold = 1.0;
    this.root.position.set(x, 0, z);
    this.hullMat.diffuseColor  = new Color3(0.92, 0.12, 0.08);
    this.hullMat.emissiveColor = new Color3(0, 0, 0);
    this.hpBarBg.isVisible   = true;
    this.hpBarFill.isVisible = true;
    this._updateHealthBar();
  }

  _die() {
    this.alive = false;
    this.vx = 0;
    this.vz = 0;
    // Darken hull to show destruction
    this.hullMat.diffuseColor  = new Color3(0.12, 0.04, 0.04);
    this.hullMat.emissiveColor = new Color3(0.04, 0.01, 0.01);
    // Hide health bar
    this.hpBarBg.isVisible   = false;
    this.hpBarFill.isVisible = false;
  }

  update(dt) {
    if (!this.alive) return;

    const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    if (speed > 0.001) {
      const drag  = speed > 0.4 ? 1.5 : 120;
      const decel = Math.min(speed, drag * dt);
      this.vx -= (this.vx / speed) * decel;
      this.vz -= (this.vz / speed) * decel;
    } else {
      this.vx = 0;
      this.vz = 0;
    }

    this.root.position.x = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.x + this.vx * dt));
    this.root.position.z = Math.max(-this.bounds, Math.min(this.bounds, this.root.position.z + this.vz * dt));
  }
}
