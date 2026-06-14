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

const PATH_Y = 0.055, SEG = 14, PATH_MASK_TILE = 64;

// Duckov-style dirt mask: solid worn centre, organic ragged edge feathering to grass.
function makePathMask(scene) {
  const W = 176, H = 768;
  const mul  = (a) => () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const smoo = (f) => f*f*(3-2*f);
  const ss   = (e0,e1,x) => { const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t); };
  const lat1 = (n,seed) => { const r=mul(seed); const a=new Float32Array(n); for(let i=0;i<n;i++)a[i]=r(); return a; };
  const n1   = (t,L) => { const n=L.length, x=(((t%1)+1)%1)*n, i0=Math.floor(x)%n, i1=(i0+1)%n, f=smoo(x-Math.floor(x)); return L[i0]*(1-f)+L[i1]*f; };
  const lat2 = (w,h,seed) => { const r=mul(seed); const a=new Float32Array(w*h); for(let i=0;i<w*h;i++)a[i]=r(); a.w=w; a.h=h; return a; };
  const n2   = (u,v,L) => { const w=L.w,h=L.h,x=(((u%1)+1)%1)*w,y=(((v%1)+1)%1)*h, i0=Math.floor(x)%w,i1=(i0+1)%w,j0=Math.floor(y)%h,j1=(j0+1)%h,fx=smoo(x-Math.floor(x)),fy=smoo(y-Math.floor(y)); const a=L[j0*w+i0],b=L[j0*w+i1],c=L[j1*w+i0],d=L[j1*w+i1]; return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy; };
  const warp=lat1(20,7), wide=lat1(20,19), edge=lat2(14,24,53);
  const tex = new DynamicTexture('road-pathmask', { width:W, height:H }, scene, false);
  const ctx = tex.getContext(); const id = ctx.createImageData(W,H), d = id.data;
  // v-frequencies MUST be integers so the mask tiles seamlessly along the road length
  // (wrapV). Non-integer freqs made the pattern hard-jump every tile = the seam stutter.
  for (let j=0;j<H;j++){ const v=j/H;
    const ePos = 0.5 + (n1(v*1,warp)-0.5)*0.20;
    const halfW = 0.32 + (n1(v*1,wide)-0.5)*0.14;
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
    dark:  mat('road-dark',  0.05,0.05,0.06),   // tunnel bore interior
  };
  surf(M.grass,'grass',16); surf(M.path,'dirt',1); surf(M.foliage,'hedge',2);
  surf(M.wood,'wood',1,'hangar');
  surf(M.plaster,'plaster',1); surf(M.concrete,'concrete',1,'hangar'); surf(M.roof,'rooftile',1);
  M.flag.emissiveColor  = new Color3(0,0.3,0.28); M.flag.specularColor = new Color3(0,0,0);

  // ── grass ground (covers the whole leg) ──────────────────────────────────────
  const size = leg.bbox.half * 2 + 200;
  const ground = MeshBuilder.CreateGround('road-ground', { width:size, height:size }, scene);
  ground.position.set(leg.bbox.center.x, -0.02, leg.bbox.center.z);
  ground.material = M.grass; ground.receiveShadows = true; ground.parent = root;

  // ── textured dirt road (game's buildPath: Catmull-Rom ribbon + patchy mask) ───
  M.path.opacityTexture = makePathMask(scene);
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
  buildPath(leg.roadMain, 8);                     // one continuous seamless ribbon
  for (const sp of leg.spurs) buildPath(sp.wps, 5);

  // ── trees (instanced trunk + foliage blob) ───────────────────────────────────
  const trunkSrc = MeshBuilder.CreateCylinder('road-trunkSrc', { diameter:0.7, height:2.6, tessellation:7 }, scene);
  trunkSrc.position.y=1.3; trunkSrc.material=M.trunk; trunkSrc.parent=root; trunkSrc.setEnabled(false);
  const blobSrc = (() => {
    const a=MeshBuilder.CreateSphere('rb1',{diameter:3.6,segments:7},scene); a.position.set(0,3.4,0);
    const b=MeshBuilder.CreateSphere('rb2',{diameter:2.8,segments:7},scene); b.position.set(0.9,4.3,0.4);
    const c=MeshBuilder.CreateSphere('rb3',{diameter:2.6,segments:7},scene); c.position.set(-0.9,4.1,-0.3);
    const s=Mesh.MergeMeshes([a,b,c],true); s.material=M.foliage; s.isPickable=false; s.parent=root; s.setEnabled(false); return s;
  })();
  leg.trees.forEach(([x,z],i) => {
    const sc = 0.85 + ((i*37)%10)/18;
    const t = trunkSrc.createInstance('road-tt'+i); t.position.set(x,0,z); t.scaling.setAll(sc); t.parent=root;
    const b = blobSrc.createInstance('road-tb'+i); b.position.set(x,0,z); b.scaling.setAll(sc); b.rotation.y=(i*1.3)%Math.PI; b.parent=root;
    shadowCasters.push(t,b);
  });

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

  // ── SOUTH MOUNTAIN WALL + flush bunker tunnel ────────────────────────────────
  // The map's south edge is a big sloped grass mountain; the bunker is a tunnel bored
  // flush into it, with mountain mass overhanging the mouth (the visible ceiling). The
  // tank rolls OUT onto the road. Leg always starts at the origin heading +Z.
  {
    const tun = new TransformNode('road-bunker', scene); tun.parent = root;
    const MZ = -6;            // portal face / berm face (tunnel mouth plane)
    const mound = (d,x,y,z,sx,sy,sz) => { const s=MeshBuilder.CreateSphere('road-mtn',{diameter:d,segments:8},scene);
      s.position.set(x,y,z); s.scaling.set(sx,sy,sz); s.material=M.grass; s.parent=tun; s.receiveShadows=true; return s; };

    // dark bore behind the portal (interior visible through the mouth)
    const bore = MeshBuilder.CreateCylinder('road-bore', { diameter:9, height:18, tessellation:24, sideOrientation:Mesh.BACKSIDE, cap:Mesh.CAP_END }, scene);
    bore.rotation.x = Math.PI/2; bore.position.set(0, 2.3, MZ-9); bore.material=M.dark; bore.isPickable=false; bore.parent=tun;
    const plug = MeshBuilder.CreateBox('road-plug', { width:9, height:9, depth:0.3 }, scene); plug.position.set(0,2.7,MZ-18); plug.material=M.dark; plug.parent=tun;
    for (const z of [MZ-2, MZ-5, MZ-9, MZ-13]) { const rib=MeshBuilder.CreateTorus('road-rib',{diameter:8.4,thickness:0.5,tessellation:20},scene); rib.rotation.x=Math.PI/2; rib.position.set(0,2.3,z); rib.material=M.concrete; rib.parent=tun; }

    // CONCRETE PORTAL FRAME, flush in the berm — the hero element that reads as a tunnel
    // entrance even from above: two jambs + a forward-tilted lintel (its underside = the
    // visible ceiling), around the dark bore.
    const jambL = MeshBuilder.CreateBox('road-jambL', { width:3, height:9, depth:3.2 }, scene); jambL.position.set(-5.8,4.5,MZ); jambL.material=M.concrete; jambL.parent=tun; worldUV(jambL,3);
    const jambR = MeshBuilder.CreateBox('road-jambR', { width:3, height:9, depth:3.2 }, scene); jambR.position.set( 5.8,4.5,MZ); jambR.material=M.concrete; jambR.parent=tun; worldUV(jambR,3);
    const lintel = MeshBuilder.CreateBox('road-lintel', { width:15, height:3, depth:4.5 }, scene); lintel.position.set(0,9.2,MZ-0.5); lintel.rotation.x=-0.35; lintel.material=M.concrete; lintel.parent=tun; worldUV(lintel,3);

    // LOW grass berm nestling the portal into the south — seen from above as a hill band.
    // Low + thin so it never buries the (z≈−19) camera; narrow + far enough out to clear
    // the portal/road centre.
    for (let x=-100; x<=100; x+=20) {
      if (Math.abs(x) < 24) continue;
      const sy = 0.5 + (Math.abs(x)/100) * 0.35;
      mound(44, x, -3, MZ-2, 0.8, sy, 0.5);
    }
    mound(20, 0, 8, MZ-3, 1.7, 0.5, 0.6);   // low grass cap burying the lintel top into the berm

    // dirt apron blending the mouth into the road start (road already begins at z=0)
    buildPath([[0,MZ+2],[0,2],[0,12]], 8);
    shadowCasters.push(jambL, jambR, lintel);
    // block driving south through the berm + portal jambs (gap at the mouth)
    for (let x=-100; x<=100; x+=16) { if (Math.abs(x) < 16) continue; obstacles.push({ position:{x,z:MZ-2}, halfW:8, halfD:7 }); }
    obstacles.push({ position:{x:-5.2,z:MZ}, halfW:1.5, halfD:1.6 }, { position:{x:5.2,z:MZ}, halfW:1.5, halfD:1.6 });
  }

  return { obstacles, shadowCasters, root };
}
