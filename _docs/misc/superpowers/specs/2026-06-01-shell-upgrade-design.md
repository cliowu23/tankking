# Shell Upgrade — Design Spec
**Date:** 2026-06-01  
**Status:** Approved, ready for implementation planning

---

## Problem

The current shell travels at 16 u/s — barely faster than the player's boost speed (18 u/s). It looks chunky and boxy, has no trail, and reads as a thrown rock rather than a fired projectile. Combat lacks snap.

---

## Design Overview

Three independent improvements applied together:
1. **Speed** — increase from 16 to 35 u/s
2. **Shape** — replace short boxy mesh with a slender needle
3. **Trail** — add 2 ghost meshes that fade out behind the shell

Plus a minor color tweak to push the hot-tracer look further.

---

## Section 1 — Speed

### Change
In `ArenaScene.js` → `_shoot()`, change:
```js
const HSPEED = 16;
```
to:
```js
const HSPEED = 35;
```

`HSPEED` is already a named local constant — single change, all shell fire calls inherit it.

### Rationale
- Tank normal max: 8 u/s, boost: 18 u/s
- 35 u/s = ~4.4× normal speed — clearly faster than the tank, satisfying snap
- Still slow enough to visually track; not hitscan

### AI shells
`AIEnemy.js` fires shells independently. Check for its own speed constant and update to match 35 u/s for consistency.

---

## Section 2 — Shell Geometry

### Change
In `Shell.js` constructor, replace:
```js
this.mesh = MeshBuilder.CreateBox('shell', { width: 0.18, height: 0.18, depth: 0.55 }, scene);
```
with:
```js
this.mesh = MeshBuilder.CreateBox('shell', { width: 0.10, height: 0.10, depth: 0.80 }, scene);
```

### Color update
```js
mat.diffuseColor  = new Color3(1.0, 0.95, 0.7);   // yellow-white (was 1.0, 0.82, 0.0)
mat.emissiveColor = new Color3(1.0, 0.88, 0.4);    // hot tracer (was 0.9, 0.55, 0.0)
```

---

## Section 3 — Ghost Trail

Two ghost meshes follow the shell, showing where it was 1 and 2 frames ago, fading out quickly.

### Data added to Shell class

```js
this.ghosts = [];          // array of 2 ghost mesh objects
this._prevPositions = [];  // ring buffer of last 2 positions
```

### Ghost mesh setup (constructor)
Create 2 clones of the shell mesh with semi-transparent material:

```js
for (let i = 0; i < 2; i++) {
  const ghost = this.mesh.clone('shellGhost' + i);
  ghost.isVisible = false;
  const gMat = new StandardMaterial('ghostMat' + i, scene);
  gMat.diffuseColor  = new Color3(1.0, 0.95, 0.7);
  gMat.emissiveColor = new Color3(1.0, 0.88, 0.4);
  gMat.alpha = 0.35 - i * 0.15;  // ghost[0]=0.35, ghost[1]=0.20
  ghost.material = gMat;
  this.ghosts.push(ghost);
}
```

### Ghost update (Shell.update)
At the start of each `update()` call, before moving the shell:

```js
// Shift previous positions
this._prevPositions[1] = this._prevPositions[0]
  ? this._prevPositions[0].clone() : this.mesh.position.clone();
this._prevPositions[0] = this.mesh.position.clone();
```

After moving the shell, position the ghosts:

```js
if (this.active) {
  for (let i = 0; i < 2; i++) {
    if (this._prevPositions[i]) {
      this.ghosts[i].isVisible = true;
      this.ghosts[i].position.copyFrom(this._prevPositions[i]);
      this.ghosts[i].rotation.copyFrom(this.mesh.rotation);
    }
  }
}
```

### Ghost reset on fire (Shell.fire)
At the start of `fire()`, reset positions so a recycled shell doesn't show stale ghosts:
```js
this._prevPositions = [];
for (const g of this.ghosts) g.isVisible = false;
```

### Ghost cleanup (Shell.deactivate)
```js
for (const g of this.ghosts) g.isVisible = false;
this._prevPositions = [];
```

### Tuning constants
| Ghost index | Alpha | Visual read |
|-------------|-------|-------------|
| 0 (1 frame back) | 0.35 | Faint |
| 1 (2 frames back) | 0.20 | Very faint |

These two numbers are the primary tuning levers. Increase both for a more visible trail; decrease for more subtle.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/entities/Shell.js` | Geometry dimensions, colors, ghost mesh setup, ghost update, ghost cleanup |
| `src/scenes/ArenaScene.js` | `HSPEED` constant in `_shoot()`: 16 → 35 |
| `src/entities/AIEnemy.js` | Shell speed constant: match to 35 u/s |

---

## Out of Scope

- Per-weapon trail colors (all shells share one trail style for now)
- Particle smoke trail (separate VFX pass if desired)
- Shell sound / audio (separate audio milestone)
- Tracer color differentiation between player and AI shells
