# M24 Chaffee — Light Doctrine Tank Design Spec
**Date:** 2026-06-10
**World:** World 1 — The Iron Keep
**Role:** Standard enemy (World 1 grunt — most common encounter)
**Doctrine:** Light

---

## Overview

The M24 Chaffee is the World 1 standard enemy. All three Light doctrine part slots — `light_hull_scout`, `light_turret_enclosed`, and the new `light_gun_75mm` — are designed to faithfully capture the M24 Chaffee's distinctive silhouette in TanKING's stylized aesthetic.

**Real M24 reference:** 5.49m long · 2.97m wide · 2.46m tall · torsion-bar suspension · 5 road wheels + 4 return rollers per side · rear-mounted drive sprocket · twin Cadillac V8 engines · 75mm M6 gun.

---

## Part IDs

| Slot | Part ID | File |
|---|---|---|
| Hull | `light_hull_scout` | `scripts/modelgen/light_hull_scout.py` |
| Turret | `light_turret_enclosed` | `scripts/modelgen/light_turret_enclosed.py` |
| Gun | `light_gun_75mm` | `scripts/modelgen/light_gun_75mm.py` |

All exported to `public/assets/models/tanks/parts/`.

---

## Hull — `light_hull_scout`

### Dimensions (game units, 1u = 1m)
| Property | Value |
|---|---|
| Hull body width | 2.9u |
| Hull body length | 4.8u |
| Hull body height | 1.55u (ground to roof) |
| Ground clearance | 0.42u |
| Total width incl. tracks + fenders | ~3.3u |
| Turret empty `ring` position | approx `(0, 1.55, 0.15)` Blender |

### Geometry elements
**Running gear (all UNPAINTABLE via mesh naming):**
- `track_left` / `track_right` — flat band tracks, full length, 0.18u wide
- `wheel_road_L1–L5` / `wheel_road_R1–R5` — 5 road wheels per side, 0.48u diameter, even torsion-bar spacing
- `wheel_return_L1–L4` / `wheel_return_R1–R4` — 4 small return rollers along track top
- `sprocket_rear_L` / `sprocket_rear_R` — drive sprockets at rear (Chaffee-specific rear drive), toothed edge
- `idler_front_L` / `idler_front_R` — idler wheels at front, slightly smaller than road wheels

**Hull body (PAINTABLE):**
- `hull_body` — main slab with slight rear taper
- `glacis_front` — integrated angled front plate at ~47° from horizontal; NOT a separate floating piece — must flow from the lower front plate into the hull roof as a single unified polygon
- `hull_lower_front` — short near-vertical lower nose plate (~0.2u tall, transmission cover area)
- `engine_deck` — rear top plate, 5px step lower than forward hull section, with vent grilles cut in

**Fittings:**
- `fender_L` / `fender_R` — flat skirt plates over upper track run (iconic Chaffee feature), partial coverage (not front 0.3u, not rear 0.1u)
- `exhaust_L` / `exhaust_R` — twin exhaust stacks on rear engine deck (UNPAINTABLE: `exhaust` keyword)
- `hatch_driver` — driver hatch, left-front hull top
- `hatch_codriver` — co-driver hatch, right-front hull top
- `periscope_driver` — small bump above driver hatch (UNPAINTABLE: `periscope` keyword)
- `mg_hull_front` — hull MG mount, front-right of glacis (UNPAINTABLE: `mg` keyword)

**Tertiary details (Detail Doctrine, ~2k vert budget):**
- `bolt_row_glacis` — bolt row along glacis/hull plate join
- `bolt_row_fender_L` / `bolt_row_fender_R` — bolts along fender attachment edges
- `weld_seam_hull_side` — weld seam at hull side/top junction
- `tow_shackle_L` / `tow_shackle_R` — front hull tow points
- `lifting_eye_L` / `lifting_eye_R` — rear hull lifting points

**Asymmetric stowage (NEVER mirrored):**
- `stowage_jerrycan` — left rear fender top
- `stowage_ammobox` — right rear engine deck

### Blender notes
- Hull faces −Y (forward). Glacis slopes rearward-and-upward at ~47° from horizontal.
- `turret` empty at approx Blender `(0, 0, 1.55)` → game `(0, 1.55, 0)`.
- Use `_lib.make_profile_prism` for hull body; `_lib.make_track_band` for tracks.

---

## Turret — `light_turret_enclosed`

### Dimensions
| Property | Value |
|---|---|
| Turret ring diameter | 1.8u (STANDARD_RING_DIAMETER) |
| Turret body width (lateral) | 1.45u |
| Turret forward half (ring to mantlet face) | 0.70u |
| Turret rear half (ring to bustle front) | 0.68u |
| Bustle depth (beyond turret rear) | 0.40u |
| Turret height above ring | 0.85u |
| `mount` empty position | approx `(0, 0.14, 0.68)` Blender (forward of origin, +Z) |

### Geometry elements
**Turret body (PAINTABLE):**
- `turret_shell` — main cast rounded body; bezier-curved front face rising to flat-ish top, rear slopes to bustle; sides angled slightly inward from base to top
- `turret_bustle` — rear box protrusion, box-like, separate mesh with hinge-line detail at join

**Composite mantlet (all UNPAINTABLE — use `mantlet` keyword or dark material):**
- `mantlet_shield` — outer trapezoidal curved shield plate, protrudes ~0.15u forward of turret face; tapers slightly as it protrudes; weld seam along top, bolt row (4 bolts) along front rim
- `mantlet_rotor` — inner oval rotor bowl, recessed depression; darker shade than shield
- `mantlet_collar` — cylindrical gun collar ring at bowl centre, 6 relief cuts on ring
- `mantlet_sleeve` — short tapered barrel sleeve exiting collar toward gun

**Fittings:**
- `cupola_commander` — commander's cupola, right-of-centre on turret roof; split top hatch, 3 periscope bumps around rim (UNPAINTABLE: use `periscope` or name as `cupola` — keep dark)
- `hatch_gunner` — left-of-centre on turret roof, flush-ish panel

**Tertiary details:**
- `bolt_row_turret_base` — along turret ring/base join
- `weld_seam_turret_top` — top plate weld
- `grab_handle_L` / `grab_handle_R` — side grab handles

### Blender notes
- Origin at ring centre. Geometry centred on ring in X/Z, ring contact surface at y≈0.
- `mount` empty must be at +Z > 0 (forward). Approx Blender `(0, 0.14, 0.68)`.
- Ring base diameter = STANDARD_RING_DIAMETER (from `_lib.py`).

---

## Gun — `light_gun_75mm`

New variant for the Light doctrine. The M24's M6 75mm was derived from an aircraft cannon — medium length, confident double-baffle muzzle brake.

### Dimensions
| Property | Value |
|---|---|
| Total barrel length | 2.1u |
| Breech end diameter | 0.14u |
| Muzzle diameter | 0.09u |
| Muzzle brake overall length | 0.22u |
| Muzzle brake width (each baffle) | 0.28u outer / 0.20u inner |

### Geometry elements
- `gun_barrel` — tapered cylinder, thick at breech, thin at muzzle, tube extending along Blender up-axis (+Z); JS rotates `Math.PI/2` post-parent to point +Z forward
- `gun_breech` — slightly wider breech end box/block
- `brake_outer` — outer muzzle baffle, wider; vent slots cut through each side (3 slots per side)
- `brake_inner` — inner muzzle baffle, narrower, behind outer; vent slots (2 per side)
- `brake_collar` — small ring joining barrel to outer baffle

### Blender notes
- Breech face at origin, barrel extends along +Z (GLB up-axis). JS module applies `root.rotation.x = Math.PI/2` after parenting — same pattern as `cannon-90mm.js`.
- Follow `player_gun_90mm.py` as template; reduce barrel length and bore diameter.

---

## Materials / Paint

| Mesh group | Base colour | Runtime behaviour |
|---|---|---|
| Paintable hull/turret | `#8BB87A` (Light doctrine sage green) | Replaced by `applyModelPaint` at runtime |
| Tracks / wheels / sprockets | Dark rubber/metal (~`#1e1e1e`) | UNPAINTABLE — stays dark |
| Exhaust / MG / periscopes | Near-black | UNPAINTABLE |
| Mantlet / collar | Dark gunmetal (`#28302a`) | UNPAINTABLE — set mesh names with `mantlet` keyword or include in dark material |
| Stowage | Worn brown (`#3a4530`) | Paintable — will take faction colour at runtime |

---

## Integration Contract Compliance

- Hull `turret` empty: x≈0, y≈1.55, z≈0.15 (Blender coords) ✓
- Turret `mount` empty: x≈0, y≈0.14, z≈0.68 (+Z forward) ✓
- Gun barrel origin at breech, extends +Z ✓
- Turret ring diameter = STANDARD_RING_DIAMETER from `_lib.py` ✓
- No `paintSkipMeshes` — all paint control via mesh naming ✓
- `obj.data.name = obj.name` set before export ✓

---

## Workflow

Standard 5-step pipeline per `TANKING_MODEL_SPEC.md`:
1. **Silhouette mockup** — grey variants in one GLB, screenshot in tuner, approve direction
2. **Generator scripts** — one `.py` per part, params in `params/light_tank.json`
3. **Tuner loop** — `node scripts/modelgen/tuner-server.mjs`, `/tuner.html?tank=light`
4. **Detail pass** — tertiary tier via `_details.py`
5. **Finalize** — plain regen bakes stowage, verify composed with ZERO `[validateComposition]` warnings

---

## Params file

`scripts/modelgen/params/light_tank.json` — to be created. Key params:

```json
{
  "hull_length": 4.8,
  "hull_width": 2.9,
  "hull_height": 1.55,
  "ground_clearance": 0.42,
  "glacis_angle_deg": 47,
  "track_width": 0.18,
  "wheel_road_count": 5,
  "wheel_road_diameter": 0.48,
  "wheel_return_count": 4,
  "fender_overhang": 0.12,
  "turret_ring_diameter": 1.8,
  "turret_height": 0.85,
  "turret_forward_half": 0.70,
  "turret_rear_half": 0.68,
  "bustle_depth": 0.40,
  "gun_length": 2.1,
  "gun_bore_diameter": 0.09,
  "light_color": "#8BB87A"
}
```
