"""
extract-m26-turret.py — re-extract the M26 turret INCLUDING its mantlet shield.

The original turret/barrel split kept only the gun tube for cannon-90mm and discarded the
mantlet (it's fused into the gun mesh Object_22), so the composed M26 lost the mantlet detail.
This restores it the same way the T-44 does: bisect Object_22, keep the mantlet shield with the
turret, drop the tube (front) and breech (rear). A `mount` empty is baked at the measured gun
bore (the trunnion) so the barrel mount is correct + adaptive.

M26 is standard orientation (Sketchfab rot 0, gun along -Y), scale 0.8715, and HAS turret/mount
empties — we center on the turret-ring empty (XY) + ground (Z) to match the existing part.

Usage:
  blender --background --python architecture/extract-m26-turret.py -- public/assets/models/tanks/parts/turret-m26.glb
"""
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
OUT = os.path.abspath(argv[0])

SRC   = os.path.abspath('public/assets/models/tanks/m26_pershing_war_thunder.glb')
SCALE = 0.8715
BARREL_CUT = -2.1     # mantlet front / barrel breech
BREECH_CUT = -1.1     # mantlet back
TURRET = ['Object_2','Object_3','Object_5','Object_7','Object_9','Object_10','Object_19','Object_21','Object_23']
GUN    = ['Object_22']   # mantlet+tube+muzzle (bisected); Object_23 = MG bits, kept whole

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=SRC)
bpy.context.view_layer.update()   # force matrix_world eval before reading empties

# ring center = the 'turret' empty; used so the turret origin matches the existing part
t_emp = bpy.data.objects['turret']
ring = t_emp.matrix_world.translation.copy()
ring_x, ring_y = ring.x, ring.y
print(f"[m26] turret empty world = ({ring.x:.3f},{ring.y:.3f},{ring.z:.3f})")

# bore/trunnion centroid (slice of Object_22 just behind the mantlet front)
o22 = bpy.data.objects['Object_22']
bore_pts = [o22.matrix_world @ v.co for v in o22.data.vertices
            if BARREL_CUT-0.2 <= (o22.matrix_world @ v.co).y <= BARREL_CUT+0.05]
bore = sum(bore_pts, Vector((0,0,0))) / max(1, len(bore_pts))
print(f"[m26] ring XY=({ring_x:.3f},{ring_y:.3f})  bore=({bore.x:.3f},{bore.y:.3f},{bore.z:.3f})")

def edit_op(o, fn):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); fn(); bpy.ops.object.mode_set(mode='OBJECT')

# FLATTEN: the M26 nests meshes under the 'turret' empty; clear parents (keep world transform)
# and apply, so every mesh is free in world coords. Avoids transform_apply displacing children.
all_meshes = [o for o in bpy.data.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in all_meshes: o.select_set(True)
bpy.context.view_layer.objects.active = all_meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# bisect Object_22 -> keep mantlet shield [BARREL_CUT, BREECH_CUT] (now local == world)
edit_op(o22, lambda: (
    bpy.ops.mesh.bisect(plane_co=(0,BARREL_CUT,0), plane_no=(0,1,0), use_fill=True, clear_inner=True),
    bpy.ops.mesh.select_all(action='SELECT'),
    bpy.ops.mesh.bisect(plane_co=(0,BREECH_CUT,0), plane_no=(0,1,0), use_fill=True, clear_outer=True),
    bpy.ops.mesh.select_all(action='SELECT'),
    bpy.ops.mesh.fill_holes(sides=0)))

keep = set(TURRET + ['Object_22'])
for o in [o for o in all_meshes if o.name not in keep]:
    bpy.data.objects.remove(o, do_unlink=True)
kept = [o for o in bpy.data.objects if o.type=='MESH']
print(f"[m26] kept {len(kept)} meshes: {sorted(o.name for o in kept)}")

for o in kept:
    edit_op(o, lambda: (bpy.ops.mesh.remove_doubles(threshold=0.0006),
                        bpy.ops.mesh.normals_make_consistent(inside=False)))

# PART_ROOT: parent the flattened meshes, center on ring XY + ground Z, scale, no rotation
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0)); pr=bpy.context.active_object; pr.name='PART_ROOT'
for o in kept:
    o.parent = pr; o.matrix_parent_inverse = pr.matrix_world.inverted()
# remove the source 'mount'/'turret' empties (wrong frame) so only our baked mount remains
for nm in ('mount', 'turret'):
    e = bpy.data.objects.get(nm)
    if e: bpy.data.objects.remove(e, do_unlink=True)
# bake mount empty at the bore (trunnion), parented to PART_ROOT
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(bore.x, BARREL_CUT, bore.z))
mnt = bpy.context.active_object; mnt.name='mount'
mnt.parent = pr; mnt.matrix_parent_inverse = pr.matrix_world.inverted()
pr.scale = (SCALE, SCALE, SCALE)
# Center on the turret-ring empty (all axes) — matches how the existing part was placed, so
# the turret origin = the ring and the composition is unchanged (gun height ≈ 0.17 like before).
pr.location = -SCALE * Vector((ring.x, ring.y, ring.z))
bpy.context.view_layer.update()

m = bpy.data.objects.get('mount')
if m:
    w = m.matrix_world.translation
    print(f"[m26] mount (Babylon) = ({w.x:.3f}, {w.z:.3f}, {-w.y:.3f})")
pts=[]
for o in kept:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
bx=(min(p.x for p in pts),max(p.x for p in pts)); bz=(min(p.z for p in pts),max(p.z for p in pts)); byy=(min(p.y for p in pts),max(p.y for p in pts))
print(f"[m26] dims Babylon: width={bx[1]-bx[0]:.2f} height={bz[1]-bz[0]:.2f} length={byy[1]-byy[0]:.2f}")

for o in bpy.data.objects:
    if o.type=='MESH' and o.data: o.data.name=o.name
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=False)
print(f"[m26] exported -> {OUT}")
