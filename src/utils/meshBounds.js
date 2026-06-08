// World-space bounding box across a set of meshes.
// Recomputes each mesh's world matrix (idempotent) so the min/max are accurate
// regardless of when the caller last computed matrices. Pass `include` to filter
// which meshes count (e.g. skip '__root__').
//
// Returns flat { minX, minY, minZ, maxX, maxY, maxZ }. If no mesh is included the
// mins stay +Infinity and maxes -Infinity, matching the previous inline behaviour.
export function worldBounds(meshes, include) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const m of meshes) {
    if (include && !include(m)) continue;
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    const lo = bb.minimumWorld, hi = bb.maximumWorld;
    if (lo.x < minX) minX = lo.x;
    if (lo.y < minY) minY = lo.y;
    if (lo.z < minZ) minZ = lo.z;
    if (hi.x > maxX) maxX = hi.x;
    if (hi.y > maxY) maxY = hi.y;
    if (hi.z > maxZ) maxZ = hi.z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}
