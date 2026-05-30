import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

export default class PershingTank {
  constructor(scene, x, z) {
    this.root = new TransformNode('pershing_root', scene);
    this.root.position.set(x, 0, z);

    const hullMat = new StandardMaterial('pershingHull', scene);
    hullMat.diffuseColor  = new Color3(0.18, 0.75, 0.22);
    hullMat.specularColor = new Color3(0.06, 0.20, 0.08);

    const turretMat = new StandardMaterial('pershingTurret', scene);
    turretMat.diffuseColor  = new Color3(0.14, 0.62, 0.18);
    turretMat.specularColor = new Color3(0.05, 0.16, 0.06);

    const trackMat = new StandardMaterial('pershingTrack', scene);
    trackMat.diffuseColor  = new Color3(0.10, 0.10, 0.10);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    // --- Hull ---
    const hullLower = MeshBuilder.CreateBox('p_hullLower', { width: 2.55, height: 0.20, depth: 3.85 }, scene);
    hullLower.position.set(0, 0.10, 0);
    hullLower.material = hullMat;
    hullLower.parent = this.root;

    const hull = MeshBuilder.CreateBox('p_hull', { width: 2.35, height: 0.55, depth: 3.70 }, scene);
    hull.position.set(0, 0.375, 0);
    hull.material = hullMat;
    hull.parent = this.root;

    const engineDeck = MeshBuilder.CreateBox('p_engineDeck', { width: 1.80, height: 0.14, depth: 0.85 }, scene);
    engineDeck.position.set(0, 0.72, -1.30);
    engineDeck.material = hullMat;
    engineDeck.parent = this.root;

    const trackLeft = MeshBuilder.CreateBox('p_trackLeft', { width: 0.30, height: 0.72, depth: 3.90 }, scene);
    trackLeft.position.set(-1.325, 0.36, 0.05);
    trackLeft.material = trackMat;
    trackLeft.parent = this.root;

    const trackRight = MeshBuilder.CreateBox('p_trackRight', { width: 0.30, height: 0.72, depth: 3.90 }, scene);
    trackRight.position.set(1.325, 0.36, 0.05);
    trackRight.material = trackMat;
    trackRight.parent = this.root;

    // --- Turret ---
    const turretPivot = new TransformNode('p_turretPivot', scene);
    turretPivot.position.set(0, 0.55, 0);
    turretPivot.parent = this.root;

    // Pershing's signature: bulbous rounded cast turret — sphere squashed into egg
    const turret = MeshBuilder.CreateSphere('p_turret', { diameter: 2.1, segments: 8 }, scene);
    turret.scaling.set(0.90, 0.52, 1.05);
    turret.position.set(0, 0.28, 0.1);
    turret.material = turretMat;
    turret.parent = turretPivot;

    // Large prominent mantlet disc — iconic Pershing feature
    const mantlet = MeshBuilder.CreateCylinder('p_mantlet', { height: 0.38, diameter: 0.95, tessellation: 10 }, scene);
    mantlet.rotation.x = Math.PI / 2;
    mantlet.position.set(0, 0.22, 0.95);
    mantlet.material = turretMat;
    mantlet.parent = turretPivot;

    const cupola = MeshBuilder.CreateCylinder('p_cupola', { height: 0.22, diameterBottom: 0.52, diameterTop: 0.40, tessellation: 8 }, scene);
    cupola.position.set(0, 0.78, -0.15);
    cupola.material = turretMat;
    cupola.parent = turretPivot;

    // --- Barrel (90mm M3) ---
    const barrelPivot = new TransformNode('p_barrelPivot', scene);
    barrelPivot.position.set(0, 0.22, 0.95);
    barrelPivot.parent = turretPivot;

    const barrel = MeshBuilder.CreateCylinder('p_barrel', { height: 3.0, diameterBottom: 0.19, diameterTop: 0.12, tessellation: 8 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 1.5);
    barrel.material = turretMat;
    barrel.parent = barrelPivot;

    this._meshes = [hullLower, hull, engineDeck, trackLeft, trackRight, turret, mantlet, cupola, barrel];
  }

  addShadows(shadowGen) {
    for (const mesh of this._meshes) shadowGen.addShadowCaster(mesh);
  }
}
