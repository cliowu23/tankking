import { TransformNode, Vector3 } from '@babylonjs/core';
import { PARTS_BY_ID } from './index.js';
import { measureBasket } from './measureBasket.js';
import { worldBounds } from '../../utils/meshBounds.js';

// Dev-only self-check: warn (naming the link + loadout) on the reliable failure modes —
// orientation, scale sanity, and barrel aim. Centering/seating are guaranteed by the
// extraction contract (turret centered on its ring at origin) + the hull's ringCenter, NOT
// re-measured: a turret's lowest slice is its mantlet, so a re-measured center would
// false-fail (M26 bottom-slice center reads Z≈+0.6). Those stay on the visual checklist.
function validateComposition(ctx) {
  const { loadout, turretPivot, barrelPivot, scale, turretBuilt, cannonBuilt, turretPart } = ctx;
  const tag = `${loadout.hull}+${loadout.turret}+${loadout.cannon}`;
  const warn = (link, msg) => console.warn(`[validateComposition] ${tag} — ${link}: ${msg}`);

  // Link 1: orientation — gun mount is forward of the turret origin (+Z). A 180°-wrong
  // turret puts the mount behind the origin and fails this.
  if (!(turretBuilt.mount && turretBuilt.mount.z > 0)) {
    warn('orientation', `mount.z=${turretBuilt.mount?.z?.toFixed(2)} not > 0 (gun not on front)`);
  }
  // Link 1: scale sanity.
  if (!(scale > 0.3 && scale < 3.0)) warn('scale', `scale ${scale.toFixed(2)} out of sane range`);

  // Link 0: ring contract — the turret's collar mesh extent must match its declared ring.
  // Catches "declared ringDiameter flipped but GLB not regenerated". 3% tolerance covers
  // the 24-gon flat-to-flat error (~0.9%).
  const ringMesh = turretBuilt.meshes.find(m => m.name.includes('turret_ring'));
  if (ringMesh && turretPart?.ringDiameter) {
    const d = ringMesh.getBoundingInfo().boundingBox.extendSize.x * 2;
    if (Math.abs(d - turretPart.ringDiameter) / turretPart.ringDiameter > 0.03) {
      warn('ring-contract', `collar mesh d=${d.toFixed(2)} ≠ declared ${turretPart.ringDiameter} — regen the GLB?`);
    }
  }

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
//
// By default it creates its own root/turretPivot/barrelPivot (the designer preview). Pass
// `options.target = { root, turretPivot, barrelPivot }` to build onto an existing rig — e.g. the
// arena's Tank entity, whose gameplay already drives those pivots. In that mode the tank's root
// is gameplay-controlled, so grounding is applied to the parts (hull + turret) instead of root.
export async function assembleTank(scene, loadout, materials = {}, options = {}) {
  const target = options.target ?? null;
  const root = target?.root ?? new TransformNode('tankRoot', scene);
  const paint = options.paint ?? null;   // [r,g,b] player paint, or null = each part's own colour

  const hullPart   = PARTS_BY_ID[loadout.hull];
  const turretPart = PARTS_BY_ID[loadout.turret];
  const cannonPart = PARTS_BY_ID[loadout.cannon];

  // 1. Hull at origin (self-paints, or the player paint override). ringCenter = turret seat.
  const hullBuilt = await hullPart.build(scene, paint);
  hullBuilt.root.parent = root;
  const ring = hullBuilt.ringCenter ?? hullBuilt.mount ?? new Vector3(0, 1, 0);

  // 2. Build the turret and detect its basket (ring) centre from the dome geometry — the point
  //    it should rotate about. Done here (not per-part) so every turret pivots adaptively.
  const turretBuilt = await turretPart.build(scene, paint);
  const basket = measureBasket(turretBuilt.meshes);
  console.log(`[assembleTank] ${loadout.turret} basket center=(${basket.center.x.toFixed(2)},${basket.center.z.toFixed(2)}) from ${basket.domeMeshes.length} dome meshes`);

  // 3. Scale the turret so its declared ring matches the hull's declared ring. Both values are
  //    contract-declared in the part modules (each mirrors `ringD` in scripts/modelgen/params/
  //    <tank>.json) — never runtime-measured. Undeclared parts (hull-calib) default to the
  //    legacy 1.8. The turret is centered on its ring at its origin (integration contract); we
  //    place the origin at the ring and scale about it — the ring stays put, the dome scales.
  const hullRing   = hullPart.ringDiameter   ?? 1.8;
  const turretRing = turretPart.ringDiameter ?? 1.8;
  let scale = hullRing / turretRing;
  if (!(scale > 0.3 && scale < 3.0)) {
    console.warn(`[assembleTank] scale ${scale.toFixed(3)} out of range for ${loadout.turret} on ${loadout.hull}; using 1`);
    scale = 1;
  }

  // 4. Turret pivot. It seats at the hull ring, then shifts to the turret's detected basket
  //    centre (measureBasket) so the turret rotates about the middle of its dome, not the
  //    geometry origin — which sits off-centre behind the basket. The basket offset is in
  //    native turret units, so scale it into world units. The turret geometry is counter-
  //    shifted by the same amount, so its static seating is unchanged: only the spin axis moves.
  const basketOffset = basket.center.scale(scale);
  const turretPivot = target?.turretPivot ?? new TransformNode('turretPivot', scene);
  turretPivot.position.copyFrom(ring).addInPlace(basketOffset);
  turretPivot.parent = root;

  turretBuilt.root.parent   = turretPivot;
  turretBuilt.root.position = basketOffset.negate();        // counter-shift: seating unchanged
  turretBuilt.root.scaling  = new Vector3(scale, scale, scale);

  // 5. Barrel pivot at the scaled mount, carried by the same counter-shift so the gun stays
  //    attached where it was — the mount rides with the turret geometry, not the shifted pivot.
  const mount = turretBuilt.mount ?? new Vector3(0, 0, 0.5);
  const barrelPivot = target?.barrelPivot ?? new TransformNode('barrelPivot', scene);
  barrelPivot.position = mount.scale(scale).add(turretBuilt.root.position);
  barrelPivot.parent = turretPivot;
  barrelPivot.rotation.x = 0;   // start level (gameplay drives elevation)

  const cannonBuilt = await cannonPart.build(scene, materials.cannon);
  cannonBuilt.root.parent = barrelPivot;
  // The gun grows with its turret: sleeve diameter keeps matching the scaled mantlet bore.
  // Muzzle consumers (_measureBarrelTip, shell spawn) measure world geometry, so they adapt.
  cannonBuilt.root.scaling = new Vector3(scale, scale, scale);

  // 6. Ground the tank — shift the lowest mesh point to y=0. With our own root we just move the
  //    root; on a target rig the root is gameplay-controlled, so we shift the parts (hull +
  //    turret pivot carry everything below them) by the same amount instead.
  const allMeshes = [...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes];
  const { minY } = worldBounds(allMeshes);
  if (isFinite(minY)) {
    if (target) {
      hullBuilt.root.position.y -= minY;
      turretPivot.position.y    -= minY;
    } else {
      root.position.y = -minY;
    }
  }

  if (import.meta.env?.DEV) {
    validateComposition({ loadout, turretPivot, barrelPivot, scale, turretBuilt, cannonBuilt, turretPart });
  }

  return {
    root, turretPivot, barrelPivot, scale, minY,
    parts: { hullBuilt, turretBuilt, cannonBuilt },
  };
}
