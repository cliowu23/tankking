import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb. Rz(90) + scale 0.756 baked via PART_ROOT,
// body-midpoint centred. The extraction leaves the hull facing Babylon -Z; HULL_YAW spins
// it to +Z to match the turret and game-forward.
const HULL_YAW = Math.PI;

// Ring center on the deck: X=0 (centered), Z forward of hull-center (the T-55 ring sits
// ahead of mid-hull), Y = deck height. Dialled in live in the designer.
const RING_CENTER = new Vector3(0, 1.0, 0.35);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'hull-t55',
  name: 'T-55 Hull',
  category: 'hull',
  stats: {},
  nativeTurret: 'turret-t55',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'hull-t55.glb', scene);

    const root = new TransformNode('hull_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    // Face game-forward (+Z) to match the turret.
    root.rotation.y = HULL_YAW;

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: RING_CENTER.clone(), ringCenter: RING_CENTER.clone() };
  },
};
