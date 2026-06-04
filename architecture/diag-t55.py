"""diag-t55.py — print T-55 GLB orientation info (no output files written)"""
import bpy, sys, math
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

src = '/Users/cliowu/claude-workspace/game/public/models/t-55ak.glb'
bpy.ops.import_scene.gltf(filepath=src)

sketchfab_root = bpy.data.objects.get('Sketchfab_model')
turret_empty   = bpy.data.objects.get('turret')
mount_empty    = bpy.data.objects.get('mount')

print(f"\n=== T-55AK diagnostic ===")
print(f"Sketchfab_model rotation: {tuple(round(math.degrees(r),1) for r in sketchfab_root.rotation_euler)}")

# Collect ALL mesh bbox corners with NO extra rotation
pts = []
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"Mesh count: {len(meshes)}")
for obj in meshes:
    for corner in obj.bound_box:
        pts.append(obj.matrix_world @ Vector(corner))

min_x = min(p.x for p in pts);  max_x = max(p.x for p in pts)
min_y = min(p.y for p in pts);  max_y = max(p.y for p in pts)
min_z = min(p.z for p in pts);  max_z = max(p.z for p in pts)
print(f"Mesh world bbox (no extra rotation):")
print(f"  X: {min_x:.3f} to {max_x:.3f}  (span {max_x-min_x:.3f})")
print(f"  Y: {min_y:.3f} to {max_y:.3f}  (span {max_y-min_y:.3f})")
print(f"  Z: {min_z:.3f} to {max_z:.3f}  (span {max_z-min_z:.3f})")

print(f"\nturret empty world pos: {tuple(round(v,3) for v in turret_empty.matrix_world.translation)}")
if mount_empty:
    print(f"mount empty world pos:  {tuple(round(v,3) for v in mount_empty.matrix_world.translation)}")

# Which axis has the SMALLEST span? That is likely height (a tank is wide and long but short)
spans = {'X': max_x-min_x, 'Y': max_y-min_y, 'Z': max_z-min_z}
shortest = min(spans, key=spans.get)
print(f"\nShortest axis (likely height): {shortest} span={spans[shortest]:.3f}")
print(f"Longest axis (likely length):  {max(spans, key=spans.get)} span={max(spans.values()):.3f}")
print(f"Middle axis (likely width):    {sorted(spans, key=spans.get)[1]} span={sorted(spans.values())[1]:.3f}")

# Check where turret ring is relative to hull bottom on each axis
tr = turret_empty.matrix_world.translation
print(f"\nTurret ring relative to bbox min on each axis:")
print(f"  X: ring={tr.x:.3f}  min={min_x:.3f}  diff={tr.x-min_x:.3f}")
print(f"  Y: ring={tr.y:.3f}  min={min_y:.3f}  diff={tr.y-min_y:.3f}")
print(f"  Z: ring={tr.z:.3f}  min={min_z:.3f}  diff={tr.z-min_z:.3f}")
print()
