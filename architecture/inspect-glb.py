"""inspect-glb.py — full structural inspection of a Sketchfab tank GLB before extraction.
Reports: Sketchfab_model rotation, empties (turret/mount?), mesh bbox + orientation,
and every mesh with its material (for the hull/turret split + paint config).

Usage: blender --background --python architecture/inspect-glb.py -- <path-to.glb>
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
src = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)

print(f"\n################ INSPECT {src} ################")

# --- key roots / empties ---
sk = bpy.data.objects.get('Sketchfab_model')
if sk:
    r = sk.rotation_euler
    print(f"Sketchfab_model rotation (deg): ({math.degrees(r.x):.1f}, {math.degrees(r.y):.1f}, {math.degrees(r.z):.1f})")
else:
    print("NO Sketchfab_model root!")

empties = [o for o in bpy.data.objects if o.type == 'EMPTY']
print(f"\nEMPTIES ({len(empties)}):")
for e in sorted(empties, key=lambda o: o.name):
    p = e.matrix_world.translation
    print(f"  {e.name:28s} world=({p.x:.2f},{p.y:.2f},{p.z:.2f}) parent={e.parent.name if e.parent else None}")

turret_e = bpy.data.objects.get('turret')
mount_e  = bpy.data.objects.get('mount')
print(f"\nHas 'turret' empty: {turret_e is not None}   Has 'mount' empty: {mount_e is not None}")

# --- overall mesh bbox (no extra rotation) ---
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
pts = []
for o in meshes:
    for c in o.bound_box:
        pts.append(o.matrix_world @ Vector(c))
if pts:
    xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
    print(f"\nMesh world bbox (as-imported):")
    print(f"  X {min(xs):.2f}..{max(xs):.2f} span={max(xs)-min(xs):.2f}")
    print(f"  Y {min(ys):.2f}..{max(ys):.2f} span={max(ys)-min(ys):.2f}")
    print(f"  Z {min(zs):.2f}..{max(zs):.2f} span={max(zs)-min(zs):.2f}")
    spans={'X':max(xs)-min(xs),'Y':max(ys)-min(ys),'Z':max(zs)-min(zs)}
    print(f"  longest(length)={max(spans,key=spans.get)} shortest(height?)={min(spans,key=spans.get)}")

# --- helper: collect descendants of an empty ---
def descendants(obj):
    out=[]
    for c in obj.children:
        out.append(c); out.extend(descendants(c))
    return out

if turret_e:
    tdesc = [o for o in descendants(turret_e) if o.type=='MESH']
    print(f"\nMeshes UNDER 'turret' empty ({len(tdesc)}): {[o.name for o in tdesc]}")
if mount_e:
    mdesc = [o for o in descendants(mount_e) if o.type=='MESH']
    print(f"Meshes UNDER 'mount' empty ({len(mdesc)}): {[o.name for o in mdesc]}")

# --- all meshes with material + tri count (for paint config) ---
print(f"\nALL MESHES ({len(meshes)}):  name | material | verts")
for o in sorted(meshes, key=lambda o:o.name):
    mat = o.data.materials[0].name if o.data.materials else '(none)'
    print(f"  {o.name:34s} | {mat:34s} | {len(o.data.vertices)}")
print("\n################ END ################\n")
