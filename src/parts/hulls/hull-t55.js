import { TransformNode, SceneLoader } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb (hull body + tracks + wheels + running gear;
// turret and gun meshes removed).  Game scale (0.7064) and +90°X axis normalisation
// are baked into the GLB via PART_ROOT in extract-parts.py, so build() needs no extra
// transforms — same pattern as hull-m26.js.

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'hull-t55',
  name: 'T-55 Hull',
  category: 'hull',
  stats: {},
  mountEmpty: 'turret',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'hull-t55.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : null;

    const root = new TransformNode('hull_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount };
  },
};
