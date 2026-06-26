import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight } from '@babylonjs/core';
import { makeTrigger, makeWorldWall } from './hangarColliders.js';

// ── helpers (local so this module stays decoupled from HangarProps) ───────────
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}

// Port the mockup's LOCAL frame (west wall x=-3.55, north wall z=+3.55) into the
// hangar's NW corner (west wall x=-12, north wall z=+16). Mirror of HangarLounge
// (SW) flipped on Z. Every coordinate below is authored in mockup space.
const OX = -8.45;   // local x=-3.55 → world -12
const OZ = 12.45;   // local z=+3.55 → world +16

// Up-scale to match the other corner stations (lounge/kitchen use S=1.55). Scale
// ABOUT the wall corner (CAX, CAZ) so the desk back stays on the west wall and
// the nook grows out into the room. Nudge east + south (into the room) so the
// up-scaled props clear the walls.
const S   = 1.55;
const CAX = -11.2;   // near west wall
const CAZ = 15.2;    // near north wall
const NUDGE_X = 0.5;   // east, into room
const NUDGE_Z = -0.6;  // south, into room

// Baked per-group offsets from the layout-editor DUMP (mockup-local frame).
const D = {
  desk:    { x: 0,      y: 0,     z: 0.795 },
  wallmap: { x: 0.028,  y: 0.097, z: 0.679 },
  cork:    { x: -0.013, y: 0,     z: -0.046 },
  shelf:   { x: -0.572, y: 0,     z: 0 },
  crates:  { x: 0,      y: 0,     z: -0.033 },
  stool:   { x: -0.109, y: 0,     z: 0.86 },
  lamp:    { x: -0.097, y: 0,     z: 0.863 },
  radio:   { x: -0.428, y: 0,     z: 0.951 },
  clutter: { x: -0.111, y: 0,     z: 0.815 },
};

/**
 * Build the NW-corner bunker planning desk (the redesigned "tactical map"
 * station — a humble lived-in planning nook, not a war room). Returns the
 * lounge/kitchen handle contract: { collider, root, center }.
 */
export function buildMapTable(s, M) {
  const root = new TransformNode('mt-root', s);
  root.position = new Vector3(CAX + NUDGE_X, 0, CAZ + NUDGE_Z);
  root.scaling  = new Vector3(S, S, S);

  // local-only materials (the rest come from the shared makeMats palette M)
  const lm  = (name, r, g, b, spec = 0.02) => { const m = new StandardMaterial(name, s);
    m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(spec, spec, spec);
    m.maxSimultaneousLights = 8; return m; };
  const lme = (name, r, g, b, er, eg, eb) => { const m = lm(name, r, g, b, 0.05);
    m.emissiveColor = new Color3(er, eg, eb); return m; };
  const woodDark  = lm('mt-wooddark', 0.20, 0.15, 0.07);
  const paper     = lm('mt-paper',    0.82, 0.78, 0.62);
  const cork      = lm('mt-cork',     0.52, 0.40, 0.22);
  const mug       = lm('mt-mug',      0.66, 0.64, 0.58, 0.1);
  const can       = lm('mt-can',      0.40, 0.40, 0.43, 0.1);
  const bookR     = lm('mt-bookr',    0.45, 0.15, 0.12);
  const bookB     = lm('mt-bookb',    0.16, 0.28, 0.42);
  const bookT     = lm('mt-bookt',    0.58, 0.48, 0.28);
  const lampShade = lme('mt-lampshade', 0.13, 0.34, 0.18, 0.05, 0.16, 0.07);
  const lantern   = lme('mt-lantern',   0.90, 0.70, 0.30, 0.50, 0.36, 0.10);
  const redLine   = lme('mt-redline',   0.62, 0.10, 0.10, 0.12, 0.0, 0.0);

  // per-group node carrying that group's baked editor delta (scaled by root)
  const grp = (name) => { const g = new TransformNode('mt-' + name, s); g.parent = root;
    const d = D[name] || { x: 0, y: 0, z: 0 }; g.position = new Vector3(d.x, d.y, d.z); return g; };

  // offset-aware primitives (author in mockup space, shift into the corner frame)
  const box = (parent, name, w, h, d, x, y, z, m) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, s);
    b.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ); b.material = m; vis(b); b.parent = parent; return b; };
  const cyl = (parent, name, dia, h, x, y, z, m, tess = 16, opts = {}) => {
    const c = MeshBuilder.CreateCylinder(name, { diameter: dia, height: h, tessellation: tess, ...opts }, s);
    c.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ); c.material = m; vis(c); c.parent = parent; return c; };
  const blob = (parent, x, z, rx, rz) => {   // grounded shadow (shared blob mat)
    const b = MeshBuilder.CreateGround('mt-blob', { width: rx * 2, height: rz * 2 }, s);
    b.position = new Vector3(x + OX - CAX, 0.02, z + OZ - CAZ); b.material = M.blob; vis(b); b.parent = parent; return b; };

  // ── worn writing desk (drawers face EAST, toward the seated user) ───────────
  const desk = grp('desk');
  box(desk, 'top', 0.98, 0.08, 2.3, -2.95, 0.9, 0.4, woodDark);
  [[-3.32, -0.62], [-2.58, -0.62], [-3.32, 1.42], [-2.58, 1.42]].forEach(([x, z], i) =>
    box(desk, 'leg' + i, 0.1, 0.9, 0.1, x, 0.45, z, M.wood));
  box(desk, 'panel', 0.06, 0.66, 2.1, -3.36, 0.55, 0.4, woodDark);
  // drawer pedestal at the south end; fronts on the EAST face (x ≈ -2.53)
  box(desk, 'drawers', 0.84, 0.7, 0.62, -2.95, 0.5, -0.5, M.wood);
  box(desk, 'drw1', 0.04, 0.24, 0.58, -2.53, 0.66, -0.5, woodDark);
  box(desk, 'drw2', 0.04, 0.24, 0.58, -2.53, 0.38, -0.5, woodDark);
  cyl(desk, 'drw1-h', 0.04, 0.16, -2.50, 0.66, -0.5, M.metal, 8).rotation.x = Math.PI / 2;
  cyl(desk, 'drw2-h', 0.04, 0.16, -2.50, 0.38, -0.5, M.metal, 8).rotation.x = Math.PI / 2;
  blob(desk, -2.95, 0.4, 0.62, 1.25);

  // ── pinned zone-map on the west wall ────────────────────────────────────────
  const wallmap = grp('wallmap');
  box(wallmap, 'map', 0.04, 1.2, 1.7, -3.46, 1.75, 0.5, M.parchment);
  box(wallmap, 'map-frame', 0.03, 1.32, 1.82, -3.49, 1.75, 0.5, M.darkMetal);
  box(wallmap, 'route1', 0.012, 0.04, 0.5, -3.435, 1.8, 0.35, redLine).rotation.z = 0.5;
  box(wallmap, 'route2', 0.012, 0.04, 0.5, -3.435, 1.62, 0.75, redLine).rotation.z = -0.4;
  [[2.1, 0.1], [1.9, 0.7], [1.55, 0.45], [2.0, -0.25]].forEach(([dy, dz], i) =>
    cyl(wallmap, 'pin' + i, 0.05, 0.06, -3.42, dy, 0.5 + dz, M.redInd, 6).rotation.z = Math.PI / 2);

  // ── corkboard of notes on the north wall (photo brought FORWARD, no clip) ────
  const corkG = grp('cork');
  box(corkG, 'cork', 1.3, 1.0, 0.04, -1.7, 1.6, 3.46, cork);
  box(corkG, 'cork-frame', 1.42, 1.12, 0.03, -1.7, 1.6, 3.49, M.wood);
  [[-0.35, 0.2, paper, -0.05], [0.1, 0.25, paper, 0.06], [0.32, -0.15, M.parchment, -0.05], [-0.2, -0.2, paper, 0.06]]
    .forEach(([dx, dy, pm, rz], i) => { box(corkG, 'note' + i, 0.34, 0.4, 0.02, -1.7 + dx, 1.6 + dy, 3.44, pm).rotation.z = rz; });
  box(corkG, 'photo', 0.26, 0.3, 0.02, -1.7, 1.62, 3.40, M.darkMetal);   // forward of the notes

  // ── wall shelf with cans + lantern ──────────────────────────────────────────
  const shelf = grp('shelf');
  box(shelf, 'plank', 1.5, 0.05, 0.32, 0.7, 1.45, 3.36, M.wood);
  box(shelf, 'brkL', 0.04, 0.3, 0.28, 0.0, 1.3, 3.36, M.metal);
  box(shelf, 'brkR', 0.04, 0.3, 0.28, 1.4, 1.3, 3.36, M.metal);
  cyl(shelf, 'can1', 0.18, 0.26, 0.35, 1.6, 3.34, can, 14);
  cyl(shelf, 'can2', 0.18, 0.26, 0.6, 1.6, 3.34, can, 14);
  box(shelf, 'lantern', 0.2, 0.3, 0.2, 1.15, 1.62, 3.34, lantern);
  box(shelf, 'lantern-cap', 0.12, 0.08, 0.12, 1.15, 1.79, 3.34, M.darkMetal);

  // ── supply crates stacked in the corner ─────────────────────────────────────
  const crates = grp('crates');
  box(crates, 'crate1', 0.74, 0.7, 0.74, -3.0, 0.35, 2.95, M.crate);
  box(crates, 'crate1-b1', 0.78, 0.05, 0.05, -3.0, 0.5, 2.6, M.metal);
  box(crates, 'crate1-b2', 0.78, 0.05, 0.05, -3.0, 0.5, 3.3, M.metal);
  box(crates, 'crate2', 0.62, 0.6, 0.62, -3.02, 0.99, 2.92, M.crate);
  box(crates, 'crate2-lid', 0.66, 0.05, 0.66, -3.02, 1.31, 2.92, M.olive);
  box(crates, 'jerry', 0.26, 0.46, 0.42, -2.35, 0.23, 3.05, M.olive);
  cyl(crates, 'jerry-cap', 0.08, 0.06, -2.35, 0.48, 3.05, M.darkMetal, 8);
  blob(crates, -2.95, 2.95, 0.6, 0.7);

  // ── stool at the desk ───────────────────────────────────────────────────────
  const stool = grp('stool');
  cyl(stool, 'seat', 0.38, 0.08, -2.05, 0.5, 0.5, M.wood, 16);
  [[-0.13, -0.13], [0.13, -0.13], [0, 0.16]].forEach(([dx, dz], i) =>
    cyl(stool, 'sleg' + i, 0.05, 0.5, -2.05 + dx, 0.25, 0.5 + dz, M.metal, 6));
  blob(stool, -2.05, 0.5, 0.32, 0.32);

  // ── banker desk lamp (warm pool) ────────────────────────────────────────────
  const lamp = grp('lamp');
  cyl(lamp, 'l-base', 0.22, 0.04, -3.05, 0.96, 1.35, M.darkMetal, 16);
  cyl(lamp, 'l-stem', 0.04, 0.32, -3.05, 1.13, 1.35, M.metal, 8);
  box(lamp, 'l-shade', 0.36, 0.1, 0.18, -3.0, 1.32, 1.35, lampShade).rotation.z = 0.18;
  const ll = new PointLight('mt-lamp-light', new Vector3(-2.9 + OX - CAX, 1.25, 1.3 + OZ - CAZ), s);
  ll.parent = lamp; ll.diffuse = new Color3(1.0, 0.84, 0.5); ll.intensity = 2.6; ll.range = 9;

  // ── little field radio (wider speaker grille on the front face) ─────────────
  const radio = grp('radio');
  box(radio, 'radio', 0.4, 0.24, 0.3, -2.7, 1.07, -0.7, M.darkMetal);
  box(radio, 'radio-speaker', 0.02, 0.15, 0.24, -2.49, 1.05, -0.7, M.screenDark);  // wide grille, east face
  cyl(radio, 'radio-dial1', 0.05, 0.03, -2.49, 1.16, -0.79, M.metal, 10).rotation.z = Math.PI / 2;
  cyl(radio, 'radio-dial2', 0.05, 0.03, -2.49, 1.16, -0.61, M.metal, 10).rotation.z = Math.PI / 2;
  cyl(radio, 'radio-ind', 0.035, 0.03, -2.49, 0.97, -0.79, M.redInd, 8).rotation.z = Math.PI / 2;
  cyl(radio, 'radio-ant', 0.02, 0.5, -2.55, 1.35, -0.85, M.metal, 6).rotation.z = -0.3;
  // The radio is a clickable interactable (room-music jukebox) — make its parts
  // pickable so HangarScene can hook clicks (the rest of the desk stays un-pickable).
  radio.getChildMeshes().forEach(m => { m.isPickable = true; });

  // ── desk clutter (papers, clipboard, books, mug, pencils, notebook) ─────────
  const clutter = grp('clutter');
  const T = 0.95;
  cyl(clutter, 'roll1', 0.06, 0.5, -2.85, T + 0.03, -0.05, M.parchment, 8).rotation.x = Math.PI / 2;
  cyl(clutter, 'roll2', 0.06, 0.46, -2.78, T + 0.03, 0.08, paper, 8).rotation.x = Math.PI / 2;
  box(clutter, 'clipboard', 0.32, 0.02, 0.44, -2.82, T, 0.45, paper).rotation.y = 0.2;
  box(clutter, 'clip', 0.1, 0.02, 0.06, -2.82, T + 0.02, 0.66, M.metal);
  box(clutter, 'notebook', 0.28, 0.04, 0.36, -3.0, T, 0.95, M.olive).rotation.y = -0.15;
  cyl(clutter, 'mug', 0.14, 0.16, -2.62, T + 0.05, 1.05, mug, 12);
  cyl(clutter, 'pencils', 0.1, 0.16, -3.02, T + 0.05, 1.18, M.darkMetal, 8);
  [[-0.06, 0.18], [0.0, 0.2], [0.05, 0.16]].forEach(([dx, h], i) =>
    cyl(clutter, 'pencil' + i, 0.015, 0.22, -3.02 + dx, T + h, 1.18, bookT, 6));
  box(clutter, 'book1', 0.3, 0.06, 0.22, -3.05, T + 0.0, 0.0, bookR).rotation.y = 0.1;
  box(clutter, 'book2', 0.28, 0.06, 0.2, -3.04, T + 0.06, 0.02, bookB);
  box(clutter, 'book3', 0.26, 0.05, 0.2, -3.05, T + 0.115, -0.01, bookT).rotation.y = -0.08;

  // ── trigger + center (interaction point at the seat, east of the desk) ──────
  const sx = (xc) => root.position.x + S * (xc + OX - CAX);
  const sz = (zc) => root.position.z + S * (zc + OZ - CAZ);
  const cx = sx(-2.159), cz = sz(1.36);   // baked stool position
  const trigger = makeTrigger(s, 'map-trigger', new Vector3(cx, 0.5, cz));

  // Collision seal walls — user-marked in hangar-collision-editor.html, world-space.
  [
    { cx: -11.09, cz: 13.12, w: 1.93, d: 5.50 },
    { cx: -8.42,  cz: 15.66, w: 7.15, d: 0.38 },
  ].forEach((b, i) => makeWorldWall(s, `map-wall-${i}`, b));

  return { trigger, root, center: new Vector3(cx, 0.5, cz), radio };
}
