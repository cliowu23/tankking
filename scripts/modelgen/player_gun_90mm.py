# player_gun_90mm — 90mm M3-inspired gun (M26 Pershing main armament), original mesh.
# Long tube + recoil sleeve + double-baffle muzzle brake.
# Contract: breech face at origin, tube along GLB up axis (the JS part module
# rotates x=+90° after parenting — existing cannon pattern). In Blender: tube along +Z.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, finalize_and_export
import bpy

clear_scene()
gun_mat = flat_material('gun_metal', (0.30, 0.30, 0.30, 1.0))  # runtime material overrides

TUBE_L  = 2.90
TUBE_R  = 0.075

def cyl(name, r, depth, z, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(0, 0, z))
    o = bpy.context.object
    o.name = name
    assign(o, gun_mat)
    return o

cyl('gun_sleeve', 0.105, 0.95, 0.475)                    # recoil sleeve at the breech end
cyl('gun_tube', TUBE_R, TUBE_L, TUBE_L / 2)              # main tube
# Double-baffle muzzle brake: two discs + connecting core + muzzle cap
cyl('gun_brake_baffle_1', 0.165, 0.09, TUBE_L + 0.10)
cyl('gun_brake_baffle_2', 0.165, 0.09, TUBE_L + 0.30)
cyl('gun_brake_core', 0.085, 0.42, TUBE_L + 0.19, verts=12)
cyl('gun_muzzle_cap', 0.10, 0.10, TUBE_L + 0.42, verts=12)

finalize_and_export('player_gun_90mm')
