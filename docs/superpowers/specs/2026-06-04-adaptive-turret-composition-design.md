# Adaptive Turret Composition — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Context:** TanKING tank designer. Turrets and hulls are extracted GLB parts composed at
runtime by `src/parts/assembleTank.js`. The current composition assumes a turret's origin
is its ring center and does no scaling, so swapped turrets sit off-center, float, mis-size,
and (T-55) face the wrong way.

## Goal

Make **any** turret seat correctly on **any** hull, automatically: centered over the hull's
ring, resting on the deck (no float), and uniformly scaled so its base fits the ring. Adding
a new turret or hull GLB should require no hand-tuned offset numbers.

## The alignment chain (explicit, uniform, self-checking)

Composition is a chain of explicit, named alignment links: **hull → turret → barrel**. Every
part exposes the same shape of interface — an *attach frame* it seats into, and (if it carries
a child) an *attach point* it offers the next part. Composition walks the chain aligning each
link; `validateComposition` checks each link. This is what makes the process repeatable: a new
hull/turret/cannon just implements the same interface, and the checks confirm it aligned right
without anyone eyeballing it.

| Part | Seats into (its attach frame) | Offers to child (attach point) |
|------|-------------------------------|--------------------------------|
| Hull | — (root reference frame)      | `ring = { center{x,y,z}, diameter }` |
| Turret | hull `ring` (via its `base`) | `mount` (barrel attach point) |
| Barrel / cannon | turret `mount` (via its `breech`) | — (leaf) |

- A **hull** has a *ring* — the circular opening a turret drops into (center on the deck +
  diameter). The hull is the root frame everything else aligns to.
- A **turret** has a *base* — its circular bottom that seats in the ring (center, diameter,
  base-plane Y) — and a *mount* — where its gun attaches.
- A **barrel/cannon** has a *breech* — its attach point that seats at the turret's mount — and
  points its tube +Z (game-forward).

### Link 1 — turret base → hull ring
**Extraction contract:** a turret GLB is extracted *centered on its ring at the origin*
(both current turrets satisfy this: M26 ≈(0,0), T-55 ≈(0,0)). So composition does NOT
re-center the turret by a measured point — it trusts the origin and:
1. **Place** the turret's origin at the hull ring-center (`turretPivot.position = ringCenter`,
   turret root parented there with no offset).
2. **Scale** — uniformly scale the turret about its origin so its base diameter equals the
   ring diameter. Scaling about the origin keeps the ring at the origin (= at the ring-center).

**Why measure only the diameter, not the center:** empirically (Blender vertex scan), a
turret's lowest slice is dominated by its mantlet/gun-shield, which hangs down and forward —
so the bottom-slice *center* is skewed (M26 reads Z≈+0.6 at every slice depth) and is NOT the
ring center. The bottom-slice *extent* is still a fine proportional proxy for ring size. So
`measureBase` is used for `diameter` only; centering is delegated to the extraction contract
and the hull's `ringCenter` (the forward offset that fixes "too far back" lives on the hull).

### Link 2 — barrel breech → turret mount
4. **Attach** — place the barrel pivot at the turret's `mount × scale` (mount tracks the scaled
   turret), and seat the cannon's `breech` there.
5. **Aim** — the cannon tube points +Z so it emerges from the mantlet, game-forward.

## Where the numbers come from

### Hull declares
- `nativeTurret` — the id of the hull's own original turret (e.g. `hull-m26` → `turret-m26`).
- `ringCenter` — `{ x, y, z }`. `x`/`z` = ring center on the deck; `y` = deck height where the
  turret base rests. (This generalizes the existing `mount` value.)

The hull does **not** store a ring diameter. The ring diameter is **derived** = the measured
base diameter of the hull's `nativeTurret`. This is the "auto-fit to native ring" rule: each
hull's ring is exactly as big as the turret it was born with.

### Turret auto-measures its own base (in `build()`)
Returns, alongside `{ root, meshes, mount }`:
- `base` — `{ center: Vector3, diameter: number, y: number }`

**Measurement algorithm** (run in `build()` while the turret root sits at origin with only its
yaw applied — so mesh world positions equal the post-yaw, pre-scale frame):
1. Gather all turret mesh vertex positions in world space
   (`mesh.getVerticesData(PositionKind)` × `mesh.getWorldMatrix()`).
2. Find `yMin`, `yMax` over those vertices (turret vertical extent).
3. Bottom slice = vertices with `y <= yMin + 0.15 * (yMax - yMin)`. (Overhangs — bustle,
   mantlet, antenna — are higher, so the slice is the true seating ring.)
4. `base.center` = XZ midpoint of the bottom-slice bounding box, at `y = yMin`.
5. `base.diameter` = `max(Xextent, Zextent)` of the bottom slice.
6. `base.y` = `yMin`.

Using the bottom slice (not the whole-turret bounding box) is what fixes the "too far back"
symptom: the rear bustle no longer skews the center.

### Turret also declares
- `defaultCannon` — the turret's own gun id (`turret-m26` → `cannon-90mm`,
  `turret-t55` → `cannon-100mm`). Used to default the cannon when a turret is swapped.

### Cannon exposes its breech (attach point)
The cannon already builds with its tube along +Z and its rear at the root origin. Make that
explicit: the cannon returns `breech` — the local point that seats at the turret mount (the
origin by extraction convention) — and the build guarantees the tube extends +Z from it. This
gives the barrel the same explicit alignment interface as the turret, so the chain is uniform
and the barrel link is checkable rather than assumed.

## assembleTank algorithm

```
hullBuilt   = hull.build()
turretBuilt = turret.build()            // includes turretBuilt.base measurement

ringDiameter   = nativeRingDiameter(hull)        // cached, see below
scale          = ringDiameter / turretBuilt.base.diameter   // = 1 when turret IS the native

turretPivot.position = hull.ringCenter           // ring center on the deck
turretBuilt.root.parent   = turretPivot
turretBuilt.root.scaling  = (scale, scale, scale)  // scale about origin; ring stays at origin
// no position offset — the turret is already centered on its ring at the origin

// barrelPivot is a sibling of the turret root; the mount scales about the origin too.
barrelPivot.position = turretBuilt.mount.scale(scale)
barrelPivot.parent   = turretPivot
cannon.root.parent   = barrelPivot      // cannon keeps its own real-world size (not turret-scaled)
```

Note the yaw fix (`root.rotation.y` for the T-55 turret) is already baked into `root` and into
the base measurement frame, so scaling and the position offset compose correctly on top of it.

### nativeRingDiameter(hull) — cache
The hull's ring diameter is its native turret's `base.diameter`.
- If the equipped turret **is** the native turret, reuse the just-measured `base.diameter`
  (no extra work; `scale` = 1).
- Otherwise, look up a module-level `Map<turretId, number>` cache. On a miss, build the native
  turret once off the equipped path, read `base.diameter`, dispose it, and cache the number.
  One GLB load per turret-type, once per session.

Stock tanks (native turret) get `scale = 1`, so they render exactly as today **plus** the
centering/seating correctness.

## Bug fixes folded in (prerequisites for correct appearance)

- **T-55 hull faces backward.** After the turret yaw fix the turret faces +Z (game-forward)
  but the hull still faces −Z. Flip the T-55 hull to +Z with the same 180° yaw approach
  (`root.rotation.y = Math.PI` in `hull-t55.js`), and define its `ringCenter` in the post-yaw
  frame (x = 0 centered, z = real ring offset forward, y = deck).
- **Wrong default cannon.** When a turret is swapped in the designer, set the equipped cannon
  to that turret's `defaultCannon` (kills the "blue 90mm on the T-55"). The user can still
  pick any cannon from the dropdown afterward.
- **Barrel sticking out.** The barrel mount now scales and seats with the turret
  (`barrelPivot = mount × scale`), so the gun sits in the mantlet instead of floating forward.

## Files touched

- `src/parts/hulls/hull-m26.js`, `hull-t55.js` — add `nativeTurret`; fix T-55 facing + `ringCenter`.
- `src/parts/turrets/turret-m26.js`, `turret-t55.js` — auto-measure `base`; add `defaultCannon`.
  Factor the measurement into a shared helper (`src/parts/measureBase.js`) so every turret and
  any future turret uses the same code.
- `src/parts/cannons/cannon-90mm.js`, `cannon-100mm.js` — expose explicit `breech` attach point.
- `src/parts/assembleTank.js` — alignment chain (center/seat/scale + barrel attach), native-ring
  cache, and `validateComposition` self-check.
- `src/scenes/TankDesignerScene.js` — on turret swap, default the cannon to the turret's
  `defaultCannon` before `_rebuildComposed()`.

## Composition self-check (`validateComposition`)

`assembleTank` runs a self-check after building, in dev mode, that asserts the geometric
invariants and `console.warn`s (with the loadout) on any violation. This is the automatic
"is the turret oriented right and does it fit" gate — it catches a 180°-wrong, floating,
off-center, or mis-scaled turret without a human looking, so dropping in a **new** turret GLB
is self-policing. Checks (each with a small tolerance):

The checks are the ones that are *reliable* given the mantlet skew — they police orientation,
fit, and aim (the failure modes we actually hit), while X/Z/Y centering is guaranteed by the
extraction contract + `ringCenter` rather than re-measured (a re-measured center would
false-fail on the mantlet).

**Link 1 — turret on hull:**
1. **Turret orientation — gun on the front.** `turret.mount.z > 0` (the barrel mount is forward
   of the turret origin). A turret yawed 180° wrong puts the mount behind the origin and fails.
2. **Fits / sane scale.** `0.3 < scale < 3.0`; outside that range warn (bad base measurement or
   wrong-units GLB) and clamp/fall back to `scale = 1`.

**Link 2 — barrel on turret:**
3. **Barrel aimed forward.** The cannon's furthest world +Z point is ahead of the barrel pivot
   (the tube extends game-forward), and the barrel pivot is forward of the turret pivot.

These are cheap (a few comparisons) and run only in dev; they don't gate production. Any failure
`console.warn`s the loadout and which link failed, so a bad new part is named, not just suspected.
(Centering/seating remain on the visual-verification checklist below.)

## Visual verification

Programmatic checks confirm the numbers; the eye confirms it *looks* right. Drive the designer
headlessly (Playwright) and screenshot all four combinations, confirming for each:
- Turret centered over the hull (no left/right or front/back drift).
- Turret seated on the deck (no gap, not sunk).
- Turret sized sensibly for the hull (base fills the ring; not oversized/undersized).
- Barrel emerges from the mantlet, pointing game-forward (+Z), matching the hull facing.
- All four: M26+M26, T-55+T-55, M26 hull + T-55 turret, T-55 hull + M26 turret.

The plan's verification step is **not complete** until both the self-check passes (no warnings)
**and** the four screenshots are confirmed by eye. Also re-run the leak stress check
(≥20 hull switches, zero errors) since assembleTank changes.

## Edge cases & decisions

- **Uniform scale only** — preserves each turret's own shape; no non-uniform squashing.
- **Cannon is not turret-scaled** — a 90mm gun is the same size on any turret; only its mount
  point moves with the scaled turret.
- **Antenna/thin protrusions** — naturally excluded from the base measurement because they sit
  above the bottom slice.
- **Degenerate measurement** (e.g. base.diameter ≈ 0) — fall back to `scale = 1` and log a
  warning, so a bad GLB can't divide-by-zero or vanish.

## Out of scope (future)

- Routing gameplay (`ArenaScene`) through this composed path.
- Loadout persistence / hangar slot picker.
- M26 turret center-of-rotation tweak (separate minor item).
