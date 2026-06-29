// src/world/zones/pois/treePatchCache.js
// First POI type through the modular POI system — a "point" POI: a clump of trees + bushes
// beside the road hiding a richer salvage cache, optionally guarded by a single lurker.
//
// Two halves, matching the road's pure-data / render split:
//   place(ctx, rand, opts) -> instance   PURE DATA — anchor, prop transforms, enemies, loot
//   build(scene, inst, helpers) -> meshes BABYLON — instantiates the props
// `opts` (all optional, with defaults) make the type modular: tune density, reach, reward,
// and whether it's guarded, so the same module yields a small thicket or a big grove.

const ID = 'tree-patch-cache';

const DEFAULTS = {
  trees: 5,        // ring of trees around the cache
  bushes: 4,       // closer-in concealment
  offset: 18,      // how far off the road centerline the patch sits (inside the ~50u corridor)
  radius: 7,       // patch radius
  lurker: true,    // a single ambush guard on the cache
  lootMult: 1.4,   // hidden cache → richer than an open spur crate
};

// ctx: { pts, total, dirAt, bandFor, valueFor, anchorIdx } supplied by the leg generator.
function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;

  const p = pts[anchorIdx];
  const d = dirAt(pts, anchorIdx);
  const side = rand() < 0.5 ? 1 : -1;
  const px = -d.z * side, pz = d.x * side;                 // unit perpendicular, off-road
  const off = o.offset + (o.offsetBonus || 0);             // leg may push it farther out (varied distance)
  const cx = p.x + px * off, cz = p.z + pz * off;          // patch centre, beside the road

  const props = [];
  for (let i = 0; i < o.trees; i++) {
    const a = (i / o.trees) * Math.PI * 2 + rand() * 0.6;
    const r = o.radius + rand() * 3;
    props.push({ kind: 'tree', x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r,
      scale: 0.9 + rand() * 0.5, rotY: rand() * Math.PI });
  }
  for (let i = 0; i < o.bushes; i++) {
    const a = rand() * Math.PI * 2, r = 1.5 + rand() * (o.radius - 1.5);
    props.push({ kind: 'bush', x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r,
      scale: 0.7 + rand() * 0.6, rotY: rand() * Math.PI });
  }
  props.push({ kind: 'rock', x: cx + (rand() - 0.5) * 4, z: cz + (rand() - 0.5) * 4,
    scale: 0.8 + rand() * 0.5, rotY: rand() * Math.PI });

  const band = bandFor(anchorIdx / total);
  const loot = [{ x: cx, z: cz, value: Math.round(valueFor(band) * o.lootMult) }];
  const enemies = o.lurker
    ? [{ x: cx - px * 5, z: cz - pz * 5, mode: 'ambush', band }]
    : [];

  return { poiType: ID, anchor: { x: cx, z: cz }, props, enemies, loot };
}

// helpers: { makeTree, makeBush, makeRock } supplied by RoadBuilder so props match the
// road's existing tree look + flat palette. makeTree may return an array (trunk + foliage).
function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    const fn = pr.kind === 'tree' ? helpers.makeTree
             : pr.kind === 'bush' ? helpers.makeBush
             : helpers.makeRock;
    const out = fn(pr.x, pr.z, pr.scale, pr.rotY);
    for (const m of (Array.isArray(out) ? out : [out])) { meshes.push(m); shadowCasters.push(m); }
  }
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'point', place, build };
