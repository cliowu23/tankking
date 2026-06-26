// src/world/zones/pois/turretBunker.js
// Point-POI: a dug-in Automaton CANNON EMPLACEMENT — the King's roadblock. A low armoured
// bunker with a faceted tank turret + heavy plasma cannon aimed at the road, a glowing red
// optic + viewport. The first overtly-machine POI of World 1 (the others are pastoral): cold
// manufactured menace dug into the farmland. Model: turret-bunker.glb (built in Blender).
// The CANNON faces the road (threat tell on approach); the garrison hides INSIDE and files out
// the REAR hatch (away from the road) to flank — so you see the gun first, then they appear
// from cover. place() = data; build() instances the GLB, sets the red optic/viewport/bore
// GLOWING, and blocks the bunker mass.

const ID = 'turret-bunker';
const DEFAULTS = {
  offset: 15,        // a roadblock sits CLOSE to the road (low landmark, gun trained on the road)
  scale: 1.0,        // turret-bunker.glb is authored at game scale
  chestScale: 1.3,
  lootMult: 2.5,     // a guarded emplacement → solid reward
  faceOffset: Math.PI, // the prop "front" convention is Blender −Y; the CANNON is on +Y, so flip 180° to aim it at the road (hatch then faces away, matching the rear-flank guard exit)
  bunkerHalf: 1.95,  // AABB half-extent blocking the solid bunker mass (turret/cannon are high)
};

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = opts.sideForce ?? (rand() < 0.5 ? 1 : -1);   // leg-end pair forces one each side
  const px = -d.z * side, pz = d.x * side;                  // unit perpendicular, off-road
  const off = o.offset + (o.offsetBonus || 0);             // leg may push it farther out (varied distance)
  const bx = p.x + px * off, bz = p.z + pz * off;          // bunker centre
  const faceRoad = Math.atan2(-px, -pz);                    // toward the road (cannon points here)
  const rotY = faceRoad + o.faceOffset;
  const band = bandFor(anchorIdx / total);

  // loot cache tucked beside the emplacement (clear of the cannon line + the rear hatch)
  const chx = bx + d.x * 5.5, chz = bz + d.z * 5.5;
  const props = [
    { name: 'TurretBunker', x: bx, z: bz, scale: o.scale, rotY },
    { name: 'Chest', x: chx, z: chz, scale: o.chestScale, rotY: faceRoad },
    // a little overgrowth reclaiming the dug-in machine (set clear of the bunker footprint)
    { name: 'Bush', x: bx + px * 4.5 - d.x * 4, z: bz + pz * 4.5 - d.z * 4, scale: 1.1, rotY: rand() * Math.PI },
    { name: 'Bush', x: bx + px * 4.5 + d.x * 4, z: bz + pz * 4.5 + d.z * 4, scale: 1.0, rotY: rand() * Math.PI },
  ];

  const containers = [{ x: chx, z: chz, value: Math.round(valueFor(band) * o.lootMult), radius: 6 }];
  // Garrison: bots wait INSIDE the bunker and file out the REAR hatch (model −Y → world +perp,
  // away from the road) when you arrive — emerging from cover behind the bunker to flank. A
  // Sentinel sentry (eye-on-eye with the turret optic) comes out last.
  const hatchN = { nx: px, nz: pz };                 // outward through the rear hatch (off-road side)
  const ix = bx + px * 1.2, iz = bz + pz * 1.2;      // just inside the bunker, at the rear hatch
  const guards = [
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 0 },
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 1 },
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 2 },
    { x: ix, z: iz, role: 'sentry', door: hatchN, exitOrder: 3 },
  ];
  return { poiType: ID, anchor: { x: bx, z: bz }, props, enemies: [], loot: [], containers, bunkerHalf: o.bunkerHalf, clearR: 13, guards };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  for (const pr of inst.props) {
    let made;
    if (pr.name === 'Bush') made = helpers.makeBush(pr.x, pr.z, pr.scale, pr.rotY);
    else made = helpers.prop(pr.name, pr.x, pr.z, pr.scale, pr.rotY);
    for (const m of made) { meshes.push(m); shadowCasters.push(m); }
  }
  // Make the red optic / viewport / plasma bore GLOW (the prop loader flattens [0.80,0.10,0.10]
  // to a matte flat material; lift its emissive so the King's machine reads as "powered on").
  const redMat = scene.getMaterialByName('propflat_0.80_0.10_0.10');
  if (redMat && redMat.emissiveColor) redMat.emissiveColor.set(0.85, 0.07, 0.07);
  // block the solid bunker mass so you can't drive through it (square AABB ≈ covers any rotation)
  const hh = inst.bunkerHalf ?? DEFAULTS.bunkerHalf;
  obstacles.push({ position: { x: inst.anchor.x, z: inst.anchor.z }, halfW: hh, halfD: hh });
  return { meshes, obstacles, shadowCasters };
}

export default { id: ID, scale: 'point', place, build };
