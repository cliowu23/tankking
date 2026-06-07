# Flat Shots + Turret Zone Crits — Design Spec
**Date:** 2026-06-01  
**Status:** Approved, ready for implementation planning

---

## Problem

The current ballistic arc system causes two compounding issues:
1. Hitting a specific zone on an enemy (turret vs hull) is unreliable — the arc, elevation approximation, and XZ-only hit detection work against each other.
2. There is no reward for precision aim. Every hit does identical damage.

Inspired by *Escape from Duckov*: hitting is accessible, but well-placed shots reward the player. The ballistic arc is saved for a future heavy cannon weapon type.

---

## Design Overview

Replace the player's (and all enemies') ballistic shell trajectory with a **flat, gravity-free trajectory**. Add a **Y-based zone check** to hit detection that awards a critical hit when the shell strikes at turret height. Add a **distinct critical VFX** for satisfaction.

---

## Section 1 — Shell Physics (Flat Trajectory)

**All shells — player and AI — travel with zero vertical velocity.**

### Changes to `Shell.js`
- Set `SHELL_GRAVITY = 0` in Shell.js (keep the named export — other files import it)
- Remove the gravity application line: delete `this.vy -= SHELL_GRAVITY * dt` from `Shell.update()`
- Remove the ground-hit deactivation condition: delete `this.mesh.position.y <= 0.05` from the deactivation check
- Shells now deactivate only via `life > 3.5s` timeout OR `maxRange` exceeded

### Changes to all `shell.fire(...)` call sites
All fire calls must pass `maxRange = 45`. Without gravity the shell never hits the ground, so maxRange is the only spatial bound.

| Call site | File |
|-----------|------|
| Player fire | `ArenaScene.js` → `_shoot()` |
| AI enemy fire | `AIEnemy.js` → wherever shells are fired |

### Impact on shell orientation
`Shell.update()` currently orients the shell along its velocity vector (pitch + yaw). With `vy = 0`, pitch becomes 0 — shell always travels horizontally. This is correct and looks clean for a flat-firing weapon.

---

## Section 2 — Barrel Elevation (Simplified Formula)

The current formula (`_elevationForTarget`) computes a ballistic loft angle — meaningless for flat shots. Replace it with a **direct tip-height formula** that physically points the barrel tip at the cursor's Y position.

### New formula
```
elevation = asin( clamp( (targetY - pivotWorldY) / barrelTipOffset, -1, 1 ) )
```

Where:
- `targetY` = `scene.pick().pickedPoint.y` (cursor surface height, already implemented)
- `pivotWorldY` = `this.tank.barrelPivot.getAbsolutePosition().y`
- `barrelTipOffset` = `this._barrelTipOffset` (already stored, ~2.19 in world units for M26)

### Behaviour
- Cursor on turret (y ≈ 0.75) → barrel elevates → tip fires at y ≈ 0.75 → **turret zone hit**
- Cursor on hull (y ≈ 0.35) → barrel depresses → tip fires at y ≈ 0.35 → **hull zone hit**
- Cursor on ground (y ≈ 0) → barrel depresses fully → shell skims ground

The player's aim height now **directly and visually controls which zone is struck**. No ballistics to fight.

### Lock-on elevation
Lock-on targets turret center height of the locked enemy:
```
targetY = lockedEnemy.position.y + 0.75
```
(`0.75` = approximate world-space turret center above enemy root. Single constant, tunable.)

### Remove `_elevationForTarget`
This method becomes dead code once the new formula is in place. Delete it.

---

## Section 3 — Zone Detection

In `_checkShellHits()`, add a Y-range check at the moment of hit.

### Zone boundary
```
TURRET_ZONE_Y = 0.55   // top of hull box (hull top ≈ 0.57 per Enemy.js geometry)
```

### Logic
```
if (shell.position.y >= TURRET_ZONE_Y)  →  turret hit  →  damage = 51  (×1.5), isCritical = true
else                                     →  hull hit    →  damage = 34         , isCritical = false
```

`TURRET_ZONE_Y` is a single tunable constant at the top of `_checkShellHits` (or top of the file). Expected to need minor adjustment after first playtest.

### Damage table
| Hit zone | Damage | Shells to kill (100 HP) |
|----------|--------|------------------------|
| Hull     | 34     | 3                       |
| Turret   | 51     | 2                       |

Two turret shots kills — clean and satisfying. Three hull shots kills — accessible fallback.

---

## Section 4 — Critical VFX

Extend `_spawnImpact(pos, isEnemy, isCritical)` with a third parameter.

### Critical hit visuals (turret zone)
| Property | Hull hit (current) | Turret hit (crit) |
|---|---|---|
| Core max scale | 1.2 | 1.8 |
| Core color | Orange `(1.0, 0.65, 0.0)` | Gold-white `(1.0, 0.92, 0.3)` |
| Duration | 0.40s | 0.55s |
| Blob max scale | 0.7 | 1.0 |
| Smoke color | Grey-brown `(0.55, 0.50, 0.45)` | Lighter grey `(0.70, 0.68, 0.60)` |

### Wire-up
- `_checkShellHits()` passes `isCritical` flag to `_spawnImpact()`
- `_spawnImpact()` stores `isCritical` in the VFX entry
- `_updateVFX()` reads it to select the correct scale/color/duration constants

---

## Files Changed

| File | Changes |
|------|---------|
| `src/entities/Shell.js` | Remove gravity line; remove y≤0.05 deactivation condition |
| `src/scenes/ArenaScene.js` | Replace `_elevationForTarget` with tip-height formula; update game loop barrel elevation; update `_shoot()` to pass maxRange; update `_checkShellHits()` for zone+damage; update `_spawnImpact()` and `_updateVFX()` for crit VFX |
| `src/entities/AIEnemy.js` | Update shell fire call to pass maxRange=45; replace any `barrelElevation` update logic with the same tip-height formula from Section 2, targeting `lockedEnemy.position.y + 0.75` (or player position Y equivalent) |

---

## Out of Scope

- Track / barrel disabling shots (models too small, revisit for bosses)
- On-screen "CRIT" text popup (can add later as UI polish)
- Sound differentiation for crits (audio pass is separate)
- Heavy cannon weapon type (ballistic arc lives here in a future milestone)
- Advanced enemy movement for bosses/elites (separate milestone)
