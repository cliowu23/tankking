import { TransformNode, SceneLoader } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 turret — extracted from t-55ak.glb (turret dome, hatch, cupola, coaxial MG;
// hull meshes and main gun removed).  Ring at origin, scale + axis normalisation baked
// in by extract-parts.py — same pattern as turret-m26.js.

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'turret-t55',
  name: 'T-55 Turret',
  category: 'turret',
  stats: { traverseSpeed: 60 },
  mountEmpty: 'mount',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t55.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : null;

    const root = new TransformNode('turret_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount };
  },
};
