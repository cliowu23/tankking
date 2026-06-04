import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 turret — extracted from t-55ak.glb (turret dome, hatch, cupola, coaxial MG;
// hull meshes and main gun removed).  Ring at origin, scale + axis normalisation baked
// in by extract-parts.py.
//
// BARREL_MOUNT is an explicit offset, NOT read from the GLB's `mount` empty: that empty
// is an interior point in the source model (reads ~(-1.3, 0.95, -0.96)), which floats the
// barrel off to the side and behind.  These values were dialed in live in the designer to
// place the gun at the front-center of the dome.  x=0 (centered), y=mid-dome, z=front face.

const BARREL_MOUNT = new Vector3(0, 0.45, 0.55);

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
