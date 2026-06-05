import cannon90mm   from './cannons/cannon-90mm.js';
import cannonT44100 from './cannons/cannon-t44-100mm.js';
import hullM26      from './hulls/hull-m26.js';
import hullT44      from './hulls/hull-t44.js';
import turretM26    from './turrets/turret-m26.js';
import turretT44    from './turrets/turret-t44.js';

// Central parts registry.
// Add new parts here — the hangar and any future equip system imports from this file.
//
// T-44-100 (War Thunder) replaced the cross-source T-55, which is fully removed. The T-44 GLB
// had no rig empties (web-optimized) and fused mantlet+barrel, so it's handled by extract-t44.py
// (bisect + measured trunnion + its own barrel cannon). The composition engine is model-agnostic.
export const PARTS = {
  hulls:   [hullM26, hullT44],
  turrets: [turretM26, turretT44],
  cannons: [cannon90mm, cannonT44100],
};

// Flat lookup by id — useful for save/load and equip logic.
export const PARTS_BY_ID = Object.fromEntries(
  Object.values(PARTS).flat().map(p => [p.id, p])
);
