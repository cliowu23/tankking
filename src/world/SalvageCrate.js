// src/world/SalvageCrate.js
import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

// Generic drive-over pickup. Knows nothing about WHICH crates exist — all
// position/value comes from config (see arenaLoot.js).
export default class SalvageCrate {
  constructor(scene, { x, z, value }) {
    this.scene     = scene;
    this.value     = value;
    this.collected = false;
    this._t        = Math.random() * Math.PI * 2; // desync the bob between crates

    this.root = new TransformNode('salvage_root', scene);
    this.root.position.set(x, 0, z);

    const mat = new StandardMaterial('salvageMat', scene);
    mat.diffuseColor  = new Color3(1.0, 0.82, 0.0);  // gold — reads as loot
    mat.emissiveColor = new Color3(0.45, 0.35, 0.0); // glow so it pops top-down

    this._baseY = 0.6;
    this.mesh = MeshBuilder.CreateBox('salvageCrate', { size: 0.9 }, scene);
    this.mesh.material   = mat;
    this.mesh.parent     = this.root;
    this.mesh.position.y = this._baseY;
  }

  get position() { return this.root.position; }

  // Idle bob + spin so the crate is readable from the top-down camera.
  update(dt) {
    if (this.collected) return;
    this._t += dt;
    this.mesh.rotation.y = this._t * 1.5;
    this.mesh.position.y = this._baseY + Math.sin(this._t * 2) * 0.15;
  }

  collect() {
    this.collected = true;
    this.root.setEnabled(false);
  }

  reset() {
    this.collected = false;
    this.root.setEnabled(true);
  }

  addShadows(shadowGen) {
    shadowGen.addShadowCaster(this.mesh);
  }
}
