# Extraction Loop — Slice 1 (Design)
> Status: approved 2026-06-08 · The first playable slice of TanKING's core extraction-roguelite loop.

## Goal

Make TanKING *feel like an extraction game* with the smallest possible vertical slice: grab loot during a run, then choose to **extract** (bank it permanently) or risk **dying** (lose it). This is the heartbeat of the game — everything else (depth scaling, real parts, research, NPCs) layers on later.

Reuses the **existing arena**. No new scenes.

## Scope

**In:**
- Salvage pickups scattered in the arena (drive-over collect).
- An extraction pad with a **timed channel** (stand ~3s; leaving cancels).
- Outcome split: extract → bank run salvage; die → lose run salvage (tank kept, already true).
- Banked total persisted across runs and shown in the bunker.
- Post-extract: brief summary → return to the bunker.

**Out (later slices, do NOT build now):**
- Depth/difficulty scaling, multiple zones (Slice 2)
- Loot as real parts/consumables (Slice 3)
- Research tree, repair cost (Slice 4)
- Rescuable NPC slots (Slice 5)

## Design principles (non-negotiable)

1. **No hardcoding.** Every tunable is a named constant. No magic numbers in logic.
2. **Data-driven layout.** Crate and pad placement live in a single config object, not scattered through code. Editing the loadout = editing data.
3. **Scalable by construction.** `SalvageCrate` and `ExtractionZone` are generic, parameterized classes instantiated from config. Adding a crate = one array entry. Adding a whole new zone later (Slice 2) = copying the config shape — **no class changes**.
4. **Keep `ArenaScene` lean.** It only *wires* the new modules; the logic lives in the modules. (We just trimmed it 1611→1120; don't re-bloat it.)

## The loop (data flow)

```
Bunker  ──deploy──▶  Arena (runSalvage = 0)
                        │
                        ├─ drive over crate → runSalvage += crate.value ; crate.collect()
                        │
                        ├─ enter extraction pad → channel accumulates (dt)
                        │        ├─ leave pad        → channel resets to 0
                        │        ├─ channel ≥ DURATION → bankSalvage(runSalvage) → SUMMARY → Bunker
                        │        └─ die while channeling → death (nothing banked)
                        │
                        └─ die → runSalvage discarded (tank kept) → existing death screen
```

The **only** path to permanent salvage is a completed extraction.

## Components

### `src/core/runState.js` — persistence
Single source of truth for cross-run state. Slice 1 = banked salvage only.
- `getBankedSalvage(): number` — reads `localStorage['bankedSalvage']`, defaults 0.
- `bankSalvage(amount): number` — adds, persists, returns new total.
- Written so future cross-run state (research points, owned parts) can join the same module.

### `src/world/SalvageCrate.js` — pickup entity
Mirrors the existing entity pattern (`Enemy.js`, `Shell.js`).
- `constructor(scene, { x, z, value })` — builds a bright, gently bobbing/spinning crate mesh (high readability from the top-down camera).
- `get position`, `value`, `collected`.
- Exposes `position`; `ArenaScene` owns the pickup test (tank↔crate XZ distance < `PICKUP_RADIUS`).
- `collect()` — hides mesh, sets `collected = true`.
- `reset()` — restore for `_restart()`.
- Generic: value and position come from config; the class hardcodes nothing about *which* crates exist.

### `src/world/ExtractionZone.js` — pad + channel
- `constructor(scene, { x, z, radius })` — flat marked pad (cyan ring, pulsing, matches the Tron UI accent `#00e5ff`).
- `contains(pos): boolean` — XZ distance < radius.
- `update(dt, tankInside): { progress, completed }` — accumulates channel time while `tankInside`, resets to 0 when not; `progress` is 0–1; fires `completed` once when it crosses `CHANNEL_DURATION`.
- `progress` getter for the HUD ring.
- `reset()` — clears progress for `_restart()`.

### `src/world/arenaLoot.js` — layout config (the scalable seam)
The one place that defines *what spawns where*. Shaped so it can become per-zone later.
```js
export const ARENA_LOOT = {
  salvageCrates: [ { x, z, value: CRATE_VALUE }, ... ],   // ~5 entries
  extractionZone: { x, z, radius: EXTRACT_ZONE_RADIUS },  // 1 for now; array-ready later
};
```
Adding crates / moving the pad happens here, never in `ArenaScene`.

### `ArenaScene` wiring (~30 lines, no logic)
- Construct crates + zone from `ARENA_LOOT`.
- `this._runSalvage = 0`.
- In the game loop: drive-over pickup check (tank↔crate distance < `PICKUP_RADIUS`), `zone.update(dt, zone.contains(tank.position))`, refresh HUD.
- On `completed` → `bankSalvage(this._runSalvage)` then `this._onExtract(runSalvage, banked)` callback.
- `_restart()` → reset crates, zone, `_runSalvage = 0`, refresh HUD.

### `main.js` flow
- Pass `onExtract` into `ArenaScene` (alongside existing construction).
- `onExtract` → show **EXTRACTED** summary overlay with a **"RETURN TO BUNKER" button** (click-to-continue, matching the death/pause overlay pattern) → on click, run the existing arena→hangar transition (reuse `startHangar`/equivalent).

### `HangarScene` / bunker readout
- Show `getBankedSalvage()` in a small HUD element while in the bunker.

### UI (inline in `index.html`, matching the existing HUD pattern — no `ui/` module this slice)
- Run-salvage counter (HUD corner) during `GAME`.
- Extraction prompt + radial progress ring when on the pad.
- EXTRACTED summary overlay (`+X salvage · banked: Y`).
- Banked-salvage readout in the bunker.

## Constants (named, centralized)
- `CHANNEL_DURATION = 3` (s)
- `CRATE_VALUE = 25`
- `PICKUP_RADIUS = 1.5`
- `EXTRACT_ZONE_RADIUS = 3`
- Crate positions + pad position live in `ARENA_LOOT` (data, not constants buried in logic).

## Edge cases
- **Die mid-channel** → death flow; nothing banked.
- **Leave pad mid-channel** → progress resets to 0.
- **Extract with 0 salvage** → allowed; banks 0.
- **Pause mid-channel** → game loop early-returns while paused, so the channel freezes; resumes correctly.
- **Restart** → crates visible again, zone progress 0, run salvage 0.

## Verification (no test framework — build + live browser)
1. `npm run build` passes.
2. Playwright live: deploy → drive over crates → assert `arena._runSalvage` rises by `CRATE_VALUE` each.
3. Enter pad → assert `zone.progress` climbs; leave → assert it resets.
4. Complete channel → assert `localStorage.bankedSalvage` increased by the run bag; assert state returns to `HANGAR` and the bunker readout shows the new total.
5. Separately: collect, then die → assert `bankedSalvage` unchanged (run bag lost).

## File summary
**New:** `core/runState.js`, `world/SalvageCrate.js`, `world/ExtractionZone.js`, `world/arenaLoot.js`
**Edited:** `world/ArenaScene.js` (wire-in), `core/main.js` (onExtract + summary), `hub/HangarScene.js` (banked readout), `index.html` (HUD elements + overlay)
