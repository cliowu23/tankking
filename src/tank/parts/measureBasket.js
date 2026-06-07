import { Vector3 } from '@babylonjs/core';

/**
 * Detect the turret ring (basket bearing) centre — the point the turret should rotate about.
 *
 * The ring is the bearing the turret sits on, at the BOTTOM rim of the turret where it meets
 * the hull. We deliberately do NOT use the full dome's bounding centre: a turret with a rear
 * bustle (e.g. the M26 Pershing's long stowage overhang) has its bbox centre dragged backward
 * by the overhang, landing near the hull centre — so it visibly swings instead of spinning on
 * its ring. The bottom rim has no bustle, so its centre is the true bearing.
 *
 * Two adaptive steps, no per-model names or magic offsets:
 *   1. Strip the gun. The barrel, mantlet and roof MG all jut straight forward, so they'd drag
 *      the centre toward the muzzle. Keep meshes that STRADDLE the rotation axis (minZ < axisZ);
 *      drop meshes ENTIRELY forward of it. The dome has mass both ahead of and behind centre;
 *      a gun protrusion does not.
 *   2. Take the lowest slice of the remaining dome (the rim) and find its centre via the Z of
 *      its widest-X points — for a circle those sit exactly at the centre Z, which is robust to
 *      the rim not being a perfect circle.
 *
 * Works in whatever frame the meshes currently live in: the composed pipeline builds the turret
 * at the origin (axisZ defaults to 0); the single-GLB loaders keep the turret in the model's
 * frame and pass the ring empty's world Z as `axisZ`. The returned centre is in that world frame.
 *
 * @param {Mesh[]} meshes  turret meshes, already world-positioned (built/placed, not re-parented)
 * @param {number} axisZ   world Z of the rotation axis; meshes straddling it are the dome, meshes
 *                         entirely forward of it are the gun. Defaults to 0.
 * @returns {{ center: Vector3, diameter: number, domeMeshes: string[] }}
 *          center is the ring centre in the meshes' world frame (XZ; y = 0).
 */
const RIM_FRACTION = 0.15;   // bottom 15% of turret height = the bearing rim

export function measureBasket(meshes, axisZ = 0) {
  const real = meshes.filter(m => m.name !== '__root__');
  for (const m of real) m.computeWorldMatrix(true);

  // 1. Strip the gun: keep dome meshes (straddle the axis), drop forward-only protrusions.
  const dome = real.filter(m => m.getBoundingInfo().boundingBox.minimumWorld.z < axisZ);
  const used = dome.length ? dome : real;

  // Gather dome vertices in world space + the Y range, so we can isolate the bottom rim.
  const pts = [];
  let minY = Infinity, maxY = -Infinity;
  for (const m of used) {
    const wm = m.getWorldMatrix().m;
    const pos = m.getVerticesData('position');
    if (!pos) continue;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const w  = x * wm[3] + y * wm[7] + z * wm[11] + wm[15];
      const wx = (x * wm[0] + y * wm[4] + z * wm[8]  + wm[12]) / w;
      const wy = (x * wm[1] + y * wm[5] + z * wm[9]  + wm[13]) / w;
      const wz = (x * wm[2] + y * wm[6] + z * wm[10] + wm[14]) / w;
      pts.push({ x: wx, y: wy, z: wz });
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }
  }

  // Centre X comes from the FULL dome — it's bilaterally symmetric, so its X midline is robust.
  // The bottom rim alone can be lumpy on one side (a low hatch or fitting) and skew X.
  let domeMinX = Infinity, domeMaxX = -Infinity;
  for (const p of pts) { if (p.x < domeMinX) domeMinX = p.x; if (p.x > domeMaxX) domeMaxX = p.x; }
  const centerX = (domeMinX + domeMaxX) / 2;

  // 2. Bottom rim = lowest slice; its front-back centre is the bearing. Centre Z = average Z of
  //    the rim's widest-X points (its left + right edges), which sit at the rim circle's centre Z.
  const rimTop = minY + RIM_FRACTION * (maxY - minY);
  const rim = pts.filter(p => p.y <= rimTop);
  const ring = rim.length ? rim : pts;
  let rimMinX = Infinity, rimMaxX = -Infinity;
  for (const p of ring) { if (p.x < rimMinX) rimMinX = p.x; if (p.x > rimMaxX) rimMaxX = p.x; }
  const edgeTol = 0.06 * (rimMaxX - rimMinX);
  let zSum = 0, zCount = 0;
  for (const p of ring) {
    if (p.x >= rimMaxX - edgeTol || p.x <= rimMinX + edgeTol) { zSum += p.z; zCount++; }
  }
  const centerZ = zCount ? zSum / zCount : 0;

  return {
    center: new Vector3(centerX, 0, centerZ),
    diameter: domeMaxX - domeMinX,
    domeMeshes: used.map(m => m.name),
  };
}
