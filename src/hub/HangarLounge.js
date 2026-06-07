import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight } from '@babylonjs/core';

// ── helpers (kept local so this module stays decoupled from HangarProps) ──────
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}
function makeCollider(name, size, pos, s) {
  const m = MeshBuilder.CreateBox(name, size, s);
  m.position        = pos.clone();
  m.isVisible       = false;
  m.checkCollisions = true;
  m.isPickable      = false;
  return m;
}

// Upholstery palettes: [cushion, frame (darker), seam (darkest)]
const UPH = {
  oxblood: [[0.34, 0.11, 0.09], [0.22, 0.07, 0.06], [0.14, 0.04, 0.03]],
  olive:   [[0.24, 0.28, 0.15], [0.16, 0.19, 0.10], [0.10, 0.12, 0.06]],
  gray:    [[0.32, 0.34, 0.38], [0.20, 0.22, 0.26], [0.13, 0.14, 0.17]],
};

export const LOUNGE_DEFAULT = {
  uph: 'oxblood',
  table: 'crate',
  extras: { lamp: true, rug: true, poster: false, scatter: true },
};

// Port the mockup's local frame (walls at x=-3.55, z=-3.55) into the hangar's
// SW corner (west wall x=-12, south wall z=-16). Every coordinate below is
// authored in mockup space and shifted by (OX, OZ) so it lands in the corner.
const OX = -8.45;
const OZ = -12.45;

// Up-scale so the lounge reads at the same scale as the other hangar stations
// (which apply scale 1.8 to their roots). We scale the root ABOUT the SW wall
// corner (CAX, CAZ) so the couch backs stay against the walls and the lounge
// grows out into the room rather than drifting off its anchor.
const S   = 1.55;     // overall lounge scale — tune to taste
const CAX = -11.2;    // scale anchor X (couch back corner, near west wall)
const CAZ = -15.2;    // scale anchor Z (couch back corner, near south wall)
// Nudge the whole lounge off the corner (east + north) so the up-scaled rug
// clears the west/south walls instead of clipping through them.
const NUDGE_X = 0.5;
const NUDGE_Z = 0.6;

// Lounge centre at 1:1 (before scaling), in hangar world space.
export const LOUNGE_CX = -1.4 + OX;   // ≈ -9.85
export const LOUNGE_CZ = -1.4 + OZ;   // ≈ -13.85

/**
 * Build the SW-corner lounge. Returns a handle:
 *   { collider, root, update(config) }
 * `update` live-rebuilds the couch + table and toggles the extras.
 */
export function buildLounge(s, M, config) {
  const root = new TransformNode('lounge-root', s);
  // Anchor the root at the corner and scale about it (children authored below
  // are shifted by -CAX/-CAZ so their world layout is unchanged at S=1).
  root.position = new Vector3(CAX + NUDGE_X, 0, CAZ + NUDGE_Z);
  root.scaling  = new Vector3(S, S, S);

  const mat = (name, r, g, b, spec = 0.02) => {
    const m = new StandardMaterial(name, s);
    m.diffuseColor  = new Color3(r, g, b);
    m.specularColor = new Color3(spec, spec, spec);
    m.maxSimultaneousLights = 8;  // so the lounge lamp isn't culled by the 4-light cap
    return m;
  };

  // Materials shared with the rest of the hangar where the colours already match
  const wood     = M.wood;       // crate body, spool
  const metal    = M.metal;      // bands, legs, lamp pole
  const darkMetal= M.darkMetal;  // metal table top, lamp base
  const olive    = M.olive;      // crate lid, a magazine
  const paper    = M.parchment;  // magazine / folded map
  const lampGlow = M.lampGlow;   // lamp shade

  // Lounge-specific materials
  const rugMat    = mat('lng-rug', 0.34, 0.13, 0.11);
  const rugBorder = mat('lng-rugb', 0.20, 0.08, 0.07);
  const blanket   = mat('lng-blanket', 0.55, 0.45, 0.20);
  const mugMat    = mat('lng-mug', 0.70, 0.70, 0.66, 0.1);
  const posterMat = mat('lng-poster', 0.55, 0.50, 0.40);
  posterMat.emissiveColor = new Color3(0.10, 0.10, 0.08);

  // Offset-aware primitive helpers (author in mockup space, build in world space)
  // Author in world coords (x+OX, z+OZ) but store relative to the scale anchor,
  // so root.scaling expands the layout about (CAX, CAZ).
  const box = (parent, name, w, h, d, x, y, z, m) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, s);
    b.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ);
    b.material = m; vis(b); b.parent = parent;
    return b;
  };
  const cyl = (parent, name, dia, h, x, y, z, m, tess = 16, opts = {}) => {
    const c = MeshBuilder.CreateCylinder(name, { diameter: dia, height: h, tessellation: tess, ...opts }, s);
    c.position = new Vector3(x + OX - CAX, y, z + OZ - CAZ);
    c.material = m; vis(c); c.parent = parent;
    return c;
  };

  // ── L-couch (rebuilt on upholstery change) ─────────────────────────────────
  let couchNode = null;
  function buildCouch(uphKey) {
    if (couchNode) couchNode.dispose();
    couchNode = new TransformNode('lng-couch', s);
    couchNode.parent = root;
    const [cu, fr, sm] = UPH[uphKey] || UPH.oxblood;
    const cushion = mat('lng-cu-' + uphKey, cu[0], cu[1], cu[2]);
    const frame   = mat('lng-fr-' + uphKey, fr[0], fr[1], fr[2]);
    const seam    = mat('lng-sm-' + uphKey, sm[0], sm[1], sm[2]);

    // WEST ARM — back to west wall, seats face the room (+x)
    box(couchNode, 'wa-base', 0.95, 0.34, 2.7, -2.55, 0.17, -1.3, frame);
    box(couchNode, 'wa-back', 0.26, 0.50, 2.7, -2.92, 0.59, -1.3, cushion);
    box(couchNode, 'wa-seat1', 0.78, 0.20, 1.18, -2.50, 0.44, -1.95, cushion);
    box(couchNode, 'wa-seat2', 0.78, 0.20, 1.18, -2.50, 0.44, -0.65, cushion);
    box(couchNode, 'wa-seam',  0.80, 0.205, 0.04, -2.50, 0.445, -1.30, seam);
    box(couchNode, 'wa-arm',   0.95, 0.56, 0.26, -2.55, 0.45, 0.18, frame);

    // SOUTH ARM — back to south wall, seats face the room (+z)
    box(couchNode, 'sa-base', 2.7, 0.34, 0.95, -1.3, 0.17, -2.55, frame);
    box(couchNode, 'sa-back', 2.7, 0.50, 0.26, -1.3, 0.59, -2.92, cushion);
    box(couchNode, 'sa-seat1', 1.18, 0.20, 0.78, -1.95, 0.44, -2.50, cushion);
    box(couchNode, 'sa-seat2', 1.18, 0.20, 0.78, -0.65, 0.44, -2.50, cushion);
    box(couchNode, 'sa-seam',  0.04, 0.205, 0.80, -1.30, 0.445, -2.50, seam);
    box(couchNode, 'sa-arm',   0.26, 0.56, 0.95, 0.18, 0.45, -2.55, frame);

    // CORNER cushion + back wedge tying the two arms together
    box(couchNode, 'c-seat', 0.85, 0.20, 0.85, -2.50, 0.44, -2.50, cushion);
    box(couchNode, 'c-back', 0.55, 0.50, 0.55, -2.78, 0.59, -2.78, cushion);
  }

  // ── coffee table (rebuilt on table change) ─────────────────────────────────
  const TX = -1.35, TZ = -1.35;
  let tableNode = null;
  function buildTable(kind) {
    if (tableNode) tableNode.dispose();
    tableNode = new TransformNode('lng-table', s);
    tableNode.parent = root;
    if (kind === 'metal') {
      box(tableNode, 't-top', 1.05, 0.06, 0.70, TX, 0.45, TZ, darkMetal);
      [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]].forEach(([dx, dz], i) =>
        box(tableNode, 't-leg' + i, 0.07, 0.42, 0.07, TX + dx, 0.21, TZ + dz, metal));
    } else if (kind === 'spool') {
      cyl(tableNode, 't-top', 1.15, 0.07, TX, 0.45, TZ, wood, 20);
      cyl(tableNode, 't-bot', 1.15, 0.07, TX, 0.10, TZ, wood, 20);
      cyl(tableNode, 't-hub', 0.45, 0.30, TX, 0.27, TZ, wood, 16);
    } else { // crate (default)
      box(tableNode, 't-body', 1.15, 0.42, 0.75, TX, 0.21, TZ, wood);
      box(tableNode, 't-lid',  1.20, 0.06, 0.80, TX, 0.45, TZ, olive);
      box(tableNode, 't-band1', 1.22, 0.05, 0.05, TX, 0.30, TZ - 0.35, metal);
      box(tableNode, 't-band2', 1.22, 0.05, 0.05, TX, 0.30, TZ + 0.35, metal);
    }
  }

  // ── extras (built once, toggled with setEnabled) ───────────────────────────
  const rug = MeshBuilder.CreateGround('lng-rug', { width: 3.6, height: 3.6 }, s);
  rug.position = new Vector3(-1.5 + OX - CAX, 0.02, -1.5 + OZ - CAZ); rug.material = rugMat;
  vis(rug); rug.parent = root;
  const rugBox = box(root, 'lng-rug-border', 3.6, 0.015, 3.6, -1.5, 0.012, -1.5, rugBorder);

  const lampNode = new TransformNode('lng-lamp', s); lampNode.parent = root;
  const LX = -2.55, LZ = 0.7;
  cyl(lampNode, 'l-base', 0.40, 0.06, LX, 0.05, LZ, darkMetal, 14);
  cyl(lampNode, 'l-pole', 0.07, 1.70, LX, 0.90, LZ, metal, 8);
  cyl(lampNode, 'l-shade', 0.45, 0.32, LX, 1.85, LZ, lampGlow, 16, { diameterTop: 0.45, diameterBottom: 0.20 });
  // Parent the lamp light to the (scaled) root so it tracks the lamp position;
  // range is a world radius (unaffected by parent scale) so widen it to match.
  const lampLight = new PointLight('lng-lamp-light', new Vector3(LX + OX - CAX, 1.7, LZ + OZ - CAZ), s);
  lampLight.parent    = root;
  lampLight.diffuse   = new Color3(1.0, 0.82, 0.45);
  lampLight.intensity = 2.8;
  lampLight.range     = 11;

  const posterNode = new TransformNode('lng-poster', s); posterNode.parent = root;
  box(posterNode, 'poster-board', 0.10, 1.5, 1.2, -3.46, 1.7, -1.3, posterMat);
  box(posterNode, 'poster-frame', 0.06, 1.62, 1.32, -3.49, 1.7, -1.3, darkMetal);

  const scatterNode = new TransformNode('lng-scatter', s); scatterNode.parent = root;
  cyl(scatterNode, 'mug', 0.16, 0.18, TX + 0.3, 0.57, TZ - 0.1, mugMat, 12);
  box(scatterNode, 'mag1', 0.34, 0.03, 0.26, TX - 0.25, 0.49, TZ + 0.12, paper);
  box(scatterNode, 'mag2', 0.34, 0.03, 0.26, TX - 0.22, 0.52, TZ + 0.16, olive);
  box(scatterNode, 'blanket', 0.30, 0.16, 0.80, 0.18, 0.60, -2.55, blanket);

  // ── update / apply ─────────────────────────────────────────────────────────
  function update(cfg) {
    buildCouch(cfg.uph);
    buildTable(cfg.table);
    rug.setEnabled(cfg.extras.rug);
    rugBox.setEnabled(cfg.extras.rug);
    lampNode.setEnabled(cfg.extras.lamp);
    lampLight.setEnabled(cfg.extras.lamp);
    posterNode.setEnabled(cfg.extras.poster);
    scatterNode.setEnabled(cfg.extras.scatter);
  }
  update(config);

  // Scaled couch centre (world). Collider stays a touch smaller than the visual
  // footprint so the driver can step close enough to trigger the CUSTOMIZE
  // prompt (proximity threshold is 3.5 from the collider centre).
  const cx = CAX + NUDGE_X + S * (LOUNGE_CX - CAX);
  const cz = CAZ + NUDGE_Z + S * (LOUNGE_CZ - CAZ);
  const collider = makeCollider('station-lounge',
    { width: 3.4, height: 1.5, depth: 3.4 },
    new Vector3(cx, 0.75, cz), s);

  return { collider, root, update, center: new Vector3(cx, 0.5, cz) };
}
