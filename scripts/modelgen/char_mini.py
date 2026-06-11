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


# ── BODY parts — PLUMP toyish silhouette (C1 gate feedback: "plump fun toyish") ─
body = []
# hips + belt + buckle (root bone) — wide pear base
body.append(mk(box((0, 0, 0.292), (0.285, 0.195, 0.055), bev=0.018), PANTS, 'root'))
body.append(mk(box((0, 0, 0.322), (0.295, 0.205, 0.034), bev=0.01), BELT, 'root'))
body.append(mk(box((0, -0.106, 0.322), (0.05, 0.012, 0.028)), DARK, 'root'))     # buckle
# torso: pear — wide round belly + narrower chest + collar + zip + chest pockets
body.append(mk(box((0, 0, 0.372), (0.30, 0.205, 0.105), bev=0.034), JACKET, 'torso'))  # belly
body.append(mk(box((0, 0, 0.443), (0.25, 0.17, 0.085), bev=0.024), JACKET, 'torso'))   # chest
body.append(mk(box((0, -0.081, 0.458), (0.075, 0.014, 0.04)), SHIRT, 'torso'))   # shirt v
body.append(mk(box((0, 0, 0.484), (0.215, 0.15, 0.026), bev=0.008), JACKET, 'torso'))  # collar
body.append(mk(box((0, -0.099, 0.40), (0.012, 0.012, 0.125)), DARK, 'torso'))    # zip line
for sx in (-1, 1):                                                               # chest pockets
    body.append(mk(box((sx * 0.068, -0.099, 0.40), (0.055, 0.012, 0.04)), JACKET, 'torso'))
    body.append(mk(box((sx * 0.068, -0.102, 0.418), (0.055, 0.01, 0.012)), BELT, 'torso'))
# legs + boots (leg bones) — chunky stubby legs, big toy boots
for side, sx in (('leg-left', 1), ('leg-right', -1)):
    leg = cyl((sx * 0.088, 0, 0.18), 0.062, 0.23); mk(leg, PANTS, side)
    cuffp = cyl((sx * 0.088, 0, 0.085), 0.067, 0.035); mk(cuffp, PANTS, side)    # pant cuff
    boot = box((sx * 0.088, -0.025, 0.038), (0.13, 0.20, 0.076), bev=0.018); mk(boot, BOOTS, side)
# arms — flared slightly outward (toy A-pose), cuffs + mitten hands
ARM_TILT = 0.12
for side, sx in (('arm-left', 1), ('arm-right', -1)):
    armp = cyl((sx * 0.193, 0, 0.345), 0.048, 0.17)
    armp.rotation_euler.y = -sx * ARM_TILT
    mk(armp, JACKET, side)
    cuff = cyl((sx * 0.204, 0, 0.258), 0.054, 0.036); mk(cuff, BELT, side)       # sleeve cuff
    hand = sph((sx * 0.208, 0, 0.215), 0.052); mk(hand, SKIN, side)
# shoulders (sphere caps inside the joint so rigid arm swings don't open gaps)
for sx in (-1, 1):
    body.append(mk(sph((sx * 0.182, 0, 0.448), 0.056), JACKET, 'torso'))
body += []  # legs/arms appended via mk() returns below
parts_body = [o for o in bpy.context.scene.objects if o.type == 'MESH']
finish_mesh(parts_body, 'body-mesh', arm)

# ── HEAD parts — bigger, rounder (plump pass) ────────────────────────────────
head_parts = []
head_parts.append(mk(box((0, 0, 0.572), (0.26, 0.225, 0.215), bev=0.035), SKIN, 'head'))
# geometric face (front = -Y): eyes, brows
for sx in (-1, 1):
    head_parts.append(mk(box((sx * 0.056, -0.114, 0.585), (0.03, 0.012, 0.038)), DARK, 'head'))
    head_parts.append(mk(box((sx * 0.056, -0.114, 0.617), (0.038, 0.01, 0.013)), HAIR, 'head'))
# ears
for sx in (-1, 1):
    head_parts.append(mk(box((sx * 0.136, 0, 0.568), (0.02, 0.045, 0.055)), SKIN, 'head'))
# hair: back + sides under the cap (or full hair if no cap)
head_parts.append(mk(box((0, 0.10, 0.582), (0.27, 0.038, 0.185)), HAIR, 'head'))
if P.get('hairStyle') == 'cap':
    head_parts.append(mk(box((0, 0.01, 0.688), (0.285, 0.255, 0.05), bev=0.016), CAP, 'head'))
    head_parts.append(mk(box((0, -0.155, 0.672), (0.225, 0.095, 0.02)), CAP, 'head'))  # brim
    head_parts.append(mk(box((0, -0.045, 0.715), (0.08, 0.11, 0.013)), CAP, 'head'))   # crown seam
else:
    head_parts.append(mk(box((0, 0, 0.688), (0.275, 0.24, 0.055), bev=0.018), HAIR, 'head'))
    head_parts.append(mk(box((0, -0.103, 0.674), (0.265, 0.032, 0.038)), HAIR, 'head'))  # fringe

new_meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'body-mesh']
finish_mesh(new_meshes, 'head-mesh', arm)

idle_action(arm)
walk_action(arm)
export_char(CHAR_ID)
