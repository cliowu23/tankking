import { TransformNode, SceneLoader } from '@babylonjs/core';

// T-55 turret — extracted from t-55ak.glb (core dome + hatch + optics; gun removed).
// Normalized to Z-up +Z-forward, origin = turret ring center, scale 0.7064 baked in.
//
// mounts.barrelMount tuned live in the designer.

export default {
  id: 'turret-t55',
  name: 'T-55 Turret',
  category: 'turret',
  stats: {
    traverseSpeed: 60, // deg/s — T-55 traverses slower than the M26
  },
  mounts: {
    barrelMount: { x: 0, y: 0.2, z: 0.3 },
  },

  async build(scene, material) {
    const result = await SceneLoader.ImportMeshAsync(
      '', '/models/parts/', 'turret-t55.glb', scene
    );
    const root = new TransformNode('turret_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) {
      m.setParent(root);
      if (material) m.material = material;
    }
    return { root, meshes };
  },
};
