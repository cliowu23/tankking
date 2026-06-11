# light_turret_enclosed — M24 Chaffee-inspired turret, Light doctrine.
# Origin at ring center. Ring base = STANDARD_RING_DIAMETER. 'mount' at +Z front.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (cupola on -X side).
# Shell is a bmesh cast-steel body: low and wide, elongated front-to-back,
# all faces sloped inward, octagonal plan with generous bevels — not a cone.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty,
                  bevel, finalize_and_export, load_params, STANDARD_RING_DIAMETER,
                  DOCTRINE_COLORS)
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


# ---- Cast shell — bmesh loft through three octagonal cross-sections --------
def build_turret_shell(name, mat):
    TF = 0.80              # forward half-depth (ring center → front face, -Y)
    TR = 0.65              # rear half-depth of the main body (+Y, bustle adds more)

    def ring_pts(hw, tf, tr):
        """Octagonal turret outline (CCW from above). hw=half-width,
        tf=front depth, tr=rear depth."""
        return [
            (-hw * 0.55, -tf),         # front-left corner
            ( hw * 0.55, -tf),         # front-right corner
            ( hw,        -tf * 0.45),  # right-front
            ( hw,         tr * 0.45),  # right-rear
            ( hw * 0.60,  tr),         # rear-right corner
            (-hw * 0.60,  tr),         # rear-left corner
            (-hw,         tr * 0.45),  # left-rear
            (-hw,        -tf * 0.45),  # left-front
        ]

    Z0 = SHELL_Z0
    Z1 = SHELL_Z0 + SHELL_H * 0.55
    Z2 = SHELL_Z0 + SHELL_H

    # Three levels: base widest; mid pulls in slightly; top narrower with the
    # front face raked back hardest (high-glacis cast front).
    pts_bot = ring_pts(0.69, TF,        TR)
    pts_mid = ring_pts(0.64, TF * 0.90, TR)
    pts_top = ring_pts(0.55, TF * 0.78, TR * 0.90)

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    v_bot = [bm.verts.new((x, y, Z0)) for x, y in pts_bot]
    v_mid = [bm.verts.new((x, y, Z1)) for x, y in pts_mid]
    v_top = [bm.verts.new((x, y, Z2)) for x, y in pts_top]
    n = len(pts_bot)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((v_bot[i], v_bot[j], v_mid[j], v_mid[i]))
        bm.faces.new((v_mid[i], v_mid[j], v_top[j], v_top[i]))
    bm.faces.new(list(reversed(v_top)))   # roof plate
    bm.faces.new(v_bot)                   # base (ring collar hides it)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    # Generous bevel = cast-steel rounding on every corner
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('bvl', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = 0.06, 3, 'ANGLE'
    mod.angle_limit = math.radians(35)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


build_turret_shell('turret_shell', body_mat)

# Turret roof — nearly flat plate, tilted ~3 deg so the front edge sits higher
# (continues the raked front), NOT a dome.
bpy.ops.mesh.primitive_cube_add(location=(0, 0.02, TURRET_TOP - 0.005))
roof = bpy.context.object; roof.name = 'turret_roof'
roof.scale = (0.50, 0.58, 0.02)
roof.rotation_euler.x = math.radians(-3)   # -Y front raised
bpy.ops.object.transform_apply(rotation=True, scale=True)
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

# Tertiary detail pass (anchored to the bmesh shell extents)
for sx in (-1, 1):
    periscope(f'roof{sx}', gear_mat, (sx * 0.30, -0.40, TURRET_TOP + 0.06))
for sx in (-1, 1):  # lifting eyes low on the wide part of the casting
    lifting_eye(f'tur{sx}', gear_mat, (sx * 0.67, 0.10, SHELL_Z0 + SHELL_H * 0.30))
bolt_row('turret_base', gear_mat,
         (-0.62, -0.62, SHELL_Z0 + 0.005),
         ( 0.62,  0.62, SHELL_Z0 + 0.005), 6, 'z')
weld_seam('turret_top', gear_mat, (0, 0.18, TURRET_TOP + 0.005), 1.0, 'x')
grab_handle('bustle', gear_mat,
            (0, P['bustleY'] + P['bustleL'] / 2 + 0.03, SHELL_Z0 + P['bustleH'] / 2))

add_mount_empty('mount', MOUNT)
finalize_and_export('light_turret_enclosed')
