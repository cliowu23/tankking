import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight } from '@babylonjs/core';
import { markSolid, makeSeatPad, makeTrigger } from './hangarColliders.js';

// ── helpers (kept local so this module stays decoupled from HangarProps) ──────
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}

// Port the SE-corner kitchen mockup into the hangar. The mockup is authored in a
// LOCAL frame (east wall x≈+3.55, south wall z≈-3.55); shift it by (OX, OZ) so it
// lands in the hangar's SE corner (east wall x=+12, south wall z=-16).
const OX = 8.45;
const OZ = -12.45;

// Up-scale so the kitchen reads at the same scale as the other hangar stations
// (the lounge uses the same S=1.55). Scale ABOUT the wall corner (CAX, CAZ) so the
// counter backs stay against the east/south walls and the kitchen grows out into
// the room rather than drifting off its anchor — exactly like HangarLounge.
const S   = 1.55;     // overall kitchen scale — matches the lounge / other stations
const CAX = 11.2;     // scale anchor X (counter back corner, near east wall)
const CAZ = -15.2;    // scale anchor Z (counter back corner, near south wall)
// Nudge the whole kitchen off the corner (west + north, i.e. into the room) so the
// up-scaled counters clear the east/south walls instead of clipping through them.
const NUDGE_X = -0.6;
const NUDGE_Z = 0.6;

// Per-item polish offsets the user dialled in with the layout editor (DUMP output).
// Applied as each group's local position so the baked layout matches what they saw.
const D = {
  southCounter: [0.921, 0, 0],
  stockpot:     [-0.284, 0.037, -0.046],
  eastCounter:  [0, 0, 0.257],
  samovar:      [-0.031, 0.049, 0.393],
  stove:        [0.158, 0, 0],
  fridge:       [0, 0, 0],
  rationShelf:  [0, 0.157, 0],
  utensilRail:  [-0.413, 0.058, -0.085],
  table:        [0, 0, -0.014],
  stoolA:       [0.126, 0, -0.128],
  stoolB:       [-0.179, 0, 0.107],
  stoolC:       [-0.144, 0, -0.161],
  stoolD:       [-0.282, 0, -0.139],
  wallBar:      [0, 0, 0],
  cagedLight:   [5.386, 0.111, 3.646],
};

/**
 * Build the SE-corner kitchen. Returns a handle: { collider, root, center }.
 * Static prop (no customization) — the collider drives the [E] INTERACT prompt
 * and blocks the driver from walking through the counters.
 */
export function buildKitchen(s, M) {
  const root = new TransformNode('kitchen-root', s);
  root.position = new Vector3(CAX + NUDGE_X, 0, CAZ + NUDGE_Z);
  root.scaling  = new Vector3(S, S, S);

  // Kitchen-specific materials (the shared M palette has wood/metal/darkMetal/
  // olive/lampGlow already; these are the surfaces it doesn't cover). maxLights
  // is raised so the bright surfaces still catch the kitchen's own point lights
  // even though the hangar already has ambient + directional + two bulbs.
  const mat = (name, r, g, b, spec = 0.02, em = null) => {
    const m = new StandardMaterial(name, s);
    m.diffuseColor  = new Color3(r, g, b);
    m.specularColor = new Color3(spec, spec, spec);
    if (em) m.emissiveColor = new Color3(em[0], em[1], em[2]);
    m.maxSimultaneousLights = 8;
    return m;
  };
  const steel   = mat('kit-steel', 0.46, 0.48, 0.52, 0.28);
  const steelDk = mat('kit-steeldk', 0.28, 0.29, 0.32, 0.12);
  const cream   = mat('kit-cream', 0.80, 0.78, 0.71, 0.10);
  const enamelW = mat('kit-enamelw', 0.82, 0.82, 0.79, 0.18);
  const enamelR = mat('kit-enamelr', 0.52, 0.12, 0.10, 0.15);
  const brass   = mat('kit-brass', 0.60, 0.45, 0.18, 0.30);
  const mugMat  = mat('kit-mug', 0.70, 0.70, 0.66, 0.10);
  const ember   = mat('kit-ember', 0.9, 0.4, 0.1, 0.05, [0.95, 0.40, 0.06]);
  const barLight= mat('kit-bar', 0.96, 0.94, 0.86, 0.05, [0.90, 0.86, 0.72]);
  // Shared hangar materials where the colours already match
  const wood = M.wood, metal = M.metal, darkMetal = M.darkMetal, olive = M.olive, lampGlow = M.lampGlow;

  // A group node carries that item's polish offset (D[name]); children are authored
  // in mockup space and shifted by (OX-CAX, OZ-CAZ) so root.scaling expands the
  // layout about the wall corner. Net child position = authored + offset, scaled.
  const grp = (name) => {
    const n = new TransformNode('kitchen-' + name, s);
    n.parent = root;
    const d = D[name] || [0, 0, 0];
    n.position = new Vector3(d[0], d[1], d[2]);
    return n;
  };
  const seats = [];
  const box = (parent, name, w, h, d, x, y, z, m, tag) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, s);
    b.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ);
    b.material = m; b.parent = parent; b.isPickable = false;
    if (tag === 'solid')      { b.checkCollisions = false; markSolid(b); }
    else if (tag === 'seat')  { b.checkCollisions = false; seats.push({ x: x + OX - CAX, z: z + OZ - CAZ, w, d }); }
    else                      { b.checkCollisions = false; }
    return b;
  };
  const cyl = (parent, name, dia, h, x, y, z, m, tess = 16, opts = {}) => {
    const c = MeshBuilder.CreateCylinder(name, { diameter: dia, height: h, tessellation: tess, ...opts }, s);
    c.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ);
    c.material = m; vis(c); c.parent = parent;
    return c;
  };
  const sph = (parent, name, dia, x, y, z, m) => {
    const b = MeshBuilder.CreateSphere(name, { diameter: dia, segments: 12 }, s);
    b.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ);
    b.material = m; vis(b); b.parent = parent;
    return b;
  };
  // Point light authored in mockup space, parented to its group; range is a world
  // radius (not scaled by parent) so set it generously to cover the scaled prop.
  const light = (parent, name, x, y, z, diffuse, intensity, range) => {
    const l = new PointLight(name, new Vector3(x + OX - CAX, y, z + OZ - CAZ), s);
    l.diffuse = new Color3(diffuse[0], diffuse[1], diffuse[2]);
    l.intensity = intensity; l.range = range; l.parent = parent;
    return l;
  };
  // Blob shadow oval on the floor under an item (uses the shared blob material).
  const blob = (parent, x, z, rx, rz) => {
    const b = MeshBuilder.CreateGround('kit-blob', { width: rx * 2, height: rz * 2 }, s);
    b.position = new Vector3(x + OX - CAX, 0.02, z + OZ - CAZ);
    b.material = M.blob; vis(b); b.parent = parent;
    return b;
  };

  const topY = 0.90, top = 0.94;

  // ── SOUTH counter run (steel L), sink + stockpot ───────────────────────────
  const sc = grp('southCounter');
  box(sc, 'cs-base', 3.0, 0.82, 0.82, -1.4, 0.41, -2.98, steelDk, 'solid');
  box(sc, 'cs-top',  3.1, 0.08, 0.92, -1.4, topY, -2.96, steel, 'solid');
  box(sc, 'cs-kick', 3.0, 0.12, 0.70, -1.4, 0.06, -2.98, darkMetal);
  box(sc, 'cs-splash', 3.1, 0.55, 0.05, -1.4, 1.12, -3.45, steel);
  [-2.4, -1.4, -0.4].forEach((x, i) => {
    box(sc, 'cs-door' + i, 0.86, 0.62, 0.07, x, 0.45, -2.545, metal);
    box(sc, 'cs-h' + i, 0.18, 0.04, 0.04, x, 0.45, -2.49, steel);
  });
  box(sc, 'cs-sink', 0.78, 0.10, 0.50, -0.4, top - 0.04, -2.92, darkMetal);
  cyl(sc, 'cs-faucet', 0.05, 0.34, -0.4, top + 0.17, -3.18, steel, 8);
  box(sc, 'cs-faucet-arm', 0.05, 0.05, 0.26, -0.4, top + 0.32, -3.05, steel);

  const sp = grp('stockpot');
  cyl(sp, 'sp-burner', 0.74, 0.05, -1.2, top + 0.02, -2.96, darkMetal, 18);
  cyl(sp, 'sp-ember', 0.58, 0.04, -1.2, top + 0.05, -2.96, ember, 18);
  cyl(sp, 'sp-pot', 0.70, 0.58, -1.2, top + 0.35, -2.96, enamelW, 20);
  cyl(sp, 'sp-lid', 0.74, 0.06, -1.2, top + 0.67, -2.96, steel, 20);
  cyl(sp, 'sp-knob', 0.12, 0.08, -1.2, top + 0.74, -2.96, darkMetal, 10);

  // ── EAST counter run + samovar ─────────────────────────────────────────────
  const ec = grp('eastCounter');
  box(ec, 'ce-base', 0.82, 0.82, 1.1, 2.98, 0.41, -0.15, steelDk, 'solid');
  box(ec, 'ce-top',  0.92, 0.08, 1.2, 2.96, topY, -0.15, steel, 'solid');
  box(ec, 'ce-kick', 0.70, 0.12, 1.1, 2.98, 0.06, -0.15, darkMetal);
  box(ec, 'ce-splash', 0.05, 0.55, 1.2, 3.45, 1.12, -0.15, steel);
  box(ec, 'ce-door', 0.07, 0.62, 0.9, 2.545, 0.45, -0.15, metal);
  box(ec, 'ce-h', 0.04, 0.16, 0.04, 2.49, 0.45, 0.10, steel);

  const sm = grp('samovar');
  cyl(sm, 'sm-base', 0.44, 0.08, 2.85, top + 0.04, -0.15, brass, 16);
  cyl(sm, 'sm-body', 0.40, 0.50, 2.85, top + 0.30, -0.15, brass, 18);
  sph(sm, 'sm-dome', 0.40, 2.85, top + 0.56, -0.15, brass);
  cyl(sm, 'sm-chim', 0.10, 0.28, 2.85, top + 0.78, -0.15, darkMetal, 8);
  box(sm, 'sm-tap', 0.06, 0.06, 0.18, 2.60, top + 0.20, -0.15, darkMetal);

  // ── Stove + oven ───────────────────────────────────────────────────────────
  const st = grp('stove');
  box(st, 'st-body', 0.86, 0.90, 1.05, 2.85, 0.45, -1.45, cream, 'solid');
  box(st, 'st-top', 0.92, 0.06, 1.10, 2.85, 0.93, -1.45, darkMetal);
  [[-0.16, -0.26], [-0.16, 0.26], [0.12, -0.26], [0.12, 0.26]].forEach(([dx, dz], i) =>
    cyl(st, 'st-burner' + i, 0.24, 0.03, 2.85 + dx, 0.97, -1.45 + dz, metal, 14));
  box(st, 'st-oven-door', 0.04, 0.50, 0.80, 2.42, 0.50, -1.45, darkMetal);
  box(st, 'st-oven-handle', 0.05, 0.05, 0.62, 2.38, 0.74, -1.45, steel);
  [-0.30, -0.10, 0.10, 0.30].forEach((dz, i) =>
    cyl(st, 'st-knob' + i, 0.07, 0.06, 2.55, 1.18, -1.45 + dz, darkMetal, 10));
  box(st, 'st-backguard', 0.06, 0.26, 1.10, 3.25, 1.28, -1.45, cream);

  // ── Fridge (corner) ────────────────────────────────────────────────────────
  const fr = grp('fridge');
  box(fr, 'fr-body', 0.84, 1.85, 0.80, 2.90, 0.93, -2.70, cream, 'solid');
  box(fr, 'fr-seam', 0.86, 0.03, 0.80, 2.90, 1.45, -2.70, darkMetal);
  box(fr, 'fr-h1', 0.05, 0.40, 0.05, 2.50, 1.10, -2.96, steel);
  box(fr, 'fr-h2', 0.05, 0.30, 0.05, 2.50, 1.70, -2.96, steel);

  // ── Ration shelf (east wall) ───────────────────────────────────────────────
  const rs = grp('rationShelf');
  box(rs, 'rs-board', 0.44, 0.05, 1.5, 3.30, 1.78, 0.1, wood);
  [-0.5, -0.1, 0.3, 0.7].forEach((z, i) =>
    cyl(rs, 'rs-can' + i, 0.20, 0.30, 3.30, 1.96, z, i % 2 ? olive : enamelR, 12));

  // ── Utensil rail (south wall) ──────────────────────────────────────────────
  const ur = grp('utensilRail');
  box(ur, 'ur-rail', 1.3, 0.04, 0.04, -1.1, 2.00, -3.37, metal);
  box(ur, 'ur-ladle', 0.05, 0.40, 0.03, -1.6, 1.78, -3.33, steel);
  cyl(ur, 'ur-cup', 0.16, 0.08, -1.6, 1.56, -3.33, steel, 10);
  box(ur, 'ur-pan-h', 0.04, 0.32, 0.04, -0.55, 1.81, -3.33, darkMetal);
  cyl(ur, 'ur-pan', 0.28, 0.05, -0.55, 1.62, -3.33, darkMetal, 14);

  // ── Dining table + mugs ────────────────────────────────────────────────────
  const tb = grp('table');
  cyl(tb, 'tb-pole', 0.10, 0.70, 0.25, 0.35, -0.55, metal, 10);
  cyl(tb, 'tb-foot', 0.55, 0.05, 0.25, 0.04, -0.55, darkMetal, 16);
  cyl(tb, 'tb-top', 0.95, 0.06, 0.25, 0.72, -0.55, wood, 24);
  cyl(tb, 'tb-mug1', 0.16, 0.16, 0.05, 0.83, -0.45, mugMat, 12);
  cyl(tb, 'tb-mug2', 0.16, 0.16, 0.50, 0.83, -0.70, enamelR, 12);
  blob(tb, 0.25, -0.55, 0.62, 0.62);

  // ── Stools ─────────────────────────────────────────────────────────────────
  [['stoolA', -0.67, -0.40], ['stoolB', 0.50, -1.47],
   ['stoolC', 1.17, -0.40], ['stoolD', 0.50, 0.37]].forEach(([name, sxk, szk]) => {
    const g = grp(name);
    cyl(g, name + '-seat', 0.34, 0.05, sxk, 0.50, szk, enamelR, 16);
    // Record seat-pad footprint in root local space (stool group adds its D offset).
    const dk = D[name] || [0, 0, 0];
    seats.push({ x: sxk + OX - CAX + dk[0], z: szk + OZ - CAZ + dk[2], w: 0.34, d: 0.34 });
    cyl(g, name + '-pole', 0.07, 0.48, sxk, 0.24, szk, metal, 8);
    blob(g, sxk, szk, 0.26, 0.26);
  });

  // ── Wall bar light (east wall, over the cook line) ─────────────────────────
  const wb = grp('wallBar');
  box(wb, 'wb-house', 0.16, 0.14, 1.4, 3.42, 2.30, -1.45, darkMetal);
  box(wb, 'wb-tube', 0.10, 0.06, 1.26, 3.37, 2.21, -1.45, barLight);
  light(wb, 'kit-wb-light', 3.02, 2.20, -1.45, [1.0, 0.95, 0.82], 2.0, 11);

  // ── Caged floor work light ─────────────────────────────────────────────────
  const cf = grp('cagedLight');
  cyl(cf, 'cf-base', 0.42, 0.06, -2.55, 0.05, -2.00, darkMetal, 16);
  cyl(cf, 'cf-foot', 0.20, 0.12, -2.55, 0.12, -2.00, metal, 10);
  cyl(cf, 'cf-pole', 0.06, 1.25, -2.55, 0.70, -2.00, metal, 8);
  cyl(cf, 'cf-hood', 0.34, 0.12, -2.55, 1.74, -2.00, darkMetal, 14, { diameterTop: 0.10, diameterBottom: 0.36 });
  sph(cf, 'cf-bulb', 0.22, -2.55, 1.50, -2.00, lampGlow);
  cyl(cf, 'cf-ringT', 0.32, 0.03, -2.55, 1.67, -2.00, darkMetal, 14);
  cyl(cf, 'cf-ringB', 0.32, 0.03, -2.55, 1.33, -2.00, darkMetal, 14);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    box(cf, 'cf-bar' + i, 0.022, 0.36, 0.022, -2.55 + Math.cos(a) * 0.155, 1.50, -2.00 + Math.sin(a) * 0.155, darkMetal);
  }
  light(cf, 'kit-cf-light', -2.55, 1.50, -2.00, [1.0, 0.86, 0.55], 3.6, 14);
  blob(cf, -2.55, -2.00, 0.5, 0.5);

  // ── Shadows — the cook-line bar light casts the props' shadows onto the
  // counters/surfaces. Every kitchen mesh both casts and receives so e.g. the
  // samovar throws a defined shadow across the east counter top. (Vividness still
  // depends on the bar light staying the dominant light on that surface — the
  // ambient/fill lights soften it.)
  // Shadows are cast hangar-wide from the overhead key light (see
  // HangarScene._setupShadows), so the kitchen meshes don't manage their own.

  // Proximity trigger centre — the scaled footprint centre of the kitchen.
  const center = new Vector3(
    (CAX + NUDGE_X) + S * (1.0 + OX - CAX),
    0.8,
    (CAZ + NUDGE_Z) + S * (-2.0 + OZ - CAZ),
  );

  // Short solids (counter tops ~0.90, stove, table) sit at/under the player's
  // collision capsule floor (~0.9), so their visual colliders don't block — and
  // there are gaps BETWEEN props you could squeeze through. So instead of per-prop
  // blockers, fence the whole SE cook corner with a tall invisible L-barrier along
  // the cook-line's room-facing front (south leg + east leg, sealed to the walls);
  // plus one blocker for the free-standing dining table. Parented to the prop
  // group (or root) so the group/scale offsets are inherited.
  const BLOCK_H = 1.6;
  const block = (parent, name, w, d, x, z) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: BLOCK_H, depth: d }, s);
    m.position        = new Vector3(x + OX - CAX, BLOCK_H / 2, z + OZ - CAZ);
    m.isVisible       = false;
    m.isPickable      = false;
    m.checkCollisions = true;
    m.parent          = parent;
    return m;
  };
  // L-barrier front (south leg + east leg) ...
  block(root, 'kit-barrier-s', 5.9,  0.12, 0.05, -2.45);  // south cook-line front (west end at counter edge)
  block(root, 'kit-barrier-e', 0.12, 3.5,  2.45, -1.25);  // east cook-line front
  // ... plus end-caps so the two OPEN ends can't be rounded into the pocket:
  block(root, 'kit-barrier-w', 0.14, 0.75, -2.9, -2.78);  // west end-cap (exit-door side) → seals the gap
  block(root, 'kit-barrier-n', 0.65, 0.14,  2.72, 0.40);  // north end-cap (east leg)
  block(tb,   'tb-block',      0.90, 0.90,  0.25, -0.55);  // free-standing dining table

  const colliders = seats.map((f, i) => makeSeatPad(s, `kit-seatpad-${i}`, f, root));
  const trigger   = makeTrigger(s, 'kit-trigger', new Vector3(center.x, 0.5, center.z));
  return { root, colliders, trigger, center: new Vector3(center.x, 0.5, center.z) };
}
