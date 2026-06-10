# TANKING_MODEL_SPEC.md
# Tank Model & World Asset Specification for Claude Code / Fable 5
# Last updated: June 2026
# Purpose: Reference document for procedural asset generation via Blender MCP

---

## HOW TO USE THIS DOCUMENT

You are Claude Code operating as the asset generation agent for TanKING.
Read this entire document before touching Blender.
Every mesh you generate must satisfy the spec for its category.
When the developer reviews your output and gives feedback, update the Blender script — do NOT redesign from scratch unless explicitly asked.
All models are **original meshes built from scratch**. No imported third-party geometry. No derivatives.

---

## GAME CONTEXT

TanKING is a 3D top-down extraction shooter roguelite built in Babylon.js.
Camera is fixed top-down, slightly angled (isometric-ish). Models are viewed from above and at roughly a 45-degree angle.
This matters for modeling priorities: **top silhouette and top-down readability are more important than side detail.**

---

## ART DIRECTION

### Tone
Cozy-apocalypse. The war is real, the tanks are deadly, but the world is charming and vibrant.
Not dark. Not gritty. Not photorealistic. Not cartoon.
The sweet spot: **a world you'd want to live in if it weren't actively trying to kill you.**

### Visual references (aesthetic inspiration, NOT meshes to copy)
- Escape from Duckov — top-down military personality, readable silhouettes
- Deep Rock Galactic — chunky readable proportions, personality in every asset
- Tears of the Kingdom — vibrant colors, worn-but-cheerful world
- War Thunder — real-world tank silhouettes and proportions as visual reference only

### Palette
Bright, vibrant, saturated. No muddy mid-tones. No washed-out pastels.
Colors carry meaning:
- **Red + gold** = TanKING's army
- **Navy + silver** = Tea Dee faction
- **Player tank** = foreign, American-inspired, different design language from Tankford tanks

Each zone has its own palette (see Zone section below).

### Geometry style
- **Chunky, readable proportions.** Wide tracks. Thick armor plates. No wasted curves.
- **Stylized, not simulation.** Slight exaggeration of key features (wider hulls, more pronounced barrels).
- **Low-poly game-ready.** Target: 3,000–8,000 verts per complete tank. Hulls: 1,500–3,000. Turrets: 800–1,500. Guns: 300–600.
- **Top-down readable silhouettes.** From above, each tank class must be instantly distinguishable.
- **Battle-worn surfaces — TEXTURE PASS, not geometry.** Scratches, dents, and worn paint
  edges are texture/decal-domain detail and are **deferred to the later texture pass** (they'd
  fight the vert budget and are invisible from the top-down camera as geometry). In the
  geometry pass, "lived-in" comes from **asymmetric stowage**: a crate on one fender, a
  jerry can here, spare track links there — never mirrored, never tidy.

### What to avoid
- Organic curves or flowing shapes
- Pristine, clean, polished surfaces
- Tiny surface details (invisible from top-down camera)
- Perfectly symmetrical wear patterns
- Anything that looks like a military simulation or horror game asset

---

## MODULAR SLOT SYSTEM

Tanks in TanKING are built from **independent modular parts**. Each part is a self-contained Blender asset.
Do NOT model a complete tank in one mesh.
Model each slot variant as a separate file.

### The slots:
| Slot | Description | Attachment point | Engine status |
|---|---|---|---|
| **Hull** | The chassis — body, tracks, suspension | Base origin (0,0,0) | ✅ Supported (`assembleTank`) |
| **Turret** | The rotating weapon platform | Mounts on hull top-center | ✅ Supported |
| **Gun** | The barrel assembly | Mounts on turret front | ✅ Supported |
| **Armor** | External plating / upgrade layer | Wraps over hull sides and front | ⛔ **DEFERRED** — engine has no armor slot; do not model armor parts until `assembleTank` supports them (future batch) |

### Naming convention:
`[doctrine]_[slot]_[variant]` is the **part id**, used everywhere:
- Generator script: `scripts/modelgen/[doctrine]_[slot]_[variant].py`
- Exported asset: `public/assets/models/tanks/parts/[doctrine]_[slot]_[variant].glb`
- JS part module: `src/tank/parts/{hulls,turrets,cannons}/[doctrine]-[slot]-[variant].js`

Examples: `light_hull_scout`, `heavy_turret_slab`, `medium_gun_75mm`

---

## INTEGRATION CONTRACT — ENGINE INTERFACE (READ BEFORE MODELING)

The composition engine (`src/tank/parts/assembleTank.js`) stacks hull → turret → gun via
mount points and validates the result. **A model that violates this section will not
compose, no matter how good it looks.** This is the contract every part must satisfy.

### Game-space conventions
- Babylon.js, left-handed, **Y = up**, **+Z = tank forward** (barrel points +Z).
- 1 unit = 1 meter game-scale.
- **Scale anchor:** the current composed M26 player tank is **3.4 units wide**. The Batch 0
  calibration locks exact numbers; Batch 1 review includes a side-by-side footprint check
  against the composed M26 in the designer before dimensions are accepted.

### Per-slot origin + mount requirements (in the exported GLB, as loaded by Babylon)

**Hull**
- Origin at ground center: centered in X/Z, lowest point at y=0.
- Must contain an **empty named `turret`** at the turret-ring center (where the turret seats).
  The JS module reads it as `ringCenter`. Sanity: x≈0, y ≈ hull-top height, z near hull center
  (working M26 reference: ≈ `(0, 0.80, 0.05)`).

**Turret**
- **Origin at the ring center** — geometry centered on its ring in X/Z, ring contact surface
  at y≈0. The engine seats the turret origin onto the hull's `turret` empty and rotates the
  turret about a detected basket center; an authored turret centered on its ring makes that
  detection a no-op (offset ≈ 0), which is the goal.
- Must contain an **empty named `mount`** at the gun trunnion (where the barrel attaches).
  **`mount` must be forward of the origin (+Z > 0)** — `validateComposition` warns if not
  (working M26 reference: ≈ `(0, 0.14, 1.83)`).

**Gun**
- Barrel base (breech face) at origin, tube extending along **GLB up axis**, with the JS part
  module applying `root.rotation.x = Math.PI/2` **after parenting** (the existing cannon
  module pattern — see `cannon-90mm.js`). Net runtime result: tube along +Z, muzzle at +Z max.

### Standard ring diameter — REQUIRED for the classless frankentank
The engine scales an equipped turret so its base diameter matches the hull's native ring
(`measureBase` + `nativeRingDiameter`). Extracted models needed that adaptivity; authored
models must instead **share ONE standard ring diameter across all doctrines** so every
hull × turret cross-mix composes at scale = 1 with no overhang:

- `STANDARD_RING_DIAMETER = ⟨measure in Batch 0 — see Priority Build Order⟩`
- Every turret's base cylinder uses this diameter. Every hull's ring/seat is sized to it.
- Doctrine identity comes from the mass ABOVE the ring (slab vs rounded vs open), never
  from ring size. A huge heavy turret on a tiny scout hull looking slightly absurd is
  **on-tone and intended** — that's the frankentank fantasy.

### JS part module contract (one per part, registered in `src/tank/parts/index.js`)
- Hull `build(scene, paintOverride)` → `{ root, meshes, mount, ringCenter }`; module declares
  `mountEmpty: 'turret'` and `nativeTurret: '<turret-id>'`.
- Turret `build(scene, paintOverride)` → `{ root, meshes, mount, base }` (`base` via
  `measureBase`); module declares `mountEmpty: 'mount'` and `defaultCannon`.
- Gun `build(scene, material)` → `{ root, meshes, breech }`.
- Follow `hull-m26.js` / `turret-m26.js` / `cannon-90mm.js` as the templates.

### Engine validation (what the dev build warns about)
`validateComposition` checks every composed loadout: turret `mount.z > 0` (gun on the front),
composition scale within 0.3–3.0, barrel tip forward of the barrel pivot, barrel pivot not
behind the turret pivot. Authored parts must pass all four silently.

### Mesh naming = paint behavior (kills the old skip-list debt)
`applyModelPaint` paints every mesh EXCEPT names matching its `UNPAINTABLE` keywords
(`track`, `tread`, `wheel`, `sprocket`, `idler`, `roller`, `suspension`, `tire`, `exhaust`,
`muffler`, `lens`, `optic`, `periscope`, `antenna`, `mg`/`machinegun`, `rubber`, `engine`, …
see `src/utils/modelPaint.js`). Therefore:
- **Name every mesh semantically**: `hull_body`, `track_left`, `track_right`, `wheel_road_1`,
  `turret_shell`, `exhaust_pipe`, `stowage_crate`…
- Running gear and fittings that should stay unpainted metal MUST carry one of the
  unpaintable keywords in their mesh name.
- **`paintSkipMeshes` lists are FORBIDDEN for authored models** — they exist only as legacy
  support for extracted `Object_N` meshes. Set `obj.data.name = obj.name` before export so
  glTF mesh names survive the round-trip.

---

## TANK DOCTRINES

There are three tank doctrines in Tankford. Each has a distinct visual language.
The player's tank can equip parts from any doctrine — that's what makes them unique.
Enemy tanks in each zone use that zone's doctrine exclusively.

---

### DOCTRINE 1: LIGHT (World 1 — The Iron Keep)

**Fantasy:** Fast, fragile, dangerous at range. Scouts, skirmishers, glass cannons.
**Real-world inspiration:** Stuart M3, BT-7, Panzerkampfwagen II — small, wheeled or narrow-tracked, low profile.
**Tankford visual language:** Lighter colors, faster-looking shapes, exposed components, lighter heraldry markings.

#### Light Hull variants:

**`light_hull_scout`**
- Long, narrow chassis. Length ~4.5m equivalent, width ~2m.
- Narrow rubber-padded tracks or small road wheels visible on sides.
- Low profile — hull height ~1m. Very flat silhouette from above.
- Slightly sloped front glacis (30–40 degree angle).
- Engine deck at rear with visible vents/grilles.
- No skirt armor. Suspension exposed.
- Top-down shape: elongated oval, narrow.

**`light_hull_wheeled`**
- Similar dimensions to scout but on 6 or 8 large road wheels (no tracks).
- Wider wheel arches visible from the side.
- Slightly higher off the ground. More aggressive looking.
- Top-down shape: rectangle with rounded wheel bulges at sides.

#### Light Turret variants:

**`light_turret_open`**
- Small, circular, open-top turret. Think exposed ring mount.
- Crew-visible well from above (no hatch cover — open).
- Low profile, sits close to hull.
- Simple rounded form, no stowage bins.

**`light_turret_enclosed`**
- Small closed turret. Rounded, slightly sloped sides.
- Single hatch on top.
- Commander's cupola optional (small bump on top-right).
- Still small and light — not imposing.

#### Light Gun variants:

**`light_gun_smallcaliber`**
- Short, thin barrel. ~1.5m length in-game scale.
- 37mm–57mm feel. Slender, not threatening.
- Simple muzzle brake or bare muzzle.

**`light_gun_longbarrel`**
- Long thin barrel. ~2.5m. Higher velocity feel.
- This is the Light doctrine's "upgrade" — trading bulk for reach.
- Slight barrel droop for character.

---

### DOCTRINE 2: MEDIUM (World 2 — Ashrock)

**Fantasy:** Balanced. Can fight at any range. The backbone of Tankford's army.
**Real-world inspiration:** Sherman M4, T-34, Panzer IV — medium weight, versatile, readable turrets.
**Tankford visual language:** Warm desert tones, sand-dusted surfaces, campaign markings, more armor bulk than Light but still mobile.

#### Medium Hull variants:

**`medium_hull_standard`**
- Wide, boxy chassis. Length ~5m, width ~2.8m.
- Wide tracks with visible return rollers along the top.
- Moderate hull height ~1.4m. Clear front/rear split.
- Slight front slope, vertical sides.
- Storage boxes visible on rear hull.
- Fender skirts optional on this variant (half-covering tracks).
- Top-down shape: wide rectangle, tracks visible on both sides.

**`medium_hull_assault`**
- Shorter, squatter variant. Lower silhouette than standard.
- Extra front armor visible — additional plate bolted on.
- Wider stance. Heavier feel.
- More hull details: tow hooks, spare track links on front plate.

#### Medium Turret variants:

**`medium_turret_cast`**
- Classic rounded cast steel turret. Sherman-esque.
- Visible weld seams on top. Single commander hatch.
- Storage bustle at rear (box-like protrusion at back of turret).
- Gun mantlet visible at front — curved armor around gun mount.

**`medium_turret_angular`**
- Faceted, angled turret. More T-34 influence.
- Flat angled surfaces rather than cast curves.
- Smaller profile than cast. Slightly lower.

#### Medium Gun variants:

**`medium_gun_75mm`**
- Medium length barrel. ~2m. 75mm feel.
- Wide, confident muzzle brake (double-baffle).
- This is the "standard" look. Balanced proportions.

**`medium_gun_howitzer`**
- Short, fat barrel. ~1.2m. 105mm howitzer feel.
- Very wide bore opening. Stubby and menacing up close.
- No muzzle brake — bare wide muzzle.

---

### DOCTRINE 3: HEAVY (World 3 — Frostholm)

**Fantasy:** Slow, devastating, near-impenetrable. Rolling fortresses.
**Real-world inspiration:** Tiger I, IS-2, Churchill — massive, angular, slab-sided armor.
**Tankford visual language:** Cold grays and deep blues, frost-dusted surfaces, imposing Tankford insignia, thick slab armor geometry.

#### Heavy Hull variants:

**`heavy_hull_fortress`**
- Massive, wide chassis. Length ~6m, width ~3.5m.
- Very wide tracks — double-width appearance. Thick and imposing.
- Tall hull height ~1.8m. Boxy, almost wall-like front.
- Vertical front plate with thick angled upper section.
- Visible track guards/skirts covering upper track run.
- Heavy tow cables coiled on rear.
- Top-down shape: very wide rectangle, skirts extending beyond hull edges.

**`heavy_hull_sloped`**
- Similar mass to fortress but with dramatically sloped surfaces.
- IS-2 inspired — wide front slope, almost angled at 60 degrees.
- Lower overall height but wider.
- Fewer sharp edges, more angled planes.

#### Heavy Turret variants:

**`heavy_turret_slab`**
- Massive boxy turret. Tiger I feel.
- Flat vertical sides, thick mantle, no elegance.
- Commander's cupola prominent on top.
- Large rear bustle for ammunition/counterweight.
- This turret should look genuinely intimidating from above.

**`heavy_turret_rounded`**
- Large but more rounded. IS-2 feel.
- Curved sides, wide gun mantlet.
- Still imposing — larger than any Medium turret — but less angular.

#### Heavy Gun variants:

**`heavy_gun_88mm`**
- Long, thick barrel. ~3m. Classic 88mm feel.
- Prominent double-baffle muzzle brake.
- The signature gun of the Heavy doctrine. Iconic silhouette.

**`heavy_gun_152mm`**
- Short, very wide barrel. Howitzer/assault gun feel.
- ~1.5m but enormous bore. Intimidating up close.
- No muzzle brake. The opening should look like it can end a fight.

---

### DOCTRINE 4: PLAYER TANK (Outsider / American-inspired)

**Fantasy:** The player is a foreign outsider. Their tank looks *wrong* for Tankford. That's the point.
**Visual language:** American WWII/Cold War aesthetic. M4 Sherman meets M48 Patton. Clearly foreign. Different design language from everything in Tankford.
**Key visual distinction:** Rounded, welded, practical. Less ornate than Tankford tanks. More utilitarian. Clearly manufactured elsewhere.

#### Player Hull:

**`player_hull_base`**
- Medium-weight chassis. Not as narrow as Light, not as massive as Heavy.
- Distinctive American rounded hull corners (not sharp angles).
- Visible weld lines on hull sides.
- Round-headed bolts along armor plate edges (distinctive American detail).
- Hull hatches on top (driver + co-driver positions).
- Unique identifier: **no Tankford heraldry**. Plain painted surfaces. Foreign.
- Top-down shape: rectangle with noticeably rounded front corners vs. Tankford tanks.

#### Player Turret (starting):

**`player_turret_base`**
- Round cast turret. M4A3 feel.
- Clear foreign silhouette — wider and rounder than any Tankford turret.
- Single hatch top-center.
- Simple gun mantlet.
- Should look like it came from somewhere else entirely.

#### Player Gun (starting):

**`player_gun_75mm_start`**
- Standard medium barrel. Starting weapon.
- Matches `medium_gun_75mm` proportions but mounted on foreign turret.
- Nothing special about it — this is your humble beginning.

---

## SPECIAL ASSETS

### Long Boi (Tea Dee's legendary cannon)
- Based on the FV4005 Stage II concept — a comically oversized gun on a thin turret.
- The barrel should be **absurdly long**. ~5m barrel on a medium-weight turret.
- Thin, almost inadequate-looking turret ring compared to the gun mass.
- 183mm bore feel — the muzzle opening should look ridiculous.
- This is intentionally funny AND epic. Lean into both.
- Color: Tea Dee navy and silver.

### TanKING Boss Tank
- The most advanced, most imposing tank in Tankford. Abrams equivalent in this world.
- Must visually dwarf all other tanks.
- **Heavy doctrine base** but with unique royal additions: gold trim, Tankford royal insignia, elaborate gun mantlet.
- Stained glass-inspired color accents (World 4 environment reference).
- Should feel like a final boss — unmistakably the most powerful thing in the game.
- Top-down footprint: ~20% larger than any Heavy hull.

---

## WORLD ZONES — ENVIRONMENT ASSET NOTES

| Zone | Biome | Time of Day | Palette | Tank Doctrine |
|---|---|---|---|---|
| World 1 — The Iron Keep | Green fields, rolling hills | Bright midday sun | Bright greens, warm golds, clear sky blue | Light |
| World 2 — Ashrock | Desert, rock formations | Orange sunset | Deep orange, burnt sienna, long purple shadows | Medium |
| World 3 — Frostholm | Frozen tundra, snowdrifts | Overcast grey (blizzard near fortress) | Cold whites, deep greys, ice blue | Heavy |
| World 4 — The Cathedral | WWII European city, cobblestones, grand buildings | Bright sunny day | Warm stone, cream facades, TanKING red+gold banners | TanKING |

### Zone environment assets needed (per zone):
- Ground tile (terrain surface — zone-specific material)
- Destructible cover object x2 (e.g., stone wall, sand berm, snowbank, market stall)
- Ambient scatter props x2 (barrels, crates, banners — zone-flavored)
- Zone fortress gate (World 1–3) or Cathedral entrance (World 4)

---

## BLENDER WORKFLOW INSTRUCTIONS

### Setup
- Installed Blender is **5.1.x** — the API surface this spec uses (primitives, modifiers,
  glTF export) is compatible; don't target 3.x-only behavior.
- **Generation runs HEADLESS, not through the MCP**: one checked-in script per part at
  `scripts/modelgen/<part_id>.py`, run via
  `blender --background --python scripts/modelgen/<part_id>.py`.
  Scripts in git = reproducible, diffable, re-runnable assets ("assets as code"). Shared
  helpers (ring builder, track builder, export) live in `scripts/modelgen/_lib.py`.
- The **Blender MCP is for REVIEW only** — viewport screenshots, live inspection, quick
  experiments. Anything that changes a model gets folded back into its script.
- Start each script with: `import bpy; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()`
  (clear scene before generating)
- Use metric units. 1 Blender unit = 1 meter game-scale.

### Modeling approach
1. Build from primitive shapes (boxes, cylinders, spheres)
2. Apply modifiers (bevel, solidify, boolean) rather than manual vertex editing where possible
3. Keep geometry clean — no doubles, correct normals, manifold meshes
4. Apply all transforms before export (`bpy.ops.object.transform_apply`).
   *Note: the old extraction-pipeline rule "never transform_apply" applied to IMPORTED
   Sketchfab hierarchies with baked root corrections — it does NOT apply to from-scratch
   authored models, where applying transforms is correct and required.*
5. **Axis mapping is locked in Batch 0, not assumed.** Blender→glTF→Babylon axis conversion
   has burned this project before. Batch 0 exports a calibration part with an unambiguous
   front marker, loads it in the designer, and records the verified Blender-side authoring
   axes (up / forward) in this section. Every subsequent script uses the recorded convention.

### Materials (placeholder)
- Assign flat diffuse materials with the correct base color for each doctrine
- Do NOT apply textures in the spec pass — texture/UV pass comes later
- Use these base hex colors as flat shaders:
  - Light doctrine: `#8BB87A` (muted sage green)
  - Medium doctrine: `#C8A96E` (desert sand)
  - Heavy doctrine: `#6B7B8D` (cold steel blue-grey)
  - Player tank: `#5C7A4E` (American olive drab)
  - Tea Dee: `#2D4A7A` (navy)
  - TanKING elite: `#8B1A1A` with `#C9A84C` trim (deep red + gold)

> **How paint actually works at runtime:** `applyModelPaint` REPLACES paintable meshes'
> materials with a flat `StandardMaterial` in the part's `PAINT.paintColor` (player paint is a
> runtime override). The Blender base colors above are fallbacks/preview — what ships is the
> JS-side color. Use `StandardMaterial`-friendly flat colors; the project deliberately avoids
> PBR (no HDR environment — see ART_DIRECTION).
>
> ⚠️ **OPEN DECISION:** this spec says player tank = olive drab `#5C7A4E`, but the current
> in-game player paint is cobalt blue `(0.12, 0.42, 0.88)` per ART_DIRECTION. Resolve with the
> developer at Batch 1 review — until then, build geometry; color is a one-line change.

### Export
- Export as `.glb` (glTF binary) for Babylon.js compatibility
- One file per part
- Place exports in **`public/assets/models/tanks/parts/`** (the live runtime path —
  `_assets/` does not exist), filename = `<part_id>.glb`
- The export must INCLUDE the part's mount empty (`turret` on hulls, `mount` on turrets) —
  see the Integration Contract
- Set `obj.data.name = obj.name` on every mesh before export (keeps semantic names intact
  for the paint system)
- Verify each export: `node architecture/verify-model.mjs <file>.glb` for orientation
  screenshots, then load it composed in the designer (T from menu) and confirm zero
  `[validateComposition]` warnings in the console

### Feedback loop
When the developer reviews a generated model and provides feedback:
- Read the feedback carefully
- Adjust ONLY the specific parameters mentioned
- Re-run the script and export
- Do not redesign unless explicitly told to start over

---

## PRIORITY BUILD ORDER

Build in this order. Stop and await developer review after each batch.

**Batch 0 — Calibration + pipeline template (no art, ~minutes)**
0a. Measure the composed M26 in the designer: record its logged turret base diameter
    (`[turret-m26] base … diameter=` in the console) → set `STANDARD_RING_DIAMETER` in the
    Integration Contract; record hull footprint (width 3.4 ref) as the player-tank size anchor.
0b. Write `scripts/modelgen/_lib.py` + one throwaway calibration part (box hull with a front
    marker + `turret` empty) → export → load composed in the designer. Verifies the full
    script→GLB→part-module→`assembleTank` chain and locks the Blender authoring axes
    (record them in the Workflow section).

**⚠️ BATCH 1 IS THE GO/NO-GO GATE.** This project tried procedural parts once before (the
photoreal cannons) and they failed the developer's visual bar — that's why extraction
existed. The stylized target makes procedural viable, but it must PROVE it: if the composed
Batch-1 player tank doesn't hit the visual bar after a reasonable feedback loop, STOP and
reassess the art-source strategy before any work on Batches 2–6.

**Batch 1 — Player tank (so the main game character exists)**
1. `player_hull_base`
2. `player_turret_base`
3. `player_gun_75mm_start`

**Batch 2 — Light doctrine (World 1 enemies)**
4. `light_hull_scout`
5. `light_turret_enclosed`
6. `light_gun_smallcaliber`

**Batch 3 — Medium doctrine (World 2 enemies)**
7. `medium_hull_standard`
8. `medium_turret_cast`
9. `medium_gun_75mm`

**Batch 4 — Heavy doctrine (World 3 enemies)**
10. `heavy_hull_fortress`
11. `heavy_turret_slab`
12. `heavy_gun_88mm`

**Batch 5 — Special assets**
13. `player_turret_base` variants (additional turrets from loot)
14. `long_boi` (Tea Dee cannon)
15. `tanking_boss` (final boss tank)

**Batch 6 — Additional part variants**
16. Remaining hull/turret/gun variants per doctrine

---

*This document is the single source of truth for asset generation.*
*Do not proceed with environment assets until Batch 1–4 tanks are developer-approved.*
*When in doubt: simpler geometry, stronger silhouette.*
