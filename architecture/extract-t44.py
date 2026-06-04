"""
extract-t44.py — T-44-100 extraction with mantlet/barrel bisect + normal repair.

The source GLB has no rig empties, UUID materials, and fuses the mantlet+barrel into one
mesh (Object_11). This script:
  * bisects Object_11 at y=CUT_Y so the mantlet (+breech) stays with the turret and the
    barrel tube is dropped (the swappable barrel is the existing cannon-100mm part);
  * moves the headlights (Object_21) to the hull (they were wrongly on the turret);
  * recalculates normals outward (fixes the see-through meshes — inward normals);
  * centers both parts on the turret-ring (dome) XY so they align, scales by 0.92.

Usage:
  blender --background --python architecture/extract-t44.py -- turret public/models/parts/turret-t44.glb
  blender --background --python architecture/extract-t44.py -- hull   public/models/parts/hull-t44.glb
"""
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
PART, OUT = argv[0], os.path.abspath(argv[1])

SRC   = os.path.abspath('public/models/t-44-100_war_thunder.glb')
SCALE = 0.92
CUT_Y = -1.6
TURRET = ['Object_2','Object_3','Object_9','Object_12','Object_13','Object_20']  # + mantlet of 11
GUN    = ['Object_11','Object_5']   # gun (Object_11 bisected for turret; both dropped from hull)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=SRC)

# ring center = dome (Object_12) footprint center, in world space, before any edits
dome = bpy.data.objects['Object_12']
dp = [dome.matrix_world @ Vector(c) for c in dome.bound_box]
ring_x = (min(p.x for p in dp)+max(p.x for p in dp))/2
ring_y = (min(p.y for p in dp)+max(p.y for p in dp))/2
print(f"[t44] ring center XY = ({ring_x:.3f},{ring_y:.3f})")

all_meshes = [o for o in bpy.data.objects if o.type=='MESH']

if PART == 'turret':
    # bisect Object_11 -> keep mantlet (+breech), drop barrel tube (y < CUT_Y)
    o11 = bpy.data.objects['Object_11']
    bpy.ops.object.select_all(action='DESELECT'); o11.select_set(True); bpy.context.view_layer.objects.active=o11
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0,CUT_Y,0), plane_no=(0,1,0), use_fill=True, clear_inner=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    keep = set(TURRET + ['Object_11'])
else:  # hull = everything except turret + gun
    keep = set(o.name for o in all_meshes) - set(TURRET) - set(GUN)

for o in [o for o in all_meshes if o.name not in keep]:
    bpy.data.objects.remove(o, do_unlink=True)
kept = [o for o in bpy.data.objects if o.type=='MESH']
print(f"[t44] {PART}: kept {len(kept)} meshes: {sorted(o.name for o in kept)}")

# recalc normals outward (repairs see-through meshes caused by inward normals)
for o in kept:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

# PART_ROOT center + scale (no mesh rotation — standard orientation)
sk = bpy.data.objects.get('Sketchfab_model') or next(o for o in bpy.data.objects if o.type=='EMPTY' and o.parent is None)
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0)); pr=bpy.context.active_object; pr.name='PART_ROOT'
sk.parent = pr; sk.matrix_parent_inverse = pr.matrix_world.inverted()
pr.scale = (SCALE, SCALE, SCALE)
bpy.context.view_layer.update()

pts=[]
for o in kept:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
min_z = min(p.z for p in pts)
pr.location = Vector((-ring_x*SCALE, -ring_y*SCALE, -min_z))
bpy.context.view_layer.update()

pts=[]
for o in kept:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
bx=(min(p.x for p in pts),max(p.x for p in pts)); by=(min(p.y for p in pts),max(p.y for p in pts)); bz=(min(p.z for p in pts),max(p.z for p in pts))
print(f"[t44] final Babylon dims: width={bx[1]-bx[0]:.2f} height={bz[1]-bz[0]:.2f} length={by[1]-by[0]:.2f}")

for o in bpy.data.objects:
    if o.type=='MESH' and o.data: o.data.name=o.name
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=False)
print(f"[t44] exported -> {OUT}")
