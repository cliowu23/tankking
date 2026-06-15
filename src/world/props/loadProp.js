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

// Subtle-grain texture sets keyed by base palette colour. Each prop material is matched to
// the NEAREST set by colour (trees → foliage/bark/stone; buildings → plaster/roof/wood/
// brick/stone) when it's a clear match. Small accents (metal bands, gold lock) fall back to
// a flat material; the warm window pane gets a flat material with a gentle glow.
const GRAIN_SETS = [
  ['prop_foliage', [0.24, 0.50, 0.20]],
  ['prop_bark',    [0.36, 0.25, 0.14]],
  ['prop_wood',    [0.34, 0.22, 0.12]],
  ['prop_stone',   [0.53, 0.51, 0.47]],
  ['prop_plaster', [0.88, 0.80, 0.66]],
  ['prop_roof',    [0.66, 0.30, 0.22]],
  ['prop_brick',   [0.52, 0.32, 0.26]],
];
const MATCH_THRESH = 0.045;   // colour-distance² beyond which a part stays flat (accents)

function baseRGB(mat) {
  const c = mat && (mat.albedoColor || mat.diffuseColor);
  return c ? [c.r, c.g, c.b] : [0.7, 0.7, 0.7];
}
function nearestSet([r, g, b]) {
  let best = null, bd = Infinity;
  for (const [set, c] of GRAIN_SETS) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bd) { bd = d; best = set; }
  }
  return bd <= MATCH_THRESH ? best : null;
}
const isWindow = ([r, g, b]) => r > 0.9 && g > 0.78 && b < 0.66;

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

// Flat matte material at a colour (accents). `warm` adds a gentle glow for window panes.
function flatMat(scene, rgb, warm = false) {
  const key = `propflat_${warm ? 'w' : ''}${rgb.map((v) => v.toFixed(2)).join('_')}`;
  let m = scene.getMaterialByName(key);
  if (m) return m;
  m = new StandardMaterial(key, scene);
  m.diffuseColor  = new Color3(...rgb);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  if (warm) m.emissiveColor = new Color3(rgb[0] * 0.35, rgb[1] * 0.30, rgb[2] * 0.18);
  return m;
}

function flattenMesh(scene, mesh) {
  const rgb = baseRGB(mesh.material);
  if (isWindow(rgb)) { mesh.material = flatMat(scene, rgb, true); return; }
  const set = nearestSet(rgb);
  mesh.material = set ? grainMat(scene, set) : flatMat(scene, rgb);
}

// Load treepatch.glb into the scene as hidden templates; returns { baseName: [meshes] }.
// Two-material props (the trees) import as split `<name>_primitive0/1` meshes, so each
// template is an ARRAY of primitive source meshes grouped under their base name. Loaded
// fresh per scene (templates belong to the scene; a new arena reloads — cheap, ~91KB).
export async function loadPropTemplates(scene, file = 'treepatch.glb') {
  const res = await SceneLoader.ImportMeshAsync('', PROP_DIR, file, scene);
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
