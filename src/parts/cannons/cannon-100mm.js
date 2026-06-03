import { TransformNode, SceneLoader } from '@babylonjs/core';

// 100mm D-10T — T-55 main gun, extracted from t-55ak.glb.
// Base at origin, tip at +Z ≈ 2.78 game units.
// Bore evacuator bulge is the single most recognisable visual feature.

export default {
  id: 'cannon-100mm',
  name: '100mm D-10T',
  category: 'cannon',
  stats: {
    caliber: 100,
    barrelLength: 2.78,
    elevation: 18,
    depression: 5,
  },

  async build(scene, material) {
    const result = await SceneLoader.ImportMeshAsync(
      '', '/models/parts/', 'barrel-t55-100mm.glb', scene
    );

    const root = new TransformNode('cannon100mm_root', scene);

    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) {
      m.setParent(root);
      m.material = material;
    }

    // Set rotation AFTER parenting — setParent preserves world orientation by
    // writing a compensating local rotation onto the mesh, which would cancel
    // a rotation set beforehand.
    root.rotation.x = Math.PI / 2;

    return { root, meshes };
  },
};
