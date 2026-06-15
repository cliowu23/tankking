// src/world/props/loadProp.js
// GLB prop loader for the POI library (Track B). Loads a model from the props asset dir
// (same SceneLoader pattern as the driver/tank loaders, e.g. DriverCharacter.js) and,
// optionally, recolors it to a FLAT toy material — StandardMaterial, low specular, no PBR
// (PBR washes out in this scene; see ART_DIRECTION). KayKit/Kenney/Quaternius CC0 packs
// already ship flat vertex-colored materials, so `color` is only for palette overrides.
//
// Not on the runtime path for Chunk 0 (the tree-patch POI is procedural); this is the
// ready-made seam the art pass swaps procedural props onto.

import { SceneLoader, StandardMaterial, Color3 } from '@babylonjs/core';

const PROP_DIR = '/assets/models/props/';

// Load and place a GLB prop. opts: { x,y,z, scale, rotY, color:[r,g,b]|null }.
// Returns { root, meshes }. When `color` is given, every renderable mesh is repainted
// with one shared flat material; otherwise the GLB's own (flat) materials are kept.
export async function loadProp(scene, file, { x = 0, y = 0, z = 0, scale = 1, rotY = 0, color = null } = {}) {
  const res = await SceneLoader.ImportMeshAsync('', PROP_DIR, file, scene);
  const root = res.meshes[0];
  root.position.set(x, y, z);
  root.scaling.setAll(scale);
  root.rotation.y = rotY;

  if (color) {
    const mat = new StandardMaterial(`prop_${file}_${color.join('_')}`, scene);
    mat.diffuseColor = new Color3(...color);
    mat.specularColor = new Color3(0.04, 0.04, 0.04);   // flat toy finish
    for (const m of res.meshes) {
      if (m.getTotalVertices && m.getTotalVertices() > 0) m.material = mat;
    }
  }
  return { root, meshes: res.meshes };
}
