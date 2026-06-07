"""Cross-section of the M26 gun (Object_22) along Y to find the mantlet/tube cut.
Blender Z-up: gun extends -Y. Mantlet = wide (near turret), tube = narrow (toward muzzle)."""
import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath='/Users/cliowu/claude-workspace/game/public/assets/models/tanks/m26_pershing_war_thunder.glb')
o = bpy.data.objects['Object_22']
buckets = {}
for v in o.data.vertices:
    w = o.matrix_world @ v.co
    b = round(w.y, 1)
    if b not in buckets: buckets[b] = [w.x, w.x, w.z, w.z]
    buckets[b][0]=min(buckets[b][0],w.x); buckets[b][1]=max(buckets[b][1],w.x)
    buckets[b][2]=min(buckets[b][2],w.z); buckets[b][3]=max(buckets[b][3],w.z)
ys=[ (o.matrix_world @ v.co).y for v in o.data.vertices ]
print(f"Object_22 Y {min(ys):.2f}..{max(ys):.2f}  (gun toward -Y)")
print("y | Xwidth | Zheight")
for b in sorted(buckets):
    xw=buckets[b][1]-buckets[b][0]; zh=buckets[b][3]-buckets[b][2]
    print(f"  {b:5.1f} | {xw:4.2f} | {zh:4.2f}")
