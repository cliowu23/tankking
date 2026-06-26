import { MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, PointLight } from '@babylonjs/core';
import { markSolid, makeSeatPad, makeTrigger } from './hangarColliders.js';

// ── helpers (kept local so this module stays decoupled from HangarProps) ──────
function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}

// Final hand-tuned look (locked via the lounge layout editor — no longer
// customizable in-game): oxblood L-couch, metal coffee table, floor lamp, rug,
// and a mug + magazines scatter. Blanket and wall poster were dropped.
const UPH_CUSHION = [0.34, 0.11, 0.09];
const UPH_FRAME   = [0.22, 0.07, 0.06];
const UPH_SEAM    = [0.14, 0.04, 0.03];

// Baked offsets from the editor DUMP (mockup-local frame). The table and the
// tabletop scatter were nudged off their authored centres; everything else sits
// at delta 0.
const T0X = -1.35, T0Z = -1.35;            // authored coffee-table centre
const TABLE_DX = 0.315, TABLE_DZ = 0.232;  // table moved off centre
const SCAT_DX  = 0.251, SCAT_DZ  = 0.14;   // mug + magazines moved off centre

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
 * Build the SW-corner lounge — a fixed, hand-tuned rest area. Returns a handle:
 *   { collider, root, center }
 */
export function buildLounge(s, M) {
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
  const metal    = M.metal;      // table legs, lamp pole
  const darkMetal= M.darkMetal;  // metal table top, lamp base
  const olive    = M.olive;      // a magazine
  const paper    = M.parchment;  // a magazine
  const lampGlow = M.lampGlow;   // lamp shade

  // Lounge-specific materials
  const rugMat    = mat('lng-rug', 0.34, 0.13, 0.11);
  const rugBorder = mat('lng-rugb', 0.20, 0.08, 0.07);
  const mugMat    = mat('lng-mug', 0.70, 0.70, 0.66, 0.1);
  const cushion   = mat('lng-cushion', ...UPH_CUSHION);
  const frame     = mat('lng-frame',   ...UPH_FRAME);
  const seam      = mat('lng-seam',    ...UPH_SEAM);

  // Offset-aware primitive helpers (author in mockup space, build in world space)
  // Author in world coords (x+OX, z+OZ) but store relative to the scale anchor,
  // so root.scaling expands the layout about (CAX, CAZ).
  // tag: 'solid' (collider = this mesh), 'seat' (record a cushion footprint),
  // or undefined (decorative — no collision). Seat footprints collect in seats[].
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

  // ── L-couch (oxblood) — backs to west + south walls, seats face the room ────
  const couchNode = new TransformNode('lng-couch', s);
  couchNode.parent = root;
  // WEST ARM
  box(couchNode, 'wa-base', 0.95, 0.34, 2.7, -2.55, 0.17, -1.3, frame, 'solid');
  box(couchNode, 'wa-back', 0.26, 0.50, 2.7, -2.92, 0.59, -1.3, cushion, 'solid');
  box(couchNode, 'wa-seat1', 0.78, 0.20, 1.18, -2.50, 0.44, -1.95, cushion, 'seat');
  box(couchNode, 'wa-seat2', 0.78, 0.20, 1.18, -2.50, 0.44, -0.65, cushion, 'seat');
  box(couchNode, 'wa-seam',  0.80, 0.205, 0.04, -2.50, 0.445, -1.30, seam);
  box(couchNode, 'wa-arm',   0.95, 0.56, 0.26, -2.55, 0.45, 0.18, frame, 'solid');
  // SOUTH ARM
  box(couchNode, 'sa-base', 2.7, 0.34, 0.95, -1.3, 0.17, -2.55, frame, 'solid');
  box(couchNode, 'sa-back', 2.7, 0.50, 0.26, -1.3, 0.59, -2.92, cushion, 'solid');
  box(couchNode, 'sa-seat1', 1.18, 0.20, 0.78, -1.95, 0.44, -2.50, cushion, 'seat');
  box(couchNode, 'sa-seat2', 1.18, 0.20, 0.78, -0.65, 0.44, -2.50, cushion, 'seat');
  box(couchNode, 'sa-seam',  0.04, 0.205, 0.80, -1.30, 0.445, -2.50, seam);
  box(couchNode, 'sa-arm',   0.26, 0.56, 0.95, 0.18, 0.45, -2.55, frame, 'solid');
  // CORNER cushion + back wedge
  box(couchNode, 'c-seat', 0.85, 0.20, 0.85, -2.50, 0.44, -2.50, cushion, 'seat');
  box(couchNode, 'c-back', 0.55, 0.50, 0.55, -2.78, 0.59, -2.78, cushion, 'solid');

  // ── coffee table (metal) — baked off the authored centre ────────────────────
  const TX = T0X + TABLE_DX, TZ = T0Z + TABLE_DZ;
  const tableNode = new TransformNode('lng-table', s);
  tableNode.parent = root;
  box(tableNode, 't-top', 1.05, 0.06, 0.70, TX, 0.45, TZ, darkMetal, 'seat');  // low enough to step onto
  [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]].forEach(([dx, dz], i) =>
    box(tableNode, 't-leg' + i, 0.07, 0.42, 0.07, TX + dx, 0.21, TZ + dz, metal));

  // ── rug (floor + border) ────────────────────────────────────────────────────
  const rug = MeshBuilder.CreateGround('lng-rug', { width: 3.6, height: 3.6 }, s);
  rug.position = new Vector3(-1.5 + OX - CAX, 0.02, -1.5 + OZ - CAZ); rug.material = rugMat;
  vis(rug); rug.parent = root;
  box(root, 'lng-rug-border', 3.6, 0.015, 3.6, -1.5, 0.012, -1.5, rugBorder);

  // ── floor lamp ──────────────────────────────────────────────────────────────
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

  // ── tabletop scatter (mug + magazines) — baked off the authored centre ──────
  const SX = T0X + SCAT_DX, SZ = T0Z + SCAT_DZ;
  const scatterNode = new TransformNode('lng-scatter', s); scatterNode.parent = root;
  cyl(scatterNode, 'mug', 0.16, 0.18, SX + 0.3, 0.57, SZ - 0.1, mugMat, 12);
  box(scatterNode, 'mag1', 0.34, 0.03, 0.26, SX - 0.25, 0.49, SZ + 0.12, paper);
  box(scatterNode, 'mag2', 0.34, 0.03, 0.26, SX - 0.22, 0.52, SZ + 0.16, olive);

  // Seat-pads (raised step-pads over each cushion footprint) + solid colliders
  // are already on the meshes (tags above). Build the [E] proximity trigger at
  // the scaled couch centre, matching the old collider centre.
  const cx = CAX + NUDGE_X + S * (LOUNGE_CX - CAX);
  const cz = CAZ + NUDGE_Z + S * (LOUNGE_CZ - CAZ);

  const colliders = seats.map((f, i) => makeSeatPad(s, `lng-seatpad-${i}`, f, root));
  const trigger   = makeTrigger(s, 'lng-trigger', new Vector3(cx, 0.5, cz));

  return { root, colliders, trigger, center: new Vector3(cx, 0.5, cz) };
}
