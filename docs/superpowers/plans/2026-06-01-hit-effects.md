# Hit Effects — Normal vs Critical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the normal hit orange fireball with a white flash + arc sparks + smoke, keep the crit orange fireball unchanged, and split screen shake by hit type.

**Architecture:** All changes are in `ArenaScene.js`. New mesh pools are added to the constructor alongside the existing pools. `_spawnTankImpact` branches on `isCritical`: normal hits call a new `_spawnNormalImpact` helper; crit hits run the existing code untouched. `_updateVFX` gains a `normalImpact` branch.

**Tech Stack:** Babylon.js 7.54.3, plain JavaScript, Vite dev server at `localhost:5173`

---

## File Map

| File | Change |
|------|--------|
| `src/scenes/ArenaScene.js` | Add constants, add mesh pools, add `_spawnNormalImpact`, modify `_spawnTankImpact`, extend `_updateVFX`, split shake call |

---

### Task 1: Add spark constants before the class

**Files:**
- Modify: `src/scenes/ArenaScene.js` — add 3 constants after the import block (after line 15, before `export default class ArenaScene`)

- [ ] **Step 1: Open ArenaScene.js and find the line just before `export default class ArenaScene`**

It will look like:
```js
import { GridMaterial } from '@babylonjs/materials';

export default class ArenaScene {
```

- [ ] **Step 2: Insert the three constants between the import and the class declaration**

```js
import { GridMaterial } from '@babylonjs/materials';

const NORMAL_SPARK_VELS = [
  { vx:  0.0, vy: 7.0, vz:  0.0 },
  { vx:  3.5, vy: 6.2, vz:  0.0 },
  { vx: -3.5, vy: 6.2, vz:  0.0 },
  { vx:  0.0, vy: 6.2, vz:  3.5 },
  { vx:  0.0, vy: 6.2, vz: -3.5 },
  { vx:  2.5, vy: 5.8, vz:  2.5 },
  { vx: -2.5, vy: 5.8, vz: -2.5 },
];
const NORMAL_SPARK_GRAVITY = 14;  // units/s² downward (Babylon Y-up)
const NORMAL_SPARK_TRAIL   = 0.07; // seconds of trail behind spark head

export default class ArenaScene {
```

- [ ] **Step 3: Verify the file still parses — run the dev server**

```bash
cd /Users/cliowu/claude-workspace/game && npm run dev
```
Expected: Vite starts, no syntax errors in console.

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: add normal spark physics constants"
```

---

### Task 2: Add normal impact mesh pools to constructor

**Files:**
- Modify: `src/scenes/ArenaScene.js` — insert after the `_tankSmokes` pool block (after the closing brace around line 1090), still inside the constructor

- [ ] **Step 1: Find the end of the `_tankSmokes` pool in the constructor**

It ends with:
```js
      this._tankSmokes.push(mesh);
    }
```
followed by the blast ring disc setup.

- [ ] **Step 2: Insert the normal impact pools immediately after `_tankSmokes` closes, before the disc setup**

```js
    // --- Normal impact pools (4 slots: 1 flash + 7 sparks + 2 smokes each) ---
    this._normalFlashes = [];
    for (let i = 0; i < 4; i++) {
      const mat = new StandardMaterial(`normalFlashMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(1.0, 1.0, 1.0);
      mat.emissiveColor   = new Color3(0.9, 0.95, 1.0);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalFlash_${i}`, { diameter: 1.0, segments: 5 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalFlashes.push(mesh);
    }

    // 4 slots × 7 sparks = 28 updatable line meshes
    this._normalSparks = [];
    for (let i = 0; i < 28; i++) {
      const line = MeshBuilder.CreateLines(`normalSpark_${i}`, {
        points: [Vector3.Zero(), new Vector3(0, 0.01, 0)],
        colors: [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)],
        updatable: true,
      }, this.scene);
      line.isVisible  = false;
      line.isPickable = false;
      line._vfxActive = false;
      this._normalSparks.push(line);
    }

    // Pre-allocated Vector3/Color4 arrays for spark line updates (avoids GC)
    this._sparkPts = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [Vector3.Zero(), Vector3.Zero()])
    );
    this._sparkCols = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => [new Color4(1, 1, 1, 0), new Color4(1, 0.9, 0.3, 0)])
    );

    this._normalSmokes = [];
    for (let i = 0; i < 8; i++) {
      const mat = new StandardMaterial(`normalSmokeMat_${i}`, this.scene);
      mat.diffuseColor    = new Color3(0.82, 0.82, 0.85);
      mat.disableLighting = true;
      const mesh = MeshBuilder.CreateSphere(`normalSmoke_${i}`, { diameter: 1.0, segments: 4 }, this.scene);
      mesh.material   = mat;
      mesh.isVisible  = false;
      mesh.isPickable = false;
      mesh._vfxActive = false;
      this._normalSmokes.push(mesh);
    }
```

- [ ] **Step 3: Verify dev server still starts with no errors**

```bash
# Vite should still be running from Task 1 — just check the browser console at localhost:5173 for errors
```
Expected: no errors in browser console, game loads normally.

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: add normal impact mesh pools (flash, sparks, smokes)"
```

---

### Task 3: Add `_spawnNormalImpact(pos)` method

**Files:**
- Modify: `src/scenes/ArenaScene.js` — add new method just before `_spawnTankImpact`

- [ ] **Step 1: Find `_spawnTankImpact` in the file (around line 1162)**

It starts with:
```js
  _spawnTankImpact(pos, isCritical = false) {
```

- [ ] **Step 2: Insert `_spawnNormalImpact` immediately before `_spawnTankImpact`**

```js
  _spawnNormalImpact(pos) {
    let slot = -1;
    for (let i = 0; i < 4; i++) {
      if (!this._normalFlashes[i]._vfxActive) { slot = i; break; }
    }
    if (slot === -1) return;

    const oy    = Math.max(0.3, pos.y);
    const flash = this._normalFlashes[slot];
    flash._vfxActive = true;
    flash.isVisible  = true;
    flash.position.set(pos.x, oy, pos.z);
    flash.scaling.setAll(0.5);
    flash.material.alpha = 1.0;

    const sparks = [];
    for (let s = 0; s < 7; s++) {
      const mesh = this._normalSparks[slot * 7 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      sparks.push(mesh);
    }

    const smokes = [];
    for (let s = 0; s < 2; s++) {
      const mesh = this._normalSmokes[slot * 2 + s];
      mesh._vfxActive = true;
      mesh.isVisible  = true;
      mesh.position.set(pos.x + (s === 0 ? 0.12 : -0.12), oy, pos.z + (s === 0 ? 0.08 : -0.08));
      mesh.scaling.setAll(0.3);
      mesh.material.alpha = 0.0;
      smokes.push(mesh);
    }

    this._activeVFX.push({
      type: 'normalImpact', slot, flash, sparks, smokes,
      t: 0, duration: 0.75, ox: pos.x, oy, oz: pos.z,
    });
  }

  _spawnTankImpact(pos, isCritical = false) {
```

- [ ] **Step 3: Verify no syntax errors**

Check the Vite console — should still be clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: add _spawnNormalImpact method"
```

---

### Task 4: Branch `_spawnTankImpact` on `isCritical`

**Files:**
- Modify: `src/scenes/ArenaScene.js` — add 3 lines at the top of `_spawnTankImpact`

- [ ] **Step 1: Find the body of `_spawnTankImpact` — it starts with**

```js
  _spawnTankImpact(pos, isCritical = false) {
    let slot = -1;
    for (let i = 0; i < 4; i++) {
```

- [ ] **Step 2: Add the early-return branch at the very top of the method body**

```js
  _spawnTankImpact(pos, isCritical = false) {
    if (!isCritical) {
      this._spawnNormalImpact(pos);
      return;
    }

    let slot = -1;
    for (let i = 0; i < 4; i++) {
```

- [ ] **Step 3: Verify dev server is still clean**

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: branch _spawnTankImpact — normal hits use new white flash"
```

---

### Task 5: Handle `normalImpact` cleanup in `_updateVFX`

**Files:**
- Modify: `src/scenes/ArenaScene.js` — update the expire block in `_updateVFX` (around line 1211)

- [ ] **Step 1: Find the expire block in `_updateVFX`**

It currently looks like:
```js
      if (entry.t >= entry.duration) {
        if (entry.type === 'tankImpact') {
          entry.core.isVisible  = false; entry.core._vfxActive = false;
          for (const b of entry.fireBlobs)  { b.isVisible = false; b._vfxActive = false; }
          for (const b of entry.smokeBlobs) { b.isVisible = false; b._vfxActive = false; }
        } else {
          entry.mesh.isVisible  = false;
          entry.mesh._vfxActive = false;
        }
        this._activeVFX.splice(i, 1);
        continue;
      }
```

- [ ] **Step 2: Add a `normalImpact` case before the `else` branch**

```js
      if (entry.t >= entry.duration) {
        if (entry.type === 'tankImpact') {
          entry.core.isVisible  = false; entry.core._vfxActive = false;
          for (const b of entry.fireBlobs)  { b.isVisible = false; b._vfxActive = false; }
          for (const b of entry.smokeBlobs) { b.isVisible = false; b._vfxActive = false; }
        } else if (entry.type === 'normalImpact') {
          entry.flash.isVisible  = false; entry.flash._vfxActive = false;
          for (const s of entry.sparks) { s.isVisible = false; s._vfxActive = false; }
          for (const s of entry.smokes) { s.isVisible = false; s._vfxActive = false; }
        } else {
          entry.mesh.isVisible  = false;
          entry.mesh._vfxActive = false;
        }
        this._activeVFX.splice(i, 1);
        continue;
      }
```

- [ ] **Step 3: Verify dev server is still clean**

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: add normalImpact cleanup in _updateVFX"
```

---

### Task 6: Add `normalImpact` animation to `_updateVFX`

**Files:**
- Modify: `src/scenes/ArenaScene.js` — add animation branch after the `tankImpact` branch in `_updateVFX` (around line 1299)

- [ ] **Step 1: Find the end of the `tankImpact` animation block**

It ends with:
```js
        }  // end smoke loop
      }    // end tankImpact branch
    }      // end for loop
  }        // end _updateVFX
```

- [ ] **Step 2: Insert the `normalImpact` animation block between the `tankImpact` closing brace and the for-loop closing brace**

```js
      } else if (entry.type === 'normalImpact') {
        const p     = entry.t / entry.duration;
        const eased = 1 - (1 - p) * (1 - p);

        // Flash: scale up fast, fade out fully by p=0.5
        const ff = Math.max(0, 1 - p / 0.5);
        entry.flash.scaling.setAll(0.5 + eased * 1.5);  // 0.5 → 2.0
        entry.flash.material.alpha = ff;
        if (ff <= 0) entry.flash.isVisible = false;

        // Sparks: arc physics + trail line update
        const st = entry.t;
        for (let s = 0; s < 7; s++) {
          const vel  = NORMAL_SPARK_VELS[s];
          const mesh = entry.sparks[s];
          const pts  = this._sparkPts[entry.slot][s];
          const cols = this._sparkCols[entry.slot][s];

          const tt = Math.max(0, st - NORMAL_SPARK_TRAIL);

          // Head position at current time
          pts[1].set(
            entry.ox + vel.vx * st,
            entry.oy + vel.vy * st - 0.5 * NORMAL_SPARK_GRAVITY * st * st,
            entry.oz + vel.vz * st,
          );
          // Tail position at (t - trail)
          pts[0].set(
            entry.ox + vel.vx * tt,
            entry.oy + vel.vy * tt - 0.5 * NORMAL_SPARK_GRAVITY * tt * tt,
            entry.oz + vel.vz * tt,
          );

          const sparkFade = Math.max(0, 1 - p / 0.75);
          cols[0].set(1, 1, 1, sparkFade * 0.4);          // tail: white, dim
          cols[1].set(1, 0.9, 0.3, sparkFade);             // head: yellow, bright

          if (sparkFade > 0 && pts[1].y > -1) {
            mesh.isVisible = true;
            MeshBuilder.CreateLines(`normalSpark_${entry.slot * 7 + s}`, {
              points: pts,
              colors: cols,
              instance: mesh,
            });
          } else {
            mesh.isVisible = false;
          }
        }

        // Smoke: same pattern as tankImpact smokes
        const smokeDelay = 0.18;
        for (let s = 0; s < 2; s++) {
          if (entry.t < smokeDelay) {
            entry.smokes[s].material.alpha = 0;
          } else {
            const sp     = (entry.t - smokeDelay) / (entry.duration - smokeDelay);
            const seased = 1 - (1 - sp) * (1 - sp);
            entry.smokes[s].position.y = entry.oy + seased * 1.2;
            entry.smokes[s].scaling.setAll(0.3 + seased * 0.9);
            entry.smokes[s].material.alpha = sp < 0.4
              ? sp * 1.2
              : 0.48 * (1 - (sp - 0.4) / 0.6);
          }
        }
```

- [ ] **Step 3: Verify the dev server — open the browser at localhost:5173, start a game, fire at an enemy**

Expected: normal hits show a white flash + arcing sparks + smoke. No orange fireball on normal hits. The console should be error-free.

- [ ] **Step 4: Fire a critical hit (aim at enemy center-mass, perpDist < 0.4) and verify orange fireball still shows**

The crit path in `_spawnTankImpact` is untouched — it should still show the orange explosion.

- [ ] **Step 5: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: animate normalImpact — white flash, arc sparks, smoke"
```

---

### Task 7: Split screen shake by hit type

**Files:**
- Modify: `src/scenes/ArenaScene.js` — line ~1336, inside `_checkShellHits`

- [ ] **Step 1: Find the shake call in `_checkShellHits`**

It currently looks like:
```js
          this._spawnTankImpact(shell.position.clone(), isCritical);
          shell.deactivate();
          enemy.takeDamage(damage);
          this._triggerShake(0.12, 0.4);
```

- [ ] **Step 2: Replace the single shake call with a conditional**

```js
          this._spawnTankImpact(shell.position.clone(), isCritical);
          shell.deactivate();
          enemy.takeDamage(damage);
          this._triggerShake(isCritical ? 0.12 : 0.06, isCritical ? 0.4 : 0.15);
```

- [ ] **Step 3: Verify in the browser**

Fire several normal hits — screen should barely shake.  
Get a critical hit — screen should shake noticeably more.

- [ ] **Step 4: Commit**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "feat: split screen shake — normals 0.06/0.15, crits 0.12/0.4"
```

---

### Task 8: Visual verification pass

- [ ] **Step 1: Load the game at localhost:5173, play through several hits**

Check:
- Normal hit: white flash appears, arc sparks fly up and fall back down, smoke puff rises, very faint screen shake
- Crit hit: orange fireball (existing), noticeable screen shake
- Muzzle flash on firing: unchanged
- Player getting hit by AI: unchanged (shake at 0.18/0.55 — that line is untouched)

- [ ] **Step 2: Stress-test the pools — fire rapidly to trigger all 4 slots**

Fire 4+ shots in quick succession. No crashes, no missing sparks, no leftover visible meshes after effects expire.

- [ ] **Step 3: If any visual needs tuning, adjust constants at the top of the file**

Spark height: increase `vy` values in `NORMAL_SPARK_VELS`  
Spark spread: increase `vx`/`vz` values  
Flash size: change `0.5 + eased * 1.5` scaling  
Flash duration: change `p / 0.5` fade rate  
Shake feel: adjust the `0.06`/`0.15` values on line ~1336

- [ ] **Step 4: Final commit if any tuning was done**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/ArenaScene.js
git commit -m "chore: tune normal hit vfx values"
```
