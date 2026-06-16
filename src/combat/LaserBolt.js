// src/combat/LaserBolt.js
// A chaff scout-bot's eye-laser bolt. Mirrors Shell's public surface
// (fire/update/deactivate/.active/.position/.vx/.vz) so the existing
// enemy-shell hit path in ArenaScene._checkShellHits handles it with no
// special-casing. Visually: a bright red bolt core wrapped in an additive
// glow halo so it reads clearly against the grass. Flat flight only.
import { MeshBuilder, StandardMaterial, Color3, Constants } from '@babylonjs/core';

const BOLT_LIFE  = 1.4;   // seconds before auto-despawn (short — laser range is close)
const BOLT_LEN   = 1.0;   // long, thin bolt
const BOLT_WIDTH = 0.07;  // thin
const HALO_SCALE = 1.8;   // halo is this × the core width, additive-blended for glow

export default class LaserBolt {
  constructor(scene) {
    // Bright core
    const coreMat = new StandardMaterial('laserBoltCore', scene);
    coreMat.diffuseColor    = new Color3(1.0, 0.10, 0.08);
    coreMat.emissiveColor   = new Color3(1.0, 0.10, 0.08);   // deep red core
    coreMat.disableLighting = true;

    this.mesh = MeshBuilder.CreateBox('laserBolt',
      { width: BOLT_WIDTH, height: BOLT_WIDTH, depth: BOLT_LEN }, scene);
    this.mesh.material  = coreMat;
    this.mesh.isVisible = false;

    // Additive glow halo around the core (fakes a bloom without a glow layer).
    const haloMat = new StandardMaterial('laserBoltHalo', scene);
    haloMat.emissiveColor   = new Color3(1.0, 0.04, 0.03);
    haloMat.diffuseColor    = new Color3(0, 0, 0);
    haloMat.disableLighting  = true;
    haloMat.alpha            = 0.28;
    haloMat.alphaMode        = Constants.ALPHA_ADD;   // additive = glow
    haloMat.backFaceCulling  = false;

    this.halo = MeshBuilder.CreateBox('laserBoltHalo',
      { width: BOLT_WIDTH * HALO_SCALE, height: BOLT_WIDTH * HALO_SCALE, depth: BOLT_LEN * 1.15 }, scene);
    this.halo.material   = haloMat;
    this.halo.isPickable = false;
    this.halo.parent     = this.mesh;
    this.halo.isVisible  = false;

    this.active = false;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.life = 0;
    this.maxRange = 0;
    this.originX = 0;
    this.originZ = 0;
  }

  fire(x, y, z, vx, vy, vz, maxRange = 0) {
    this.active = true;
    this.mesh.isVisible = true;
    this.halo.isVisible = true;
    this.mesh.position.set(x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.life = 0;
    this.maxRange = maxRange;
    this.originX = x;
    this.originZ = z;
  }

  update(dt) {
    if (!this.active) return;
    this.life += dt;
    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;
    this.mesh.position.z += this.vz * dt;
    this.mesh.rotation.y = Math.atan2(this.vx, this.vz);

    const hDist = Math.hypot(this.mesh.position.x - this.originX, this.mesh.position.z - this.originZ);
    if (this.life > BOLT_LIFE || (this.maxRange > 0 && hDist >= this.maxRange)) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.isVisible = false;
    this.halo.isVisible = false;
  }

  get position() { return this.mesh.position; }
}
