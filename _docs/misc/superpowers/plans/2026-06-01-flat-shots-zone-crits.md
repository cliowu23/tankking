# Flat Shots + Turret Zone Crits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ballistic arc on all shells with flat gravity-free trajectory, add Y-zone hit detection that awards 1.5× damage on turret hits, and show a distinct gold critical VFX.

**Architecture:** Three independent changes applied in sequence — shell physics (Shell.js), barrel elevation formula (ArenaScene + AIEnemy), zone hit detection + crit VFX (ArenaScene). Each task is independently testable in-browser.

**Tech Stack:** Babylon.js 7.54, plain JS, Vite dev server at localhost:5173

---

## File Map

| File | What changes |
|------|-------------|
| `src/entities/Shell.js` | Set `SHELL_GRAVITY = 0`, remove gravity application, remove ground-hit deactivation |
| `src/scenes/ArenaScene.js` | Replace `_elevationForTarget` with `_elevationForHeight`; update barrel elevation block; update `_shoot()`; update `_checkShellHits()` for zone + damage; update `_spawnImpact()` + `_updateVFX()` for crit |
| `src/entities/AIEnemy.js` | Replace `_elevationForTarget` with `_elevationForHeight`; update `_fire()` to pass `maxRange` |

---

## Task 1 — Flat Shell Physics

**Files:**
- Modify: `src/entities/Shell.js`

- [ ] **Open `src/entities/Shell.js` and make three edits:**

**Edit 1** — Set gravity constant to 0 (line 3):
```js
export const SHELL_GRAVITY = 0;
```

**Edit 2** — Remove gravity application. Delete line 38:
```js
// DELETE this line:
this.vy -= SHELL_GRAVITY * dt;
```

**Edit 3** — Remove ground-hit deactivation from line 50. Replace the full condition:
```js
// BEFORE:
if (this.mesh.position.y <= 0.05 || this.life > 3.5 || (this.maxRange > 0 && hDist >= this.maxRange)) {

// AFTER:
if (this.life > 3.5 || (this.maxRange > 0 && hDist >= this.maxRange)) {
```

- [ ] **Reload localhost:5173, start a game, fire several shots.**
  - Shells should travel in a flat straight line — no arc, no drop
  - Shells disappear after ~3.5 seconds if no maxRange set yet (they fly off into the wall — that's expected, maxRange comes in Task 3)

- [ ] **Commit:**
```bash
git add src/entities/Shell.js
git commit -m "feat: set SHELL_GRAVITY=0, remove ground-hit deactivation for flat trajectory"
```

---

## Task 2 — Player Barrel Elevation: Tip-Height Formula

**Files:**
- Modify: `src/scenes/ArenaScene.js`

The current `_elevationForTarget` computes a ballistic loft — meaningless now. Replace the entire barrel elevation block in the game loop and delete `_elevationForTarget`.

- [ ] **Replace the barrel elevation block in `_setupGameLoop` (lines 676–692):**

```js
// BEFORE (lines 676–692):
      // --- Barrel elevation ---
      const MAX_ELEV = 50 * Math.PI / 180;
      if (this.lockedEnemy) {
        const predicted  = this._predictTargetPos(this.lockedEnemy);
        const targetElev = this._elevationForTarget(predicted);
        this.tank.barrelElevation += (targetElev - this.tank.barrelElevation) * (1 - Math.exp(-10 * dt));
      } else {
        // Cursor aim: pick the actual surface under the cursor so elevation accounts
        // for target height (turret, hull, hill) rather than just the ground plane.
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        if (pick.hit && pick.pickedPoint) {
          const pos     = { x: pick.pickedPoint.x, z: pick.pickedPoint.z };
          const targetY = pick.pickedPoint.y;
          const targetElev = Math.max(0, Math.min(MAX_ELEV, this._elevationForTarget(pos, targetY)));
          this.tank.barrelElevation += (targetElev - this.tank.barrelElevation) * (1 - Math.exp(-20 * dt));
        }
      }

// AFTER:
      // --- Barrel elevation (tip-height formula: point barrel tip at cursor surface Y) ---
      if (this.lockedEnemy) {
        const targetElev = this._elevationForHeight(this.lockedEnemy.position.y + 0.75);
        this.tank.barrelElevation += (targetElev - this.tank.barrelElevation) * (1 - Math.exp(-10 * dt));
      } else {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        if (pick.hit && pick.pickedPoint) {
          const targetElev = this._elevationForHeight(pick.pickedPoint.y);
          this.tank.barrelElevation += (targetElev - this.tank.barrelElevation) * (1 - Math.exp(-20 * dt));
        }
      }
```

- [ ] **Replace `_elevationForTarget` with `_elevationForHeight` (lines 1058–1066):**

```js
// BEFORE:
  _elevationForTarget(targetPos, targetY = 0.5) {
    const tip   = this._barrelTip();
    const dx    = targetPos.x - tip.x;
    const dz    = targetPos.z - tip.z;
    const hdist = Math.sqrt(dx * dx + dz * dz);
    const t     = Math.max(0.3, hdist / 16);
    const vy    = (targetY - tip.y + 0.5 * SHELL_GRAVITY * t * t) / t;
    return Math.atan2(vy, 16);
  }

// AFTER:
  _elevationForHeight(targetY) {
    const pivotY = this.tank.barrelPivot.getAbsolutePosition().y;
    const ratio  = (targetY - pivotY) / this._barrelTipOffset;
    return Math.asin(Math.max(-1, Math.min(1, ratio)));
  }
```

- [ ] **Remove the now-unused `SHELL_GRAVITY` import from the ArenaScene import line (line 14):**

```js
// BEFORE:
import Shell, { SHELL_GRAVITY } from '../entities/Shell.js';

// AFTER:
import Shell from '../entities/Shell.js';
```

- [ ] **Reload localhost:5173, hover cursor over an enemy turret.**
  - Barrel should visually tilt up slightly when cursor is on the turret
  - Barrel should tilt down slightly when cursor is on the hull or ground
  - Lock-on should hold the barrel at a slight upward angle (turret height)

- [ ] **Commit:**
```bash
git add src/scenes/ArenaScene.js
git commit -m "feat: replace ballistic elevation with tip-height formula, delete _elevationForTarget"
```

---

## Task 3 — Fire with maxRange + zero vy

**Files:**
- Modify: `src/scenes/ArenaScene.js`

- [ ] **Update `_shoot()` (lines 1068–1085). Replace the vy line and fire call:**

```js
// BEFORE:
    const vy = Math.tan(this.tank.barrelElevation + elevSpread) * HSPEED;

    shell.fire(tip.x, tip.y, tip.z, vx, vy, vz, 0);

// AFTER:
    shell.fire(tip.x, tip.y, tip.z, vx, 0, vz, 45);
```

The `vy` variable and `elevSpread` are now unused — remove those two lines too:

```js
// DELETE these two lines:
    const elevSpread = (Math.random() - 0.5) * 2 * this.tank.dispersion;
    const vy = Math.tan(this.tank.barrelElevation + elevSpread) * HSPEED;
```

Full updated `_shoot()` for reference:
```js
  _shoot() {
    const shell = this.shells.find(s => !s.active);
    if (!shell) return;

    const tip    = this._barrelTip();
    const HSPEED = 16;
    const aim    = this.tank.turretAimAngle;

    const azSpread = (Math.random() - 0.5) * 2 * this.tank.dispersion;
    const vx = Math.sin(aim + azSpread) * HSPEED;
    const vz = Math.cos(aim + azSpread) * HSPEED;

    shell.fire(tip.x, tip.y, tip.z, vx, 0, vz, 45);
    this._spawnMuzzleFlash(tip);
    this._triggerShake(0.06, 0.2);
    this._fireCooldown = 0.3;
    this.tank._recoil = 1.0;
  }
```

- [ ] **Reload and fire at enemies across the arena.**
  - Shells travel flat, disappear after ~45 units horizontal range
  - Shell should stop well before or at the far arena wall (~50 units)
  - No more shells flying forever

- [ ] **Commit:**
```bash
git add src/scenes/ArenaScene.js
git commit -m "feat: fire flat shells with vy=0 and maxRange=45"
```

---

## Task 4 — AI Enemy: Flat Shots

**Files:**
- Modify: `src/entities/AIEnemy.js`

- [ ] **Replace `_elevationForTarget` in AIEnemy.js (lines 280–288):**

```js
// BEFORE:
  _elevationForTarget(targetPos) {
    const tip   = this._barrelTip();
    const dx    = targetPos.x - tip.x;
    const dz    = targetPos.z - tip.z;
    const hdist = Math.sqrt(dx * dx + dz * dz);
    const t     = Math.max(0.3, hdist / HSPEED);
    const vy    = (0.5 - tip.y + 0.5 * SHELL_GRAVITY * t * t) / t;
    return Math.atan2(vy, HSPEED);
  }

// AFTER:
  _elevationForHeight(targetY) {
    const pivotY     = this.barrelPivot.getAbsolutePosition().y;
    const tipOffset  = 1.6; // matches _barrelTip() offset in this class
    const ratio      = (targetY - pivotY) / tipOffset;
    return Math.asin(Math.max(-1, Math.min(1, ratio)));
  }
```

- [ ] **Update the call site in the turret update block (lines 255–260):**

```js
// BEFORE:
    if (this.state === 'COMBAT') {
      const targetElev = this._elevationForTarget(playerPos);
      this.barrelElevation += (targetElev - this.barrelElevation) * (1 - Math.exp(-10 * dt));
    } else {
      this.barrelElevation *= Math.exp(-8 * dt);
    }

// AFTER:
    if (this.state === 'COMBAT') {
      const targetElev = this._elevationForHeight(playerPos.y + 0.75);
      this.barrelElevation += (targetElev - this.barrelElevation) * (1 - Math.exp(-10 * dt));
    } else {
      this.barrelElevation *= Math.exp(-8 * dt);
    }
```

- [ ] **Update `_fire()` to pass `vy = 0` and `maxRange = 45` (lines 290–303):**

```js
// BEFORE:
    shell.fire(
      tip.x, tip.y, tip.z,
      Math.sin(aim) * HSPEED,
      Math.tan(this.barrelElevation) * HSPEED,
      Math.cos(aim) * HSPEED,
    );

// AFTER:
    shell.fire(
      tip.x, tip.y, tip.z,
      Math.sin(aim) * HSPEED,
      0,
      Math.cos(aim) * HSPEED,
      45,
    );
```

- [ ] **Remove the unused `SHELL_GRAVITY` import from AIEnemy.js (line 2):**

```js
// BEFORE:
import Shell, { SHELL_GRAVITY } from './Shell.js';

// AFTER:
import Shell from './Shell.js';
```

- [ ] **Reload and let the AI enemy reach COMBAT state and fire.**
  - AI shells should travel flat (no arc)
  - AI shells should disappear after ~45 units

- [ ] **Commit:**
```bash
git add src/entities/AIEnemy.js
git commit -m "feat: AI enemy uses flat trajectory, tip-height elevation formula"
```

---

## Task 5 — Zone Detection + Damage

**Files:**
- Modify: `src/scenes/ArenaScene.js`

- [ ] **Add the zone constant at the top of `_checkShellHits()` and update the player-shell hit branch (lines 1238–1278).**

Replace only the player-shell loop (the `for (const shell of this.shells)` block, lines 1256–1277):

```js
// BEFORE:
    for (const shell of this.shells) {
      if (!shell.active) continue;
      if (shell.position.y < 0 || shell.position.y > 1.6) continue;

      for (const enemy of allTargets) {
        if (!enemy.alive) continue;
        const dx = shell.position.x - enemy.position.x;
        const dz = shell.position.z - enemy.position.z;
        if (Math.abs(dx) < 0.25 + enemy.halfW && Math.abs(dz) < 0.25 + enemy.halfD) {
          this._spawnImpact(shell.position.clone(), true);
          shell.deactivate();
          enemy.takeDamage(34);
          this._triggerShake(0.12, 0.4);
          if (!enemy.alive && this.lockedEnemy === enemy) {
            this._prevLockedEnemy = enemy;
            this._fadeOutTime     = 0;
            this.lockedEnemy      = null;
          }
          break;
        }
      }
    }

// AFTER:
    const TURRET_ZONE_Y = 0.55; // top of hull box — shells at/above this height hit the turret

    for (const shell of this.shells) {
      if (!shell.active) continue;

      for (const enemy of allTargets) {
        if (!enemy.alive) continue;
        const dx = shell.position.x - enemy.position.x;
        const dz = shell.position.z - enemy.position.z;
        if (Math.abs(dx) < 0.25 + enemy.halfW && Math.abs(dz) < 0.25 + enemy.halfD) {
          const isCritical = shell.position.y >= TURRET_ZONE_Y;
          const damage     = isCritical ? 51 : 34;
          this._spawnImpact(shell.position.clone(), true, isCritical);
          shell.deactivate();
          enemy.takeDamage(damage);
          this._triggerShake(0.12, 0.4);
          if (!enemy.alive && this.lockedEnemy === enemy) {
            this._prevLockedEnemy = enemy;
            this._fadeOutTime     = 0;
            this.lockedEnemy      = null;
          }
          break;
        }
      }
    }
```

Note: the Y range filter (`shell.position.y < 0 || shell.position.y > 1.6`) is removed — flat shells never leave the valid height range so the filter is unnecessary noise.

- [ ] **Reload and shoot at enemies — confirm 3 hull shots kills, 2 turret shots kills.**
  - Aim cursor high on the turret mesh for turret hits
  - Aim cursor low on the hull for hull hits
  - Check browser console for any errors

- [ ] **Commit:**
```bash
git add src/scenes/ArenaScene.js
git commit -m "feat: zone detection — turret hits deal 51 damage (1.5x), hull hits 34"
```

---

## Task 6 — Critical VFX

**Files:**
- Modify: `src/scenes/ArenaScene.js`

- [ ] **Update `_spawnImpact` signature and internals to accept `isCritical` (lines 1146–1180):**

```js
// BEFORE:
  _spawnImpact(pos, isEnemy) {

// AFTER:
  _spawnImpact(pos, isEnemy, isCritical = false) {
```

Add `isCritical` to the entry pushed into `_activeVFX`:

```js
// BEFORE:
    this._activeVFX.push({
      type: 'impact', slot, core, blobs,
      t: 0, duration: isEnemy ? 0.40 : 0.30,
      ox: pos.x, oy, oz: pos.z, isEnemy,
    });

// AFTER:
    this._activeVFX.push({
      type: 'impact', slot, core, blobs,
      t: 0, duration: isCritical ? 0.55 : (isEnemy ? 0.40 : 0.30),
      ox: pos.x, oy, oz: pos.z, isEnemy, isCritical,
    });
```

Also override the core material color for criticals — add these lines immediately after `core.material.alpha = 1.0;`:

```js
    core.material.diffuseColor  = isCritical
      ? new Color3(1.0, 0.92, 0.3)
      : new Color3(1.0, 0.65, 0.0);
    core.material.emissiveColor = isCritical
      ? new Color3(1.0, 0.85, 0.2)
      : new Color3(1.0, 0.6, 0.0);
```

- [ ] **Update `_updateVFX` to use crit-scaled constants for the `'impact'` branch:**

Replace the constants block inside the `else` branch (the block starting with `const eased = ...`):

```js
// BEFORE:
        const eased        = 1 - (1 - p) * (1 - p);
        const maxCoreScale = entry.isEnemy ? 1.2 : 0.8;
        const maxRadius    = entry.isEnemy ? 1.8 : 1.2;
        const maxBlobScale = entry.isEnemy ? 0.7 : 0.45;
        const maxLift      = entry.isEnemy ? 0.6 : 0.35;

// AFTER:
        const eased        = 1 - (1 - p) * (1 - p);
        const maxCoreScale = entry.isCritical ? 1.8  : (entry.isEnemy ? 1.2  : 0.8);
        const maxRadius    = entry.isCritical ? 2.2  : (entry.isEnemy ? 1.8  : 1.2);
        const maxBlobScale = entry.isCritical ? 1.0  : (entry.isEnemy ? 0.7  : 0.45);
        const maxLift      = entry.isCritical ? 0.8  : (entry.isEnemy ? 0.6  : 0.35);
```

Also override smoke blob color for criticals — in the blob setup loop inside `_spawnImpact`, update the `diffuseColor` assignment:

```js
// BEFORE:
      mesh.material.diffuseColor = isEnemy
        ? new Color3(0.55, 0.50, 0.45)
        : new Color3(0.72, 0.62, 0.48);

// AFTER:
      mesh.material.diffuseColor = isCritical
        ? new Color3(0.70, 0.68, 0.60)
        : (isEnemy ? new Color3(0.55, 0.50, 0.45) : new Color3(0.72, 0.62, 0.48));
```

- [ ] **Reload and land a turret hit.**
  - Turret hit: large gold-white flash, light grey smoke, longer duration
  - Hull hit: orange flash, grey-brown smoke, shorter duration (unchanged from before)
  - Ground shell impact: small tan puff (unchanged)

- [ ] **Commit:**
```bash
git add src/scenes/ArenaScene.js
git commit -m "feat: critical VFX for turret hits — gold flash, larger scale, longer duration"
```

---

## Task 7 — Tune Zone Threshold

**Files:**
- Modify: `src/scenes/ArenaScene.js`

After playing through a full combat sequence, the `TURRET_ZONE_Y = 0.55` constant may need adjustment. This task is a deliberate tuning pass, not an afterthought.

- [ ] **Play several rounds and note observations:**
  - Are turret crits triggering when the cursor is on the hull (threshold too low)?
  - Are turret crits never triggering even with cursor on the turret (threshold too high)?
  - The barrel tip at standard elevation (cursor on enemy center, y ≈ 0.5) should mostly produce hull hits, while cursor-on-turret should produce crits

- [ ] **If adjustment needed, change only the constant in `_checkShellHits()`:**
```js
const TURRET_ZONE_Y = 0.55; // raise toward 0.65 if crits too easy, lower toward 0.45 if too rare
```

- [ ] **Commit only if the value changed:**
```bash
git add src/scenes/ArenaScene.js
git commit -m "tune: adjust TURRET_ZONE_Y to <value> based on playtest"
```

---

## Verification Checklist

- [ ] Shells travel in flat straight lines — no arc or drop
- [ ] Shells deactivate at ~45 units horizontal range (not by hitting ground)
- [ ] AI enemy shells also travel flat
- [ ] Barrel visually tilts to match cursor height on enemy surface
- [ ] Lock-on holds barrel at turret height
- [ ] Hull hit → 34 damage, 3 shots to kill
- [ ] Turret hit → 51 damage, 2 shots to kill
- [ ] Turret hit shows gold/white VFX, larger and longer than hull hit
- [ ] Hull hit VFX unchanged from before this feature
- [ ] Ground impact (no enemy) unchanged
- [ ] No JS errors in browser console
