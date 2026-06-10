# player_turret_base — M26 Pershing-inspired turret, original mesh.
# Contract: origin AT ring center, base = STANDARD_RING_DIAMETER (NOT tunable), 'mount' +front.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (cupola goes on -X).
# Tunables come from params/player_tank.json (edited live by the Tank Tuner).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty, bevel,
                  finalize_and_export, load_params, STANDARD_RING_DIAMETER,
                  DOCTRINE_COLORS)
import bpy
from _details import bolt_row, weld_seam, lifting_eye, tow_shackle, periscope, grab_handle, vision_slit

P = {
    'shellR1': 1.00, 'shellR2': 0.74, 'shellH': 0.62, 'shellElong': 1.18,
    'bustleW': 1.10, 'bustleL': 0.76, 'bustleH': 0.48, 'bustleY': 1.05,
    'mantletR': 0.30, 'mantletW': 0.86,
    'cupolaR': 0.24, 'cupolaX': -0.42,
    'mountY': -1.00, 'mountZ': 0.34,
}
P.update(load_params('player_tank', 'turret'))

clear_scene()
body_mat = flat_material('player_body', DOCTRINE_COLORS['player'])
gear_mat = gear_material()

RING_R   = STANDARD_RING_DIAMETER / 2      # 0.9 — the engine interface, never a slider
SHELL_Z0 = 0.08
SHELL_H  = P['shellH']
MOUNT    = (0, P['mountY'], P['mountZ'])

# Ring collar — the bottom slice measureBase() reads; must be the standard diameter.
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=SHELL_Z0,
                                    location=(0, 0, SHELL_Z0 / 2))
ring = bpy.context.object
ring.name = 'turret_ring'
assign(ring, body_mat)

# Cast shell: truncated cone, elongated front-to-back like the real casting.
bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=P['shellR1'], radius2=P['shellR2'],
                                depth=SHELL_H, location=(0, 0, SHELL_Z0 + SHELL_H / 2))
shell = bpy.context.object
shell.name = 'turret_shell'
shell.scale = (1.0, P['shellElong'], 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(shell, body_mat)

# Gentle roof curvature (tuning-pass pin): shallow dome capping the flat cone top
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=P['shellR2'] * 0.98,
                                     location=(0, 0, SHELL_Z0 + SHELL_H - 0.02))
roof = bpy.context.object
roof.name = 'turret_roof'
roof.scale = (1.0, P['shellElong'], 0.22)
bpy.ops.object.transform_apply(scale=True)
assign(roof, body_mat)

# Rear bustle (ammo/radio box of the casting) — beveled so the bustle-to-shell
# corner reads cast, not boxy (tuning-pass pin)
bpy.ops.mesh.primitive_cube_add(location=(0, P['bustleY'], 0.36))
bustle = bpy.context.object
bustle.name = 'turret_bustle'
bustle.scale = (P['bustleW'] / 2, P['bustleL'] / 2, P['bustleH'] / 2)
bpy.ops.object.transform_apply(scale=True)
bevel(bustle, width=0.09, segments=3)
assign(bustle, body_mat)

# Mantlet group — ALL dark gunmetal (tuning pass 2: "blend into the turret more
# organically, introduce more blacks"). Reads as the canvas dust cover on real
# tanks; 'mantlet' is an UNPAINTABLE keyword so runtime paint never touches it.

# Gun mantlet: chunky curved-face block at the gun mount
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['mantletR'], depth=P['mantletW'],
                                    location=(0, MOUNT[1] - 0.02, MOUNT[2]),
                                    rotation=(0, math.pi / 2, 0))
mantlet = bpy.context.object
mantlet.name = 'gun_mantlet'
mantlet.scale = (1.0, 0.85, 1.0)
bpy.ops.object.transform_apply(scale=True)
bevel(mantlet, width=0.03, segments=2)
assign(mantlet, gear_mat)

# Seal collar: fat soft ring right behind the mantlet — the organic transition
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['mantletR'] + 0.07, depth=P['mantletW'] * 0.62,
                                    location=(0, MOUNT[1] + 0.17, MOUNT[2]),
                                    rotation=(0, math.pi / 2, 0))
seal = bpy.context.object
seal.name = 'mantlet_seal'
seal.scale = (1.0, 0.9, 1.0)
bpy.ops.object.transform_apply(scale=True)
bevel(seal, width=0.07, segments=3)
assign(seal, gear_mat)

# Mantlet hood: tapered collar carrying the dark mass up into the shell front
hood_y0 = MOUNT[1] + 0.16                 # just behind the mantlet
bpy.ops.mesh.primitive_cube_add(location=(0, hood_y0 + 0.28, MOUNT[2] + 0.02))
hood = bpy.context.object
hood.name = 'mantlet_hood'
hood.scale = (P['mantletW'] * 0.44, 0.28, P['mantletR'] + 0.08)
bpy.ops.object.transform_apply(scale=True)
for v in hood.data.vertices:              # taper: narrower + lower at the mantlet end
    if v.co.y < hood_y0 + 0.28:
        v.co.x *= 0.82
        v.co.z = (v.co.z - (MOUNT[2] + 0.02)) * 0.85 + (MOUNT[2] + 0.02)
bevel(hood, width=0.08, segments=3)
assign(hood, gear_mat)

# Commander's cupola — tank's RIGHT = Blender -X
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['cupolaR'], depth=0.20,
                                    location=(P['cupolaX'], 0.10, SHELL_Z0 + SHELL_H + 0.08))
cupola = bpy.context.object
cupola.name = 'cupola'
bevel(cupola, width=0.05, segments=3)     # rounded rim (tuning-pass pin)
assign(cupola, body_mat)

# Loader's hatch — tank's LEFT = Blender +X
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.20, depth=0.05,
                                    location=(-P['cupolaX'], 0.10, SHELL_Z0 + SHELL_H + 0.01))
hatch = bpy.context.object
hatch.name = 'hatch_loader'
assign(hatch, body_mat)

# Ventilator dome (small, rear of roof)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=0.08,
                                    location=(0, 0.62, SHELL_Z0 + SHELL_H))
vent = bpy.context.object
vent.name = 'roof_ventilator'
assign(vent, gear_mat)

# ── Tertiary detail pass ─────────────────────────────────────────────────────
for sx in (-1, 1):                                          # crew periscopes, front roof
    periscope(f'roof{sx}', gear_mat, (sx * 0.28, -0.5, SHELL_Z0 + SHELL_H + 0.10))
for sx in (-1, 1):                                          # turret lifting eyes
    lifting_eye(f'tur{sx}', gear_mat, (sx * 0.78, 0.15, SHELL_Z0 + SHELL_H - 0.02))
grab_handle('bustle', gear_mat,
            (0, P['bustleY'] + P['bustleL'] / 2 + 0.035, 0.40))

add_mount_empty('mount', MOUNT)

finalize_and_export('player_turret_base')
