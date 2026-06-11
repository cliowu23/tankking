# light_turret_enclosed — M24 Chaffee-inspired turret, Light doctrine.
# Origin at ring center. Ring base = STANDARD_RING_DIAMETER. 'mount' at +Z front.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (cupola on -X side).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty,
                  bevel, finalize_and_export, load_params, STANDARD_RING_DIAMETER,
                  DOCTRINE_COLORS)
from _details import bolt_row, weld_seam, lifting_eye, periscope, grab_handle
import bpy

P = {
    'shellR1': 0.92, 'shellR2': 0.72, 'shellH': 0.58, 'shellElong': 1.32,
    'bustleW': 0.95, 'bustleL': 0.68, 'bustleH': 0.42, 'bustleY': 0.88,
    'cupolaR': 0.22, 'cupolaX': -0.38,
    'mountY': -0.80, 'mountZ': 0.30,
    'mant_shieldH': 0.52, 'mant_shieldW': 0.86,
    'mant_bowlR': 0.25,   'mant_collarR': 0.12, 'mant_protrude': 0.16,
}
P.update(load_params('light_tank', 'turret'))

clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()

RING_R    = STANDARD_RING_DIAMETER / 2
SHELL_Z0  = 0.07
SHELL_H   = P['shellH']
TURRET_TOP = SHELL_Z0 + SHELL_H
MOUNT     = (0, P['mountY'], P['mountZ'])

# Ring collar — measureBase() reads this as the seat diameter
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=SHELL_Z0,
                                    location=(0, 0, SHELL_Z0 / 2))
ring = bpy.context.object; ring.name = 'turret_ring'; assign(ring, body_mat)

# Cast shell (truncated cone, elongated front-to-back)
bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=P['shellR1'], radius2=P['shellR2'],
                                depth=SHELL_H, location=(0, 0, SHELL_Z0 + SHELL_H / 2))
shell = bpy.context.object; shell.name = 'turret_shell'
shell.scale = (1.0, P['shellElong'], 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(shell, body_mat)

# Shallow roof dome
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=P['shellR2'] * 0.95,
                                     location=(0, 0, SHELL_Z0 + SHELL_H - 0.02))
roof = bpy.context.object; roof.name = 'turret_roof'
roof.scale = (1.0, P['shellElong'], 0.18)
bpy.ops.object.transform_apply(scale=True)
assign(roof, body_mat)

# Rear bustle
bpy.ops.mesh.primitive_cube_add(location=(0, P['bustleY'], SHELL_Z0 + P['bustleH'] / 2 + 0.04))
bustle = bpy.context.object; bustle.name = 'turret_bustle'
bustle.scale = (P['bustleW'] / 2, P['bustleL'] / 2, P['bustleH'] / 2)
bpy.ops.object.transform_apply(scale=True)
bevel(bustle, width=0.07, segments=3)
assign(bustle, body_mat)

# Composite mantlet (4 parts, all UNPAINTABLE via 'mantlet' keyword)
# 1. Outer shield plate
SHIELD_MID_Y = P['mountY'] - P['mant_protrude'] / 2
bpy.ops.mesh.primitive_cube_add(location=(0, SHIELD_MID_Y, P['mountZ']))
shield = bpy.context.object; shield.name = 'mantlet_shield'
shield.scale = (P['mant_shieldW'] / 2, P['mant_protrude'] / 2 + 0.04, P['mant_shieldH'])
bpy.ops.object.transform_apply(scale=True)
bevel(shield, width=0.04, segments=2)
assign(shield, gear_mat)

# 2. Inner rotor bowl
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['mant_bowlR'],
                                    depth=P['mant_protrude'] * 0.60,
                                    location=(0, P['mountY'] - P['mant_protrude'] * 0.30, P['mountZ']),
                                    rotation=(math.pi / 2, 0, 0))
bowl = bpy.context.object; bowl.name = 'mantlet_rotor_bowl'
bowl.scale = (1.0, 1.0, 1.20)
bpy.ops.object.transform_apply(scale=True)
assign(bowl, gear_mat)

# 3. Gun collar ring
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=P['mant_collarR'], depth=0.10,
                                    location=(0, P['mountY'] + 0.01, P['mountZ']),
                                    rotation=(math.pi / 2, 0, 0))
collar = bpy.context.object; collar.name = 'mantlet_collar'
assign(collar, gear_mat)

# 4. Barrel sleeve — tapered short cylinder
bpy.ops.mesh.primitive_cylinder_add(vertices=12,
                                    radius=P['mant_collarR'] + 0.026, depth=0.20,
                                    location=(0, P['mountY'] + 0.11, P['mountZ']),
                                    rotation=(math.pi / 2, 0, 0))
sleeve = bpy.context.object; sleeve.name = 'mantlet_sleeve'
for v in sleeve.data.vertices:
    if v.co.y > 0.06:
        v.co.x *= 0.80
        v.co.z *= 0.80
assign(sleeve, gear_mat)

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

# Tertiary detail pass
for sx in (-1, 1):
    periscope(f'roof{sx}', gear_mat, (sx * 0.30, -0.40, TURRET_TOP + 0.09))
for sx in (-1, 1):
    lifting_eye(f'tur{sx}', gear_mat, (sx * 0.70, 0.10, TURRET_TOP - 0.04))
bolt_row('turret_base', gear_mat,
         (-RING_R + 0.06, -RING_R + 0.06, SHELL_Z0 + 0.04),
         ( RING_R - 0.06,  RING_R - 0.06, SHELL_Z0 + 0.04), 6, 'z')
weld_seam('turret_top', gear_mat, (0, 0.18, TURRET_TOP - 0.01), RING_R * 1.2, 'x')
grab_handle('bustle', gear_mat,
            (0, P['bustleY'] + P['bustleL'] / 2 + 0.03, SHELL_Z0 + P['bustleH'] / 2))

add_mount_empty('mount', MOUNT)
finalize_and_export('light_turret_enclosed')
