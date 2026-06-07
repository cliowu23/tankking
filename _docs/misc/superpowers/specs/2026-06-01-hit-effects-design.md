# Hit Effects — Normal vs Critical Visual Design

**Date:** 2026-06-01  
**Status:** Approved  
**File scope:** `src/scenes/ArenaScene.js` only

---

## Summary

Two visually distinct hit effects based on whether the shot was a critical hit or a normal hit. Currently both use the same orange fireball and the same screen shake. After this change they diverge completely in look and feel.

---

## Normal Hit

### VFX
Replaces the existing orange fireball entirely when `isCritical = false`.

**White flash:**
- Radial gradient: white core → light blue mid → transparent edge
- Radius grows from 8px to ~24px over 0.18s (easeOut)
- Fades out fully by ~0.5s

**Arc sparks:**
- 7 sparks launched in an upward cone (~±60° from straight up)
- Each spark has an initial velocity (speed 32–50 units/s) and falls under gravity (~60–80 units/s²)
- Rendered as short line segments: white trail with yellow tip
- Trails computed from position at `t` vs position at `t - 0.08s`
- Fade out by ~0.75s total

**Smoke puff:**
- 2 small gray blobs rise ~18px and fade — same as existing muzzle smoke pattern
- Starts at 0.22s (after flash peaks), fully gone by 0.75s

**Total duration:** 0.75s

### Screen Shake
`_triggerShake(0.06, 0.15)` — half the duration and roughly one-third the intensity of the current shared call.

---

## Critical Hit

### VFX
No change. Existing orange fireball behavior (`isCritical = true` path in `_spawnTankImpact`) is kept exactly as-is.

### Screen Shake
`_triggerShake(0.12, 0.4)` — current level, unchanged.

---

## Implementation

### Mesh pools
Pre-allocate spark meshes alongside the existing fire/smoke pools. 4 slots × 7 sparks = 28 meshes.

**Mesh type:** Thin `MeshBuilder.CreateBox` (scale x/z to ~0.08, scale y to spark length each frame), rotated to face the direction of travel. Consistent with the existing pool pattern of repositioning/scaling sphere meshes — no per-frame vertex buffer updates needed.

Each spark stores:
- `_vfxActive` flag
- `vx`, `vy`, `vz` — initial velocity (set on spawn)
- `gravity` — per-spark gravity constant (set on spawn)

### `_spawnTankImpact(pos, isCritical)`
Branch at the top:
- `isCritical = false` → activate flash + spark + smoke pool slot, push `{ type: 'normalImpact', ... }` entry
- `isCritical = true` → existing orange fireball logic, unchanged

### `_updateVFX`
New `normalImpact` branch:
- Flash: scale/alpha driven by time, same pattern as existing `muzzleFlash`
- Sparks: each spark position = `origin + v*t + 0.5*gravity*t²` (per-axis), trail = position at `t - 0.08`
- Smoke: same eased rise + fade as existing `muzzleSmoke`

### Shake split (line ~1336)
```js
// before
this._triggerShake(0.12, 0.4);

// after
this._triggerShake(isCritical ? 0.12 : 0.06, isCritical ? 0.4 : 0.15);
```

---

## What is NOT changing
- Crit detection logic (`perpDist < 0.4`)
- Damage values (51 crit / 34 normal)
- Crit VFX (orange fireball, sizes, colors)
- Player-hit shake (line ~1313, `_triggerShake(0.18, 0.55)`) — untouched
- Muzzle flash / muzzle smoke — untouched
- Hitmarkers — deferred to a future session
