// src/combat/MortarShell.js
// The Mortar-bot's lobbed round — a SCARY molten plasma orb, teardrop-shaped like a
// flaming rock hurled from a catapult: a white-hot core, a trailing flame tail, and an
// additive glow, oriented along its arc so the tail streaks behind it. The orb IS the
// telegraph now (no ground ring) — you watch it climb and fall and move off the spot.
// Travels on a fixed-flight-time PARABOLIC ARC to a locked ground point, then detonates
// with AREA splash (ArenaScene applies it on `exploded`; the flat-shell AABB path skips
// `isMortar`).
import { MeshBuilder, StandardMaterial, Color3, Constants } from '@babylonjs/core';

export default class MortarShell {
  constructor(scene) {
    // Red plasma core (the King's plasma, matching the red eye/lasers).
    const coreMat = new StandardMaterial('mortarOrbCore', scene);
    coreMat.emissiveColor = new Color3(1.0, 0.32, 0.26);   // hot red
    coreMat.diffuseColor = new Color3(0, 0, 0);
    coreMat.disableLighting = true;
    this.mesh = MeshBuilder.CreateSphere('mortarOrb', { diameter: 0.62, segments: 10 }, scene);
    this.mesh.scaling.set(1, 1, 1.25);
    this.mesh.material = coreMat;
    this.mesh.setEnabled(false);   // hides the core + child tail/halo together
    this.mesh.isPickable = false;

    // Trailing flame tail (cone pointing back along local -Z) → the teardrop point.
    const tailMat = new StandardMaterial('mortarOrbTail', scene);
    tailMat.emissiveColor = new Color3(1.0, 0.12, 0.07);   // red flame
    tailMat.diffuseColor = new Color3(0, 0, 0);
    tailMat.disableLighting = true;
    tailMat.alpha = 0.7;
    tailMat.alphaMode = Constants.ALPHA_ADD;
    tailMat.backFaceCulling = false;
    this._tail = MeshBuilder.CreateCylinder('mortarOrbTailMesh',
      { height: 1.5, diameterTop: 0.62, diameterBottom: 0.0, tessellation: 10 }, scene);
    this._tail.rotation.x = Math.PI / 2;          // axis → local Z
    this._tail.position.z = -0.95;                // trails behind the core
    this._tail.material = tailMat;
    this._tail.isPickable = false;
    this._tail.parent = this.mesh;

    // Additive glow halo (fakes bloom).
    const haloMat = new StandardMaterial('mortarOrbHalo', scene);
    haloMat.emissiveColor = new Color3(1.0, 0.10, 0.06);   // red glow
    haloMat.diffuseColor = new Color3(0, 0, 0);
    haloMat.disableLighting = true;
    haloMat.alpha = 0.35;
    haloMat.alphaMode = Constants.ALPHA_ADD;
    haloMat.backFaceCulling = false;
    this._halo = MeshBuilder.CreateSphere('mortarOrbHaloMesh', { diameter: 1.05, segments: 10 }, scene);
    this._halo.material = haloMat;
    this._halo.isPickable = false;
    this._halo.parent = this.mesh;

    this.isMortar = true;
    this.active   = false;
    this.exploded = false;
    this.vx = 0; this.vz = 0;

    this._sx = 0; this._sy = 0; this._sz = 0;
    this._tx = 0; this._tz = 0;
    this._t = 0; this._flight = 1; this._peak = 4;
    this._px = 0; this._py = 0; this._pz = 0;   // prev pos (for orientation)
    this._flick = 0;
    this.splashRadius = 4.5;
    this.splashDamage = 60;
  }

  fire(sx, sy, sz, tx, tz, flight, peak, splashRadius, splashDamage) {
    this.active = true; this.exploded = false;
    this._sx = sx; this._sy = sy; this._sz = sz;
    this._tx = tx; this._tz = tz;
    this._t = 0; this._flight = Math.max(0.1, flight); this._peak = peak;
    this.splashRadius = splashRadius; this.splashDamage = splashDamage;
    this.vx = tx - sx; this.vz = tz - sz;
    this.mesh.position.set(sx, sy, sz);
    this._px = sx; this._py = sy; this._pz = sz;
    this.mesh.setEnabled(true);
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;
    const f = this._t / this._flight;
    if (f >= 1) {
      this.mesh.position.set(this._tx, 0.1, this._tz);
      this.active = false; this.mesh.setEnabled(false); this.exploded = true;   // hide orb (core+tail+halo); splash this frame
      return;
    }
    this._px = this.mesh.position.x; this._py = this.mesh.position.y; this._pz = this.mesh.position.z;
    this.mesh.position.x = this._sx + (this._tx - this._sx) * f;
    this.mesh.position.z = this._sz + (this._tz - this._sz) * f;
    this.mesh.position.y = this._sy * (1 - f) + this._peak * 4 * f * (1 - f) + 0.1;

    // Orient the teardrop along its arc velocity (tail streaks behind).
    const dx = this.mesh.position.x - this._px, dy = this.mesh.position.y - this._py, dz = this.mesh.position.z - this._pz;
    const horiz = Math.hypot(dx, dz);
    if (horiz > 1e-5) this.mesh.rotation.set(-Math.atan2(dy, horiz), Math.atan2(dx, dz), 0);

    // Flame flicker (scale + glow) so it reads as molten plasma, not a smooth ball.
    this._flick = (this._flick + dt * 30) % (Math.PI * 2);
    const s = 1 + Math.sin(this._flick) * 0.08;
    this._halo.scaling.setAll(s);
    this._tail.scaling.set(1, 1, 1 + Math.sin(this._flick * 1.7) * 0.18);
  }

  clearExplosion() { this.exploded = false; }

  deactivate() { this.active = false; this.exploded = false; this.mesh.setEnabled(false); }

  get position() { return this.mesh.position; }
}
