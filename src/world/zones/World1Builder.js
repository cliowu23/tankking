// src/world/zones/World1Builder.js
// Builds the World 1 — Green Fields environment from the zone config: sculpted
// terrain, biome dressing (paths/hedgerows/grass/trees/rocks/fences), the five
// POIs, the south tunnel + safe zone, and the Iron Keep vista. Ported from the
// user-approved world1-mockup.html — keep geometry recipes in sync with it.
//
// Returns { obstacles, root }:
//   obstacles — AABB entries ({ position:{x,z}, halfW, halfD }) for
//               ArenaScene._checkObstacleCollisions
//   root      — TransformNode parenting everything (dispose to tear down)
//
// Perf: instanced/merged sources, thin-instance grass chunked per patch (so
// frustum culling works), blob shadows instead of ShadowGenerator (real-time
// shadow maps don't render on this machine), world matrices + materials frozen.

import {
  MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh, Matrix,
  VertexBuffer, VertexData, Quaternion,
} from '@babylonjs/core';
import { makeBlobMat, addBlob } from '../../hub/HangarProps.js';

export function buildWorld1(scene, zone) {
  const root = new TransformNode('world1', scene);
  const obstacles = [];
  const PLAY = zone.bounds.half;     // 140
  const EXT  = zone.bounds.visual;   // 170

  // ── materials ──────────────────────────────────────────────────────────────
  const mat = (n, r, g, b, spec = 0.02) => {
    const m = new StandardMaterial(n, scene);
    m.diffuseColor  = new Color3(r, g, b);
    m.specularColor = new Color3(spec, spec, spec);
    return m;
  };
  const [gr, gg, gb] = zone.palette.grass;
  const [pr, pg, pb] = zone.palette.path;
  const [br2, bg2, bb2] = zone.palette.banner;
  const M = {
    grass:    mat('w1-grass', gr, gg, gb),
    path:     mat('w1-path', pr, pg, pb),
    asphalt:  mat('w1-asphalt', 0.16, 0.15, 0.14),
    hedge:    mat('w1-hedge', 0.18, 0.40, 0.15),
    foliage:  mat('w1-foliage', 0.26, 0.52, 0.20),
    foliage2: mat('w1-foliage2', 0.32, 0.58, 0.24),
    trunk:    mat('w1-trunk', 0.34, 0.24, 0.13),
    tgrass:   mat('w1-tgrass', 0.55, 0.72, 0.30),
    tgrassA:  mat('w1-tgrassA', 0.64, 0.70, 0.26),
    stone:    mat('w1-stone', 0.62, 0.58, 0.52),
    stoneD:   mat('w1-stoneD', 0.48, 0.45, 0.40),
    cream:    mat('w1-cream', 0.78, 0.72, 0.60),
    roof:     mat('w1-roof', 0.55, 0.28, 0.20),
    roofS:    mat('w1-roofS', 0.35, 0.33, 0.36),
    wood:     mat('w1-wood', 0.42, 0.30, 0.16),
    burnt:    mat('w1-burnt', 0.16, 0.13, 0.11),
    crate:    mat('w1-crate', 0.30, 0.24, 0.12),
    concrete: mat('w1-concrete', 0.42, 0.40, 0.37),
    sand:     mat('w1-sand', 0.60, 0.54, 0.40),
    gunmetal: mat('w1-gunmetal', 0.28, 0.26, 0.24),
    dark:     mat('w1-dark', 0.05, 0.05, 0.06),
    banner:   (() => {
      const m = mat('w1-banner', br2, bg2, bb2, 0.04);
      m.emissiveColor = new Color3(0.18, 0, 0);
      return m;
    })(),
  };
  // Grass cards must read sunlit from both faces (one-sided lit cards go black).
  for (const m of [M.tgrass, M.tgrassA]) {
    m.twoSidedLighting = true;
    m.backFaceCulling  = false;
    m.emissiveColor    = new Color3(0.16, 0.20, 0.07);
  }
  const blobMat = makeBlobMat(scene);

  // ── helpers ────────────────────────────────────────────────────────────────
  const box = (p, n, w, h, d, x, y, z, m, ry = 0, rx = 0, rz = 0) => {
    const b = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z); b.rotation.set(rx, ry, rz);
    b.material = m; b.isPickable = false; b.parent = p ?? root;
    return b;
  };
  const cyl = (p, n, dia, h, x, y, z, m, t = 12, o = {}) => {
    const c = MeshBuilder.CreateCylinder(n, { diameter: dia, height: h, tessellation: t, ...o }, scene);
    c.position.set(x, y, z); c.material = m; c.isPickable = false; c.parent = p ?? root;
    return c;
  };
  const sph = (p, n, d, x, y, z, m, sx = 1, sy = 1, sz = 1) => {
    const s = MeshBuilder.CreateSphere(n, { diameter: d, segments: 7 }, scene);
    s.position.set(x, y, z); s.scaling.set(sx, sy, sz);
    s.material = m; s.isPickable = false; s.parent = p ?? root;
    return s;
  };
  // Chain of square AABBs along a rotated strip — accurate obstacle footprint
  // for any angle without rotated-box collision math.
  const chainObstacles = (x, z, len, ry, half) => {
    const n = Math.max(1, Math.ceil(len / (half * 1.6)));
    const dirX = Math.sin(ry), dirZ = Math.cos(ry);
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + (k + 0.5) * (len / n);
      obstacles.push({ position: { x: x + dirX * t, z: z + dirZ * t }, halfW: half, halfD: half });
    }
  };

  // ── terrain: flat playable interior, sculpted border ───────────────────────
  // (heightAt mirrors the mockup exactly — the gameplay plane stays y=0.)
  const heightAt = (x, z) => {
    const ax = Math.abs(x), az = Math.abs(z);
    const d = Math.max(ax, az);
    let h = 0;
    if (d > PLAY) {                       // rolling-hill skirt ring
      const t = Math.min(1, (d - PLAY) / (EXT - PLAY)), s = t * t * (3 - 2 * t);
      h = s * (7 + 2.5 * (Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.02 + z * 0.031)));
    }
    if (z < -PLAY) {                      // south berm (tunnel notch carved at |x|<5)
      const t = Math.min(1, (-z - PLAY) / (EXT - PLAY)), s = t * t * (3 - 2 * t);
      const carve = Math.min(1, Math.max(0, (ax - 5) / 9));
      h = Math.max(h, s * 13 * carve);
    }
    if (z > PLAY) {                       // north hill under the Iron Keep
      const t = Math.min(1, (z - PLAY) / (EXT - PLAY)), s = t * t * (3 - 2 * t);
      const g = Math.exp(-(x * x) / (2 * 55 * 55));
      h = Math.max(h, s * (10 + 16 * g));
    }
    return Math.max(0, h);
  };
  const ground = MeshBuilder.CreateGround('ground', {
    width: EXT * 2, height: EXT * 2, subdivisions: 120, updatable: true,
  }, scene);
  {
    const pos = ground.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(pos[i], pos[i + 2]);
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    const norm = ground.getVerticesData(VertexBuffer.NormalKind);
    VertexData.ComputeNormals(pos, ground.getIndices(), norm);
    ground.updateVerticesData(VertexBuffer.NormalKind, norm);
  }
  ground.material = M.grass;
  ground.receiveShadows = true;
  ground.parent = root;

  // ── dirt paths (flat hard-edged strips) ────────────────────────────────────
  const buildPath = (wps, w = 5) => {
    for (let i = 0; i < wps.length - 1; i++) {
      const [x1, z1] = wps[i], [x2, z2] = wps[i + 1];
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      box(root, 'w1-path', w, 0.08, len + w * 0.8, (x1 + x2) / 2, 0.05, (z1 + z2) / 2, M.path, Math.atan2(dx, dz));
    }
  };
  buildPath(zone.paths.main);
  buildPath(zone.paths.storeSpur, 4);

  // ── hedgerows (cover + obstacles) ──────────────────────────────────────────
  for (const h of zone.hedgerows) {
    const g = new TransformNode('w1-hedge', scene);
    g.parent = root; g.position.set(h.x, 0, h.z); g.rotation.y = h.ry;
    box(g, 'trunk', 2.2, 1.7, h.len, 0, 0.85, 0, M.hedge);
    const n = Math.max(3, Math.round(h.len / 5));
    for (let k = 0; k < n; k++) {
      const zz = -h.len / 2 + (k + 0.5) * (h.len / n);
      sph(g, 'puff', 4.4, (k % 2 ? 0.5 : -0.4), 1.9, zz, (k % 2 ? M.foliage : M.foliage2), 1, 0.72, 1.15);
    }
    chainObstacles(h.x, h.z, h.len, h.ry, 1.5);
  }

  // ── stone walls ────────────────────────────────────────────────────────────
  for (const w of zone.walls) {
    box(root, 'w1-wall', 1.0, 0.95, w.len, w.x, 0.47, w.z, M.stoneD, w.ry);
    chainObstacles(w.x, w.z, w.len, w.ry, 0.8);
  }

  // ── tall grass (thin instances, one clone per patch so culling works) ──────
  const makeGrassSource = (m, name) => {
    const p1 = MeshBuilder.CreatePlane(name + '-a', { width: 1.5, height: 1.3, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const p2 = p1.clone(name + '-b'); p2.rotation.y = Math.PI / 2;
    const s = Mesh.MergeMeshes([p1, p2], true);
    s.material = m; s.isPickable = false; s.setEnabled(false);
    return s;
  };
  const grassSrc  = makeGrassSource(M.tgrass, 'w1-tg');
  const grassSrcA = makeGrassSource(M.tgrassA, 'w1-tga');
  for (const gPatch of zone.grassPatches) {
    const src = gPatch.amb ? grassSrcA : grassSrc;
    const patch = src.clone('w1-grasspatch');
    // Thin-instance world matrices live on the GEOMETRY's vertex buffers, and
    // clones share geometry — patches with different counts would fight over
    // one buffer (GL_INVALID_OPERATION: vertex buffer not big enough).
    patch.makeGeometryUnique();
    patch.setEnabled(true); patch.isPickable = false; patch.parent = root;
    patch.position.set(gPatch.x, 0.62, gPatch.z);
    const n = Math.round(gPatch.r * gPatch.r * 0.45);
    const mats = [];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * gPatch.r;
      const sc = 0.8 + Math.random() * 0.6;
      mats.push(Matrix.Compose(
        new Vector3(sc, sc, sc),
        Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI),
        new Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr),
      ));
    }
    patch.thinInstanceAdd(mats);
    patch.thinInstanceRefreshBoundingInfo(true);
  }

  // ── trees + rocks + fences ─────────────────────────────────────────────────
  const trunkSrc = cyl(root, 'w1-trunkSrc', 0.7, 2.6, 0, 1.3, 0, M.trunk, 7);
  trunkSrc.setEnabled(false);
  const blobSrc = (() => {
    const a = sph(root, 'b1', 3.6, 0, 3.4, 0, M.foliage);
    const b = sph(root, 'b2', 2.8, 0.9, 4.3, 0.4, M.foliage);
    const c = sph(root, 'b3', 2.6, -0.9, 4.1, -0.3, M.foliage);
    const s = Mesh.MergeMeshes([a, b, c], true);
    s.material = M.foliage; s.isPickable = false; s.parent = root; s.setEnabled(false);
    return s;
  })();
  zone.trees.forEach(([x, z], i) => {
    const y = heightAt(x, z), sc = 0.85 + ((i * 37) % 10) / 18;
    const t = trunkSrc.createInstance('w1-tt' + i); t.position.set(x, y, z); t.scaling.setAll(sc); t.parent = root;
    const b = blobSrc.createInstance('w1-tb' + i); b.position.set(x, y, z); b.scaling.setAll(sc);
    b.rotation.y = (i * 1.3) % Math.PI; b.parent = root;
    if (y === 0) {                                   // playable-field trees ground + block
      addBlob(scene, blobMat, x, z, 2.6 * sc, 2.6 * sc, { parent: root });
      obstacles.push({ position: { x, z }, halfW: 0.6 * sc, halfD: 0.6 * sc });
    }
  });
  const rockSrc = sph(root, 'w1-rockSrc', 2.4, 0, 0.6, 0, M.stone, 1.3, 0.7, 1.0);
  rockSrc.setEnabled(false);
  zone.rocks.forEach(([x, z], i) => {
    const r = rockSrc.createInstance('w1-rk' + i);
    r.position.set(x, 0.5, z); r.rotation.y = i * 0.9;
    const sc = 0.7 + (i % 4) * 0.35; r.scaling.scaleInPlace(sc); r.parent = root;
    addBlob(scene, blobMat, x, z, 1.8 * sc, 1.5 * sc, { parent: root });
    obstacles.push({ position: { x, z }, halfW: 1.0 * sc, halfD: 1.0 * sc });
  });
  const fence = (x, z, len, ry) => {
    const g = new TransformNode('w1-fence', scene);
    g.parent = root; g.position.set(x, 0, z); g.rotation.y = ry;
    const n = Math.round(len / 2.2);
    for (let k = 0; k <= n; k++) box(g, 'post', 0.16, 1.0, 0.16, 0, 0.5, -len / 2 + k * (len / n), M.wood);
    box(g, 'rail1', 0.1, 0.12, len, 0, 0.78, 0, M.wood);
    box(g, 'rail2', 0.1, 0.12, len, 0, 0.42, 0, M.wood);
  };
  for (const f of zone.fences) fence(f.x, f.z, f.len, f.ry);

  // ── SOUTH TUNNEL + SAFE ZONE (the bunker exit) ─────────────────────────────
  {
    const tun = new TransformNode('w1-tunnel', scene); tun.parent = root;
    // bore: inside-out cylinder along Z (hangar recipe), mouth at z=-138
    const bore = MeshBuilder.CreateCylinder('w1-bore', {
      diameter: 7, height: 16, tessellation: 24,
      sideOrientation: Mesh.BACKSIDE, cap: Mesh.CAP_END,
    }, scene);
    bore.rotation.x = Math.PI / 2; bore.position.set(0, 1.5, -146);
    bore.material = M.dark; bore.isPickable = false; bore.parent = tun;
    box(tun, 'plug', 6.8, 7, 0.3, 0, 2, -152.5, M.dark);
    for (const z of [-138.6, -142, -145.5, -149]) {
      const rib = MeshBuilder.CreateTorus('w1-rib', { diameter: 6.6, thickness: 0.45, tessellation: 20 }, scene);
      rib.rotation.x = Math.PI / 2; rib.position.set(0, 1.5, z);
      rib.material = M.concrete; rib.isPickable = false; rib.parent = tun;
    }
    // concrete portal headwall + grassy mounds burying the bore
    box(tun, 'head-top', 15, 3.2, 1.2, 0, 6.2, -138.6, M.concrete);
    box(tun, 'head-l', 4.2, 7.8, 1.2, -5.6, 3.9, -138.6, M.concrete);
    box(tun, 'head-r', 4.2, 7.8, 1.2, 5.6, 3.9, -138.6, M.concrete);
    sph(tun, 'mound1', 30, 0, -2.5, -152, M.grass, 1.15, 0.42, 0.9);
    sph(tun, 'mound2', 22, -12, -2, -148, M.grass, 1, 0.45, 0.9);
    sph(tun, 'mound3', 22, 12, -2, -148, M.grass, 1, 0.45, 0.9);
    // asphalt apron out of the mouth, blending into the dirt path
    box(tun, 'apron', 6, 0.1, 26, 0, 0.06, -139, M.asphalt);

    // sandbag arcs flanking the spawn (gap at the path)
    const bagSrc = box(root, 'w1-bagSrc', 1.5, 0.55, 0.8, 0, 0, 0, M.sand);
    bagSrc.setEnabled(false);
    const bagArc = (cx, cz, r, a0, a1, n) => {
      for (let k = 0; k < n; k++) {
        const a = a0 + (a1 - a0) * (k / (n - 1));
        const bx = cx + Math.cos(a) * r, bz = cz + Math.sin(a) * r;
        const b = bagSrc.createInstance('w1-bag');
        b.position.set(bx, 0.28, bz); b.rotation.y = -a; b.parent = root;
        const b2 = bagSrc.createInstance('w1-bag2');
        b2.position.set(cx + Math.cos(a + 0.06) * r, 0.78, cz + Math.sin(a + 0.06) * r);
        b2.rotation.y = -a - 0.06; b2.parent = root;
        obstacles.push({ position: { x: bx, z: bz }, halfW: 0.9, halfD: 0.9 });
      }
    };
    bagArc(0, -128, 13, 0.45, 1.25, 6);    // east arc (opens north at the path)
    bagArc(0, -128, 13, 1.92, 2.70, 6);    // west arc

    // dragon-teeth rows at the safe-zone edge (gap at the path)
    const toothSrc = cyl(root, 'w1-toothSrc', 1.6, 1.5, 0, 0.75, 0, M.concrete, 4, { diameterTop: 0.25 });
    toothSrc.setEnabled(false);
    for (const xs of [[-34, -10], [10, 34]]) {
      for (let x = xs[0]; x <= xs[1]; x += 6) {
        const t = toothSrc.createInstance('w1-tooth');
        t.position.set(x, 0.75, -116); t.rotation.y = 0.5; t.parent = root;
        obstacles.push({ position: { x, z: -116 }, halfW: 0.9, halfD: 0.9 });
      }
    }
  }

  // ── POI: Clint's ruined store (NEAR band) ──────────────────────────────────
  {
    const p = zone.pois.clintStore;
    const store = new TransformNode('w1-store', scene);
    store.parent = root; store.position.set(p.x, 0, p.z); store.rotation.y = p.ry;
    box(store, 'slab', 8, 0.25, 7, 0, 0.12, 0, M.stoneD);
    box(store, 'wall-s', 8, 2.6, 0.4, 0, 1.3, -3.3, M.cream);
    box(store, 'wall-w', 0.4, 2.6, 4.5, -3.8, 1.3, -1.0, M.cream);
    box(store, 'wall-e', 0.4, 1.2, 3.0, 3.8, 0.6, -1.6, M.cream);
    box(store, 'roof-fall', 7.6, 0.18, 5.2, 0.3, 1.55, 0.6, M.burnt, 0, 0.62);
    box(store, 'crate1', 1.3, 1.3, 1.3, 2.6, 0.65, 2.2, M.crate, 0.4);
    box(store, 'crate2', 1.0, 1.0, 1.0, 1.4, 0.5, 3.0, M.crate, 0.1);
    box(store, 'sign-post', 0.18, 2.6, 0.18, -4.6, 1.3, 2.8, M.wood, 0, 0, 0.12);
    box(store, 'sign', 2.2, 0.9, 0.12, -4.6, 2.35, 2.8, M.wood, 0.15, 0, 0.1);
    const scorch = MeshBuilder.CreateDisc('w1-scorch', { radius: 5.5, tessellation: 24 }, scene);
    scorch.rotation.x = Math.PI / 2; scorch.position.set(p.x + 1, 0.04, p.z + 1);
    scorch.material = M.burnt; scorch.isPickable = false; scorch.parent = root;
    obstacles.push({ position: { x: p.x, z: p.z }, halfW: 4.2, halfD: 3.8 });
  }

  // ── POI: crashed outsider machine (MID west) ───────────────────────────────
  {
    const p = zone.pois.wreck;
    const wreck = new TransformNode('w1-wreck', scene);
    wreck.parent = root; wreck.position.set(p.x, 0, p.z); wreck.rotation.y = p.ry;
    box(wreck, 'hull', 3.2, 1.4, 5.2, 0, 0.4, 0, M.gunmetal, 0, 0.06, 0.18);
    box(wreck, 'tur', 2.0, 0.9, 2.4, 0.4, 1.25, -0.6, M.gunmetal, 0.5, 0, 0.1);
    const gun = cyl(wreck, 'gun', 0.3, 3.4, 1.6, 1.2, 1.6, M.gunmetal, 8);
    gun.rotation.set(Math.PI / 2 + 0.35, 0.6, 0);
    box(wreck, 'plate', 1.8, 0.15, 2.2, -2.4, 0.1, 1.8, M.gunmetal, 0.9);
    const ws = MeshBuilder.CreateDisc('w1-wscorch', { radius: 5, tessellation: 24 }, scene);
    ws.rotation.x = Math.PI / 2; ws.position.set(p.x, 0.04, p.z);
    ws.material = M.burnt; ws.isPickable = false; ws.parent = root;
    obstacles.push({ position: { x: p.x, z: p.z }, halfW: 2.8, halfD: 3.0 });
  }

  // ── POI: farmstead (MID east) ──────────────────────────────────────────────
  {
    const p = zone.pois.farmstead;
    const farm = new TransformNode('w1-farm', scene);
    farm.parent = root; farm.position.set(p.x, 0, p.z); farm.rotation.y = p.ry;
    box(farm, 'barn', 8, 4.2, 6.5, 0, 2.1, 0, M.roof);
    box(farm, 'roof-l', 5.4, 0.22, 7.3, -1.9, 4.9, 0, M.burnt, 0, 0, 0.55);
    box(farm, 'roof-r', 5.4, 0.22, 7.3, 1.9, 4.9, 0, M.burnt, 0, 0, -0.55);
    box(farm, 'door', 2.6, 2.6, 0.12, 0, 1.3, 3.3, M.wood);
    for (const [hx, hy, hz] of [[-5.5, 0.8, 2.0], [-5.0, 0.8, -1.2], [-6.4, 2.0, 0.4]]) {
      const hay = cyl(farm, 'hay', 2.2, 1.6, hx, hy, hz, M.tgrass, 14);
      hay.rotation.z = Math.PI / 2;
    }
    addBlob(scene, blobMat, p.x, p.z, 6, 5, { parent: root });
    obstacles.push({ position: { x: p.x, z: p.z }, halfW: 4.4, halfD: 3.8 });
    obstacles.push({ position: { x: p.x - 5.6, z: p.z + 0.4 }, halfW: 1.8, halfD: 2.4 }); // hay
  }

  // ── POI: ruined watchtower (DEEP west, guarded) ────────────────────────────
  {
    const p = zone.pois.watchtower;
    const tower = new TransformNode('w1-tower', scene);
    tower.parent = root; tower.position.set(p.x, 0, p.z);
    cyl(tower, 'shaft', 6, 9, 0, 4.5, 0, M.stone, 8);
    const merlons = [[0, 2.6, 1.8], [0.8, -2.5, 1.1], [1.6, 2.2, -1.6, 0.9], [2.4, -2.4, -1.4, 1.4], [3.1, 0.2, 2.7, 0.7]];
    for (const [a, x, z, h = 1.2] of merlons) box(tower, 'merlon', 1.5, h, 1.1, x, 9 + h / 2, z, M.stoneD, a);
    const rubble = [[3.2, 1.1, 2.0], [-2.6, 0.5, 3.4], [1.8, 0.4, -3.6], [-3.8, 0.7, -1.5]];
    rubble.forEach(([x, h, z], i) => {
      box(tower, 'rubble', 1.6, h, 1.4, x, h / 2, z, M.stoneD, i * 0.8);
      obstacles.push({ position: { x: p.x + x, z: p.z + z }, halfW: 1.0, halfD: 1.0 });
    });
    box(tower, 'arch', 2.0, 3.0, 0.8, 0, 1.5, -3.0, M.burnt);
    addBlob(scene, blobMat, p.x, p.z, 4.5, 4.5, { parent: root });
    obstacles.push({ position: { x: p.x, z: p.z }, halfW: 3.2, halfD: 3.2 });
  }

  // ── POI: Tankford checkpoint (DEEP east, guarded) ──────────────────────────
  {
    const p = zone.pois.checkpoint;
    const ckpt = new TransformNode('w1-ckpt', scene);
    ckpt.parent = root; ckpt.position.set(p.x, 0, p.z); ckpt.rotation.y = p.ry;
    box(ckpt, 'hut', 3.4, 2.6, 2.8, 0, 1.3, 0, M.cream);
    box(ckpt, 'hut-roof', 4.0, 0.18, 3.4, 0, 2.75, 0, M.roofS, 0, 0, 0.06);
    cyl(ckpt, 'barrier-post', 0.3, 1.2, -2.2, 0.6, 2.2, M.stoneD, 8);
    box(ckpt, 'barrier', 5.5, 0.18, 0.18, 0.5, 1.15, 2.2, M.banner, 0, 0, 0.08);
    box(ckpt, 'bpole', 0.22, 5.5, 0.22, 2.4, 2.75, -1.8, M.wood);
    box(ckpt, 'bflag', 2.0, 3.2, 0.08, 3.5, 4.0, -1.8, M.banner, 0, 0.2);
    addBlob(scene, blobMat, p.x, p.z, 3, 2.6, { parent: root });
    obstacles.push({ position: { x: p.x, z: p.z }, halfW: 2.0, halfD: 1.8 });
    // two dragon teeth on the road approaches
    for (const [tx, tz] of [[p.x - 4, p.z - 5], [p.x + 4, p.z + 6]]) {
      const t = scene.getMeshByName('w1-toothSrc').createInstance('w1-ctooth');
      t.position.set(tx, 0.75, tz); t.parent = root;
      obstacles.push({ position: { x: tx, z: tz }, halfW: 0.9, halfD: 0.9 });
    }
  }

  // ── VILLAGE (DEEP band) ────────────────────────────────────────────────────
  {
    const cottage = (x, z, ry, w = 6, d = 5) => {
      const g = new TransformNode('w1-cot', scene);
      g.parent = root; g.position.set(x, 0, z); g.rotation.y = ry;
      box(g, 'body', w, 2.8, d, 0, 1.4, 0, M.cream);
      box(g, 'roof-l', w * 0.66, 0.2, d + 0.7, -w * 0.23, 3.35, 0, M.roof, 0, 0, 0.62);
      box(g, 'roof-r', w * 0.66, 0.2, d + 0.7, w * 0.23, 3.35, 0, M.roof, 0, 0, -0.62);
      box(g, 'door', 1.0, 1.7, 0.1, 0, 0.85, d / 2 + 0.03, M.burnt);
      box(g, 'chimney', 0.7, 1.6, 0.7, w * 0.3, 3.6, -d * 0.2, M.stoneD);
      addBlob(scene, blobMat, x, z, w * 0.7, d * 0.7, { parent: root });
      obstacles.push({ position: { x, z }, halfW: w / 2 + 0.3, halfD: d / 2 + 0.3 });
    };
    cottage(24, 86, 0.15);
    cottage(37, 95, -1.35, 7, 5);
    cottage(22, 99, 1.62, 5, 4.5);
    // village well
    cyl(root, 'w1-well-ring', 2.2, 1.0, 30, 0.5, 90, M.stoneD, 12);
    box(root, 'w1-well-p1', 0.15, 1.6, 0.15, 29.3, 1.6, 90, M.wood);
    box(root, 'w1-well-p2', 0.15, 1.6, 0.15, 30.7, 1.6, 90, M.wood);
    box(root, 'w1-well-roof', 2.0, 0.12, 1.6, 30, 2.5, 90, M.roof, 0, 0, 0.3);
    obstacles.push({ position: { x: 30, z: 90 }, halfW: 1.3, halfD: 1.3 });
  }

  // ── IRON KEEP vista (on the unreachable north hill) ────────────────────────
  {
    const p = zone.pois.ironKeep;
    const keepY = heightAt(p.x, p.z);
    const keep = new TransformNode('w1-keep', scene);
    keep.parent = root; keep.position.set(p.x, keepY - 0.4, p.z);
    box(keep, 'wall-s', 40, 8, 2.5, 0, 4, -15, M.stone);
    box(keep, 'wall-n', 40, 8, 2.5, 0, 4, 15, M.stone);
    box(keep, 'wall-w', 2.5, 8, 28, -20, 4, 0, M.stone);
    box(keep, 'wall-e', 2.5, 8, 28, 20, 4, 0, M.stone);
    for (const [x, z] of [[-20, -15], [20, -15], [-20, 15], [20, 15]]) {
      cyl(keep, 'twr', 8, 15, x, 7.5, z, M.stone, 8);
      cyl(keep, 'twr-roof', 9.5, 5, x, 17.5, z, M.roofS, 8, { diameterTop: 0 });
      box(keep, 'bpole', 0.2, 6, 0.2, x, 21, z, M.wood);
      box(keep, 'ban', 2.2, 4, 0.08, x + 1.2, 20, z, M.banner, 0, 0.18);
    }
    box(keep, 'donjon', 16, 14, 12, 0, 7, 2, M.stone);
    box(keep, 'donjon-cap', 17.5, 1.2, 13.5, 0, 14.6, 2, M.stoneD);
    cyl(keep, 'donjon-twr', 7, 22, 0, 11, 2, M.stone, 8);
    cyl(keep, 'donjon-roof', 8.5, 6, 0, 25, 2, M.roofS, 8, { diameterTop: 0 });
    box(keep, 'kpole', 0.25, 8, 0.25, 0, 31, 2, M.wood);
    box(keep, 'kban', 3.2, 5.5, 0.1, 1.7, 29.5, 2, M.banner, 0, 0.18);
    // gatehouse facing south (toward the player)
    cyl(keep, 'gh-l', 5, 11, -5, 5.5, -15.5, M.stone, 8);
    cyl(keep, 'gh-r', 5, 11, 5, 5.5, -15.5, M.stone, 8);
    cyl(keep, 'gh-lr', 6, 3.5, -5, 12.7, -15.5, M.roofS, 8, { diameterTop: 0 });
    cyl(keep, 'gh-rr', 6, 3.5, 5, 12.7, -15.5, M.roofS, 8, { diameterTop: 0 });
    box(keep, 'gh-arch', 6, 7, 2.6, 0, 3.5, -15.2, M.stoneD);
    box(keep, 'gh-gate', 4, 4.5, 0.4, 0, 2.2, -16.4, M.burnt);
    box(keep, 'gh-banl', 2.6, 5, 0.08, -7.8, 8, -16.8, M.banner, 0, 0.25);
    box(keep, 'gh-banr', 2.6, 5, 0.08, 7.8, 8, -16.8, M.banner, 0, -0.25);
  }

  // ── freeze pass: statics never move ────────────────────────────────────────
  for (const m of root.getChildMeshes()) {
    m.freezeWorldMatrix();
    m.isPickable = false;
  }
  for (const m of Object.values(M)) m.freeze();
  blobMat.freeze();

  return { obstacles, root };
}
