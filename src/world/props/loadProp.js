// src/world/props/loadProp.js
// GLB prop templates for the POI library. Loads the props GLB once per scene, flattens
// its materials to our flat toy look (StandardMaterial — PBR washes out in this scene; see
// ART_DIRECTION + feedback_material_and_blender), and hands back named template meshes that
// POI builders instance. The props are native low-poly models built in Blender
// (feedback_blender_prop_loop), exported to treepatch.glb.

import { SceneLoader, StandardMaterial, Color3, Texture } from '@babylonjs/core';

const PROP_DIR = '/assets/models/props/';
const TEX_DIR  = '/assets/textures/props/';
const TEX_TILE = 6;     // grain tiling across the prop UVs (higher = finer grain) — user-picked

// Which subtle-grain texture set each prop part uses, picked from the GLB mesh name.
// Trees split into 2 primitives: _primitive0 = trunk (bark), _primitive1 = canopy (foliage).
function texFor(name) {
  if (/^Rock/.test(name))           return 'prop_stone';
  if (/^Bush/.test(name))           return 'prop_foliage';
  if (/_primitive0$/.test(name))    return 'prop_bark';
  return 'prop_foliage';            // canopies (_primitive1) + fallback
}

// Matte StandardMaterial with a subtle grain (diffuse colour + normal) — kills the flat
// "reflective plastic" look while matching the World 1 grain pipeline. Cached per set/scene.
function grainMat(scene, set) {
  const key = `proptex_${set}`;
  let m = scene.getMaterialByName(key);
  if (m) return m;
  m = new StandardMaterial(key, scene);
  const d = new Texture(`${TEX_DIR}${set}_diff.png`, scene);
  const n = new Texture(`${TEX_DIR}${set}_nrm.png`, scene);
  d.uScale = d.vScale = TEX_TILE; n.uScale = n.vScale = TEX_TILE;
  m.diffuseTexture  = d;                          // grain carries the colour
  m.bumpTexture     = n;                          // micro-relief scatters the highlight
  m.diffuseColor    = new Color3(1, 1, 1);
  m.specularColor   = new Color3(0.04, 0.04, 0.04); // matte — barely any sheen
  m.specularPower   = 32;
  return m;
}

function flattenMesh(scene, mesh) {
  mesh.material = grainMat(scene, texFor(mesh.name));
}

// Load treepatch.glb into the scene as hidden templates; returns { baseName: [meshes] }.
// Two-material props (the trees) import as split `<name>_primitive0/1` meshes, so each
// template is an ARRAY of primitive source meshes grouped under their base name. Loaded
// fresh per scene (templates belong to the scene; a new arena reloads — cheap, ~91KB).
export async function loadPropTemplates(scene) {
  const res = await SceneLoader.ImportMeshAsync('', PROP_DIR, 'treepatch.glb', scene);
  const byName = {};
  for (const m of res.meshes) {
    if (!m.getTotalVertices || m.getTotalVertices() === 0) continue; // skip __root__/empties
    flattenMesh(scene, m);
    m.setEnabled(false);     // template — instanced per placement, never drawn itself
    m.isPickable = false;
    const base = m.name.replace(/_primitive\d+$/, '');
    (byName[base] ||= []).push(m);
  }
  return byName;
}

let _instN = 0;

// Instance a named template at a placement. Returns an ARRAY of InstancedMeshes (one per
// primitive — e.g. trunk + canopy), all sharing the placement transform so they align.
export function instanceProp(templates, name, { x = 0, z = 0, scale = 1, rotY = 0, parent = null } = {}) {
  const srcs = templates[name];
  if (!srcs || !srcs.length) return [];
  const id = _instN++;
  return srcs.map((src, i) => {
    const inst = src.createInstance(`${name}_${id}_${i}`);
    inst.position.set(x, 0, z);
    inst.scaling.setAll(scale);
    inst.rotation.y = rotY;
    if (parent) inst.parent = parent;
    inst.isPickable = false;
    return inst;
  });
}
