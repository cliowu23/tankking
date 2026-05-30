import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

export const PREFAB_DEFS = {
  tree:  { halfW: 1.2, halfD: 1.2 },
  house: { halfW: 2.2, halfD: 2.2 },
  rock:  { halfW: 1.1, halfD: 0.9 },
  wall:  { halfW: 3.0, halfD: 0.5 },
  wreck: { halfW: 2.2, halfD: 2.5 },
};

function _mat(scene, name, r, g, b) {
  return scene.getMaterialByName(name) ?? (() => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = new Color3(r, g, b);
    return m;
  })();
}

export function createPrefab(type, scene) {
  switch (type) {
    case 'tree':  return _tree(scene);
    case 'house': return _house(scene);
    case 'rock':  return _rock(scene);
    case 'wall':  return _wall(scene);
    case 'wreck': return _wreck(scene);
    default: return null;
  }
}

function _tree(scene) {
  const root = new TransformNode('prefab_tree', scene);

  const trunk = MeshBuilder.CreateCylinder('t_trunk', { diameter: 0.5, height: 2.0, tessellation: 7 }, scene);
  trunk.parent = root;
  trunk.position.y = 1.0;
  trunk.material = _mat(scene, 'pf_trunk', 0.45, 0.28, 0.10);

  const canopy = MeshBuilder.CreateSphere('t_canopy', { diameter: 3.2, segments: 5 }, scene);
  canopy.parent = root;
  canopy.position.y = 3.5;
  canopy.material = _mat(scene, 'pf_leaf', 0.18, 0.72, 0.20);

  root.metadata = { prefabType: 'tree', halfW: 1.2, halfD: 1.2 };
  return root;
}

function _house(scene) {
  const root = new TransformNode('prefab_house', scene);

  const walls = MeshBuilder.CreateBox('h_walls', { width: 4, height: 3, depth: 4 }, scene);
  walls.parent = root;
  walls.position.y = 1.5;
  walls.material = _mat(scene, 'pf_hwall', 0.92, 0.85, 0.68);

  const roof = MeshBuilder.CreateBox('h_roof', { width: 4.6, height: 0.4, depth: 4.6 }, scene);
  roof.parent = root;
  roof.position.y = 3.2;
  roof.material = _mat(scene, 'pf_hroof', 0.72, 0.28, 0.18);

  const ridge = MeshBuilder.CreateBox('h_ridge', { width: 4.2, height: 1.4, depth: 0.5 }, scene);
  ridge.parent = root;
  ridge.position.y = 4.1;
  ridge.material = _mat(scene, 'pf_hroof', 0.72, 0.28, 0.18);

  root.metadata = { prefabType: 'house', halfW: 2.2, halfD: 2.2 };
  return root;
}

function _rock(scene) {
  const root = new TransformNode('prefab_rock', scene);

  const rock = MeshBuilder.CreateSphere('r_mesh', {
    diameterX: 2.2, diameterY: 1.4, diameterZ: 1.8, segments: 4,
  }, scene);
  rock.parent = root;
  rock.position.y = 0.7;
  rock.rotation.y = (Math.random() * Math.PI * 2);
  rock.material = _mat(scene, 'pf_rock', 0.55, 0.52, 0.48);

  root.metadata = { prefabType: 'rock', halfW: 1.1, halfD: 0.9 };
  return root;
}

function _wall(scene) {
  const root = new TransformNode('prefab_wall', scene);

  const slab = MeshBuilder.CreateBox('w_slab', { width: 6, height: 2.4, depth: 1.0 }, scene);
  slab.parent = root;
  slab.position.y = 1.2;
  slab.material = _mat(scene, 'pf_conc', 0.80, 0.76, 0.62);

  root.metadata = { prefabType: 'wall', halfW: 3.0, halfD: 0.5 };
  return root;
}

function _wreck(scene) {
  const root = new TransformNode('prefab_wreck', scene);

  const hull = MeshBuilder.CreateBox('wr_hull', { width: 4.2, height: 0.9, depth: 5.0 }, scene);
  hull.parent = root;
  hull.position.y = 0.45;
  hull.rotation.z = 0.25;
  hull.material = _mat(scene, 'pf_wreck', 0.22, 0.20, 0.17);

  const turret = MeshBuilder.CreateBox('wr_turret', { width: 1.8, height: 0.8, depth: 1.8 }, scene);
  turret.parent = root;
  turret.position.set(1.6, 0.9, 0.8);
  turret.rotation.y = 0.7;
  turret.material = _mat(scene, 'pf_wreck', 0.22, 0.20, 0.17);

  root.metadata = { prefabType: 'wreck', halfW: 2.2, halfD: 2.5 };
  return root;
}
