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

## The mounting contract: "ring" meets "base"

- A **hull** has a *ring* — the circular opening a turret drops into. Defined by a center
  point on the deck and a diameter.
- A **turret** has a *base* — its circular bottom that seats in the ring. Defined by a
  center point, a diameter, and a base-plane height.

Composition performs three operations:

1. **Center** — align the turret base-center to the hull ring-center (X/Z).
2. **Seat** — drop the turret so its base-plane rests at the hull deck height (no float).
3. **Scale** — uniformly scale the turret so its base diameter equals the ring diameter.

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

## assembleTank algorithm

```
hullBuilt   = hull.build()
turretBuilt = turret.build()            // includes turretBuilt.base measurement

ringDiameter   = nativeRingDiameter(hull)        // cached, see below
scale          = ringDiameter / turretBuilt.base.diameter   // = 1 when turret IS the native

turretPivot.position = hull.ringCenter           // ring center on the deck
turretBuilt.root.parent  = turretPivot
turretBuilt.root.scaling = (scale, scale, scale)
turretBuilt.root.position = base.center.scale(-scale)   // base-center → pivot, base-plane → deck

barrelPivot.position = turretBuilt.mount.scale(scale)   // gun mount tracks the scaled turret
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
- `src/parts/assembleTank.js` — center/seat/scale logic + native-ring-diameter cache.
- `src/scenes/TankDesignerScene.js` — on turret swap, default the cannon to the turret's
  `defaultCannon` before `_rebuildComposed()`.

## Composition self-check (`validateComposition`)

`assembleTank` runs a self-check after building, in dev mode, that asserts the geometric
invariants and `console.warn`s (with the loadout) on any violation. This is the automatic
"is the turret oriented right and does it fit" gate — it catches a 180°-wrong, floating,
off-center, or mis-scaled turret without a human looking, so dropping in a **new** turret GLB
is self-policing. Checks (each with a small tolerance):

1. **Orientation — gun points forward.** `turret.mount.z > 0` in the turret's post-yaw frame
   (the barrel mount / mantlet is on the +Z side of the turret base center). A turret yawed
   the wrong way puts the mount behind center and fails this. Also assert the assembled barrel
   tip has greater world Z than the turret pivot (gun extends game-forward).
2. **Centered.** Turret base-center world X/Z ≈ hull ringCenter X/Z (|Δ| < ~0.05 u).
3. **Seated, not floating/sunk.** Turret base-plane world Y ≈ hull deck Y (|Δ| < ~0.05 u).
4. **Fits.** `turret.base.diameter × scale` ≈ ringDiameter (by construction; asserts the scale
   math and guards bad data).
5. **Sane scale.** `0.3 < scale < 3.0`; outside that range warn (likely a bad base measurement
   or wrong-units GLB) and clamp/fall back to `scale = 1`.

These are cheap (a few vector comparisons) and run only in dev; they don't gate production.

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
