"""
extract-parts.py — split a whole-tank Sketchfab GLB into hull or turret part GLBs.

Usage (Blender headless):
  blender --background --python architecture/extract-parts.py -- \\
    --src   public/assets/models/tanks/t-55ak.glb \\
    --part  hull \\
    --scale 0.7064 \\
    --out   public/assets/models/tanks/parts/hull-t55.glb

  blender --background --python architecture/extract-parts.py -- \\
    --src   public/assets/models/tanks/t-55ak.glb \\
    --part  turret \\
    --scale 0.7064 \\
    --out   public/assets/models/tanks/parts/turret-t55.glb

Pipeline (hard-won rules — do NOT change without understanding why):

  1.  Delete unwanted meshes by traversing the `turret`/`mount` empty hierarchy.
      Only MESH objects are deleted; all EMPTY nodes survive (they carry the coord system).

  2.  Create PART_ROOT at origin (identity transform), parent Sketchfab_model to it.
      matrix_parent_inverse = identity so world positions are preserved at this point.

  3.  Apply +90°X rotation and the tank's game scale to PART_ROOT.
      The +90°X corrects Sketchfab's -90°X import rotation so that in the exported GLB:
        Blender Z (= Babylon Y after glTF→Babylon import) = height axis  ✓
      Baking the scale into PART_ROOT means JS build() reads positions directly, like M26.

  4.  Compute the centering bbox in the NOW-ROTATED+SCALED world space, then set
      PART_ROOT.location = -center.  This order is critical — centering must happen after
      rotation+scale so that min-Z in Blender (= Babylon Y) really is the hull bottom.

  5.  Fix obj.data.name = obj.name to prevent Blender writing .001 glTF mesh-name suffixes
      that break paintSkipMeshes keyword matching.

  6.  Export with export_apply=False (NEVER apply transforms to meshes).

After running:
  • Check the browser console for turretPivot/barrelPivot values in the designer.
  • hull JS: use getAbsolutePosition() directly (no manual scale), same as hull-m26.js.
"""

import bpy, sys, os, math, argparse
from mathutils import Vector

# ── Args ────────────────────────────────────────────────────────────────────────
if "--" in sys.argv:
    argv = sys.argv[sys.argv.index("--") + 1:]
else:
    argv = sys.argv[1:]

parser = argparse.ArgumentParser()
parser.add_argument("--src",   required=True,  help="source GLB path")
parser.add_argument("--part",  required=True,  choices=["hull", "turret"])
parser.add_argument("--scale", type=float, default=1.0,
                    help="game scale to bake in (e.g. 0.7064 for T-55, 0.8715 for M26)")
parser.add_argument("--out",   required=True,  help="output GLB path")
args = parser.parse_args(argv)

src = os.path.abspath(args.src)
out = os.path.abspath(args.out)
print(f"\n[extract-parts] src={src}  part={args.part}  scale={args.scale}  out={out}\n")

# ── Helpers ──────────────────────────────────────────────────────────────────────

def get_all_children(obj):
    result = []
    for child in obj.children:
        result.append(child)
        result.extend(get_all_children(child))
    return result

def remove_mesh(obj):
    bpy.data.objects.remove(obj, do_unlink=True)

# ── 1. Clean scene ───────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ── 2. Import ────────────────────────────────────────────────────────────────────
bpy.ops.import_scene.gltf(filepath=src)
print(f"[extract-parts] Imported {len(bpy.data.objects)} objects total")

# ── 3. Find key empties ──────────────────────────────────────────────────────────
turret_empty = bpy.data.objects.get("turret")
mount_empty  = bpy.data.objects.get("mount")
if turret_empty is None:
    raise RuntimeError("No 'turret' empty found — check the model's node names")
if mount_empty is None:
    print("[extract-parts] WARNING: no 'mount' empty — turret part will have no barrel mount")

# ── 4. Delete meshes based on part ───────────────────────────────────────────────
if args.part == "hull":
    removed = [o for o in get_all_children(turret_empty) if o.type == 'MESH']
    for obj in removed:
        remove_mesh(obj)
    print(f"[extract-parts] hull: removed {len(removed)} turret/gun mesh(es)")

elif args.part == "turret":
    turret_set = set(id(o) for o in [turret_empty] + get_all_children(turret_empty))
    hull_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and id(o) not in turret_set]
    for obj in hull_meshes:
        remove_mesh(obj)
    print(f"[extract-parts] turret: removed {len(hull_meshes)} hull/track mesh(es)")
    if mount_empty:
        gun_meshes = [o for o in get_all_children(mount_empty) if o.type == 'MESH']
        for obj in gun_meshes:
            remove_mesh(obj)
        print(f"[extract-parts] turret: removed {len(gun_meshes)} gun mesh(es) from mount")

remaining_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"[extract-parts] Remaining: {len(remaining_meshes)} mesh(es)")

# ── 5. Find Sketchfab root ───────────────────────────────────────────────────────
sketchfab_root = bpy.data.objects.get("Sketchfab_model")
if sketchfab_root is None:
    tops = [o for o in bpy.data.objects if o.parent is None and o.type == 'EMPTY']
    if len(tops) == 1:
        sketchfab_root = tops[0]
    else:
        raise RuntimeError(f"Cannot find Sketchfab_model. Top-level empties: {[o.name for o in tops]}")

# ── 6. Create PART_ROOT (identity) and parent Sketchfab_model ────────────────────
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, 0.0))
part_root = bpy.context.active_object
part_root.name = "PART_ROOT"

# Parent at identity so matrix_parent_inverse = identity.
# That means child.local = child.world_old, and all later PART_ROOT changes
# are applied cleanly as: child.world_new = PART_ROOT.matrix_world × child.world_old
sketchfab_root.parent = part_root
sketchfab_root.matrix_parent_inverse = part_root.matrix_world.inverted()  # identity

# ── 7. Apply +90°X rotation and game scale to PART_ROOT ─────────────────────────
# +90°X cancels the -90°X net rotation in the Sketchfab hierarchy.
# After this: original model Y-axis (height) → Blender Z → Babylon Y. Same as M26.
# Game scale baked here so JS build() can use getAbsolutePosition() directly (no manual scaling).
part_root.rotation_euler = (0, 0, math.pi / 2)
# T-55 GLB axes (Sketchfab_model rotation = 0, no import correction):
#   original X = tank forward (gun points +X)
#   original Y = tank width
#   original Z = tank height (ground at Z≈0)
#
# Rz(+90°) maps: X→BlenderY→BabylonZ(forward) ✓
#                Y→Blender-X→BabylonX(width) ✓
#                Z→BlenderZ→BabylonY(height) ✓
part_root.scale = (args.scale, args.scale, args.scale)

# Force Blender to recompute all matrix_world values in the scene.
# Without this, child objects' matrix_world is stale (still reflects old PART_ROOT = identity)
# and the bbox computation below would return the un-rotated coordinates.
bpy.context.view_layer.update()

# ── 8. Compute centering in the ROTATED + SCALED world space ─────────────────────
# IMPORTANT: bbox must be computed AFTER rotation+scale are set so that
#   - Blender Z = Babylon Y = height axis (correct after the +90°X normalisation)
#   - coordinates are already at game scale
pts = []
for obj in remaining_meshes:
    for corner in obj.bound_box:
        pts.append(obj.matrix_world @ Vector(corner))

if pts:
    min_z = min(p.z for p in pts)  # Blender Z = Babylon Y = height; min = part base
else:
    min_z = 0.0

# The turret ring (turret_empty) is the single shared reference point.
ring_world = turret_empty.matrix_world.translation.copy()

if args.part == "hull":
    # Hull: center at hull BODY midpoint in XY (not ring — the T-55 ring empty is at
    # the left edge of the hull, not the center).  Ground at min_z.
    # hull-t55.js reads the ring position from mesh max Y at runtime.
    min_x = min(p.x for p in pts); max_x = max(p.x for p in pts)
    min_y = min(p.y for p in pts); max_y = max(p.y for p in pts)
    hull_cx = (min_x + max_x) / 2
    hull_cy = (min_y + max_y) / 2
    center = Vector((hull_cx, hull_cy, min_z))
    print(f"[extract-parts] hull body-center: cx={hull_cx:.3f} cy={hull_cy:.3f} z_min={min_z:.3f}")
elif args.part == "turret":
    # Turret: center at turret BODY midpoint in XY, ground at dome bottom (min_z).
    # The T-55 ring empty is NOT at the dome center — center at mesh midpoint instead.
    # BARREL_MOUNT in turret-t55.js places the cannon relative to the dome geometry.
    min_x = min(p.x for p in pts); max_x = max(p.x for p in pts)
    min_y = min(p.y for p in pts); max_y = max(p.y for p in pts)
    turret_cx = (min_x + max_x) / 2
    turret_cy = (min_y + max_y) / 2
    center = Vector((turret_cx, turret_cy, min_z))
    print(f"[extract-parts] turret center: full ring-center at {tuple(round(v,3) for v in center)}")

# Shift entire hierarchy so centering target lands at world origin
part_root.location = -center
print(f"[extract-parts] PART_ROOT location set to: {tuple(round(v,3) for v in part_root.location)}")

# ── 9. Fix mesh data-block names (prevents .001 suffix in glTF export) ───────────
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data:
        obj.data.name = obj.name

# ── 10. Export ───────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    export_apply=False,  # NEVER apply transforms to meshes
)
print(f"\n[extract-parts] Exported → {out}")
print(f"[extract-parts] Objects in export: {[o.name for o in bpy.data.objects]}")
