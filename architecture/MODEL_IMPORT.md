# Model Import Pipeline

How to bring any open-source GLB tank model into TanKING.

---

## One-time setup (already done)

- Blender 5.1.2 installed at `/Applications/Blender.app`
- blender-mcp registered globally: `claude mcp add blender -s user -- uvx blender-mcp`
- Blender addon installed and enabled

---

## Per-model workflow

### Step 1 — Download a model

Good free sources (prefer GLB/GLTF format):

| Source | License | Notes |
|--------|---------|-------|
| Sketchfab | Mixed (filter CC0) | Search "tank", "armored vehicle" |
| Kenney.nl | CC0 | Stylized packs |
| Quaternius | CC0 | Low-poly military |
| Free3D | Mixed | 222+ free tank models |

Download as **GLB** wherever possible. If only FBX is available, convert in Blender first.

---

### Step 2 — Open Blender + connect MCP

1. Open Blender (`/Applications/Blender.app`)
2. In the 3D Viewport press **N** → **BlenderMCP** tab → **Connect to Server**
3. Start a **new Claude Code session** (MCP tools load at session start)

---

### Step 3 — Pre-check: verify ground level before placing empties

**Do this before placing any empties.** Sketchfab models often have their GLTF Y-minimum above 0 (the model is "floating" in GLTF space). If you place the turret empty assuming Z=0 is the floor, it'll land near ground level and the geometry will look correct in Blender but break in the game.

Paste this prompt first:

```
Import the file at /path/to/downloaded/model.glb into Blender.
Before doing anything else, report:
- The object's bounding box minimum Z in Blender world space
- The object's bounding box maximum Z in Blender world space
- Which direction the tank nose is facing (+X, -X, +Z, or -Z)
- The total height (max Z - min Z) in Blender units

Do NOT place any empties yet.
```

**Interpret the result:**
- If `min Z ≈ 0` → floor is at Blender Z=0. Standard placement applies.
- If `min Z > 0` (e.g. 1.476) → the model is elevated. You MUST add `min Z` to all empty heights. Example: if min Z = 1.476 and the turret ring should be 1.4m above the hull floor, place the "turret" empty at Z = 1.476 + 1.4 = 2.876.

---

### Step 4 — Tell Claude to rig and export

Paste this prompt (fill in paths and the `min Z` value from step 3):

```
The model's Blender Z-minimum is [MIN_Z]. Use this as the floor reference for all empty placement.

1. Rename the root object to: Sketchfab_model
2. Create an EMPTY named "turret" at the turret ring center.
   Height = [MIN_Z] + (hull height × 0.7) approximately — verify visually that it sits at the hull deck.
   Re-parent all turret meshes and the barrel under it using keep_world=True.
3. Create an EMPTY named "mount" at the barrel trunnion (where the barrel pivots for elevation).
   Re-parent the barrel mesh under it using keep_world=True.
4. Do NOT rotate the root.
5. Export as GLB to: /Users/cliowu/claude-workspace/game/public/models/MODELNAME.glb

Report:
- World position of the "turret" empty (X, Y, Z)
- World position of the "mount" empty (X, Y, Z)
- Facing axis
```

Claude will use `execute_blender_code` (bpy) to inspect, rig, and export.

> **Do not rotate the model in Blender.** The loader handles orientation via `facingAxis` in the manifest. Rotating in Blender corrupts the quaternion embedded in the GLB root and causes misalignment.

---

### Step 5 — Add to manifest

Open `public/models/manifest.json` and add an entry:

```json
{
  "your_model.glb": {
    "root": "Sketchfab_model",
    "turret": "turret",
    "mount": "mount",
    "facingAxis": "+X"
  }
}
```

**All manifest fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `root` | yes | — | Root transform node name |
| `turret` | yes | — | Turret empty name |
| `mount` | yes | — | Barrel/mount empty name |
| `facingAxis` | yes | `"+X"` | Which axis the tank nose points in the exported GLB. Options: `+X` `-X` `+Z` `-Z`. The loader auto-rotates to game +Z. |
| `targetWidth` | no | `2.4` | Hull width in game units. Adjust if the model is notably wider or narrower than a standard tank. |
| `zCenterAdjust` | no | `0` | Shifts the whole model forward/back so the hull center (not barrel midpoint) sits at Z=0. Tune if the tank spawns too far forward or back. |
| `turretPivotZOffset` | no | `0` | Fine-tunes the turret ring Z position after the loader places it. Use if the turret rotates off-center. |
| `barrelTipOffset` | no | `1.8` | Distance in game units from the barrel pivot to the shell spawn point. Match to barrel length. M26 Pershing uses `3.8`. |
| `centerTurretX` | no | `false` | Forces turretPivot.x = 0. Set to `true` if the turret is drifting left/right due to coord-system X artifacts. |
| `paintColor` | no | none | RGB array `[r, g, b]` (0–1). Paints body panels this color (matte finish) while leaving tracks, optics, wheels, and interior with their original War Thunder materials. See **Model Painting** section below. |

**Real example — M26 Pershing:**
```json
"m26_pershing_war_thunder.glb": {
  "root": "Sketchfab_model",
  "turret": "turret",
  "mount": "mount",
  "facingAxis": "+Z",
  "targetWidth": 3.2,
  "zCenterAdjust": 1.05,
  "turretPivotZOffset": 0.78,
  "barrelTipOffset": 3.8,
  "centerTurretX": true
}
```

---

### Step 6 — Verify in the inspector

Open the game (`npm run dev`), press **T** from the menu, and click your model's button.

**Check the console output immediately:**

```
[Inspector] your_model.glb: scale=X.XXXX, w=X.XX
[Inspector] turretPivot: x=... y=... z=...
[Inspector] barrelPivot: x=... y=... z=...
```

**Pass/fail criteria:**

| Value | Pass | Fail |
|-------|------|------|
| `turretPivot.y` | > 0.3 | ≤ 0.3 → empty too low, redo Step 3 with corrected Z |
| `turretPivot.x` | ≈ 0 (or small) | > 0.5 → add `centerTurretX: true` to manifest |
| `barrelPivot.z` | > 0 (forward of ring) | ≤ 0 → mount empty behind the ring |
| Scale | 0.5 – 1.5 | Outside range → check `targetWidth` in manifest |

If `turretPivot.y ≤ 0.3`, a **console warning fires automatically** — look for:
```
[Inspector] your_model.glb: turretNode y=... — empty may be misplaced in Blender
```

**Visual check — take a side-profile screenshot:**

Run from the `game/` directory:
```
node architecture/verify-model.mjs your_model.glb
```

This opens the inspector headlessly and saves `architecture/verify-screenshots/` with default, side, and front views. If the turret is floating or sunken in the side view, the empty height is wrong.

### Step 7 — Load it in the game

In `ArenaScene._setupEntities()`, change the model filename:

```js
const modelFile = 'your_model.glb';
```

The manifest entry is loaded automatically — no other code changes needed.

---

## The naming contract

The loader looks for these node names (with fuzzy fallback if exact names aren't found):

| Game role | Expected name | Fuzzy fallback pattern |
|-----------|---------------|------------------------|
| Root transform | `Sketchfab_model` | First top-level transform node |
| Turret assembly | `turret` | Matches: turret, tower, gun_base |
| Barrel/mount | `mount` | Matches: mount, barrel, gun, cannon, tube, weapon |

If the fuzzy fallback fires, a console warning will appear. Rename in Blender for a clean load.

---

## Game unit dimensions

The loader auto-scales every model to fit the target width:

- **Hull width**: `targetWidth` game units (default 2.4) — set per model in manifest
- **Hull depth**: scales proportionally from width
- **Barrel tip**: `barrelTipOffset` units ahead of the barrel pivot — set per model in manifest

You don't need to scale in Blender — the game handles it.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tank invisible | Root node name mismatch | Check console, rename in Blender |
| Turret doesn't rotate | `turret` node not found | Check console, rename in Blender |
| Barrel doesn't elevate | `mount` node not found | Check console, rename in Blender |
| Tank faces wrong direction | Wrong `facingAxis` in manifest | Try `+X`, `-X`, `+Z`, `-Z` |
| Model floating / sunk | Y offset issue | Check bounding box min Y in console log |
| Tank spawns too far forward | `zCenterAdjust` needed | Add/tune `zCenterAdjust` in manifest |
| Turret rotates off-center | Pivot Z not at turret ring | Tune `turretPivotZOffset` in manifest |
| Shells spawn inside the barrel | `barrelTipOffset` too small | Increase value until shells clear the barrel |
| Turret drifts left/right | Coord-system X artifact | Set `centerTurretX: true` in manifest |
| `turretPivot.y ≤ 0.3` warning in console | "turret" empty placed at wrong height | Re-do Step 3: add model's Blender `min Z` to the empty's target height |
| Turret geometry floating above hull | "turret" empty near ground level (same as above) | Same fix — the loader preserves geometry position but rotation pivot will be off |
| Turret rotation orbits in a wide arc | Empty height incorrect, pivot far from ring | Fix empty placement in Blender, re-export |
| Entire model painted including tracks | Track mesh names don't match keyword list | Check `[Paint]` log for the mesh names — add new keywords to `UNPAINTABLE` in `src/utils/modelPaint.js` |
| Nothing is painted | `paintColor` missing from manifest | Add `"paintColor": [r, g, b]` to manifest entry |

---

## Model Painting

The loader can intelligently repaint body panels while leaving mechanical/optical parts with their original War Thunder materials. Think of it like masking a car before spraying: tracks, wheels, lenses, and interior don't get painted.

**Enable it:**
```json
"paintColor": [0.12, 0.42, 0.88]
```

**Color reference:**
| Look | RGB |
|------|-----|
| Cobalt blue (player tank) | `[0.12, 0.42, 0.88]` |
| Toy green | `[0.18, 0.75, 0.22]` |
| Signal red (enemy) | `[0.92, 0.12, 0.08]` |
| White matte | `[0.92, 0.90, 0.88]` |
| Sand / desert | `[0.85, 0.75, 0.45]` |

**How it works:** After load, every mesh name is checked against an unpaintable keyword list. Matches keep their GLTF material. Everything else gets a `StandardMaterial` with `diffuseColor = paintColor` and near-zero specular (matte finish).

**Default unpaintable keywords** (in `src/utils/modelPaint.js`):
`track`, `tread`, `wheel`, `road_wheel`, `sprocket`, `idler`, `roller`, `bogie`, `suspension`, `lens`, `glass`, `optic`, `periscope`, `sight`, `vision`, `interior`, `crew`, `engine`, `rubber`, `seal`, `exhaust`, `muffler`

**Tuning for a new model:** Load it in the inspector and read the `[Paint]` console log:
```
[Paint] 30 painted, 35 left original: track_t55-track_2_0, wheel_t55-wheels_1_0, ...
```
If something is wrongly painted (e.g. a track named `caterpillar_01`), add `caterpillar` to the `UNPAINTABLE` list. If something is wrongly skipped (e.g. a hatch named `vision_port_cover` being left grey), rename it in Blender or add an exception.
