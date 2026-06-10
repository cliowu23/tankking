# player_turret_base — M26 Pershing-inspired turret, original mesh.
# Rounded cast shape with rear bustle, right-side commander cupola, gun mantlet.
# Contract: origin AT ring center, base = STANDARD_RING_DIAMETER, 'mount' empty +front.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (cupola goes on -X).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, assign, add_mount_empty,
                  finalize_and_export, STANDARD_RING_DIAMETER, DOCTRINE_COLORS)
import bpy

clear_scene()
body_mat = flat_material('player_body', DOCTRINE_COLORS['player'])
gear_mat = flat_material('gear_dark',  (0.16, 0.155, 0.15, 1.0))

RING_R   = STANDARD_RING_DIAMETER / 2      # 0.9
SHELL_Z0 = 0.08                            # shell sits on the ring collar
SHELL_H  = 0.62
MOUNT    = (0, -1.00, 0.34)                # gun trunnion: front face, mid-height

# Ring collar — the bottom slice measureBase() reads; must be the standard diameter.
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=SHELL_Z0,
                                    location=(0, 0, SHELL_Z0 / 2))
ring = bpy.context.object
ring.name = 'turret_ring'
assign(ring, body_mat)

# Cast shell: truncated cone, elongated front-to-back like the real casting.
bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=1.00, radius2=0.74, depth=SHELL_H,
                                location=(0, 0, SHELL_Z0 + SHELL_H / 2))
shell = bpy.context.object
shell.name = 'turret_shell'
shell.scale = (1.0, 1.18, 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(shell, body_mat)

# Rear bustle (ammo/radio box of the casting)
bpy.ops.mesh.primitive_cube_add(location=(0, 1.05, 0.36))
bustle = bpy.context.object
bustle.name = 'turret_bustle'
bustle.scale = (0.55, 0.38, 0.24)
bpy.ops.object.transform_apply(scale=True)
assign(bustle, body_mat)

# Gun mantlet: chunky curved-face block at the gun mount
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.30, depth=0.86,
                                    location=(0, MOUNT[1] - 0.02, MOUNT[2]),
                                    rotation=(0, math.pi / 2, 0))
mantlet = bpy.context.object
mantlet.name = 'gun_mantlet'
mantlet.scale = (1.0, 0.85, 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(mantlet, body_mat)

# Commander's cupola — tank's RIGHT = Blender -X
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.24, depth=0.20,
                                    location=(-0.42, 0.10, SHELL_Z0 + SHELL_H + 0.08))
cupola = bpy.context.object
cupola.name = 'cupola'
assign(cupola, body_mat)

# Loader's hatch — tank's LEFT = Blender +X
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.20, depth=0.05,
                                    location=(0.45, 0.10, SHELL_Z0 + SHELL_H + 0.01))
hatch = bpy.context.object
hatch.name = 'hatch_loader'
assign(hatch, body_mat)

# Ventilator dome (small, rear of roof)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=0.08,
                                    location=(0, 0.62, SHELL_Z0 + SHELL_H + 0.0))
vent = bpy.context.object
vent.name = 'roof_ventilator'
assign(vent, gear_mat)

add_mount_empty('mount', MOUNT)

finalize_and_export('player_turret_base')
