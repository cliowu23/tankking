# Hangar Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder geometry in the hangar with a proper Soviet command bunker — concrete slab floor, cast-concrete walls with form lines and tie holes, fog-fade tunnel depth illusion, and four compound 3D station props.

**Architecture:** All visual changes live in `HangarScene.js` (room, tunnel, lighting) and a new `src/scenes/HangarProps.js` (station prop builders). No gameplay logic is touched. Each task is independently testable by running the dev server and checking the hangar visually.

**Tech Stack:** Babylon.js 7.54.3, plain JavaScript, Vite. No test framework — verify each task by running `npm run dev` at http://localhost:5173 and pressing Enter to enter the hangar.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/scenes/HangarScene.js` | Modify | Floor material, wall details, tunnel fog, lighting, wire station props |
| `src/scenes/HangarProps.js` | Create | Four station prop builder functions |

---

## Task 1: Floor — concrete slab material

**Files:**
- Modify: `src/scenes/HangarScene.js` — update `floorMat` in `_buildRoom()`

- [ ] **Step 1: Update floor GridMaterial settings**

In `_buildRoom()`, find the `floorMat` block and replace it entirely:

```javascript
const floorMat = new GridMaterial('floor', s);
floorMat.gridRatio           = 2.5;   // 2.5-unit slabs
floorMat.majorUnitFrequency  = 1;     // bold line every slab
floorMat.minorUnitVisibility = 0;     // no minor lines — clean grout only
floorMat.mainColor           = new Color3(0.24, 0.22, 0.20);
floorMat.lineColor           = new Color3(0.18, 0.16, 0.14);
floorMat.opacity             = 1.0;
floorMat.backFaceCulling     = false;
```

- [ ] **Step 2: Verify**

Run `npm run dev`, open http://localhost:5173, press Enter. The floor should show large subtle slab joints — barely visible warm-grey grout lines, not the bright arena grid. No white lines.

---

## Task 2: Walls — concrete colour + form lines + tie holes + rust

**Files:**
- Modify: `src/scenes/HangarScene.js` — update `concrete` material, add `_buildWallDetails()` method

- [ ] **Step 1: Update concrete material colour**

In `_buildRoom()`, find the `concrete` material block and update:

```javascript
const concrete = new StandardMaterial('concrete', s);
concrete.diffuseColor  = new Color3(0.38, 0.36, 0.33);
concrete.specularColor = new Color3(0.03, 0.03, 0.03);
```

- [ ] **Step 2: Add `_buildWallDetails()` method to HangarScene**

Add this method after `_buildRoom()`:

```javascript
_buildWallDetails() {
  const s = this.scene;

  const formMat = new StandardMaterial('form-line', s);
  formMat.diffuseColor  = new Color3(0.20, 0.19, 0.17);
  formMat.specularColor = new Color3(0.01, 0.01, 0.01);

  const holeMat = new StandardMaterial('tie-hole', s);
  holeMat.diffuseColor  = new Color3(0.12, 0.11, 0.10);
  holeMat.specularColor = new Color3(0.0,  0.0,  0.0);

  const rustMat = new StandardMaterial('rust', s);
  rustMat.diffuseColor  = new Color3(0.30, 0.14, 0.04);
  rustMat.specularColor = new Color3(0.0,  0.0,  0.0);

  // Form lines and tie holes on each wall surface
  // South wall faces south (z=-ROOM_D/2), inner face at z=-ROOM_D/2+WALL_T/2
  this._addFormLines(s,
    { pos: new Vector3(0, 0, -ROOM_D / 2 + WALL_T / 2 + 0.03), axis: 'x', span: ROOM_W },
    formMat, holeMat, rustMat
  );
  // West wall inner face at x=-ROOM_W/2+WALL_T/2
  this._addFormLines(s,
    { pos: new Vector3(-ROOM_W / 2 + WALL_T / 2 + 0.03, 0, 0), axis: 'z', span: ROOM_D },
    formMat, holeMat, rustMat
  );
  // East wall inner face at x=ROOM_W/2-WALL_T/2
  this._addFormLines(s,
    { pos: new Vector3(ROOM_W / 2 - WALL_T / 2 - 0.03, 0, 0), axis: 'z', span: ROOM_D },
    formMat, holeMat, rustMat
  );
  // North left wall inner face (faces south, at z=ROOM_D/2-WALL_T/2)
  const sideW = (ROOM_W - TUNNEL_W) / 2;
  this._addFormLines(s,
    { pos: new Vector3(-(TUNNEL_W / 2 + sideW / 2), 0, ROOM_D / 2 - WALL_T / 2 - 0.03), axis: 'x', span: sideW },
    formMat, holeMat, rustMat
  );
  // North right wall
  this._addFormLines(s,
    { pos: new Vector3(TUNNEL_W / 2 + sideW / 2, 0, ROOM_D / 2 - WALL_T / 2 - 0.03), axis: 'x', span: sideW },
    formMat, holeMat, rustMat
  );
}

// Adds two horizontal form lines (at y=1.5 and y=3.0) with tie holes along a wall segment.
// wall.axis = 'x' | 'z' — which axis the wall runs along
// wall.span = total length of wall in that axis
// wall.pos  = centre position of inner wall face (y is ignored, overridden per line)
_addFormLines(s, wall, formMat, holeMat, rustMat) {
  const LINE_YS    = [1.5, 3.0];
  const HOLE_EVERY = 2.5;   // spacing between tie holes
  const holeCount  = Math.floor(wall.span / HOLE_EVERY);
  const rustChance = 0.35;  // 35% of holes get a rust streak

  for (const lineY of LINE_YS) {
    // Form line strip
    const lineSize = wall.axis === 'x'
      ? { width: wall.span, height: 0.04, depth: 0.05 }
      : { width: 0.05,      height: 0.04, depth: wall.span };
    const line = MeshBuilder.CreateBox(`form-${lineY}-${wall.pos.x.toFixed(0)}-${wall.pos.z.toFixed(0)}`, lineSize, s);
    line.position        = new Vector3(wall.pos.x, lineY, wall.pos.z);
    line.material        = formMat;
    line.isPickable      = false;
    line.checkCollisions = false;

    // Tie holes along this line
    for (let i = 0; i < holeCount; i++) {
      const offset = -wall.span / 2 + HOLE_EVERY * 0.5 + i * HOLE_EVERY;
      const hx = wall.axis === 'x' ? wall.pos.x + offset - wall.pos.x + wall.pos.x : wall.pos.x;
      // Correct calculation:
      const holeX = wall.axis === 'x' ? (wall.pos.x - wall.span / 2 + HOLE_EVERY * 0.5 + i * HOLE_EVERY) : wall.pos.x;
      const holeZ = wall.axis === 'z' ? (wall.pos.z - wall.span / 2 + HOLE_EVERY * 0.5 + i * HOLE_EVERY) : wall.pos.z;

      const hole = MeshBuilder.CreateCylinder(`hole-${i}-${lineY}`, {
        radius: 0.06, height: 0.09, tessellation: 6,
      }, s);
      hole.position        = new Vector3(holeX, lineY, holeZ);
      hole.material        = holeMat;
      hole.isPickable      = false;
      hole.checkCollisions = false;
      // Rotate cylinder to face out from wall
      if (wall.axis === 'x') {
        hole.rotation.x = Math.PI / 2;
      } else {
        hole.rotation.z = Math.PI / 2;
      }

      // Rust streak below ~35% of holes
      if (Math.random() < rustChance) {
        const rust = MeshBuilder.CreateBox(`rust-${i}-${lineY}`, { width: 0.04, height: 0.6, depth: 0.04 }, s);
        rust.position        = new Vector3(holeX, lineY - 0.35, holeZ);
        rust.material        = rustMat;
        rust.isPickable      = false;
        rust.checkCollisions = false;
      }
    }
  }
}
```

- [ ] **Step 3: Add `StandardMaterial` to imports if not already present, and call `_buildWallDetails()` in constructor**

`StandardMaterial` is already imported. In the constructor, add the call after `_buildRoom()`:

```javascript
this._buildRoom();
this._buildWallDetails();  // ← add this line
this._buildLighting();
```

- [ ] **Step 4: Verify**

Enter the hangar. Walls should look like raw concrete — two faint horizontal seam lines at y=1.5 and y=3.0 on every wall, small dark tie-hole dots along each seam, occasional rust-brown streaks hanging below some holes.

---

## Task 3: Tunnel — fog depth illusion + invisible wall

**Files:**
- Modify: `src/scenes/HangarScene.js` — extend tunnel, add fog, add invisible wall

- [ ] **Step 1: Extend TUNNEL_LEN from 14 to 24**

At the top of the file, update:

```javascript
const TUNNEL_LEN = 24;  // extended so fog fade reaches full black naturally
```

- [ ] **Step 2: Add Scene import for FOGMODE_LINEAR and enable fog in constructor**

`Scene` is already imported. In the constructor, after `this.scene.collisionsEnabled = true;`, add:

```javascript
this.scene.fogMode  = Scene.FOGMODE_LINEAR;
this.scene.fogColor = new Color3(0.04, 0.04, 0.06);
this.scene.fogStart = 22;
this.scene.fogEnd   = 32;
```

- [ ] **Step 3: Add the invisible wall at the tunnel threshold**

At the end of `_buildRoom()`, add:

```javascript
// Invisible wall at tunnel entrance — blocks driver from walking in
const tunnelWall = MeshBuilder.CreateBox('tunnel-gate', {
  width: TUNNEL_W, height: ROOM_H, depth: 0.2,
}, s);
tunnelWall.position        = new Vector3(0, ROOM_H / 2, ROOM_D / 2 + 0.2);
tunnelWall.isVisible       = false;
tunnelWall.checkCollisions = true;
```

- [ ] **Step 4: Verify**

Enter the hangar, walk north toward the tank. The tunnel should show visible concrete walls and floor for 2–3 units past the north wall opening, then fade completely to black. The driver should be blocked from entering the tunnel. The tank can still drive out (mount and deploy still works — the tank bypasses the gate via the `mountTank()` → `deployToArena()` transition, no physics involved).

---

## Task 4: Lighting — point lights for bare-bulb feel

**Files:**
- Modify: `src/scenes/HangarScene.js` — add PointLight import, update `_buildLighting()`

- [ ] **Step 1: Add PointLight to imports**

```javascript
import {
  Scene, HemisphericLight, DirectionalLight, PointLight,
  MeshBuilder, StandardMaterial, Color3, Color4, Vector3,
} from '@babylonjs/core';
```

- [ ] **Step 2: Add two point lights in `_buildLighting()`**

At the end of `_buildLighting()`, add:

```javascript
// Two overhead point lights — simulate bare bulbs
const bulb1 = new PointLight('bulb1', new Vector3(0, 4.5, 5), this.scene);
bulb1.diffuse    = new Color3(1.0, 0.92, 0.78);
bulb1.intensity  = 0.8;
bulb1.range      = 18;

const bulb2 = new PointLight('bulb2', new Vector3(0, 4.5, -5), this.scene);
bulb2.diffuse    = new Color3(1.0, 0.92, 0.78);
bulb2.intensity  = 0.6;
bulb2.range      = 14;
```

- [ ] **Step 3: Reduce ambient and directional to let point lights read**

Update the existing lights in `_buildLighting()`:

```javascript
const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
ambient.intensity   = 0.55;
ambient.diffuse     = new Color3(0.85, 0.80, 0.70);
ambient.groundColor = new Color3(0.15, 0.14, 0.12);

const overhead = new DirectionalLight('overhead', new Vector3(-0.3, -1, 0.5), this.scene);
overhead.intensity = 0.4;
overhead.position  = new Vector3(5, 15, 0);
```

- [ ] **Step 4: Verify**

The room should have a warm amber quality — slightly brighter near the centre, darker toward the walls. The concrete walls should show subtle warm highlights from the point lights.

---

## Task 5: Station Props — HangarProps.js + wire into HangarScene

**Files:**
- Create: `src/scenes/HangarProps.js`
- Modify: `src/scenes/HangarScene.js` — import HangarProps, replace `_makeStation` + `_buildStations`

### Step 1: Create `src/scenes/HangarProps.js`

```javascript
import { MeshBuilder, StandardMaterial, Color3, Vector3, CylinderBuilder } from '@babylonjs/core';

// ── Shared materials (created once per scene call) ──────────────────────────
function mats(s) {
  const wood = new StandardMaterial('prop-wood', s);
  wood.diffuseColor  = new Color3(0.30, 0.22, 0.10);
  wood.specularColor = new Color3(0.04, 0.04, 0.04);

  const metal = new StandardMaterial('prop-metal', s);
  metal.diffuseColor  = new Color3(0.20, 0.18, 0.16);
  metal.specularColor = new Color3(0.06, 0.06, 0.06);

  const darkGreen = new StandardMaterial('prop-green', s);
  darkGreen.diffuseColor  = new Color3(0.18, 0.26, 0.14);
  darkGreen.specularColor = new Color3(0.02, 0.02, 0.02);

  const crate = new StandardMaterial('prop-crate', s);
  crate.diffuseColor  = new Color3(0.30, 0.24, 0.12);
  crate.specularColor = new Color3(0.02, 0.02, 0.02);

  const parchment = new StandardMaterial('prop-parchment', s);
  parchment.diffuseColor  = new Color3(0.78, 0.70, 0.40);
  parchment.specularColor = new Color3(0.02, 0.02, 0.02);

  const darkMetal = new StandardMaterial('prop-dark-metal', s);
  darkMetal.diffuseColor  = new Color3(0.15, 0.14, 0.13);
  darkMetal.specularColor = new Color3(0.08, 0.08, 0.08);

  const redInd = new StandardMaterial('prop-red', s);
  redInd.diffuseColor  = new Color3(0.8, 0.0, 0.0);
  redInd.emissiveColor = new Color3(0.5, 0.0, 0.0);

  const olive = new StandardMaterial('prop-olive', s);
  olive.diffuseColor  = new Color3(0.22, 0.26, 0.14);
  olive.specularColor = new Color3(0.02, 0.02, 0.02);

  const lampGlow = new StandardMaterial('prop-lamp', s);
  lampGlow.diffuseColor  = new Color3(0.9, 0.7, 0.2);
  lampGlow.emissiveColor = new Color3(0.5, 0.38, 0.06);

  return { wood, metal, darkGreen, crate, parchment, darkMetal, redInd, olive, lampGlow };
}

function vis(mesh) {
  mesh.isPickable      = false;
  mesh.checkCollisions = false;
  return mesh;
}

function collider(name, size, pos, s) {
  const m = MeshBuilder.CreateBox(name, size, s);
  m.position        = pos;
  m.isVisible       = false;
  m.checkCollisions = true;
  return m;
}

// ── 4a: Mechanic Workbench ───────────────────────────────────────────────────
// Centre: x=-14, z=0, against west wall
export function buildWorkbench(s, cx, cz) {
  const M = mats(s);
  const ox = cx, oz = cz;

  // Bench surface
  const top = MeshBuilder.CreateBox('wb-top', { width: 2.8, height: 0.12, depth: 1.0 }, s);
  top.position = new Vector3(ox, 0.88, oz);
  top.material = M.wood; vis(top);

  // Lower shelf
  const shelf = MeshBuilder.CreateBox('wb-shelf', { width: 2.6, height: 0.08, depth: 0.9 }, s);
  shelf.position = new Vector3(ox, 0.42, oz);
  shelf.material = M.wood; vis(shelf);

  // Four legs
  [[-1.25, -0.4], [-1.25, 0.4], [1.25, -0.4], [1.25, 0.4]].forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`wb-leg${i}`, { width: 0.1, height: 0.88, depth: 0.1 }, s);
    leg.position = new Vector3(ox + dx, 0.44, oz + dz);
    leg.material = M.metal; vis(leg);
  });

  // Vice body + jaw
  const viceBody = MeshBuilder.CreateBox('wb-vice-body', { width: 0.25, height: 0.28, depth: 0.22 }, s);
  viceBody.position = new Vector3(ox - 1.1, 0.94, oz - 0.3);
  viceBody.material = M.metal; vis(viceBody);
  const viceJaw = MeshBuilder.CreateBox('wb-vice-jaw', { width: 0.28, height: 0.06, depth: 0.22 }, s);
  viceJaw.position = new Vector3(ox - 1.1, 1.02, oz - 0.3);
  viceJaw.material = M.metal; vis(viceJaw);

  // Toolbox on bench
  const tbox = MeshBuilder.CreateBox('wb-toolbox', { width: 0.55, height: 0.25, depth: 0.40 }, s);
  tbox.position = new Vector3(ox + 0.6, 1.065, oz + 0.1);
  tbox.material = M.darkGreen; vis(tbox);

  // Pegboard (thin slab behind bench, against wall)
  const pegboard = MeshBuilder.CreateBox('wb-pegboard', { width: 2.4, height: 1.6, depth: 0.04 }, s);
  pegboard.position = new Vector3(ox, 1.88, oz - 0.52);
  pegboard.material = M.wood; vis(pegboard);

  // Tool silhouettes on pegboard — wrench + hammer outlines (flat boxes)
  const wrench = MeshBuilder.CreateBox('wb-wrench', { width: 0.08, height: 0.9, depth: 0.03 }, s);
  wrench.position = new Vector3(ox - 0.7, 1.68, oz - 0.54);
  wrench.material = M.metal; vis(wrench);
  const wrenchHead = MeshBuilder.CreateBox('wb-wrenchh', { width: 0.28, height: 0.14, depth: 0.03 }, s);
  wrenchHead.position = new Vector3(ox - 0.7, 1.24, oz - 0.54);
  wrenchHead.material = M.metal; vis(wrenchHead);

  const hammer = MeshBuilder.CreateBox('wb-hammer', { width: 0.07, height: 0.8, depth: 0.03 }, s);
  hammer.position = new Vector3(ox + 0.2, 1.72, oz - 0.54);
  hammer.material = M.wood; vis(hammer);
  const hammerHead = MeshBuilder.CreateBox('wb-hammerh', { width: 0.32, height: 0.18, depth: 0.07 }, s);
  hammerHead.position = new Vector3(ox + 0.2, 1.28, oz - 0.54);
  hammerHead.material = M.metal; vis(hammerHead);

  return collider('station-mechanic', { width: 1.4, height: 1.0, depth: 3.5 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4b: Quartermaster Crates ─────────────────────────────────────────────────
// Centre: x=14, z=0, against east wall
export function buildQMCrates(s, cx, cz) {
  const M = mats(s);

  // Large bottom crate
  const crate1 = MeshBuilder.CreateBox('qm-crate1', { width: 2.4, height: 0.9, depth: 1.8 }, s);
  crate1.position = new Vector3(cx, 0.45, cz);
  crate1.material = M.crate; vis(crate1);
  // Cross-plank lines on top (two thin strips)
  const plank1 = MeshBuilder.CreateBox('qm-plank1', { width: 2.4, height: 0.03, depth: 0.06 }, s);
  plank1.position = new Vector3(cx, 0.905, cz);
  plank1.material = new StandardMaterial('plank-dark', s);
  plank1.material.diffuseColor = new Color3(0.18, 0.14, 0.06); vis(plank1);
  const plank2 = MeshBuilder.CreateBox('qm-plank2', { width: 0.06, height: 0.03, depth: 1.8 }, s);
  plank2.position = new Vector3(cx, 0.905, cz);
  plank2.material = plank1.material; vis(plank2);

  // Medium crate on top (offset)
  const crate2 = MeshBuilder.CreateBox('qm-crate2', { width: 1.8, height: 0.75, depth: 1.4 }, s);
  crate2.position = new Vector3(cx + 0.2, 1.27, cz - 0.1);
  crate2.material = new StandardMaterial('crate2', s);
  crate2.material.diffuseColor = new Color3(0.26, 0.20, 0.10); vis(crate2);

  // Small crate on top
  const crate3 = MeshBuilder.CreateBox('qm-crate3', { width: 1.0, height: 0.6, depth: 0.9 }, s);
  crate3.position = new Vector3(cx - 0.3, 1.95, cz + 0.2);
  crate3.material = new StandardMaterial('crate3', s);
  crate3.material.diffuseColor = new Color3(0.28, 0.22, 0.10); vis(crate3);

  // Wall shelf bracket (two L-shaped boxes)
  const bracketH = MeshBuilder.CreateBox('qm-brack-h', { width: 1.8, height: 0.06, depth: 0.5 }, s);
  bracketH.position = new Vector3(cx, 2.4, cz);
  bracketH.material = M.metal; vis(bracketH);
  const bracketV = MeshBuilder.CreateBox('qm-brack-v', { width: 1.8, height: 0.4, depth: 0.06 }, s);
  bracketV.position = new Vector3(cx, 2.2, cz - 0.22);
  bracketV.material = M.metal; vis(bracketV);

  // Ammo boxes on shelf
  [[-0.55, 0], [0.0, 0.02], [0.58, -0.02]].forEach(([dx, dz], i) => {
    const abox = MeshBuilder.CreateBox(`qm-ammo${i}`, { width: 0.55, height: 0.28, depth: 0.42 }, s);
    abox.position = new Vector3(cx + dx, 2.57, cz + dz);
    abox.material = M.darkGreen; vis(abox);
  });

  return collider('station-qm', { width: 1.4, height: 1.0, depth: 3.5 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4c: Tactical Map Table ───────────────────────────────────────────────────
// Centre: x=-11, z=17.5, north-left corner
export function buildMapTable(s, cx, cz) {
  const M = mats(s);

  // Table surface
  const tabletop = MeshBuilder.CreateBox('map-top', { width: 2.2, height: 0.08, depth: 1.4 }, s);
  tabletop.position = new Vector3(cx, 0.88, cz);
  tabletop.material = M.wood; vis(tabletop);

  // Four legs
  [[-0.98, -0.6], [-0.98, 0.6], [0.98, -0.6], [0.98, 0.6]].forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`map-leg${i}`, { width: 0.1, height: 0.88, depth: 0.1 }, s);
    leg.position = new Vector3(cx + dx, 0.44, cz + dz);
    leg.material = M.metal; vis(leg);
  });

  // Map (parchment slab on table)
  const mapMesh = MeshBuilder.CreateBox('map-map', { width: 2.0, height: 0.015, depth: 1.25 }, s);
  mapMesh.position = new Vector3(cx, 0.947, cz);
  mapMesh.material = M.parchment; vis(mapMesh);

  // Radio unit on corner
  const radio = MeshBuilder.CreateBox('map-radio', { width: 0.45, height: 0.32, depth: 0.35 }, s);
  radio.position = new Vector3(cx + 0.8, 1.04, cz - 0.45);
  radio.material = M.darkMetal; vis(radio);
  // Radio screen
  const screen = MeshBuilder.CreateBox('map-screen', { width: 0.26, height: 0.18, depth: 0.02 }, s);
  screen.position = new Vector3(cx + 0.8, 1.12, cz - 0.63);
  screen.material = new StandardMaterial('screen', s);
  screen.material.diffuseColor = new Color3(0.05, 0.08, 0.05); vis(screen);
  // Red indicator
  const ind = MeshBuilder.CreateCylinder('map-ind', { diameter: 0.06, height: 0.03, tessellation: 8 }, s);
  ind.position = new Vector3(cx + 0.95, 1.22, cz - 0.63);
  ind.rotation.x = Math.PI / 2;
  ind.material = M.redInd; vis(ind);

  // Gooseneck lamp pole + shade
  const pole = MeshBuilder.CreateCylinder('map-pole', { diameter: 0.05, height: 1.8, tessellation: 6 }, s);
  pole.position = new Vector3(cx - 0.8, 1.78, cz - 0.4);
  pole.material = M.metal; vis(pole);
  const shade = MeshBuilder.CreateCylinder('map-shade', { diameterTop: 0.28, diameterBottom: 0.06, height: 0.18, tessellation: 10 }, s);
  shade.position = new Vector3(cx - 0.8, 2.72, cz - 0.4);
  shade.material = M.lampGlow; vis(shade);

  return collider('station-map', { width: 2.5, height: 1.0, depth: 1.2 }, new Vector3(cx, 0.5, cz), s);
}

// ── 4d: Radio / Intel Shelf ──────────────────────────────────────────────────
// Centre: x=11, z=17.5, north-right corner
export function buildRadioShelf(s, cx, cz) {
  const M = mats(s);

  // Two vertical shelf posts
  [-0.85, 0.85].forEach((dx, i) => {
    const post = MeshBuilder.CreateBox(`rs-post${i}`, { width: 0.07, height: 2.4, depth: 0.07 }, s);
    post.position = new Vector3(cx + dx, 1.2, cz - 0.22);
    post.material = M.metal; vis(post);
  });

  // Two horizontal shelf boards
  [0.6, 1.6].forEach((y, i) => {
    const board = MeshBuilder.CreateBox(`rs-board${i}`, { width: 1.8, height: 0.06, depth: 0.52 }, s);
    board.position = new Vector3(cx, y, cz);
    board.material = M.metal; vis(board);
  });

  // Radio stack — three boxes on upper shelf
  [[0, 0.18, 0.40], [0, 0.18, 0.36], [0, 0.14, 0.32]].forEach(([dx, h, w], i) => {
    const unit = MeshBuilder.CreateBox(`rs-unit${i}`, { width: w, height: h, depth: 0.38 }, s);
    unit.position = new Vector3(cx + dx, 1.69 + i * 0.18, cz + 0.02);
    unit.material = M.darkMetal; vis(unit);
    // Small screen/detail on each unit
    const det = MeshBuilder.CreateBox(`rs-det${i}`, { width: w * 0.55, height: 0.08, depth: 0.02 }, s);
    det.position = new Vector3(cx + dx, 1.69 + i * 0.18 + 0.02, cz - 0.18);
    det.material = new StandardMaterial(`rs-det-mat${i}`, s);
    det.material.diffuseColor = new Color3(0.04, 0.06, 0.04); vis(det);
  });
  // Red indicator on top unit
  const ri = MeshBuilder.CreateCylinder('rs-ind', { diameter: 0.05, height: 0.03, tessellation: 6 }, s);
  ri.position = new Vector3(cx + 0.38, 2.07, cz - 0.18);
  ri.rotation.x = Math.PI / 2;
  ri.material = M.redInd; vis(ri);

  // Canisters on lower shelf — 3 cylinders
  [-0.5, 0, 0.5].forEach((dx, i) => {
    const can = MeshBuilder.CreateCylinder(`rs-can${i}`, { diameter: 0.22, height: 0.38, tessellation: 10 }, s);
    can.position = new Vector3(cx + dx, 0.82, cz + 0.02);
    can.material = M.olive; vis(can);
  });

  return collider('station-radio', { width: 2.5, height: 1.0, depth: 1.2 }, new Vector3(cx, 0.5, cz), s);
}
```

- [ ] **Step 2: Update `_buildStations()` in HangarScene.js to use HangarProps**

Add import at top of `HangarScene.js`:

```javascript
import { buildWorkbench, buildQMCrates, buildMapTable, buildRadioShelf } from './HangarProps.js';
```

Replace the entire `_buildStations()` method with:

```javascript
_buildStations() {
  const s = this.scene;

  // Station interaction data
  this._stationDefs = {
    map:      { id: 'map',      label: 'INTERACT', title: 'TACTICAL MAP',  body: 'MISSION SELECT\nComing soon.',         showDeploy: true  },
    radio:    { id: 'radio',    label: 'INTERACT', title: 'RADIO / INTEL', body: 'STAND BY FOR BRIEFING.\nComing soon.', showDeploy: false },
    mechanic: { id: 'mechanic', label: 'INTERACT', title: 'MECHANIC',      body: 'UPGRADES & REPAIRS\nComing soon.',     showDeploy: false },
    qm:       { id: 'qm',       label: 'INTERACT', title: 'QUARTERMASTER', body: 'AMMO & SUPPLIES\nComing soon.',        showDeploy: false },
  };

  // Build compound props — each returns its invisible collision mesh
  this._stationMeshes = [
    { mesh: buildMapTable(s,   -11,  17.5), data: this._stationDefs.map      },
    { mesh: buildRadioShelf(s,  11,  17.5), data: this._stationDefs.radio    },
    { mesh: buildWorkbench(s,  -14,  0),    data: this._stationDefs.mechanic },
    { mesh: buildQMCrates(s,    14,  0),    data: this._stationDefs.qm       },
  ];

  // Remove _makeStation — no longer needed
  // Tank placeholder stays the same
  const tankMat = new StandardMaterial('tank-bay', s);
  tankMat.diffuseColor  = new Color3(0.12, 0.42, 0.88);
  tankMat.specularColor = new Color3(0.1,  0.1,  0.1);

  const hull = MeshBuilder.CreateBox('tank-hull', { width: 3, height: 1.2, depth: 5 }, s);
  hull.position = new Vector3(0, 0.6, 16);
  hull.material = tankMat;

  const turret = MeshBuilder.CreateBox('tank-turret', { width: 2, height: 0.8, depth: 2.2 }, s);
  turret.position = new Vector3(0, 1.6, 16);
  turret.material = tankMat;

  const barrel = MeshBuilder.CreateBox('tank-barrel', { width: 0.25, height: 0.25, depth: 3 }, s);
  barrel.position = new Vector3(0, 1.65, 18.2);
  barrel.material = tankMat;

  this._tankPosition = new Vector3(0, 0, 16);
}
```

Also remove the `_makeStation()` method entirely from `HangarScene.js` — it's replaced by HangarProps.

- [ ] **Step 3: Verify**

Enter the hangar. Each station should now be a recognisable 3D prop:
- Left wall: workbench with legs, surface, toolbox, pegboard with tool silhouettes, vice
- Right wall: stack of three wooden crates, ammo boxes on a wall-mounted shelf above
- Top-left corner: table with parchment map, radio unit with red indicator, gooseneck lamp
- Top-right corner: metal shelving unit with radio stack + screens, three olive canisters on lower shelf

Walk up to each station — `[E] INTERACT` prompt appears. Press E — stub panel opens. Proximity and interactions still work.

---

## Task 6: Commit

- [ ] **Step 1: Stage and commit all files**

```bash
cd /Users/cliowu/claude-workspace/game
git add src/scenes/HangarScene.js src/scenes/HangarProps.js
git commit -m "$(cat <<'EOF'
feat: hangar visual polish

Concrete slab floor (subtle grout lines, no bright grid). Walls
upgraded with cast-concrete colour, horizontal form lines, tie-hole
cylinders, and rust streaks. Tunnel extended to 24u with linear fog
(start=22, end=32) fading to black — invisible wall blocks driver
at threshold. Two overhead point lights for bare-bulb warmth. Four
compound 3D station props (workbench, QM crates, map table, radio
shelf) replace placeholder grey boxes. All interactions preserved.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Floor: GridMaterial with gridRatio=2.5, mainColor(0.24,0.22,0.20), lineColor(0.18,0.16,0.14), minorUnitVisibility=0 — Task 1
- ✅ Walls: Color3(0.38,0.36,0.33), form lines at y=1.5 and y=3.0, tie-hole cylinders, rust streaks — Task 2
- ✅ Fog: FOGMODE_LINEAR, fogStart=22, fogEnd=32, fogColor matches clearColor — Task 3
- ✅ Invisible wall at z=20.5 (z=ROOM_D/2+0.2) — Task 3
- ✅ TUNNEL_LEN extended to 24 — Task 3
- ✅ Two PointLights with warm white diffuse — Task 4
- ✅ Workbench: surface, legs, shelf, vice, toolbox, pegboard + tools — Task 5
- ✅ QM Crates: 3 stacked crates, cross-plank lines, wall shelf, ammo boxes — Task 5
- ✅ Map Table: surface, legs, parchment map, radio+screen+indicator, gooseneck lamp — Task 5
- ✅ Radio Shelf: posts, boards, radio stack+screens+indicator, canisters — Task 5
- ✅ Collision meshes (invisible) for all stations — Task 5
- ✅ `isPickable=false, checkCollisions=false` on all visual meshes — Task 5
- ✅ Tank placeholder unchanged — Task 5
- ✅ Driver capsule unchanged — out of scope

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:**
- `buildWorkbench(s, cx, cz)` → returns collision mesh ✅ matches `{ mesh: buildWorkbench(...), data: ... }` usage ✅
- `_stationMeshes` array of `{ mesh, data }` — same shape as before, `_checkProximity` uses `mesh.position` ✅
- `_buildWallDetails()` called in constructor after `_buildRoom()` ✅
- `_makeStation()` removed — no remaining references ✅

**One fix inline:** The `_addFormLines` method had a redundant intermediate calculation for `holeX`. Corrected in the code above so `holeX` and `holeZ` are computed directly from `wall.pos` and the loop index, not through a stale `hx` variable.
