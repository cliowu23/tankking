import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb (hull body + tracks + wheels + running gear;
// turret and gun meshes removed).  GLB preserves the Sketchfab orientation so no
// runtime rotation correction is needed.  The `turret` empty is baked into the GLB
// at the turret ring position — assembleTank reads it via getAbsolutePosition().
//
// SCALE: the new extraction pipeline doesn't bake a scale factor, so we apply 0.7064
// here (same factor the manifest-based loader uses for t-55ak.glb).  The raw mount
// position is multiplied by the same factor so it stays consistent with the geometry.

const SCALE = 0.7064;

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],  // signal red (default T-55 body colour)
  tintColor:  [0.28, 0.26, 0.24],  // dark gunmetal tint for tracks/wheels
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
    const mountRaw = mountNode ? mountNode.getAbsolutePosition() : null;
    const mount = mountRaw ? mountRaw.scale(SCALE) : null;

    const root = new TransformNode('hull_t55_root', scene);
    root.scaling = new Vector3(SCALE, SCALE, SCALE);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount };
  },
};
