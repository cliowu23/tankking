# Hangar Hub — Design Spec
**Date:** 2026-06-02  
**Approach:** B — Space + full game loop (stub content, real interactions)

---

## Overview

The hangar is a persistent hub world between missions — the game's equivalent of Firelink Shrine. It is a single Soviet command bunker room buried inside a mountain, accessible via a north tunnel that the tank drives through to reach the arena. The player inhabits the space as a third-person driver character, interacting with four stations before mounting the tank and deploying.

---

## Layout

Single rectangular room: **30 units wide × 40 units deep**. Sized generously so blank wall space exists for future additions without feeling cramped.

```
         SURFACE / ARENA
               ▲▲▲
          [ TUNNEL 5u wide ]
    ┌──────────────────────────┐
    │ [TACT.MAP]   [TANK BAY]  [RADIO] │
    │                                  │
    │ [MECHANIC]   (floor)   [Q.MASTER]│
    │                                  │
    │              ●                   │
    │           (driver)               │
    └──────────────────────────┘
           SOLID ROCK (all sides)
```

**Stations:**
- **Tank bay** — north wall, flush to tunnel mouth. Tank always faces north, barrel aimed at exit.
- **Tactical map** — top-left corner. Mission select.
- **Radio / Intel** — top-right corner. Briefings / intel.
- **Mechanic** — left wall, mid-height. Upgrades, repairs, paint.
- **Quartermaster** — right wall, mid-height. Ammo, shells, supplies.

No south entrance. All walls are solid. The north tunnel is the only way in or out.

---

## Architecture

### New files
| File | Purpose |
|------|---------|
| `src/scenes/HangarScene.js` | Room geometry, stations, lighting, scene lifecycle |
| `src/entities/DriverCharacter.js` | Driver mesh, WASD movement, FollowCamera, interaction detection |

### Modified files
| File | Change |
|------|--------|
| `src/main.js` | Add `HANGAR` state; implement state machine (`let state`); change new-game flow to go MENU → HANGAR instead of MENU → GAME; add hangar↔arena transition handlers |

### State machine
```
MENU → HANGAR → GAME → HANGAR
                     ↘ (death/win loops back to HANGAR)
```
The approved state machine refactor (`let state = 'MENU'`) is implemented as part of this build. States: `MENU | HANGAR | GAME | PAUSED | DEAD | CONTROLS | INSPECTOR`.

---

## Driver Character (`DriverCharacter.js`)

- **Mesh:** Babylon.js capsule (placeholder). Real character GLB can swap in later with no logic changes.
- **Movement:** WASD on the XZ plane at ~5 units/sec. No jumping.
- **Camera:** `FollowCamera` — 6 units behind, 4 units above, locked to driver's facing direction. Auto-follows; no mouse look needed.
- **Collision:** `checkCollisions = true` on driver and all wall/station meshes. Driver cannot walk through geometry.
- **Spawn point:** Center-south of the room each time HangarScene loads.

---

## Stations & Interactions

Each station is a prop mesh positioned on the wall. Each has a **trigger volume** (invisible box, `~3 × 3 × 3` units).

**Interaction loop:**
1. Driver enters trigger volume → `[E] Interact` prompt appears (CSS overlay, same pattern as existing UI).
2. Player presses E → overlay panel opens. Panel is a stub for V1 ("Coming Soon" + close button). The slot is wired; content fills in per feature.
3. Press E or Escape → panel closes, driver resumes.

| Station | V1 Panel content |
|---------|-----------------|
| Tactical map | "MISSION SELECT — Coming Soon" + Deploy button (launches arena) |
| Radio / Intel | Stub flavor text briefing |
| Mechanic | "UPGRADES — Coming Soon" |
| Quartermaster | "SUPPLIES — Coming Soon" |
| Tank | `[E] Mount` → transition to arena (see below) |

The tactical map's **Deploy button** and the **Tank mount** both trigger the same hangar→arena transition.

---

## Transitions

### Hangar → Arena
1. Player presses E near tank (or clicks Deploy on tactical map).
2. Driver mesh hides. Camera cuts to tank's follow camera.
3. Tank becomes player-controlled (same as current ArenaScene controls).
4. Player drives north. At the tunnel mouth (x=0, z≥18), trigger fires: fade to black over 0.5s, dispose HangarScene, load ArenaScene.

### Arena → Hangar
1. Mission ends (player death or wave clear).
2. Fade to black over 0.5s (same as existing death screen, just re-routed).
3. Dispose ArenaScene. Load HangarScene.
4. Driver spawns center-south. Tank is back in bay.

---

## What's Stubbed in V1

These are intentionally deferred — the slots exist and are interactable, the content is empty:
- Upgrade system (mechanic station)
- Ammo/loadout system (quartermaster station)
- Mission select system (tactical map)
- Intel/briefing content (radio station)
- NPC figures at each station
- Soviet atmosphere (materials, lighting, Cyrillic stencils, ambient sound)
- Tank selection (future: multiple tanks in the bay)
- Branching side rooms (future: armory, barracks, etc.)

---

## Out of Scope

- Personal quarters (removed — too close to Duckov aesthetic)
- Pedestrian mountain entrance (not needed — it's a game)
- Animated NPCs in V1
- Atmospheric materials in V1 (flat colored geometry is fine to prove the loop)
