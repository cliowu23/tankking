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
    'bustleW': 0.0, 'bustleL': 0.0, 'bustleH': 0.0, 'bustleY': 0.0,
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

# RECTANGULAR shell — Cromwell/Churchill reference (user direction 2026-06-10):
# slab-sided welded box, near-vertical walls (slight Churchill-style top taper),
# flat roof, flat front face carrying the mantlet.
# Param mapping: shellR1 = half-width at base, shellR2 = half-width at roof,
# length = width * shellElong.
SHELL_W = P['shellR1'] * 2
SHELL_L = SHELL_W * P['shellElong']
shell = make_box('turret_shell', body_mat, (0, -0.02, SHELL_Z0 + SHELL_H / 2),
                 (SHELL_W, SHELL_L, SHELL_H))
taper = P['shellR2'] / P['shellR1']
for v in shell.data.vertices:                      # walls lean in toward the roof
    if v.co.z > SHELL_Z0 + SHELL_H / 2:
        v.co.x *= taper
        v.co.y = (v.co.y + 0.02) * (taper * 0.5 + 0.5) - 0.02
bevel(shell, width=0.035, segments=2)              # soften the welded edges

# Turret Schuerzen: rectangular standoff plates on the sides + rear (front open
# for the mantlet) — matches the box shell, like the hull skirt wall
SK_H, SK_OFF = 0.40, 0.16
for side, sx in (('r', -1), ('l', 1)):
    make_box(f'skirt_turret_{side}', body_mat,
             (sx * (SHELL_W / 2 + SK_OFF), -0.02, SHELL_Z0 + 0.26),
             (0.03, SHELL_L * 0.92, SK_H))
make_box('skirt_turret_rear', body_mat,
         (0, -0.02 + SHELL_L / 2 + SK_OFF, SHELL_Z0 + 0.26),
         (SHELL_W * 0.92, 0.03, SK_H))
for side, sx in (('r', -1), ('l', 1)):             # dark mounts tying plates to shell
    make_box(f'skirt_turret_mount_{side}_trim_dark', gear_mat,
             (sx * (SHELL_W / 2 + SK_OFF / 2), -0.02, SHELL_Z0 + 0.42),
             (SK_OFF, 0.06, 0.04))

# Rear stowage bustle (Cromwell-style bin) — driven by the bustle sliders;
# all-zero = no bustle
if P['bustleW'] > 0 and P['bustleL'] > 0 and P['bustleH'] > 0:
    bustle = make_box('turret_bustle', body_mat,
                      (0, P['bustleY'], SHELL_Z0 + P['bustleH'] / 2 + 0.04),
                      (P['bustleW'], P['bustleL'], P['bustleH']))
    bevel(bustle, width=0.05, segments=2)

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
