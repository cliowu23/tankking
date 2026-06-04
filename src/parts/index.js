import cannon90mm  from './cannons/cannon-90mm.js';
import cannon100mm from './cannons/cannon-100mm.js';
import hullM26     from './hulls/hull-m26.js';
import turretM26   from './turrets/turret-m26.js';

// Central parts registry.
// Add new parts here — the hangar and any future equip system imports from this file.
//
// T-55 hull/turret were removed: that model was a cross-source (non-War-Thunder) rip that
// didn't fit the M26-tuned extraction pipeline (missing mantlet, misplaced empties, odd
// scale, needed a 180° facing flip). A War Thunder T-55 will be re-extracted through the
// same pipeline as the M26 and re-registered here. The composition engine (assembleTank,
// measureBase, the alignment chain) is model-agnostic and stays as-is.
export const PARTS = {
  hulls:   [hullM26],
  turrets: [turretM26],
  cannons: [cannon90mm, cannon100mm],
};

// Flat lookup by id — useful for save/load and equip logic.
export const PARTS_BY_ID = Object.fromEntries(
  Object.values(PARTS).flat().map(p => [p.id, p])
);
