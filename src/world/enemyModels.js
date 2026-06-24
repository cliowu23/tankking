// src/world/enemyModels.js
// Shared enemy-model templates for instancing. Each enemy GLB (sentinel/chaff) is
// imported ONCE per scene into hidden template meshes; every enemy then spawns
// InstancedMeshes off those templates — so a 40-spider swarm renders in a handful
// of GPU-batched draw calls instead of importing the GLB per enemy.
//
// Per-enemy variation without per-instance materials:
//   • death tint  → a per-instance "color" buffer (StandardMaterial multiplies it),
//   • eye glow    → the eye is the one part NOT instanced (cloned per enemy with its
//                   own emissive material) so each bot charges/pulses independently.
//
// Materials are flattened to flat StandardMaterials (PBR washes out — see
// loadProp.js / feedback_material_and_blender).
import { SceneLoader, StandardMaterial, Color3, Color4 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const DIR = '/assets/models/enemies/';
const cache = new WeakMap();   // scene -> { sentinel, chaff, _p_<key> }

function flatMat(scene, name, rgb, { emissive = false, spec = [0.16, 0.18, 0.21] } = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(...rgb);
  if (emissive) { m.emissiveColor = new Color3(...rgb); m.disableLighting = true; }
  else m.specularColor = new Color3(...spec);
  return m;
}

// Returns { parts: [{ mesh, matrix, name, isEye }] } — `mesh` is the disabled template
// to instance/clone, `matrix` its model-space world transform (so an instance placed
// under a holder reproduces the original layout). Cached per scene + per key.
export function loadEnemyTemplate(scene, key, palette) {
  let c = cache.get(scene); if (!c) cache.set(scene, c = {});
  if (c[key]) return Promise.resolve(c[key]);
  if (c['_p_' + key]) return c['_p_' + key];

  c['_p_' + key] = (async () => {
    const file = `${key}.glb`;   // 'chaff' → chaff.glb, 'sentinel' → sentinel.glb, 'mortar' → mortar.glb
    const res = await SceneLoader.ImportMeshAsync('', DIR, file, scene);
    const body = flatMat(scene, `${key}_body`, palette.body);
    const dark = flatMat(scene, `${key}_dark`, palette.dark, { spec: [0.05, 0.05, 0.06] });
    const trim = flatMat(scene, `${key}_trim`, palette.trim || palette.dark, { spec: [0.20, 0.22, 0.26] });

    const parts = [];
    for (const m of res.meshes) {
      if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;   // skip __root__/empties
      const mn = (m.material?.name || '').toLowerCase();
      const isEye = mn.includes('eye');
      m.material = isEye ? flatMat(scene, `${key}_eye`, palette.eye, { emissive: true })
                 : mn.includes('dark') ? dark
                 : mn.includes('trim') ? trim
                 : body;
      m.setEnabled(false);
      m.isPickable = false;
      if (!isEye) {
        m.registerInstancedBuffer('color', 4);                 // per-instance tint (death)
        m.instancedBuffers.color = new Color4(1, 1, 1, 1);
      }
      m.computeWorldMatrix(true);
      parts.push({ mesh: m, matrix: m.getWorldMatrix().clone(), name: m.name, isEye });
    }
    c[key] = { parts };
    return c[key];
  })();
  return c['_p_' + key];
}
