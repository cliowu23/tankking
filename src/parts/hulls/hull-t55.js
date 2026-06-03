import { TransformNode, SceneLoader } from '@babylonjs/core';

// T-55 hull — extracted from t-55ak.glb (hull + tracks + wheels, turret + gun removed).
// Normalized from the GLB's native +X-facing / Y-up layout to standard Z-up +Z-forward,
// origin = ground-center, scale 0.7064 baked in.
//
// mounts.turretRing tuned live in the designer (the T-55's turret empty is misplaced
// in the source GLB, so the value isn't trustworthy from extraction).

export default {
  id: 'hull-t55',
  name: 'T-55 Hull',
  category: 'hull',
  stats: {},
  mounts: {
    turretRing: { x: 0, y: 0.9, z: 0 },
  },

  async build(scene, material) {
    const result = await SceneLoader.ImportMeshAsync(
      '', '/models/parts/', 'hull-t55.glb', scene
    );
    const root = new TransformNode('hull_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) {
      m.setParent(root);
      if (material) m.material = material;
    }
    return { root, meshes };
  },
};
