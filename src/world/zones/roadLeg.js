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
  const segs = 5 + Math.floor(rand()*3);       // 5–7 procedural segments
  for (let s=0;s<segs;s++){
    const len = 30 + rand()*34;
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

  // main road: ONE continuous centerline (no fork — reads as a single seamless ribbon)
  const roadMain = pts.map(p => [p.x, p.z]);

  // POI spurs: a side road that peels off the main road as a CURVED off-ramp (heading
  // blends from along-road → outward), dead-ending at guarded loot. Starting on the road
  // + the patchy-mask edge feathering makes the junction read as a natural offshoot.
  const spurs = [], enemies = [], loot = [];
  const nSpur = 1 + (rand()<0.6 ? 1 : 0);
  const spurIdx = [];
  for (let s=0;s<nSpur;s++){
    let idx, tries=0;
    do { idx = 10 + Math.floor(rand()*(total-18)); tries++; }
    while (spurIdx.some(j => Math.abs(j-idx) < 6) && tries<14);
    spurIdx.push(idx);
    const p=pts[idx], d=dirAt(pts,idx), side=rand()<0.5?1:-1, px=-d.z*side, pz=d.x*side;
    const SPUR_LEN=34, n=Math.round(SPUR_LEN/STEP);
    let cx=p.x, cz=p.z; const wps=[[cx,cz]];
    for (let q=1;q<=n;q++){
      const t=q/n;                                   // blend along-road → outward
      let bx=d.x*(1-t)+px*t, bz=d.z*(1-t)+pz*t; const bl=Math.hypot(bx,bz)||1;
      cx+=bx/bl*STEP; cz+=bz/bl*STEP; wps.push([cx,cz]);
    }
    const lootPos=[cx,cz], band=bandFor(idx/total);
    spurs.push({ wps, loot:lootPos });
    loot.push({ x:lootPos[0], z:lootPos[1], value:valueFor(band) });
    enemies.push({ x:cx-px*6, z:cz-pz*6, mode:'ambush', band });   // a guard on the loot
  }

  // road-blockers: enemies sitting ON the centerline you must beat to pass (escalating)
  for (const frac of [0.32, 0.55, 0.78]) {
    const i = Math.round(frac * (total-1));
    const p = pts[i];
    enemies.push({ x:p.x, z:p.z, mode:'patrol', band:bandFor(frac) });
  }

  // procedural roadside trees (alternating sides, kept off the road body)
  const trees = [];
  for (let i=4;i<pts.length;i+=7){
    const p=pts[i], d=dirAt(pts,i), side=(i%14<7)?1:-1, px=-d.z*side, pz=d.x*side;
    const off = 9 + rand()*7;
    trees.push([p.x+px*off, p.z+pz*off]);
  }

  const checkpoint = { x: pts[pts.length-1].x, z: pts[pts.length-1].z };

  // bounds (for ground sizing + tank clamp): bbox of road + spurs + margin
  let minX=0,maxX=0,minZ=0,maxZ=0;
  const eat = (x,z) => { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); };
  for (const p of pts) eat(p.x, p.z);
  for (const sp of spurs) for (const w of sp.wps) eat(w[0], w[1]);
  const half = Math.ceil(Math.max(maxX-minX, maxZ-minZ)/2 + 80);   // extent (ground sizing)
  const center = { x:(minX+maxX)/2, z:(minZ+maxZ)/2 };
  // tank clamp is a box ±clampHalf around the ORIGIN (not the bbox centre), so it must
  // reach the furthest coordinate (the leg starts at 0,0 and runs +Z to the checkpoint).
  const clampHalf = Math.ceil(Math.max(Math.abs(minX),Math.abs(maxX),Math.abs(minZ),Math.abs(maxZ)) + 80);

  return {
    seed, roadMain, spurs, trees, checkpoint, enemies, loot,
    start: { x: pts[0].x, z: pts[0].z, facing: 0 },
    bbox: { minX, maxX, minZ, maxZ, center, half, clampHalf },
  };
}
