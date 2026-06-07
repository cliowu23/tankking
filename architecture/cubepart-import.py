"""
CubePart → TanKING import pipeline.

Usage (two ways):

  1. Blender MCP — paste into execute_blender_code with PARTS_DIR and OUT_PATH set.
  2. CLI — run from inside Blender's Python:
       blender --background --python architecture/cubepart-import.py -- \
         --parts /tmp/my_tank  --out /tmp/my_tank/combined.glb

CubePart part file naming expected in PARTS_DIR:
  hull.glb    — main hull body
  turret.glb  — turret assembly
  cannon.glb  — barrel / gun tube
  tracks.glb  — running gear (optional)

Other .glb files in the folder are imported as generic parts parented to root.

Output: a single combined GLB at OUT_PATH, structured as:

  Sketchfab_model  (Empty)
  ├── hull mesh(es)
  ├── turret       (Empty — turret ring pivot)
  │   ├── turret mesh(es)
  │   └── mount    (Empty — barrel elevation pivot)
  │       └── cannon mesh(es)
  └── tracks mesh(es)

After export, open the GLB and verify the empty positions visually.
If either looks off, move it by hand (~1 min) and re-export.
Then follow architecture/MODEL_IMPORT.md Step 7 to add a manifest entry.
"""

import bpy
import os
import sys
from mathutils import Vector


# ── Configuration ──────────────────────────────────────────────────────────────
# When using Blender MCP, set these two variables and delete the argparse block.

PARTS_DIR = ""   # e.g. "/tmp/my_tank"
OUT_PATH  = ""   # e.g. "/tmp/my_tank/combined.glb"

# ── CLI arg parsing (only active when run via blender --python) ─────────────
if "--" in sys.argv:
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--parts", required=True)
    p.add_argument("--out",   required=True)
    args = p.parse_args(argv)
    PARTS_DIR = args.parts
    OUT_PATH  = args.out

if not PARTS_DIR or not OUT_PATH:
    raise ValueError("Set PARTS_DIR and OUT_PATH at the top of the script.")


# ── Helpers ────────────────────────────────────────────────────────────────────

def world_bbox(objs):
    """Return (min_x, max_x, min_y, max_y, min_z, max_z) in world space
    for a list of mesh objects. Blender Y = up axis."""
    if not objs:
        return None
    pts = []
    for obj in objs:
        pts.extend(obj.matrix_world @ Vector(v) for v in obj.bound_box)
    return (
        min(p.x for p in pts), max(p.x for p in pts),
        min(p.y for p in pts), max(p.y for p in pts),
        min(p.z for p in pts), max(p.z for p in pts),
    )


def cx(bbox): return (bbox[0] + bbox[1]) / 2   # center X
def cy(bbox): return (bbox[2] + bbox[3]) / 2   # center Y (vertical)
def cz(bbox): return (bbox[4] + bbox[5]) / 2   # center Z (depth)


def import_glb(filepath):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    new_objs = list(set(bpy.data.objects) - before)
    return [o for o in new_objs if o.type == 'MESH']


def make_empty(name, location):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=location)
    e = bpy.context.active_object
    e.name = name
    return e


def reparent(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


# ── Main ───────────────────────────────────────────────────────────────────────

# 1. Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Import part GLBs
glb_files = [f for f in os.listdir(PARTS_DIR) if f.endswith(".glb")]
if not glb_files:
    raise FileNotFoundError(f"No .glb files in {PARTS_DIR}")

part_objects = {}
for fname in sorted(glb_files):
    name     = fname[:-4].lower()   # strip .glb
    meshes   = import_glb(os.path.join(PARTS_DIR, fname))
    for i, m in enumerate(meshes):
        m.name = name if len(meshes) == 1 else f"{name}_{i}"
    part_objects[name] = meshes
    print(f"[CubePart] {fname}: {len(meshes)} mesh(es)")

# 3. Root empty
root = make_empty("Sketchfab_model", (0, 0, 0))

# 4. Turret empty — sits at the base (min Y) of the turret bounding box, XZ-centered
turret_meshes = part_objects.get("turret", [])
turret_bb     = world_bbox(turret_meshes)
if turret_bb:
    turret_empty = make_empty("turret", (cx(turret_bb), turret_bb[2], cz(turret_bb)))
    print(f"[CubePart] turret empty @ y={turret_bb[2]:.3f} (min Y of turret mesh)")
else:
    print("[CubePart] WARNING: no turret.glb — placing turret empty at (0, 0.5, 0)")
    turret_empty = make_empty("turret", (0, 0.5, 0))

# 5. Mount empty — at rear (min Z) of cannon, vertically centered
#    "rear" in Blender Z maps to the end that connects to the turret face
cannon_meshes = part_objects.get("cannon", [])
cannon_bb     = world_bbox(cannon_meshes)
if cannon_bb:
    mount_empty = make_empty("mount", (cx(cannon_bb), cy(cannon_bb), cannon_bb[4]))
    print(f"[CubePart] mount empty @ z={cannon_bb[4]:.3f} (rear of cannon mesh)")
else:
    print("[CubePart] WARNING: no cannon.glb — placing mount empty at turret empty")
    mount_empty = make_empty("mount", turret_empty.location)

# 6. Parent hierarchy
reparent(turret_empty, root)
reparent(mount_empty, turret_empty)

for name, meshes in part_objects.items():
    parent = (mount_empty  if name == "cannon"
              else turret_empty if name == "turret"
              else root)
    for m in meshes:
        reparent(m, parent)

print("[CubePart] Hierarchy:")
print(f"  Sketchfab_model")
print(f"  ├── hull:   {len(part_objects.get('hull',   []))} mesh(es)")
print(f"  ├── tracks: {len(part_objects.get('tracks', []))} mesh(es)")
print(f"  └── turret empty {tuple(round(v,3) for v in turret_empty.location)}")
print(f"      ├── turret: {len(turret_meshes)} mesh(es)")
print(f"      └── mount  {tuple(round(v,3) for v in mount_empty.location)}")
print(f"          └── cannon: {len(cannon_meshes)} mesh(es)")

# 7. Export
os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT_PATH,
    export_format='GLB',
    use_selection=False,
    export_apply=False,
)
print(f"[CubePart] Exported → {OUT_PATH}")
print("[CubePart] Checklist:")
print("  [ ] Open GLB in Blender — verify turret/mount empty positions visually")
print("  [ ] Copy to game/public/assets/models/tanks/<name>.glb")
print("  [ ] Add manifest entry (architecture/MODEL_IMPORT.md Step 7)")
print("  [ ] T key in game inspector — confirm turretPivot.y > 0.3 in console")
