import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';

// turret-m26.glb is re-extracted (architecture/extract-m26-turret.py) to KEEP the mantlet
// shield (bisected off the fused gun mesh Object_22) and to bake a `mount` empty at the
// measured gun bore (the trunnion) — so the mantlet detail is back and the barrel mount is
// correct without a hardcoded nudge.

// M26 Pershing turret shell — extracted from m26_pershing_war_thunder.glb
// (turret body, mantlet, cupola; barrel removed). Centered on its ring, materials kept.
// The GLB keeps the original `mount` empty → barrelMount.

const PAINT = {
  paintColor: [0.12, 0.42, 0.88],
  tintColor:  [0.28, 0.26, 0.24],
  // Turret fittings stay dark metal (not cobalt): Object_10 = cupola + hatches + periscopes
  // + rear stowage rack (matches the original M26's manifest); Object_3/5/7/19/21 = small
  // brackets/fittings. (Hull mesh names left in for parity; they simply don't match here.)
  paintSkipMeshes: [
    'Object_3', 'Object_5', 'Object_7', 'Object_10', 'Object_19', 'Object_21',
    'Object_4', 'Object_6', 'Object_11', 'Object_14', 'Object_15', 'Object_16',
    'Object_8', 'Object_20', 'wheel_l5',
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
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : new Vector3(0, 0.14, 1.83);

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
