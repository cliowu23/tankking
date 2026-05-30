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

### Step 3 — Tell Claude what to do

Paste this prompt (fill in the paths):

```
Import the file at /path/to/downloaded/model.glb into Blender.
Analyze the object tree and identify:
- The root/parent node
- The turret assembly (elevated, roughly centered, rotatable)
- The barrel/gun (thin elongated mesh attached to or child of turret)
- Which direction the tank nose is facing (report the axis: +X, -X, +Z, or -Z)

Then:
1. Rename the root object to: Sketchfab_model
2. Create an EMPTY named "turret" at the turret ring center (bottom of the turret body)
   — re-parent all turret meshes and the barrel under it
3. Create an EMPTY named "mount" at the barrel trunnion point
   — re-parent the barrel mesh under it
4. Do NOT rotate the root — just report the facing axis so we can set facingAxis in the manifest
5. Export the result as GLB to: /Users/cliowu/claude-workspace/game/public/models/MODELNAME.glb

Report:
- The facing axis of the tank nose
- Bounding box dimensions (width × depth × height)
- World position of the turret empty
- World position of the mount empty
```

Claude will use `execute_blender_code` (bpy) to inspect, rig, and export.

> **Do not rotate the model in Blender.** The loader handles orientation via `facingAxis` in the manifest. Rotating in Blender corrupts the quaternion embedded in the GLB root and causes misalignment.

---

### Step 4 — Add to manifest

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

### Step 5 — Load it in the game

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
