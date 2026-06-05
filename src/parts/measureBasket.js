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
 * Works in whatever frame the meshes currently live in: the composed pipeline builds the
 * turret at the origin (axisZ defaults to 0), while the single-GLB loaders keep the turret in
 * the model's frame and pass the ring empty's world Z as `axisZ`. The dome/gun split is taken
 * relative to that axis, and the returned centre is in the meshes' current world frame.
 *
 * @param {Mesh[]} meshes  turret meshes, already world-positioned (built/placed, not re-parented)
 * @param {number} axisZ   world Z of the rotation axis (ring centre); meshes straddling it are
 *                         the dome, meshes entirely forward of it are the gun. Defaults to 0.
 * @returns {{ center: Vector3, diameter: number, domeMeshes: string[] }}
 *          center is the basket centre in the meshes' world frame (XZ; y = 0).
 */
export function measureBasket(meshes, axisZ = 0) {
  const real = meshes.filter(m => m.name !== '__root__');
  for (const m of real) m.computeWorldMatrix(true);

  // Dome = straddles the axis; gun/mantlet/MG = entirely forward (minZ >= axisZ). Fall back to
  // everything if nothing straddles (degenerate model) so we never return NaN.
  const dome = real.filter(m => m.getBoundingInfo().boundingBox.minimumWorld.z < axisZ);
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
