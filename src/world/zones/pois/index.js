// src/world/zones/pois/index.js
// POI registry for the Long Road. Each POI type is a self-contained module exporting
// { id, scale:'point'|'segment', place(ctx,rand,opts), build(scene,inst,helpers) }.
// The leg generator (roadLeg.js) picks from POI_LIST during its placement pass; the
// renderer (RoadBuilder.js) dispatches build() via POI_TYPES[inst.poiType].
//
// Add a new POI type = drop a module here and add it to the list. Nothing else changes.

import treePatchCache from './treePatchCache.js';

export const POI_LIST = [
  treePatchCache,
];

export const POI_TYPES = Object.fromEntries(POI_LIST.map((t) => [t.id, t]));
