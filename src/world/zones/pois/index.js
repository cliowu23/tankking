// src/world/zones/pois/index.js
// POI registry for the Long Road. Each POI type is a self-contained module exporting
// { id, scale:'point'|'segment', place(ctx,rand,opts), build(scene,inst,helpers) }.
// The leg generator (roadLeg.js) picks from POI_LIST during its placement pass; the
// renderer (RoadBuilder.js) dispatches build() via POI_TYPES[inst.poiType].
//
// Add a new POI type = drop a module here and add it to the list. Nothing else changes.

import roadsideHut from './roadsideHut.js';
import miniCamp from './miniCamp.js';
import farmstead from './farmstead.js';
import windmill from './windmill.js';
import turretBunker from './turretBunker.js';

// The MAJOR POIs — one of each is guaranteed per leg (roadLeg.js), with extra random picks on
// top so the count varies. tree-patch is NOT a POI anymore (too mundane / no road); tree clumps
// now spawn as ambient roadside groves instead (see roadLeg.js `groves`).
export const POI_LIST = [
  roadsideHut,
  miniCamp,
  farmstead,
  windmill,
  turretBunker,
];

export const POI_TYPES = Object.fromEntries(POI_LIST.map((t) => [t.id, t]));
