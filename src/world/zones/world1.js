// src/world/zones/world1.js
// WORLD 1 — GREEN FIELDS. Data-only zone config: the single source of truth for
// this zone's layout, palette, spawns, and loot. Authored from the user-approved
// world1-mockup.html (2026-06-11) — keep positions in sync with that mockup.
// This is the "future zone is just another object of this same form" promised
// in arenaLoot.js, expanded to a full zone description.
//
// Coordinates: playable XZ within ±bounds.half; south (-z) = bunker tunnel,
// north (+z) = the Iron Keep. Depth bands scale difficulty heading north.

export const WORLD1 = {
  id: 'world1',
  name: 'WORLD 1 — GREEN FIELDS',

  // Playable half-extent (clamps) and visual half-extent (hill skirt ring).
  bounds: { half: 140, visual: 170 },

  // Player spawn: just north of the tunnel mouth, facing north into the fields.
  spawn: { x: 0, z: -128, facing: 0 },

  // Extraction = drive back to the tunnel mouth and channel.
  extraction: { x: 0, z: -134, radius: 4 },

  // Band boundaries: z where each band ENDS (heading north).
  bands: { near: -110, mid: -30, deep: 60 },

  // ART_DIRECTION.md World-1 hues.
  palette: {
    grass:  [0.42, 0.75, 0.31],   // #6BBF4E bright field green
    path:   [0.77, 0.66, 0.51],   // #C4A882 dirt tan
    sky:    [0.53, 0.81, 0.92],   // #87CEEB midday blue
    banner: [0.80, 0.125, 0.125], // #CC2020 Tankford red
  },

  // Dirt paths as waypoint chains (built as flat hard-edged strips).
  paths: {
    main: [[0,-132],[0,-112],[-4,-95],[-10,-80],[2,-58],[10,-30],[8,-18],[10,2],
           [20,28],[24,46],[26,62],[30,80],[28,96],[18,112],[6,126],[0,138]],
    storeSpur: [[-10,-80],[-25,-74],[-40,-71]],
  },

  // Hedgerows: cover + obstacles. len runs along local Z; ry≈1.57 → east-west.
  hedgerows: [
    // NEAR band (sparse singles)
    { x:-30, z:-85, len:26, ry:0.2 }, { x:-52, z:-60, len:20, ry:1.57 }, { x:30, z:-70, len:24, ry:-0.3 },
    { x:55, z:-95, len:18, ry:1.2 }, { x:-80, z:-95, len:22, ry:0.9 },
    // MID band (bocage network)
    { x:-20, z:-16, len:34, ry:1.57 }, { x:-37, z:0, len:30, ry:0 }, { x:-5, z:8, len:26, ry:0 },
    { x:30, z:-8, len:24, ry:1.57 }, { x:42, z:12, len:28, ry:0.35 }, { x:60, z:30, len:24, ry:1.57 },
    { x:-58, z:28, len:30, ry:0.15 }, { x:-30, z:42, len:26, ry:1.57 }, { x:0, z:48, len:30, ry:0.1 },
    { x:44, z:56, len:22, ry:0.9 }, { x:-75, z:8, len:24, ry:1.0 },
    // DEEP band (field edges near the village)
    { x:-15, z:72, len:26, ry:0.3 }, { x:55, z:78, len:22, ry:1.57 }, { x:-45, z:100, len:24, ry:0.2 },
    { x:60, z:110, len:20, ry:0.7 },
  ],

  // Low stone walls (cover; village field edges).
  walls: [
    { x:14, z:84, len:18, ry:1.57 }, { x:44, z:90, len:18, ry:0 },
    { x:28, z:104, len:20, ry:1.57 }, { x:-62, z:-30, len:22, ry:0.4 },
  ],

  // Tall-grass concealment patches; amb=1 marks ambusher hides (tinted per art dir).
  grassPatches: [
    { x:-38, z:-78, r:8, amb:1 }, { x:-20, z:-10, r:7, amb:1 }, { x:55, z:25, r:8, amb:1 },
    { x:-5, z:50, r:7, amb:1 }, { x:45, z:95, r:7, amb:1 }, { x:15, z:100, r:6, amb:1 },
    { x:-50, z:115, r:8, amb:1 }, { x:-86, z:93, r:7, amb:1 }, { x:79, z:101, r:6, amb:1 },
    { x:-93, z:21, r:8 },
    { x:20, z:-95, r:9 }, { x:-65, z:-85, r:8 }, { x:70, z:-40, r:10 }, { x:-45, z:55, r:8 },
    { x:30, z:30, r:7 }, { x:-80, z:75, r:9 }, { x:75, z:55, r:8 }, { x:0, z:-60, r:9 }, { x:-10, z:105, r:7 },
  ],

  trees: [
    [-34,-92],[-26,-78],[58,-88],[24,-64],[-58,-52],[-88,-70],[70,-60],[85,-30],
    [-44,-6],[-12,12],[24,18],[50,40],[-66,36],[-84,60],[8,42],[66,64],[-22,66],[-52,108],
    [70,100],[40,120],[-8,118],[-78,-10],[78,8],[-100,30],[100,-60],[90,80],
    // border-skirt silhouette trees (on the hills, y from terrain height)
    [-150,-60],[152,20],[-148,80],[150,120],[-60,150],[80,148],[120,-150],[-110,-148],
  ],

  rocks: [
    [-70,-40],[15,-30],[48,-15],[-40,20],[35,35],[-15,90],[52,68],[-90,90],[20,-110],[-20,-50],
  ],

  fences: [
    { x:22, z:70, len:16, ry:0.3 }, { x:36, z:74, len:14, ry:1.2 },
    { x:-18, z:-100, len:14, ry:1.0 }, { x:80, z:20, len:12, ry:1.3 },
  ],

  // Landmark POIs (geometry built by the zone builder; no quest logic yet).
  pois: {
    merchantStore: { x:-45, z:-70, ry:0.25 },       // the Merchant's burnt-out store, NEAR band
    wreck:      { x:-95, z:18,  ry:0.7  },          // crashed outsider machine, MID west
    farmstead:  { x:88,  z:28,  ry:-0.2 },          // barn + hay bales, MID east
    watchtower: { x:-92, z:100 },                   // broken turret, DEEP west (guarded)
    checkpoint: { x:85,  z:95,  ry:0.15 },          // Tankford post, DEEP east (guarded)
    ironKeep:   { x:0,   z:166 },                   // vista on the north hill (unreachable)
  },

  // Fixed enemy spawns (design rule: positions are map knowledge).
  // mode 'patrol' roams/chases on sight; 'ambush' sits hidden until sprung.
  enemies: [
    // NEAR (3)
    { x:12,  z:-95, mode:'patrol', band:'near' },
    { x:-38, z:-78, mode:'ambush', band:'near' },
    { x:35,  z:-55, mode:'patrol', band:'near' },
    // MID (5)
    { x:-20, z:-10, mode:'ambush', band:'mid' },
    { x:25,  z:5,   mode:'patrol', band:'mid' },
    { x:55,  z:25,  mode:'ambush', band:'mid' },
    { x:-50, z:30,  mode:'patrol', band:'mid' },
    { x:-5,  z:50,  mode:'ambush', band:'mid' },
    // DEEP (8)
    { x:30,  z:75,  mode:'patrol', band:'deep' },
    { x:45,  z:95,  mode:'ambush', band:'deep' },
    { x:15,  z:100, mode:'ambush', band:'deep' },
    { x:-30, z:90,  mode:'patrol', band:'deep' },
    { x:0,   z:120, mode:'patrol', band:'deep' },
    { x:-50, z:115, mode:'ambush', band:'deep' },
    { x:-86, z:94,  mode:'ambush', band:'deep' },  // watchtower guard
    { x:80,  z:100, mode:'ambush', band:'deep' },  // checkpoint guard
  ],

  // Per-band enemy tuning (consumed by SentinelEnemy). dmg = per-beam hit
  // (heavier than a shell — the beam is telegraphed and dodgeable); cooldown =
  // recovery between charges (the ~1.1s wind-up adds to the real cadence).
  bandTuning: {
    near: { hp: 70,  dmg: 30, cooldown: 1.8 },
    mid:  { hp: 90,  dmg: 38, cooldown: 1.5 },
    deep: { hp: 110, dmg: 46, cooldown: 1.2 },
  },

  // Salvage drops; value scales with depth, flank POIs pay band rate.
  loot: [
    { x:20,  z:-90, value:25 }, { x:-50, z:-65, value:25 }, { x:45, z:-40, value:25 },
    { x:-30, z:0,   value:50 }, { x:60,  z:30,  value:50 }, { x:-60, z:45, value:50 },
    { x:-92, z:14,  value:50 }, { x:84,  z:25,  value:50 },           // wreck + farmstead
    { x:35,  z:92,  value:100 }, { x:-45, z:120, value:100 }, { x:5, z:135, value:100 },
    { x:-90, z:96,  value:100 }, { x:87,  z:98,  value:100 },         // watchtower + checkpoint
  ],
};
