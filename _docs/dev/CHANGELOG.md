# Changelog

A running timeline of notable changes to TanKING — features shipped, systems built, and major doc/process changes. Newest at the top.

For the *reasoning* behind architectural choices, see `DECISIONS.md`. This file is the *what & when*; that one is the *why*.

> Entries before 2026-06-07 were reconstructed from dated plans/specs (`_docs/misc/superpowers/`), file timestamps, and `DECISIONS.md`. Dates are approximate where noted. Keep this updated going forward — add an entry whenever something meaningful ships or a major decision lands.

> 📸 **When a milestone is visual, also record a timelapse frame** (the living visual record in `timelapse/`). After committing, run:
> `timelapse/tools/record-frame.sh HEAD <arena|hangar|designer|raw> <name.png> "<date>" "<title>" "<desc>" [base]`
> then refresh `timelapse/index.html`. See `timelapse/README.md`. Commit first — captures use committed state.

---

## 2026-06-11 — World 1 "Green Fields" vertical slice
- First real zone, built mockup-first (`world1-mockup.html`, user-approved layout gate) then ported.
- **Zone system:** `world/zones/world1.js` data config (spawn, extraction, 3 depth bands, 16 fixed
  enemy spawns, 13 depth-scaled loot drops, palette, dressing data) + `ArenaScene(engine, cb, zone)`.
  Hardcoded ±48 bounds in Tank/Enemy/AIEnemy parameterized (`.bounds`; World 1 = ±140 of 300×300).
- **The tunnel means something now:** deploy → Aqua-Arcade loading screen (`#deploy-loading`,
  awaits `ArenaScene.ready`) → spawn just north of a south-berm tunnel mouth (hangar bore recipe,
  portal headwall, grassy mounds) inside a sandbag+dragon-teeth safe zone; extraction = drive back
  to the mouth and channel.
- **`World1Builder.js`:** sculpted border hills (playable stays y=0), hard-edged dirt paths, 20
  hedgerows + walls with chained AABB obstacles, chunked thin-instance tall grass (ambush hides
  tinted), instanced trees/rocks, blob shadows, POIs (Clint's ruined store, outsider wreck,
  farmstead, ruined watchtower, Tankford checkpoint, 3-cottage village + well), Iron Keep vista
  on the unreachable north hill.
- **Chaffee enemies:** `LightTankEnemy` = light modular parts assembled per enemy onto the AIEnemy
  rig (same path as the player tank), Tankford red; AIEnemy gained opts tuning, AMBUSH state +
  `hearNoise` (player gunfire within 30u springs hidden ambushers), death-tint/revive hooks.
  ArenaScene unified to one enemies array; ALL enemy shell pools now hit-checked (per-enemy damage).
- Verified end-to-end via Playwright: deploy → drive out of safe zone → kill → loot → extract →
  redeploy; 120 FPS spawn / 70 FPS village; no GL errors (fixed thin-instance clones sharing
  geometry corrupting buffers; fixed ArcRotate double-click state restore in the mockup).
- **Known follow-ups:** distant Keep can't enter the fixed top-down frustum (reads as the north
  hill in-game — consider camera ease or HUD marker); modelgen GLBs are mesh-heavy → ~1100 active
  meshes / 324 materials at the deep band (merge meshes in the generator); fences invisible from
  top-down; enemy AI has no obstacle avoidance (hedgerows can snag chasers).

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
