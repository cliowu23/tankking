// src/world/zones/pois/farmstead.js
// Point-POI: an abandoned farmstead just off the road — a big gambrel barn + detached silo,
// a fodder lean-to, hay bales, a paddock fence (model: farmstead.glb, built in Blender). A
// guarded scavenge site: drive into the yard, clear the scout-bot guard(s), press E to loot
// the chest by the barn. The anchor landmark of its leg (bigger reward than a roadside hut).
// place() = pure data; build() instances the GLB set-piece + dressing + a barn collision box.

const ID = 'farmstead';
const DEFAULTS = {
  offset: 22,        // a big building sits well back off the road (inside the ~50u corridor)
  scale: 1.0,        // farmstead.glb is authored at game scale — no multiplier
  chestScale: 1.3,
  lootMult: 2.6,     // a real landmark → richer than a roadside hut
  faceOffset: 0,     // rotation added to face-the-road so the yard/door opens toward the road
  barnHalf: 4.3,     // AABB half-extent blocking the solid barn mass
};

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = rand() < 0.5 ? 1 : -1;
  const px = -d.z * side, pz = d.x * side;                  // unit perpendicular, off-road
  const off = o.offset + (o.offsetBonus || 0);              // leg may push it farther out (varied distance)
  const fx = p.x + px * off, fz = p.z + pz * off;           // barn (set-piece) centre
  const faceRoad = Math.atan2(-px, -pz);                    // toward the road
  const rotY = faceRoad + o.faceOffset;
  const band = bandFor(anchorIdx / total);

  // chest in the yard between the barn and the road — the scavenge cache you drive up to
  const chx = fx - px * 7, chz = fz - pz * 7;
  const props = [
    { name: 'Farmstead', x: fx, z: fz, scale: o.scale, rotY },
    { name: 'Chest', x: chx, z: chz, scale: o.chestScale, rotY: faceRoad },
    // overgrowth set WELL CLEAR of the barn footprint (behind it, spread along the road axis)
    { name: 'Tree', x: fx + px * 10 + d.x * 3, z: fz + pz * 10 + d.z * 3, scale: 1.3, rotY: rand() * Math.PI },
    { name: 'Bush', x: fx + px * 8.5 - d.x * 5.5, z: fz + pz * 8.5 - d.z * 5.5, scale: 1.2, rotY: rand() * Math.PI },
    { name: 'Bush', x: fx + px * 8 + d.x * 6, z: fz + pz * 8 + d.z * 6, scale: 1.1, rotY: rand() * Math.PI },
  ];

  const containers = [{ x: chx, z: chz, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  // Guard plan: bots wait INSIDE the barn and file out the front door (road-facing −px side) in
  // single file when you arrive. The heavy (sentry) comes out last.
  const doorN = { nx: -px, nz: -pz };                 // outward through the door, toward the road
  const ix = fx - px * 2.5, iz = fz - pz * 2.5;       // just inside the barn, at the door
  const guards = [
    { x: ix, z: iz, role: 'lurker', door: doorN, exitOrder: 0 },
    { x: ix, z: iz, role: 'lurker', door: doorN, exitOrder: 1 },
    { x: ix, z: iz, role: 'lurker', door: doorN, exitOrder: 2 },
    { x: ix, z: iz, role: 'sentry', door: doorN, exitOrder: 3 },
  ];
  return { poiType: ID, anchor: { x: fx, z: fz }, props, enemies: [], loot: [], containers, barnHalf: o.barnHalf, clearR: 15, guards };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    let made;
    if (pr.name === 'Bush') made = helpers.makeBush(pr.x, pr.z, pr.scale, pr.rotY);
    else if (pr.name === 'Tree') made = helpers.makeTree(pr.x, pr.z, pr.scale, pr.rotY);
    else made = helpers.prop(pr.name, pr.x, pr.z, pr.scale, pr.rotY);
    for (const m of made) { meshes.push(m); shadowCasters.push(m); }
  }
  // block the solid barn mass so you can't drive through it (square AABB ≈ covers any rotation)
  const h = inst.barnHalf ?? DEFAULTS.barnHalf;
  obstacles.push({ position: { x: inst.anchor.x, z: inst.anchor.z }, halfW: h, halfD: h });
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'point', place, build };
