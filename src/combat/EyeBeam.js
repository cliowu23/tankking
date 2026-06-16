// src/combat/EyeBeam.js
// A Sentinel-bot's charged eye-beam: the heavy blast a BOTW-Guardian fires after
// its tell. Same public surface as Shell/LaserBolt
// (fire/update/deactivate/.active/.position/.vx/.vz) so the existing enemy-shell
// hit path in ArenaScene._checkShellHits applies it with no special-casing.
//
// Where LaserBolt is a thin, fast chip-stream, the eye-beam is a FAT, bright,
// single heavy hit — you're meant to read the charge tell and roll out of the
// firing line, not dodge the bolt itself. Flat flight only (kept under the
// y<1.6 hit-gate by firing from the eye lens at chassis-ish height).
import { MeshBuilder, StandardMaterial, Color3, Constants } from '@babylonjs/core';

const BEAM_LIFE  = 1.2;   // seconds before auto-despawn
const BEAM_LEN   = 2.6;   // long, heavy streak
const BEAM_WIDTH = 0.20;  // thick — reads as a blast, not a tracer
const HALO_SCALE = 2.4;   // additive glow envelope, this × the core width

export default class EyeBeam {
  constructor(scene) {
    // White-hot orange core (the discharge of a charged beam).
    const coreMat = new StandardMaterial('eyeBeamCore', scene);
    coreMat.diffuseColor    = new Color3(1.0, 0.55, 0.28);
    coreMat.emissiveColor   = new Color3(1.0, 0.55, 0.28);
    coreMat.disableLighting = true;

    this.mesh = MeshBuilder.CreateBox('eyeBeam',
      { width: BEAM_WIDTH, height: BEAM_WIDTH, depth: BEAM_LEN }, scene);
    this.mesh.material  = coreMat;
    this.mesh.isVisible = false;

    // Additive glow halo (fakes a bloom without a glow layer).
    const haloMat = new StandardMaterial('eyeBeamHalo', scene);
    haloMat.emissiveColor   = new Color3(1.0, 0.22, 0.06);
    haloMat.diffuseColor    = new Color3(0, 0, 0);
    haloMat.disableLighting  = true;
    haloMat.alpha            = 0.34;
    haloMat.alphaMode        = Constants.ALPHA_ADD;
    haloMat.backFaceCulling  = false;

    this.halo = MeshBuilder.CreateBox('eyeBeamHalo',
      { width: BEAM_WIDTH * HALO_SCALE, height: BEAM_WIDTH * HALO_SCALE, depth: BEAM_LEN * 1.12 }, scene);
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
    if (this.life > BEAM_LIFE || (this.maxRange > 0 && hDist >= this.maxRange)) {
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
