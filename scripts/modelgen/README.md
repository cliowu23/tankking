# modelgen — procedural tank parts + the Tank Tuner

Original meshes only. Spec: `_docs/TANKING_MODEL_SPEC.md` (Integration Contract).
Canon parameters: `params/player_tank.json` — the single source of truth. The Python
scripts read it; the Tank Tuner edits it. Bake = commit the JSON.

## Tank Tuner (hands-on editing)

```
node scripts/modelgen/tuner-server.mjs     # helper on :7077 (runs Blender for you)
# Vite dev server must be running, then open:
http://localhost:5173/tuner.html
```

- **Sliders** (Hull / Turret / Gun): release → Blender re-exports the real GLB (~1s) →
  viewer hot-swaps it. What you see IS the game asset.
- **Details palette**: click to spawn a greeble (jerry can, crate, spare links, toolbox,
  antenna, headlight, spare wheel, tarp), drag the gizmo to place, yellow ring rotates,
  scale slider + ROTATE 45° / DELETE for the selected one.
- **Pin mode**: toggle on → click the tank → type a note. Gives Claude exact 3D anchors
  for bespoke detail requests ("canvas mantlet cover here").
- **DUMP**: saves everything (params + attachments + pins) to the canon JSON and copies
  it to the clipboard. Tell Claude "baked" and it gets committed as the new canon.

## How attachments reach the game

The tuner previews greebles as live instances (`TANK_TUNER=1` regens skip them).
A plain regen — `blender --background --python scripts/modelgen/player_hull_base.py` —
bakes the attachment list INTO the hull GLB for the game. Same `_greebles.py` geometry
either way, so the preview is exact.

## Files

- `_lib.py` — shared helpers, `STANDARD_RING_DIAMETER`, axis conversion, safe export
  (transform_apply on MESHES ONLY — applying to an empty zeroes the mount points)
- `_greebles.py` — detail-part library (single source for tuner preview + bake)
- `player_*.py` — the three player-tank part generators (M26-inspired)
- `gen_greebles.py` — exports the palette preview GLBs
- `calib_hull_axes.py` — Batch-0 axis-calibration part (keep; pipeline reference)
- `tuner-server.mjs` — local helper: GET /params, POST /save, POST /regen

## Axes (Batch-0 calibrated — never assume, these are measured)

Blender Z up → game Y up · Blender **−Y = forward** · Blender **+X = game LEFT**
(right-side details go on −X) · game rotY = **−**Blender rotZ.
