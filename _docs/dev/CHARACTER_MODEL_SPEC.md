# CHARACTER_MODEL_SPEC.md
# Original mini-character generation for TanKING — spec + pipeline
# Status: v1 (2026-06-10). Companion to TANKING_MODEL_SPEC.md — same philosophy:
# integration contract enforced by code, params as canon, mockup/gate process,
# detail doctrine, trap log. Executable by ANY Claude session.

---

## WHY

All tanks are original meshes; the hub characters are still third-party (Kenney mini
characters + dormant KayKit pack). These are **CC0 — legally safe**; replacing them is
an ownership/craft decision. Target: **detail parity with the Kenney minis**, generated
procedurally so characters are assets-as-code like everything else.

---

## INTEGRATION CONTRACT — what `src/hub/DriverCharacter.js` requires (verified by code read)

A replacement character GLB MUST provide:

1. **The standard skeleton** — 7 bones, identical names/order across ALL variants
   (cross-variant head grafting depends on it):
   `root` → `leg-left`, `leg-right`, `torso` → `arm-left`, `arm-right`, `head`
2. **Exactly two skinned meshes**: `body-mesh` (torso+limbs+outfit) and `head-mesh`
   (head+hair+face), BOTH bound to the same skeleton. ONE material per mesh —
   color blocking via **vertex colors** (multiple materials would make Babylon split
   primitives into extra meshes and break the 2-mesh contract).
3. **Scale/facing**: bind-pose height ≈ **0.67u**, character faces **+Z** in game
   (author facing **−Y** in Blender, per the calibrated axis mapping). Runtime scales
   ×2.5 into the 1.8u driver capsule.
4. **Head bone** named to match `/(^|[^a-z])head/i` — accessories attach to it.
5. **AnimationGroups named `idle` and `walk`** (the two the game triggers). More clips
   are welcome (`sit`, `interact`, …) but not required.
6. **Accessories**: separate small static (unskinned) GLBs authored around the head
   origin; the engine attaches them to the head bone.

Engine knobs if proportions differ: `MODEL_SCALE` / `MODEL_YAW` in DriverCharacter.js.

---

## ART DIRECTION

Chunky toylike mini, matching the Kenney silhouette so all engine conventions carry:
- **Big head**: head ≈ 38–42% of total height (chibi). Mitten hands, blocky limbs,
  no necks-to-speak-of, oversized boots.
- TanKING palette: warm saturated outfit colors; driver default = worker
  jumpsuit + cap vibes (cozy-apocalypse, not military-grim).
- Faces are **geometric** (small dark eye meshes + brow boxes — chunky-cute), not
  textured: zero texture dependency, survives any palette change.

## DETAIL DOCTRINE — character edition (same 4 rules as tanks)

| Tier | Camera | Carries |
|---|---|---|
| Primary | hangar follow-cam | silhouette: hair shape + outfit color blocking |
| Secondary | lounge/crew panel | hair mesh, collar/jacket, belt+buckle, boots, cuffs, pockets |
| Tertiary | close-up | eyes/brows, buttons, patches, bootlaces |

Budget ≤ 3k verts/character. Every detail nameable by function; symmetric =
manufactured (buttons), asymmetric = lived-in (patch, rolled sleeve).

## SKINNING STANDARD — rigid per-part

Every vertex weighted **100% to exactly one** of the 7 bones. Implementation: each
part primitive gets a vertex group named exactly after its bone (all verts, weight
1.0) BEFORE joining into `body-mesh` / `head-mesh`. No weight painting — deterministic,
regen-safe, and correct for the blocky style (Kenney minis are effectively rigid too).
Joints overlap visually (sphere shoulders/hips inside torso) so rigid rotation doesn't
open gaps.

## ANIMATION STANDARD — procedural keyframes

Authored in `_charlib.py` as pose-keyframe tables on the 7 bones; exported as TWO
Blender **actions named `idle` and `walk`** (glTF ACTIONS export mode → Babylon
AnimationGroups of the same names — verified in Batch C0).
- `idle` ~2.4s loop: torso breathing bob, subtle alternating arm sway, small head tilt.
  First frame == last frame (clean loop).
- `walk` ~0.8s loop: opposite leg/arm swing (sin phases), torso bob ×2 per cycle,
  slight forward lean.
Bone conventions for predictable axes: all bones authored straight (legs/torso/head
vertical, arms hanging vertical at the sides), roll 0 → swinging forward/back is
rotation about bone-local **X** everywhere.

## VARIANT SYSTEM

ONE parametric generator (`scripts/modelgen/char_mini.py`) + one params JSON per
character (`scripts/modelgen/params/char_<id>.json`): skin tone, hair style + color,
outfit (jacket/pants/boots/cap colors), build (height/width factors), face params.
The 12 crew presets = 12 small JSONs. The role-NPCs (the Mechanic, the Merchant, the
Healer — names deferred per the v3 AI pivot) = the same system + their signature
accessory/outfit params.

## WORKFLOW (same loop as tanks)

1. Mockup/calibration gate → 2. generate from params → 3. user feedback (params edits +
pins on screenshots; character tuner tab is a future follow-up) → 4. detail pass →
5. finalize: verify LIVE in the hangar (idle plays, walk plays while moving, accessory
attaches, head-graft works both directions vs an existing character), build green,
commit canon + GLB.

## BATCHES

- **C0 — calibration**: crash-dummy character through the full chain (armature → rigid
  skin → 2 actions → GLB → DriverCharacter). Locks export settings + axes. ✍ findings
  below.
- **C1 — first real character (GO/NO-GO gate)**: full Detail Doctrine parity, judged
  side-by-side against Kenney M1 in the lounge. Fail after fair iteration → stop,
  keep CC0 assets (legal fallback).
- **C2**: 12 crew preset JSONs; swap `DRIVER_CHARACTERS`; retire Kenney GLBs.
- **C3**: original accessories (glasses, shades, mask + new: cap, headset, beanie).
- **C4**: the role-NPCs (Mechanic/Merchant/Healer — names deferred) for the bunker.
- **Cleanup**: delete dormant KayKit pack (unused by code).

## TRAP LOG (seeded by C0 — append every new trap)

- **C0 VERIFIED (2026-06-10):** the full chain works first-try with `_charlib.py`'s
  exact recipe — armature built in EDIT mode, rigid vertex-group skinning, ONE
  vertex-color material, actions pushed to NLA, `export_animation_mode='ACTIONS'`.
  GLB inspection showed the exact contract: meshes `[body-mesh, head-mesh]`, one skin
  with the 7 joints in order, animations `[idle, walk]`, COLOR_0 present. In-engine:
  idle/walk trigger correctly, accessory attaches, and a Kenney head grafts onto our
  body (and vice versa) — cross-source skeleton compatibility proven.
- **NEVER transform_apply characters** (armature breaks) — author at identity; bevel
  modifiers are fine (apply them per-part BEFORE joining).
- Babylon imports the vertex-color material as PBRMaterial — looks correct in scenes
  with hemispheric light; keep roughness high (≥0.85) to avoid the no-envmap grey trap.
- Rapid live `setDriverConfig` churn (graft → accessory → graft in one frame burst) can
  leave the driver model in a stale invisible state — a scene reload always recovers;
  not an asset issue. Verify with FRESH loads.
- Exporter pads AnimationGroup frame ranges (idle authored 1–58 reported as 0–145) —
  harmless, clips still loop correctly; don't chase it.
- **SUBSURF SHRINKS** boxes toward their centers — fitted multi-piece forms (hair!)
  contract into floating "pancakes" with gaps. For the Kenney-organic look on fitted
  pieces: BEVEL (3 segments) + smooth shading (no shrink) + ≥0.02 geometric overlap
  between pieces so masses read as one connected form.
- Hair/hat/face color VARIANTS are one model + color dots in the UI (registry emits
  `{model, label, variants:[{id, cw, hex}]}`) — never N near-identical buttons.
