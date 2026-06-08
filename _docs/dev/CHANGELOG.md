# Changelog

A running timeline of notable changes to TanKING — features shipped, systems built, and major doc/process changes. Newest at the top.

For the *reasoning* behind architectural choices, see `DECISIONS.md`. This file is the *what & when*; that one is the *why*.

> Entries before 2026-06-07 were reconstructed from dated plans/specs (`_docs/misc/superpowers/`), file timestamps, and `DECISIONS.md`. Dates are approximate where noted. Keep this updated going forward — add an entry whenever something meaningful ships or a major decision lands.

---

## 2026-06-08 — Extraction loop Slice 1
- Salvage crates (drive-over) + extraction pad with a 3s timed channel
- Extract banks run salvage (persisted via `runState.js`); death loses it (tank kept)
- Banked total shown in the bunker; EXTRACTED summary → return to bunker
- Config-driven + scalable: all layout/tuning in `world/arenaLoot.js`; generic `SalvageCrate` / `ExtractionZone` entities
- New files: `core/runState.js`, `world/arenaLoot.js`, `world/SalvageCrate.js`, `world/ExtractionZone.js`

## 2026-06-07 — Docs restructure

- Replaced `CLAUDE.md` with the v2 extraction-roguelite vision (Steam/PC target, 4 doctrines incl. Tank Destroyer, 8 design rules, loot/economy, lock-on stealth tradeoff).
- Split the old CLAUDE.md's technical content into the vault: new `_docs/art/ART_DIRECTION.md` (palette + Tron UI spec, exact colors) and `_docs/dev/ENGINEERING.md` (conventions, architecture, controls, scope discipline).
- Retired `TANKING_RESTRUCTURE2.md` (file lost; purpose served) — scrubbed all references from `CLAUDE.md`, `SYSTEMS.md`, `DESIGN_PIPELINE.md`, repointed to `CLAUDE.md`.
- Confirmed Obsidian MCP connected; `.obsidian/` config now present in the `_docs/` vault.
- Started this changelog.

## 2026-06-04 — Adaptive turret composition

- Turret composition system built and working on the M26 Pershing (hull/turret/cannon recombine via `assembleTank.js`).
- Cross-source T-55 disabled — pipeline is War Thunder-tuned; cross-source models break it.
- Plan + spec: `2026-06-04-adaptive-turret-composition*.md`.

## 2026-06-03 — Inventory system notes / composable parts proof

- Composable parts proof: M26 done, T-55 disabled. Direction set toward GLB-extraction for content.
- Inventory system notes drafted: `2026-06-03-inventory-system-notes.md`.

## 2026-06-02 — Hangar build + polish

- Built out the bunker/hangar hub (lounge, kitchen, props, walking driver).
- Established the hangar-station-designer pipeline (mockup → drag-to-move editor → bake → port).
- Plans + specs: `2026-06-02-hangar*.md`.

## 2026-06-01 — Combat feel pass

- Flat-shot combat, zone crits, hit effects, and shell upgrades designed/implemented.
- Plans + specs: `2026-06-01-flat-shots-zone-crits*.md`, `2026-06-01-hit-effects*.md`, `2026-06-01-shell-upgrade-design.md`.

## 2026-05-30 — Aesthetic pivot + vertical slice complete

- **Aesthetic pivot:** bleak dystopian → bright "Super Mario World × Escape from Duckov" (green grass, sunshine, golden walls). See `DECISIONS.md`.
- **Vertical slice declared complete:** all 8 core milestones playable end-to-end (movement, boost, enemies, lock-on, fire, damage, AI, death/restart).
- Developer toolkit + tools-activation docs added (`TOOLKIT.md`, `TOOLS_ACTIVATION.md`).

## 2026-05-29 — Physics reference

- Tuned AABB collision values documented (`PHYSICS_REFERENCE.md`) — bumper-car ram feel, push multipliers, friction thresholds.

## 2026-05-15 — Engine pivot + foundations

- **Engine pivot:** Phaser 3 (2D) → Babylon.js 7.54.3 (3D) — for real 3D tanks, turrets, barrel elevation, shell arcs.
- Adopted toy/cartoon as the base aesthetic (chunky proportions, saturated primaries).
- `pre-implementation` git tag set as a safe rollback point.

## Early dev — Project foundations

- Plain JavaScript (no TypeScript), no test framework, Babylon.js primitives over imported models, hand-rolled AABB collision. Rationale in `DECISIONS.md`.
