// World-space bounding box across a set of meshes.
// Recomputes each mesh's world matrix (idempotent) so the min/max are accurate
// regardless of when the caller last computed matrices. Pass `include` to filter
// which meshes count (e.g. skip '__root__').
//
// Returns flat { minX, minY, minZ, maxX, maxY, maxZ }. If no mesh is included the
// mins stay +Infinity and maxes -Infinity, matching the previous inline behaviour.
// Collision footprint (half-extents) for a tank, derived from its actual model so the box
// fits the SELECTED tank. World AABB of the visible chassis, excluding the forward-jutting
// gun barrel, the HP bar, and hidden/placeholder meshes. MUST be called at an axis-aligned
// rotation (spawn rotY 0 or PI) so the world extent equals the local footprint. Clamped to
// sane ranges so a stray/oversized mesh can't produce a wild hitbox.
export function hullFootprint(meshes) {
  const SKIP = /barrel|gun|cannon|muzzle|mantlet|aihp|hpbar|healthbar|__root__/i;
  const ok = (m) =>
    m.getTotalVertices && m.getTotalVertices() > 0 &&
    m.isEnabled && m.isEnabled() && m.isVisible !== false && !SKIP.test(m.name);
  const bb = worldBounds(meshes, ok);
  if (!isFinite(bb.minX)) return null;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // WIDTH (track-to-track) is reliable. LENGTH is often inflated by a gun barrel baked into
  // the hull mesh, so derive a tank-proportional length capped to ~1.8x the half-width — the
  // gun can't blow up the hitbox, while it still scales to the selected tank's footprint.
  const halfW = clamp((bb.maxX - bb.minX) / 2, 0.8, 1.4);
  const halfD = clamp(Math.min((bb.maxZ - bb.minZ) / 2, halfW * 1.8), 1.1, 2.3);
  return { halfW, halfD };
}

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
