import cannon90mm  from './cannons/cannon-90mm.js';
import cannon100mm from './cannons/cannon-100mm.js';
import hullM26     from './hulls/hull-m26.js';
import hullT55     from './hulls/hull-t55.js';
import turretM26   from './turrets/turret-m26.js';
import turretT55   from './turrets/turret-t55.js';

// Central parts registry.
// Add new parts here — the hangar and any future equip system imports from this file.
export const PARTS = {
  hulls:   [hullM26, hullT55],
  turrets: [turretM26, turretT55],
  cannons: [cannon90mm, cannon100mm],
};

// Flat lookup by id — useful for save/load and equip logic.
export const PARTS_BY_ID = Object.fromEntries(
  Object.values(PARTS).flat().map(p => [p.id, p])
);
