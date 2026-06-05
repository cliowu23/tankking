"""
extract-t44.py — T-44-100 extraction with ADAPTIVE gun handling.

The source GLB has no rig empties, UUID materials, and fuses mantlet+barrel+breech into one
mesh (Object_11). Instead of hand-dialing the barrel mount, we DERIVE it from geometry:

  TURRET:
    * Measure the gun-bore centroid (a thin slice of Object_11 just behind the mantlet) =
      the trunnion. Bake a `mount` empty there so the runtime reads the barrel mount from the
      GLB (like the M26), instead of a hardcoded constant — correct height + depth for free.
    * Double-bisect Object_11: keep only the external mantlet shield (drop the barrel tube in
      front and the breech/cradle behind, which was making the rectangular hole).
    * fill_holes + recalc normals so cuts never leave see-through gaps.
  HULL:
    * everything except turret + gun meshes (headlights Object_21 included here).

Both parts are centered on the turret-ring (dome) XY so they align; scaled by 0.92; no mesh
rotation (standard orientation).

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
BARREL_CUT = -1.6   # mantlet front (drop barrel tube ahead of this, -Y)
BREECH_CUT = -1.05  # mantlet back  (drop breech/cradle behind this, +Y)
TURRET = ['Object_2','Object_3','Object_9','Object_12','Object_13','Object_20']  # + mantlet of 11
GUN    = ['Object_11','Object_5']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=SRC)

dome = bpy.data.objects['Object_12']
dp = [dome.matrix_world @ Vector(c) for c in dome.bound_box]
ring_x = (min(p.x for p in dp)+max(p.x for p in dp))/2
ring_y = (min(p.y for p in dp)+max(p.y for p in dp))/2
print(f"[t44] ring center XY = ({ring_x:.3f},{ring_y:.3f})")

all_meshes = [o for o in bpy.data.objects if o.type=='MESH']
sk = bpy.data.objects.get('Sketchfab_model') or next(o for o in bpy.data.objects if o.type=='EMPTY' and o.parent is None)

if PART == 'turret':
    o11 = bpy.data.objects['Object_11']
    # 1. measure bore/trunnion centroid (thin slice just behind the mantlet front), world coords
    bore_pts = [o11.matrix_world @ v.co for v in o11.data.vertices
                if BARREL_CUT-0.15 <= (o11.matrix_world @ v.co).y <= BARREL_CUT+0.05]
    bore = sum(bore_pts, Vector((0,0,0))) / max(1, len(bore_pts))
    print(f"[t44] bore/trunnion centroid (source) = ({bore.x:.3f},{bore.y:.3f},{bore.z:.3f}) from {len(bore_pts)} verts")

    # 2. double-bisect Object_11 -> keep only mantlet shield [BARREL_CUT, BREECH_CUT]
    bpy.ops.object.select_all(action='DESELECT'); o11.select_set(True); bpy.context.view_layer.objects.active=o11
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0,BARREL_CUT,0), plane_no=(0,1,0), use_fill=True, clear_inner=True)   # drop barrel
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0,BREECH_CUT,0), plane_no=(0,1,0), use_fill=True, clear_outer=True)    # drop breech
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.fill_holes(sides=0)   # cap any remaining open boundary
    bpy.ops.object.mode_set(mode='OBJECT')

    # 3. bake a 'mount' empty at the trunnion, parented to Sketchfab_model so it rides the PART_ROOT transform
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(bore.x, bore.y, bore.z))
    mnt = bpy.context.active_object; mnt.name='mount'
    mnt.parent = sk; mnt.matrix_parent_inverse = sk.matrix_world.inverted()

    keep = set(TURRET + ['Object_11'])
else:
    keep = set(o.name for o in all_meshes) - set(TURRET) - set(GUN)

for o in [o for o in all_meshes if o.name not in keep]:
    bpy.data.objects.remove(o, do_unlink=True)
kept = [o for o in bpy.data.objects if o.type=='MESH']
print(f"[t44] {PART}: kept {len(kept)} meshes: {sorted(o.name for o in kept)}")

# merge coincident verts (connects fill/cut caps to the shell) then recalc normals outward,
# so the cut caps orient correctly instead of rendering dark/inward.
for o in kept:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0006)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

# PART_ROOT center + scale (no mesh rotation)
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

# report mount in Babylon coords (Blender X,Y,Z -> Babylon X, Z, -Y)
m = bpy.data.objects.get('mount')
if m:
    w = m.matrix_world.translation
    print(f"[t44] mount empty (Babylon) = ({w.x:.3f}, {w.z:.3f}, {-w.y:.3f})")

for o in bpy.data.objects:
    if o.type=='MESH' and o.data: o.data.name=o.name
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=False)
print(f"[t44] exported -> {OUT}")
