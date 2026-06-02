import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';

// All visual meshes: isPickable=false, checkCollisions=false
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}

// Invisible collision box for proximity detection
function makeCollider(name, size, pos, s) {
  const m = MeshBuilder.CreateBox(name, size, s);
  m.position        = pos.clone();
  m.isVisible       = false;
  m.checkCollisions = true;
  m.isPickable      = false;
  return m;
}

// Shared material factory — creates fresh materials per scene
export function makeMats(s) {
  const wood = new StandardMaterial('prop-wood', s);
  wood.diffuseColor  = new Color3(0.30, 0.22, 0.10);
  wood.specularColor = new Color3(0.04, 0.04, 0.04);

  const metal = new StandardMaterial('prop-metal', s);
  metal.diffuseColor  = new Color3(0.20, 0.18, 0.16);
  metal.specularColor = new Color3(0.06, 0.06, 0.06);

  const darkGreen = new StandardMaterial('prop-green', s);
  darkGreen.diffuseColor  = new Color3(0.18, 0.26, 0.14);
  darkGreen.specularColor = new Color3(0.02, 0.02, 0.02);

  const crate = new StandardMaterial('prop-crate', s);
  crate.diffuseColor  = new Color3(0.30, 0.24, 0.12);
  crate.specularColor = new Color3(0.02, 0.02, 0.02);

  const parchment = new StandardMaterial('prop-parchment', s);
  parchment.diffuseColor  = new Color3(0.78, 0.70, 0.40);
  parchment.specularColor = new Color3(0.02, 0.02, 0.02);

  const darkMetal = new StandardMaterial('prop-dark-metal', s);
  darkMetal.diffuseColor  = new Color3(0.15, 0.14, 0.13);
  darkMetal.specularColor = new Color3(0.08, 0.08, 0.08);

  const redInd = new StandardMaterial('prop-red', s);
  redInd.diffuseColor  = new Color3(0.8, 0.0, 0.0);
  redInd.emissiveColor = new Color3(0.5, 0.0, 0.0);

  const olive = new StandardMaterial('prop-olive', s);
  olive.diffuseColor  = new Color3(0.22, 0.26, 0.14);
  olive.specularColor = new Color3(0.02, 0.02, 0.02);

  const lampGlow = new StandardMaterial('prop-lamp', s);
  lampGlow.diffuseColor  = new Color3(0.9, 0.7, 0.2);
  lampGlow.emissiveColor = new Color3(0.5, 0.38, 0.06);

  const plankDark = new StandardMaterial('prop-plank-dark', s);
  plankDark.diffuseColor = new Color3(0.18, 0.14, 0.06);

  const crateMed = new StandardMaterial('prop-crate-med', s);
  crateMed.diffuseColor = new Color3(0.26, 0.20, 0.10);

  const crateLight = new StandardMaterial('prop-crate-light', s);
  crateLight.diffuseColor = new Color3(0.28, 0.22, 0.10);

  const screenDark = new StandardMaterial('prop-screen-dark', s);
  screenDark.diffuseColor = new Color3(0.04, 0.06, 0.05);

  return { wood, metal, darkGreen, crate, parchment, darkMetal, redInd, olive, lampGlow,
           plankDark, crateMed, crateLight, screenDark };
}

// ── 4a: Mechanic Workbench (left/west wall, x≈-14, z=0) ─────────────────────
export function buildWorkbench(s, cx, cz, M) {

  const top = MeshBuilder.CreateBox('wb-top', { width: 2.8, height: 0.12, depth: 1.0 }, s);
  top.position = new Vector3(cx, 0.88, cz);
  top.material = M.wood; vis(top);

  const shelf = MeshBuilder.CreateBox('wb-shelf', { width: 2.6, height: 0.08, depth: 0.9 }, s);
  shelf.position = new Vector3(cx, 0.42, cz);
  shelf.material = M.wood; vis(shelf);

  [[-1.25, -0.4], [-1.25, 0.4], [1.25, -0.4], [1.25, 0.4]].forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`wb-leg${i}`, { width: 0.1, height: 0.88, depth: 0.1 }, s);
    leg.position = new Vector3(cx + dx, 0.44, cz + dz);
    leg.material = M.metal; vis(leg);
  });

  const viceBody = MeshBuilder.CreateBox('wb-vice-body', { width: 0.25, height: 0.28, depth: 0.22 }, s);
  viceBody.position = new Vector3(cx - 1.1, 0.94, cz - 0.3);
  viceBody.material = M.metal; vis(viceBody);

  const viceJaw = MeshBuilder.CreateBox('wb-vice-jaw', { width: 0.28, height: 0.06, depth: 0.22 }, s);
  viceJaw.position = new Vector3(cx - 1.1, 1.02, cz - 0.3);
  viceJaw.material = M.metal; vis(viceJaw);

  const tbox = MeshBuilder.CreateBox('wb-toolbox', { width: 0.55, height: 0.25, depth: 0.40 }, s);
  tbox.position = new Vector3(cx + 0.6, 1.065, cz + 0.1);
  tbox.material = M.darkGreen; vis(tbox);

  const pegboard = MeshBuilder.CreateBox('wb-pegboard', { width: 2.4, height: 1.6, depth: 0.04 }, s);
  pegboard.position = new Vector3(cx, 1.88, cz - 0.52);
  pegboard.material = M.wood; vis(pegboard);

  const wrench = MeshBuilder.CreateBox('wb-wrench', { width: 0.08, height: 0.9, depth: 0.03 }, s);
  wrench.position = new Vector3(cx - 0.7, 1.68, cz - 0.54);
  wrench.material = M.metal; vis(wrench);

  const wrenchHead = MeshBuilder.CreateBox('wb-wrenchh', { width: 0.28, height: 0.14, depth: 0.03 }, s);
  wrenchHead.position = new Vector3(cx - 0.7, 1.24, cz - 0.54);
  wrenchHead.material = M.metal; vis(wrenchHead);

  const hammer = MeshBuilder.CreateBox('wb-hammer', { width: 0.07, height: 0.8, depth: 0.03 }, s);
  hammer.position = new Vector3(cx + 0.2, 1.72, cz - 0.54);
  hammer.material = M.wood; vis(hammer);

  const hammerHead = MeshBuilder.CreateBox('wb-hammerh', { width: 0.32, height: 0.18, depth: 0.07 }, s);
  hammerHead.position = new Vector3(cx + 0.2, 1.28, cz - 0.54);
  hammerHead.material = M.metal; vis(hammerHead);

  return makeCollider('station-mechanic', { width: 1.4, height: 1.0, depth: 3.5 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4b: Quartermaster Crates (right/east wall, x≈14, z=0) ───────────────────
export function buildQMCrates(s, cx, cz, M) {

  const crate1 = MeshBuilder.CreateBox('qm-crate1', { width: 2.4, height: 0.9, depth: 1.8 }, s);
  crate1.position = new Vector3(cx, 0.45, cz);
  crate1.material = M.crate; vis(crate1);

  const plank1 = MeshBuilder.CreateBox('qm-plank1', { width: 2.4, height: 0.03, depth: 0.06 }, s);
  plank1.position = new Vector3(cx, 0.905, cz);
  plank1.material = M.plankDark; vis(plank1);
  const plank2 = MeshBuilder.CreateBox('qm-plank2', { width: 0.06, height: 0.03, depth: 1.8 }, s);
  plank2.position = new Vector3(cx, 0.905, cz);
  plank2.material = M.plankDark; vis(plank2);

  const crate2 = MeshBuilder.CreateBox('qm-crate2', { width: 1.8, height: 0.75, depth: 1.4 }, s);
  crate2.position = new Vector3(cx + 0.2, 1.27, cz - 0.1);
  crate2.material = M.crateMed; vis(crate2);

  const crate3 = MeshBuilder.CreateBox('qm-crate3', { width: 1.0, height: 0.6, depth: 0.9 }, s);
  crate3.position = new Vector3(cx - 0.3, 1.95, cz + 0.2);
  crate3.material = M.crateLight; vis(crate3);

  const bracketH = MeshBuilder.CreateBox('qm-brack-h', { width: 1.8, height: 0.06, depth: 0.5 }, s);
  bracketH.position = new Vector3(cx, 2.4, cz);
  bracketH.material = M.metal; vis(bracketH);

  const bracketV = MeshBuilder.CreateBox('qm-brack-v', { width: 1.8, height: 0.4, depth: 0.06 }, s);
  bracketV.position = new Vector3(cx, 2.2, cz - 0.22);
  bracketV.material = M.metal; vis(bracketV);

  [[-0.55, 0], [0.0, 0.02], [0.58, -0.02]].forEach(([dx, dz], i) => {
    const abox = MeshBuilder.CreateBox(`qm-ammo${i}`, { width: 0.55, height: 0.28, depth: 0.42 }, s);
    abox.position = new Vector3(cx + dx, 2.57, cz + dz);
    abox.material = M.darkGreen; vis(abox);
  });

  return makeCollider('station-qm', { width: 1.4, height: 1.0, depth: 3.5 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4c: Tactical Map Table (north-left corner, x≈-11, z≈17.5) ───────────────
export function buildMapTable(s, cx, cz, M) {

  const tabletop = MeshBuilder.CreateBox('map-top', { width: 2.2, height: 0.08, depth: 1.4 }, s);
  tabletop.position = new Vector3(cx, 0.88, cz);
  tabletop.material = M.wood; vis(tabletop);

  [[-0.98, -0.6], [-0.98, 0.6], [0.98, -0.6], [0.98, 0.6]].forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`map-leg${i}`, { width: 0.1, height: 0.88, depth: 0.1 }, s);
    leg.position = new Vector3(cx + dx, 0.44, cz + dz);
    leg.material = M.metal; vis(leg);
  });

  const mapMesh = MeshBuilder.CreateBox('map-map', { width: 2.0, height: 0.015, depth: 1.25 }, s);
  mapMesh.position = new Vector3(cx, 0.947, cz);
  mapMesh.material = M.parchment; vis(mapMesh);

  const radio = MeshBuilder.CreateBox('map-radio', { width: 0.45, height: 0.32, depth: 0.35 }, s);
  radio.position = new Vector3(cx + 0.8, 1.04, cz - 0.45);
  radio.material = M.darkMetal; vis(radio);

  const screen = MeshBuilder.CreateBox('map-screen', { width: 0.26, height: 0.18, depth: 0.02 }, s);
  screen.position = new Vector3(cx + 0.8, 1.12, cz - 0.63);
  screen.material = M.screenDark; vis(screen);

  const ind = MeshBuilder.CreateCylinder('map-ind', { diameter: 0.06, height: 0.03, tessellation: 8 }, s);
  ind.position = new Vector3(cx + 0.95, 1.22, cz - 0.63);
  ind.rotation.x = Math.PI / 2;
  ind.material = M.redInd; vis(ind);

  const pole = MeshBuilder.CreateCylinder('map-pole', { diameter: 0.05, height: 1.8, tessellation: 6 }, s);
  pole.position = new Vector3(cx - 0.8, 1.78, cz - 0.4);
  pole.material = M.metal; vis(pole);

  const shade = MeshBuilder.CreateCylinder('map-shade', { diameterTop: 0.28, diameterBottom: 0.06, height: 0.18, tessellation: 10 }, s);
  shade.position = new Vector3(cx - 0.8, 2.72, cz - 0.4);
  shade.material = M.lampGlow; vis(shade);

  return makeCollider('station-map', { width: 2.5, height: 1.0, depth: 1.2 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4d: Radio / Intel Shelf (north-right corner, x≈11, z≈17.5) ──────────────
export function buildRadioShelf(s, cx, cz, M) {

  [-0.85, 0.85].forEach((dx, i) => {
    const post = MeshBuilder.CreateBox(`rs-post${i}`, { width: 0.07, height: 2.4, depth: 0.07 }, s);
    post.position = new Vector3(cx + dx, 1.2, cz - 0.22);
    post.material = M.metal; vis(post);
  });

  [0.6, 1.6].forEach((y, i) => {
    const board = MeshBuilder.CreateBox(`rs-board${i}`, { width: 1.8, height: 0.06, depth: 0.52 }, s);
    board.position = new Vector3(cx, y, cz);
    board.material = M.metal; vis(board);
  });

  [[0, 0.18, 0.40], [0, 0.18, 0.36], [0, 0.14, 0.32]].forEach(([dx, h, w], i) => {
    const unit = MeshBuilder.CreateBox(`rs-unit${i}`, { width: w, height: h, depth: 0.38 }, s);
    unit.position = new Vector3(cx + dx, 1.69 + i * 0.18, cz + 0.02);
    unit.material = M.darkMetal; vis(unit);

    const det = MeshBuilder.CreateBox(`rs-det${i}`, { width: w * 0.55, height: 0.08, depth: 0.02 }, s);
    det.position = new Vector3(cx + dx, 1.69 + i * 0.18 + 0.02, cz - 0.18);
    det.material = M.screenDark; vis(det);
  });

  const ri = MeshBuilder.CreateCylinder('rs-ind', { diameter: 0.05, height: 0.03, tessellation: 6 }, s);
  ri.position = new Vector3(cx + 0.38, 2.07, cz - 0.18);
  ri.rotation.x = Math.PI / 2;
  ri.material = M.redInd; vis(ri);

  [-0.5, 0, 0.5].forEach((dx, i) => {
    const can = MeshBuilder.CreateCylinder(`rs-can${i}`, { diameter: 0.22, height: 0.38, tessellation: 10 }, s);
    can.position = new Vector3(cx + dx, 0.82, cz + 0.02);
    can.material = M.olive; vis(can);
  });

  return makeCollider('station-radio', { width: 2.5, height: 1.0, depth: 1.2 }, new Vector3(cx, 0.5, cz), s);
}
