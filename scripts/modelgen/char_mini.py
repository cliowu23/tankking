# char_mini — THE parametric mini-character generator (Batch C1+).
# One script, one params JSON per character: scripts/modelgen/params/char_<id>.json
#   blender --background --python scripts/modelgen/char_mini.py -- char_driver_a
# Detail Doctrine (character edition): hair/cap silhouette, geometric face,
# jacket/belt/boots color blocking, cuffs, pockets, buckle. ≤3k verts.
# Axes: Z up, character faces -Y (= game +Z). NEVER transform_apply (armature!).
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import (clear_scene, make_armature, tint, bind_part, finish_mesh,
                      idle_action, walk_action, export_char)
import bpy

# ── Params ───────────────────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PARAM_FILE = (argv[0] if argv else 'char_driver_a')
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'params', f'{PARAM_FILE}.json')) as f:
    P = json.load(f)

CHAR_ID = P['id']
W = P.get('build', {}).get('width', 1.0)
H = P.get('build', {}).get('height', 1.0)
rgba = lambda c: (c[0], c[1], c[2], 1.0)
SKIN, HAIR, CAP = rgba(P['skinTone']), rgba(P['hairColor']), rgba(P.get('capColor', P['hairColor']))
JACKET, SHIRT = rgba(P['jacketColor']), rgba(P.get('shirtColor', P['jacketColor']))
PANTS, BOOTS, BELT = rgba(P['pantsColor']), rgba(P['bootColor']), rgba(P.get('beltColor', [0.2, 0.16, 0.12]))
DARK = (0.09, 0.08, 0.08, 1.0)

clear_scene()
arm = make_armature()


def box(c, s, bev=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(c[0] * W, c[1], c[2] * H))
    o = bpy.context.object
    o.scale = (s[0] / 2 * W, s[1] / 2, s[2] / 2 * H)
    bpy.ops.object.transform_apply(scale=True)   # mesh-only scale apply (no armature yet)
    if bev > 0:
        m = o.modifiers.new('bvl', 'BEVEL')
        m.width, m.segments, m.limit_method = bev, 2, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def cyl(c, r, d, v=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r * W, depth=d * H,
                                        location=(c[0] * W, c[1], c[2] * H))
    return bpy.context.object


def sph(c, r, seg=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=8, radius=r * W,
                                         location=(c[0] * W, c[1], c[2] * H))
    return bpy.context.object


def mk(obj, color, bone):
    tint(obj, color)
    bind_part(obj, bone)
    return obj


# ── BODY parts ───────────────────────────────────────────────────────────────
body = []
# hips + belt + buckle (root bone)
body.append(mk(box((0, 0, 0.295), (0.235, 0.15, 0.05)), PANTS, 'root'))
body.append(mk(box((0, 0, 0.322), (0.245, 0.16, 0.032)), BELT, 'root'))
body.append(mk(box((0, -0.083, 0.322), (0.045, 0.012, 0.026)), DARK, 'root'))   # buckle
# torso: jacket block + shirt V at the collar + collar + zip + chest pockets
body.append(mk(box((0, 0, 0.395), (0.26, 0.165, 0.155), bev=0.015), JACKET, 'torso'))
body.append(mk(box((0, -0.078, 0.452), (0.075, 0.014, 0.045)), SHIRT, 'torso'))  # shirt v
body.append(mk(box((0, 0, 0.474), (0.215, 0.15, 0.026), bev=0.008), JACKET, 'torso'))  # collar
body.append(mk(box((0, -0.085, 0.40), (0.012, 0.008, 0.14)), DARK, 'torso'))     # zip line
for sx in (-1, 1):                                                               # chest pockets
    body.append(mk(box((sx * 0.066, -0.085, 0.41), (0.055, 0.01, 0.04)), JACKET, 'torso'))
    body.append(mk(box((sx * 0.066, -0.088, 0.428), (0.055, 0.008, 0.012)), BELT, 'torso'))
# legs + boots (leg bones); boots toe forward
for side, sx in (('leg-left', 1), ('leg-right', -1)):
    leg = cyl((sx * 0.085, 0, 0.18), 0.054, 0.24); mk(leg, PANTS, side)
    cuffp = cyl((sx * 0.085, 0, 0.085), 0.058, 0.035); mk(cuffp, PANTS, side)    # pant cuff
    boot = box((sx * 0.085, -0.02, 0.035), (0.115, 0.185, 0.07), bev=0.012); mk(boot, BOOTS, side)
# arms + cuffs + mitten hands (arm bones)
for side, sx in (('arm-left', 1), ('arm-right', -1)):
    armp = cyl((sx * 0.175, 0, 0.345), 0.044, 0.175); mk(armp, JACKET, side)
    cuff = cyl((sx * 0.175, 0, 0.255), 0.049, 0.035); mk(cuff, BELT, side)       # sleeve cuff
    hand = sph((sx * 0.175, 0, 0.215), 0.047); mk(hand, SKIN, side)
# shoulders (sphere caps inside the joint so rigid arm swings don't open gaps)
for sx in (-1, 1):
    body.append(mk(sph((sx * 0.175, 0, 0.435), 0.05), JACKET, 'torso'))
body += []  # legs/arms appended via mk() returns below
parts_body = [o for o in bpy.context.scene.objects if o.type == 'MESH']
finish_mesh(parts_body, 'body-mesh', arm)

# ── HEAD parts ───────────────────────────────────────────────────────────────
head_parts = []
head_parts.append(mk(box((0, 0, 0.565), (0.225, 0.195, 0.195), bev=0.022), SKIN, 'head'))
# geometric face (front = -Y): eyes, brows
for sx in (-1, 1):
    head_parts.append(mk(box((sx * 0.05, -0.099, 0.578), (0.026, 0.012, 0.034)), DARK, 'head'))
    head_parts.append(mk(box((sx * 0.05, -0.099, 0.607), (0.034, 0.01, 0.012)), HAIR, 'head'))
# ears
for sx in (-1, 1):
    head_parts.append(mk(box((sx * 0.118, 0, 0.565), (0.018, 0.04, 0.05)), SKIN, 'head'))
# hair: back + sides under the cap (or full hair if no cap)
head_parts.append(mk(box((0, 0.085, 0.575), (0.235, 0.035, 0.17)), HAIR, 'head'))
if P.get('hairStyle') == 'cap':
    head_parts.append(mk(box((0, 0.01, 0.672), (0.245, 0.225, 0.045), bev=0.012), CAP, 'head'))
    head_parts.append(mk(box((0, -0.135, 0.658), (0.2, 0.085, 0.018)), CAP, 'head'))   # brim
    head_parts.append(mk(box((0, -0.04, 0.696), (0.07, 0.1, 0.012)), CAP, 'head'))     # crown seam
else:
    head_parts.append(mk(box((0, 0, 0.672), (0.24, 0.21, 0.05), bev=0.015), HAIR, 'head'))
    head_parts.append(mk(box((0, -0.09, 0.66), (0.23, 0.03, 0.035)), HAIR, 'head'))    # fringe

new_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'body-mesh']
finish_mesh(new_meshes, 'head-mesh', arm)

idle_action(arm)
walk_action(arm)
export_char(CHAR_ID)
