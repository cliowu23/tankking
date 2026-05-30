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

Then:
1. Rename the root object to: Sketchfab_model
2. Rename the turret object to: turret
3. Rename the barrel object to: mount
4. Make sure the model faces the +X direction (tank nose pointing right in front view)
5. Export the result as GLB to: /Users/cliowu/claude-workspace/game/public/models/MODELNAME.glb

Report the facing direction before and after, and the bounding box dimensions.
```

Claude will use `execute_blender_code` (bpy) to:
- Import the file
- Inspect all object names, positions, and parent hierarchy
- Identify hull (largest mesh), turret (elevated centered node), barrel (thin elongated child of turret)
- Rename to the game contract
- Correct orientation if needed
- Export to the game's models folder

---

### Step 4 — Add to manifest

Open `public/models/manifest.json` and add an entry:

```json
{
  "t-55ak.glb": { ... existing ... },

  "your_model.glb": {
    "root": "Sketchfab_model",
    "turret": "turret",
    "mount": "mount",
    "facingAxis": "+X"
  }
}
```

**facingAxis options:** `+X` | `-X` | `+Z` | `-Z`
The loader auto-rotates the model so it faces game forward (+Z). If you confirmed the nose points +X after Blender export, use `"+X"`.

---

### Step 5 — Load it in the game

In `ArenaScene._setupEntities()`, change the model filename:

```js
// Current player tank
const modelFile = 't-55ak.glb';

// To load a different model:
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

The loader auto-scales every model to fit the collision box:
- **Hull width**: 2.4 game units (scaled from bounding box X)
- **Hull depth**: scales proportionally (~3.2 units for a real tank)
- **Barrel tip**: hardcoded at 1.8 units ahead of the barrel pivot

You don't need to scale in Blender — the game handles it.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tank invisible | Root node name mismatch | Check console, rename in Blender |
| Turret doesn't rotate | `turret` node not found | Check console, rename in Blender |
| Barrel doesn't elevate | `mount` node not found | Check console, rename in Blender |
| Tank faces wrong direction | Wrong `facingAxis` in manifest | Try `+X`, `-X`, `+Z`, `-Z` |
| Model floating | Y offset issue | Check bounding box min Y in console log |
