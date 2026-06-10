# medium_gun_50mm — 5cm KwK 39 L/60-inspired gun (Panzer III), original mesh.
# Slim long tube, slender recoil sleeve, small single-baffle muzzle brake.
# Contract: breech at origin, tube along Blender +Z (JS module rotates at runtime).
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, bevel, finalize_and_export, load_params
import bpy

P = {
    'tubeL': 2.3, 'tubeR': 0.055,
    'sleeveL': 0.7, 'sleeveR': 0.078,
    'baffleR': 0.10, 'brakeLen': 0.18,
}
P.update(load_params('medium_tank', 'gun'))

clear_scene()
gun_mat = flat_material('gun_metal', (0.30, 0.30, 0.30, 1.0))


def cyl(name, r, depth, z, verts=14):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(0, 0, z))
    o = bpy.context.object
    o.name = name
    assign(o, gun_mat)
    return o


cyl('gun_sleeve', P['sleeveR'], P['sleeveL'], P['sleeveL'] / 2)
cyl('gun_tube', P['tubeR'], P['tubeL'], P['tubeL'] / 2)
# Ball-style muzzle brake — the Pz III KwK signature: globular single chamber
bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=P['baffleR'],
                                     location=(0, 0, P['tubeL'] + P['baffleR'] * 0.5))
ball = bpy.context.object
ball.name = 'gun_brake_ball'
ball.scale = (1.0, 1.0, 1.15)            # slightly egg-shaped along the bore
bpy.ops.object.transform_apply(scale=True)
assign(ball, gun_mat)
cyl('gun_muzzle_tip', P['tubeR'] * 0.8, 0.08,
    P['tubeL'] + P['baffleR'] * 0.5 + P['baffleR'] * 1.15 + 0.02, verts=10)

finalize_and_export('medium_gun_50mm')
