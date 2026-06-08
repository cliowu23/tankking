import { TransformNode, SceneLoader } from '@babylonjs/core';
import { applyModelPaint } from '../../../utils/modelPaint.js';

// M26 Pershing hull — extracted from m26_pershing_war_thunder.glb (hull + tracks + wheels;
// turret + barrel removed). Centered at origin, scale baked in, materials + Sketchfab
// orientation preserved. The GLB keeps the original `turret` empty → turretRing mount.

// Paint config (matches the M26 entry in assets/models/manifest.json): body painted flat cobalt,
// running gear keeps its War Thunder textures tinted dark gunmetal.
const PAINT = {
  paintColor: [0.12, 0.42, 0.88],
  tintColor:  [0.28, 0.26, 0.24],
  paintSkipMeshes: [
    'Object_4', 'Object_6', 'Object_11', 'Object_14', 'Object_15', 'Object_16',
    'Object_8', 'Object_20', 'Object_5', 'Object_7', 'Object_19', 'Object_21',
    'Object_3', 'wheel_l5',
  ],
};

export default {
  id: 'hull-m26',
  name: 'M26 Hull',
  category: 'hull',
  stats: {},
  mountEmpty: 'turret',
  nativeTurret: 'turret-m26',

  async build(scene, paintOverride = null) {
    const result = await SceneLoader.ImportMeshAsync('', '/assets/models/tanks/parts/', 'hull-m26.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : null;

    const root = new TransformNode('hull_m26_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene, paintOverride);
    return { root, meshes, mount, ringCenter: mount };
  },
};
