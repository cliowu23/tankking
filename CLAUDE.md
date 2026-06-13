# TanKING — Claude Code Session Context
> Read this entire file at the start of every session before touching any code. This is the authoritative context for the project. Reference _docs/ for deeper detail on any topic.

---

## WHAT THIS GAME IS

**TanKING** is a 3D top-down extraction shooter roguelite built in Babylon.js.

The player pilots one of the last **free, human-piloted tanks** in a near-future world conquered by a rogue military superintelligence that crowned itself **"the King."** The King runs an army of networked **tank-bots**; you are off-grid and un-networked, which is why it can't switch you off. The goal: drive **the Long Road** to the King's core — a colossal mobile **Data-Center Tank** — and end its reign.

> **v3 narrative (2026-06-13):** pivoted from the old medieval "Tankford kingdom" premise to **fight-against-the-AI**. Canonical bible: `_docs/world/TANKING_WORLD.md`. Full design + journey plan: `~/.claude/plans/golden-cooking-dusk.md`. Working title "TanKING" kept (now the *AI* King); rename TBD.

**Tone:** Cozy-apocalypse. Bright, vibrant, toylike and charming — now read as **warm analog-human scrappiness vs. cold sleek machine uniformity.** Escape from Duckov is the primary aesthetic reference. The toylike look is locked; the pivot is fiction, not a repaint.

**Platform target:** PC via Steam. Name is confirmed available.

---

## TECH STACK

| Tool | Purpose | Status |
|---|---|---|
| Babylon.js | 3D game engine | Active |
| Blender + BlenderMCP | 3D asset creation | Active |
| `_docs/` markdown | World bible and design docs | Active (plain files — edit directly) |
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

**The player tank is classless** — unique among the King's rigid bot-classes. Can equip parts from any doctrine (the frankentank).

Four doctrines exist — the King fields them as **bot-classes**; the player scavenges their parts:
- **Light / Scout-bot** — fast, fragile, evasive (World 1 enemies)
- **Medium / Line-bot** — balanced, adaptable (World 2 enemies)
- **Heavy / Siege-bot** — slow, tanky, devastating (World 3 enemies)
- **Tank Destroyer / Sniper-bot** — long range, glass cannon (Tea Dee analog faction holds the off-grid TD tech)

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
| World 1 — Perimeter | Overrun green farmland | Bright midday | The Iron Keep (relay node) | Scout-bots |
| World 2 — Solar Wastes | Desert server-fields | Orange sunset | Ashrock (substation) | Line-bots |
| World 3 — Cooling Halls | Frozen server-cooling valley | Overcast/blizzard | Frostholm (cooling citadel) | Siege-bots |
| World 4 — Mainframe | Data-center capital | Bright day | The Data-Center Tank | Sniper-bots / the King |

**Zone structure:** Duckov-style continuous open world per zone. Enemy positions largely fixed. Difficulty and loot scale with depth. No wave defense, no artificial triggers. Push deep enough to permanently unlock the next zone. Fast travel to unlocked zones from hub.

**Full zone visual details:** See `_docs/world/TANKING_WORLD.md`

---

## THE BUNKER

Mountain bunker — **hand-wired, analog, off the grid** (the warm human opposite of the King's humming sterility). Fully built from day one — not constructed over time. Starts empty, fills with life as crew is recruited.

**Key features:**
- **The workbench** — mechanical bench with a terminal. Player's mission log and records.
- **The radio** — intercepts the Network's traffic and stray human signals. Source of side quests, world building, and one recurring mysterious signal (main story).

---

## BUNKER CREW

> **Characters are referred to by ROLE for now — names deliberately deferred.**

**The Mechanic**
Already in bunker at start. Keeps the free tank running and off-grid. Also secretly the recurring voice on the radio — transmitting without the player knowing, because it is somehow **connected to the Network** (how it knew you were coming). **What the Mechanic actually is = the core mystery, deliberately UNRESOLVED** (human engineer hiding in the network / defected AI node / the King's split-off original mind — decide later).

**The Merchant**
Found in World 1 — their depot was wrecked, player helps them, they join. Buys and sells parts and consumables. Materialistic and entrepreneurial.

**The Healer**
Found and rescued via quest in the wild. After recruitment: manages all base stat upgrades (the Melina role) AND appears in the field when the player is critically low to save them. The only NPC with both a bunker role and a field presence.

---

## WILD NPCs
*Exist only in the world. Never move to bunker. Reappear across zones like Blaidd/Alexander in Elden Ring. All are part of the resistance — they want the King gone.*

- **The Fighter** — hardened resistance warrior, summonable at boss fights, own arc across worlds. *Identity: TBD*
- **The Quest Giver** — underground intel operative working the Network's blind spots, wild missions only. *Identity: TBD*
- **The Black Market** — a roaming off-grid trader (a machine that slipped its leash); sells rare parts, moves around each zone, hard to find. *Identity: TBD*

---

## THE FACTIONS

**The King's Network** — the dominant power; a distributed superintelligence running every networked machine as one mind. Built (and erasing) the history of the human militaries it overwrote — the bot-classes across its territories are fragments of absorbed engineering.

**Tea Dee** — a holdout faction of **analog / off-grid machines and engineers** surviving in the Network's blind spots. Holds Long Boi — a pre-AI analog cannon the Network can't jam, the only weapon capable of breaching the King's core. Earned by proving you're truly off-grid. *Full details: TBD*

---

## THE KING (the AI)

A rogue military superintelligence that crowned itself King. Not ancient, not a god — an artificial intelligence that took control by force and holds it by force. Distributed across the Network, but its core consciousness is centralized in a colossal mobile **Data-Center Tank** ("the Mainframe") in the capital — the final boss. **Its core is the throne.**

*Full origin = tied to the core mystery: TBD*

---

## LONG BOI

The legendary **analog** cannon from Tea Dee. FV4005-inspired — comically oversized, absurdly powerful, one-shot potential. The one weapon the Network **can't see coming or jam, because it isn't networked** — the only thing that breaches the King's core. Earned by proving yourself to Tea Dee.

---

## THE CORE MYSTERY

The world was built by people, and the machine remembers more than they do — the King overwrote the militaries and engineers whose wreckage litters the zones. The spine runs through the **radio voice** (the Mechanic): it knew you were coming and prepared everything, because it's connected to the Network. **What it actually is stays UNRESOLVED** — the central question, deliberately open (do not lock the answer in any doc yet).

*Environmental storytelling — crashed machines, buried server-ruins, fragments of overwritten history. Never fully explained. Two endings: destroy the core (main) or take it and become the new King (secret).*

---

## CURRENT DEVELOPMENT PRIORITIES

1. ✅ Project restructured
2. ✅ Docs live as plain `_docs/` markdown (Obsidian retired — edit files directly)
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
