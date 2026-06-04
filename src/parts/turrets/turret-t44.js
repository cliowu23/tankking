import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';

// T-44-100 turret — extracted by explicit mesh list (no rig empties). Gun removed (it's a
// swappable cannon — defaultCannon below). Standard orientation, no rotation: the mantlet
// faces Babylon +Z (game-forward). Scale 0.92.

// Barrel pivot in the turret's local frame — gun exit at the mantlet front. Dial in designer.
const BARREL_MOUNT = new Vector3(0, 0.45, 1.0);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],   // red body
  tintColor:  [0.28, 0.26, 0.24],
  paintSkipMeshes: [],              // turret is all body; add darken-targets if any appear
};

export default {
  id: 'turret-t44',
  name: 'T-44 Turret',
  category: 'turret',
  stats: { traverseSpeed: 65 },
  defaultCannon: 'cannon-100mm',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t44.glb', scene);

    const root = new TransformNode('turret_t44_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);
    for (const m of meshes) m.computeWorldMatrix(true);

    const base = measureBase(meshes);
    console.log(`[turret-t44] base center=(${base.center.x.toFixed(2)},${base.center.y.toFixed(2)},${base.center.z.toFixed(2)}) diameter=${base.diameter.toFixed(2)}`);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: BARREL_MOUNT.clone(), base };
  },
};
