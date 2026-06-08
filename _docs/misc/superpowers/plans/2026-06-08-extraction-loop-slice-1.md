# Extraction Loop — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the thinnest playable extraction loop to TanKING — collect salvage crates in the arena, extract via a timed channel to bank it, or die and lose it; banked total persists and shows in the bunker.

**Architecture:** Generic, config-driven entities (`SalvageCrate`, `ExtractionZone`) instantiated from a single `arenaLoot.js` layout object; a `runState.js` persistence module; `ArenaScene` only wires them in; `main.js` handles the extract→bunker flow; HUD/overlays inline in `index.html`.

**Tech Stack:** Babylon.js 7, Vite, plain ES modules, `localStorage` for persistence.

**Verification note:** This project has no test framework (per CLAUDE.md). Verification = `npm run build` for compile safety, throwaway node assertion scripts for pure logic, and Playwright live checks for in-game behavior. The dev server runs on `http://localhost:5173` — do not kill it.

---

## File Structure

**New files:**
- `src/world/arenaLoot.js` — tunables (constants) + arena layout config (the one place to edit/scale).
- `src/core/runState.js` — cross-run persistence (banked salvage).
- `src/world/SalvageCrate.js` — generic pickup entity.
- `src/world/ExtractionZone.js` — generic pad + timed-channel logic.

**Modified files:**
- `src/world/ArenaScene.js` — construct entities from config, run-loop pickup + channel, `onExtract` callback, `_restart` reset, HUD updates.
- `src/core/main.js` — pass `onExtract`, show EXTRACTED summary, return to bunker, show banked in bunker.
- `src/hub/HangarScene.js` — (none needed; banked readout is driven from main.js on hangar entry — see Task 7).
- `index.html` — HUD salvage counter, extraction prompt + progress bar, EXTRACTED overlay, bunker banked readout.

---

## Task 1: Layout config + tunables (`arenaLoot.js`)

**Files:**
- Create: `src/world/arenaLoot.js`

- [ ] **Step 1: Create the config module**

```js
// src/world/arenaLoot.js
// Single source of truth for Slice-1 extraction tuning + arena layout.
// Edit values/positions HERE — never inline in entities or ArenaScene.
// Shaped so a future zone is just another object of this same form.

export const CHANNEL_DURATION    = 3;    // seconds holding the pad to extract
export const CRATE_VALUE         = 25;   // salvage granted per crate
export const PICKUP_RADIUS       = 1.5;  // tank-centre distance to auto-collect
export const EXTRACT_ZONE_RADIUS = 3;    // extraction pad radius

// Arena loadout. Positions are world XZ; the tank spawns at (0,0) and is
// clamped to ±48. Crates sit away from spawn so the player must traverse.
export const ARENA_LOOT = {
  salvageCrates: [
    { x: -18, z: -18, value: CRATE_VALUE },
    { x:  18, z: -18, value: CRATE_VALUE },
    { x: -18, z:  18, value: CRATE_VALUE },
    { x:  18, z:  18, value: CRATE_VALUE },
    { x:   0, z:  16, value: CRATE_VALUE },
  ],
  extractionZone: { x: 0, z: -22, radius: EXTRACT_ZONE_RADIUS },
};
```

- [ ] **Step 2: Verify it imports and has the expected shape**

Run:
```bash
cd /Users/cliowu/claude-workspace/game
node --input-type=module -e "import('./src/world/arenaLoot.js').then(m=>{const ok=m.ARENA_LOOT.salvageCrates.length===5 && m.CHANNEL_DURATION===3 && m.ARENA_LOOT.extractionZone.radius===m.EXTRACT_ZONE_RADIUS; console.log(ok?'OK shape valid':'BAD shape'); process.exit(ok?0:1);})"
```
Expected: `OK shape valid`

- [ ] **Step 3: Commit**

```bash
git add src/world/arenaLoot.js
git commit -m "feat(extraction): add arenaLoot config (tunables + layout)"
```

---

## Task 2: Persistence (`runState.js`)

**Files:**
- Create: `src/core/runState.js`

- [ ] **Step 1: Create the persistence module**

```js
// src/core/runState.js
// Cross-run persisted state. Slice 1 = banked salvage only; future cross-run
// state (research points, owned parts) joins this module.

const KEY = 'bankedSalvage';

export function getBankedSalvage() {
  const raw = parseInt(localStorage.getItem(KEY), 10);
  return Number.isFinite(raw) ? raw : 0;
}

// Adds amount (clamped >= 0, rounded) to the banked total, persists, returns new total.
export function bankSalvage(amount) {
  const total = getBankedSalvage() + Math.max(0, Math.round(amount));
  localStorage.setItem(KEY, String(total));
  return total;
}
```

- [ ] **Step 2: Verify logic with a node assertion script (localStorage shimmed)**

Run:
```bash
cd /Users/cliowu/claude-workspace/game
cat > /tmp/runstate_test.mjs << 'EOF'
const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
const { getBankedSalvage, bankSalvage } = await import('./src/core/runState.js');
let fail = 0; const ok = (c,m)=>{ if(!c){console.log('✗',m);fail++;} };
ok(getBankedSalvage() === 0, 'empty defaults to 0');
ok(bankSalvage(25) === 25, 'bank 25 -> 25');
ok(bankSalvage(25) === 50, 'bank again -> 50');
ok(getBankedSalvage() === 50, 'persists 50');
ok(bankSalvage(-10) === 50, 'negative ignored');
ok(bankSalvage(0) === 50, 'zero ok');
console.log(fail===0 ? '✅ runState OK' : `❌ ${fail} fails`);
process.exit(fail?1:0);
EOF
node /tmp/runstate_test.mjs; rm /tmp/runstate_test.mjs
```
Expected: `✅ runState OK`

- [ ] **Step 3: Commit**

```bash
git add src/core/runState.js
git commit -m "feat(extraction): add runState banked-salvage persistence"
```

---

## Task 3: Salvage crate entity (`SalvageCrate.js`)

**Files:**
- Create: `src/world/SalvageCrate.js`

- [ ] **Step 1: Create the entity class**

```js
// src/world/SalvageCrate.js
import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';

// Generic drive-over pickup. Knows nothing about WHICH crates exist — all
// position/value comes from config (see arenaLoot.js).
export default class SalvageCrate {
  constructor(scene, { x, z, value }) {
    this.scene     = scene;
    this.value     = value;
    this.collected = false;
    this._t        = Math.random() * Math.PI * 2; // desync the bob between crates

    this.root = new TransformNode('salvage_root', scene);
    this.root.position.set(x, 0, z);

    const mat = new StandardMaterial('salvageMat', scene);
    mat.diffuseColor  = new Color3(1.0, 0.82, 0.0);  // gold — reads as loot
    mat.emissiveColor = new Color3(0.45, 0.35, 0.0); // glow so it pops top-down

    this._baseY = 0.6;
    this.mesh = MeshBuilder.CreateBox('salvageCrate', { size: 0.9 }, scene);
    this.mesh.material   = mat;
    this.mesh.parent     = this.root;
    this.mesh.position.y = this._baseY;
  }

  get position() { return this.root.position; }

  // Idle bob + spin so the crate is readable from the top-down camera.
  update(dt) {
    if (this.collected) return;
    this._t += dt;
    this.mesh.rotation.y = this._t * 1.5;
    this.mesh.position.y = this._baseY + Math.sin(this._t * 2) * 0.15;
  }

  collect() {
    this.collected = true;
    this.root.setEnabled(false);
  }

  reset() {
    this.collected = false;
    this.root.setEnabled(true);
  }

  addShadows(shadowGen) {
    shadowGen.addShadowCaster(this.mesh);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cliowu/claude-workspace/game && npm run build 2>&1 | tail -3`
Expected: `✓ built in …` with no errors. (Not yet imported anywhere — this just confirms valid syntax/imports.)

- [ ] **Step 3: Commit**

```bash
git add src/world/SalvageCrate.js
git commit -m "feat(extraction): add SalvageCrate pickup entity"
```

---

## Task 4: Extraction zone entity (`ExtractionZone.js`)

**Files:**
- Create: `src/world/ExtractionZone.js`

- [ ] **Step 1: Create the entity class**

```js
// src/world/ExtractionZone.js
import { MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { CHANNEL_DURATION } from './arenaLoot.js';

// Generic extraction pad with a timed channel. Accumulates progress while the
// tank is inside; resets the moment it leaves; fires completion exactly once.
export default class ExtractionZone {
  constructor(scene, { x, z, radius }) {
    this.scene   = scene;
    this.radius  = radius;
    this._progress = 0;     // 0..1
    this._fired    = false; // ensures onComplete fires once
    this._pulse    = 0;

    this.root = new TransformNode('extract_root', scene);
    this.root.position.set(x, 0, z);

    const mat = new StandardMaterial('extractMat', scene);
    mat.diffuseColor    = new Color3(0.0, 0.62, 0.78); // cyan — Tron UI accent
    mat.emissiveColor   = new Color3(0.0, 0.45, 0.55);
    mat.disableLighting = true;
    mat.alpha           = 0.5;
    mat.backFaceCulling = false;

    this.disc = MeshBuilder.CreateDisc('extractPad', { radius, tessellation: 48 }, scene);
    this.disc.rotation.x  = Math.PI / 2; // lay flat
    this.disc.position.y  = 0.05;
    this.disc.material    = mat;
    this.disc.parent      = this.root;
    this.disc.isPickable  = false;
  }

  get position() { return this.root.position; }
  get progress() { return this._progress; }

  contains(pos) {
    const dx = pos.x - this.root.position.x;
    const dz = pos.z - this.root.position.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }

  // Call every frame. Returns true on the single frame the channel completes.
  update(dt, inside) {
    this._pulse += dt;
    this.disc.material.alpha = 0.35 + Math.sin(this._pulse * 4) * 0.12 + this._progress * 0.45;

    if (!inside) { this._progress = 0; this._fired = false; return false; }
    if (this._fired) return false;
    this._progress = Math.min(1, this._progress + dt / CHANNEL_DURATION);
    if (this._progress >= 1) { this._fired = true; return true; }
    return false;
  }

  reset() {
    this._progress = 0;
    this._fired    = false;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cliowu/claude-workspace/game && npm run build 2>&1 | tail -3`
Expected: `✓ built in …` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/world/ExtractionZone.js
git commit -m "feat(extraction): add ExtractionZone pad + timed channel"
```

---

## Task 5: Wire entities into ArenaScene

**Files:**
- Modify: `src/world/ArenaScene.js`

- [ ] **Step 1: Add imports** (after the existing `import Shell ...` / VFX import block near the top)

```js
import SalvageCrate from './SalvageCrate.js';
import ExtractionZone from './ExtractionZone.js';
import { ARENA_LOOT, PICKUP_RADIUS } from './arenaLoot.js';
import { bankSalvage } from '../core/runState.js';
```

- [ ] **Step 2: Accept the `onExtract` callback** — change the constructor signature

Find: `constructor(engine) {`
Replace with: `constructor(engine, onExtract) {`

Then immediately after `this.scene = new Scene(engine);` add:
```js
    this._onExtract = onExtract ?? null;
```

- [ ] **Step 3: Call a new `_setupExtraction()` in the constructor** — add after `this._setupEntities();`

```js
    this._setupExtraction();
```

- [ ] **Step 4: Add the `_setupExtraction` method** (place it right after the `_setupEntities() { ... }` method)

```js
  _setupExtraction() {
    this._runSalvage = 0;
    this._extracting = false;

    this._crates = ARENA_LOOT.salvageCrates.map((c) => {
      const crate = new SalvageCrate(this.scene, c);
      crate.addShadows(this.shadowGen);
      return crate;
    });

    this._extractZone = new ExtractionZone(this.scene, ARENA_LOOT.extractionZone);
  }
```

- [ ] **Step 5: Add per-frame logic** — in `_setupGameLoop`'s `registerBeforeRender`, immediately AFTER `this._checkShellHits();` add:

```js
      this._updateExtraction(dt);
```

- [ ] **Step 6: Add the `_updateExtraction` method** (place after `_checkShellHits`)

```js
  _updateExtraction(dt) {
    for (const crate of this._crates) crate.update(dt);

    if (!this.tank.alive || this._extracting) {
      this._updateExtractionHUD(false);
      return;
    }

    // Drive-over pickups
    for (const crate of this._crates) {
      if (crate.collected) continue;
      const dx = this.tank.position.x - crate.position.x;
      const dz = this.tank.position.z - crate.position.z;
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
        crate.collect();
        this._runSalvage += crate.value;
      }
    }

    // Extraction channel
    const inside = this._extractZone.contains(this.tank.position);
    const done   = this._extractZone.update(dt, inside);
    this._updateExtractionHUD(inside);
    if (done) this._extract();
  }

  _extract() {
    this._extracting = true;
    this._paused     = true;
    window.__state   = 'EXTRACTED';
    const banked = bankSalvage(this._runSalvage);
    if (this._aimEl) this._aimEl.style.display = 'none';
    if (this._onExtract) this._onExtract(this._runSalvage, banked);
  }
```

- [ ] **Step 7: Add the HUD stub method** (real DOM wiring lands in Task 6; stub keeps Task 5 runnable)

```js
  _updateExtractionHUD(inside) {
    const sal = document.getElementById('hud-salvage');
    if (sal) sal.textContent = `SALVAGE: ${this._runSalvage}`;
    const ind = document.getElementById('extract-indicator');
    if (ind) {
      ind.style.display = inside ? 'block' : 'none';
      const bar = document.getElementById('extract-progress-fill');
      if (bar) bar.style.width = `${Math.round(this._extractZone.progress * 100)}%`;
    }
  }
```

- [ ] **Step 8: Reset on restart** — in `_restart()`, before the final line, add:

```js
    for (const crate of this._crates) crate.reset();
    this._extractZone.reset();
    this._runSalvage = 0;
    this._extracting = false;
```

- [ ] **Step 9: Verify it compiles**

Run: `cd /Users/cliowu/claude-workspace/game && npm run build 2>&1 | tail -3`
Expected: `✓ built in …` no errors.

- [ ] **Step 10: Live-verify pickups + channel via Playwright** (dev server on :5173)

Navigate to `http://localhost:5173`, press Enter, then in the page console / via Playwright evaluate:
```js
// after hangar loads:
window.__hangar.onDeploy();
// wait ~3s for arena, then:
const a = window.__arena;
a.tank.root.position.set(-18,0,-18);            // teleport onto a crate
// step a couple frames (the render loop runs automatically)
// assert a._runSalvage === 25
a.tank.root.position.set(0,0,-22);              // sit on the extraction pad
// wait > 3s, then assert window.__state === 'EXTRACTED' and localStorage.bankedSalvage increased
```
Expected: `_runSalvage` rises by 25 per crate; after ~3s on the pad, `window.__state === 'EXTRACTED'` and `localStorage.getItem('bankedSalvage')` increased by the run bag.

- [ ] **Step 11: Commit**

```bash
git add src/world/ArenaScene.js
git commit -m "feat(extraction): wire crates + extraction channel into ArenaScene"
```

---

## Task 6: HUD elements (index.html) + run-time display

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add HUD salvage counter** — inside the existing `#hud` element block in `index.html`, add a sibling element:

```html
<div id="hud-salvage" style="position:absolute; top:18px; right:22px;
  font-family:monospace; font-size:18px; letter-spacing:2px; color:#ffd23a;
  text-shadow:0 0 8px rgba(255,210,58,0.6);">SALVAGE: 0</div>
```

- [ ] **Step 2: Add the extraction indicator** (hidden by default) — place near the other overlay elements in `index.html`:

```html
<div id="extract-indicator" style="display:none; position:absolute; left:50%;
  bottom:120px; transform:translateX(-50%); text-align:center;
  font-family:monospace; color:#00e5ff;">
  <div style="font-size:16px; letter-spacing:3px; text-shadow:0 0 8px #00e5ff;">
    HOLD POSITION — EXTRACTING
  </div>
  <div style="margin-top:8px; width:240px; height:6px; background:rgba(0,8,20,0.8);
    border:1px solid #00e5ff;">
    <div id="extract-progress-fill" style="height:100%; width:0%; background:#00e5ff;
      box-shadow:0 0 10px #00e5ff;"></div>
  </div>
</div>
```

- [ ] **Step 3: Verify build + live HUD** 

Run: `npm run build 2>&1 | tail -3` → expect success.
Then via Playwright: deploy, drive onto a crate → `#hud-salvage` shows `SALVAGE: 25`; sit on pad → `#extract-indicator` becomes visible and `#extract-progress-fill` width climbs 0→100%.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(extraction): salvage counter + extraction progress HUD"
```

---

## Task 7: Extract → summary → bunker flow (main.js + overlay)

**Files:**
- Modify: `index.html` (EXTRACTED overlay + bunker banked readout)
- Modify: `src/core/main.js`

- [ ] **Step 1: Add the EXTRACTED summary overlay** to `index.html` (mirror the structure/styling of the existing `#death` overlay)

```html
<div id="extract-summary" style="display:none; position:absolute; inset:0;
  background:rgba(0,8,20,0.93); z-index:50; flex-direction:column;
  align-items:center; justify-content:center; font-family:monospace; color:#00e5ff;">
  <div style="font-size:42px; letter-spacing:8px; text-shadow:0 0 14px #00e5ff;">EXTRACTED</div>
  <div id="extract-summary-gained" style="margin-top:18px; font-size:20px; color:#ffd23a;">+0 SALVAGE</div>
  <div id="extract-summary-banked" style="margin-top:6px; font-size:16px; color:#9fdfff;">BANKED: 0</div>
  <button id="extract-return" style="margin-top:30px;">RETURN TO BUNKER</button>
</div>
```

- [ ] **Step 2: Add the bunker banked readout** to `index.html` (visible only in the hangar; main.js toggles it)

```html
<div id="hangar-salvage" style="display:none; position:absolute; top:18px; left:22px;
  font-family:monospace; font-size:16px; letter-spacing:2px; color:#ffd23a;
  text-shadow:0 0 8px rgba(255,210,58,0.6);">BANKED SALVAGE: 0</div>
```

- [ ] **Step 3: Import persistence in main.js** — add near the top imports:

```js
import { getBankedSalvage } from './runState.js';
```

- [ ] **Step 4: Define the extract handler** in main.js (place beside the other transition functions)

```js
function onExtractFromArena(gained, banked) {
  document.getElementById('hud').style.display = 'none';
  document.getElementById('hud-salvage').style.display = 'none';
  document.getElementById('extract-indicator').style.display = 'none';
  document.getElementById('extract-summary-gained').textContent = `+${gained} SALVAGE`;
  document.getElementById('extract-summary-banked').textContent = `BANKED: ${banked}`;
  document.getElementById('extract-summary').style.display = 'flex';
}
document.getElementById('extract-return').addEventListener('click', () => {
  document.getElementById('extract-summary').style.display = 'none';
  startHangar();
});
```

- [ ] **Step 5: Pass `onExtract` into BOTH ArenaScene constructions** in main.js

In `startGame`: change `arenaScene = new ArenaScene(engine);` → `arenaScene = new ArenaScene(engine, onExtractFromArena);`
In `deployToArena`: change `arenaScene = new ArenaScene(engine);` → `arenaScene = new ArenaScene(engine, onExtractFromArena);`

- [ ] **Step 6: Show banked salvage in the bunker** — in `startHangar`'s show-function, after the hangar scene is created, add:

```js
      const hs = document.getElementById('hangar-salvage');
      if (hs) { hs.textContent = `BANKED SALVAGE: ${getBankedSalvage()}`; hs.style.display = 'block'; }
```

And hide it when leaving the hangar — in `deployToArena` and `goToMenu` hide-functions add:
```js
      const hs = document.getElementById('hangar-salvage'); if (hs) hs.style.display = 'none';
```

- [ ] **Step 7: Show the salvage HUD counter on deploy** — in `deployToArena` and `startGame` show-functions, after `document.getElementById('hud').style.display = 'block';` add:

```js
      const sal = document.getElementById('hud-salvage'); if (sal) { sal.textContent = 'SALVAGE: 0'; sal.style.display = 'block'; }
```

- [ ] **Step 8: Verify build**

Run: `npm run build 2>&1 | tail -3` → expect success.

- [ ] **Step 9: Live end-to-end verification (Playwright)**

Full happy path: menu → Enter → bunker (assert `#hangar-salvage` shows current banked) → `window.__hangar.onDeploy()` → arena → teleport over 2 crates (assert `SALVAGE: 50`) → sit on pad ~3s → assert `#extract-summary` visible, gained `+50`, `localStorage.bankedSalvage` increased by 50 → click `#extract-return` → assert back in hangar (`window.__state==='HANGAR'`) with updated banked readout.

Death path: deploy → collect a crate → `window.__arena.tank.takeDamage(999)` → assert death screen, and `localStorage.bankedSalvage` UNCHANGED (run bag lost).

- [ ] **Step 10: Commit**

```bash
git add index.html src/core/main.js
git commit -m "feat(extraction): extract summary + return-to-bunker + banked readout"
```

---

## Task 8: Docs + final pass

**Files:**
- Modify: `_docs/dev/CHANGELOG.md`, `_docs/dev/SYSTEMS.md`

- [ ] **Step 1: Add a CHANGELOG entry** at the top of `_docs/dev/CHANGELOG.md` under a `## 2026-06-08` heading:

```markdown
## 2026-06-08 — Extraction loop Slice 1
- Salvage crates (drive-over), extraction pad with 3s timed channel
- Extract banks run salvage (persisted); death loses it (tank kept)
- Banked total shown in the bunker; config-driven via arenaLoot.js
```

- [ ] **Step 2: Update SYSTEMS.md roadmap** — in the "What's next" table, change the **Extraction mechanic** row's Notes to `Slice 1 done — timed channel, extract banks / die loses`, and the **Loot table** row's Notes to `Slice 1 done — salvage crates (abstract currency)`. Under "Source layout", add a line: `src/world/arenaLoot.js — extraction-loop layout + tuning config`.

- [ ] **Step 3: Full build + final smoke**

Run: `npm run build 2>&1 | tail -3` → success. One more Playwright happy-path run to confirm nothing regressed.

- [ ] **Step 4: Commit**

```bash
git add _docs/dev/CHANGELOG.md _docs/dev/SYSTEMS.md
git commit -m "docs: record extraction loop Slice 1"
```

---

## Done when
- Build passes.
- Live: deploy → collect crates (counter rises) → extract via 3s channel → summary shows gained + banked → return to bunker showing updated banked total.
- Death after collecting leaves banked total unchanged.
- All layout/tuning lives in `arenaLoot.js`; no magic numbers in entity or scene logic.
