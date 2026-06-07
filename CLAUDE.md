# TanKING — Claude Code Session Context
> Read this entire file at the start of every session before touching any code. This is the authoritative context for the project. Reference _docs/ for deeper detail on any topic.

---

## WHAT THIS GAME IS

**TanKING** is a 3D top-down extraction shooter roguelite built in Babylon.js.

The player is a modern tank driver who crashed into a medieval fantasy world called Tankford — a kingdom where tanks and tank drivers are the dominant civilization. The goal: dethrone the TanKING and claim the throne.

**Tone:** Cozy-apocalypse. Bright, vibrant, toylike and charming. Escape from Duckov is the primary aesthetic reference. The world is broken but the vibe is warm.

**Platform target:** PC via Steam. Name is confirmed available.

---

## TECH STACK

| Tool | Purpose | Status |
|---|---|---|
| Babylon.js | 3D game engine | Active |
| Blender + BlenderMCP | 3D asset creation | Active |
| Obsidian MCP | World bible and design docs | Active |
| GitHub MCP | Version control | Active |
| PolyHaven | PBR textures | Active |
| Claude Code | Primary development agent | Active |

**Environment:** Mac, bash shell (not zsh). PATH configured with `$HOME/.local/bin` in `~/.bash_profile`.

---

## PROJECT STRUCTURE

```
TanKING/
├── _docs/
│   ├── design/        # Game design documents
│   ├── world/         # Lore, locations, NPCs (see TANKING_WORLD.md)
│   ├── art/           # Visual direction, Blender modeling guide
│   └── dev/           # CLAUDE.md, TOOLKIT.md, CHANGELOG.md
├── src/
│   ├── core/          # Engine, scene, game loop
│   ├── tank/          # Tank construction, parts, physics
│   ├── combat/        # Shooting, targeting, hit detection
│   ├── world/         # Zones, enemies, map logic
│   ├── hub/           # Bunker, NPCs, garage
│   ├── ui/            # HUD, menus, research tree
│   └── utils/         # Shared helpers
├── assets/
│   ├── models/        # .glb / .obj from Blender
│   ├── textures/      # PBR textures
│   ├── audio/
│   └── ui/
└── CLAUDE.md          # This file
```

---

## CORE GAME LOOP

```
Bunker hub
  → Equip tank from available parts
  → Deploy to zone
  → Explore battlefield — scavenge consumables and parts
  → Push deeper for better loot and harder enemies
  → Extract alive → keep all gains
  → Die → lose all run gains, keep tank, pay repair cost
  → Upgrade tank, research base stats
  → Go back out stronger
```

---

## DESIGN RULES — NEVER VIOLATE THESE

- Default loadout is always winnable — parts raise the power ceiling not the floor
- Death stings but never destroys — player keeps their tank, loses run gains, pays repair cost
- Enemy positions are largely fixed per zone — map mastery is a skill
- The world is discovered not constructed — parts, NPCs, bosses found in the wild
- The bunker is home — warm and lived-in, not clinical
- Player tank is classless — can equip parts from any doctrine
- No cross-doctrine restrictions — the whole point is the hybrid build
- Parts come from the world only — research tree handles base stats only

---

## LOOT & ECONOMY

**Common drops:** Ammo, fuel canisters, repair kits, smoke grenades
**Rare drops:** Upgrade components, new tank parts, class hull wrecks
**On death:** Lose everything from the run. Keep tank and permanent upgrades. Pay repair cost.
**On extraction:** Keep everything found. Bank parts, install upgrades.
**No research-gated parts** — all parts come from the world.

---

## TANK SYSTEM

**The player tank is classless** — unique in Tankford. Can equip parts from any doctrine.

Four doctrines exist in the world:
- **Light** — fast, fragile, evasive (World 1 enemies)
- **Medium** — balanced, adaptable (World 2 enemies)
- **Heavy** — slow, tanky, devastating (World 3 enemies)
- **Tank Destroyer** — long range, glass cannon (Tea Dee faction)

By late game the player has a frankentank hybrid of all doctrines. This is the intended fantasy.

**Research tree** — base stats only per doctrine: Mobility, Health, Armor, Fuel. Spent at the bunker between runs.

---

## COMBAT SYSTEM

**Firing:**
- Flat shooting on click
- Lock-on targeting available — but alerts the enemy
- Manual aim keeps stealth — skill expression in choosing when to use each
- Arc cannons planned as future weapon type

**Movement:**
- Momentum-based physics
- High speed → wider turning radius + reduced accuracy
- Jet boost with fuel meter as primary evasion

---

## WORLD ZONES

| Zone | Biome | Lighting | Fortress | Enemies |
|---|---|---|---|---|
| World 1 | Green fields | Bright midday | The Iron Keep | Light tanks |
| World 2 | Desert | Orange sunset | Ashrock | Medium tanks |
| World 3 | Frozen tundra | Overcast/blizzard | Frostholm | Heavy tanks |
| World 4 | European capital | Sunny day | The Cathedral | TanKING |

**Zone structure:** Duckov-style continuous open world per zone. Enemy positions largely fixed. Difficulty and loot scale with depth. No wave defense, no artificial triggers. Push deep enough to permanently unlock the next zone. Fast travel to unlocked zones from hub.

**Full zone visual details:** See `_docs/world/TANKING_WORLD.md`

---

## THE BUNKER

Mountain bunker. Fully built from day one — not constructed over time. Starts empty, fills with life as crew is recruited.

**Key features:**
- **Sean's workbench** — mechanical bench with a terminal. Player's mission log and records.
- **The radio** — intercepts Tankford transmissions. Source of side quests, world building, and one recurring mysterious signal (main story).

---

## BUNKER CREW

**Sean — Mechanic**
Childhood best friend. Already in bunker at start. Keeps the tank running. Also secretly the recurring voice on the radio — transmitting without the player knowing. How he knew the player was coming and why he prepared everything in advance is the core mystery of the game. *Full backstory: TBD*

**Clint — Merchant**
Player's brother. Found in World 1 — his store was destroyed, player helps him, he joins. Buys and sells parts and consumables. Materialistic and entrepreneurial.

**Caylie — Healer & Stat Upgrades**
Player's girlfriend. Found and rescued via quest in the wild. After recruitment: manages all base stat upgrades (the Melina role) AND appears in the field when player is critically low to save them. The only NPC with both a bunker role and a field presence.

---

## WILD NPCs
*Exist only in the world. Never move to bunker. Reappear across zones like Blaidd/Alexander in Elden Ring. All are Tankford locals who want the TanKING gone.*

- **The Fighter** — rebel warrior, summonable at boss fights, own arc across worlds. *Identity: TBD*
- **The Quest Giver** — underground intel operative, wild missions only. *Identity: TBD*
- **The Black Market Trader** — sells rare parts, moves around each zone, hard to find. *Identity: TBD*

---

## THE KINGDOMS

**Tankford** — main kingdom ruled by the TanKING. Built unknowingly on the history of crashed outsiders. Different tank doctrines across territories are fragments of absorbed outsider cultures.

**Tea Dee** — neutral sovereign faction. Holds Long Boi — a legendary 183mm FV4005-inspired cannon, the only weapon capable of defeating the TanKING. Must be earned through their questline. *Full details: TBD*

---

## THE TANKKING

The most powerful, most advanced tank in Tankford. Rules from The Cathedral in Tankford Capital. Final boss. Not ancient, not a god — just the strongest. Rose to power by force.

*Name and full backstory: TBD*

---

## LONG BOI

The legendary 183mm cannon from Tea Dee. Based on the FV4005 Stage II — comically oversized, absurdly powerful, one shot potential. The weapon that ends the TanKING. Earned by proving yourself to Tea Dee.

---

## THE CORE MYSTERY

Tankford was built on the wreckage of crashed outsiders. Every traveler who arrived and never went home became part of its history. The player is the latest outsider — not the first. Sean knows this. How much he knows and why he prepared the bunker before the player arrived is the narrative spine of the game.

*This is environmental storytelling — crashed machines, buried ruins, fragments of forgotten history. Never fully explained.*

---

## CURRENT DEVELOPMENT PRIORITIES

1. ✅ Project restructured
2. ✅ Obsidian MCP connected
3. ✅ GitHub MCP connected
4. ⬜ Implement zone structure — starter zone with depth-scaled difficulty
5. ⬜ Implement loot table — common consumables + rare parts
6. ⬜ Implement extraction mechanic — success vs death outcome split
7. ⬜ Hub NPC placeholder system — empty bunker, slots for crew
8. ⬜ Research tree UI per doctrine
9. ⬜ Art direction document — visual targets per zone

---

## KEY REFERENCE FILES

- `_docs/world/TANKING_WORLD.md` — full world bible, lore, zone details, characters
- `_docs/art/ART_DIRECTION.md` — decided visual spec: gameplay palette + Tron UI, exact colors
- `_docs/art/BLENDER_MODELING_GUIDE.md` — asset creation instructions
- `_docs/dev/ENGINEERING.md` — code conventions, architecture, controls, scope discipline
- `_docs/dev/SYSTEMS.md` — live systems map / roadmap
- `_docs/dev/TOOLKIT.md` — full developer toolkit reference
- `_docs/dev/CHANGELOG.md` — log major decisions and changes here

---

*Last updated: June 2026*
