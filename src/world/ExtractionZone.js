// src/world/ExtractionZone.js
import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { CHANNEL_DURATION } from './arenaLoot.js';

// Generic extraction pad with a timed channel. Accumulates progress while the
// tank is inside; resets the moment it leaves; fires completion exactly once.
export default class ExtractionZone {
  constructor(scene, { x, z, radius }) {
    this.scene     = scene;
    this.radius    = radius;
    this._progress = 0;     // 0..1
    this._fired    = false; // ensures completion fires once
    this._pulse    = 0;

    this.root = new TransformNode('extract_root', scene);
    this.root.position.set(x, 0, z);

    const mat = new StandardMaterial('extractMat', scene);
    mat.diffuseColor    = new Color3(0.0, 0.62, 0.78); // cyan — Tron UI accent
    mat.emissiveColor   = new Color3(0.0, 0.45, 0.55);
    mat.disableLighting = true;
    mat.alpha           = 0.5;
    mat.backFaceCulling = false;

    this.disc = MeshBuilder.CreateDisc('extractPad', { radius, tessellation: 48 }, scene);
    this.disc.rotation.x  = Math.PI / 2; // lay flat
    this.disc.position.y  = 0.05;
    this.disc.material    = mat;
    this.disc.parent      = this.root;
    this.disc.isPickable  = false;
  }

  get position() { return this.root.position; }
  get progress() { return this._progress; }

  contains(pos) {
    const dx = pos.x - this.root.position.x;
    const dz = pos.z - this.root.position.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }

  // Call every frame. Returns true on the single frame the channel completes.
  update(dt, inside) {
    this._pulse += dt;
    this.disc.material.alpha = 0.35 + Math.sin(this._pulse * 4) * 0.12 + this._progress * 0.45;

    if (!inside) { this._progress = 0; this._fired = false; return false; }
    if (this._fired) return false;
    this._progress = Math.min(1, this._progress + dt / CHANNEL_DURATION);
    if (this._progress >= 1) { this._fired = true; return true; }
    return false;
  }

  reset() {
    this._progress = 0;
    this._fired    = false;
  }
}
