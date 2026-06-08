// src/world/arenaLoot.js
// Single source of truth for Slice-1 extraction tuning + arena layout.
// Edit values/positions HERE — never inline in entities or ArenaScene.
// Shaped so a future zone is just another object of this same form.

export const CHANNEL_DURATION    = 3;    // seconds holding the pad to extract
export const CRATE_VALUE         = 25;   // salvage granted per crate
export const PICKUP_RADIUS       = 1.5;  // tank-centre distance to auto-collect
export const EXTRACT_ZONE_RADIUS = 3;    // extraction pad radius

// Arena loadout. Positions are world XZ; the tank spawns at (0,0) and is
// clamped to ±48. Crates sit away from spawn so the player must traverse.
export const ARENA_LOOT = {
  salvageCrates: [
    { x: -18, z: -18, value: CRATE_VALUE },
    { x:  18, z: -18, value: CRATE_VALUE },
    { x: -18, z:  18, value: CRATE_VALUE },
    { x:  18, z:  18, value: CRATE_VALUE },
    { x:   0, z:  16, value: CRATE_VALUE },
  ],
  extractionZone: { x: 0, z: -22, radius: EXTRACT_ZONE_RADIUS },
};
