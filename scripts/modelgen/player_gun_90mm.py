# player_gun_90mm — 90mm M3-inspired gun (M26 Pershing main armament), original mesh.
# Contract: breech face at origin, tube along Blender +Z (JS module rotates at runtime).
# Tunables come from params/player_tank.json (edited live by the Tank Tuner).
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, finalize_and_export, load_params
import bpy

P = {
    'tubeL': 2.90, 'tubeR': 0.075,
    'sleeveL': 0.95, 'sleeveR': 0.105,
    'baffleR': 0.165, 'brakeLen': 0.42,
}
P.update(load_params('player_tank', 'gun'))

clear_scene()
gun_mat = flat_material('gun_metal', (0.30, 0.30, 0.30, 1.0))  # runtime material overrides

TUBE_L = P['tubeL']


def cyl(name, r, depth, z, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(0, 0, z))
    o = bpy.context.object
    o.name = name
    assign(o, gun_mat)
    return o


from _lib import bevel

cyl('gun_sleeve', P['sleeveR'], P['sleeveL'], P['sleeveL'] / 2)
cyl('gun_tube', P['tubeR'], TUBE_L, TUBE_L / 2)

# Chambered double-baffle muzzle brake (tuning pass 2: "enhance the detail"):
# two thick rounded baffles, top+bottom frame plates closing the chambers so the
# side openings read, a core, and a stepped muzzle tip.
b = P['brakeLen']
R = P['baffleR']
z1, z2 = TUBE_L + b * 0.24, TUBE_L + b * 0.71
bevel(cyl('gun_brake_baffle_1', R, 0.11, z1), width=0.02, segments=2)
bevel(cyl('gun_brake_baffle_2', R, 0.11, z2), width=0.02, segments=2)
cyl('gun_brake_core', P['tubeR'] + 0.012, b, TUBE_L + b / 2, verts=12)
for i, y in ((0, R - 0.045), (1, -(R - 0.045))):     # frame plates → open side chambers
    bpy.ops.mesh.primitive_cube_add(location=(0, y, (z1 + z2) / 2))
    o = bpy.context.object
    o.name = f'gun_brake_frame_{i}'
    o.scale = (R * 0.74, 0.038, (z2 - z1) / 2 + 0.05)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, gun_mat)
bevel(cyl('gun_muzzle_step', R * 0.62, 0.10, TUBE_L + b + 0.03, verts=14), width=0.015, segments=2)
cyl('gun_muzzle_tip', P['tubeR'] * 0.78, 0.07, TUBE_L + b + 0.10, verts=12)

finalize_and_export('player_gun_90mm')
