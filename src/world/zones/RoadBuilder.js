// src/world/zones/RoadBuilder.js
// Builds a procedural Long-Road LEG into the live game scene, in the game's own art
// style: the textured dirt-path ribbon (game's buildPath: Catmull-Rom + Duckov patchy
// mask + world-UV dirt), grass ground, trees, a checkpoint outpost, POI loot crates,
// and ambiguous skull/chest signs at the fork. Consumes zone.roadLeg (from roadLeg.js).
//
// NOTE: the path-art helpers (makePathMask / surf / worldUV / buildPath) are duplicated
// from World1Builder.js for now to guarantee identical visuals with zero risk to that
// 594-line file. TODO: extract a shared road-art module and dedupe both onto it.

import {
  MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh,
  VertexBuffer, Texture, DynamicTexture,
} from '@babylonjs/core';
import { POI_TYPES } from './pois/index.js';
import { loadPropTemplates, instanceProp } from '../props/loadProp.js';

// POI prop sizing: scale the native GLB props (built ~game-scale in Blender) to read
// alongside the procedural roadside trees. Multiplied on top of each POI's per-prop scale.
const POI_TREE_SCALE = 1.4, POI_BUSH_SCALE = 1.2, POI_ROCK_SCALE = 1.2;
const ROAD_TREE_SCALE = 1.3;   // roadside dressing trees (× per-tree variation)
const TREE_VARIANTS  = ['Tree_Round', 'Tree_Pine', 'Tree_Cluster'];

const PATH_Y = 0.055, SEG = 14, PATH_MASK_TILE = 300;

// Duckov-style dirt mask: solid worn centre, organic ragged edge feathering to grass.
// Seeded per-leg (so each run's dirt differs) with LONG lattices over a long tile, so the
// edge wander is varied and non-repeating along the whole road (not a stamped 64u repeat).
function makePathMask(scene, seed = 1) {
  const W = 176, H = 768;
  const mul  = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const smoo = (f) => f*f*(3-2*f);
  const ss   = (e0,e1,x) => { const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t); };
  const lat1 = (n,seed) => { const r=mul(seed); const a=new Float32Array(n); for(let i=0;i<n;i++)a[i]=r(); return a; };
  const n1   = (t,L) => { const n=L.length, x=(((t%1)+1)%1)*n, i0=Math.floor(x)%n, i1=(i0+1)%n, f=smoo(x-Math.floor(x)); return L[i0]*(1-f)+L[i1]*f; };
  const lat2 = (w,h,seed) => { const r=mul(seed); const a=new Float32Array(w*h); for(let i=0;i<w*h;i++)a[i]=r(); a.w=w; a.h=h; return a; };
  const n2   = (u,v,L) => { const w=L.w,h=L.h,x=(((u%1)+1)%1)*w,y=(((v%1)+1)%1)*h, i0=Math.floor(x)%w,i1=(i0+1)%w,j0=Math.floor(y)%h,j1=(j0+1)%h,fx=smoo(x-Math.floor(x)),fy=smoo(y-Math.floor(y)); const a=L[j0*w+i0],b=L[j0*w+i1],c=L[j1*w+i0],d=L[j1*w+i1]; return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy; };
  // Long lattices (≈one value per ~5u over the 300u tile) sampled at integer freq 1 → a
  // varied, NON-repeating edge wander that still tiles seamlessly (wrapV) for long legs.
  const s = seed >>> 0;
  const warp=lat1(56, (s^0x9e3779b1)>>>0), wide=lat1(56, (s^0x85ebca77)>>>0), edge=lat2(20,40,(s^0xc2b2ae35)>>>0);
  const tex = new DynamicTexture('road-pathmask', { width:W, height:H }, scene, false);
  const ctx = tex.getContext(); const id = ctx.createImageData(W,H), d = id.data;
  for (let j=0;j<H;j++){ const v=j/H;
    const ePos = 0.5 + (n1(v*1,warp)-0.5)*0.24;
    const halfW = 0.32 + (n1(v*1,wide)-0.5)*0.15;
    for (let i=0;i<W;i++){ const u=i/W; const dist=Math.abs(u-ePos);
      const distP = dist + (n2(u*1.5,v,edge)-0.5)*0.09;
      let a = ss(halfW, halfW-0.13, distP); a=Math.max(0,Math.min(1,a));
      const o=(j*W+i)*4, c=a*255; d[o]=d[o+1]=d[o+2]=c; d[o+3]=255; }
  }
  ctx.putImageData(id,0,0); tex.update();
  tex.getAlphaFromRGB = true; tex.coordinatesIndex = 1;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE; tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

export function buildRoadLeg(scene, zone) {
  const root = new TransformNode('roadleg-root', scene);
  const obstacles = [], shadowCasters = [];
  const leg = zone.roadLeg;

  // ── materials ────────────────────────────────────────────────────────────────
  const mat = (n,r,g,b,spec=0.04) => { const m=new StandardMaterial(n,scene);
    m.diffuseColor=new Color3(r,g,b); m.specularColor=new Color3(spec,spec,spec); return m; };
  const surf = (m,name,tile,dir='world1') => { const base=`/assets/textures/${dir}/${name}`;
    const d=new Texture(base+'_diff.png',scene), n=new Texture(base+'_nrm.png',scene);
    d.uScale=d.vScale=tile; n.uScale=n.vScale=tile; m.diffuseTexture=d; m.diffuseColor=new Color3(1,1,1); m.bumpTexture=n; };
  const worldUV = (mesh,tile) => { mesh.computeWorldMatrix(true);
    const pos=mesh.getVerticesData(VertexBuffer.PositionKind), nor=mesh.getVerticesData(VertexBuffer.NormalKind); if(!pos||!nor)return;
    const wm=mesh.getWorldMatrix(), wp=new Vector3(), wn=new Vector3(), uv=new Float32Array(pos.length/3*2);
    for(let i=0;i<pos.length/3;i++){ Vector3.TransformCoordinatesFromFloatsToRef(pos[i*3],pos[i*3+1],pos[i*3+2],wm,wp);
      Vector3.TransformNormalFromFloatsToRef(nor[i*3],nor[i*3+1],nor[i*3+2],wm,wn);
      const ax=Math.abs(wn.x),ay=Math.abs(wn.y),az=Math.abs(wn.z); let u,v;
      if(ay>=ax&&ay>=az){u=wp.x;v=wp.z;} else if(ax>=az){u=wp.z;v=wp.y;} else {u=wp.x;v=wp.y;}
      uv[i*2]=u/tile; uv[i*2+1]=v/tile; }
    mesh.setVerticesData(VertexBuffer.UVKind, uv); };

  const [gr,gg,gb] = zone.palette.grass;
  const [pr,pg,pb] = zone.palette.path;
  const M = {
    grass: mat('road-grass', gr,gg,gb),
    path:  mat('road-path',  pr,pg,pb),
    trunk: mat('road-trunk', 0.34,0.24,0.13),
    foliage: mat('road-foliage', 0.26,0.52,0.20),
    wood:  mat('road-wood',  0.42,0.30,0.16),
    plaster: mat('road-plaster', 0.78,0.72,0.60),
    concrete: mat('road-concrete', 0.42,0.40,0.37),
    roof:  mat('road-roof',  0.55,0.28,0.20),
    flag:  mat('road-flag',  0.0,0.85,0.78),
  };
  surf(M.grass,'grass',16); surf(M.path,'dirt',1); surf(M.foliage,'hedge',2);
  surf(M.wood,'wood',1,'hangar');
  surf(M.plaster,'plaster',1); surf(M.concrete,'concrete',1,'hangar'); surf(M.roof,'rooftile',1);
  M.flag.emissiveColor  = new Color3(0,0.3,0.28); M.flag.specularColor = new Color3(0,0,0);
  M.stone = mat('road-stone', 0.52, 0.50, 0.46, 0.05);   // POI boulders

  // ── grass ground (covers the whole leg) ──────────────────────────────────────
  // Subdivided so we can vertex-tint it: grass near the road → darker BARREN dirt beyond
  // the playable corridor, signalling out-of-bounds (the tint lines up with the invisible
  // wall). Vertex colors multiply the grass texture, so the edge reads as dead/barren scrub.
  const size = leg.bbox.half * 2 + 220;
  const SUBD = Math.max(48, Math.min(140, Math.round(size / 8)));
  const ground = MeshBuilder.CreateGround('road-ground', { width:size, height:size, subdivisions:SUBD }, scene);
  ground.position.set(leg.bbox.center.x, -0.02, leg.bbox.center.z);
  ground.material = M.grass; ground.receiveShadows = true; ground.parent = root;
  {
    const cl = leg.centerline, CH = (zone.corridor?.half ?? 50), FADE = 30;
    const BARREN = [0.46, 0.40, 0.28];          // dead/scrub tint the grass fades toward
    const pos = ground.getVerticesData(VertexBuffer.PositionKind);
    const cols = new Float32Array((pos.length/3) * 4);
    const gx = ground.position.x, gz = ground.position.z;
    for (let vi=0; vi<pos.length/3; vi++) {
      const wx = pos[vi*3] + gx, wz = pos[vi*3+2] + gz;
      let best = Infinity;
      for (let i=0;i<cl.length-1;i++) {
        const ax=cl[i][0], az=cl[i][1], dx=cl[i+1][0]-ax, dz=cl[i+1][1]-az, L2=dx*dx+dz*dz||1;
        let s=((wx-ax)*dx+(wz-az)*dz)/L2; s = s<0?0:s>1?1:s;
        const px=ax+dx*s, pz=az+dz*s, d2=(wx-px)**2+(wz-pz)**2; if (d2<best) best=d2;
      }
      const t = Math.max(0, Math.min(1, (Math.sqrt(best) - CH) / FADE));   // 0 in-bounds → 1 OOB
      cols[vi*4]   = 1 + (BARREN[0]-1)*t;
      cols[vi*4+1] = 1 + (BARREN[1]-1)*t;
      cols[vi*4+2] = 1 + (BARREN[2]-1)*t;
      cols[vi*4+3] = 1;
    }
    ground.setVerticesData(VertexBuffer.ColorKind, cols);
  }

  // ── textured dirt road (game's buildPath: Catmull-Rom ribbon + patchy mask) ───
  M.path.opacityTexture = makePathMask(scene, leg.seed);
  M.path.transparencyMode = 2;  // ALPHABLEND
  const buildPath = (wps, w=7) => {
    if (!wps || wps.length < 2) return;
    const ctrl = wps.map(([x,z]) => new Vector3(x, PATH_Y, z));
    const center = [];
    for (let i=0;i<ctrl.length-1;i++){ const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];
      for (let s=0;s<SEG;s++) center.push(Vector3.CatmullRom(p0,p1,p2,p3,s/SEG)); }
    center.push(ctrl[ctrl.length-1]);
    const HW = w*1.5/2, L=[], R=[];
    for (let i=0;i<center.length;i++){ const a=center[Math.max(0,i-1)], b=center[Math.min(center.length-1,i+1)];
      const tx=b.x-a.x, tz=b.z-a.z, tl=Math.hypot(tx,tz)||1, px=-tz/tl, pz=tx/tl;
      L.push(new Vector3(center[i].x+px*HW, PATH_Y, center[i].z+pz*HW));
      R.push(new Vector3(center[i].x-px*HW, PATH_Y, center[i].z-pz*HW)); }
    const ribbon = MeshBuilder.CreateRibbon('road-ribbon', { pathArray:[L,R] }, scene);
    ribbon.material = M.path; ribbon.parent = root; ribbon.receiveShadows = true; ribbon.isPickable = false;
    worldUV(ribbon, 6);
    const K = center.length; let total=0; const cum=[0];
    for (let i=1;i<K;i++){ total+=Vector3.Distance(center[i-1],center[i]); cum.push(total); }
    const uv2 = new Float32Array(2*K*2);
    for (let i=0;i<K;i++){ const t=cum[i]/PATH_MASK_TILE; uv2[i*2]=0; uv2[i*2+1]=t; uv2[(K+i)*2]=1; uv2[(K+i)*2+1]=t; }
    ribbon.setVerticesData(VertexBuffer.UV2Kind, uv2);
  };
  // ONE continuous ribbon over the full centerline (southern approach + generated road) —
  // seamless join (single Catmull-Rom + single mask run).
  buildPath(leg.centerline, 8);
  for (const sp of leg.spurs) buildPath(sp.wps, 5);

  // ── all GLB props (roadside dressing trees + POI thickets/set-pieces) — native low-poly
  // models (treepatch.glb), instanced per placement. Loading is async, so they build in
  // `propsReady`, folded into ArenaScene.ready behind the loading screen. Enemies/loot are
  // already in the leg's arrays (built by ArenaScene), so combat/pickups don't wait. ──────
  const propsReady = (leg.trees?.length || leg.pois?.length)
    ? (async () => {
        // Merge both prop GLBs into one template map: trees/bush/rock + Hut/Chest.
        const tpl = { ...(await loadPropTemplates(scene, 'treepatch.glb')),
                      ...(await loadPropTemplates(scene, 'buildings.glb')) };
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        const obs = [], sc = [];

        // roadside dressing trees (line the road) — the GLB tree variants
        (leg.trees ?? []).forEach(([x, z], i) => {
          const scale = ROAD_TREE_SCALE * (0.85 + ((i * 37) % 10) / 22);
          sc.push(...instanceProp(tpl, pick(TREE_VARIANTS), { x, z, scale, rotY: (i * 1.3) % Math.PI, parent: root }));
        });

        // POI build helpers: tree/bush/rock conveniences + a generic `prop` (Hut, Chest, …).
        const helpers = {
          makeTree: (x, z, s = 1, r = 0) => instanceProp(tpl, pick(TREE_VARIANTS), { x, z, scale: s * POI_TREE_SCALE, rotY: r, parent: root }),
          makeBush: (x, z, s = 1, r = 0) => instanceProp(tpl, 'Bush',               { x, z, scale: s * POI_BUSH_SCALE, rotY: r, parent: root }),
          makeRock: (x, z, s = 1, r = 0) => instanceProp(tpl, s >= 0.9 ? 'Rock_A' : 'Rock_B', { x, z, scale: s * POI_ROCK_SCALE, rotY: r, parent: root }),
          prop:     (name, x, z, s = 1, r = 0) => instanceProp(tpl, name, { x, z, scale: s, rotY: r, parent: root }),
          pickTree: () => pick(TREE_VARIANTS),
        };
        for (const inst of (leg.pois ?? [])) {
          const type = POI_TYPES[inst.poiType];
          if (!type) continue;
          const out = type.build(scene, inst, helpers);
          if (out?.obstacles)     obs.push(...out.obstacles);
          if (out?.shadowCasters) sc.push(...out.shadowCasters.filter(Boolean));
        }
        return { obstacles: obs, shadowCasters: sc };
      })()
    : null;

  // POI loot at the spur ends is the game's collectible SalvageCrate (built by
  // ArenaScene from zone.loot), so RoadBuilder draws no loot meshes here.

  // ── checkpoint outpost (friendly stop at the leg end) ────────────────────────
  const cp = leg.checkpoint;
  const pad = MeshBuilder.CreateCylinder('road-pad',{diameter:34,height:0.2,tessellation:24},scene); pad.position.set(cp.x,0.09,cp.z); pad.material=M.concrete; pad.parent=root; worldUV(pad,6);
  const hut = MeshBuilder.CreateBox('road-hut',{width:10,height:5,depth:8},scene); hut.position.set(cp.x-7,2.5,cp.z+2); hut.material=M.plaster; hut.parent=root; worldUV(hut,3);
  const roof= MeshBuilder.CreateCylinder('road-roof',{diameterTop:0,diameterBottom:9,height:4,tessellation:4},scene); roof.position.set(cp.x-7,6.6,cp.z+2); roof.rotation.y=Math.PI/4; roof.material=M.roof; roof.parent=root;
  const pole= MeshBuilder.CreateCylinder('road-pole',{diameter:0.4,height:11},scene); pole.position.set(cp.x+8,5.5,cp.z); pole.material=M.wood; pole.parent=root;
  const flag= MeshBuilder.CreateBox('road-flag',{width:5,height:3,depth:0.2},scene); flag.position.set(cp.x+10.4,9.5,cp.z); flag.material=M.flag; flag.parent=root;
  shadowCasters.push(hut, roof);

  // (No bunker tunnel — the tank simply starts at the road's south end. A future "tank
  // drives out to the location" intro animation is the planned replacement.)

  return { obstacles, shadowCasters, root, propsReady };
}
