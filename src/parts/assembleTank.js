import { TransformNode, Vector3 } from '@babylonjs/core';
import { PARTS_BY_ID } from './index.js';

// Native ring diameter cache: a hull's ring is as big as its native turret's base.
// Keyed by turret id; value is the measured base diameter.
const _ringCache = new Map();

async function nativeRingDiameter(scene, hullPart, equippedTurretId, equippedBase) {
  const nativeId = hullPart.nativeTurret;
  if (!nativeId) return equippedBase.diameter;          // no native declared → no scaling
  if (nativeId === equippedTurretId) return equippedBase.diameter; // equipped IS native
  if (_ringCache.has(nativeId)) return _ringCache.get(nativeId);

  // Build the native turret once just to measure its base, then dispose it.
  const nativePart = PARTS_BY_ID[nativeId];
  const built = await nativePart.build(scene);
  const d = built.base.diameter;
  _ringCache.set(nativeId, d);
  built.root.dispose();
  for (const m of built.meshes) if (!m.isDisposed()) m.dispose(false, true);
  return d;
}

// Dev-only self-check: warn (naming the link + loadout) on the reliable failure modes —
// orientation, scale sanity, and barrel aim. Centering/seating are guaranteed by the
// extraction contract (turret centered on its ring at origin) + the hull's ringCenter, NOT
// re-measured: a turret's lowest slice is its mantlet, so a re-measured center would
// false-fail (M26 bottom-slice center reads Z≈+0.6). Those stay on the visual checklist.
function validateComposition(ctx) {
  const { loadout, turretPivot, barrelPivot, scale, turretBuilt, cannonBuilt } = ctx;
  const tag = `${loadout.hull}+${loadout.turret}+${loadout.cannon}`;
  const warn = (link, msg) => console.warn(`[validateComposition] ${tag} — ${link}: ${msg}`);

  // Link 1: orientation — gun mount is forward of the turret origin (+Z). A 180°-wrong
  // turret puts the mount behind the origin and fails this.
  if (!(turretBuilt.mount && turretBuilt.mount.z > 0)) {
    warn('orientation', `mount.z=${turretBuilt.mount?.z?.toFixed(2)} not > 0 (gun not on front)`);
  }
  // Link 1: scale sanity.
  if (!(scale > 0.3 && scale < 3.0)) warn('scale', `scale ${scale.toFixed(2)} out of sane range`);

  // Link 2: barrel aimed forward — cannon's furthest world +Z is ahead of the barrel pivot,
  // and the barrel pivot is ahead of the turret pivot.
  turretPivot.computeWorldMatrix(true);
  barrelPivot.computeWorldMatrix(true);
  const turretZ = turretPivot.getAbsolutePosition().z;
  const pivotZ = barrelPivot.getAbsolutePosition().z;
  let tipZ = -Infinity;
  for (const m of cannonBuilt.meshes) {
    m.computeWorldMatrix(true);
    const z = m.getBoundingInfo().boundingBox.maximumWorld.z;
    if (z > tipZ) tipZ = z;
  }
  if (!(tipZ > pivotZ)) warn('barrel-aim', `tip z=${tipZ.toFixed(2)} not forward of barrel pivot z=${pivotZ.toFixed(2)}`);
  if (!(pivotZ >= turretZ - 0.01)) warn('barrel-attach', `barrel pivot z=${pivotZ.toFixed(2)} behind turret pivot z=${turretZ.toFixed(2)}`);
}

// Composes a {hull, turret, cannon} loadout into one tank via the alignment chain
// hull → turret → barrel. Returns the same handles the game expects.
export async function assembleTank(scene, loadout, materials = {}) {
  const root = new TransformNode('tankRoot', scene);

  const hullPart   = PARTS_BY_ID[loadout.hull];
  const turretPart = PARTS_BY_ID[loadout.turret];
  const cannonPart = PARTS_BY_ID[loadout.cannon];

  // 1. Hull at origin (self-paints). ringCenter = where the turret seats.
  const hullBuilt = await hullPart.build(scene);
  hullBuilt.root.parent = root;
  const ring = hullBuilt.ringCenter ?? hullBuilt.mount ?? new Vector3(0, 1, 0);

  // 2. Turret pivot at the ring center.
  const turretPivot = new TransformNode('turretPivot', scene);
  turretPivot.position.copyFrom(ring);
  turretPivot.parent = root;

  const turretBuilt = await turretPart.build(scene);

  // 3. Scale the turret so its base diameter matches the ring. The turret is already
  //    centered on its ring at its origin (extraction contract), so we place the origin at
  //    the ring and scale about it — the ring stays put, the dome scales around it. No
  //    re-centering offset (a measured center would be skewed by the low-hanging mantlet).
  const ringDiameter = await nativeRingDiameter(scene, hullPart, loadout.turret, turretBuilt.base);
  let scale = ringDiameter / turretBuilt.base.diameter;
  if (!(scale > 0.3 && scale < 3.0)) {
    console.warn(`[assembleTank] scale ${scale.toFixed(3)} out of range for ${loadout.turret} on ${loadout.hull}; using 1`);
    scale = 1;
  }
  turretBuilt.root.parent  = turretPivot;
  turretBuilt.root.scaling = new Vector3(scale, scale, scale);

  // 4. Barrel pivot at the scaled mount (mount scales about the turret origin too).
  const mount = turretBuilt.mount ?? new Vector3(0, 0, 0.5);
  const barrelPivot = new TransformNode('barrelPivot', scene);
  barrelPivot.position = mount.scale(scale);
  barrelPivot.parent = turretPivot;

  const cannonBuilt = await cannonPart.build(scene, materials.cannon);
  cannonBuilt.root.parent = barrelPivot;

  // 5. Ground the tank — shift root so the lowest mesh point sits at y=0.
  let minY = Infinity;
  const allMeshes = [...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes];
  for (const m of allMeshes) {
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    if (bb.minimumWorld.y < minY) minY = bb.minimumWorld.y;
  }
  if (isFinite(minY)) root.position.y = -minY;

  if (import.meta.env?.DEV) {
    validateComposition({ loadout, turretPivot, barrelPivot, ringDiameter, scale, turretBuilt, cannonBuilt });
  }

  return {
    root, turretPivot, barrelPivot,
    parts: { hullBuilt, turretBuilt, cannonBuilt },
  };
}
