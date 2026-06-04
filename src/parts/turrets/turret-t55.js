import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 turret — extracted from t-55ak.glb (turret dome, hatch, cupola, coaxial MG;
// hull meshes and main gun removed).  Body-midpoint centred, Rz(90) + scale 0.756.
//
// YAW_FIX: the Rz(90) extraction leaves the dome's mantlet (gun face) pointing Babylon
// -Z, while the barrel mounts at +Z — so the gun pokes out the BACK of the dome. A 180°
// spin about Y brings the mantlet to +Z to meet the barrel and face game-forward.
const YAW_FIX = Math.PI;

// BARREL_MOUNT — barrel pivot in turretPivot local space. After YAW_FIX the mantlet is
// at +Z, so the barrel mounts forward (+Z). Dial in live in the designer.
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

    // Spin dome to face game-forward (mantlet → +Z). Set after parenting meshes; root
    // has no parent yet so this local rotation survives assembleTank's parent assignment.
    root.rotation.y = YAW_FIX;

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: BARREL_MOUNT.clone() };
  },
};
