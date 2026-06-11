# light_gun_75mm — 75mm M6-inspired gun (M24 Chaffee armament), Light doctrine.
# Breech face at origin, tube extends along Blender +Z.
# JS module rotates root.rotation.x = Math.PI/2 after parenting → tube along +Z forward.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, finalize_and_export, load_params, bevel
import bpy

P = {
    'tubeL': 2.10, 'tubeR': 0.062,
    'sleeveL': 0.72, 'sleeveR': 0.088,
    'baffleR': 0.148, 'brakeLen': 0.32,
}
P.update(load_params('light_tank', 'gun'))

clear_scene()
gun_mat = flat_material('gun_metal', (0.30, 0.30, 0.30, 1.0))

def cyl(name, r, depth, z, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(0, 0, z))
    o = bpy.context.object; o.name = name; assign(o, gun_mat)
    return o

TUBE_L = P['tubeL']
b      = P['brakeLen']
R      = P['baffleR']

# Breech sleeve + tube
cyl('gun_sleeve', P['sleeveR'], P['sleeveL'], P['sleeveL'] / 2)
cyl('gun_tube',   P['tubeR'],   TUBE_L,       TUBE_L / 2)

# Double-baffle muzzle brake
z1, z2 = TUBE_L + b * 0.22, TUBE_L + b * 0.68
bevel(cyl('gun_brake_baffle_1', R,        0.10, z1), width=0.018, segments=2)
bevel(cyl('gun_brake_baffle_2', R * 0.85, 0.10, z2), width=0.016, segments=2)
cyl('gun_brake_core', P['tubeR'] + 0.010, b, TUBE_L + b / 2, verts=10)
for i, y in ((0, R - 0.038), (1, -(R - 0.038))):
    bpy.ops.mesh.primitive_cube_add(location=(0, y, (z1 + z2) / 2))
    o = bpy.context.object; o.name = f'gun_brake_frame_{i}'
    o.scale = (R * 0.68, 0.030, (z2 - z1) / 2 + 0.042)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, gun_mat)
bevel(cyl('gun_muzzle_step', R * 0.56, 0.088, TUBE_L + b + 0.024, verts=12), width=0.012, segments=2)
cyl('gun_muzzle_tip', P['tubeR'] * 0.70, 0.055, TUBE_L + b + 0.082, verts=10)

finalize_and_export('light_gun_75mm')
