"""mesh-bbox.py — per-mesh bbox dump for classifying turret vs hull when empties are missing.
Blender Z-up frame: X=width, Y=length(fwd/back), Z=height.
Usage: blender --background --python architecture/mesh-bbox.py -- <path.glb>
"""
import bpy, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
src = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.data.objects if o.type=='MESH']
# global height range
allz=[]
for o in meshes:
    for c in o.bound_box:
        allz.append((o.matrix_world @ Vector(c)).z)
zmin, zmax = min(allz), max(allz)
deck = zmin + 0.45*(zmax-zmin)   # rough deck line guess
print(f"\n#### MESH BBOX ({src}) ####")
print(f"global Z(height) {zmin:.2f}..{zmax:.2f}; rough deck guess @ {deck:.2f}")
print(f"{'name':12s} {'Xc':>6s} {'Yc':>6s} {'Zc':>6s} | {'Xsz':>5s} {'Ysz':>5s} {'Zsz':>5s} | {'Zmin':>6s} {'Zmax':>6s} verts  guess")
rows=[]
for o in sorted(meshes, key=lambda o:o.name):
    cs=[o.matrix_world @ Vector(c) for c in o.bound_box]
    xs=[c.x for c in cs]; ys=[c.y for c in cs]; zs=[c.z for c in cs]
    xc=(min(xs)+max(xs))/2; yc=(min(ys)+max(ys))/2; zc=(min(zs)+max(zs))/2
    xsz=max(xs)-min(xs); ysz=max(ys)-min(ys); zsz=max(zs)-min(zs)
    # heuristic: turret = sits mostly above deck; hull = spans low. spanBoth = crosses deck a lot
    above = min(zs) >= deck - 0.15
    spans_both = (min(zs) < deck - 0.3) and (max(zs) > deck + 0.5)
    guess = 'TURRET?' if above else ('SPANS-BOTH!' if spans_both else 'hull')
    print(f"{o.name:12s} {xc:6.2f} {yc:6.2f} {zc:6.2f} | {xsz:5.2f} {ysz:5.2f} {zsz:5.2f} | {min(zs):6.2f} {max(zs):6.2f} {len(o.data.vertices):5d}  {guess}")
print("#### END ####\n")
