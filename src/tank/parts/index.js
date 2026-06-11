import gunPlayer90  from './cannons/player-gun-90mm.js';
import gunMedium50  from './cannons/medium-gun-50mm.js';
import gunLight75   from './cannons/light-gun-75mm.js';
import hullMedium   from './hulls/medium-hull-standard.js';
import hullLight    from './hulls/light-hull-scout.js';
import turretMedium from './turrets/medium-turret-angular.js';
import turretLight  from './turrets/light-turret-enclosed.js';
import hullCalib    from './hulls/hull-calib.js'; // Batch-0 axis calibration — remove after
import hullPlayer   from './hulls/player-hull-base.js';
import turretPlayer from './turrets/player-turret-base.js';

// Central parts registry.
// Add new parts here — the hangar and any future equip system imports from this file.
//
// T-44-100 (War Thunder) replaced the cross-source T-55, which is fully removed. The T-44 GLB
// had no rig empties (web-optimized) and fused mantlet+barrel, so it's handled by extract-t44.py
// (bisect + measured trunnion + its own barrel cannon). The composition engine is model-agnostic.
export const PARTS = {
  hulls:   [hullPlayer, hullMedium, hullLight, hullCalib],
  turrets: [turretPlayer, turretMedium, turretLight],
  cannons: [gunPlayer90, gunMedium50, gunLight75],
};

// Flat lookup by id — useful for save/load and equip logic.
export const PARTS_BY_ID = Object.fromEntries(
  Object.values(PARTS).flat().map(p => [p.id, p])
);

// The standard player medium tank (original modelgen assets — user canon 2026-06-10).
// Used wherever no saved loadout exists.
export const DEFAULT_LOADOUT = {
  hull:   'player-hull-base',
  turret: 'player-turret-base',
  cannon: 'player-gun-90mm',
};

// Guard for loadouts read from localStorage: stale saves may reference retired
// parts (e.g. the removed WT-era hull-m26) — fall back to the default loadout.
export function validLoadout(loadout) {
  const ok = loadout && PARTS_BY_ID[loadout.hull] && PARTS_BY_ID[loadout.turret]
    && PARTS_BY_ID[loadout.cannon];
  return ok ? loadout : DEFAULT_LOADOUT;
}
