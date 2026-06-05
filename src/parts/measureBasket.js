import { Vector3 } from '@babylonjs/core';

/**
 * Detect the turret basket (ring) centre — the point the turret should rotate about.
 *
 * We can't trust the geometry origin (it sits wherever the model happened to be authored)
 * nor the lowest slice (a mantlet hangs below the front), so instead we take the XZ
 * bounding centre of the dome shell — the round body the turret spins on.
 *
 * The only thing that would throw that off is the gun: the barrel, mantlet and roof MG all
 * jut straight forward, so they'd drag the centre toward the muzzle. We strip them out with
 * one adaptive test — keep meshes that STRADDLE the rotation axis (minZ < 0), drop meshes
 * that sit ENTIRELY forward of it (minZ >= 0). The dome always has mass both ahead of and
 * behind centre; a gun protrusion does not. No per-model mesh names, no magic offsets.
 *
 * Assumes the turret was extracted roughly centred on its ring (origin within the dome),
 * which the extraction pipeline guarantees.
 *
 * @param {Mesh[]} meshes  turret shell meshes, already world-positioned (built, not yet scaled)
 * @returns {{ center: Vector3, diameter: number, domeMeshes: string[] }}
 *          center is the basket centre as an offset from the turret origin (XZ; y = 0).
 */
export function measureBasket(meshes) {
  const real = meshes.filter(m => m.name !== '__root__');
  for (const m of real) m.computeWorldMatrix(true);

  // Dome = straddles the axis; gun/mantlet/MG = entirely forward (minZ >= 0). Fall back to
  // everything if nothing straddles (degenerate model) so we never return NaN.
  const dome = real.filter(m => m.getBoundingInfo().boundingBox.minimumWorld.z < 0);
  const used = dome.length ? dome : real;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const m of used) {
    const bb = m.getBoundingInfo().boundingBox;
    minX = Math.min(minX, bb.minimumWorld.x); maxX = Math.max(maxX, bb.maximumWorld.x);
    minZ = Math.min(minZ, bb.minimumWorld.z); maxZ = Math.max(maxZ, bb.maximumWorld.z);
  }

  return {
    center: new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
    diameter: Math.max(maxX - minX, maxZ - minZ),
    domeMeshes: used.map(m => m.name),
  };
}
