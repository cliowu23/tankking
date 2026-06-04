"""
extract-bymesh.py — extract a hull or turret part from a GLB that has NO turret/mount empties
(e.g. web-optimized / materialmerged Sketchfab rips). You classify the meshes by name; the
turret ring is computed from the turret meshes' footprint.

Use when inspect-glb.py reports "Has 'turret' empty: False". For models WITH empties, use
extract-parts.py instead.

Usage (Blender headless):
  blender --background --python architecture/extract-bymesh.py -- \\
    --src public/models/t-44-100_war_thunder.glb --part turret --scale 0.92 \\
    --turret Object_2,Object_3,Object_9,Object_12,Object_13,Object_20,Object_21 \\
    --gun Object_5,Object_11 \\
    --out public/models/parts/turret-t44.glb

Rules (mirrors the M26 'HARD-WON RULES'):
  * NO mesh rotation / transform_apply — the model is already in standard Blender Z-up
    orientation (height along Z, gun along -Y), which the glTF exporter converts to Babylon
    Y-up with the gun on +Z (game-forward). Touching the verts would break that.
  * Parent Sketchfab_model to a PART_ROOT empty; set scale + centering on the EMPTY only.
  * Centering: both hull and turret are centered on the TURRET-RING XY (so they align when
    composed), grounded on their own lowest point in Z.
  * Gun meshes are removed from BOTH parts (the gun is a separate swappable cannon).
  * Fix obj.data.name = obj.name so glTF mesh names match for paintSkipMeshes.
"""
import bpy, sys, os, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--part", required=True, choices=["hull","turret"])
ap.add_argument("--turret", required=True, help="comma list of turret mesh names")
ap.add_argument("--gun", default="", help="comma list of gun mesh names (removed from both)")
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--out", required=True)
args = ap.parse_args(argv)

turret_names = set(n for n in args.turret.split(",") if n)
gun_names    = set(n for n in args.gun.split(",") if n)
src = os.path.abspath(args.src); out = os.path.abspath(args.out)
print(f"\n[extract-bymesh] src={src} part={args.part} scale={args.scale}")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)

all_meshes = [o for o in bpy.data.objects if o.type=='MESH']
all_names  = set(o.name for o in all_meshes)
turret_objs = [o for o in all_meshes if o.name in turret_names]
if not turret_objs:
    raise RuntimeError(f"No turret meshes matched. Available: {sorted(all_names)}")

# Ring center XY = footprint center of the turret meshes (Blender X,Y).
tpts=[]
for o in turret_objs:
    for c in o.bound_box: tpts.append(o.matrix_world @ Vector(c))
ring_x = (min(p.x for p in tpts)+max(p.x for p in tpts))/2
ring_y = (min(p.y for p in tpts)+max(p.y for p in tpts))/2
print(f"[extract-bymesh] ring center XY (Blender) = ({ring_x:.3f}, {ring_y:.3f})")

# Decide which meshes to KEEP
if args.part == "turret":
    keep = turret_names
else:  # hull = everything except turret + gun
    keep = all_names - turret_names - gun_names
remove = [o for o in all_meshes if o.name not in keep]
for o in remove:
    bpy.data.objects.remove(o, do_unlink=True)
kept = [o for o in bpy.data.objects if o.type=='MESH']
print(f"[extract-bymesh] kept {len(kept)} meshes: {sorted(o.name for o in kept)}")

# PART_ROOT (identity), parent Sketchfab_model
sk = bpy.data.objects.get("Sketchfab_model") or next((o for o in bpy.data.objects if o.type=='EMPTY' and o.parent is None), None)
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
part_root = bpy.context.active_object; part_root.name="PART_ROOT"
sk.parent = part_root
sk.matrix_parent_inverse = part_root.matrix_world.inverted()

# Scale on the empty, then recompute, then center.
part_root.scale = (args.scale, args.scale, args.scale)
bpy.context.view_layer.update()

pts=[]
for o in kept:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
min_z = min(p.z for p in pts)
# centering target: ring XY (scaled) + own ground Z
center = Vector((ring_x*args.scale, ring_y*args.scale, min_z))
part_root.location = -center
bpy.context.view_layer.update()

# report final bbox + deck height (turret base above hull bottom) for ringCenter dialing
pts=[]
for o in kept:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
bx=(min(p.x for p in pts),max(p.x for p in pts))
by=(min(p.y for p in pts),max(p.y for p in pts))
bz=(min(p.z for p in pts),max(p.z for p in pts))
print(f"[extract-bymesh] final bbox  X{bx[0]:.2f}..{bx[1]:.2f}  Y{by[0]:.2f}..{by[1]:.2f}  Z{bz[0]:.2f}..{bz[1]:.2f}")
print(f"[extract-bymesh]   -> Babylon: width(X)={bx[1]-bx[0]:.2f} height(Z->Y)={bz[1]-bz[0]:.2f} length(Y->Z)={by[1]-by[0]:.2f}")
if args.part == "turret":
    # turret base sits at Blender Z = min (0 after centering). turret tris of the ring at XY origin.
    tz = [p.z for p in pts]
    print(f"[extract-bymesh]   turret base Z(min)≈{min(tz):.2f} top≈{max(tz):.2f}  (ring at XY origin)")

# Fix mesh data names for glTF (paintSkipMeshes matching)
for o in bpy.data.objects:
    if o.type=='MESH' and o.data: o.data.name=o.name

os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=False)
print(f"[extract-bymesh] exported -> {out}\n")
