# TanKING — Engineering Reference
> Code conventions, architecture, controls, and scope discipline. Preserved from the original CLAUDE.md. Reference and update this when implementation patterns change.

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

The menu, pause, and death screens are DOM overlays in `index.html` driven by `main.js` (monochrome look is intentional — do not change). There are no separate `BootScene` / `MenuScene` / `GameOverScene` files.

Entities are their own classes managing Babylon.js meshes, organized by domain: `src/tank/Tank.js` is the player's vehicle; `src/world/AIEnemy.js` handles enemy AI logic, `src/world/Enemy.js` / `src/world/TerrainPiece.js` the static enemies and terrain; `src/combat/Shell.js` manages projectile physics. Scenes live with their domain: `src/world/ArenaScene.js`, `src/hub/HangarScene.js` + `src/hub/TankDesignerScene.js`, `src/core/main.js` (entry + scene orchestration).

---

## Tank Models — Pipeline

The tank is rendered two ways:

- **`src/tank/Tank.js`** — a vehicle built from Babylon.js primitives (fallback when no GLB is selected).
- **Modular GLB parts system** (`src/tank/parts/`) — the current direction. Real `.glb` assets in `public/assets/models/tanks/` (M26 Pershing, T-44) are split into hull / turret / cannon parts (`parts/hulls/`, `parts/turrets/`, `parts/cannons/`), described by `public/assets/models/manifest.json`, and recombined by `assembleTank.js`. `PARTS_BY_ID` in `parts/index.js` is the registry.

> The older primitive-only `PershingTank.js` / `T80Tank.js` classes no longer exist — superseded by the GLB parts pipeline.

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
| Mouse (click) | Fire — flat shot (no charge mechanic in V1; 0.3s cooldown) |
| F (hold 0.7s) | Lock on to nearest enemy |
| F (tap while locked) | Cycle targets |

---

## Scope Discipline

This is the developer's first shipped game. Scope discipline matters more than feature ambition.

- **Build the extraction loop incrementally.** Hub → deploy → scavenge → extract/die → upgrade. Get one zone working end-to-end before adding more zones, NPCs, or systems.
- **Don't pre-build speculative systems.** Build for the current roadmap step (see `SYSTEMS.md`), refactor when the next step actually arrives.
- **Bumper-car collision feel is intentional.** The user wants to keep it — it may become a "ram build" chassis type in V1.1. Don't tune it away unless it's a bug, not flavor.
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
- Long monologue responses — keep explanations focused
- Changing the menu's monochrome look (it's intentional)

---

## Developer Context

The developer is learning as they build, with no digital art or 3D modeling background.

- **Explain decisions as you go** — they should understand the code, not just have it.
- **Prefer simple, readable code over clever code.**
- **Stop and ask before assumptions.** If ambiguous, ask rather than choose.
- **Suggest small, testable increments.**
- **For 3D visuals, use a tight feedback loop** — adjust numbers and reload; reference images work better than descriptions.
- **Don't pretend to know Babylon.js quirks** — when unsure about specific API behavior, say so.
