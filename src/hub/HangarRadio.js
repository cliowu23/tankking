import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight, DynamicTexture } from '@babylonjs/core';
import { drawPoster } from './posterArt.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function vis(mesh) { mesh.isPickable = false; mesh.checkCollisions = false; return mesh; }
function makeCollider(name, size, pos, s) {
  const m = MeshBuilder.CreateBox(name, size, s);
  m.position = pos.clone(); m.isVisible = false; m.checkCollisions = true; m.isPickable = false; return m;
}

// Port the mockup's LOCAL frame (east wall x=+3.55, north wall z=+3.55) into the
// hangar's NE corner (east x=+12, north z=+16). Same OX as the kitchen, same OZ
// as the planning desk — it's the mirror-twin of the NW map nook.
const OX = 8.45;   // local x=3.55 → world 12
const OZ = 12.45;  // local z=3.55 → world 16
const S   = 1.55;
const CAX = 11.2;   // scale anchor near east wall
const CAZ = 15.2;   // scale anchor near north wall
const NUDGE_X = -0.5;  // west, into room
const NUDGE_Z = -0.6;  // south, into room

// Baked per-group offsets from the layout-editor DUMP (mockup-local frame).
const D = {
  desk:        { x: 0.004, y: 0,    z: 0 },
  transceiver: { x: 0,     y: 0,    z: 0.058 },
  receiver:    { x: -0.38, y: 0,    z: 0 },
  reel:        { x: 0.068, y: 0,    z: 0 },
  terminal:    { x: 0,     y: 0,    z: 0.643 },
  mic:         { x: 0.168, y: 0,    z: 0.055 },
  morse:       { x: 0,     y: 0,    z: 0.076 },
  cork:        { x: 0,     y: 0.08, z: -1.204 },
  lamp:        { x: 0.227, y: 0,    z: 0 },
  clutter:     { x: -0.119, y: 0,   z: 0.09 },
  rug:         { x: -0.018, y: 0,   z: 0.064 },
};

const POSTER_W = 540, POSTER_H = 756;

/**
 * Build the NE-corner radio / intercept station (the quest-giver comms hub).
 * Returns the lounge/kitchen handle contract plus poster controls:
 *   { collider, root, center, setPoster(design), posterDesign }
 */
export function buildRadio(s, M) {
  const root = new TransformNode('radio-root', s);
  root.position = new Vector3(CAX + NUDGE_X, 0, CAZ + NUDGE_Z);
  root.scaling  = new Vector3(S, S, S);

  // local-only materials (rest come from the shared makeMats palette M)
  const lm  = (n, r, g, b, spec = 0.02) => { const m = new StandardMaterial(n, s);
    m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(spec, spec, spec); m.maxSimultaneousLights = 8; return m; };
  const lme = (n, r, g, b, er, eg, eb) => { const m = lm(n, r, g, b, 0.05); m.emissiveColor = new Color3(er, eg, eb); return m; };
  const panel    = lm('rd-panel', 0.24, 0.24, 0.27, 0.1);
  const dial     = lm('rd-dial', 0.5, 0.5, 0.52, 0.2);
  const paper    = lm('rd-paper', 0.82, 0.78, 0.62);
  const cork     = lm('rd-cork', 0.52, 0.40, 0.22);
  const mugM     = lm('rd-mug', 0.66, 0.64, 0.58, 0.1);
  const chairUph = lm('rd-chair', 0.34, 0.18, 0.14);
  const blanket  = lm('rd-blanket', 0.46, 0.40, 0.22);
  const rugMat   = lm('rd-rug', 0.30, 0.16, 0.13);
  const tape     = lm('rd-tape', 0.30, 0.22, 0.16);
  const woodDark = lm('rd-wooddark', 0.20, 0.15, 0.07);
  const vuM      = lme('rd-vu', 0.10, 0.40, 0.18, 0.06, 0.42, 0.14);
  const amberM   = lme('rd-amber', 0.55, 0.40, 0.10, 0.55, 0.32, 0.05);

  // per-group node carrying the baked editor delta (scaled by root)
  const grp = (name) => { const g = new TransformNode('rd-' + name, s); g.parent = root;
    const d = D[name] || { x: 0, y: 0, z: 0 }; g.position = new Vector3(d.x, d.y, d.z); return g; };
  const box = (parent, name, w, h, d, x, y, z, m) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, s);
    b.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ); b.material = m; vis(b); b.parent = parent; return b; };
  const cyl = (parent, name, dia, h, x, y, z, m, tess = 16, opts = {}) => {
    const c = MeshBuilder.CreateCylinder(name, { diameter: dia, height: h, tessellation: tess, ...opts }, s);
    c.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ); c.material = m; vis(c); c.parent = parent; return c; };
  const blob = (parent, x, z, rx, rz) => {
    const b = MeshBuilder.CreateGround('rd-blob', { width: rx * 2, height: rz * 2 }, s);
    b.position = new Vector3(x + OX - CAX, 0.02, z + OZ - CAZ); b.material = M.blob; vis(b); b.parent = parent; return b; };

  // ── poster texture (north wall) — painted, swappable ────────────────────────
  const pdt = new DynamicTexture('radio-poster', { width: POSTER_W, height: POSTER_H }, s, false); pdt.hasAlpha = false;
  const pmat = new StandardMaterial('radio-poster-mat', s);
  pmat.diffuseTexture = pdt; pmat.specularColor = new Color3(0, 0, 0);
  pmat.emissiveColor = new Color3(0.45, 0.45, 0.45); pmat.backFaceCulling = false; pmat.maxSimultaneousLights = 8;
  let posterDesign = 'wanted', customPhoto = null;
  const setPoster = (design) => { posterDesign = design;
    drawPoster(pdt.getContext(), design, POSTER_W, POSTER_H, design === 'photo' ? customPhoto : null); pdt.update(); };
  const setCustomPhoto = (img) => { customPhoto = img; setPoster('photo'); };  // upload-your-own
  setPoster('wanted');

  const PI2 = Math.PI / 2;

  // ── L-desk ──────────────────────────────────────────────────────────────────
  const desk = grp('desk');
  box(desk, 'top-n', 3.7, 0.08, 1.15, 1.6, 0.9, 2.9, woodDark);
  box(desk, 'top-e', 1.15, 0.08, 3.55, 2.9, 0.9, 1.675, woodDark);
  box(desk, 'panel-n', 3.7, 0.74, 0.06, 1.6, 0.5, 3.41, woodDark);
  box(desk, 'panel-e', 0.06, 0.74, 3.55, 3.41, 0.5, 1.675, woodDark);
  [[-0.2, 2.35], [2.35, 2.35], [2.35, -0.05]].forEach(([x, z], i) => box(desk, 'leg' + i, 0.1, 0.9, 0.1, x, 0.45, z, M.wood));
  blob(desk, 1.7, 2.0, 1.9, 1.6);

  // ── transceiver ─────────────────────────────────────────────────────────────
  const tx = grp('transceiver');
  box(tx, 'tx-body', 0.82, 0.42, 0.5, 1.25, 1.13, 3.02, panel);
  box(tx, 'tx-face', 0.74, 0.34, 0.02, 1.25, 1.13, 2.76, M.screenDark);
  box(tx, 'tx-freq', 0.32, 0.09, 0.02, 1.18, 1.24, 2.75, amberM);
  box(tx, 'tx-vu', 0.12, 0.1, 0.02, 1.46, 1.24, 2.75, vuM);
  [1.02, 1.16, 1.30, 1.44].forEach((x, i) => cyl(tx, 'tx-knob' + i, 0.06, 0.04, x, 1.04, 2.75, dial, 12).rotation.x = PI2);
  cyl(tx, 'tx-ind', 0.04, 0.03, 1.55, 1.04, 2.75, M.redInd, 8).rotation.x = PI2;

  // ── stacked receiver ──────────────────────────────────────────────────────
  const rx = grp('receiver');
  box(rx, 'rx-body', 0.6, 0.34, 0.45, 2.5, 1.09, 3.05, panel);
  box(rx, 'rx-face', 0.54, 0.26, 0.02, 2.5, 1.09, 2.83, M.screenDark);
  box(rx, 'rx-scope', 0.16, 0.16, 0.02, 2.42, 1.12, 2.82, vuM);
  [2.62, 2.72].forEach((x, i) => cyl(rx, 'rx-knob' + i, 0.05, 0.04, x, 1.04, 2.82, dial, 12).rotation.x = PI2);

  // ── reel-to-reel intercept deck ─────────────────────────────────────────────
  const reel = grp('reel');
  box(reel, 'reel-body', 0.82, 0.34, 0.42, 0.25, 1.09, 3.05, M.darkMetal);
  box(reel, 'reel-face', 0.76, 0.28, 0.02, 0.25, 1.12, 2.84, panel);
  [[0.07, 1.16], [0.45, 1.16]].forEach(([x, y], i) => {
    cyl(reel, 'reel' + i, 0.26, 0.04, x, y, 2.83, tape, 18).rotation.x = PI2;
    cyl(reel, 'reelhub' + i, 0.07, 0.05, x, y, 2.82, dial, 10).rotation.x = PI2; });
  box(reel, 'reel-vu', 0.1, 0.08, 0.02, 0.25, 1.0, 2.83, vuM);

  // ── CRT terminal ──────────────────────────────────────────────────────────
  const term = grp('terminal');
  box(term, 'term-body', 0.46, 0.4, 0.46, 3.0, 1.16, 1.25, M.darkMetal);
  box(term, 'term-bezel', 0.04, 0.34, 0.4, 2.77, 1.18, 1.25, panel);
  box(term, 'term-screen', 0.02, 0.26, 0.32, 2.75, 1.18, 1.25, vuM);
  box(term, 'term-stand', 0.3, 0.06, 0.3, 3.0, 0.95, 1.25, M.darkMetal);
  box(term, 'term-kbd', 0.34, 0.04, 0.16, 2.62, 0.94, 1.25, panel);

  // ── desk mic (short) ────────────────────────────────────────────────────────
  const mic = grp('mic');
  cyl(mic, 'mic-base', 0.22, 0.04, 1.85, 0.96, 2.45, M.darkMetal, 16);
  cyl(mic, 'mic-rod', 0.03, 0.22, 1.85, 1.08, 2.45, M.metal, 8);
  cyl(mic, 'mic-head', 0.1, 0.18, 1.83, 1.22, 2.4, M.darkMetal, 12).rotation.x = -0.5;
  box(mic, 'mic-grille', 0.08, 0.1, 0.01, 1.83, 1.27, 2.32, M.screenDark).rotation.x = -0.5;

  // ── Morse key ───────────────────────────────────────────────────────────────
  const morse = grp('morse');
  box(morse, 'morse-base', 0.2, 0.05, 0.26, 0.45, 0.965, 2.5, M.darkMetal);
  box(morse, 'morse-lever', 0.04, 0.03, 0.2, 0.45, 1.02, 2.46, dial).rotation.z = 0.12;
  cyl(morse, 'morse-knob', 0.07, 0.04, 0.45, 1.05, 2.38, M.darkMetal, 12);

  // ── intercept corkboard (east wall) ─────────────────────────────────────────
  const corkG = grp('cork');
  box(corkG, 'cork-frame', 0.03, 1.22, 1.52, 3.45, 1.75, 1.95, M.wood);
  box(corkG, 'cork-board', 0.04, 1.1, 1.4, 3.43, 1.75, 1.95, cork);
  [[0.22, 0.4, paper, -0.06], [0.28, -0.14, paper, 0.05], [-0.16, 0.34, M.parchment, -0.05], [-0.24, -0.28, paper, 0.06]]
    .forEach(([dy, dz, pm, rxn], i) => box(corkG, 'cork-note' + i, 0.02, 0.32, 0.28, 3.40, 1.75 + dy, 1.95 + dz, pm).rotation.x = rxn);
  box(corkG, 'cork-photo', 0.02, 0.32, 0.28, 3.37, 1.77, 1.95, M.darkMetal);

  // ── poster (north wall, faces -z toward the operator) ───────────────────────
  const poster = grp('poster');
  box(poster, 'poster-frame', 0.97, 1.27, 0.05, 1.45, 2.05, 3.47, woodDark);
  const art = MeshBuilder.CreatePlane('radio-poster-art', { width: 0.85, height: 1.15 }, s);
  art.position = new Vector3(1.45 + OX - CAX, 2.05, 3.44 + OZ - CAZ);
  art.material = pmat; art.checkCollisions = false; art.isPickable = true;  // pickable for the future hover easter-egg
  art.parent = poster;

  // ── comfy swivel chair (faces +z) ───────────────────────────────────────────
  const chair = grp('chair'); const CX = 1.45, CZ = 1.5;
  cyl(chair, 'ch-hub', 0.16, 0.1, CX, 0.12, CZ, M.darkMetal, 16);
  [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28], [0.2, 0.2]].forEach(([dx, dz], i) => {
    box(chair, 'ch-leg' + i, 0.34, 0.05, 0.08, CX + dx * 0.5, 0.07, CZ + dz * 0.5, M.darkMetal).rotation.y = Math.atan2(dz, dx);
    cyl(chair, 'ch-caster' + i, 0.07, 0.05, CX + dx, 0.05, CZ + dz, M.metal, 8); });
  cyl(chair, 'ch-gas', 0.08, 0.45, CX, 0.36, CZ, M.metal, 10);
  box(chair, 'ch-seat', 0.54, 0.14, 0.52, CX, 0.63, CZ, chairUph);
  box(chair, 'ch-cushion', 0.5, 0.06, 0.48, CX, 0.72, CZ, chairUph);
  box(chair, 'ch-back', 0.54, 0.66, 0.13, CX, 1.0, CZ - 0.25, chairUph).rotation.x = -0.12;
  box(chair, 'ch-armL', 0.1, 0.1, 0.42, CX - 0.3, 0.82, CZ, M.darkMetal);
  box(chair, 'ch-armR', 0.1, 0.1, 0.42, CX + 0.3, 0.82, CZ, M.darkMetal);
  box(chair, 'ch-blanket', 0.5, 0.34, 0.06, CX, 1.02, CZ - 0.31, blanket).rotation.x = -0.12;

  // ── banker desk lamp (warm pool) ────────────────────────────────────────────
  const lamp = grp('lamp');
  cyl(lamp, 'l-base', 0.22, 0.04, 2.85, 0.96, 2.7, M.darkMetal, 16);
  cyl(lamp, 'l-stem', 0.04, 0.34, 2.85, 1.14, 2.7, M.metal, 8);
  box(lamp, 'l-shade', 0.34, 0.1, 0.18, 2.78, 1.32, 2.7, M.lampGlow).rotation.z = -0.2;
  const ll = new PointLight('radio-lamp-light', new Vector3(2.6 + OX - CAX, 1.25, 2.5 + OZ - CAZ), s);
  ll.parent = lamp; ll.diffuse = new Color3(1.0, 0.84, 0.5); ll.intensity = 2.8; ll.range = 10;

  // ── desk clutter ────────────────────────────────────────────────────────────
  const clutter = grp('clutter');
  box(clutter, 'logbook', 0.4, 0.04, 0.3, 1.7, 0.96, 2.45, paper).rotation.y = 0.1;
  box(clutter, 'logbook-spine', 0.4, 0.05, 0.04, 1.7, 0.97, 2.6, M.olive).rotation.y = 0.1;
  cyl(clutter, 'mug', 0.14, 0.16, 2.5, 1.02, 2.45, mugM, 12);
  cyl(clutter, 'pencils', 0.09, 0.14, 2.65, 1.01, 2.4, M.darkMetal, 8);

  // ── rug under the chair ─────────────────────────────────────────────────────
  const rugN = grp('rug');
  const r = MeshBuilder.CreateGround('radio-rug', { width: 2.0, height: 2.0 }, s);
  r.position = new Vector3(1.5 + OX - CAX, 0.015, 1.4 + OZ - CAZ); r.material = rugMat; vis(r); r.parent = rugN;

  // ── collider + center (interaction point at the seat, room-facing side) ─────
  const sx = (xc) => root.position.x + S * (xc + OX - CAX);
  const sz = (zc) => root.position.z + S * (zc + OZ - CAZ);
  const cx = sx(1.45), cz = sz(1.5);
  const collider = makeCollider('station-radio', { width: 3.8, height: 1.8, depth: 3.8 }, new Vector3(cx, 0.9, cz), s);

  return { collider, root, center: new Vector3(cx, 0.5, cz), setPoster, setCustomPhoto, posterMesh: art, get posterDesign() { return posterDesign; } };
}
