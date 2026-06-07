# BLENDER_MODELING_GUIDE.md
# Instructions for Claude Code — TanKING 3D Asset Production via BlenderMCP

Read this entire document before beginning any modeling task.
This is your operating manual for producing game-ready 3D assets via the BlenderMCP connection.

---

## The Game

**TanKING** — a 3D top-down extraction shooter roguelite.
Player builds a customizable tank from modular parts, drops into a dystopian battlefield, fights enemies, extracts with loot.

**Engine:** Babylon.js (browser-based)
**Camera:** Top-down, slight angle, fixed perspective
**Style:** Dystopian mechanical sci-fi — "beautiful in a bleak way"
**References:** Armored Core, The Forever Winter, Escape from Duckov

---

## Rule Zero — Never Skip This

**After every significant modeling step, take a viewport screenshot.**
Inspect what you see. Identify what is wrong. Iterate before moving on.
Do not deliver a model without having visually reviewed it through the viewport.
Do not ask the user to review something you have not already assessed yourself.

---

## The Modeling Workflow

Follow this exact sequence for every asset:

### Step 1 — Identify the approach
Before writing a single line of Python, decide:
- Can this be downloaded from Sketchfab and modified? (preferred)
- Can Hyper3D Rodin or Hunyuan3D generate a better base mesh than raw Python? (preferred for organic/complex shapes)
- Should this be built from scratch with modifiers? (only for simple geometric forms)

**Raw Python mesh construction is the last resort, not the first.**

### Step 2 — Build the base form only
Start with the largest, most defining shape. No details yet.
- Hull = just the armored box with correct proportions and angled surfaces
- Turret = just the base cylinder/dome shape
- Gun barrel = just a cylinder of the right length and thickness

Take a viewport screenshot. Confirm proportions are correct before proceeding.

### Step 3 — Add structure with modifiers
Apply in this order where appropriate:
1. **Mirror Modifier** — for anything symmetrical (most tank parts)
2. **Subdivision Surface** — for smoothing, level 1 or 2 only
3. **Solidify** — for panel thickness and weight
4. **Bevel** — for chamfered edges (tanks have rounded edges, not knife-sharp ones)
5. **Array** — for track links, vents, repeated elements
6. **Boolean** — for hatches, vents, recessed panels

Apply modifiers one at a time. Screenshot after each modifier is added to verify the result.

### Step 4 — Add surface detail
Only after the overall shape is confirmed correct:
- Panel lines (shallow inset geometry along logical structural seams)
- Bolt heads or weld lines along panel joints
- Vent slots, exhaust ports, sensor pods
- Battle damage (dents, scarring, bent plating) — subtle, not overdone

Screenshot after each detail pass.

### Step 5 — UV Unwrap
- Use Smart UV Project for a fast pass
- Then manually fix any obviously bad islands
- Ensure no UV islands overlap
- Pack islands efficiently — leave 2px padding between islands for texture bleeding

### Step 6 — Apply Materials
Pull from PolyHaven via MCP whenever possible. Do not use Blender's default flat materials on any final asset.

See the **Material Standards** section below.

### Step 7 — Export
Export as **GLB format** for Babylon.js.
Confirm the exported file loads correctly in a fresh Blender session before declaring the asset done.

---

## Technical Standards

### Polygon budget (triangles, not quads)
These are hard targets for the top-down camera perspective.
Do not exceed these. Going over wastes browser GPU budget.

| Part | Triangle target | Hard maximum |
|------|----------------|--------------|
| Tank chassis / hull | 2,500 | 4,000 |
| Turret assembly | 1,200 | 2,000 |
| Main weapon / gun | 600 | 1,000 |
| Booster unit | 400 | 800 |
| Armor plate set | 500 | 800 |
| **Full tank (all parts combined)** | **5,200** | **8,000** |

The top-down camera means players never see fine surface detail up close.
Prioritize correct silhouette and proportion over polygon density.

### Topology rules
- Quads only on the base mesh before modifiers. No triangles, no n-gons.
- Avoid poles (vertices with more than 5 edges) except where unavoidable.
- Edge loops should follow logical structural/mechanical contours.
- The mesh should deform cleanly if animated (even if it will not be animated — good topology is always the goal).

### Scale
- 1 Blender unit = 1 meter in Babylon.js
- A heavy tank hull should be approximately 6m x 3.5m x 2m (L x W x H)
- A light tank hull should be approximately 4.5m x 2.5m x 1.5m
- Turrets sit approximately 0.8-1.2m above the hull surface
- Set origin point to the bottom center of each part for easy placement in Babylon.js

### Naming conventions
Name every object, mesh, material, and UV map clearly:

```
chassis_heavy_hull
chassis_heavy_tracks_L
chassis_heavy_tracks_R
turret_cannon_base
turret_cannon_barrel
weapon_autocannon_body
booster_heavyburst_left
booster_heavyburst_right
armor_plate_front
armor_plate_side_L
armor_plate_side_R
```

No default Blender names (Cube.001, Cylinder.003, etc.) in the final export.

---

## The Viewport Feedback Loop

This is non-negotiable. Use it on every session.

```
Generate / modify geometry
    ↓
Take viewport screenshot
    ↓
Inspect: proportions, silhouette, surface quality, any visual errors
    ↓
List what is wrong (be specific — "the turret ring is too small", "the bevel is too aggressive")
    ↓
Fix the specific issues
    ↓
Screenshot again
    ↓
Repeat until correct
    ↓
Only then move to the next step
```

Do not move forward until the current step looks right.
Do not ask the user to evaluate something you have not already reviewed yourself.

---

## Asset Integration — Use These First

### Sketchfab (via MCP)
Before modeling anything from scratch, search Sketchfab for a close match.
Filter by: Free to use, downloadable, GLTF format preferred.

Good search queries for this game:
- "sci-fi tank"
- "armored vehicle"
- "mech hull"
- "military turret"
- "sci-fi cannon"
- "track suspension"

If a result is close but not exact: download it, import it, use it as proportional reference or as a base to heavily modify. This is dramatically faster than building from nothing.

### Hyper3D Rodin / Hunyuan3D (via MCP)
Use these for organic or complex shapes where Python geometry would look mechanical and wrong.
Provide detailed text descriptions. Be specific about:
- Shape and proportions
- Style (mechanical, industrial, sci-fi, weathered)
- Key distinguishing features

After generation: always review, retopologize if needed, apply proper materials.
AI-generated meshes often need cleanup — check for holes, bad normals, excessively high poly counts.

### PolyHaven (via MCP)
Use PolyHaven for all materials on final assets. Do not use flat Blender materials.

Recommended searches for TanKING assets:
- "metal plate" — hull surfaces
- "rust" — weathered accents and damage
- "painted metal" — turret surfaces
- "concrete" — base/floor materials
- "gravel" — ground surfaces

Download the texture set (diffuse, roughness, metallic, normal) and apply as a PBR material.

---

## Aesthetic Direction

Every asset must align with these principles.

### The core aesthetic
- **Dystopian, mechanical, not digital.** Everything looks physical, fabricated, heavy.
- **Cold gunmetal world.** The base palette is grays: warm dark gray, cold dark gray, mid steel, light steel.
- **The only color is light and fire.** Accent colors come from LED strips (cold cyan), warning lights (hot red), incandescent light sources (warm orange), and explosions. Apply these sparingly as emissive materials.
- **Battle-worn, not pristine.** Every surface shows use — scratches, grime, slight warping, worn paint edges.
- **Brutal proportions.** Tanks are HEAVY. Wide tracks, thick armor, no wasted curves. If it looks too elegant, it is wrong.

### Reference games for visual direction
- The Forever Winter — bleak battlefield atmosphere, rusted industrial equipment
- Armored Core 6 — mechanical density, angular mech design language
- Escape from Duckov — gritty top-down military aesthetic

### What to avoid
- Clean, polished, pristine surfaces (this is not a space game)
- Organic curves and flowing shapes (this is not a creature game)
- Bright primary colors (the only color comes from lights)
- Over-detailed surface noise (remember: top-down camera, no one sees tiny details)
- Symmetrical, "manufactured" looking wear patterns (damage and grime should feel random)

---

## Parts to Build — TanKING Slot System

The game uses a modular slot system. Model each part as a separate, self-contained asset.
Do not model a whole tank. Model each slot variant independently.

### Slot 1 — Chassis (the tank body)

**Heavy Chassis**
- Wide, very low to the ground, massive track coverage
- Front armor heavily sloped (60° angle)
- Thick side skirts covering the upper track area
- Small commander's hatch on top rear
- Visible tow hooks and recovery equipment on front
- Feeling: unmoveable, impenetrable

**Balanced Chassis**
- Medium proportions, recognizable tank silhouette
- Moderate armor slope on front
- Standard track width
- The reference point — not too heavy, not too light

**Light Chassis**
- Narrow, taller relative to width, faster-looking proportions
- Thinner armor plating
- Exposed track sections (less side skirt coverage)
- More angles and cutouts — weight reduction aesthetic
- Feeling: quick but fragile

**Mech Chassis** (V1.1 — build later)
- Bipedal frame, top-down visible as two leg supports
- No tracks — leg pad contact points
- Slightly higher ground clearance than tanks
- Same torso/turret mount as tanks for modularity

### Slot 2 — Turrets / Main Weapons

**Cannon**
- Single large caliber barrel, long and heavy
- Prominent mantlet housing (the armored gun mount)
- Visible recoil system (cylindrical housing behind the barrel)
- Slow, deliberate feeling in the design

**Autocannon**
- Multiple smaller barrels (3-5) clustered or in a rotary configuration
- Lighter, more mechanical looking
- Feed mechanism visible on the side

**Mortar**
- Short, wide barrel angled upward
- Larger breech than barrel
- Sturdy bipod/mount structure
- Stubby, squat feeling

**Railgun**
- Very long, very thin barrel — almost impossibly so
- Electromagnetic rails running along the barrel length (visible parallel rails)
- Power conduit leading from turret base to breach
- High-tech aesthetic but still mechanical

**Missile Pod**
- Box-shaped housing, no barrel
- Visible missile tube openings (4-6 tubes)
- Targeting sensor cluster on the front face
- Boxy, industrial

### Slot 3 — Boosters

All boosters mount as rear/side attachments on the chassis.

**Long-burst Booster**
- Single large thruster nozzle
- Fuel tank housing integrated into the body
- Industrial, simple, functional looking

**Short-snap Booster**
- Four small nozzles in a quad arrangement
- Quick-release appearance — looks like it fires in sharp bursts
- More compact than long-burst

**Heavy Booster**
- Massive single thruster, oversized for the chassis
- Exhaust deflector plate
- Fuel lines visible running to the engine compartment

**Light Booster**
- Minimal, aerodynamic housing
- Two small angled nozzles
- Looks almost too small to make a difference

### Slot 4 — Armor Plating

Armor is add-on plating that visually attaches to the chassis sides and front.

**Heavy Plating**
- Thick, overlapping plates — reactive armor aesthetic
- Bolted-on appearance with visible mounting hardware
- Covers most exposed surface area

**Medium Plating**
- Single layer of angled plates
- Less coverage than heavy but more than light

**Light Plating**
- Minimal add-on panels
- Looks almost like afterthought protection
- Leaves track areas exposed

---

## Material Standards

### Base material setup for all metal surfaces
Use a Principled BSDF node with PolyHaven textures:

```
Base Color: PolyHaven metal texture (diffuse)
Metallic: PolyHaven metallic map
Roughness: PolyHaven roughness map
Normal: PolyHaven normal map
```

### Weathering / damage pass
After base material, add a second material layer or use Blender's texture paint to add:
- Edge highlighting (lighter color at sharp edges — paint worn off)
- Grime accumulation in recesses (darker, desaturated)
- Rust streaks running downward from joins and bolts
- Scratches and scuff marks along operational surfaces

### Emissive accents (use sparingly)
These are the only color in the world. Apply as a separate emissive material on small, specific surfaces:
- LED strips or warning lights: cold cyan (#00BFFF) or hot red (#FF2200)
- Cockpit/sensor glow: dim amber (#FF8C00)
- Thruster glow: bright white-blue (#C0E8FF) at nozzle exit
- DO NOT apply emissive to large surfaces. Tiny glowing dots only.

### Ground / arena surfaces
- Concrete: cracked, stained, grime-covered
- Mud / scorched earth: non-reflective, dark
- Metal grating: where appropriate for industrial zones
- All surfaces should read as cold, wet, and used

---

## Export Requirements for Babylon.js

### Format
- **GLB (binary GLTF)** — always this format
- Do not export FBX, OBJ, or any other format unless specifically requested

### Export checklist before delivery
- [ ] All modifiers applied before export
- [ ] All objects named correctly (no Cube.001 etc.)
- [ ] Origin point set to bottom center of each part
- [ ] Scale applied (Ctrl+A → Apply Scale)
- [ ] Rotation applied (Ctrl+A → Apply Rotation)
- [ ] UV map present and non-overlapping
- [ ] Materials baked or embedded in GLB
- [ ] Poly count within budget (see Technical Standards)
- [ ] Normals correct (no inverted faces — check with Face Orientation overlay)
- [ ] File tested by importing into a fresh Blender session

### Babylon.js material mapping
When the asset is imported in Babylon.js, it will use `PBRMaterial`.
Ensure your material nodes in Blender map cleanly:
- Base Color → albedo
- Metallic → metallic
- Roughness → roughness  
- Normal Map → bumpTexture
- Emissive → emissiveColor / emissiveTexture

---

## Session Structure

Each modeling session should have ONE clearly defined deliverable.
Do not try to build an entire tank in one session.

**Good session scope:**
- "Model the heavy chassis hull base form, no details"
- "Add track assemblies to the existing heavy chassis"
- "Build the cannon turret and weapon"
- "Apply PolyHaven materials and weathering to the heavy chassis"
- "UV unwrap and export the heavy chassis as GLB"

**Bad session scope:**
- "Build me a tank"
- "Do all the chassis variants"
- "Model everything in slot 2"

If the user's request is too broad, break it down into smaller sessions and confirm the order before starting.

---

## Quality Checklist

Before calling any asset done, verify:

- [ ] Viewport screenshot reviewed at multiple angles (top, front, side, 3/4 perspective)
- [ ] Proportions feel correct for a top-down game camera
- [ ] Silhouette reads clearly from overhead
- [ ] No visible mesh errors (holes, flipped normals, floating geometry)
- [ ] Modifier stack applied cleanly
- [ ] Materials applied and look intentional (no default gray)
- [ ] Weathering / wear makes the asset feel used
- [ ] Polygon count within budget
- [ ] Origin point at bottom center
- [ ] Scale and rotation applied
- [ ] Named correctly
- [ ] Exported as GLB and verified

---

*This document is the operating standard for all 3D asset production on TanKING.
If you are unsure about any decision — ask before proceeding.*
