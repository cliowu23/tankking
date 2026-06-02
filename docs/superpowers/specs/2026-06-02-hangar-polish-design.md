# Hangar Visual Polish — Design Spec
**Date:** 2026-06-02

---

## Overview

Polish the hangar hub from its current placeholder state (grey boxes, arena grid floor, no atmosphere) into a readable Soviet command bunker. Every change is visual only — no gameplay logic is touched.

---

## 1. Floor

**Replace** the current `GridMaterial` with a custom `StandardMaterial` that reads as worn concrete slabs.

- Base colour: warm dark concrete `Color3(0.24, 0.22, 0.20)`
- Large slab grid: `GridMaterial` with wide spacing (`gridRatio=2.5`, `majorUnitFrequency=1`) and very low-contrast lines `Color3(0.18, 0.16, 0.14)` on `mainColor Color3(0.24, 0.22, 0.20)` — faint grout lines, not the bright arena grid
- `minorUnitVisibility=0` — no sub-grid lines

The result reads as large poured concrete slabs with barely-visible joints, not a test grid.

---

## 2. Walls

**Replace** the current flat `StandardMaterial` on all wall meshes with a more detailed concrete look.

- Wall colour: `Color3(0.38, 0.36, 0.33)` — raw concrete, slightly warm
- Specular: near-zero `Color3(0.03, 0.03, 0.03)`
- **Form lines**: thin horizontal `MeshBuilder.CreateBox` strips (height=0.04, same width as wall, depth=0.05) placed at y=1.5 and y=3.0 on each wall — these are the horizontal seam lines from cast concrete formwork
- **Tie holes**: small dark cylinders (`radius=0.06, height=0.08`) recessed into the wall face at regular intervals along each form line — the bolt holes left when concrete forms are removed
- **Rust streaks**: thin tall dark-brown boxes (`width=0.04, height=0.6`) hanging below select tie holes

All detail geometry uses `isPickable=false, checkCollisions=false`.

---

## 3. Tunnel

**Add fog to the HangarScene** and extend the tunnel geometry.

- `scene.fogMode = Scene.FOGMODE_LINEAR`
- `scene.fogColor = new Color3(0.04, 0.04, 0.06)` — matches clearColor
- `scene.fogStart = 22` — fog begins just past the north wall (z=20)
- `scene.fogEnd = 30` — fully black 10 units into the tunnel
- **Invisible wall**: `MeshBuilder.CreateBox` at z=20.5, x=0, width=TUNNEL_W, height=ROOM_H — `isVisible=false, checkCollisions=true` — blocks the driver from entering
- **Extend tunnel**: increase `TUNNEL_LEN` from 14 → 24 so geometry extends far enough to fade naturally

The effect: concrete walls and floor visible for ~2–3 units past the opening, then swallowed by darkness.

---

## 4. Station Props

Replace the four plain grey station boxes with compound 3D props built from Babylon.js primitives. All props use `isPickable=false, checkCollisions=true` on their collision box only (one invisible box per station, same size as current placeholder).

### 4a — Mechanic Workbench (left wall, x=-14, z=0)

Built from:
- **Bench surface**: wide flat box `(2.8 × 0.12 × 1.0)` at y=0.88, dark wood `Color3(0.32, 0.22, 0.10)`
- **Bench frame**: 4 leg boxes `(0.1 × 0.88 × 0.1)` at corners, dark metal `Color3(0.20, 0.18, 0.16)`
- **Lower shelf**: thinner box `(2.6 × 0.08 × 0.9)` at y=0.42, same wood
- **Vice**: two small boxes on the near end — body `(0.25 × 0.28 × 0.22)` + jaw `(0.28 × 0.06 × 0.22)` at y=0.94, dark iron `Color3(0.22, 0.22, 0.24)`
- **Toolbox**: small box `(0.55 × 0.25 × 0.40)` on bench surface, dark green `Color3(0.18, 0.28, 0.16)`
- **Pegboard**: thin tall box `(0.04 × 1.6 × 2.4)` mounted on wall behind bench at y=2.0, dark wood `Color3(0.28, 0.22, 0.14)`

### 4b — Quartermaster Crates (right wall, x=14, z=0)

Built from:
- **Large bottom crate**: `(2.4 × 0.9 × 1.8)` at y=0.45, worn wood `Color3(0.30, 0.24, 0.12)`, faint cross-line texture via 2 thin dark strips on top face
- **Medium crate** (offset, on top): `(1.8 × 0.75 × 1.4)` at y=1.27, slightly different wood shade
- **Small crate**: `(1.0 × 0.6 × 0.9)` on top of medium crate
- **Wall shelf bracket**: L-shaped pair of boxes `(0.06 × 0.06 × 1.0)` mounted high on wall at y=2.4
- **Ammo boxes on shelf**: 3 small flat boxes `(0.55 × 0.28 × 0.45)` on the bracket shelf, dark green/khaki

### 4c — Tactical Map (top-left corner, x=-11, z=17.5)

Built from:
- **Table surface**: `(2.2 × 0.08 × 1.4)` at y=0.88, same dark wood
- **Table legs**: 4 legs same pattern as workbench
- **Map**: thin flat box `(2.0 × 0.015 × 1.25)` on table surface, parchment `Color3(0.80, 0.72, 0.42)`
- **Radio unit**: box `(0.45 × 0.32 × 0.35)` on table corner, dark metal, small red indicator cylinder on top
- **Lamp**: thin cylinder pole `(radius=0.03, height=1.8)` + small disc shade at top, warm emissive `Color3(0.9, 0.7, 0.2)` with `intensity=0.6`

### 4d — Radio / Intel (top-right corner, x=11, z=17.5)

Built from:
- **Shelf unit frame**: two vertical posts `(0.06 × 2.2 × 0.06)` + two horizontal shelves `(1.8 × 0.06 × 0.5)`, dark metal
- **Radio stack**: 3 stacked boxes of varying sizes `~(0.8 × 0.18 × 0.4)` on shelves, dark metal with small detail boxes for knobs/screens
- **Canisters**: 2–3 small cylinders `(radius=0.12, height=0.38)` on lower shelf, dark olive

---

## 5. Lighting

Add two **point lights** inside the room to suggest bare overhead bulbs:

- `PointLight` at `(0, 4.5, 5)`, warm white `Color3(1.0, 0.92, 0.78)`, `intensity=0.8`, `range=18`
- `PointLight` at `(0, 4.5, -5)`, same colour, `intensity=0.6`, `range=14`

Keep the existing HemisphericLight (ambient fill) and DirectionalLight. These point lights add the "bare bulb" warmth and create subtle shadows on the concrete walls that read as depth.

---

## 6. Driver Character

Capsule placeholder stays as-is. No changes.

---

## Out of Scope

- Cyrillic stencils / wall markings (atmosphere pass, future)
- Sound / ambient audio (future)
- NPC figures at stations (future, Forever Winter unlock model)
- Ceiling geometry (removed — top-down camera doesn't need it)
- Station interaction UI changes (already working)
