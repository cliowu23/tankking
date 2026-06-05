import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';

// The GLB's `mount` empty sits ~0.45 behind the mantlet front, so the gun's elevation pivot
// ends up inside the turret. Nudge it forward to the trunnion (at the mantlet). Dial in designer.
const MOUNT_FORWARD = 0.35;

// M26 Pershing turret shell — extracted from m26_pershing_war_thunder.glb
// (turret body, mantlet, cupola; barrel removed). Centered on its ring, materials kept.
// The GLB keeps the original `mount` empty → barrelMount.

const PAINT = {
  paintColor: [0.12, 0.42, 0.88],
  tintColor:  [0.28, 0.26, 0.24],
  detailPaint: true,   // tint the cast turret (keep weld/rivet detail) instead of flat color
  paintSkipMeshes: [
    'Object_4', 'Object_6', 'Object_11', 'Object_14', 'Object_15', 'Object_16',
    'Object_8', 'Object_20', 'Object_5', 'Object_7', 'Object_19', 'Object_21',
    'Object_3', 'wheel_l5',
  ],
};

export default {
  id: 'turret-m26',
  name: 'M26 Turret',
  category: 'turret',
  stats: { traverseSpeed: 72 },
  mountEmpty: 'mount',
  defaultCannon: 'cannon-90mm',
  paintColor: PAINT.paintColor,     // composed barrel matches the body color

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-m26.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : new Vector3(0, 0.17, 1.13);
    mount.z += MOUNT_FORWARD;   // shift the elevation pivot out to the mantlet trunnion

    const root = new TransformNode('turret_m26_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);
    for (const m of meshes) m.computeWorldMatrix(true);

    const base = measureBase(meshes);
    console.log(`[turret-m26] base center=(${base.center.x.toFixed(2)},${base.center.y.toFixed(2)},${base.center.z.toFixed(2)}) diameter=${base.diameter.toFixed(2)}`);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount, base };
  },
};
