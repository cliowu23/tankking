import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';

// 90mm T15E2M — M26 Pershing main gun, extracted from m26_pershing_war_thunder.glb.
// Includes the real double-baffle muzzle brake at the tip.
// Base at origin, tip at +Z ≈ 4.09 game units (longer barrel than the D-10T).

export default {
  id: 'cannon-90mm',
  name: '90mm T15E2M',
  category: 'cannon',
  stats: {
    caliber: 90,
    barrelLength: 3.10,
    elevation: 20,
    depression: 10,
  },

  async build(scene, material) {
    const result = await SceneLoader.ImportMeshAsync(
      '', '/assets/models/tanks/parts/', 'barrel-m26-90mm.glb', scene
    );

    const root = new TransformNode('cannon90mm_root', scene);

    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) {
      m.setParent(root);
      m.material = material;
    }

    // Set rotation AFTER parenting — same reason as cannon-100mm.js.
    root.rotation.x = Math.PI / 2;

    return { root, meshes, breech: new Vector3(0, 0, 0) };
  },
};
