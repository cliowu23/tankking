import { StandardMaterial, Color3, FresnelParameters } from '@babylonjs/core';

/**
 * The tank "painted metal" finish — shared by body paint, composed cannons, and
 * the tuner preview. StandardMaterial (PBR washes out in this scene — see
 * ART_DIRECTION), but tuned to read as painted steel instead of plastic:
 * stronger/tighter specular highlight + a subtle fresnel rim catching the light
 * on curved edges. Cached per color per scene.
 */
export function makePaintMaterial(scene, [r, g, b], name = null) {
  const key = name ?? `tankPaint_${r}_${g}_${b}`;
  let mat = scene.getMaterialByName(key);
  if (mat) return mat;
  mat = new StandardMaterial(key, scene);
  mat.diffuseColor  = new Color3(r, g, b);
  mat.specularColor = new Color3(0.16, 0.17, 0.19);   // muted steel sheen under paint
  mat.specularPower = 48;                              // tight, restrained highlight
  const rim = new FresnelParameters();
  rim.bias = 0.5; rim.power = 3.2;                     // rim only at extreme glancing angles
  rim.leftColor  = new Color3(0.10, 0.11, 0.13);
  rim.rightColor = Color3.Black();
  mat.emissiveFresnelParameters = rim;
  mat.emissiveColor = new Color3(1, 1, 1);             // fresnel scales this rim
  mat.backFaceCulling = false;
  return mat;
}

// Mesh name patterns that should NOT be painted.
// These are parts that would remain their natural color on a real tank:
// tracks/running gear, optics, glass, rubber, interior, antennas, roof-mounted MGs.
const UNPAINTABLE = [
  'track', 'tread',
  'wheel', 'road_wheel', 'sprocket', 'idler', 'roller', 'bogie', 'suspension',
  'tire',                    // rubber tires (t55-wheels naming)
  'vehicle-gear',            // running gear sprockets (ussr-vehicle-gear naming)
  'lens', 'glass', 'optic', 'periscope', 'sight', 'vision',
  'interior', 'crew', 'engine',
  'rubber', 'seal',
  'exhaust', 'muffler',
  'antenna', 'aerial',
  'machinegun', 'machine_gun', 'dshk', 'coaxial', 'mg',
  'laser',
  'mantlet',                 // mantlet group reads as dark canvas cover (art decision, pass 2)
  'trim_dark',               // greeble two-tone contract: '<part>_trim_dark' children stay dark
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

  // Optional per-model skip list for models with generic Object_N names where
  // keyword matching can't work — e.g. "paintSkipMeshes": ["Object_4", "Object_6"]
  const skipSet = new Set(config.paintSkipMeshes ?? []);

  // Painted-metal finish (shared with cannons + tuner); backFaceCulling stays off
  // for thin single-sided plates in web-optimized GLBs.
  const mat = makePaintMaterial(scene, paintColor);

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
