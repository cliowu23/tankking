import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-44-100 hull — extracted by explicit mesh list (the GLB had no rig empties) via
// architecture/extract-bymesh.py. The model is in standard Blender Z-up orientation, so no
// rotation is needed: the glTF exporter maps it to Babylon Y-up with the glacis facing +Z.
// Scale 0.92.

// Deck height where the turret seats (turret base above the hull bottom). Dial in designer.
const RING_CENTER = new Vector3(0, 0.78, 0);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],   // red body
  tintColor:  [0.28, 0.26, 0.24],   // dark gunmetal for running gear
  // Running gear darkened (identified by isolate-render, since materials are UUIDs):
  //   Object_6/8 = tracks, Object_16 = road wheels + drive sprockets.
  // (Idler wheels live in Object_17 merged with the fenders, so they stay body-colored.)
  paintSkipMeshes: ['Object_6', 'Object_8', 'Object_16'],
};

export default {
  id: 'hull-t44',
  name: 'T-44 Hull',
  category: 'hull',
  stats: {},
  nativeTurret: 'turret-t44',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'hull-t44.glb', scene);

    const root = new TransformNode('hull_t44_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: RING_CENTER.clone(), ringCenter: RING_CENTER.clone() };
  },
};
