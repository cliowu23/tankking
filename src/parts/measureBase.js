import { Vector3, VertexBuffer } from '@babylonjs/core';

// Measure the seating "base" of a set of meshes: the footprint of their lowest slice.
// Returns { center: Vector3 (xz at the base plane), diameter: number, y: number }.
//
// Call this while the meshes sit in their FINAL local orientation (any yaw already applied)
// at the origin, so each mesh's world matrix == that frame. The bottom slice excludes
// overhangs (bustle, mantlet, antenna) which sit higher, so center/diameter describe the
// true mounting ring — not the whole-turret bounding box (whose center the bustle skews).
export function measureBase(meshes, sliceFraction = 0.15) {
  const pts = [];
  let yMin = Infinity, yMax = -Infinity;
  for (const m of meshes) {
    const positions = m.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    const wm = m.getWorldMatrix();
    for (let i = 0; i < positions.length; i += 3) {
      const v = Vector3.TransformCoordinates(
        new Vector3(positions[i], positions[i + 1], positions[i + 2]), wm);
      pts.push(v);
      if (v.y < yMin) yMin = v.y;
      if (v.y > yMax) yMax = v.y;
    }
  }
  if (pts.length === 0) return { center: new Vector3(0, 0, 0), diameter: 1, y: 0 };

  const cut = yMin + sliceFraction * (yMax - yMin);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of pts) {
    if (v.y > cut) continue;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  const center = new Vector3((minX + maxX) / 2, yMin, (minZ + maxZ) / 2);
  const diameter = Math.max(maxX - minX, maxZ - minZ);
  return { center, diameter, y: yMin };
}
