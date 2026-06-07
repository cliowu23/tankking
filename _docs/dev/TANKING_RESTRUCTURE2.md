# TanKING — Project Restructure & Dev Instructions
> Read this entire file before doing anything. Execute the restructure in order. Confirm each step before moving to the next.

---

## PART 1: REQUIRED FOLDER STRUCTURE

Restructure the project into the following layout exactly. Create any missing folders. Move existing files to their correct locations. Do not delete anything — if unsure where a file belongs, place it in `_docs/misc/`.

```
TanKING/
│
├── _docs/                          # ALL non-code files live here
│   ├── design/                     # Game design documents
│   │   ├── DESIGN_DOC.md           # Master game design document
│   │   ├── RESEARCH_TREE.md        # Research tree details per class
│   │   └── PROGRESSION.md         # World unlocks, NPC roster, hub progression
│   │
│   ├── world/                      # Lore and world-building
│   │   ├── WORLD.md                # Kingdoms, story, factions, lore
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
├── CLAUDE.md                       # Copy of _docs/dev/CLAUDE.md — Claude Code reads this automatically on session start
└── package.json
```

---

## PART 2: RESTRUCTURE STEPS

Execute in this order:

1. Create all folders listed above that do not already exist
2. Move all `.md` documentation files into their correct `_docs/` subfolder
3. Move all `.js` / `.ts` source files into appropriate `src/` subfolders
4. Move all `.glb`, `.obj`, and texture files into `assets/`
5. Ensure `CLAUDE.md` exists at the project root — Claude Code reads this automatically every session
6. Update any import paths in source files broken by the move
7. Confirm nothing was deleted — run `git status` if git is initialized
8. Report back with a summary of what was moved and where

---

## PART 3: CURRENT TECH STACK

| Tool | Purpose | Status |
|---|---|---|
| Babylon.js | 3D game engine | Active |
| Blender + BlenderMCP | 3D asset creation via Claude Code | Active |
| Claude Code | Primary coding and development agent | Active |
| Obsidian + MCP | World bible and lore notes | To set up |
| GitHub MCP | Version control | To set up |
| PolyHaven | PBR textures | Active |

---

## PART 4: DEVELOPMENT PRIORITIES

Work through these in order after restructure is complete:

1. ✅ Project restructure per this document
2. ⬜ Set up Obsidian MCP for world-building notes
3. ⬜ Set up GitHub MCP for version control
4. ⬜ Implement zone structure — starter zone with depth-scaled difficulty
5. ⬜ Implement loot table — common consumables + rare parts
6. ⬜ Implement extraction mechanic — success vs death outcome split
7. ⬜ Hub NPC placeholder system — empty bunker, slots for 5 NPCs
8. ⬜ Research tree UI per class

---

## PART 5: CORE DESIGN RULES
> These are non-negotiable. Never implement anything that violates these.

- The default loadout is always winnable — parts raise the power ceiling, not the floor
- Death stings but never destroys — player keeps their tank, loses run gains, pays repair cost
- Enemy positions are largely fixed per zone — map mastery is a skill
- The world is discovered, not constructed — parts, NPCs, and bosses are found in the wild
- The bunker is home — it should feel warm and lived-in, not clinical
- The player tank is classless — it can equip parts from any doctrine
- Each world zone is themed by doctrine: World 1 = Light, World 2 = Medium, World 3 = Heavy
- Tank Destroyer parts and cannon come from Tea Dee faction questline only

---

*Last updated: June 2026*
