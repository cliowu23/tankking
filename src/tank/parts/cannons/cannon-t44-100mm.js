import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';

// 100mm D-10 as mounted on the T-44-100 — extracted from the SAME model as the T-44 turret
// (architecture/extract-t44.py --part barrel), so the breech meets the T-44 mantlet exactly
// (the T-55-sourced cannon-100mm left a gap). Breech at the origin, tube already along +Z
// (no rotation needed). ~3.5 game units long.

export default {
  id: 'cannon-t44-100mm',
  name: '100mm D-10 (T-44)',
  category: 'cannon',
  stats: { caliber: 100, barrelLength: 3.5, elevation: 18, depression: 5 },

  async build(scene, material) {
    const result = await SceneLoader.ImportMeshAsync('', '/assets/models/tanks/parts/', 'barrel-t44-100mm.glb', scene);

    const root = new TransformNode('cannonT44_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) {
      m.setParent(root);
      m.material = material;
    }
    // GLB is already oriented +Z with the breech at the origin — no rotation.
    return { root, meshes, breech: new Vector3(0, 0, 0) };
  },
};
