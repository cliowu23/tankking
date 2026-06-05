import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';

// T-44-100 turret — extracted by mesh list (no rig empties) via architecture/extract-t44.py.
// The source fused the mantlet + barrel into one mesh (Object_11); the extraction BISECTS it,
// keeping the mantlet (+breech) with the turret and dropping the barrel tube — the barrel is
// the swappable cannon (defaultCannon below) which seats in the mantlet hole. Normals are
// recalculated outward in extraction so the dome/mantlet don't render see-through. Scale 0.92.

// Barrel mount is MEASURED, not hardcoded: extract-t44.py bakes a `mount` empty at the gun-
// bore centroid (the trunnion) into the GLB, and build() reads it — correct height + depth
// for free. This fallback is only used if the empty is missing.
const BARREL_MOUNT_FALLBACK = new Vector3(0, 0.78, 1.6);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],   // red body
  tintColor:  [0.28, 0.26, 0.24],
  paintSkipMeshes: [],              // turret + mantlet are all body
};

export default {
  id: 'turret-t44',
  name: 'T-44 Turret',
  category: 'turret',
  stats: { traverseSpeed: 65 },
  defaultCannon: 'cannon-t44-100mm',
  paintColor: PAINT.paintColor,     // composed barrel matches the body color

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t44.glb', scene);

    // Read the measured trunnion baked into the GLB (see extract-t44.py).
    const mountNode = result.transformNodes.find(n => n.name === 'mount');
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : BARREL_MOUNT_FALLBACK.clone();

    const root = new TransformNode('turret_t44_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);
    for (const m of meshes) m.computeWorldMatrix(true);

    const base = measureBase(meshes);
    console.log(`[turret-t44] base diameter=${base.diameter.toFixed(2)} mount=(${mount.x.toFixed(2)},${mount.y.toFixed(2)},${mount.z.toFixed(2)})`);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount, base };
  },
};
