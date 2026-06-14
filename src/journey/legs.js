// src/journey/legs.js
// Hard-authored leg pool for the P0 Long Road (no procedural content yet beyond
// ordering). Each leg = a drivable stretch (reuses ArenaScene) + the exit kinds
// reachable from it. fuelCost = fuel burned crossing the stretch at a steady drive.
// zoneVariant maps to src/world/zones/world1.js exports (added in a later task;
// callers fall back to base WORLD1 if a variant is missing).

export const LEG_POOL = [
  {
    id: 'perimeter-edge',
    name: 'THE PERIMETER — OUTER FIELDS',
    zoneVariant: 'WORLD1_LEG_A',
    fuelCost: 55,
    exits: ['town', 'field'],
  },
  {
    id: 'perimeter-mid',
    name: 'THE PERIMETER — BROKEN ROAD',
    zoneVariant: 'WORLD1_LEG_B',
    fuelCost: 55,
    exits: ['town', 'field'],
  },
  {
    id: 'perimeter-gate',
    name: 'THE PERIMETER — RELAY GATE',
    zoneVariant: 'WORLD1_LEG_C',
    fuelCost: 40,
    exits: [], // final leg ends in extraction, no fork
  },
];

export const MAX_FUEL = 100;
