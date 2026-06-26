// src/world/zones/pois/turretBunker.js
// Point-POI: a dug-in Automaton CANNON EMPLACEMENT — the King's roadblock. A low armoured bunker
// with a faceted tank turret + heavy plasma cannon, a glowing red optic + viewport, sat on a
// cleared patch of churned dirt. The first overtly-machine POI of World 1 (the others are
// pastoral): cold manufactured menace dug into the farmland. Model: turret-bunker.glb (Blender).
//
// The CANNON faces SOUTH — down the road toward the direction the player assaults FROM (they drive
// up the leg into the gun). The garrison hides INSIDE and files out the REAR hatch (now facing
// up-road, away from the player) to flank. No loot — it's a machine, not a scavenge site.
// place() = data; build() instances the GLB, lays a dirt apron, sets the red optic GLOWING, blocks
// the bunker mass, and hands ArenaScene the muzzle world-point so the PlasmaTurret's charge glow
// + beam line up to the actual cannon bore.

const ID = 'turret-bunker';
// Cannon bore in the GLB (Blender (0, 3.98, 2.46) → glTF y-up): the beam/charge origin, measured
// from the bunker centre along the cannon direction. DIST = horizontal reach, Y = bore height.
const BORE_DIST = 3.98;
const BORE_Y    = 2.46;
const DEFAULTS = {
  offset: 15,        // a roadblock sits CLOSE to the road (low landmark, gun trained on the lane)
  scale: 1.0,        // turret-bunker.glb is authored at game scale
  faceOffset: 0,     // fine-tune the cannon heading if needed (baseline aim is computed below)
  bunkerHalf: 1.95,  // AABB half-extent blocking the solid bunker mass (turret/cannon are high)
  dirtR: 4.6,        // radius of the churned-earth apron under the emplacement
};

function place(ctx, rand, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { pts, total, dirAt, bandFor, valueFor, anchorIdx } = ctx;
  const p = pts[anchorIdx], d = dirAt(pts, anchorIdx);
  const side = opts.sideForce ?? (rand() < 0.5 ? 1 : -1);   // leg-end pair forces one each side
  const px = -d.z * side, pz = d.x * side;                  // unit perpendicular, off-road
  const off = o.offset + (o.offsetBonus || 0);             // leg may push it farther out (varied distance)
  const bx = p.x + px * off, bz = p.z + pz * off;          // bunker centre

  // CANNON aims down the road toward the player's approach (they assault from the south / lower
  // road index): aim = -roadTangent. Both flanking cannons face the SAME way (at the oncoming
  // player), not across the road at each other. rotY orients the model (cannon = +Y) to that aim.
  const aimAngle = Math.atan2(-d.x, -d.z) + o.faceOffset;
  const rotY = aimAngle + Math.PI;                          // model cannon (+Y) → aimAngle (front conv. is −Y)
  const aimX = Math.sin(aimAngle), aimZ = Math.cos(aimAngle);
  const band = bandFor(anchorIdx / total);

  const props = [
    { name: 'TurretBunker', x: bx, z: bz, scale: o.scale, rotY },
    // a little overgrowth reclaiming the dug-in machine (set clear of the bunker + cannon line)
    { name: 'Bush', x: bx + px * 4.5 - d.x * 4, z: bz + pz * 4.5 - d.z * 4, scale: 1.1, rotY: rand() * Math.PI },
    { name: 'Bush', x: bx + px * 4.5 + d.x * 4, z: bz + pz * 4.5 + d.z * 4, scale: 1.0, rotY: rand() * Math.PI },
  ];

  // Garrison: bots wait INSIDE the bunker and file out the REAR hatch (now facing UP the road,
  // +roadTangent — opposite the south-facing cannon) to flank the player from cover.
  const hatchN = { nx: d.x, nz: d.z };                 // outward through the rear hatch (up-road)
  const ix = bx + d.x * 1.2, iz = bz + d.z * 1.2;      // just inside the bunker, at the rear hatch
  const guards = [
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 0 },
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 1 },
    { x: ix, z: iz, role: 'lurker', door: hatchN, exitOrder: 2 },
    { x: ix, z: iz, role: 'sentry', door: hatchN, exitOrder: 3 },
  ];
  // Live cannon: ArenaScene spawns a static PlasmaTurret that charges + beams along `fireAngle`.
  // The muzzle world-point (the actual bore) drives the charge-glow placement + beam origin.
  const turret = {
    fireAngle: aimAngle,
    muzzle: { x: bx + aimX * BORE_DIST, y: BORE_Y, z: bz + aimZ * BORE_DIST },
  };
  return {
    poiType: ID, anchor: { x: bx, z: bz }, props, enemies: [], loot: [], containers: [],
    bunkerHalf: o.bunkerHalf, dirtR: o.dirtR, clearR: 13, guards, turret,
  };
}

function build(scene, inst, helpers) {
  const meshes = [], obstacles = [], shadowCasters = [];
  // churned-earth apron under the emplacement so it doesn't sit bare on the grass
  if (helpers.dirtPatch) helpers.dirtPatch(inst.anchor.x, inst.anchor.z, inst.dirtR ?? DEFAULTS.dirtR);
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
