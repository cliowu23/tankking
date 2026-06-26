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

  // Door-facing: the Hut's door is on its +Y model face; after the Y-up export the rotation that
  // points the door toward a target (tx,tz) is atan2(houseX−tx, houseZ−tz). (Same convention the
  // roadside hut uses.) Houses face the clearing centre (where the road/chest is).
  const doorToward = (hx, hz, tx, tz) => Math.atan2(hx - tx, hz - tz);

  const props = [];
  const guards = [];
  // Houses SURROUND the clearing — flanking both sides (and the back), never on the spur/road,
  // each turned so its DOOR faces the centre/road. A little hamlet straddling the road. Each
  // house hides a LURKER (spider-bot) that bursts out as you arrive.
  const nHut = 2 + (rand() < 0.5 ? 1 : 0);   // 2–3
  // slots around the centre: [along-road lateral, outward] — left & right flanks, plus a back one.
  const slots = [ [-1, 0.3], [1, 0.3], [0, 1.0], [-0.8, 0.9], [0.8, 0.9] ];
  for (let i = 0; i < nHut; i++) {
    const [latF, outF] = slots[i];
    const lat = latF * (6.5 + rand() * 1.5), out = outF * (5 + rand() * 2);
    const hx = center.x + d.x * lat + px * out + (rand() - 0.5) * 1.0;
    const hz = center.z + d.z * lat + pz * out + (rand() - 0.5) * 1.0;
    props.push({ name: 'Hut', x: hx, z: hz, scale: o.hutScale, rotY: doorToward(hx, hz, center.x, center.z) });
    guards.push({ x: hx, z: hz, role: 'lurker' });   // a bot waits inside this house
  }
  // sentries posted in the clearing toward the road (the welcoming party you see first)
  guards.push({ x: center.x - px * 5 + d.x * 2.5, z: center.z - pz * 5 + d.z * 2.5, role: 'sentry' });
  guards.push({ x: center.x - px * 5 - d.x * 2.5, z: center.z - pz * 5 - d.z * 2.5, role: 'sentry' });
  // dressing trees flank the camp (to the sides, clear of the house row + approach)
  for (let i = 0; i < 4; i++) {
    const sideSel = i % 2 ? 1 : -1;
    const lat = sideSel * (8 + rand() * 4), fwd = (rand() - 0.5) * 8;
    props.push({ name: TREES[Math.floor(rand() * TREES.length)],
      x: center.x + d.x * lat + px * fwd, z: center.z + d.z * lat + pz * fwd,
      scale: 1.1 + rand() * 0.6, rotY: rand() * Math.PI });
  }
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2, r = 3 + rand() * 3;
    props.push({ name: 'Bush', x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, scale: 1.0 + rand() * 0.4, rotY: rand() * Math.PI });
  }
  // chest sits in the clearing in FRONT of the houses (toward the road) — the thing you drive up to
  props.push({ name: 'Chest', x: center.x - px * 2, z: center.z - pz * 2, scale: o.chestScale, rotY: Math.atan2(px, pz) });

  const containers = [{ x: center.x - px * 2, z: center.z - pz * 2, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  return { poiType: ID, anchor: center, props, enemies: [], loot: [], containers, spur: { wps }, clearR: 16, guards };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    for (const m of helpers.prop(pr.name, pr.x, pr.z, pr.scale, pr.rotY)) { meshes.push(m); shadowCasters.push(m); }
  }
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'segment', place, build };
