# medium_turret_angular — Panzer III-inspired faceted turret with Schuerzen skirt band.
# Approved mockup B. Contract: origin at ring center, base = STANDARD_RING_DIAMETER,
# 'mount' empty +front. Rear-center drum cupola (Pz III signature), dark mantlet block.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty,
                  bevel, make_box, finalize_and_export, load_params,
                  STANDARD_RING_DIAMETER, DOCTRINE_COLORS)
import bpy

P = {
    'shellR1': 0.95, 'shellR2': 0.76, 'shellH': 0.55, 'shellElong': 1.15,
    'mantletR': 0.22, 'mantletW': 0.62,
    'cupolaR': 0.26, 'cupolaX': 0.0,
    'mountY': -0.95, 'mountZ': 0.30,
}
P.update(load_params('medium_tank', 'turret'))

clear_scene()
body_mat = flat_material('medium_body', DOCTRINE_COLORS['medium'])
gear_mat = gear_material()

RING_R   = STANDARD_RING_DIAMETER / 2
SHELL_Z0 = 0.08
SHELL_H  = P['shellH']
MOUNT    = (0, P['mountY'], P['mountZ'])

# Ring collar — the measured base, standard diameter
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=SHELL_Z0,
                                    location=(0, 0, SHELL_Z0 / 2))
ring = bpy.context.object
ring.name = 'turret_ring'
assign(ring, body_mat)

# Faceted shell — 10 flat sides (angular, deliberately NOT the player's round cast)
bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=P['shellR1'], radius2=P['shellR2'],
                                depth=SHELL_H, location=(0, 0, SHELL_Z0 + SHELL_H / 2))
shell = bpy.context.object
shell.name = 'turret_shell'
shell.scale = (1.0, P['shellElong'], 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(shell, body_mat)

# Schuerzen turret skirt: thin 8-facet band floating around the shell
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=P['shellR1'] + 0.20, depth=0.46,
                                    location=(0, -0.02, SHELL_Z0 + 0.26))
skirtband = bpy.context.object
skirtband.name = 'skirt_turret_band'
skirtband.scale = (1.0, 1.18, 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(skirtband, body_mat)

# Drum cupola — REAR-CENTER (Pz III signature), beveled rim
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=P['cupolaR'], depth=0.24,
                                    location=(P['cupolaX'], 0.5, SHELL_Z0 + SHELL_H + 0.10))
cupola = bpy.context.object
cupola.name = 'cupola'
bevel(cupola, width=0.05, segments=3)
assign(cupola, body_mat)

# External mantlet block (dark — 'mantlet' keyword stays unpainted)
m = make_box('gun_mantlet', gear_mat, (0, MOUNT[1] - 0.04, MOUNT[2]),
             (0.46, 0.30, 0.42))
bevel(m, width=0.04, segments=2)

add_mount_empty('mount', MOUNT)
finalize_and_export('medium_turret_angular')
