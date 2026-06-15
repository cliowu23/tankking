// src/world/props/loadProp.js
// GLB prop templates for the POI library. Loads the props GLB once per scene, flattens
// its materials to our flat toy look (StandardMaterial — PBR washes out in this scene; see
// ART_DIRECTION + feedback_material_and_blender), and hands back named template meshes that
// POI builders instance. The props are native low-poly models built in Blender
// (feedback_blender_prop_loop), exported to treepatch.glb.

import { SceneLoader, StandardMaterial, Color3 } from '@babylonjs/core';

const PROP_DIR = '/assets/models/props/';

// Replace a GLB (PBR) material with a flat matte StandardMaterial of the same base color.
// Cached per color per scene so shared parts (trunks, foliage) reuse one material.
function flatify(scene, src) {
  const c = (src && (src.albedoColor || src.diffuseColor)) || null;
  const rgb = c ? [c.r, c.g, c.b] : [0.7, 0.7, 0.7];
  const key = `propflat_${rgb.map((v) => v.toFixed(2)).join('_')}`;
  let m = scene.getMaterialByName(key);
  if (!m) {
    m = new StandardMaterial(key, scene);
    m.diffuseColor = new Color3(...rgb);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
  }
  return m;
}

function flattenMesh(scene, mesh) {
  const mat = mesh.material;
  if (mat && Array.isArray(mat.subMaterials)) {
    mat.subMaterials = mat.subMaterials.map((sm) => (sm ? flatify(scene, sm) : sm));
  } else if (mat) {
    mesh.material = flatify(scene, mat);
  }
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
