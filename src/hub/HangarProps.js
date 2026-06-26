import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight, DynamicTexture } from '@babylonjs/core';
import { markSolid, makeTrigger, makeWorldWall } from './hangarColliders.js';

// ── Blob shadows ─────────────────────────────────────────────────────────────
// Soft dark oval decals on the floor under props — fake grounding shadows that
// render on any GPU (real-time shadow maps don't on some machines). One radial
// gradient texture (white centre → black edge) drives the opacity so the blob
// fades softly at the rim.
export function makeBlobMat(s) {
  const tex = new DynamicTexture('blob-tex', { width: 128, height: 128 }, s, false);
  const c = tex.getContext();
  const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0,    'rgb(150,150,150)');
  g.addColorStop(0.55, 'rgb(70,70,70)');
  g.addColorStop(1,    'rgb(0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  tex.update();

  const m = new StandardMaterial('prop-blob', s);
  m.diffuseColor    = new Color3(0, 0, 0);
  m.specularColor   = new Color3(0, 0, 0);
  m.emissiveColor   = new Color3(0, 0, 0);
  m.disableLighting = true;
  m.opacityTexture  = tex;
  m.opacityTexture.getAlphaFromRGB = true;
  m.backFaceCulling = false;
  return m;
}

// Flat oval blob at (x, z), half-extents rx/rz, sitting just above the floor.
export function addBlob(s, mat, x, z, rx, rz, opts = {}) {
  const b = MeshBuilder.CreateGround('blob', { width: rx * 2, height: rz * 2 }, s);
  b.position        = new Vector3(x, opts.y != null ? opts.y : 0.03, z);
  b.material        = mat;
  b.isPickable      = false;
  b.checkCollisions = false;
  if (opts.parent) b.parent = opts.parent;
  return b;
}

// All visual meshes: isPickable=false, checkCollisions=false
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
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

  // Props stay flat-coloured — tiling textures smear on small primitive meshes;
  // their grounding comes from the blob shadows, not surface texture.
  const all = { wood, metal, darkGreen, crate, parchment, darkMetal, redInd, olive, lampGlow,
                plankDark, crateMed, crateLight, screenDark, blob: makeBlobMat(s) };
  // Lift the per-material light cap (StandardMaterial defaults to 4) so accent
  // lamps — map gooseneck, lounge lamp, the bench monitor, kitchen lights — aren't
  // culled when ambient + directional + the two ceiling bulbs already fill the
  // first four slots. Without this they register as emissive geometry but cast
  // no actual light on the props near them.
  for (const m of Object.values(all)) m.maxSimultaneousLights = 8;
  return all;
}

// ── 4a: Mechanic Workbench (left/west wall) ──────────────────────────────────
export function buildWorkbench(s, cx, cz, M, scale = 1.8) {
  const root = new TransformNode('wb-root', s);
  root.position  = new Vector3(cx, 0, cz);
  root.scaling   = new Vector3(scale, scale, scale);
  root.rotation.y = Math.PI / 2;
  const vp = m => { vis(m); m.parent = root; return m; };

  // Cyan screen material for diagnostic monitor
  const screenMat = new StandardMaterial('wb-screen', s);
  screenMat.diffuseColor  = new Color3(0.02, 0.08, 0.08);
  screenMat.emissiveColor = new Color3(0.0, 0.38, 0.34);
  screenMat.specularColor = new Color3(0, 0, 0);

  // ── Table structure ──
  const top = MeshBuilder.CreateBox('wb-top', { width: 2.8, height: 0.12, depth: 1.0 }, s);
  top.position = new Vector3(0, 0.88, 0); top.material = M.wood; vp(top);

  const shelf = MeshBuilder.CreateBox('wb-shelf', { width: 2.6, height: 0.08, depth: 0.9 }, s);
  shelf.position = new Vector3(0, 0.42, 0); shelf.material = M.wood; vp(shelf);

  [[-1.25, -0.4], [-1.25, 0.4], [1.25, -0.4], [1.25, 0.4]].forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`wb-leg${i}`, { width: 0.1, height: 0.88, depth: 0.1 }, s);
    leg.position = new Vector3(dx, 0.44, dz); leg.material = M.metal; vp(leg);
  });

  // ── Vice (left end) ──
  const viceBody = MeshBuilder.CreateBox('wb-vice-body', { width: 0.25, height: 0.28, depth: 0.22 }, s);
  viceBody.position = new Vector3(-1.1, 0.94, -0.3); viceBody.material = M.metal; vp(viceBody);
  const viceJaw = MeshBuilder.CreateBox('wb-vice-jaw', { width: 0.28, height: 0.06, depth: 0.22 }, s);
  viceJaw.position = new Vector3(-1.1, 1.02, -0.3); viceJaw.material = M.metal; vp(viceJaw);

  // ── Blueprint paper on surface (shifted left) ──
  const paper = MeshBuilder.CreateBox('wb-paper', { width: 0.65, height: 0.01, depth: 0.42 }, s);
  paper.position = new Vector3(-0.48, 0.945, 0.06); paper.material = M.parchment; vp(paper);
  const crease1 = MeshBuilder.CreateBox('wb-crease1', { width: 0.65, height: 0.012, depth: 0.01 }, s);
  crease1.position = new Vector3(-0.48, 0.946, 0.06); crease1.material = M.plankDark; vp(crease1);
  const crease2 = MeshBuilder.CreateBox('wb-crease2', { width: 0.01, height: 0.012, depth: 0.42 }, s);
  crease2.position = new Vector3(-0.48, 0.946, 0.06); crease2.material = M.plankDark; vp(crease2);

  // ── Toolbox (shifted left) ──
  const tbox = MeshBuilder.CreateBox('wb-toolbox', { width: 0.50, height: 0.22, depth: 0.38 }, s);
  tbox.position = new Vector3(1.06, 1.06, 0.1); tbox.rotation.y = Math.PI / 2; tbox.material = M.darkGreen; vp(tbox);
  const tboxLid = MeshBuilder.CreateBox('wb-tbox-lid', { width: 0.50, height: 0.04, depth: 0.38 }, s);
  tboxLid.position = new Vector3(1.06, 1.19, 0.1); tboxLid.rotation.y = Math.PI / 2; tboxLid.material = M.darkMetal; vp(tboxLid);

  // ── Diagnostic monitor ──
  const monBase = MeshBuilder.CreateBox('wb-mon-base', { width: 0.28, height: 0.05, depth: 0.20 }, s);
  monBase.position = new Vector3(0.40, 0.945, -0.06); monBase.material = M.darkMetal; vp(monBase);
  const monNeck = MeshBuilder.CreateBox('wb-mon-neck', { width: 0.05, height: 0.20, depth: 0.05 }, s);
  monNeck.position = new Vector3(0.40, 1.07, -0.06); monNeck.material = M.darkMetal; vp(monNeck);
  const monBody = MeshBuilder.CreateBox('wb-mon-body', { width: 0.52, height: 0.36, depth: 0.06 }, s);
  monBody.position = new Vector3(0.40, 1.34, -0.10); monBody.material = M.darkMetal; vp(monBody);
  const monScreen = MeshBuilder.CreateBox('wb-mon-screen', { width: 0.42, height: 0.28, depth: 0.02 }, s);
  monScreen.position = new Vector3(0.40, 1.34, -0.06); monScreen.material = screenMat; vp(monScreen);
  // Cyan glow cast by the monitor — spills onto the bench surface and blueprint.
  // Parented to root so it tracks the bench; range is a world radius (scale-immune).
  const monLight = new PointLight('wb-mon-light', new Vector3(0.40, 1.28, 0.22), s);
  monLight.diffuse   = new Color3(0.18, 0.80, 0.86);
  monLight.specular  = new Color3(0, 0, 0);
  monLight.intensity = 1.75;
  monLight.range     = 3.9;
  monLight.parent    = root;

  // ── Wall-mounted shop light bar above pegboard ──
  // Housing strip bolted to wall just above pegboard
  const lampHousing = MeshBuilder.CreateBox('wb-lamp-housing', { width: 2.2, height: 0.10, depth: 0.18 }, s);
  lampHousing.position = new Vector3(0, 2.74, -0.50); lampHousing.material = M.darkMetal; vp(lampHousing);
  // Glowing tube underneath the housing
  const lampTube = MeshBuilder.CreateBox('wb-lamp-tube', { width: 2.0, height: 0.05, depth: 0.10 }, s);
  lampTube.position = new Vector3(0, 2.67, -0.46); lampTube.material = M.lampGlow; vp(lampTube);

  // ── Pegboard ──
  const pegboard = MeshBuilder.CreateBox('wb-pegboard', { width: 2.4, height: 1.6, depth: 0.04 }, s);
  pegboard.position = new Vector3(0, 1.88, -0.52); pegboard.material = M.wood; vp(pegboard);
  markSolid(pegboard);   // genuinely tall structural prop — local top ≈ 2.68

  // Wrench
  const wrench = MeshBuilder.CreateBox('wb-wrench', { width: 0.08, height: 0.9, depth: 0.03 }, s);
  wrench.position = new Vector3(-0.85, 1.68, -0.54); wrench.material = M.metal; vp(wrench);
  const wrenchHead = MeshBuilder.CreateBox('wb-wrenchh', { width: 0.28, height: 0.14, depth: 0.03 }, s);
  wrenchHead.position = new Vector3(-0.85, 1.24, -0.54); wrenchHead.material = M.metal; vp(wrenchHead);

  // Hammer
  const hammer = MeshBuilder.CreateBox('wb-hammer', { width: 0.07, height: 0.8, depth: 0.03 }, s);
  hammer.position = new Vector3(-0.15, 1.72, -0.54); hammer.material = M.wood; vp(hammer);
  const hammerHead = MeshBuilder.CreateBox('wb-hammerh', { width: 0.32, height: 0.18, depth: 0.07 }, s);
  hammerHead.position = new Vector3(-0.15, 1.28, -0.54); hammerHead.material = M.metal; vp(hammerHead);

  // Screwdriver
  const screwHandle = MeshBuilder.CreateBox('wb-screw-h', { width: 0.14, height: 0.30, depth: 0.05 }, s);
  screwHandle.position = new Vector3(0.55, 1.72, -0.54); screwHandle.material = M.darkGreen; vp(screwHandle);
  const screwShaft = MeshBuilder.CreateBox('wb-screw-s', { width: 0.04, height: 0.40, depth: 0.03 }, s);
  screwShaft.position = new Vector3(0.55, 1.36, -0.54); screwShaft.material = M.metal; vp(screwShaft);

  // Socket wrench
  const socketHandle = MeshBuilder.CreateBox('wb-socket-h', { width: 0.06, height: 0.52, depth: 0.04 }, s);
  socketHandle.position = new Vector3(0.20, 1.65, -0.54); socketHandle.material = M.metal; vp(socketHandle);
  const socketHead = MeshBuilder.CreateBox('wb-socket-hd', { width: 0.18, height: 0.15, depth: 0.07 }, s);
  socketHead.position = new Vector3(0.20, 1.32, -0.54); socketHead.material = M.darkMetal; vp(socketHead);

  const trigger = makeTrigger(s, 'mechanic-trigger', new Vector3(cx, 0.5, cz));
  return { root, trigger };
}

// ── 4b: Quartermaster — warehouse module (rack + cabinet + drums) ─────────────
export function buildQMCrates(s, cx, cz, M, scale = 1.8) {
  const root = new TransformNode('qm-root', s);
  root.position  = new Vector3(cx, 0, cz);
  root.scaling   = new Vector3(scale, scale, scale);
  root.rotation.y = Math.PI / 2;    // face rack toward room (west), back to east wall
  const vp = m => { vis(m); m.parent = root; return m; };

  // ── Heavy-duty pallet rack (center) ───────────────────────────────────────
  [[-1.1, -0.5], [-1.1, 0.5], [1.1, -0.5], [1.1, 0.5]].forEach(([dx, dz], i) => {
    const post = MeshBuilder.CreateBox(`qm-post${i}`, { width: 0.1, height: 3.2, depth: 0.1 }, s);
    post.position = new Vector3(dx, 1.6, dz);
    post.material = M.metal; vp(post);
  });

  [0.65, 1.55, 2.5].forEach((y, i) => {
    const shelf = MeshBuilder.CreateBox(`qm-shelf${i}`, { width: 2.3, height: 0.06, depth: 1.1 }, s);
    shelf.position = new Vector3(0, y, 0);
    shelf.material = M.darkMetal; vp(shelf);
  });

  // top beam
  const topBeam = MeshBuilder.CreateBox('qm-topbeam', { width: 2.3, height: 0.1, depth: 0.08 }, s);
  topBeam.position = new Vector3(0, 3.18, 0.46);
  topBeam.material = M.metal; vp(topBeam);

  // bottom shelf: 2 large crates
  [[-0.55, 0], [0.55, 0]].forEach(([dx, dz], i) => {
    const c = MeshBuilder.CreateBox(`qm-bc${i}`, { width: 0.9, height: 0.5, depth: 0.85 }, s);
    c.position = new Vector3(dx, 0.93, dz);
    c.material = M.crate; vp(c);
  });

  // middle shelf: 3 ammo boxes
  [[-0.65, 0], [0, 0], [0.65, 0]].forEach(([dx, dz], i) => {
    const a = MeshBuilder.CreateBox(`qm-ammo${i}`, { width: 0.55, height: 0.28, depth: 0.42 }, s);
    a.position = new Vector3(dx, 1.83, dz);
    a.material = M.darkGreen; vp(a);
  });

  // top shelf: 2 mixed boxes
  [[-0.5, 0], [0.5, 0]].forEach(([dx, dz], i) => {
    const b = MeshBuilder.CreateBox(`qm-top${i}`, { width: 0.7, height: 0.35, depth: 0.6 }, s);
    b.position = new Vector3(dx, 2.72, dz);
    b.material = i === 0 ? M.crateMed : M.crateLight; vp(b);
  });

  // ── Tall metal locker / cabinet (east side of rack) ───────────────────────
  const cab = MeshBuilder.CreateBox('qm-cab', { width: 0.8, height: 2.3, depth: 0.55 }, s);
  cab.position = new Vector3(1.75, 1.15, 0);
  cab.material = M.darkGreen; vp(cab);
  markSolid(cab);   // genuinely tall structural prop — local top ≈ 2.3

  const seam = MeshBuilder.CreateBox('qm-seam', { width: 0.025, height: 2.28, depth: 0.57 }, s);
  seam.position = new Vector3(1.75, 1.15, 0);
  seam.material = M.darkMetal; vp(seam);

  const handle = MeshBuilder.CreateBox('qm-handle', { width: 0.06, height: 0.2, depth: 0.07 }, s);
  handle.position = new Vector3(1.75 + 0.22, 1.1, -0.3);
  handle.material = M.metal; vp(handle);

  // ── Fuel drums (west side, floor) ─────────────────────────────────────────
  [[-1.75, -0.55], [-1.75, 0.1]].forEach(([dx, dz], i) => {
    const drum = MeshBuilder.CreateCylinder(`qm-drum${i}`, { diameter: 0.44, height: 0.72, tessellation: 12 }, s);
    drum.position = new Vector3(dx, 0.36, dz);
    drum.material = M.darkMetal; vp(drum);

    const band = MeshBuilder.CreateCylinder(`qm-band${i}`, { diameter: 0.45, height: 0.04, tessellation: 12 }, s);
    band.position = new Vector3(dx, 0.52, dz);
    band.material = M.metal; vp(band);
  });

  const trigger = makeTrigger(s, 'qm-trigger', new Vector3(cx, 0.5, cz));
  // Collision seal wall — user-marked in hangar-collision-editor.html, world-space.
  makeWorldWall(s, 'qm-wall-0', { cx: 10.67, cz: -0.46, w: 2.49, d: 7.77 });
  return { root, trigger };
}

// (Tactical Map Table moved to its own module — see src/hub/HangarMapTable.js,
//  rebuilt as the NW-corner bunker planning desk.)

// (Radio / Intel shelf moved to its own module — see src/hub/HangarRadio.js,
//  rebuilt as the NE-corner ham/intercept station with a swappable poster.)
