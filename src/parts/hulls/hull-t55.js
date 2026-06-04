import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb (hull body + tracks + wheels + running gear;
// turret and gun meshes removed).  Rz(90) rotation + scale 0.756 baked via PART_ROOT.
// GLB is body-midpoint centred so hull appears symmetric around X=0, Z=0.

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'hull-t55',
  name: 'T-55 Hull',
  category: 'hull',
  stats: {},

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'hull-t55.glb', scene);

    const root = new TransformNode('hull_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    // Source GLB 'turret' empty is misplaced (not at hull deck level).
    // Derive turret-ring mount from mesh bounding-box top instead.
    let maxY = -Infinity;
    for (const m of meshes) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      if (bb.maximumWorld.y > maxY) maxY = bb.maximumWorld.y;
    }

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: new Vector3(0, maxY, 0) };
  },
};
