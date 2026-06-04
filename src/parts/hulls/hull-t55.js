import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb (hull body + tracks + wheels + running gear;
// turret and gun meshes removed).  Rz(90) rotation + scale 0.756 baked via PART_ROOT.
// GLB is body-midpoint centred so hull appears symmetric around X=0, Z=0.

// Turret-ring height. The source GLB 'turret' empty is misplaced, and the hull bbox
// top (~1.48) catches antenna/gear spikes — too high, leaves the turret floating.
// RING_HEIGHT is the actual deck level, dialled in live in the designer.
const RING_HEIGHT = 1.0;

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

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: new Vector3(0, RING_HEIGHT, 0) };
  },
};
