import { MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

export default class Shell {
  constructor(scene) {
    const mat = new StandardMaterial('shellMat', scene);
    mat.diffuseColor  = new Color3(1.0, 0.82, 0.0);
    mat.emissiveColor = new Color3(0.9, 0.55, 0.0);

    this.mesh = MeshBuilder.CreateBox('shell', { width: 0.18, height: 0.18, depth: 0.55 }, scene);
    this.mesh.material = mat;
    this.mesh.isVisible = false;

    this.active   = false;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.life     = 0;
    this.maxRange = 0;
    this.originX  = 0;
    this.originZ  = 0;
  }

  fire(x, y, z, vx, vy, vz, maxRange = 0) {
    this.active   = true;
    this.mesh.isVisible = true;
    this.mesh.position.set(x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.life     = 0;
    this.maxRange = maxRange;
    this.originX  = x;
    this.originZ  = z;
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;

    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;
    this.mesh.position.z += this.vz * dt;

    // Orient along velocity vector so shell "noses down" on descent
    const hspd = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.mesh.rotation.x = -Math.atan2(this.vy, hspd);
    this.mesh.rotation.y =  Math.atan2(this.vx, this.vz);

    const hDist = Math.hypot(this.mesh.position.x - this.originX, this.mesh.position.z - this.originZ);
    if (this.life > 3.5 || (this.maxRange > 0 && hDist >= this.maxRange)) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.mesh.isVisible = false;
  }

  get position() { return this.mesh.position; }
}
