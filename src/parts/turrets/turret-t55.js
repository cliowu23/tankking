import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 turret — extracted from t-55ak.glb (turret dome, hatch, cupola, coaxial MG;
// hull meshes and main gun removed).  Body-midpoint centred, Rz(90) + scale 0.756.
// Dome spans Babylon Y 0→2.891 (above turret base), front face at Babylon Z≈1.176.
//
// BARREL_MOUNT is a hardcoded offset in turretPivot local space — dial in live in designer.
// x=0 (centered), y=gun exit height above turret base, z=front-face offset.

const BARREL_MOUNT = new Vector3(0, 0.3, 1.0);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'turret-t55',
  name: 'T-55 Turret',
  category: 'turret',
  stats: { traverseSpeed: 60 },

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t55.glb', scene);

    const root = new TransformNode('turret_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: BARREL_MOUNT.clone() };
  },
};
