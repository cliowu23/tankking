# [Your Game Title] — Design Document (V1 — SUPERSEDED)

> ⚠️ **SUPERSEDED (2026-06-07): this is the V1 design, kept for history only.**
> The authoritative V2 design lives in the root `CLAUDE.md` (extraction roguelite,
> classless tank, flat-shot combat, parts from the world). Where this document
> disagrees with `CLAUDE.md` — charge-to-fire, fixed chassis classes, the RP
> research tree unlocking parts, wave-based arena runs — **V2 wins.**

> **Sticky Note:** *"Build your tank in the garage. Survive arena waves. Earn RP. Research new parts. Build something nastier next run."*

> **North Star:** *Beautiful in a bright way — a battlefield that feels like a game, not a war.*

---

## Inspirations

- **Soul Knight** — roguelite shape, accessibility, top-down combat feel
- **Armored Core** — modular mech/tank building, jet boosters
- **War Thunder** — tank gunnery feel, research progression, momentum-based vehicle combat
- **Cosmoteer** — modular customization satisfaction
- **Escape from Duckov** — top-down combat, loot extraction (V2 inspiration)
- **Escape from Duckov** — top-down casual feel, bright accessible aesthetic
- **Elden Ring (Roundtable Hold)** — hub/hangar feel

---

## Core Gameplay Loop

1. Load into the **Hangar** (hub)
2. Build / configure your tank in the garage (slot-based parts)
3. Set off to the **Arena** (battlefield)
4. Explore the battlefield, engage enemies, push toward the boss
5. Defeat boss = run complete | Tank destroyed = run failed
6. Earn RP based on performance
7. Return to Hangar, spend RP to research new parts
8. Repeat with a better tank

---

## Combat Mechanics

### Movement
- **Smooth, momentum-based tank physics** — weight, real turning radius, no instant jukes
- **Speed / Turn / Accuracy tradeoff:**
  - *Slow speed* → tight turning, accurate fire control
  - *Fast speed* → wide arcs, inaccurate fire control
- Creates a "stop to shoot, move to reposition" combat rhythm

### Targeting & Firing
- **Z-targeting lock-on** — press `F` to lock onto nearest enemy, press again to cycle
- **Auto-lead** — the game shows where a shell will land based on the target's current velocity
- **Charge-to-fire** — hold fire key to charge, release to fire; charge time = shell range/velocity
- **Charge is by feel** — no UI shows optimal charge; player learns through play (this is the skill ceiling)
- **Where the skill lives** — prediction + timing, NOT aim:
  - Reading enemy intent through their movement
  - Timing the release when the lead is correct
  - Anticipating enemy boost-dodges

### Boost / Evasion
- **Jet boost** — short burst of speed in the current direction
- **Fuel meter resource** — recharges over time, limited supply
- **Primary evasion mechanic** — breaking auto-lead by changing direction unpredictably
- Different boosters give different defensive identities (see Customization)

### V1 Combat Rules
- **No manual aim** (potential V2 toggle)
- **PvE only** (no multiplayer)

---

## Controls (Keyboard, Trackpad-Friendly)

| Key | Action |
|-----|--------|
| W / S | Forward / Reverse (tank-style, in facing direction) |
| A / D | Rotate tank body |
| Space | Jet boost |
| F | Lock on target / Cycle targets / Hold to charge fire |

---

## Customization (Slot-Based, Garage Only)

Four slots. All customization happens in the Hangar before a run. **No mid-run upgrades.**

### 1. Chassis
Defines movement profile.
- **Tank** (V1) — heavy, tracked, slow turn, high armor capacity
- **Mech** (V1.1) — bipedal top-down, no jumping/flying, more agile turning, less armor

### 2. Turret / Main Gun
Defines combat feel through the charge mechanic. Each weapon plays differently:
- **Cannon** — long charge, long range, big damage. Patient and deliberate.
- **Autocannon** — rapid fire, minimal charge, short range. Pressure tool.
- **Mortar** — charge sets arc distance, lobs over obstacles. Indirect fire.
- **Railgun** — instant fire on release, locked range. Twitch-friendly.
- **Missile Pod** — charge to acquire multiple locks, release to fire all.

### 3. Booster
Mobility / evasion identity.
- **Long-burst** — sustained evasion over distance, slow recharge
- **Short-snap** — quick juke, fast recharge, doesn't take you far
- **Heavy** — big momentum change, but you commit to the direction
- **Light** — smaller dodges, more frequent

### 4. Armor
Durability vs weight tradeoff. Heavier armor = slower acceleration.

---

## Progression: Research Tree

- **3 categories**: Mobility, Armor, Firepower
- **4 parts per category** in a linear chain (research part 1 before part 2 unlocks)
- **V1 total**: 12 unlockable parts + a starter loadout
- Earn **RP** during runs (kills, waves cleared, possibly specific actions)
- Spend RP in the Hangar to research/unlock parts
- Research = permanent unlock (no separate purchase step)
- **Tune unlock costs** so early players unlock something every 2-3 runs, slowing gently later
- ⚠️ **Don't replicate War Thunder's grind.** The "evil" version is what gives War Thunder its reputation problem. Keep progression earned, not punishing.

---

## Hangar / Hub

- Small player character sprite that walks around (Roundtable Hold / Duckov Bunker vibe)
- **Grows with progression** — starts minimal, accumulates new stations / NPCs / rooms over time
- **Visual mood**: warm, mechanical, lived-in, welcoming
- **Lighting**: warm ambient, practical work lights, inviting rather than oppressive
- **V1 contents**:
  - Tank building station
  - Research terminal
  - Gate to the Arena
- **V2+ additions**: NPC mechanics, additional rooms unlocking as player progresses

---

## Arena / Battlefield

- **One arena for V1**, compact (~2–3 screens of space)
- **Bright grass battlefield aesthetic** — open fields, colorful cover objects, cheerful ruins, toy-soldier energy
- **Battlefield exploration** structure (not wave defense):
  - Enemies pre-populated across the map in 3–4 distinct combat zones
  - Cover, terrain variation, visual landmarks
  - Player drives through, engages encounters, pushes toward the boss area
- **Enemy types (V1)**:
  - Light infantry
  - Armored vehicles
  - Heavy tanks
  - Unique boss
- **Boss trigger (V1)**: Clear all enemies in the arena → boss spawns and *comes to hunt you*
- **Boss trigger (V2+)**: Stumble onto the boss in his area — he's already there on the battlefield, deployed and waiting. No special trigger or gate; encountering him IS the trigger. You drive into his zone and the fight begins.
- **Win**: Defeat the boss
- **Lose**: Tank destroyed

---

## Visual Direction

- **North Star phrase**: *"Beautiful in a bright way — a battlefield that feels like a game, not a war"*
- **Style**: Stylized 3D low-poly, toy/cartoon, chunky proportions
- **References**: Super Mario World (bright cheerful world), Escape from Duckov (casual top-down), toy soldier plastic aesthetic
- **Palette discipline**:
  - Bright green grass ground, clear blue sky, warm sunshine
  - Saturated primary colors for tanks — cobalt blue (player), signal red (enemy), orange (AI)
  - Golden yellow walls (Mario block feel)
  - Candy-colored hazards — hot pink / magenta lava, not realistic heat
- **Lighting philosophy**: Full warm sunshine — bright, even, inviting. No oppressive shadows.
- **Explosions are the beauty** — cinematic, slightly slowed, vivid color burst against the bright world

---

## UI Direction — Retro-Futurist (Tron)

The **gameplay world** is bright, cheerful, and toy-soldier. The **UI overlay** lives in a different register entirely: dark, geometric, futuristic — like looking through a targeting computer at a toy battlefield.

This contrast is intentional. The split between a glowing cockpit HUD and a sunny plastic arena is its own kind of personality.

**Mood**: Tron / cold-war command center. Dark, precise, neon-lit. Every panel feels like it was ripped from a prototype weapons system.

**Color palette (UI only)**:
| Element | Value |
|---------|-------|
| Primary neon | `#00e5ff` (electric cyan) |
| Primary neon (dim) | `rgba(0, 229, 255, 0.5)` |
| Primary neon (faint) | `rgba(0, 229, 255, 0.2)` |
| Panel background | `rgba(0, 8, 20, 0.93)` |
| Panel border | `rgba(0, 229, 255, 0.22)` |
| Border (active/hover) | `rgba(0, 229, 255, 0.65)` |
| Danger / death | `#ff2060` |
| Hull integrity | `#00ff88` |
| Body background | `#000810` |

**Typography**:
- Monospace throughout — no exceptions
- Uppercase labels, wide letter-spacing (3–8px)
- Glow via `text-shadow` — text that looks like it's emitting light, not reflecting it

**Panels**:
- Dark navy background, always semi-transparent
- 1px neon border with subtle `box-shadow` glow
- No decorative chrome, bevels, or drop shadows — just geometry and light

**HUD bars**:
- Thin (5px) neon line bars — not chunky health bars
- Boost bar: electric cyan with glow
- Hull bar: neon green with glow
- Low health / low fuel: color shifts to danger red

**Overlays (pause / death)**:
- Dark translucent overlay, subtle `backdrop-filter: blur`
- Large uppercase glowing text
- Minimal button set with neon border → glow on hover

**Atmosphere**:
- Subtle CRT scanlines overlaid on the entire screen (very low opacity)
- CRT power-off transition (already implemented) — keep as-is
- Radial ambient glow on the menu (centered, very faint neon blue haze)

**What this is NOT**:
- Not garish neon-on-neon. One accent color (cyan) plus one danger color (red), everything else dark.
- Not pixel art or 8-bit — the geometric precision is clean and modern, just with a 1982 soul.
- The gameplay world's bright colors are completely separate from this system.

---

## Game Feel Checklist

Build these in EARLY, not as polish. They sell the genre.

- Smooth, weighted tank movement (acceleration, momentum, turning radius)
- Dust kicked up from tracks
- **Persistent** track marks on the ground (decals, not transient particles)
- Sparks on shell impact
- Smoke trails from damaged tanks and weapons
- Vivid, slightly-slowed explosion frames (2–3 extra "bloom" frames for cinematic feel)
- Ambient pollen/light particles for cheerful atmosphere
- Screen shake on cannon fire, impact, and explosions
- Hitstop when shells connect
- Camera weight when turning

---

## Scope Phases

### V1 — "The Bare Bones" (Ship This First)
- One compact, hand-designed arena
- Tank chassis only
- 4-slot customization (chassis / turret / booster / armor)
- Research tree: 12 unlockable parts + starter loadout
- Z-targeting + auto-lead + charge-to-fire combat
- 4 enemy types: light infantry, armored vehicles, heavy tanks, boss
- Boss trigger: clear arena → boss arrives to hunt you
- Minimal Hangar: build station, research terminal, arena gate
- Keyboard controls only
- Win/lose via boss kill / tank death

### V1.1 — "First Expansion"
- Mech chassis as alternative to tank
- More part variety per slot (3–5 more options per category)
- Hangar growth: 2–3 new visual appearances / minor rooms
- Polish pass on game feel based on V1 playtesting

### V2 — "The Full Vision"
- Larger arena with multiple zones
- "Stumble on boss" trigger replaces "clear all enemies"
- Duckov-style loot drops during combat (parts drop from enemies)
- Endless mode toggle
- Manual aim mode (optional toggle)
- More enemy variety + smarter enemy AI
- Hangar fully built out with NPCs and stations
- Potential mobile port (favor Godot stack if mobile is targeted)

---

## Tech Stack

Two strong candidates:

- **Phaser 3 (JavaScript)** — *Recommended for browser-first*
  - Plays in any browser (huge for "open it in class on a laptop")
  - Claude Code is excellent with JavaScript
  - Can wrap with Capacitor for native iOS/Android later

- **Godot 4 (GDScript)** — *Recommended if mobile is a real goal from day one*
  - Purpose-built for 2D, free, big community
  - First-class mobile export pipeline
  - Slightly less Claude Code training data than JS

**Avoid**: Pygame (Python) — mobile-incompatible, limited polish ceiling for a serious project.

---

## Open Questions / TBD

These don't block writing the doc, but flag and answer as you build:

- Final game title
- Specific starter loadout (what parts does V1 begin with?)
- Specific part stats / balance numbers
- Encounter pacing in the V1 arena layout
- Audio direction (likely industrial, mechanical, bassy)
- Enemy AI behaviors per type
- Save system implementation (local file vs browser localStorage)
- Tutorial / onboarding specifics

---

## How to Use This Doc

This is a living document. As you build V1:

1. **Don't change the North Star.** The sticky note and *"Beautiful in a bright way"* are the soul of the project. Everything serves these.
2. **Do refine specifics.** Stats, part names, enemy behaviors, exact RP costs — these are tuning, not design.
3. **Flag scope creep ruthlessly.** If something starts feeling bigger than V1, move it to V1.1 or V2 explicitly. Don't quietly let scope grow.
4. **Build the vertical slice first.** One tank, one enemy, one arena, basic movement and shooting, playable end-to-end. THEN add layers.
