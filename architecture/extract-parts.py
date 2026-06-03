"""
extract-parts.py — split a whole-tank Sketchfab GLB into hull or turret part GLBs.

Usage (Blender headless):
  blender --background --python architecture/extract-parts.py -- \\
    --src  public/models/t-55ak.glb \\
    --part hull \\
    --out  public/models/parts/hull-t55.glb

  blender --background --python architecture/extract-parts.py -- \\
    --src  public/models/t-55ak.glb \\
    --part turret \\
    --out  public/models/parts/turret-t55.glb

Extraction rules (hard-won — do NOT change without testing):
  • Never call transform_apply on any mesh.  Applying collapses the Sketchfab_model
    root's orientation correction and the part loads rotated 90° / on its side.
  • Only MESH objects are deleted; all EMPTY nodes (hull, turret, mount …) are kept
    so the coordinate hierarchy stays intact.
  • Centering is applied ONLY on a new PART_ROOT empty that the Sketchfab_model is
    re-parented to.  Hull: center at mesh bbox center.  Turret: center at the
    world position of the `turret` empty so the ring lands at (0,0,0).
  • Set obj.data.name = obj.name before export to avoid Blender writing .001 suffixes
    in glTF mesh names (breaks paintSkipMeshes keyword matching in Babylon).
  • Keep materials (no export_materials='NONE') so applyModelPaint can tint running gear.

After running:
  • Open the output GLB in Blender's Viewport and verify the part looks right.
  • Load it in the game designer — check that the mount empties produce sensible
    turretPivot / barrelPivot values in the browser console.
"""

import bpy
import sys
import os
import argparse
from mathutils import Vector

# ── Args ───────────────────────────────────────────────────────────────────────
if "--" in sys.argv:
    argv = sys.argv[sys.argv.index("--") + 1:]
else:
    argv = sys.argv[1:]

parser = argparse.ArgumentParser()
parser.add_argument("--src",  required=True, help="source GLB path (absolute or relative to CWD)")
parser.add_argument("--part", required=True, choices=["hull", "turret"],
                    help="which part to extract")
parser.add_argument("--out",  required=True, help="output GLB path")
args = parser.parse_args(argv)

src = os.path.abspath(args.src)
out = os.path.abspath(args.out)
print(f"\n[extract-parts] src={src}  part={args.part}  out={out}\n")

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_all_children(obj):
    """Return all recursive children of obj."""
    result = []
    for child in obj.children:
        result.append(child)
        result.extend(get_all_children(child))
    return result


def world_bbox_center(objects):
    """XYZ center of the world-space bounding box of all MESH objects in the list."""
    pts = []
    for obj in objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                pts.append(obj.matrix_world @ Vector(corner))
    if not pts:
        return Vector((0.0, 0.0, 0.0))
    return Vector((
        (min(p.x for p in pts) + max(p.x for p in pts)) / 2,
        (min(p.y for p in pts) + max(p.y for p in pts)) / 2,
        (min(p.z for p in pts) + max(p.z for p in pts)) / 2,
    ))


def remove_mesh(obj):
    """Delete a mesh object and unlink it from all collections."""
    bpy.data.objects.remove(obj, do_unlink=True)

# ── 1. Clean scene ─────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ── 2. Import whole-tank GLB ───────────────────────────────────────────────────
bpy.ops.import_scene.gltf(filepath=src)
all_imported = list(bpy.data.objects)
print(f"[extract-parts] Imported {len(all_imported)} objects total")

# ── 3. Find key empties ────────────────────────────────────────────────────────
turret_empty = bpy.data.objects.get("turret")
mount_empty  = bpy.data.objects.get("mount")

if turret_empty is None:
    raise RuntimeError(
        "No 'turret' empty found — the model's node names differ from expected. "
        "Check with: node -e \"...\" public/models/your-tank.glb"
    )
if mount_empty is None:
    print("[extract-parts] WARNING: no 'mount' empty found — turret part will have no barrel mount")

# ── 4. Delete meshes based on part ────────────────────────────────────────────
if args.part == "hull":
    # Keep: all hull/track/wheel/gear MESHES + the `turret` empty (mount marker)
    # Remove: any MESH that is a recursive child of `turret` (turret body + gun)
    # Empties are never touched — they carry the coordinate system.
    turret_children = get_all_children(turret_empty)
    removed = [o for o in turret_children if o.type == 'MESH']
    for obj in removed:
        remove_mesh(obj)
    print(f"[extract-parts] hull: removed {len(removed)} mesh(es) from turret/gun hierarchy")

elif args.part == "turret":
    # Keep: MESH objects that are recursive children of `turret` empty, EXCEPT
    #        those under `mount` (the gun meshes)
    # Remove: all other MESH objects (hull body, tracks, wheels, gear)
    # Also remove gun meshes under `mount`
    turret_set = set(id(o) for o in [turret_empty] + get_all_children(turret_empty))

    # Hull meshes — anything not in the turret hierarchy
    hull_meshes = [o for o in bpy.data.objects
                   if o.type == 'MESH' and id(o) not in turret_set]
    for obj in hull_meshes:
        remove_mesh(obj)
    print(f"[extract-parts] turret: removed {len(hull_meshes)} hull/track mesh(es)")

    # Gun meshes — children of mount empty
    if mount_empty:
        gun_meshes = [o for o in get_all_children(mount_empty) if o.type == 'MESH']
        for obj in gun_meshes:
            remove_mesh(obj)
        print(f"[extract-parts] turret: removed {len(gun_meshes)} gun mesh(es) from mount")

# ── 5. Find Sketchfab root ─────────────────────────────────────────────────────
sketchfab_root = bpy.data.objects.get("Sketchfab_model")
if sketchfab_root is None:
    top_level = [o for o in bpy.data.objects if o.parent is None and o.type == 'EMPTY']
    if len(top_level) == 1:
        sketchfab_root = top_level[0]
        print(f"[extract-parts] Sketchfab_model not found; using top-level empty '{sketchfab_root.name}'")
    else:
        raise RuntimeError(f"Cannot find Sketchfab_model. Top-level empties: {[o.name for o in top_level]}")

# ── 6. Compute centering ───────────────────────────────────────────────────────
remaining_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"[extract-parts] Remaining meshes ({len(remaining_meshes)}): "
      f"{[o.name for o in remaining_meshes]}")

if args.part == "hull":
    # Ground-center: X and Z at bbox center; Y at bbox MINIMUM (hull bottom).
    #
    # Axis note for Sketchfab T-55 (and similar models with -90°X Sketchfab_model rotation):
    #   Blender Y  =  height axis  (turret ring at Y≈1.5, track bottom at Y≈-1.5)
    #   Blender Z  =  depth axis   (front-to-back position)
    #   Blender X  =  lateral axis (left-right)
    #
    #   Babylon mapping from empirical measurement:
    #     Babylon X = -Blender X
    #     Babylon Y =  Blender Z   (depth → Babylon height; rings are near Z≈0)
    #     Babylon Z = -Blender Y   (height → Babylon depth, negated)
    #
    # Because Blender Y is the TRUE height axis but maps to Babylon -Z, the turretPivot
    # in assembleTank gets placed at the wrong axis.  The correct fix is to ensure the
    # turret empty's Babylon Z (= -Blender Y) is used for ring height, not Babylon Y.
    #
    # Ground-centering in Blender Y (hull bottom at Y=0) puts the hull in a consistent
    # position so that: Babylon -Z of turret empty = -(ring_blender_Y) = ring height above
    # hull bottom, which can be compared across different hulls for cross-mix calibration.
    pts = []
    for obj in remaining_meshes:
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))
    if pts:
        cx    = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
        min_y = min(p.y for p in pts)   # hull bottom (Blender Y = height axis)
        cz    = (min(p.z for p in pts) + max(p.z for p in pts)) / 2
        center = Vector((cx, min_y, cz))
    else:
        center = Vector((0.0, 0.0, 0.0))
        min_y = 0.0
    print(f"[extract-parts] hull ground-center: ({cx:.3f}, {min_y:.3f} [y-min=hull bottom], {cz:.3f})")

elif args.part == "turret":
    # Center at the turret ring (turret empty world position) so the ring lands at (0,0,0).
    # This lets assembleTank's barrelPivot offset be read directly from mount's absolute pos.
    center = turret_empty.matrix_world.translation.copy()
    print(f"[extract-parts] turret ring world pos: {tuple(round(v,3) for v in center)}")

print(f"[extract-parts] centering offset: {tuple(round(v,3) for v in -center)}")

# ── 7. Parent Sketchfab_model under PART_ROOT; apply offset via PART_ROOT only ─
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, 0.0))
part_root = bpy.context.active_object
part_root.name = "PART_ROOT"

# Parent without disturbing the existing world transform of Sketchfab_model.
# Since PART_ROOT is at origin with identity rotation, the inverse is identity
# and the child's local position = its old world position.
sketchfab_root.parent = part_root
sketchfab_root.matrix_parent_inverse = part_root.matrix_world.inverted()

# Move PART_ROOT to -center, which shifts the whole hierarchy by -center.
part_root.location = -center

# ── 8. Fix mesh names to avoid .001 Blender suffixes in glTF export ─────────────
# Without this, Blender may write mesh data-block names as "Object_4.001" in the
# glTF, which breaks paintSkipMeshes keyword matching in Babylon's applyModelPaint.
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data:
        obj.data.name = obj.name

# ── 9. Export ──────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=False,
    export_apply=False,   # NEVER apply transforms — see rules at top of file
)

final_objs = [o.name for o in bpy.data.objects]
print(f"\n[extract-parts] Exported → {out}")
print(f"[extract-parts] Objects in output: {final_objs}")
print(f"\nNext steps:")
print(f"  1. Open {out} in Blender — confirm the part looks right")
print(f"  2. Check browser console for turretPivot / barrelPivot values in the designer")
