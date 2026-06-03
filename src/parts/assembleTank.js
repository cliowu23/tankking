import { TransformNode, Vector3 } from '@babylonjs/core';
import { PARTS_BY_ID } from './index.js';

// Composes a {hull, turret, cannon} loadout into one tank.
// Mount points are read at runtime from empties baked into each part GLB
// (hull's `turret` empty → turret ring; turret's `mount` empty → barrel mount),
// so there is no axis math or hardcoded offsets to drift out of sync.
//
// Parts are centered at their own origin; assembleTank grounds the finished tank
// so its lowest point sits at y=0. Returns the same handles the game expects.

export async function assembleTank(scene, loadout, materials = {}) {
  const root = new TransformNode('tankRoot', scene);

  const hullPart   = PARTS_BY_ID[loadout.hull];
  const turretPart = PARTS_BY_ID[loadout.turret];
  const cannonPart = PARTS_BY_ID[loadout.cannon];

  // 1. Hull at origin (hull self-paints via its own paint config)
  const hullBuilt = await hullPart.build(scene);
  hullBuilt.root.parent = root;

  // 2. Turret pivot at the hull's turret-ring empty
  const tr = hullBuilt.mount ?? new Vector3(0, 1, 0);
  const turretPivot = new TransformNode('turretPivot', scene);
  turretPivot.position.copyFrom(tr);
  turretPivot.parent = root;

  const turretBuilt = await turretPart.build(scene);
  turretBuilt.root.parent = turretPivot;

  // 3. Barrel pivot at the turret's barrel-mount empty
  const bm = turretBuilt.mount ?? new Vector3(0, 0, 0.5);
  const barrelPivot = new TransformNode('barrelPivot', scene);
  barrelPivot.position.copyFrom(bm);
  barrelPivot.parent = turretPivot;

  const cannonBuilt = await cannonPart.build(scene, materials.cannon);
  cannonBuilt.root.parent = barrelPivot;

  // 4. Ground the tank — shift root so the lowest mesh point sits at y=0
  let minY = Infinity;
  const allMeshes = [
    ...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes,
  ];
  for (const m of allMeshes) {
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    if (bb.minimumWorld.y < minY) minY = bb.minimumWorld.y;
  }
  if (isFinite(minY)) root.position.y = -minY;

  return {
    root, turretPivot, barrelPivot,
    parts: { hullBuilt, turretBuilt, cannonBuilt },
  };
}
