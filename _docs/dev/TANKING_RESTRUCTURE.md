# TanKING — Project Restructure & Updated Design Document
> Read this entire file before doing anything. This is both a restructure instruction set and the authoritative game design document. Follow the folder structure exactly, then use the design doc as your north star for all implementation decisions.

---

## PART 1: PROJECT RESTRUCTURE INSTRUCTIONS

### The Problem
Currently the project has design/instruction files mixed in with actual game source files. This needs to be cleanly separated so that documentation, lore, and dev instructions never get confused with game code.

### Required Folder Structure

Restructure the project into the following layout. Create any missing folders. Move existing files to their correct locations. Do not delete anything — if unsure where a file belongs, place it in `_docs/misc/`.

```
TanKING/
│
├── _docs/                          # ALL non-code files live here
│   ├── design/                     # Game design documents
│   │   ├── DESIGN_DOC.md           # Master game design document (this file goes here after restructure)
│   │   ├── RESEARCH_TREE.md        # Research tree details per class
│   │   └── PROGRESSION.md          # World unlocks, NPC roster, hub progression
│   │
│   ├── world/                      # Lore and world-building
│   │   ├── WORLD_OVERVIEW.md       # Setting, tone, factions
│   │   ├── LOCATIONS.md            # Each deployable zone and its identity
│   │   └── NPCS.md                 # NPC roster, personalities, functions
│   │
│   ├── art/                        # Visual direction and asset guidelines
│   │   ├── ART_DIRECTION.md        # Aesthetic principles, color palette, references
│   │   └── BLENDER_MODELING_GUIDE.md  # Modeling instructions for Claude Code via BlenderMCP
│   │
│   └── dev/                        # Developer tooling and workflow
│       ├── CLAUDE.md               # Claude Code persistent context (primary session file)
│       ├── TOOLKIT.md              # Full developer toolkit reference
│       └── CHANGELOG.md            # Running log of major changes and decisions
│
├── src/                            # ALL game source code lives here
│   ├── core/                       # Engine setup, scene management, game loop
│   ├── tank/                       # Tank construction, modular parts, physics
│   ├── combat/                     # Shooting, targeting, hit detection
│   ├── world/                      # Arena, zones, enemy spawning, map logic
│   ├── hub/                        # Bunker hub, NPC interactions, garage
│   ├── ui/                         # HUD, menus, research tree UI
│   └── utils/                      # Shared utilities, helpers
│
├── assets/                         # ALL game assets live here
│   ├── models/                     # .glb / .obj files from Blender
│   │   ├── tanks/
│   │   ├── environment/
│   │   └── npcs/
│   ├── textures/                   # PBR textures from PolyHaven
│   ├── audio/                      # Sound effects, music
│   └── ui/                         # Icons, fonts, UI sprites
│
├── CLAUDE.md                       # Symlink or copy of _docs/dev/CLAUDE.md — Claude Code reads this automatically on session start
└── package.json
```

### Restructure Steps
1. Create all folders listed above that don't already exist
2. Move all `.md` documentation files into their correct `_docs/` subfolder
3. Move all `.js` / `.ts` source files into appropriate `src/` subfolders
4. Move all `.glb`, `.obj`, texture files into `assets/`
5. Ensure `CLAUDE.md` exists at the project root (Claude Code reads this automatically)
6. Update any import paths in source files broken by the move
7. Confirm nothing was deleted — check with `git status` if git is initialized

---

## PART 2: UPDATED GAME DESIGN DOCUMENT

### Game Overview
**Name:** TanKING
**Genre:** 3D top-down extraction shooter roguelite
**Engine:** Babylon.js
**Platform:** PC (Steam target)
**Tone:** Cozy-apocalypse. Bright, vibrant, toylike and charming. The world is broken but the vibe is warm — scrappy workshop energy, found family, colorful chaos. Duckov is the primary aesthetic reference.

---

### Core Loop

```
Mountain Bunker Hub
    → Select class + build/equip tank
    → Deploy to world zone
    → Explore battlefield — scavenge consumables and parts
    → Push deeper for better loot and harder enemies
    → Extract alive → keep all gains
    → Die → lose all run gains, keep tank (pay repair cost)
    → Upgrade tank permanently, research base stats
    → Go back out stronger
```

**Philosophy:** The default loadout is always winnable. Better parts raise the power ceiling, not the floor. Skill and knowledge of the map matter as much as gear.

---

### World Structure

**Hub:** Mountain bunker. Fully built from day one — not constructed over time. Starts empty and cold, fills with recruited NPCs as you progress. Feels lived-in, warm, scrappy.

**Zones:** Multiple deployable locations. Start with one starter zone. Push deep enough in a zone to permanently unlock the next location. Fast travel to any unlocked zone directly from the hub.

**Zone design:** Duckov-style continuous open world per zone. Enemy positions are largely fixed — map mastery is part of the skill. Difficulty and loot quality scale with depth. No wave defense. No artificial triggers.

**Boss:** Found in the world, not triggered. Push deep enough and you encounter it. Hunter enemies (future mechanic) actively pursue once alerted.

---

### Loot & Economy

**What you find in the wild:**
- Common: Ammo, fuel canisters, repair kits, smoke grenades
- Rare: Upgrade components, new tank parts, class unlock items (wrecked hulls)

**On death:** Lose everything found that run. Keep your tank and permanent upgrades. Pay a repair cost at the bunker.

**On successful extraction:** Keep everything. Bank parts, install upgrades, restock consumables.

**No research-gated parts.** All parts come from the world. Research tree handles base stats only.

---

### Research Tree

- Covers base stats only: **Mobility, Health, Armor, Fuel**
- Each class has its own separate research tree
- No cross-class upgrades
- Unlocked with Research Points earned from runs

---

### Classes

Four classes available from the start. Player picks one to begin. Additional class hulls can be found in the world (wrecks, boss drops) to unlock that class.

| Class | Identity | Playstyle |
|---|---|---|
| **Light** | Fast, fragile, evasive | Hit and run, stealth-heavy |
| **Medium** | Balanced, adaptable | Jack of all trades |
| **Heavy** | Slow, tanky, devastating | Absorb damage, heavy firepower |
| **Tank Destroyer** | Long range, glass cannon | Sniper, high risk high reward |

Each class has genuinely different stat profiles — not just cosmetic variation.

---

### Combat System

**Firing:**
- Flat shooting on click — no charge mechanic in V1
- Lock-on targeting available — but locking on **alerts the enemy**
- Manual aim keeps you hidden — skill expression in choosing when to use each
- Arc cannons planned as a future weapon type
- Charge cannon possible in later versions

**Movement:**
- Momentum-based physics
- High speed → wider turning radius + reduced accuracy
- Jet boost with fuel meter as primary evasion tool

---

### Customization

**Tank paint:** Purely cosmetic. Color your tank freely.
**Driver character:** Purely cosmetic. Visible walking around the hub. No stat impact.
**Parts:** Functional customization — modular slot system. Parts found in the wild, installed in the garage.

---

### Hub & NPCs

The bunker hub is fully built from the start. 5 NPCs can be rescued and recruited from the wild. Each has a function and a personality — they live in the bunker and give it life.

**NPC Roster (to be named):**
1. **Mechanic** — hub services, repairs, part installation
2. **Merchant** — buys and sells parts and consumables
3. **Researcher** — manages the research tree
4. **Combat Ally** — rescuable, can be summoned in boss fights (Elden Ring style)
5. **Healer** — rescuable, provides buffs or healing services at hub

NPCs are found and rescued during runs — not purchased or unlocked via menus. Finding them is part of the exploration reward.

**Philosophy:** You are building a found family in a broken world. Each NPC has a story. The bunker should feel like a place people want to be.

---

### Aesthetic Direction

**Primary reference:** Escape from Duckov — bright, toylike, charming despite the setting
**Secondary references:** Deep Rock Galactic (colorful industrial), Tears of the Kingdom (chunky readable mechanical design)

**Palette:** Vibrant, warm, colorful. Not bleak. Not gunmetal grey. Think painted metal, workshop lighting, worn but cheerful.

**Mood:** Cozy-apocalypse. The war happened. The world is broken. But your bunker is warm, your crew is good, and you're going to be okay.

**Asset principles:**
- Chunky, readable proportions — top-down camera, clarity over detail
- Battle-worn but not depressing — scratches and grime with personality
- Color comes from paint, lights, explosions, and personality — not just fire

---

### Tech Stack

| Tool | Purpose |
|---|---|
| Babylon.js | 3D game engine |
| Blender + BlenderMCP | 3D asset creation via Claude Code |
| Claude Code | Primary coding and development agent |
| Obsidian + MCP | World bible, lore, design notes (to be set up) |
| GitHub MCP | Version control (to be set up) |
| PolyHaven | PBR textures |

---

### Development Priorities (Current)

1. Complete project restructure per Part 1 of this document
2. Set up Obsidian MCP for world-building notes
3. Set up GitHub MCP for version control
4. Implement zone structure — starter zone with depth-scaled difficulty
5. Implement loot table — common consumables + rare parts
6. Implement extraction mechanic — success vs death outcome split
7. Hub NPC placeholder system — empty bunker, slots for 5 NPCs
8. Research tree UI per class

---

### Key Design Principles (Never Violate)

- The default loadout is always winnable. Parts raise the ceiling, not the floor.
- Death stings but never destroys. You keep your tank.
- Map mastery is a skill. Enemy positions are roughly fixed — learning the zone matters.
- The world should feel discovered, not constructed. Find parts, find NPCs, find bosses.
- The bunker is home. It should feel warm, not functional.
- Each class is a genuine identity, not a skin.

---

*Last updated: June 2026 — compiled from full design brainstorm session*
