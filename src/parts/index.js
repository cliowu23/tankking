import cannon90mm   from './cannons/cannon-90mm.js';
import cannon100mm  from './cannons/cannon-100mm.js';
import cannonT44100 from './cannons/cannon-t44-100mm.js';
import hullM26      from './hulls/hull-m26.js';
import hullT44      from './hulls/hull-t44.js';
import turretM26    from './turrets/turret-m26.js';
import turretT44    from './turrets/turret-t44.js';

// Central parts registry.
// Add new parts here — the hangar and any future equip system imports from this file.
//
// T-44-100 (War Thunder) replaced the cross-source T-55. Its GLB had no rig empties (web-
// optimized), so it was extracted by explicit mesh list (architecture/extract-bymesh.py)
// instead of the empty-driven extract-parts.py — but it's a standard-orientation WT model,
// so it composes cleanly with the M26. The composition engine is model-agnostic.
export const PARTS = {
  hulls:   [hullM26, hullT44],
  turrets: [turretM26, turretT44],
  cannons: [cannon90mm, cannon100mm, cannonT44100],
};

// Flat lookup by id — useful for save/load and equip logic.
export const PARTS_BY_ID = Object.fromEntries(
  Object.values(PARTS).flat().map(p => [p.id, p])
);
