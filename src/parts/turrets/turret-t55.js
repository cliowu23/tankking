import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 turret — extracted from t-55ak.glb (turret dome, hatch, cupola, coaxial MG;
// hull meshes and main gun removed).  Origin is at the turret ring so it sits flush
// when parented to assembleTank's turretPivot.  The `mount` empty (barrel elevation
// pivot) is baked in and read via getAbsolutePosition().
//
// SCALE: same 0.7064 factor as hull-t55.js so parts stay consistent when assembled.

const SCALE = 0.7064;

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],  // signal red, matches hull
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'turret-t55',
  name: 'T-55 Turret',
  category: 'turret',
  stats: {
    traverseSpeed: 60,
  },
  mountEmpty: 'mount',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t55.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mountRaw = mountNode ? mountNode.getAbsolutePosition() : null;
    const mount = mountRaw ? mountRaw.scale(SCALE) : null;

    const root = new TransformNode('turret_t55_root', scene);
    root.scaling = new Vector3(SCALE, SCALE, SCALE);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount };
  },
};
