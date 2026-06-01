import { StandardMaterial, Color3 } from '@babylonjs/core';

// Mesh name patterns that should NOT be painted.
// These are parts that would remain their natural color on a real tank:
// tracks/running gear, optics, glass, rubber, interior, antennas, roof-mounted MGs.
const UNPAINTABLE = [
  'track', 'tread',
  'wheel', 'road_wheel', 'sprocket', 'idler', 'roller', 'bogie', 'suspension',
  'lens', 'glass', 'optic', 'periscope', 'sight', 'vision',
  'interior', 'crew', 'engine',
  'rubber', 'seal',
  'exhaust', 'muffler',
  'antenna', 'aerial',
  'machinegun', 'machine_gun', 'dshk', 'coaxial', 'mg',
  'laser',
];

function isPaintable(name) {
  if (!name || name === '__root__') return false;
  const n = name.toLowerCase();
  return !UNPAINTABLE.some(kw => n.includes(kw));
}

/**
 * Apply manifest paintColor to a loaded GLB's meshes.
 * Paintable meshes get a new StandardMaterial at the specified color (matte finish).
 * Unpaintable meshes (tracks, optics, rubber, interior) keep their original GLTF material.
 * Material is cached by color key within the scene to avoid duplicates.
 *
 * @param {Mesh[]} meshes          result.meshes from SceneLoader.ImportMeshAsync
 * @param {object} config          manifest entry for this model
 * @param {Scene}  scene           Babylon.js scene
 * @param {number[]|null} colorOverride  optional [r,g,b] override — use config.paintColorAlt
 *                                       to paint with the alt color (e.g. orange AI enemy)
 */
export function applyModelPaint(meshes, config, scene, colorOverride = null) {
  const paintColor = colorOverride ?? config.paintColor;
  if (!paintColor) return;

  const [r, g, b] = paintColor;
  const key = `modelPaint_${r}_${g}_${b}`;

  // Optional per-model skip list for models with generic Object_N names where
  // keyword matching can't work — e.g. "paintSkipMeshes": ["Object_4", "Object_6"]
  const skipSet = new Set(config.paintSkipMeshes ?? []);

  let mat = scene.getMaterialByName(key);
  if (!mat) {
    mat = new StandardMaterial(key, scene);
    mat.diffuseColor  = new Color3(r, g, b);
    mat.specularColor = new Color3(0.05, 0.06, 0.07);
    mat.specularPower = 8;
  }

  const tintColor  = config.tintColor ?? null;
  const matCache   = {}; // shared cache for both paint and tint clones

  function tintMaterial(orig, colorArr, suffix) {
    const key = `${orig.name}__${suffix}`;
    if (!matCache[key]) {
      const cloned = orig.clone(key);
      const c = new Color3(...colorArr);
      if (cloned.albedoColor !== undefined) cloned.albedoColor = c;
      else if (cloned.diffuseColor !== undefined) cloned.diffuseColor = c;
      matCache[key] = cloned;
    }
    return matCache[key];
  }

  const skipped = [];
  let painted = 0;
  for (const mesh of meshes) {
    if (!isPaintable(mesh.name) || skipSet.has(mesh.name)) {
      skipped.push(mesh.name);
      // Tint skipped meshes (e.g. tracks → dark gunmetal) while preserving texture detail
      if (tintColor && mesh.material)
        mesh.material = tintMaterial(mesh.material, tintColor, `tint_${tintColor.join('_')}`);
      continue;
    }
    // Paint: flat matte color — bright and clean, like a properly painted toy tank
    mesh.material = mat;
    painted++;
  }

  console.log(`[Paint] ${painted} painted, ${skipped.length} tinted/original: ${skipped.join(', ') || 'none'}`);
}
