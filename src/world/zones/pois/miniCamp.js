// src/world/zones/pois/miniCamp.js
// Segment-POI: a side road branches ~2 seconds (~16-20u, see feedback_distance_in_seconds)
// off the main road into a small abandoned camp — a few huts + scattered trees, enemies
// around it, and a central chest you press E to loot. The richest, best-guarded reward.
// place() emits a `spur` (branch road, drawn by RoadBuilder) + props/enemies/container.

const ID = 'mini-camp';
const DEFAULTS = {
  spurLen: 18,       // ~2.25s at the tank's ~8 u/s cruise
  hutScale: 1.2,
  chestScale: 1.35,
  lootMult: 3.0,     // guarded camp → richest
};
const TREES = ['Tree_Round', 'Tree_Pine', 'Tree_Cluster'];

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = rand() < 0.5 ? 1 : -1;
  const px = -d.z * side, pz = d.x * side;

  // branch road: from the road outward to the clearing, with a slight forward drift so it
  // reads as a natural off-ramp (blends perpendicular → outward).
  const wps = [[p.x, p.z]];
  let cx = p.x, cz = p.z; const n = 6, step = o.spurLen / n;
  for (let i = 1; i <= n; i++) {
    let bx = px * 0.85 + d.x * 0.15, bz = pz * 0.85 + d.z * 0.15;
    const bl = Math.hypot(bx, bz) || 1;
    cx += bx / bl * step; cz += bz / bl * step; wps.push([cx, cz]);
  }
  const center = { x: cx, z: cz };
  const band = bandFor(anchorIdx / total);

  const props = [];
  const nHut = 2 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < nHut; i++) {
    const a = (i / nHut) * Math.PI * 2 + rand() * 0.4, r = 7 + rand() * 2;
    props.push({ name: 'Hut', x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, scale: o.hutScale, rotY: a + Math.PI });
  }
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2, r = 9 + rand() * 4;
    props.push({ name: TREES[Math.floor(rand() * TREES.length)], x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, scale: 1.2 + rand() * 0.4, rotY: rand() * Math.PI });
  }
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2, r = 3 + rand() * 4;
    props.push({ name: 'Bush', x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, scale: 1.0 + rand() * 0.4, rotY: rand() * Math.PI });
  }
  props.push({ name: 'Chest', x: center.x, z: center.z, scale: o.chestScale, rotY: rand() * Math.PI });

  const containers = [{ x: center.x, z: center.z, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  const enemies = [];
  const nEnemy = 3 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < nEnemy; i++) {
    const a = (i / nEnemy) * Math.PI * 2 + 0.5, r = 5 + rand() * 3;
    enemies.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, mode: i % 2 ? 'ambush' : 'patrol', band });
  }
  return { poiType: ID, anchor: center, props, enemies, loot: [], containers, spur: { wps } };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    for (const m of helpers.prop(pr.name, pr.x, pr.z, pr.scale, pr.rotY)) { meshes.push(m); shadowCasters.push(m); }
  }
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'segment', place, build };
