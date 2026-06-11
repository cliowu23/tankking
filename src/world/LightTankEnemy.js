// src/world/LightTankEnemy.js
// World 1's light-tank enemy: the Chaffee-style modular light parts assembled
// onto the AIEnemy rig, painted Tankford red. Fast and fragile; band tuning
// (hp/damage/cooldown) and ambush mode come in via opts from the zone config.
//
// Each enemy runs its own assembleTank (same code path as the player's composed
// tank, GLBs are HTTP-cached) — so pivots, scaling and grounding are exactly
// right, and every enemy owns its materials (death tint can't bleed across).

import { Matrix, Vector3 } from '@babylonjs/core';
import AIEnemy from './AIEnemy.js';
import { assembleTank } from '../tank/parts/assembleTank.js';
import { makePaintMaterial } from '../utils/modelPaint.js';

const LOADOUT = { hull: 'light-hull-scout', turret: 'light-turret-enclosed', cannon: 'light-gun-75mm' };
const TANKFORD_RED = [0.80, 0.125, 0.125];   // #CC2020 heraldry
const DEATH_TINT   = { d: [0.10, 0.05, 0.05], e: [0.03, 0.01, 0.01] };

export default class LightTankEnemy extends AIEnemy {
  constructor(scene, x, z, opts = {}) {
    super(scene, x, z, {
      aiSpeed: 7,          // fast…
      optimalRange: 12,    // …and pushy
      ...opts,
      noPrimitiveVisuals: true,
    });
    this._halfW = 0.9;
    this._halfD = 1.2;
    this._matStates = [];   // [{mat, d, e}] originals for death tint / revive
    this.ready = this._buildComposed(scene);
  }

  async _buildComposed(scene) {
    const cannonMat = makePaintMaterial(scene, TANKFORD_RED);
    const a = await assembleTank(scene, LOADOUT, { cannon: cannonMat }, {
      target: { root: this.root, turretPivot: this.turretPivot, barrelPivot: this.barrelPivot },
      paint: TANKFORD_RED,
    });
    const { hullBuilt, turretBuilt, cannonBuilt } = a.parts;
    this._allMeshes = [...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes];

    // Recoil baseline + muzzle length from the assembled geometry, like the player tank.
    this._barrelBaseZ = this.barrelPivot.position.z;
    this._tipOffset   = this._measureTip(cannonBuilt.meshes);

    for (const m of this._allMeshes) {
      m.isPickable = false;
      const mat = m.material;
      if (mat && !this._matStates.some(s => s.mat === mat)) {
        this._matStates.push({
          mat,
          d: mat.diffuseColor?.clone() ?? null,
          e: mat.emissiveColor?.clone() ?? null,
        });
      }
    }

    // Raise the hp bar above the composed silhouette.
    const barY = 2.0;
    this.hpBarBg.position.y = barY;
    this.hpBarFill.position.y = barY;
    return this;
  }

  _measureTip(cannonMeshes) {
    this.barrelPivot.computeWorldMatrix(true);
    const inv = Matrix.Invert(this.barrelPivot.getWorldMatrix());
    let maxZ = 0;
    for (const m of cannonMeshes) {
      m.computeWorldMatrix(true);
      for (const corner of m.getBoundingInfo().boundingBox.vectorsWorld) {
        const local = Vector3.TransformCoordinates(corner, inv);
        if (local.z > maxZ) maxZ = local.z;
      }
    }
    return maxZ || 1.6;
  }

  _deathVisuals() {
    for (const { mat } of this._matStates) {
      if (mat.diffuseColor)  mat.diffuseColor.set(...DEATH_TINT.d);
      if (mat.emissiveColor) mat.emissiveColor.set(...DEATH_TINT.e);
    }
  }

  _reviveVisuals() {
    for (const { mat, d, e } of this._matStates) {
      if (d) mat.diffuseColor.copyFrom(d);
      if (e) mat.emissiveColor.copyFrom(e);
    }
  }
}
