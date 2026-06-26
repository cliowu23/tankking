// src/world/zones/pois/windmill.js
// Point-POI: an abandoned tower windmill off the road — a tall pastoral landmark (cream
// plaster tower, dome cap, a 4-sail cross, a lean-to grain store + cart). Model: windmill.glb
// (built in Blender). A landmark scavenge stop: loot chest at the base, light guard(s). The
// sails face the road so the windmill reads on approach. place() = data; build() instances it
// + a tower collision box.

const ID = 'windmill';
const DEFAULTS = {
  offset: 20,        // tall landmark sits off the road (inside the ~50u corridor)
  scale: 1.0,        // windmill.glb is authored at game scale
  chestScale: 1.3,
  lootMult: 2.4,
  faceOffset: 0,     // added to face-the-road so the SAILS open toward the road (sail side = +Z local)
  towerHalf: 2.0,    // AABB half-extent blocking the round tower (sails are high — no collision)
};

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = rand() < 0.5 ? 1 : -1;
  const px = -d.z * side, pz = d.x * side;                  // unit perpendicular, off-road
  const off = o.offset + (o.offsetBonus || 0);              // leg may push it farther out (varied distance)
  const wx = p.x + px * off, wz = p.z + pz * off;           // tower base
  const faceRoad = Math.atan2(-px, -pz);                    // toward the road
  const rotY = faceRoad + o.faceOffset;                     // sails face the road
  const band = bandFor(anchorIdx / total);

  // chest at the base toward the road, offset to the side so it's clear of the sail sweep
  const chx = wx - px * 4 + d.x * 3, chz = wz - pz * 4 + d.z * 3;
  const props = [
    { name: 'Windmill', x: wx, z: wz, scale: o.scale, rotY },
    { name: 'Chest', x: chx, z: chz, scale: o.chestScale, rotY: faceRoad },
    // grass/trees set clear of the tower + sail-sweep + outbuildings (off to the sides & back)
    { name: 'Bush', x: wx + d.x * 5 + px * 2, z: wz + d.z * 5 + pz * 2, scale: 1.2, rotY: rand() * Math.PI },
    { name: 'Bush', x: wx - d.x * 5 + px * 2, z: wz - d.z * 5 + pz * 2, scale: 1.1, rotY: rand() * Math.PI },
    { name: 'Tree', x: wx + px * 9 - d.x * 4, z: wz + pz * 9 - d.z * 4, scale: 1.3, rotY: rand() * Math.PI },
  ];

  const containers = [{ x: chx, z: chz, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  // Guard plan: sentries posted at the base on the road side, a lurker hidden in the tower.
  const guards = [
    { x: wx - px * 5 + d.x * 3, z: wz - pz * 5 + d.z * 3, role: 'sentry' },
    { x: wx - px * 5 - d.x * 3, z: wz - pz * 5 - d.z * 3, role: 'sentry' },
    { x: wx, z: wz, role: 'lurker' },                       // inside the tower
    { x: wx + px * 3, z: wz + pz * 3, role: 'lurker' },      // behind the tower
  ];
  return { poiType: ID, anchor: { x: wx, z: wz }, props, enemies: [], loot: [], containers, towerHalf: o.towerHalf, clearR: 13, guards };
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
  const h = inst.towerHalf ?? DEFAULTS.towerHalf;
  obstacles.push({ position: { x: inst.anchor.x, z: inst.anchor.z }, halfW: h, halfD: h });
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'point', place, build };
