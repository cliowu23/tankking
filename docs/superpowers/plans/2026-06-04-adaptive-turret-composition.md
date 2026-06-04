# Adaptive Turret Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any turret seat correctly on any hull — centered over the ring, resting on the deck, uniformly scaled to fit — with a self-checking alignment chain (hull → turret → barrel).

**Architecture:** Each part exposes a uniform alignment interface. Hulls declare `nativeTurret` + `ringCenter`; turrets auto-measure their `base` (bottom-slice footprint) and declare `defaultCannon`; cannons expose a `breech`. `assembleTank` walks the chain — scales the turret so its base diameter matches the hull's ring (derived from the native turret's base), centers/seats it, attaches the scaled barrel — then runs `validateComposition`, a dev-only self-check that warns on any mis-aligned link.

**Tech Stack:** Babylon.js 7.54.3, plain JavaScript, Vite. **No test framework** (per project CLAUDE.md) — verification is via the running designer: Playwright drives it headlessly, and checks are the `validateComposition` console output + screenshots.

**Spec:** `docs/superpowers/specs/2026-06-04-adaptive-turret-composition-design.md`

---

## File Structure

- `src/parts/measureBase.js` — **new.** Pure helper: measure the bottom-slice footprint of a mesh set → `{ center, diameter, y }`. One responsibility, reused by every turret.
- `src/parts/turrets/turret-m26.js`, `turret-t55.js` — call `measureBase`, return `base`; add `defaultCannon`.
- `src/parts/hulls/hull-m26.js`, `hull-t55.js` — add `nativeTurret` + `ringCenter`; fix T-55 facing.
- `src/parts/cannons/cannon-90mm.js`, `cannon-100mm.js` — return explicit `breech`.
- `src/parts/assembleTank.js` — alignment chain, native-ring cache, `validateComposition`.
- `src/scenes/TankDesignerScene.js` — default the cannon to the turret's `defaultCannon` on swap.

## Conventions for verification steps

The dev server runs at `http://localhost:5173` (start with `cd game && npm run dev` if down — do NOT kill it otherwise). "Open the designer" means: navigate to the URL, dispatch a `keydown` `t` KeyboardEvent on `document` (the canvas is behind the menu overlay), wait ~2s. Console logs are captured by the Playwright MCP. If the MCP browser wedges ("Browser already in use" / "Target page closed"), reset with: `pkill -9 -f "mcp-chrome-7c8979b"; sleep 2; rm -f ~/Library/Caches/ms-playwright/mcp-chrome-7c8979b/Singleton*`.

---

## Task 1: `measureBase` helper

**Files:**
- Create: `src/parts/measureBase.js`

- [ ] **Step 1: Write the helper**

```javascript
import { Vector3, VertexBuffer } from '@babylonjs/core';

// Measure the seating "base" of a set of meshes: the footprint of their lowest slice.
// Returns { center: Vector3 (xz at the base plane), diameter: number, y: number }.
//
// Call this while the meshes sit in their FINAL local orientation (any yaw already applied)
// at the origin, so each mesh's world matrix == that frame. The bottom slice excludes
// overhangs (bustle, mantlet, antenna) which sit higher, so center/diameter describe the
// true mounting ring — not the whole-turret bounding box (whose center the bustle skews).
export function measureBase(meshes, sliceFraction = 0.15) {
  const pts = [];
  let yMin = Infinity, yMax = -Infinity;
  for (const m of meshes) {
    const positions = m.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    const wm = m.getWorldMatrix();
    for (let i = 0; i < positions.length; i += 3) {
      const v = Vector3.TransformCoordinates(
        new Vector3(positions[i], positions[i + 1], positions[i + 2]), wm);
      pts.push(v);
      if (v.y < yMin) yMin = v.y;
      if (v.y > yMax) yMax = v.y;
    }
  }
  if (pts.length === 0) return { center: new Vector3(0, 0, 0), diameter: 1, y: 0 };

  const cut = yMin + sliceFraction * (yMax - yMin);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of pts) {
    if (v.y > cut) continue;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  const center = new Vector3((minX + maxX) / 2, yMin, (minZ + maxZ) / 2);
  const diameter = Math.max(maxX - minX, maxZ - minZ);
  return { center, diameter, y: yMin };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/parts/measureBase.js
git commit -m "feat: add measureBase helper for turret base footprint"
```

(No standalone test — Babylon needs a live scene. The helper is exercised and verified in Task 2 via the designer console.)

---

## Task 2: Turrets expose `base` + `defaultCannon`

**Files:**
- Modify: `src/parts/turrets/turret-m26.js`
- Modify: `src/parts/turrets/turret-t55.js`

- [ ] **Step 1: Update `turret-m26.js`**

Replace the file's imports and `build()`/export so it measures and returns `base`, and declares `defaultCannon`. Full file:

```javascript
import { TransformNode, SceneLoader } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';

// M26 Pershing turret shell — extracted from m26_pershing_war_thunder.glb
// (turret body, mantlet, cupola; barrel removed). Centered on its ring, materials kept.
// The GLB keeps the original `mount` empty → barrelMount.

const PAINT = {
  paintColor: [0.12, 0.42, 0.88],
  tintColor:  [0.28, 0.26, 0.24],
  paintSkipMeshes: [
    'Object_4', 'Object_6', 'Object_11', 'Object_14', 'Object_15', 'Object_16',
    'Object_8', 'Object_20', 'Object_5', 'Object_7', 'Object_19', 'Object_21',
    'Object_3', 'wheel_l5',
  ],
};

export default {
  id: 'turret-m26',
  name: 'M26 Turret',
  category: 'turret',
  stats: { traverseSpeed: 72 },
  mountEmpty: 'mount',
  defaultCannon: 'cannon-90mm',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-m26.glb', scene);
    const mountNode = result.transformNodes.find(n => n.name === this.mountEmpty);
    const mount = mountNode ? mountNode.getAbsolutePosition().clone() : null;

    const root = new TransformNode('turret_m26_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);
    for (const m of meshes) m.computeWorldMatrix(true);

    const base = measureBase(meshes);
    console.log(`[turret-m26] base center=(${base.center.x.toFixed(2)},${base.center.y.toFixed(2)},${base.center.z.toFixed(2)}) diameter=${base.diameter.toFixed(2)}`);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount, base };
  },
};
```

- [ ] **Step 2: Update `turret-t55.js`**

Keep `YAW_FIX`/`BARREL_MOUNT`/`PAINT` as they are. Update imports, and in `build()` measure the base AFTER the yaw is applied (so it's in the post-yaw frame), and return it. Replace the import line and the `build()` method:

Import line becomes:
```javascript
import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';
import { measureBase } from '../measureBase.js';
```

Add `defaultCannon: 'cannon-100mm',` to the export object (next to `stats`).

`build()` becomes:
```javascript
  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'turret-t55.glb', scene);

    const root = new TransformNode('turret_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    // Spin dome to face game-forward (mantlet → +Z) BEFORE measuring, so base is in the
    // post-yaw frame that assembleTank scales/offsets against.
    root.rotation.y = YAW_FIX;
    for (const m of meshes) m.computeWorldMatrix(true);

    const base = measureBase(meshes);
    console.log(`[turret-t55] base center=(${base.center.x.toFixed(2)},${base.center.y.toFixed(2)},${base.center.z.toFixed(2)}) diameter=${base.diameter.toFixed(2)}`);

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: BARREL_MOUNT.clone(), base };
  },
```

- [ ] **Step 3: Verify base measurements in the designer**

Open the designer (navigate to localhost:5173, dispatch `t`, wait 2s). The composed M26 loads on start. Read the console.
Expected: a `[turret-m26] base ... diameter=~1.6` line with center x≈0, z≈0 (M26 turret is centered on its ring). No errors.
Then swap to the T-55 turret (hover the turret → click "T-55 Turret", or click T-55 HULL). Expected: `[turret-t55] base ... diameter=~2.2` with a sane center. No errors.

- [ ] **Step 4: Commit**

```bash
git add src/parts/turrets/turret-m26.js src/parts/turrets/turret-t55.js
git commit -m "feat: turrets measure their base footprint and declare defaultCannon"
```

---

## Task 3: Hulls declare `nativeTurret` + `ringCenter`; fix T-55 facing

**Files:**
- Modify: `src/parts/hulls/hull-m26.js`
- Modify: `src/parts/hulls/hull-t55.js`

- [ ] **Step 1: Update `hull-m26.js`**

Add `nativeTurret` and return `ringCenter` (= the existing `mount` value, kept also as `mount` for back-compat). Replace the export object's head and the `return` in `build()`:

Add to the export object (next to `mountEmpty: 'turret',`):
```javascript
  nativeTurret: 'turret-m26',
```

Change the `build()` return line from:
```javascript
    return { root, meshes, mount };
```
to:
```javascript
    return { root, meshes, mount, ringCenter: mount };
```

- [ ] **Step 2: Update `hull-t55.js`**

The T-55 hull faces −Z (backward) while the turret now faces +Z. Flip the hull with a yaw, and declare an explicit `ringCenter` (centered in X, forward of hull-center in Z, at deck height). Full file:

```javascript
import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
import { applyModelPaint } from '../../utils/modelPaint.js';

// T-55 hull — extracted from t-55ak.glb. Rz(90) + scale 0.756 baked via PART_ROOT,
// body-midpoint centred. The extraction leaves the hull facing Babylon -Z; HULL_YAW spins
// it to +Z to match the turret and game-forward.
const HULL_YAW = Math.PI;

// Ring center on the deck: X=0 (centered), Z forward of hull-center (the T-55 ring sits
// ahead of mid-hull), Y = deck height. Dialled in live in the designer.
const RING_CENTER = new Vector3(0, 1.0, 0.35);

const PAINT = {
  paintColor: [0.92, 0.12, 0.08],
  tintColor:  [0.28, 0.26, 0.24],
};

export default {
  id: 'hull-t55',
  name: 'T-55 Hull',
  category: 'hull',
  stats: {},
  nativeTurret: 'turret-t55',

  async build(scene) {
    const result = await SceneLoader.ImportMeshAsync('', '/models/parts/', 'hull-t55.glb', scene);

    const root = new TransformNode('hull_t55_root', scene);
    const meshes = result.meshes.filter(m => m.name !== '__root__');
    for (const m of meshes) m.setParent(root);

    // Face game-forward (+Z) to match the turret.
    root.rotation.y = HULL_YAW;

    applyModelPaint(meshes, PAINT, scene);
    return { root, meshes, mount: RING_CENTER.clone(), ringCenter: RING_CENTER.clone() };
  },
};
```

- [ ] **Step 3: Verify T-55 hull faces forward**

Open the designer, select T-55 HULL. Screenshot.
Expected: the T-55 hull's glacis (front) and the turret/barrel point the SAME direction (game-forward, the same way the M26 points). No errors. (Turret seating may still look off — that's Task 4. Here we only confirm the hull no longer faces backward.)

- [ ] **Step 4: Commit**

```bash
git add src/parts/hulls/hull-m26.js src/parts/hulls/hull-t55.js
git commit -m "feat: hulls declare nativeTurret + ringCenter; fix T-55 hull facing"
```

---

## Task 4: Cannons expose `breech`

**Files:**
- Modify: `src/parts/cannons/cannon-90mm.js`
- Modify: `src/parts/cannons/cannon-100mm.js`

- [ ] **Step 1: Update both cannons**

The cannon builds with its tube along +Z and its rear at the root origin, so the breech IS the origin. Make it explicit. In each cannon's `build()`, change the return from:
```javascript
    return { root, meshes };
```
to:
```javascript
    return { root, meshes, breech: new Vector3(0, 0, 0) };
```
And ensure `Vector3` is imported in each file. `cannon-90mm.js` / `cannon-100mm.js` import line becomes:
```javascript
import { TransformNode, SceneLoader, Vector3 } from '@babylonjs/core';
```

- [ ] **Step 2: Commit**

```bash
git add src/parts/cannons/cannon-90mm.js src/parts/cannons/cannon-100mm.js
git commit -m "feat: cannons expose explicit breech attach point"
```

---

## Task 5: assembleTank — alignment chain + native-ring cache

**Files:**
- Modify: `src/parts/assembleTank.js`

- [ ] **Step 1: Rewrite `assembleTank.js`**

Full file:

```javascript
import { TransformNode, Vector3 } from '@babylonjs/core';
import { PARTS_BY_ID } from './index.js';
import { measureBase } from './measureBase.js';

// Native ring diameter cache: a hull's ring is as big as its native turret's base.
// Keyed by turret id; value is the measured base diameter.
const _ringCache = new Map();

async function nativeRingDiameter(scene, hullPart, equippedTurretId, equippedBase) {
  const nativeId = hullPart.nativeTurret;
  if (!nativeId) return equippedBase.diameter;          // no native declared → no scaling
  if (nativeId === equippedTurretId) return equippedBase.diameter; // equipped IS native
  if (_ringCache.has(nativeId)) return _ringCache.get(nativeId);

  // Build the native turret once just to measure its base, then dispose it.
  const nativePart = PARTS_BY_ID[nativeId];
  const built = await nativePart.build(scene);
  const d = built.base.diameter;
  _ringCache.set(nativeId, d);
  built.root.dispose();
  for (const m of built.meshes) if (!m.isDisposed()) m.dispose(false, true);
  return d;
}

// Dev-only self-check: assert each alignment link and warn (naming the link + loadout)
// on any violation. Re-measures the PLACED turret so center/seat/fit are verified from the
// real assembled geometry (independent of the offset math), not just asserted by construction.
function validateComposition(ctx) {
  const { loadout, turretPivot, barrelPivot, ringDiameter, turretBuilt, cannonBuilt } = ctx;
  const TOL = 0.08;
  const tag = `${loadout.hull}+${loadout.turret}+${loadout.cannon}`;
  const warn = (link, msg) => console.warn(`[validateComposition] ${tag} — ${link}: ${msg}`);

  // Re-measure the placed turret base in world space (independent of how we positioned it).
  for (const m of turretBuilt.meshes) m.computeWorldMatrix(true);
  const placed = measureBase(turretBuilt.meshes);
  turretPivot.computeWorldMatrix(true);
  const ringW = turretPivot.getAbsolutePosition();

  // Link 1: centered — placed base center over the ring (X/Z).
  if (Math.abs(placed.center.x - ringW.x) > TOL || Math.abs(placed.center.z - ringW.z) > TOL) {
    warn('centered', `base xz (${placed.center.x.toFixed(2)},${placed.center.z.toFixed(2)}) != ring (${ringW.x.toFixed(2)},${ringW.z.toFixed(2)})`);
  }
  // Link 1: seated — placed base plane at the deck (Y).
  if (Math.abs(placed.y - ringW.y) > TOL) {
    warn('seated', `base y ${placed.y.toFixed(2)} != deck ${ringW.y.toFixed(2)}`);
  }
  // Link 1: fits — placed base diameter matches the ring.
  if (Math.abs(placed.diameter - ringDiameter) > TOL) {
    warn('fits', `placed base diameter ${placed.diameter.toFixed(2)} != ring ${ringDiameter.toFixed(2)}`);
  }
  // Link 1: orientation — gun mount on the +Z (front) side of the base center.
  const mZ = turretBuilt.mount ? turretBuilt.mount.z - turretBuilt.base.center.z : null;
  if (!(mZ > 0)) warn('orientation', `mount not forward of base center (Δz=${mZ?.toFixed(2)})`);

  // Link 2: barrel aimed forward — cannon's furthest world Z is ahead of the barrel pivot.
  barrelPivot.computeWorldMatrix(true);
  const pivotZ = barrelPivot.getAbsolutePosition().z;
  let tipZ = -Infinity;
  for (const m of cannonBuilt.meshes) {
    m.computeWorldMatrix(true);
    const z = m.getBoundingInfo().boundingBox.maximumWorld.z;
    if (z > tipZ) tipZ = z;
  }
  if (!(tipZ > pivotZ)) warn('barrel-aim', `tip z=${tipZ.toFixed(2)} not forward of pivot z=${pivotZ.toFixed(2)}`);
}

// Composes a {hull, turret, cannon} loadout into one tank via the alignment chain
// hull → turret → barrel. Returns the same handles the game expects.
export async function assembleTank(scene, loadout, materials = {}) {
  const root = new TransformNode('tankRoot', scene);

  const hullPart   = PARTS_BY_ID[loadout.hull];
  const turretPart = PARTS_BY_ID[loadout.turret];
  const cannonPart = PARTS_BY_ID[loadout.cannon];

  // 1. Hull at origin (self-paints). ringCenter = where the turret seats.
  const hullBuilt = await hullPart.build(scene);
  hullBuilt.root.parent = root;
  const ring = hullBuilt.ringCenter ?? hullBuilt.mount ?? new Vector3(0, 1, 0);

  // 2. Turret pivot at the ring center.
  const turretPivot = new TransformNode('turretPivot', scene);
  turretPivot.position.copyFrom(ring);
  turretPivot.parent = root;

  const turretBuilt = await turretPart.build(scene);

  // 3. Scale turret so its base diameter matches the ring; center base on the pivot and
  //    seat its base plane at the deck. base.center is in the turret's post-yaw frame; with
  //    uniform scale s, a frame point Q maps to pivot-space P + s·Q, and P = -s·base.center
  //    puts base.center at the pivot origin and base.y at the deck.
  const ringDiameter = await nativeRingDiameter(scene, hullPart, loadout.turret, turretBuilt.base);
  let scale = ringDiameter / turretBuilt.base.diameter;
  if (!(scale > 0.3 && scale < 3.0)) {
    console.warn(`[assembleTank] scale ${scale.toFixed(3)} out of range for ${loadout.turret} on ${loadout.hull}; using 1`);
    scale = 1;
  }
  turretBuilt.root.parent   = turretPivot;
  turretBuilt.root.scaling  = new Vector3(scale, scale, scale);
  turretBuilt.root.position = turretBuilt.base.center.scale(-scale);

  // 4. Barrel pivot at the scaled, recentered mount. barrelPivot is a sibling of the turret
  //    root, so apply the same -base.center recentering: mount lands at s·(mount - base.center).
  const mount = turretBuilt.mount ?? new Vector3(0, 0, 0.5);
  const barrelPivot = new TransformNode('barrelPivot', scene);
  barrelPivot.position = mount.subtract(turretBuilt.base.center).scale(scale);
  barrelPivot.parent = turretPivot;

  const cannonBuilt = await cannonPart.build(scene, materials.cannon);
  cannonBuilt.root.parent = barrelPivot;

  // 5. Ground the tank — shift root so the lowest mesh point sits at y=0.
  let minY = Infinity;
  const allMeshes = [...hullBuilt.meshes, ...turretBuilt.meshes, ...cannonBuilt.meshes];
  for (const m of allMeshes) {
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    if (bb.minimumWorld.y < minY) minY = bb.minimumWorld.y;
  }
  if (isFinite(minY)) root.position.y = -minY;

  if (import.meta.env?.DEV) {
    validateComposition({ loadout, turretPivot, barrelPivot, ringDiameter, scale, turretBuilt, cannonBuilt });
  }

  return {
    root, turretPivot, barrelPivot,
    parts: { hullBuilt, turretBuilt, cannonBuilt },
  };
}
```

- [ ] **Step 2: Verify all four combos seat correctly + self-check is clean**

Open the designer. For each of the four combos — M26+M26, T-55+T-55, M26 hull + T-55 turret, T-55 hull + M26 turret — select it (hull button + turret dropdown) and screenshot. Read the console after each.
Expected for each:
- No `[validateComposition]` warnings and no `[assembleTank] scale ... out of range`.
- Turret centered over the hull, seated on the deck (no gap/sink), sized to fill the ring, barrel pointing game-forward.

- [ ] **Step 3: Leak stress re-check**

In the designer, alternate the hull selection (M26 HULL ↔ T-55 HULL) ~20 times with ~600ms between. Expected: no errors, page stays alive (assembleTank now builds an extra native turret for the cache on first cross-mix, so confirm no new leak — the native build is disposed).

- [ ] **Step 4: Commit**

```bash
git add src/parts/assembleTank.js
git commit -m "feat: assembleTank alignment chain (center/seat/scale + barrel) + validateComposition"
```

---

## Task 6: Designer defaults the cannon to the turret's `defaultCannon` on swap

**Files:**
- Modify: `src/scenes/TankDesignerScene.js`

- [ ] **Step 1: Default the cannon when a turret is picked**

In `_setupTurretDropdown()`, the turret item click handler currently is:
```javascript
      item.addEventListener('click', () => {
        this._equippedTurret = part.id;
        this._rebuildComposed();
        this._hideTurretDropdown();
      });
```
Replace it with one that also adopts the turret's default cannon:
```javascript
      item.addEventListener('click', () => {
        this._equippedTurret = part.id;
        if (part.defaultCannon) this._equippedCannon = part.defaultCannon;
        this._rebuildComposed();
        this._hideTurretDropdown();
      });
```

- [ ] **Step 2: Default the cannon when a hull is picked (adopt its native turret's gun)**

So that selecting T-55 HULL shows the T-55's 100mm rather than a leftover 90mm, update the hull button handler in `_populateSidebar()`. It currently is:
```javascript
          hb.addEventListener('click', () => {
            if (this._activeHullBtn) this._activeHullBtn.classList.remove('active');
            hb.classList.add('active');
            this._activeHullBtn = hb;
            this._equippedHull  = hull.id;
            this._rebuildComposed();
          });
```
Replace with:
```javascript
          hb.addEventListener('click', () => {
            if (this._activeHullBtn) this._activeHullBtn.classList.remove('active');
            hb.classList.add('active');
            this._activeHullBtn = hb;
            this._equippedHull  = hull.id;
            // Adopt the equipped turret's natural gun so the cannon matches the turret.
            const turret = PARTS_BY_ID[this._equippedTurret];
            if (turret?.defaultCannon) this._equippedCannon = turret.defaultCannon;
            this._rebuildComposed();
          });
```
Ensure `PARTS_BY_ID` is imported at the top of `TankDesignerScene.js` (it already imports `{ PARTS, PARTS_BY_ID }` — confirm; if only `PARTS`, add `PARTS_BY_ID`).

- [ ] **Step 3: Verify cannon defaults**

Open the designer. Select T-55 HULL (with T-55 turret). Expected: the gun shown is the 100mm D-10T (no blue 90mm sticking out); console shows `cannon-100mm` building. Hover the turret → switch to M26 Turret. Expected: gun becomes the 90mm. Switch back to T-55 Turret → gun becomes 100mm. No errors, no `validateComposition` warnings.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/TankDesignerScene.js
git commit -m "feat: designer defaults cannon to the turret's own gun on swap"
```

---

## Task 7: Final verification + dial-in

**Files:**
- Possibly tune: `src/parts/hulls/hull-t55.js` (`RING_CENTER`), `src/parts/turrets/turret-t55.js` (`BARREL_MOUNT`)

- [ ] **Step 1: Capture all four combos at 1400×900**

Resize the Playwright viewport to 1400×900. For each combo, select it and screenshot. Confirm by eye against the spec's visual checklist: centered (no front/back/left/right drift), seated (no float/sink), sized to fill the ring, barrel from the mantlet pointing forward, hull and turret facing the same way.

- [ ] **Step 2: Dial if needed**

If the T-55 turret reads slightly forward/back of the ring, adjust `RING_CENTER.z` in `hull-t55.js` (more negative = further back). If the barrel doesn't seat in the mantlet, adjust `BARREL_MOUNT` in `turret-t55.js`. Re-screenshot after each change. These are the only hand-tuned numbers; everything else is derived.

- [ ] **Step 3: Confirm self-check clean across all four**

Read the console for all four combos. Expected: zero `[validateComposition]` warnings, zero scale-range warnings.

- [ ] **Step 4: Commit any dial-in**

```bash
git add src/parts/hulls/hull-t55.js src/parts/turrets/turret-t55.js
git commit -m "fix: dial in T-55 ring center / barrel mount for composed fit"
```

- [ ] **Step 5: Update project memory**

Append to `project_tank_game_notes.md` (memory): adaptive turret composition shipped — alignment chain hull→turret→base→barrel, native-ring auto-scaling, `validateComposition` self-check, T-55 hull facing fixed. Note the only hand-tuned numbers are T-55 `RING_CENTER` and `BARREL_MOUNT`.

---

## Verification gate (whole plan)

Not done until BOTH:
1. `validateComposition` produces zero warnings for all four combos, AND
2. The four screenshots are confirmed by eye (centered, seated, fitted, forward-facing).
Plus the leak stress check passes (≥20 hull switches, zero errors).
