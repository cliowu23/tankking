# light_turret_enclosed — M24 Chaffee-inspired turret, Light doctrine.
# Origin at ring center. Ring base = STANDARD_RING_DIAMETER. 'mount' at +Z front.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (cupola on -X side).
# Shell is a bmesh cast-steel body: low and wide, elongated front-to-back,
# all faces sloped inward, octagonal plan with generous bevels — not a cone.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty,
                  bevel, make_lofted_turret, finalize_and_export, load_params,
                  STANDARD_RING_DIAMETER, DOCTRINE_COLORS)
from _details import bolt_row, weld_seam, lifting_eye, periscope, grab_handle
import bpy
import bmesh

P = {
    'shellR1': 0.92, 'shellR2': 0.72, 'shellH': 0.58, 'shellElong': 1.32,
    'bustleW': 0.95, 'bustleL': 0.68, 'bustleH': 0.42, 'bustleY': 0.88,
    'cupolaR': 0.22, 'cupolaX': -0.38,
    'mountY': -0.80, 'mountZ': 0.30,
    'mant_shieldH': 0.52, 'mant_shieldW': 0.86,
    'mant_bowlR': 0.25,   'mant_collarR': 0.12, 'mant_protrude': 0.16,
    'crossSections': [
        {'z': 0.07, 'hw': 0.70, 'tf': 0.80, 'tr': 0.66},
        {'z': 0.25, 'hw': 0.69, 'tf': 0.74, 'tr': 0.64},
        {'z': 0.48, 'hw': 0.58, 'tf': 0.61, 'tr': 0.56},
        {'z': 0.67, 'hw': 0.45, 'tf': 0.51, 'tr': 0.46},
    ],
}
P.update(load_params('light_tank', 'turret'))

clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()

RING_R     = STANDARD_RING_DIAMETER / 2
SHELL_Z0   = 0.07
_cs        = P['crossSections']
TURRET_TOP = max(cs['z'] for cs in _cs)
SHELL_H    = TURRET_TOP - SHELL_Z0
MOUNT      = (0, P['mountY'], P['mountZ'])

# Ring collar — measureBase() reads this as the seat diameter
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=SHELL_Z0,
                                    location=(0, 0, SHELL_Z0 / 2))
ring = bpy.context.object; ring.name = 'turret_ring'; assign(ring, body_mat)


make_lofted_turret('turret_shell', body_mat, _cs)


# Mantlet — rounded casting disc (UV sphere flattened front-to-back)
bpy.ops.mesh.primitive_uv_sphere_add(
    segments=14, ring_count=8, radius=0.28,
    location=(0, P['mountY'] - 0.06, P['mountZ']))
shield = bpy.context.object; shield.name = 'mantlet_shield'
shield.scale = (1.34, 0.50, 0.96)
bpy.ops.object.transform_apply(scale=True)
assign(shield, gear_mat)

# Gun collar
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=P['mant_collarR'], depth=0.12,
                                    location=(0, P['mountY'] + 0.01, P['mountZ']),
                                    rotation=(math.pi / 2, 0, 0))
collar = bpy.context.object; collar.name = 'mantlet_collar'
assign(collar, gear_mat)

# Commander's cupola (tank's RIGHT = Blender -X)
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=P['cupolaR'], depth=0.18,
                                    location=(P['cupolaX'], 0.08, TURRET_TOP + 0.07))
cupola = bpy.context.object; cupola.name = 'cupola_commander'
bevel(cupola, width=0.04, segments=2)
assign(cupola, body_mat)

bpy.ops.mesh.primitive_cube_add(location=(P['cupolaX'], 0.08, TURRET_TOP + 0.165))
hatch_c = bpy.context.object; hatch_c.name = 'hatch_cupola'
hatch_c.scale = (P['cupolaR'] + 0.02, P['cupolaR'] + 0.02, 0.024)
bpy.ops.object.transform_apply(scale=True)
assign(hatch_c, body_mat)

# Gunner hatch (tank's LEFT = Blender +X)
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.185, depth=0.044,
                                    location=(-P['cupolaX'] * 0.75, 0.05, TURRET_TOP + 0.01))
hatch_g = bpy.context.object; hatch_g.name = 'hatch_gunner'
assign(hatch_g, body_mat)

# Tertiary detail pass (anchored to the bmesh shell extents)
for sx in (-1, 1):
    periscope(f'roof{sx}', gear_mat, (sx * 0.30, -0.40, TURRET_TOP + 0.06))
for sx in (-1, 1):  # lifting eyes low on the wide part of the casting
    lifting_eye(f'tur{sx}', gear_mat, (sx * 0.67, 0.10, SHELL_Z0 + SHELL_H * 0.30))
bolt_row('turret_base', gear_mat,
         (-0.62, -0.62, SHELL_Z0 + 0.005),
         ( 0.62,  0.62, SHELL_Z0 + 0.005), 6, 'z')
weld_seam('turret_top', gear_mat, (0, 0.18, TURRET_TOP + 0.005), 1.0, 'x')

add_mount_empty('mount', MOUNT)
finalize_and_export('light_turret_enclosed')
