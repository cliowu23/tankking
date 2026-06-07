# CLAUDE.md — TanKING Project Context

## What This Project Is

**TanKING** — a top-down 3D tank **extraction-shooter roguelite** built in Babylon.js. From a mountain **bunker hub** the player builds a **classless modular tank**, deploys to open-world zones, scavenges consumables and parts, and either **extracts alive** (keeping everything) or **dies** (losing run gains but keeping the tank). Permanent upgrades and a **stats-only research tree** carry between runs; rescued NPCs bring the bunker to life. Escape from Duckov × Deep Rock Galactic × War Thunder DNA, **cozy-apocalypse** tone. Aesthetic north star: *"Beautiful in a bright way — a battlefield that feels like a game, not a war."* Bright, cheerful, saturated — the world is broken but the vibe is warm.

The **authoritative design vision** is `_docs/dev/TANKING_RESTRUCTURE2.md` (v2: extraction roguelite, classless tank). Broader detail lives in `_docs/design/DESIGN_DOC.md`, and `_docs/dev/SYSTEMS.md` is the live systems map. Reference these for feature decisions; update them when design changes.

---

## Tech Stack

- **Engine**: Babylon.js 7.54.3 (3D, browser-based)
- **Bundler**: Vite
- **Language**: Plain JavaScript (not TypeScript)
- **Version control**: Git, hosted on GitHub
- **Editor**: VS Code with Claude Code extension

---

## Developer Context

The developer is learning as they build. They have no digital art or 3D modeling background. When working on this project:

- **Explain decisions as you go.** Narrate what you're doing and why — the developer should understand the code, not just have it.
- **Prefer simple, readable code over clever code.** Verbosity that aids comprehension beats brevity that obscures.
- **Stop and ask before assumptions.** If something is ambiguous, ask rather than choose for them.
- **Suggest small, testable increments.** Break big requests into chunks they can verify one at a time.
- **For 3D visuals, use a tight feedback loop.** The developer knows when something looks wrong and roughly where — they don't need to know how to fix it. Adjust numbers and reload; reference images (Wikipedia, YouTube walkarounds) work better than descriptions.
- **Don't pretend to know Babylon.js quirks.** When unsure about specific API behavior, say so.

---

## Coding Conventions

- 2-space indentation
- camelCase for variables and functions
- PascalCase for classes
- Files use kebab-case (e.g., `tank-controller.js`)
- One class per file when possible
- Domain-based folder structure under `src/`: `core/` (engine setup, scene management, game loop), `tank/` (player vehicle + modular parts), `combat/` (shells, targeting, hit detection), `world/` (arena, enemies, terrain, spawning), `hub/` (hangar/bunker, NPCs, garage, tank designer), `ui/` (HUD/menus — currently inline in `index.html`), `utils/` (shared helpers)

---

## Architecture (Babylon.js Conventions)

**Scene-per-major-state pattern.** Major scenes are each their own class with a Babylon.js `Engine`/`Scene`, orchestrated by `src/core/main.js`:

- `HangarScene` (`src/hub/`) — the bunker hub (build/equip the tank, NPCs, deploy)
- `TankDesignerScene` (`src/hub/`) — garage / modular part swapping
- `ArenaScene` (`src/world/`) — the gameplay battlefield (primary scene)

The menu, pause, and death screens are DOM overlays in `index.html` driven by `main.js` (the menu's monochrome look is intentional — do not change). There are no separate `BootScene` / `MenuScene` / `GameOverScene` files.

Entities are their own classes managing Babylon.js meshes, organized by domain: `src/tank/Tank.js` is the player's vehicle; `src/world/AIEnemy.js` handles enemy AI logic, `src/world/Enemy.js` / `src/world/TerrainPiece.js` the static enemies and terrain; `src/combat/Shell.js` manages projectile physics. Scenes live with their domain too: `src/world/ArenaScene.js` (battlefield), `src/hub/HangarScene.js` + `src/hub/TankDesignerScene.js` (hub/garage), `src/core/main.js` (entry + scene orchestration).

---

## Controls (Current)

| Key | Action |
|-----|--------|
| W / S | Forward / Reverse |
| A / D | Rotate tank hull |
| Shift (tap) | Tap boost / dash |
| Shift (tap + W + A or D) | Spin boost |
| Shift (hold) | Sustained boost |
| Mouse (move) | Free-aim turret |
| Mouse (click) | Fire — **flat shot** (no charge mechanic in V1; 0.3s cooldown) |
| F (hold 0.7s) | Lock on to nearest enemy |
| F (tap while locked) | Cycle targets |

---

## Art Direction — DECIDED

**Two separate aesthetic systems that intentionally contrast:**

### Gameplay World — Bright & Cheerful
**North star: "Beautiful in a bright way — a battlefield that feels like a game, not a war."**

Aesthetic references: **Super Mario World × Escape from Duckov × toy soldier.** Bright, casual, cheerful. Grass fields, sunshine, saturated primary colors. Still a battlefield, but inviting rather than oppressive.

- Saturated, confident primary colors — toy soldier plastic, not military drab
- Shapes slightly chunkier/more exaggerated than real proportions
- Bright green grass ground, clear blue sky, warm sunshine lighting
- Tank colors pop hard against the green (blue player, red enemy, orange AI)

### UI / HUD — Retro-Futurist (Tron)
The overlay layer (menus, HUD, overlays) lives in a different register: dark, geometric, neon-lit.
Like looking through a targeting computer at a toy battlefield.

- Primary neon: `#00e5ff` (electric cyan), danger: `#ff2060`, hull: `#00ff88`
- Panel background: `rgba(0, 8, 20, 0.93)`, body: `#000810`
- 1px neon borders with glow, dark navy panels — no chrome or decoration
- Thin (5px) glowing bar for HUD meters
- Monospace, uppercase, wide letter-spacing throughout
- Subtle CRT scanlines overlay on full screen (very low opacity)
- One accent color only — cyan. Everything else is dark or glowing text.

**Approved color palette:**
| Element | Color |
|---------|-------|
| Player tank hull | Cobalt blue `(0.12, 0.42, 0.88)` |
| Player tank turret | Deep cobalt `(0.08, 0.32, 0.75)` |
| Static enemy | Signal red `(0.92, 0.12, 0.08)` |
| AI enemy | Orange `(0.95, 0.42, 0.04)` |
| Shell | Yellow `(1.0, 0.82, 0.0)` with orange emissive |
| Tracks | Near-black `(0.12, 0.12, 0.12)` |
| Ground | Two-tone bright grass `#4db33d` / `#43a035` |
| Walls | Golden yellow `(0.95, 0.82, 0.30)` — Mario block feel |
| Sky | Bright Mario blue `(0.48, 0.78, 1.0)` |

---

## Tank Models — Current State

The tank is rendered two ways:

- **`src/tank/Tank.js`** — a vehicle built from Babylon.js primitives (fallback when no GLB is selected).
- **Modular GLB parts system** (`src/tank/parts/`) — the current direction. Real `.glb` assets in `public/assets/models/tanks/` (M26 Pershing, T-44) are split into hull / turret / cannon parts (`parts/hulls/`, `parts/turrets/`, `parts/cannons/`), described by `public/assets/models/manifest.json`, and recombined by `assembleTank.js`. `PARTS_BY_ID` in `parts/index.js` is the registry.

> The older primitive-only `PershingTank.js` / `T80Tank.js` classes no longer exist — they were superseded by the GLB parts pipeline.

---

## Current Status

*(Update this as systems land. Live systems map: `_docs/dev/SYSTEMS.md`.)*

**Foundation (vertical slice) shipped:** momentum movement + boost/dash, static + AI enemies with collision, lock-on targeting, **flat-shot** combat, hit detection / damage / death, menu + death overlays + auto-pause, a built-out **bunker hub** (lounge, kitchen, props, walking driver), a **modular GLB tank-parts pipeline** (M26 + T-44; hull/turret/cannon swap with adaptive composition), and the tank designer/garage.

**Now building toward the v2 extraction roguelite** (roadmap in `_docs/dev/SYSTEMS.md`):
1. ⬜ Zone structure — starter zone, depth-scaled difficulty
2. ⬜ Loot table — common consumables + rare parts
3. ⬜ Extraction mechanic — extract-alive vs death split
4. ⬜ Classless equip system — parts from any doctrine
5. ⬜ Hub NPC system — 5 rescuable slots
6. ⬜ Research tree (stats only) — Mobility / Health / Armor / Fuel

---

## Scope Discipline

This is the developer's first shipped game. Scope discipline matters more than feature ambition.

- **Build the extraction loop incrementally.** Hub → deploy → scavenge → extract/die → upgrade. Get one zone working end-to-end before adding more zones, NPCs, or systems.
- **Don't pre-build speculative systems.** Build for the current roadmap step (see `_docs/dev/SYSTEMS.md`), refactor when the next step actually arrives.
- **Bumper-car collision feel is intentional.** The user noticed it and wants to keep it — it may become a "ram build" chassis type in V1.1. Don't tune it away unless it's a bug, not flavor.
- **If a request feels too big for one session, flag it.** Suggest splitting.

---

## Things to Avoid

- Code with patterns and abstractions the developer can't maintain
- Adding libraries beyond Babylon.js and Vite unless necessary
- TypeScript
- ESLint, Prettier, or other dev tooling complexity
- Test frameworks
- Premature optimization
- Skipping ahead to features in later milestones
- Long monologue responses — keep explanations focused, let the developer ask follow-ups
- Changing the menu's monochrome look (it's intentional)

---

## When in Doubt

Ask the developer. Most ambiguities resolve with one clarifying question, not a guess.
