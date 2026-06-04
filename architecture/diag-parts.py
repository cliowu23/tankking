"""diag-parts.py — check orientation of extracted hull/turret GLBs"""
import bpy, sys, math
from mathutils import Vector

def check_glb(path, label):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    bpy.ops.import_scene.gltf(filepath=path)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    empties = [o for o in bpy.data.objects if o.type == 'EMPTY']

    pts = []
    for obj in meshes:
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))

    if not pts:
        print(f"\n[{label}] NO MESHES FOUND")
        return

    min_x = min(p.x for p in pts); max_x = max(p.x for p in pts)
    min_y = min(p.y for p in pts); max_y = max(p.y for p in pts)
    min_z = min(p.z for p in pts); max_z = max(p.z for p in pts)

    print(f"\n=== {label} ===")
    print(f"Meshes: {len(meshes)}, Empties: {[e.name for e in empties]}")
    print(f"Bbox X: {min_x:.3f} to {max_x:.3f}  span={max_x-min_x:.3f}")
    print(f"Bbox Y: {min_y:.3f} to {max_y:.3f}  span={max_y-min_y:.3f}")
    print(f"Bbox Z: {min_z:.3f} to {max_z:.3f}  span={max_z-min_z:.3f}")

    for e in empties:
        if e.name in ('turret', 'mount', 'PART_ROOT', 'Sketchfab_model'):
            p = e.matrix_world.translation
            r = e.rotation_euler
            s = e.scale
            print(f"  {e.name}: pos=({p.x:.3f},{p.y:.3f},{p.z:.3f})  rot=({math.degrees(r.x):.1f},{math.degrees(r.y):.1f},{math.degrees(r.z):.1f})  scale=({s.x:.4f},{s.y:.4f},{s.z:.4f})")

base = '/Users/cliowu/claude-workspace/game/public/models/parts/'
check_glb(base + 'hull-t55.glb', 'hull-t55')
check_glb(base + 'turret-t55.glb', 'turret-t55')
check_glb(base + 'hull-m26.glb', 'hull-m26')
check_glb(base + 'turret-m26.glb', 'turret-m26')
print()
