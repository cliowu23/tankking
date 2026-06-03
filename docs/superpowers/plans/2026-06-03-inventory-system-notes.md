# Inventory System — Planning Notes (pre-design)

> Status: **captured, not yet brainstormed.** This is a requirements/intent dump so the
> idea isn't lost. Run it through brainstorming → spec → writing-plans before building.
> Date: 2026-06-03

## Why
Player vision: start with a humble **base tank**, then acquire parts/loot as they progress
and build the tank up. That requires a place to track what the player owns and what's
equipped. This is the backbone of the roguelite progression loop.

## What it must track
- **Parts** — hulls, turrets, cannons (the composable parts from `src/parts/`), and likely
  later: armor, engine, tracks, optics, etc. Each has an id + stats.
- **Loot / materials** — currency or crafting/research materials earned from runs
  (design-doc mentions "research points to unlock new parts").
- **Ammo** — consumable; per-shell-type counts (AP/HE/etc. if shell types get added).
- **Equipped loadout** — the currently-assembled tank: `{ hull, turret, cannon, ... }`.
  Distinct from owned inventory (you own many, equip a few).

## Key requirements
- **Persistence across runs** — inventory + unlocks survive between arena runs and sessions
  (localStorage to start; the loadout already persists via `localStorage 'selectedTank'`,
  extend to a full loadout object).
- **Two-layer model** — `owned` (everything acquired) vs `equipped` (current loadout).
  Equipping pulls from owned; you can't equip what you don't own.
- **Hangar integration** — the build/equip UI lives at the **mechanic station**; the
  **quartermaster station** is the natural home for ammo/consumables. Both stations already
  exist as stubs in `HangarScene.js`.
- **Feeds `assembleTank`** — the equipped loadout is exactly the `{hull,turret,cannon}`
  object `src/parts/assembleTank.js` already consumes. Inventory → loadout → assembleTank →
  the tank you deploy with.

## Open questions (resolve in brainstorm)
- **Roguelite reset vs meta-progression:** do parts/ammo persist permanently (meta-unlocks)
  or reset each run? CLAUDE.md leans meta ("return with research points to unlock parts"),
  but ammo is probably per-run consumable. Likely hybrid: parts persist, ammo/consumables
  per-run.
- **Sidegrade vs upgrade:** parts need real `stats` (currently empty). Decide whether parts
  are strictly-better upgrades (power treadmill) or sidegrades (build variety). Biggest
  balance lever — shapes how every part is authored.
- **Acquisition:** how do parts enter inventory? Arena drops / boss rewards / research-point
  purchases at the quartermaster?
- **Capacity / stacking:** unlimited inventory, or weight/slot limits? Ammo stack caps?
- **Data shape:** part definitions live in `src/parts/` (the registry). Inventory stores
  *owned ids* + counts, not full definitions. Loadout stores equipped ids.

## Dependencies / sequencing
This sits alongside the composable-parts sub-projects. Rough order:
1. Finish part extraction (more hulls/turrets) — content to populate inventory with.
2. Inventory data model + persistence (this doc).
3. Hangar build-UI slot picker (mechanic) reading inventory, writing loadout.
4. Route gameplay (ArenaScene) through the equipped loadout via `assembleTank`.
5. Acquisition loop (drops/research) feeding inventory.
