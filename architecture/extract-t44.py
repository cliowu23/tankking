"""
extract-t44.py — T-44-100 extraction (turret / hull / barrel) with ADAPTIVE gun handling.

The source GLB has no rig empties, UUID materials, and fuses mantlet+barrel+breech into one
mesh (Object_11). We DERIVE the barrel mount from geometry instead of hand-dialing it.

  turret: keep dome+cupola+hatches + the mantlet SHIELD (bisect Object_11, drop barrel & breech).
          Bake a `mount` empty at the measured gun-bore centroid (the trunnion).
  barrel: keep just the gun TUBE (Object_11 front of the cut) + muzzle (Object_5), centered so
          the breech sits at the origin and the tube runs +Z — this is the T-44's own cannon,
          so it fits the T-44 mantlet exactly (the T-55 barrel did not).
  hull:   everything except turret + gun.

All parts: merge coincident verts + recalc normals outward (no see-through / dark caps),
scale 0.92, no mesh rotation (standard orientation).

Usage:
  blender --background --python architecture/extract-t44.py -- turret public/models/parts/turret-t44.glb
  blender --background --python architecture/extract-t44.py -- barrel public/models/parts/barrel-t44-100mm.glb
  blender --background --python architecture/extract-t44.py -- hull   public/models/parts/hull-t44.glb
"""
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
PART, OUT = argv[0], os.path.abspath(argv[1])

SRC   = os.path.abspath('public/models/t-44-100_war_thunder.glb')
SCALE = 0.92
BARREL_CUT = -1.6     # mantlet front / barrel breech
BREECH_CUT = -1.05    # mantlet back
TURRET = ['Object_2','Object_3','Object_9','Object_12','Object_13','Object_20']
GUN    = ['Object_11','Object_5']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=SRC)

dome = bpy.data.objects['Object_12']
dp = [dome.matrix_world @ Vector(c) for c in dome.bound_box]
ring_x = (min(p.x for p in dp)+max(p.x for p in dp))/2
ring_y = (min(p.y for p in dp)+max(p.y for p in dp))/2

# bore/trunnion centroid (slice of Object_11 just behind the mantlet front)
o11 = bpy.data.objects['Object_11']
bore_pts = [o11.matrix_world @ v.co for v in o11.data.vertices
            if BARREL_CUT-0.15 <= (o11.matrix_world @ v.co).y <= BARREL_CUT+0.05]
bore = sum(bore_pts, Vector((0,0,0))) / max(1, len(bore_pts))
print(f"[t44] ring XY=({ring_x:.3f},{ring_y:.3f})  bore=({bore.x:.3f},{bore.y:.3f},{bore.z:.3f})")

all_meshes = [o for o in bpy.data.objects if o.type=='MESH']
sk = bpy.data.objects.get('Sketchfab_model') or next(o for o in bpy.data.objects if o.type=='EMPTY' and o.parent is None)

def edit_op(o, fn):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); fn(); bpy.ops.object.mode_set(mode='OBJECT')

part_center = None   # source-space point that maps to the GLB origin
ground = False       # hull/turret ground on min-Z; barrel centers on the breech

if PART == 'turret':
    bpy.ops.object.select_all(action='DESELECT'); o11.select_set(True); bpy.context.view_layer.objects.active=o11
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    edit_op(o11, lambda: (
        bpy.ops.mesh.bisect(plane_co=(0,BARREL_CUT,0), plane_no=(0,1,0), use_fill=True, clear_inner=True),
        bpy.ops.mesh.select_all(action='SELECT'),
        bpy.ops.mesh.bisect(plane_co=(0,BREECH_CUT,0), plane_no=(0,1,0), use_fill=True, clear_outer=True),
        bpy.ops.mesh.select_all(action='SELECT'),
        bpy.ops.mesh.fill_holes(sides=0)))
    # Mount empty on the CUT PLANE (same reference the barrel breech uses), not the slice
    # centroid — the centroid biases ~0.09 forward and floats the barrel. X/Z stay measured.
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(bore.x, BARREL_CUT, bore.z))
    mnt = bpy.context.active_object; mnt.name='mount'
    mnt.parent = sk; mnt.matrix_parent_inverse = sk.matrix_world.inverted()
    keep = set(TURRET + ['Object_11'])
    ground = True
elif PART == 'barrel':
    bpy.ops.object.select_all(action='DESELECT'); o11.select_set(True); bpy.context.view_layer.objects.active=o11
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    edit_op(o11, lambda: bpy.ops.mesh.bisect(plane_co=(0,BARREL_CUT,0), plane_no=(0,1,0),
                                             use_fill=True, clear_outer=True))   # keep tube (y<cut)
    keep = {'Object_11','Object_5'}
    part_center = Vector((bore.x, BARREL_CUT, bore.z))   # breech bore -> GLB origin
else:  # hull
    keep = set(o.name for o in all_meshes) - set(TURRET) - set(GUN)
    ground = True

for o in [o for o in all_meshes if o.name not in keep]:
    bpy.data.objects.remove(o, do_unlink=True)
kept = [o for o in bpy.data.objects if o.type=='MESH']
print(f"[t44] {PART}: kept {len(kept)} meshes: {sorted(o.name for o in kept)}")

for o in kept:
    edit_op(o, lambda: (bpy.ops.mesh.remove_doubles(threshold=0.0006),
                        bpy.ops.mesh.normals_make_consistent(inside=False)))

bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0)); pr=bpy.context.active_object; pr.name='PART_ROOT'
sk.parent = pr; sk.matrix_parent_inverse = pr.matrix_world.inverted()
pr.scale = (SCALE, SCALE, SCALE)
bpy.context.view_layer.update()

if ground:
    pts=[]
    for o in kept:
        for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
    min_z = min(p.z for p in pts)
    pr.location = Vector((-ring_x*SCALE, -ring_y*SCALE, -min_z))
else:  # barrel: breech -> origin
    pr.location = -SCALE * part_center
bpy.context.view_layer.update()

m = bpy.data.objects.get('mount')
if m:
    w = m.matrix_world.translation
    print(f"[t44] mount empty (Babylon) = ({w.x:.3f}, {w.z:.3f}, {-w.y:.3f})")
if PART == 'barrel':
    pts=[]
    for o in kept:
        for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
    # Babylon Z extent = -Blender Y range
    zmin = min(-p.y for p in pts); zmax = max(-p.y for p in pts)
    print(f"[t44] barrel Babylon Z (length) {zmin:.2f}..{zmax:.2f}")

for o in bpy.data.objects:
    if o.type=='MESH' and o.data: o.data.name=o.name
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=False)
print(f"[t44] exported -> {OUT}")
