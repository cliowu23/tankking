import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

export default class T80Tank {
  constructor(scene, x, z) {
    this.root = new TransformNode('t80_root', scene);
    this.root.position.set(x, 0, z);

    const hullMat = new StandardMaterial('t80Hull', scene);
    hullMat.diffuseColor  = new Color3(0.18, 0.22, 0.13);
    hullMat.specularColor = new Color3(0.06, 0.08, 0.04);

    const turretMat = new StandardMaterial('t80Turret', scene);
    turretMat.diffuseColor  = new Color3(0.16, 0.20, 0.11);
    turretMat.specularColor = new Color3(0.05, 0.07, 0.03);

    const trackMat = new StandardMaterial('t80Track', scene);
    trackMat.diffuseColor  = new Color3(0.10, 0.10, 0.10);
    trackMat.specularColor = new Color3(0.04, 0.04, 0.04);

    const eraMat = new StandardMaterial('t80ERA', scene);
    eraMat.diffuseColor  = new Color3(0.24, 0.27, 0.15);
    eraMat.specularColor = new Color3(0.08, 0.09, 0.05);

    // --- Hull ---
    const hullLower = MeshBuilder.CreateBox('t_hullLower', { width: 2.50, height: 0.22, depth: 4.30 }, scene);
    hullLower.position.set(0, 0.11, 0);
    hullLower.material = hullMat;
    hullLower.parent = this.root;

    const hull = MeshBuilder.CreateBox('t_hull', { width: 2.30, height: 0.50, depth: 4.00 }, scene);
    hull.position.set(0, 0.36, 0);
    hull.material = hullMat;
    hull.parent = this.root;

    // Sloped glacis plate — T-80's well-angled front
    const glacis = MeshBuilder.CreateBox('t_glacis', { width: 2.20, height: 0.42, depth: 0.65 }, scene);
    glacis.rotation.x = -Math.PI / 6;
    glacis.position.set(0, 0.54, 2.15);
    glacis.material = hullMat;
    glacis.parent = this.root;

    const trackLeft = MeshBuilder.CreateBox('t_trackLeft', { width: 0.28, height: 0.72, depth: 4.35 }, scene);
    trackLeft.position.set(-1.29, 0.36, 0);
    trackLeft.material = trackMat;
    trackLeft.parent = this.root;

    const trackRight = MeshBuilder.CreateBox('t_trackRight', { width: 0.28, height: 0.72, depth: 4.35 }, scene);
    trackRight.position.set(1.29, 0.36, 0);
    trackRight.material = trackMat;
    trackRight.parent = this.root;

    // Hanging rubber side skirts
    const skirtLeft = MeshBuilder.CreateBox('t_skirtLeft', { width: 0.07, height: 0.28, depth: 3.80 }, scene);
    skirtLeft.position.set(-1.46, 0.14, -0.1);
    skirtLeft.material = trackMat;
    skirtLeft.parent = this.root;

    const skirtRight = MeshBuilder.CreateBox('t_skirtRight', { width: 0.07, height: 0.28, depth: 3.80 }, scene);
    skirtRight.position.set(1.46, 0.14, -0.1);
    skirtRight.material = trackMat;
    skirtRight.parent = this.root;

    // Relikt ERA on hull glacis (4 blocks)
    const eraHullData = [
      [-0.57, 0.64, 2.08], [-0.19, 0.66, 2.10],
      [ 0.19, 0.66, 2.10], [ 0.57, 0.64, 2.08],
    ];
    const eraHullMeshes = eraHullData.map(([ex, ey, ez], i) => {
      const b = MeshBuilder.CreateBox(`t_eraHull${i}`, { width: 0.38, height: 0.12, depth: 0.46 }, scene);
      b.position.set(ex, ey, ez);
      b.material = eraMat;
      b.parent = this.root;
      return b;
    });

    // --- Turret — "flying saucer" profile: wide, very flat oval ---
    const turretPivot = new TransformNode('t_turretPivot', scene);
    turretPivot.position.set(0, 0.50, 0);
    turretPivot.parent = this.root;

    const turret = MeshBuilder.CreateSphere('t_turret', { diameter: 2.4, segments: 8 }, scene);
    turret.scaling.set(1.05, 0.30, 1.18);
    turret.position.set(0, 0.18, 0.1);
    turret.material = turretMat;
    turret.parent = turretPivot;

    // Angled front wedge — T-80 turret face
    const turretFront = MeshBuilder.CreateBox('t_turretFront', { width: 1.55, height: 0.26, depth: 0.48 }, scene);
    turretFront.rotation.x = Math.PI / 10;
    turretFront.position.set(0, 0.22, 0.95);
    turretFront.material = turretMat;
    turretFront.parent = turretPivot;

    // Relikt ERA on turret cheeks (3 blocks per side)
    const eraCheekL = [[-0.88, 0.22, 0.55], [-0.88, 0.22, 0.10], [-0.88, 0.22, -0.35]];
    const eraCheekR = eraCheekL.map(([ex, ey, ez]) => [0.88, ey, ez]);
    const eraTurretMeshes = [...eraCheekL, ...eraCheekR].map(([ex, ey, ez], i) => {
      const b = MeshBuilder.CreateBox(`t_eraTurret${i}`, { width: 0.34, height: 0.09, depth: 0.44 }, scene);
      b.position.set(ex, ey, ez);
      b.material = eraMat;
      b.parent = turretPivot;
      return b;
    });

    // Smoke grenade launchers — 4 per side, 2×2 grid (902B Tucha)
    const smokeAngle = Math.PI / 2 - Math.PI / 8;
    const smokePosR = [
      [0.92, 0.26, -0.20], [0.92, 0.26, 0.10],
      [0.92, 0.38, -0.20], [0.92, 0.38, 0.10],
    ];
    const smokePosL = smokePosR.map(([sx, sy, sz]) => [-sx, sy, sz]);
    const smokeMeshes = [...smokePosR, ...smokePosL].map(([sx, sy, sz], i) => {
      const s = MeshBuilder.CreateCylinder(`t_smoke${i}`, { height: 0.30, diameter: 0.14, tessellation: 6 }, scene);
      s.rotation.x = smokeAngle;
      s.position.set(sx, sy, sz);
      s.material = turretMat;
      s.parent = turretPivot;
      return s;
    });

    // Sosna-U gunner sight bump
    const sight = MeshBuilder.CreateBox('t_sight', { width: 0.22, height: 0.16, depth: 0.38 }, scene);
    sight.position.set(0.48, 0.44, 0.1);
    sight.material = turretMat;
    sight.parent = turretPivot;

    const cupola = MeshBuilder.CreateCylinder('t_cupola', { height: 0.18, diameterBottom: 0.44, diameterTop: 0.34, tessellation: 8 }, scene);
    cupola.position.set(-0.20, 0.43, -0.10);
    cupola.material = turretMat;
    cupola.parent = turretPivot;

    // --- Barrel (125mm 2A46M) with thermal sleeve + bore evacuator ---
    const barrelPivot = new TransformNode('t_barrelPivot', scene);
    barrelPivot.position.set(0, 0.14, 0.92);
    barrelPivot.parent = turretPivot;

    const thermalSleeve = MeshBuilder.CreateCylinder('t_thermalSleeve', { height: 1.8, diameter: 0.24, tessellation: 8 }, scene);
    thermalSleeve.rotation.x = Math.PI / 2;
    thermalSleeve.position.set(0, 0, 0.9);
    thermalSleeve.material = turretMat;
    thermalSleeve.parent = barrelPivot;

    const boreEvac = MeshBuilder.CreateCylinder('t_boreEvac', { height: 0.32, diameter: 0.29, tessellation: 8 }, scene);
    boreEvac.rotation.x = Math.PI / 2;
    boreEvac.position.set(0, 0, 1.75);
    boreEvac.material = turretMat;
    boreEvac.parent = barrelPivot;

    const barrelTip = MeshBuilder.CreateCylinder('t_barrelTip', { height: 2.2, diameter: 0.15, tessellation: 8 }, scene);
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0, 2.9);
    barrelTip.material = turretMat;
    barrelTip.parent = barrelPivot;

    this._meshes = [
      hullLower, hull, glacis, trackLeft, trackRight, skirtLeft, skirtRight,
      ...eraHullMeshes, turret, turretFront, ...eraTurretMeshes,
      ...smokeMeshes, sight, cupola, thermalSleeve, boreEvac, barrelTip,
    ];
  }

  addShadows(shadowGen) {
    for (const mesh of this._meshes) shadowGen.addShadowCaster(mesh);
  }
}
