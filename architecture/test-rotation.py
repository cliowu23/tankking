"""Test what bbox results from different PART_ROOT rotations for T-55 hull."""
import bpy, sys, math
from mathutils import Vector

def test_rotation(rot_euler, label):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    bpy.ops.import_scene.gltf(filepath='/Users/cliowu/claude-workspace/game/public/assets/models/tanks/t-55ak.glb')

    turret_empty = bpy.data.objects.get('turret')
    sketchfab_root = bpy.data.objects.get('Sketchfab_model')

    # Remove turret meshes (hull extraction)
    def get_all_children(obj):
        r = []
        for c in obj.children:
            r.append(c)
            r.extend(get_all_children(c))
        return r
    removed = [o for o in get_all_children(turret_empty) if o.type == 'MESH']
    for obj in removed:
        bpy.data.objects.remove(obj, do_unlink=True)

    remaining = [o for o in bpy.data.objects if o.type == 'MESH']

    # Apply PART_ROOT rotation
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
    part_root = bpy.context.active_object
    part_root.name = 'PART_ROOT'
    sketchfab_root.parent = part_root
    sketchfab_root.matrix_parent_inverse = part_root.matrix_world.inverted()
    part_root.rotation_euler = rot_euler
    part_root.scale = (0.7064, 0.7064, 0.7064)
    bpy.context.view_layer.update()

    pts = []
    for obj in remaining:
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))

    if not pts:
        print(f"{label}: no meshes"); return

    min_x=min(p.x for p in pts); max_x=max(p.x for p in pts)
    min_y=min(p.y for p in pts); max_y=max(p.y for p in pts)
    min_z=min(p.z for p in pts); max_z=max(p.z for p in pts)

    ring_world = turret_empty.matrix_world.translation.copy()
    ring_z_above_bottom = ring_world.z - min_z

    print(f"\n{label}:")
    print(f"  Blender X={min_x:.2f}..{max_x:.2f} (span={max_x-min_x:.2f}) → Babylon X (width)")
    print(f"  Blender Y={min_y:.2f}..{max_y:.2f} (span={max_y-min_y:.2f}) → Babylon Z (length)")
    print(f"  Blender Z={min_z:.2f}..{max_z:.2f} (span={max_z-min_z:.2f}) → Babylon Y (height)")
    print(f"  Ring above hull bottom (=Babylon ring Y after grounding): {ring_z_above_bottom:.3f}")
    print(f"  Ring world pos: x={ring_world.x:.3f} y={ring_world.y:.3f} z={ring_world.z:.3f}")

pi = math.pi
test_rotation((pi/2, 0, 0),        "Rx(90)")
test_rotation((0, 0, pi/2),        "Rz(90)")
test_rotation((pi/2, 0, pi/2),     "Rx(90)+Rz(90) [current]")
test_rotation((pi/2, 0, -pi/2),    "Rx(90)+Rz(-90)")
test_rotation((0, pi/2, 0),        "Ry(90)")
test_rotation((-pi/2, 0, pi/2),    "Rx(-90)+Rz(90)")
print()
