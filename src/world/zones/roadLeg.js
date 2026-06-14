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

  const total = pts.length;
  const fi = Math.floor(total*0.42);
  const fj = Math.min(total-4, fi+11);

  // fork branches: sine-bump perpendicular offset (0→D→0) → diverge from fi, rejoin at fj
  const span = pts.slice(fi, fj+1), L = span.length, D = 26;
  const forkL = [], forkR = [];
  for (let k=0;k<L;k++){
    const t=k/(L-1), off=Math.sin(t*Math.PI)*D, p=span[k], d=dirAt(span,k);
    const px=-d.z, pz=d.x;
    forkL.push([p.x+px*off, p.z+pz*off]);
    forkR.push([p.x-px*off, p.z-pz*off]);
  }

  // POI spurs: short side road off the main line, dead-ending at a loot crate
  const spurs = [];
  const nSpur = 1 + (rand()<0.6 ? 1 : 0);
  for (let s=0;s<nSpur;s++){
    let idx, tries=0;
    do { idx = 8 + Math.floor(rand()*(total-14)); tries++; }
    while ((idx>=fi-2 && idx<=fj+2) && tries<12);
    const p=pts[idx], d=dirAt(pts,idx), side=rand()<0.5?1:-1, px=-d.z*side, pz=d.x*side;
    const wps=[]; const SPUR_LEN=30;
    for (let q=0;q<=SPUR_LEN;q+=STEP) wps.push([p.x+px*q, p.z+pz*q]);
    spurs.push({ wps, loot:[p.x+px*SPUR_LEN, p.z+pz*SPUR_LEN] });
  }

  // signs at the fork mouth (truthful contract: skull→left branch, chest→right)
  const fp=pts[fi], fd=dirAt(pts,fi), fpx=-fd.z, fpz=fd.x;
  const signs = [
    { glyph:'💀', bg:'#caa', x:fp.x+fpx*9, z:fp.z+fpz*9 },
    { glyph:'📦', bg:'#cc9', x:fp.x-fpx*9, z:fp.z-fpz*9 },
  ];

  // procedural roadside trees (alternating sides, kept off the road body)
  const trees = [];
  for (let i=4;i<pts.length;i+=7){
    const p=pts[i], d=dirAt(pts,i), side=(i%14<7)?1:-1, px=-d.z*side, pz=d.x*side;
    const off = 9 + rand()*7;
    trees.push([p.x+px*off, p.z+pz*off]);
  }

  // main road split into A (start→fork) and B (fork→end); fork span is the two branches
  const roadA = pts.slice(0, fi+1).map(p=>[p.x,p.z]);
  const roadB = pts.slice(fj).map(p=>[p.x,p.z]);
  const checkpoint = { x: pts[pts.length-1].x, z: pts[pts.length-1].z };

  // bounds (for ground sizing + tank clamp): bbox of everything + margin
  let minX=0,maxX=0,minZ=0,maxZ=0;
  for (const p of pts){ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minZ=Math.min(minZ,p.z); maxZ=Math.max(maxZ,p.z); }
  for (const a of [...forkL,...forkR]){ minX=Math.min(minX,a[0]); maxX=Math.max(maxX,a[0]); }
  const half = Math.ceil(Math.max(maxX-minX, maxZ-minZ)/2 + 80);   // extent (ground sizing)
  const center = { x:(minX+maxX)/2, z:(minZ+maxZ)/2 };
  // tank clamp is a box ±clampHalf around the ORIGIN (not the bbox centre), so it must
  // reach the furthest coordinate (the leg starts at 0,0 and runs +Z to the checkpoint).
  const clampHalf = Math.ceil(Math.max(Math.abs(minX),Math.abs(maxX),Math.abs(minZ),Math.abs(maxZ)) + 80);

  return {
    seed, roadA, roadB, forkL, forkR, spurs, signs, trees, checkpoint,
    start: { x: pts[0].x, z: pts[0].z, facing: 0 },
    bbox: { minX, maxX, minZ, maxZ, center, half, clampHalf },
  };
}
