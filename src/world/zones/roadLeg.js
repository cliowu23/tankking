// src/world/zones/roadLeg.js
// Procedural Long-Road LEG generator (ported from road-mockup.html). Pure data — no
// Babylon. Walks a cursor to a centerline, then emits world-space waypoint chains the
// textured RoadBuilder feeds straight into the game's buildPath():
//   roadA / roadB  — main road before/after the fork
//   forkL / forkR  — the two branches (bow out around an island, rejoin) — a route choice
//   spurs          — short side-roads off the main road, dead-ending at loot
//   checkpoint     — leg-end outpost position
//   signs          — ambiguous truthful markers at the fork mouth (skull/chest)
//   trees          — procedural roadside dressing
// Forks REJOIN for now (always completable); destination-forks come with real content later.

import { POI_LIST, POI_TYPES } from './pois/index.js';

const STEP = 4;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
}
function dirAt(pts, k) {
  const a = pts[Math.max(0,k-1)], b = pts[Math.min(pts.length-1,k+1)];
  let dx=b.x-a.x, dz=b.z-a.z; const l=Math.hypot(dx,dz)||1; return { x:dx/l, z:dz/l };
}

export function generateRoadLeg(seed = 1) {
  const rand = mulberry32(seed);
  const pts = [{ x:0, z:0 }];
  let x=0, z=0, hd=0;
  const run = (dist, turn) => {
    const n = Math.max(1, Math.round(dist/STEP)), dh = turn/n;
    for (let i=0;i<n;i++){ hd+=dh; x+=Math.sin(hd)*STEP; z+=Math.cos(hd)*STEP; pts.push({x,z}); }
  };
  run(30, 0);                                  // intro straight
  const segs = 6 + Math.floor(rand()*3);       // 6–8 procedural segments (one more → longer leg)
  for (let s=0;s<segs;s++){
    const len = 33 + rand()*36;                // 33–69u per segment (a touch longer)
    const turn = rand()<0.45 ? 0 : (rand()<0.5?-1:1)*(0.15+rand()*0.32);
    run(len, turn);
  }
  run(34, 0);                                  // outro straight into the checkpoint

  // Smooth the centerline. The per-segment constant-curvature walk leaves curvature
  // kinks at segment boundaries (straight→curve), which read as "stutters" even though
  // position is continuous. A few binomial low-pass passes round curvature into
  // continuity so the single Catmull-Rom ribbon is genuinely seamless. Endpoints pinned.
  for (let pass=0; pass<4; pass++){
    const src = pts.map(p=>({x:p.x,z:p.z}));
    for (let i=1;i<pts.length-1;i++){
      pts[i].x = 0.25*src[i-1].x + 0.5*src[i].x + 0.25*src[i+1].x;
      pts[i].z = 0.25*src[i-1].z + 0.5*src[i].z + 0.25*src[i+1].z;
    }
  }

  const total = pts.length;
  const bandFor = (frac) => frac < 0.34 ? 'near' : frac < 0.67 ? 'mid' : 'deep';
  const valueFor = (band) => band === 'near' ? 25 : band === 'mid' ? 50 : 100;
  // Clean intro: ~the intro straight + half a segment past spawn stays POI/hedge-free (just a
  // few dotted roadside trees) so the player eases in before the world gets busy.
  const INTRO_CLEAR = 16;

  // main road: ONE continuous centerline (no fork — reads as a single seamless ribbon)
  const roadMain = pts.map(p => [p.x, p.z]);
  // fixed southern approach (the road the tank came in on); same every run, straight at x=0
  const approach = [[0,-52],[0,-36],[0,-20],[0,-6]];

  // POI spurs: a side road that peels off the main road as a CURVED off-ramp (heading
  // blends from along-road → outward), dead-ending at guarded loot. Starting on the road
  // + the patchy-mask edge feathering makes the junction read as a natural offshoot.
  // No standalone dead-end spurs (they used to peel off to a bare loot crate, which read as
  // "a road to nothing"). A road only branches off to REACH a POI now — the POI pass below
  // fills spurs[] (e.g. the mini-camp adds its own branch road to its clearing).
  const spurs = [], enemies = [], loot = [];
  const spurIdx = [];

  // road-blockers: enemies sitting ON the centerline you must beat to pass (escalating)
  for (const frac of [0.32, 0.55, 0.78]) {
    const i = Math.round(frac * (total-1));
    const p = pts[i];
    enemies.push({ x:p.x, z:p.z, mode:'patrol', band:bandFor(frac) });
  }

  // modular POI placement pass (registry-driven). Pick a few POIs along the centerline,
  // away from the spurs and road-blockers, and FOLD their enemies/loot into the leg's
  // existing arrays — so combat, drive-over pickups, and extraction stay unchanged.
  // Build a curved access road from a road point out to a POI's anchor (blends along-road →
  // toward-anchor for a natural off-ramp), stopping `stopShort` before the anchor so the road
  // ends at the yard/approach, not inside the building.
  const buildAccessSpur = (idx, anchor, stopShort) => {
    const rp = pts[idx], d = dirAt(pts, idx);
    let cx = rp.x, cz = rp.z; const wps = [[cx, cz]];
    // Step toward the anchor until within stopShort (so it always REACHES the POI, regardless of
    // how the path curves). Ease from along-road → straight-at-anchor over the first few steps
    // so the junction reads as a smooth off-ramp, not a hard right-angle.
    for (let q = 0; q < 48; q++) {
      let dx = anchor.x - cx, dz = anchor.z - cz; const dist = Math.hypot(dx, dz);
      if (dist <= stopShort) break;
      dx /= dist; dz /= dist;
      const t = Math.min(1, q / 3);
      let bx = d.x * (1 - t) + dx * t, bz = d.z * (1 - t) + dz * t; const bl = Math.hypot(bx, bz) || 1;
      cx += bx / bl * STEP; cz += bz / bl * STEP; wps.push([cx, cz]);
    }
    return wps;
  };

  const pois = [];
  const containers = [];
  const poiSpurs = [];   // access roads to far POIs (also used to clear bocage around them)
  const blockerIdx = [0.32, 0.55, 0.78].map(f => Math.round(f * (total - 1)));
  const poiIdxList = [];
  // POIs need real spacing from EACH OTHER (so they don't stack), but only a light buffer from
  // road-blockers/spurs — a blocker sits ON the road while a POI is offset to the side, so they
  // can share a stretch. (A ±10 blocker exclusion used to eat every slot on short legs → 0 POIs.)
  const POI_GAP = 7;   // min along-road spacing between POIs (they're offset to the sides, so tight is OK)
  const tooClose = (idx) => poiIdxList.some(j => Math.abs(j - idx) < POI_GAP)
    || blockerIdx.some(j => Math.abs(j - idx) < 3) || spurIdx.some(j => Math.abs(j - idx) < 3);
  // GUARANTEED one of each major POI per leg (so the player meets all of them every run), plus a
  // few extra random picks so the COUNT varies — capped to what the leg length actually fits, so
  // the 4 guaranteed always have room (short legs were dropping a type). Order shuffled, then
  // placed at evenly-spread slots along the leg (distributed, not clustered).
  const lo = INTRO_CLEAR, hi = total - 12;
  const maxFit = Math.floor((hi - lo) / POI_GAP);
  const queue = ['farmstead', 'windmill', 'roadside-hut', 'mini-camp'].map(id => POI_TYPES[id]).filter(Boolean);
  const extraN = Math.max(0, Math.min(1 + Math.floor(rand() * 3), maxFit - queue.length));   // +0..3, length-capped
  for (let i = 0; i < extraN && POI_LIST.length; i++) queue.push(POI_LIST[Math.floor(rand() * POI_LIST.length)]);
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }

  const nQ = queue.length;
  for (let s = 0; s < nQ; s++) {
    const type = queue[s];
    const slotC = lo + (hi - lo) * (s + 0.5) / nQ;   // evenly-spread slot centre
    let idx, tries = 0;
    do { idx = Math.round(slotC + (rand() - 0.5) * ((hi - lo) / nQ) * 0.7); idx = Math.max(lo, Math.min(hi, idx)); tries++; }
    while (tooClose(idx) && tries < 24);
    if (tooClose(idx)) {
      // slot was blocked — scan outward from it for ANY clear spot, so a guaranteed type is
      // never silently dropped (every leg keeps one of each major POI).
      idx = -1;
      for (let r = 1; r <= hi - lo && idx < 0; r++) {
        for (const cand of [Math.round(slotC) + r, Math.round(slotC) - r]) {
          if (cand >= lo && cand <= hi && !tooClose(cand)) { idx = cand; break; }
        }
      }
      if (idx < 0) continue;   // leg genuinely packed (shouldn't happen) → skip
    }
    poiIdxList.push(idx);
    // Vary distance from the road with an ABSOLUTE offset (overrides each POI's base) so the
    // close/far split is unambiguous: ~50% hug the road (13–18u, no access road needed), the
    // rest sit clearly FAR out (34–52u, on green grass before the ~55u barren OOB tint) and
    // ALWAYS get an access road. (Using base offsets meant a windmill's base-20 "close" looked
    // far-ish yet roadless — the bug just reported.)
    const far = type.scale !== 'segment' && rand() < 0.5;
    const offset = far ? 34 + rand() * 18 : 13 + rand() * 5;
    const inst = type.place({ pts, total, dirAt, bandFor, valueFor, anchorIdx: idx }, rand,
      type.scale === 'segment' ? {} : { offset });
    if (!inst) continue;
    pois.push(inst);
    // POI combat = ONE encounter marker at the anchor; ArenaScene turns it into
    // either 2 Sentinels or 8 spider-bots (replaces the POI's own guard enemies).
    enemies.push({ x: inst.anchor.x, z: inst.anchor.z, mode: 'ambush', band: bandFor(idx / total), poi: true, guards: inst.guards });
    for (const l of (inst.loot || [])) loot.push(l);
    for (const c of (inst.containers || [])) containers.push(c);
    if (inst.spur) spurs.push(inst.spur);   // mini-camp etc. add their own branch road
    else if (far) {                          // far point-POI → carve a small access road to it
      // Reach right into the POI's yard (just shy of the building footprint) so the road clearly
      // LEADS UP TO it; the blotchy end-fade (RoadBuilder) only frays the very tip at the yard.
      const stopShort = Math.max(3, Math.round((inst.clearR ?? 9) * 0.45));
      const wps = buildAccessSpur(idx, inst.anchor, stopShort);
      spurs.push({ wps }); poiSpurs.push(wps);
    }
  }

  // ── bocage regions: stretches where the road runs THROUGH hedgerow country ──────────────
  // 1–2 chunks become bocage: the verge on both sides fills with a hedgerow field-patchwork
  // that extends LATERALLY into the landscape — several parallel rows (field boundaries that
  // line the lane) + perpendicular cross-walls (field cells), jittered & gapped so it reads
  // organic, not gridded. Hedges follow the road's curve and NEVER overlap it (roadDist
  // clearance skips any that would). Built from one segment (hedge.glb), instanced by RoadBuilder.
  const hedges = [];
  const HSEG = 5, HSTEP = 2.5, LANES = [11, 28, 46], MINCLEAR = 7;   // tile len; placement step (≈half len → heavy OVERLAP so curves never break); inner row at 11 stays clear of the meander+road; rows out to the playable edge; road clearance
  const roadDist = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) { const dx = pts[i].x - x, dz = pts[i].z - z; const d = dx * dx + dz * dz; if (d < best) best = d; }
    return Math.sqrt(best);
  };
  // CUT-OUT: skip any hedge inside a POI's clearing radius, so a POI sitting in bocage reads as
  // a field deliberately cleared for it (not a building clipped by hedges). clearR is per-POI.
  const poiClear = (x, z) => pois.some((po) => {
    const r = po.clearR ?? 11;
    return (po.anchor.x - x) ** 2 + (po.anchor.z - z) ** 2 < r * r;
  });
  // keep the access roads to far POIs clear of hedges (≈ a lane width either side of each waypoint)
  const spurClear = (x, z) => poiSpurs.some((wps) => wps.some(([wx, wz]) => (wx - x) ** 2 + (wz - z) ** 2 < 6 * 6));
  const addHedge = (x, z, rotY) => {
    if (roadDist(x, z) >= MINCLEAR && !poiClear(x, z) && !spurClear(x, z)) hedges.push({ x, z, rotY });
  };
  const bocageSpans = [];
  const nBoc = 1 + (rand() < 0.5 ? 1 : 0);
  for (let b = 0; b < nBoc; b++) {
    let s0, tries = 0;
    do { s0 = INTRO_CLEAR + Math.floor(rand() * Math.max(1, total - INTRO_CLEAR - 32)); tries++; }
    while (bocageSpans.some(([a, c]) => s0 < c + 8 && s0 + 20 > a - 8) && tries < 16);
    const e0 = Math.min(total - 12, s0 + 14 + Math.floor(rand() * 8));
    if (e0 - s0 >= 8) bocageSpans.push([s0, e0]);
  }
  const rotXZ = (vx, vz, t) => [vx * Math.cos(t) - vz * Math.sin(t), vx * Math.sin(t) + vz * Math.cos(t)];
  for (const [s0, e0] of bocageSpans) {
    const skew = (rand() - 0.5) * 0.8;   // per-chunk field skew (~±23°) → slanted fields, not a 90° grid
    const nextCross = { 1: 2 + Math.floor(rand() * 4), '-1': 2 + Math.floor(rand() * 4) };  // per-side cross-wall schedule (uneven)
    let acc = HSTEP, count = 0;
    for (let i = s0; i < e0; i++) {
      const a = pts[i], bn = pts[i + 1] || pts[i];
      acc += Math.hypot(bn.x - a.x, bn.z - a.z);
      if (acc < HSTEP) continue;
      acc = 0; count++;
      const dd = dirAt(pts, i), head = Math.atan2(dd.x, dd.z), nx = -dd.z, nz = dd.x;
      for (const side of [1, -1]) {
        // CONTINUOUS rows filling the verge to the playable edge, tiles OVERLAP (no seams), big
        // tank-sized gaps only. Each row MEANDERS (low-freq wave, per-row phase) so the rows
        // aren't straight parallel lines — breaks the spreadsheet/grid look.
        LANES.forEach((off, li) => {
          const phase = li * 4 + (side > 0 ? 0 : 5);
          if ((count + phase) % 17 < 2) return;     // a RARE big gap (skip 2 of the dense overlapping tiles)
          const mf = 0.28, ma = 2.3, mph = li * 1.7 + (side > 0 ? 0 : 2.3);   // gentler meander → fewer curve breaks
          const meander = Math.sin(count * mf + mph) * ma;
          const dMean   = Math.cos(count * mf + mph) * ma * mf;   // lateral slope of the row at this point
          const o = off + meander + (rand() - 0.5) * 0.4;
          // Orient the tile along the ROW'S local direction (road tangent + meander slope) so the
          // hedge FOLLOWS the curving/wavy row rather than pointing straight → no breaks on curves.
          const rowHead = Math.atan2(dd.x * HSTEP + nx * side * dMean, dd.z * HSTEP + nz * side * dMean);
          addHedge(a.x + nx * o * side, a.z + nz * o * side, rowHead);
        });
        // angled cross-walls at UNEVEN intervals with a randomized START offset, so the verticals
        // don't line up with each other or with the rows. Slanted by the chunk skew (parallelograms).
        if (count >= nextCross[side]) {
          nextCross[side] = count + 4 + Math.floor(rand() * 4);   // 4–7 tiles → uneven spacing
          const [wx, wz] = rotXZ(nx * side, nz * side, skew + (rand() - 0.5) * 0.3);
          const wrot = Math.atan2(wx, wz);
          for (let t = LANES[0] + rand() * 6; t <= LANES[LANES.length - 1]; t += HSTEP) {
            addHedge(a.x + wx * t, a.z + wz * t, wrot);
          }
        }
      }
    }
  }
  const inBocage = (i) => bocageSpans.some(([s0, e0]) => i >= s0 - 1 && i <= e0 + 1);

  // procedural roadside trees — kept off the road, AWAY from POIs (no clipping into a barn),
  // and out of bocage stretches (the hedgerows own that space).
  const trees = [];
  const nearPOI = (x, z) => pois.some((po) => (po.anchor.x - x) ** 2 + (po.anchor.z - z) ** 2 < 13 * 13);
  for (let i = 4; i < pts.length; i += 7) {
    if (inBocage(i)) continue;
    const p = pts[i], d = dirAt(pts, i), side = (i % 14 < 7) ? 1 : -1, px = -d.z * side, pz = d.x * side;
    const off = 9 + rand() * 7;
    const tx = p.x + px * off, tz = p.z + pz * off;
    if (!nearPOI(tx, tz)) trees.push([tx, tz]);
  }

  // ambient tree GROVES — clumps scattered to the sides (no road, no loot), replacing the
  // tree-patch POI's visual role. Off-road, away from POIs, out of bocage stretches.
  const nGrove = 3 + Math.floor(rand() * 3);   // 3–5 clumps per leg
  for (let g = 0; g < nGrove; g++) {
    const gi = INTRO_CLEAR + Math.floor(rand() * Math.max(1, total - INTRO_CLEAR - 8));
    if (inBocage(gi)) continue;
    const p = pts[gi], d = dirAt(pts, gi), side = rand() < 0.5 ? 1 : -1, px = -d.z * side, pz = d.x * side;
    const off = 18 + rand() * 22;              // 18–40u to the side (clear of the lane)
    const cx = p.x + px * off, cz = p.z + pz * off;
    if (nearPOI(cx, cz)) continue;
    const nT = 3 + Math.floor(rand() * 4);     // 3–6 trees per clump
    const cluster = 0.8 + rand() * 0.8;        // per-clump base size (some groves big, some small)
    for (let t = 0; t < nT; t++) {
      const a = rand() * Math.PI * 2, r = rand() * 5;
      const s = cluster * (0.7 + rand() * 0.7);   // per-tree size jitter → varied shapes & sizes
      trees.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, s]);
    }
  }

  const checkpoint = { x: pts[pts.length-1].x, z: pts[pts.length-1].z };

  // bounds (for ground sizing + tank clamp): bbox of road + spurs + margin
  let minX=0,maxX=0,minZ=0,maxZ=0;
  const eat = (x,z) => { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); };
  for (const p of pts) eat(p.x, p.z);
  for (const sp of spurs) for (const w of sp.wps) eat(w[0], w[1]);
  for (const poi of pois) for (const pr of poi.props) eat(pr.x, pr.z);
  for (const c of containers) eat(c.x, c.z);
  for (const h of hedges) eat(h.x, h.z);       // bocage hedgerows extend the corridor
  for (const a of approach) eat(a[0], a[1]);   // include the southern approach (z down to −52)
  // full drivable centerline = approach + main (for the boundary corridor + edge fade)
  const centerline = [...approach, ...roadMain];
  const half = Math.ceil(Math.max(maxX-minX, maxZ-minZ)/2 + 80);   // extent (ground sizing)
  const center = { x:(minX+maxX)/2, z:(minZ+maxZ)/2 };
  // tank clamp is a box ±clampHalf around the ORIGIN (not the bbox centre), so it must
  // reach the furthest coordinate (the leg starts at 0,0 and runs +Z to the checkpoint).
  const clampHalf = Math.ceil(Math.max(Math.abs(minX),Math.abs(maxX),Math.abs(minZ),Math.abs(maxZ)) + 80);

  return {
    seed, roadMain, approach, centerline, spurs, trees, hedges, checkpoint, enemies, loot, pois, containers,
    start: { x: pts[0].x, z: pts[0].z, facing: 0 },
    bbox: { minX, maxX, minZ, maxZ, center, half, clampHalf },
  };
}
