// src/world/zones/pois/roadsideHut.js
// Point-POI: a cozy hut just off the road that the road "leads to" — drive up and press E
// to loot the chest by its door. A guard or two; richer reward than a tree-patch.
// place() = pure data (props + enemies + an E-loot container); build() instances the GLB
// templates (Hut, Chest, trees) via helpers.prop.

const ID = 'roadside-hut';
const DEFAULTS = {
  offset: 13,        // how far off the road centerline the hut sits (inside the ~50u corridor)
  hutScale: 1.5,
  chestScale: 1.3,
  lootMult: 2.0,     // vs an open spur crate
  doorOffset: Math.PI, // rotation so the door faces the road (tuned by eye)
};

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = rand() < 0.5 ? 1 : -1;
  const px = -d.z * side, pz = d.x * side;                 // unit perpendicular, off-road
  const hx = p.x + px * o.offset, hz = p.z + pz * o.offset; // hut position
  const faceRoad = Math.atan2(-px, -pz);                   // toward the road
  const hutRot = faceRoad + o.doorOffset;
  const chx = hx - px * 4.5, chz = hz - pz * 4.5;          // chest in front, toward the road

  const props = [
    { name: 'Hut',   x: hx,  z: hz,  scale: o.hutScale,   rotY: hutRot },
    { name: 'Chest', x: chx, z: chz, scale: o.chestScale, rotY: faceRoad },
    // dressing trees behind/beside the hut
    { name: 'Tree_Pine',  x: hx + px * 4 - 4, z: hz + pz * 4 - 2, scale: 1.3, rotY: rand() * Math.PI },
    { name: 'Tree_Round', x: hx + px * 4 + 4, z: hz + pz * 4 + 2, scale: 1.3, rotY: rand() * Math.PI },
  ];

  const band = bandFor(anchorIdx / total);
  const containers = [{ x: chx, z: chz, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  const enemies = [
    { x: hx - px * 7, z: hz - pz * 7, mode: 'ambush', band },           // guard between road & hut
    ...(rand() < 0.6 ? [{ x: hx + d.x * 6, z: hz + d.z * 6, mode: 'patrol', band }] : []),
  ];
  return { poiType: ID, anchor: { x: hx, z: hz }, props, enemies, loot: [], containers };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    for (const m of helpers.prop(pr.name, pr.x, pr.z, pr.scale, pr.rotY)) { meshes.push(m); shadowCasters.push(m); }
  }
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'point', place, build };
