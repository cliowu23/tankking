# TanKING — Art Direction & Visual Design Guide
> The single authoritative visual spec. Read this before modeling any asset, building any environment,
> or making any visual decision. Every asset must pass the question: *"Does this look like it belongs in
> the same world as everything else?"* This document defines what that world looks like.
>
> *Merged from the original v1 spec + the expanded v2 art bible (June 2026). Where they disagreed, the
> newer grounded direction wins — see "Evolution note" below.*
>
> **⭐ v3 AI-PIVOT REFRAME (2026-06-13).** Fiction changed (canonical bible: `_docs/world/TANKING_WORLD.md`).
> Apply globally when reading this doc: **"Tankford" → the King's Network**; **enemy tanks → tank-bots**
> (uniform, identical, glowing sensor-eyes, antenna/network motifs, one cold accent per bot-class — *no
> heraldry/banners*); **player → analog scrappy free tank / frankentank** (not "foreign outsider/American");
> **"the Cathedral" → the Core Citadel / Data-Center Tank**; **"the TanKING" → the King (AI)**; World 4
> architecture shifts cathedral-gothic → data-center-industrial. The **toylike palette stays** — the read is
> *warm hand-built human vs. cold uniform machine.* Per-biome colors and geometry-as-simple-forms guidance
> all still hold.

---

## CORE VISUAL IDENTITY

TanKING has one overarching visual philosophy:

**"Accurate but simplified. Vibrant but grounded."**

Every asset — tank, building, tree, rock, fence — should be immediately recognizable for what it is,
built from clean angular geometry, and colored with intention. Nothing is photoreal. Nothing is purely
abstract. Everything sits in the sweet spot between the two. The world is bright, warm, and inviting — a
**cozy-apocalypse**: broken but charming, a battlefield that feels like a game, not a war.

**Primary references:**
- **After the Flash (ATF) series** — geometry language, modeling approach, asset density, world building
- **Escape from Duckov** — color tone, warmth, cozy-apocalypse energy
- **Deep Rock Galactic** — vibrant color, readable silhouettes, chunky prop design
- **Tears of the Kingdom** — chunky mechanical design, readable from above

**Evolution note:** TanKING's look began as a brighter "Super Mario World × toy-soldier" idea (saturated
primaries, Mario-block walls, Mario-blue sky). That has been **superseded** by the grounded direction
above. We keep the brightness, warmth, and readability of the original; we drop the literal Mario blocks
and cartoon sky in favor of ATF-grounded geometry and per-zone palettes. Both eras share Escape from
Duckov as the tonal anchor.

**The two aesthetic systems.** TanKING deliberately runs two contrasting visual registers:
1. **The gameplay world** — bright, warm, grounded, readable (this whole document).
2. **The UI / HUD layer** — dark, geometric, neon-lit retro-futurism (see "UI / HUD Layer" below).
Like viewing a sunlit toy battlefield through a targeting computer. The contrast is intentional and core
to the identity — don't homogenize them.

---

## GEOMETRY PRINCIPLES

### The ATF Standard
After the Flash is the primary modeling reference. Study it before building any asset.

- **Rectilinear but not rigid** — geometry favors straight edges and flat planes, but is not strictly 90
  degrees. Slight angles, chamfers, and bevels are used deliberately. Nothing feels like a raw Minecraft block.
- **Accurate proportions** — a tank looks like a specific tank, a building looks like a real building type.
  Real-world reference is used but geometry is simplified.
- **Deliberate detail** — detail exists where it matters (panel lines, hatches, edges of interest) and is
  absent where it doesn't (broad flat surfaces stay flat). No noise for its own sake.
- **Weight and solidity** — everything feels heavy and grounded. Thin walls, spindly props, and
  fragile-looking geometry are wrong. Thick walls, chunky edges, solid forms are right.

### Polygon Budget Philosophy
- Low poly does NOT mean no detail — it means efficient detail
- Every polygon should justify its existence
- Broad surfaces stay flat — add detail through edge loops at silhouette edges, not surface subdivision
- Avoid spheres and cylinders with high segment counts — 8-12 sides maximum for rounded elements
- If something won't be visible from the top-down camera, don't model it

### The Top-Down Camera Rule
TanKING is viewed from a top-down perspective. Every asset must be designed with this in mind:

- **Silhouette clarity is everything** — the top profile of an asset is its most important view
- **Vertical detail matters less** — facades and sides matter, but the roof/top surface matters most
- **Scale contrast** — tanks are the protagonists; everything else should feel scaled to make tanks read clearly
- **No fine detail below camera threshold** — if it's invisible from playing height, don't model it

---

## TANK DESIGN

### Player Tank — the analog free tank
- **Style:** **Hand-built, analog, scrappy** — the human opposite of the King's machine-perfect bots
- **Proportions:** Chunky and toylike — wider than realistic, turret slightly oversized, barrel thick and
  stubby initially (upgrades make it more imposing)
- **Geometry:** Clean flat panels with deliberate chamfered edges. Panel lines where armor plates would
  meet. Hatches, bolts, and exhaust ports as accent geometry. **Mismatched salvaged parts** as it becomes a frankentank.
- **Feel:** It looks cobbled together and personal — not factory perfect. This is someone's machine. *(The whole point vs. the enemy's uniformity.)*

### The King's Tank-Bots (enemies)
- **Style:** **Uniform, identical, mass-produced** — clean lines, one cold accent color per bot-class. They read as *one mind, many bodies.*
- **Networked motifs:** **glowing sensor-eyes, antenna/dish details, a unifying network sigil** — NOT heraldry/banners. Machine, not medieval.
- **Scout-bots (World 1):** Small, fast-looking proportions, thin armor plates, angled surfaces
- **Line-bots (World 2):** Balanced, recognizable classic tank silhouette, moderate thickness
- **Siege-bots (World 3):** Thick slab armor, wide and low, brutally simple geometry — blocks of metal
- **Consistency is the read:** every bot of a class is *the same* — sameness = the King; the player's mismatched salvage = humanity.

### Tank Destroyer (Tea Dee — analog holdout)
- **Style:** Distinct from both the player and the King's bots — the analog-holdout visual language
- **Long Boi:** The 183mm cannon is comically oversized. The turret is thin and almost fragile-looking by
  contrast. The barrel extends beyond what seems reasonable. This is intentional and correct.

### General Tank Rules
- Tracks are modeled as flat loop geometry — no individual link detail needed
- Turrets rotate cleanly — model with rotation pivot in mind
- Keep undercarriage simple — it faces the ground and is never seen
- All tanks get a flat color base coat + decal layer for markings and paint jobs
- Player tank paint is fully customizable — UV map must support flat color regions

---

## ENVIRONMENT & TERRAIN

### Terrain Philosophy
Terrain is the stage, tanks are the actors. Terrain should frame and support tank combat without competing with it.

- **Flat planes with intentional elevation changes** — no random organic noise. Hills and rises are
  deliberate and geometric, not naturalistic bumps
- **Hard edges between terrain types** — where grass meets rock meets sand, the transition is clean and
  readable, not blended
- **Grid-friendly layout** — terrain should feel like it was designed on a grid even if it wasn't. Paths
  are straight or cleanly curved. Fields are rectangular. Villages follow a plan.

### World 1 — Green Fields
- Flat bright green terrain, very slight elevation variation
- Hedgerows and stone walls as hard geometric dividers — rectangular, thick, readable
- Village buildings: stone cottage shapes, rectangular footprints, simple pitched roofs
- Tall grass patches: flat card planes in clusters, bright yellow-green; enemy hiding spots marked by
  slightly different grass color
- The Iron Keep: high on a hill with clear geometric ramparts, towers as cylinders with 8 segments max,
  drawbridge as flat planks

**Palette:** Bright grass green `#6BBF4E`, stone grey `#A89880`, dirt path tan `#C4A882`, sky blue
`#87CEEB`, network-sigil red (the King's machines)

### World 2 — Desert
- Flat sand terrain, warm golden tone; rocky outcrops as angular geometric forms — not smooth boulders
- Ruins: rectangular stone blocks + half-buried solar arrays/server racks in the sand, clean right-angle
  geometry, hints of the older machines the King overwrote poking through
- Rock formations: faceted and angular, like low poly crystal forms
- Ashrock plateau: clean flat top, sheer geometric cliff faces, single ramp approach

**Palette:** Sand gold `#D4A853`, rock orange-brown `#A0613A`, sunset orange sky `#FF7043 → #FFB347`,
ruin stone `#8B7355`, shadow purple `#4A3728`

### World 3 — Frozen Tundra
- Flat white-grey terrain, subtle blue tint in shadow areas
- Ice walls: clean faceted geometric crystal forms, slight blue-white transparency feel
- Snow accumulation on surfaces: flat white planes sitting on top of geometry edges
- Frostholm valley: enclosed by sheer ice-cliff geometry walls, one entrance corridor
- Blizzard effect (boss): particle system, reduce visibility, keep geometry simple so particles read

**Palette:** Snow white `#E8EEF0`, ice blue `#B8D4E8`, grey overcast sky `#8899A6`, frozen stone
`#6B7B8A`, King network-red muted `#8B2020`

### World 4 — The Mainframe (data-center capital)
> *AI-pivot note: shift the architecture from cathedral-gothic toward **data-center-industrial** — server towers, cooling stacks, conduit, sensor masts — for a future art pass. Geometry-as-simple-forms guidance below still holds.*
- Wide boulevards: flat grey planes with subtle grid texture or geometry lines
- Buildings: monolithic server-citadels — rectangular blocks, narrow lit slits, cooling-stack rooflines,
  consistent height creating canyon-like streets
- Grand plaza: open flat area, monument to the King at center, surrounding structures taller and more imposing
- The Core Citadel: largest structure in the game — tall vertical geometry housing the King's core; the
  **Data-Center Tank** (the final boss) emerges from it

**Palette:** Concrete grey `#8B8B8B`, structure cream `#D4C9A8`, sunny sky blue `#87CEEB`,
King network-red `#CC2020`, gold accent `#D4A843`

---

## COLOR SYSTEM

### Global Rules
- **Saturation is high** — TanKING is vibrant, not muted. Colors are confident and clear.
- **Value contrast** — dark darks and light lights. No muddy mid-tone everything.
- **Each zone has a dominant hue** — World 1 green, World 2 orange, World 3 blue-grey, World 4 stone
  cream. Everything in a zone sits within that hue family.
- **Player tank paint** — always reads against the environment. A player-painted tank should never
  visually disappear into terrain.
- **Enemy color coding** — Light tanks: lighter colors, faster visual energy. Heavy tanks: dark and
  muted, oppressive. Medium tanks: balanced mid tones.

### Current Implemented Combat Palette
These are the live, in-engine colors tuned for top-down readability (StandardMaterial, no PBR — the bright
no-HDR scene washes PBR out). The player hull is the default paint; it is fully customizable.

| Element | Color |
|---------|-------|
| Player tank hull | Cobalt blue `(0.12, 0.42, 0.88)` — default paint, customizable |
| Player tank turret | Deep cobalt `(0.08, 0.32, 0.75)` |
| Static enemy | Signal red `(0.92, 0.12, 0.08)` |
| AI enemy | Orange `(0.95, 0.42, 0.04)` |
| Shell | Yellow `(1.0, 0.82, 0.0)` with orange emissive (tracer-round look) |
| Tracks / running gear | Near-black `(0.12, 0.12, 0.12)` |

> Ground / wall / sky colors are defined per-zone in the Environment section above — the old single
> "bright grass + golden Mario walls + Mario-blue sky" palette is retired.

### TanKING Heraldry
The TanKING's colors are **deep red and gold**. His banner, his soldiers' markings, his castle flags —
all use this palette. When players see red and gold they know they are in enemy territory.

### Tea Dee Colors
Tea Dee uses **deep navy and silver**. Distinct from TanKING's red, distinct from the player's custom
paint. When players enter Tea Dee territory the color shift communicates neutrality and difference.

---

## UI / HUD LAYER — Retro-Futurist (the second aesthetic system)

The overlay layer (menus, HUD, panels, transitions) deliberately **contrasts** the bright grounded world:
dark, geometric, neon-lit — like viewing a toy battlefield through a targeting computer. This two-system
split is core to the identity; the menu's monochrome retro look is intentional — do not "modernize" it.

**Live "Aqua Arcade" palette (`index.html` CSS vars):**

| Token | Color | Use |
|---|---|---|
| `--bg` | `#050d1a` | page background |
| `--panel` | `#081830` | panel fill |
| `--accent` / `--cyan` / `--blue` | `#00eedd` | primary neon (teal) |
| `--green` | `#55ffbb` | health / hull readouts |
| `--gold` | `#ffcc00` | accents, KING wordmark, diamond corners |
| `--white` | `#ddfff8` | body text |
| `--dim` | `#206878` | inactive text |
| `--danger` | `#e94560` | death screen only |

**In-world holographic panels** (hangar station/customization panels) use a deeper cyan `#00e5ff` on
`rgba(0,8,20,0.93)` panels with 1px glowing borders.

**Rules:**
- Monospace ("Press Start 2P"), uppercase, wide letter-spacing throughout
- 1px neon borders with glow, dark navy panels — no chrome or decoration
- Thin (≈5–12px) glowing bars for HUD meters
- Subtle CRT scanlines overlay; iris / checkerboard screen transitions between states
- `cursor: none` everywhere + a DOM reticle (immune to window re-entry loss); reticle dot is danger-red
- One accent color dominates (teal); gold and green are sparing highlights, danger-red is death-only

---

## LIGHTING

### Global Lighting Approach
- **No dynamic shadows in open world** — flat ambient lighting per zone keeps performance clean and
  maintains the toylike aesthetic. (Real-time shadow maps don't render reliably on the dev Mac's
  WebGL→Metal path anyway; the hangar uses fake **blob** decals for grounding — see ENGINEERING.)
- **Strong directional light** — one clear sun angle per zone, consistent throughout
- **Ambient occlusion** — baked, not real-time. Adds depth to geometry crevices without performance cost
- **Zone sky colors** — the sky IS the mood. Get the sky right and everything else follows.

### Per-Zone Lighting
| Zone | Sky | Sun Angle | Ambient | Mood |
|---|---|---|---|---|
| World 1 | Clear blue | High noon, straight down | Warm white | Cheerful, flat, clear |
| World 2 | Orange-red gradient | Low angle, long shadows | Warm amber | Golden, harsh, dramatic |
| World 3 | Flat grey overcast | Diffuse, no clear direction | Cool blue-grey | Oppressive, muted, cold |
| World 4 | Clear blue | Mid-high angle | Warm white | Normal, beautiful, deceivingly calm |

### Boss Fight Lighting Exception
World 3 boss: blizzard particle system activates, ambient shifts cooler and darker, visibility drops —
the only dynamic lighting change in the open world. The Core Citadel (World 4 final boss): cold server-glow
and scanning sensor-light shafts baked into the scene, coloured light pools on the floor; the King's
**Data-Center Tank** emerges into the most dramatic lighting in the game.

---

## PROPS & DETAILS

### Prop Density
- **Sparse is better than cluttered** — top-down camera means too many props create visual noise
- **Props serve gameplay first** — cover objects must read clearly as cover; decorative props should not
  obscure tank movement paths
- **Cluster props deliberately** — a group of barrels, a pile of crates, a cluster of trees. Isolated
  single props feel random; grouped props feel designed.

### Prop Style Rules
- All props follow the same geometry language as terrain and tanks — angular, simplified, readable
- Barrels: 8-sided cylinders, flat tops, metal band loops modeled as flat rings
- Crates: simple rectangular boxes, lid edge geometry, no excessive detail
- Trees: low poly — trunk as 6-sided cylinder, foliage as geometric cone or flat planes in cluster
- Stone walls: rectangular blocks stacked, consistent block size, slight variation in height
- Fences: flat plank geometry, consistent post spacing

### Bunker Interior (the hub)
The bunker is the warm, lived-in home base — a cozy **analog** contrast to the King's cold machine world outside (not clinical).
Built as a Soviet-bunker concrete shell dressed with hand-tuned corner **stations**, each its own little
vignette (lounge, galley/kitchen, NW planning desk, NE radio/intercept nook, mechanic workbench,
quartermaster). Stations are primitive-built, grounded, and lit by warm practical light pools.

- Concrete shell: dark charcoal grid floor, lighter clean concrete walls
- Warm practical lighting — grounded lamps and glowing screens, not overhead clinical light. Each station
  carries its own warm point light; fake blob shadows ground props on any GPU.
- Gunmetal grey equipment, analogue and chunky — radios/terminals as boxy units, dials as flat circles,
  meters/screens as flat emissive planes (amber / green phosphor)
- Personal, lived-in touches — clutter clustered deliberately (mugs, papers, crates, a corkboard of
  notes, a comfy chair, a rug). The bunker fills with life as crew is recruited.
- Process: every station is designed via the mockup → in-browser layout editor → bake → port pipeline
  (see the `hangar-station-designer` skill), so placement is polished by eye, not guessed in code.

---

## ASSET PIPELINE

### Blender Workflow
1. **Model in Blender** — follow geometry principles above
2. **UV unwrap** — flat UV projection for most assets, manual for tanks
3. **Apply vertex colors OR flat material colors** — no complex texture maps for environment assets
4. **Tank materials** — single flat color base, decal layer for markings, roughness map for metal feel
5. **Export as .glb** — for Babylon.js import
6. **Test in scene** — check top-down silhouette, check color reads against zone palette

> Most tank parts are **extracted from open-source GLBs**, not modeled from scratch (the player has no
> 3D-art background and procedural part-gen didn't meet the bar). Invest in extraction tooling, not
> hand-authoring. See ENGINEERING / the part-extraction pipeline.

### Naming Convention
```
tank_player_hull_base.glb
tank_enemy_light_01.glb
env_world1_cottage_01.glb
env_world1_wall_stone.glb
prop_barrel_metal_01.glb
prop_crate_wood_01.glb
npc_sean.glb
```

### Scale Reference
- Player tank hull: 2 units wide, 3 units long, 1 unit tall
- All other assets scale relative to player tank
- A cottage should feel like a tank could drive next to it but not through it
- The Iron Keep towers should feel imposing at tank scale

---

## WHAT TO AVOID

- **Organic flowing curves** — no smooth hills, no round boulders, no flowing rivers. Everything is
  angular and intentional.
- **Photorealistic textures** — no photo-sourced surface textures. Flat colors and simple materials only.
- **PBR in the gameplay scene** — there's no HDR environment, so PBR reads flat/washed. Use
  StandardMaterial (Phong) for punchy, predictable color.
- **Dark and gritty** — TanKING is cozy-apocalypse. Even World 3's frozen tundra is cold and beautiful,
  not grim and hopeless.
- **Clutter** — resist the urge to fill every open-world space. Empty space is part of the design. (The
  bunker interior is the deliberate exception — there, lived-in clutter is the point.)
- **Inconsistent scale** — one wrong-scale asset breaks immersion for everything around it. Check constantly.
- **Fine detail below camera threshold** — door handles, window latches, individual bolts — invisible
  from top-down camera, don't model them.
- **Random prop placement** — every prop should have a reason to be where it is.
- **Homogenizing the two aesthetic systems** — keep the bright world and the dark Tron UI distinct.

---

## QUICK REFERENCE CHECKLIST
Before finalizing any asset ask:

- [ ] Does it follow the ATF geometry language — angular, simplified, deliberate?
- [ ] Does the top-down silhouette read clearly?
- [ ] Is it the right scale relative to the player tank?
- [ ] Does its color palette fit the zone it belongs to?
- [ ] Is it exported as .glb with correct naming convention?
- [ ] Does it feel like it belongs in the same world as everything else?

---

*Last updated: June 2026 — merged single source of truth (supersedes the separate v1 spec + v2 bible).*
*Reference games: After the Flash series (ATF), Escape from Duckov, Deep Rock Galactic, Tears of the Kingdom.*
