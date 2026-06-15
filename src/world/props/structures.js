// src/world/props/structures.js
// Shared, parameterized procedural prop builders for the POI library. Pure Babylon —
// each builder takes the scene + a material and returns a mesh, so any POI type module
// (or zone builder) can drop a bush/rock/box/cylinder without duplicating geometry code.
//
// Track B (art pass) will progressively replace these procedural pieces with recolored
// GLBs loaded via ./loadProp.js, but the procedural versions keep the pipeline working
// and stay as the cheap/fallback option. Structures (shack/wreck/barn) get extracted out
// of World1Builder into here in Chunk 1, when the shack POI needs them.

import { MeshBuilder, Mesh } from '@babylonjs/core';

// Generic axis-aligned box. opts: { w,h,d, x,y,z, mat, rotY }.
export function box(scene, name, { w = 1, h = 1, d = 1, x = 0, y = 0, z = 0, mat = null, rotY = 0 } = {}) {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  if (rotY) m.rotation.y = rotY;
  if (mat) m.material = mat;
  return m;
}

// Generic cylinder/cone. opts: { dT,dB,h, x,y,z, mat, rotY, tess }.
export function cyl(scene, name, { dT = 1, dB = 1, h = 1, x = 0, y = 0, z = 0, mat = null, rotY = 0, tess = 10 } = {}) {
  const m = MeshBuilder.CreateCylinder(name, { diameterTop: dT, diameterBottom: dB, height: h, tessellation: tess }, scene);
  m.position.set(x, y, z);
  if (rotY) m.rotation.y = rotY;
  if (mat) m.material = mat;
  return m;
}

// Low rounded shrub — a clump of squashed spheres merged into one mesh. `mat` = foliage.
// Sits on the ground (y derived from scale). Returns a single merged Mesh.
export function buildBush(scene, mat, { x = 0, z = 0, scale = 1, rotY = 0 } = {}) {
  const blobs = [[0, 0.5, 0, 1.7], [0.7, 0.65, 0.3, 1.1], [-0.6, 0.6, -0.25, 1.0]];
  const parts = blobs.map(([bx, by, bz, dia], i) => {
    const s = MeshBuilder.CreateSphere('bushp' + i, { diameter: dia, segments: 6 }, scene);
    s.position.set(bx, by, bz);
    return s;
  });
  const m = Mesh.MergeMeshes(parts, true);
  m.name = 'poi-bush';
  m.material = mat;
  m.scaling.set(scale, 0.7 * scale, scale);
  m.position.set(x, 0, z);
  m.rotation.y = rotY;
  m.isPickable = false;
  return m;
}

// Faceted boulder — a low-segment sphere squashed unevenly. `mat` = stone.
export function buildRock(scene, mat, { x = 0, z = 0, scale = 1, rotY = 0 } = {}) {
  const m = MeshBuilder.CreateSphere('poi-rock', { diameter: 2.2, segments: 4 }, scene);
  m.scaling.set(1.1 * scale, 0.8 * scale, 1.0 * scale);
  m.position.set(x, 0.55 * scale, z);
  m.rotation.y = rotY;
  if (mat) m.material = mat;
  m.isPickable = false;
  return m;
}
