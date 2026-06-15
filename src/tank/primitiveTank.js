import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

// Canonical "DEFAULT TANK" primitive geometry — the boxy placeholder shown both in the
// tank designer preview and on the hangar display plinth. Kept in one place so the two
// can't drift: a mismatch between the designer preview and the hangar is exactly the bug
// this module fixes (selecting DEFAULT TANK previewed the primitive but the hangar fell
// back to the composed tank).
//
// Pure geometry only — the caller wires shadows, disposal, camera and (in the designer)
// the real cannon GLB. Built in model-local space: hull centred on X/Z, resting near
// y=0, facing +Z. Returns the root, the turret/barrel pivots, every mesh, and the three
// shared materials.
export function buildPrimitiveTank(scene, { simpleBarrel = false } = {}) {
  const hullMat = new StandardMaterial('primHull', scene);
  hullMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
  hullMat.specularColor = new Color3(0.05, 0.15, 0.30);

  const turretMat = new StandardMaterial('primTurret', scene);
  turretMat.diffuseColor  = new Color3(0.08, 0.32, 0.75);
  turretMat.specularColor = new Color3(0.03, 0.10, 0.25);

  const trackMat = new StandardMaterial('primTrack', scene);
  trackMat.diffuseColor  = new Color3(0.12, 0.12, 0.12);
  trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

  const root = new TransformNode('primRoot', scene);

  const turretPivot = new TransformNode('primTurretPivot', scene);
  turretPivot.position.set(0, 0.55, 0);
  turretPivot.parent = root;

  const barrelPivot = new TransformNode('primBarrelPivot', scene);
  barrelPivot.position.set(0, 0.3, 0.6);
  barrelPivot.parent = turretPivot;

  const meshes = [];
  const reg = (m) => { m.receiveShadows = true; meshes.push(m); return m; };
  const box = (name, dims, [x, y, z], mat, parent) => {
    const m = MeshBuilder.CreateBox(name, dims, scene);
    m.position.set(x, y, z); m.material = mat; m.parent = parent;
    return reg(m);
  };

  // Hull + tracks + skirts
  box('primHull',   { width: 2.40, height: 0.65, depth: 2.50 }, [0, 0.325, 0],     hullMat,  root);
  box('primTrackL', { width: 0.28, height: 0.65, depth: 3.25 }, [-1.34, 0.325, 0], trackMat, root);
  box('primTrackR', { width: 0.28, height: 0.65, depth: 3.25 }, [ 1.34, 0.325, 0], trackMat, root);
  box('primSkirtL', { width: 0.07, height: 0.25, depth: 2.90 }, [-1.50, 0.125, 0], trackMat, root);
  box('primSkirtR', { width: 0.07, height: 0.25, depth: 2.90 }, [ 1.50, 0.125, 0], trackMat, root);

  // Road wheels
  for (const wz of [-1.0, -0.33, 0.33, 1.0]) {
    for (const wx of [-1.34, 1.34]) {
      const w = MeshBuilder.CreateCylinder(`primWheel_${wx}_${wz}`, { height: 0.10, diameter: 0.32, tessellation: 10 }, scene);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.18, wz);
      w.material = trackMat; w.parent = root; reg(w);
    }
  }

  // Turret (on the turret pivot)
  box('primTurretBody', { width: 1.15, height: 0.38, depth: 1.20 }, [0, 0.16, 0.05], turretMat, turretPivot);
  box('primTurretRoof', { width: 1.00, height: 0.12, depth: 1.00 }, [0, 0.38, 0.00], turretMat, turretPivot);
  const face = box('primTurretFace', { width: 1.10, height: 0.34, depth: 0.18 }, [0, 0.22, 0.62], turretMat, turretPivot);
  face.rotation.x = -Math.PI * 0.12;

  const mantlet = MeshBuilder.CreateCylinder('primMantlet', { height: 0.28, diameter: 0.65, tessellation: 10 }, scene);
  mantlet.rotation.x = Math.PI / 2; mantlet.position.set(0, 0.16, 0.72);
  mantlet.material = turretMat; mantlet.parent = turretPivot; reg(mantlet);

  const cupola = MeshBuilder.CreateCylinder('primCupola', { height: 0.16, diameterBottom: 0.35, diameterTop: 0.28, tessellation: 8 }, scene);
  cupola.position.set(0.12, 0.42, -0.10); cupola.material = turretMat; cupola.parent = turretPivot; reg(cupola);

  // Optional barrel for static displays (the designer instead builds the real cannon GLB
  // onto barrelPivot, so it opts out).
  if (simpleBarrel) {
    const barrel = MeshBuilder.CreateCylinder('primBarrel', { height: 1.5, diameter: 0.16, tessellation: 12 }, scene);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, 0.75);
    barrel.material = trackMat; barrel.parent = barrelPivot; reg(barrel);
  }

  return { root, turretPivot, barrelPivot, meshes, materials: { hull: hullMat, turret: turretMat, track: trackMat } };
}
