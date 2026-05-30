# CLAUDE.md — TanKING Project Context

## What This Project Is

**TanKING** — a top-down 3D tank roguelite built in Babylon.js. The player builds a customizable tank in a hangar, takes it into a bright grass battlefield arena, fights enemies, defeats a boss, returns with research points to unlock new parts. Soul Knight × Escape from Duckov × War Thunder × Cosmoteer DNA. Aesthetic north star: *"Beautiful in a bright way — a battlefield that feels like a game, not a war."* Super Mario World × toy soldier energy: cheerful, casual, saturated primary colors.

Full design specification lives in `design-doc.md`. Reference it for feature decisions. Update it when design changes.

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
- Logical folder structure: `src/scenes/`, `src/entities/`, `src/systems/`, `src/utils/`

---

## Architecture (Babylon.js Conventions)

**Scene-per-major-state pattern.** Each major game state is its own class with a Babylon.js `Engine` and `Scene`:

- `BootScene` — initial asset loading
- `MenuScene` — title screen (monochrome, intentionally — do not change)
- `HangarScene` — hub where the player builds their tank
- `ArenaScene` — the gameplay battlefield (primary scene)
- `GameOverScene` — death / results / return to hangar

Entities (Tank, Enemy, Shell, AIEnemy, TerrainPiece, etc.) are their own classes managing Babylon.js meshes. The `Tank.js` class is the player's vehicle; `AIEnemy.js` handles enemy AI logic; `Shell.js` manages projectile physics.

---

## Controls (Current)

| Key | Action |
|-----|--------|
| W / S | Forward / Reverse |
| A / D | Rotate tank hull |
| Shift (tap) | Tap boost / dash |
| Shift (tap + W + A or D) | Spin boost |
| Shift (hold) | Sustained boost |
| Space (hold) | Charge cannon — raises barrel elevation over 1.5s |
| Space (release) | Fire shell at current elevation |
| F (hold 0.7s) | Lock on to nearest enemy |
| F (tap while locked) | Cycle targets |
| Mouse | Free-aim turret |

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

Two 3D models built from Babylon.js primitives (no external files):

- **PershingTank.js** — egg-shaped cast turret, large mantlet disc, 90mm barrel. **Approved.** Recolor to toy green `(0.18, 0.75, 0.22)` is queued in the visual overhaul.
- **T80Tank.js** — file exists on disk but model is removed from the scene. Do not re-spawn it without a redesign.

---

## Current Milestone

*(Update this when a milestone completes.)*

**Vertical slice: COMPLETE.** All 8 core milestones shipped:
1. ✅ Project setup + basic movement (momentum, turning radius)
2. ✅ Boost system (tap dash, spin boost, hold boost, fuel meter)
3. ✅ Static enemies + collision physics
4. ✅ Main menu, CRT power-off transition, auto-pause, canvas management
5. ✅ Lock-on targeting (F key, 0.7s lock, ring animation, target cycling)
6. ✅ Charge-to-fire + barrel elevation + shell arc
7. ✅ Hit detection, damage, enemy death
8. ✅ Enemy AI, player damage, death state, game over flow

**Now entering: Design / Content phase.**
Next work is environment design, visual overhaul, audio, and the Hangar/Research systems.
Visual overhaul plan lives at `/Users/cliowu/.claude/plans/lets-do-it-then-groovy-pearl.md`.

---

## Scope Discipline

This is the developer's first shipped game. Scope discipline matters more than feature ambition.

- **V1 = vertical slice only.** One arena, one tank, one enemy type with real AI, working combat end-to-end. Nothing more.
- **Don't pre-build for V2.** Build for the current milestone, refactor when V2 actually arrives.
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
