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


cyl('gun_sleeve', P['sleeveR'], P['sleeveL'], P['sleeveL'] / 2)
cyl('gun_tube', P['tubeR'], TUBE_L, TUBE_L / 2)
# Double-baffle muzzle brake: two discs + connecting core + muzzle cap
b = P['brakeLen']
cyl('gun_brake_baffle_1', P['baffleR'], 0.09, TUBE_L + b * 0.24)
cyl('gun_brake_baffle_2', P['baffleR'], 0.09, TUBE_L + b * 0.71)
cyl('gun_brake_core', P['tubeR'] + 0.01, b, TUBE_L + b / 2, verts=12)
cyl('gun_muzzle_cap', 0.10, 0.10, TUBE_L + b, verts=12)

finalize_and_export('player_gun_90mm')
