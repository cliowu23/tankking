# char_mini — THE parametric mini-character generator (W1 wardrobe era).
# Full characters = rig + body-mesh (OUTFIT, bald of skin) + head-mesh (the SKIN
# unit: head + ears + face + HANDS bound to arm bones — so skin tone swaps as one
# graft and outfits stay skin-agnostic with bare hands; no gloves per user).
# Hair/headwear/face/back are wardrobe attachments (char_wardrobe.py), NOT baked.
#   blender --background --python scripts/modelgen/char_mini.py -- all|driver|skins|bodies
# Axes: Z up, faces -Y. NEVER transform_apply (armature!).
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import (clear_scene, make_armature, tint, bind_part, finish_mesh,
                      idle_action, walk_action, export_char)
import bpy

DARK  = (0.09, 0.08, 0.08, 1.0)
BOOTS = (0.30, 0.18, 0.10, 1.0)   # warm leather brown
BELT  = (0.36, 0.22, 0.12, 1.0)
SHIRT = (0.96, 0.92, 0.80, 1.0)   # bright cream
PANTS = (0.30, 0.34, 0.48, 1.0)   # lively slate blue
WHITE = (1.0, 1.0, 1.0, 1.0)      # skin parts: WHITE -> runtime tint = the color wheel

# USER-APPROVED outfit list (plan 2026-06-11) — 6 styles, curated colorways
OUTFITS = {
    'jacket':     { 'label': 'Driver Jacket',     'colorways': { 'blue': (0.18, 0.46, 0.88, 1), 'orange': (0.95, 0.50, 0.12, 1) } },
    'overalls':   { 'label': 'Boilersuit', 'colorways': { 'denim': (0.22, 0.42, 0.78, 1), 'green': (0.24, 0.66, 0.30, 1) } },
    'vest':       { 'label': 'Merchant Vest',     'colorways': { 'rust': (0.85, 0.42, 0.15, 1) } },
    'medic':      { 'label': 'Medic Coat',        'colorways': { 'white': (0.95, 0.95, 0.93, 1) } },
    'telogreika': { 'label': 'Padded Jacket',     'colorways': { 'teal': (0.12, 0.62, 0.58, 1), 'mustard': (0.90, 0.68, 0.14, 1) } },
    'workshirt':  { 'label': 'Work Shirt',        'colorways': { 'red': (0.88, 0.22, 0.18, 1), 'yellow': (0.94, 0.78, 0.20, 1) } },
}

# KENNEY-MEASURED proportions (live Blender study): head-mesh 0.454x0.34x0.328
# (z 0.343-0.671), body-mesh 0.767(incl arms)x0.27x0.368. Geometry below targets
# those numbers natively — build factors retired (W=H=1).
W = H = 1.0


def box(c, s, bev=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(c[0] * W, c[1], c[2] * H))
    o = bpy.context.object
    o.scale = (s[0] / 2 * W, s[1] / 2, s[2] / 2 * H)
    bpy.ops.object.transform_apply(scale=True)
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


def build_character(char_id, outfit_style, outfit_col):
    clear_scene()
    arm = make_armature()
    OUT = outfit_col
    torso_col = SHIRT if outfit_style in ('overalls', 'vest', 'workshirt') else OUT
    if outfit_style in ('workshirt', 'overalls'):
        torso_col = OUT                       # boilersuit/shirt: torso IS the outfit
    pants_col = OUT if outfit_style == 'overalls' else PANTS

    # ── BODY (outfit, no skin parts) — Kenney-proportioned squat pear ─────────
    mk(box((0, 0, 0.115), (0.40, 0.275, 0.10), bev=0.03), pants_col, 'root')         # hips
    mk(box((0, 0, 0.165), (0.41, 0.285, 0.034), bev=0.012), BELT, 'root')             # belt
    mk(box((0, -0.146, 0.165), (0.06, 0.014, 0.03)), DARK, 'root')                    # buckle
    mk(box((0, 0, 0.225), (0.40, 0.27, 0.115), bev=0.035), torso_col, 'torso')        # belly
    mk(box((0, 0, 0.315), (0.355, 0.24, 0.095), bev=0.028), torso_col, 'torso')       # chest

    if outfit_style == 'jacket':
        mk(box((0, -0.115, 0.33), (0.10, 0.016, 0.045)), SHIRT, 'torso')              # shirt v
        mk(box((0, 0, 0.358), (0.30, 0.21, 0.028), bev=0.01), OUT, 'torso')           # collar
        mk(box((0, -0.135, 0.26), (0.014, 0.014, 0.16)), DARK, 'torso')               # zip
        for sx in (-1, 1):
            mk(box((sx * 0.095, -0.133, 0.27), (0.07, 0.014, 0.05)), OUT, 'torso')
            mk(box((sx * 0.095, -0.137, 0.293), (0.07, 0.012, 0.014)), BELT, 'torso')
    elif outfit_style == 'overalls':
        mk(box((0, -0.135, 0.26), (0.016, 0.014, 0.17)), DARK, 'torso')               # chest zip
        mk(box((0, 0, 0.175), (0.415, 0.29, 0.036), bev=0.012), DARK, 'torso')        # waist cinch
        mk(box((0, 0, 0.358), (0.295, 0.205, 0.028), bev=0.01), OUT, 'torso')         # stand collar
        for sx in (-1, 1):
            mk(box((sx * 0.10, -0.132, 0.30), (0.075, 0.014, 0.05)), OUT, 'torso')
            mk(box((sx * 0.10, -0.136, 0.323), (0.075, 0.012, 0.014)), DARK, 'torso')
    elif outfit_style == 'vest':
        for sx in (-1, 1):
            mk(box((sx * 0.107, -0.138, 0.27), (0.115, 0.016, 0.165), bev=0.012), OUT, 'torso')
        mk(box((0, 0.135, 0.27), (0.33, 0.018, 0.17), bev=0.012), OUT, 'torso')
    elif outfit_style == 'medic':
        mk(box((0, -0.115, 0.33), (0.10, 0.016, 0.045)), SHIRT, 'torso')
        mk(box((0, 0, 0.358), (0.295, 0.205, 0.028), bev=0.01), OUT, 'torso')
        mk(box((0, 0, 0.10), (0.41, 0.285, 0.075), bev=0.02), OUT, 'root')            # coat hem
        mk(box((0.095, -0.138, 0.30), (0.045, 0.014, 0.015)), (0.85, 0.15, 0.12, 1), 'torso')
        mk(box((0.095, -0.138, 0.30), (0.015, 0.014, 0.045)), (0.85, 0.15, 0.12, 1), 'torso')
    elif outfit_style == 'telogreika':
        for z in (0.185, 0.235, 0.285, 0.335):
            mk(box((0, -0.137, z), (0.33, 0.016, 0.02)), OUT, 'torso')
            mk(box((0, 0.137, z), (0.33, 0.016, 0.02)), OUT, 'torso')
        mk(box((0, 0, 0.362), (0.28, 0.20, 0.04), bev=0.012), OUT, 'torso')
    elif outfit_style == 'workshirt':
        for sx in (-1, 1):
            mk(box((sx * 0.09, -0.136, 0.28), (0.04, 0.014, 0.17)), DARK, 'torso')
            mk(box((sx * 0.09, 0.136, 0.28), (0.04, 0.014, 0.17)), DARK, 'torso')
        for i in (0, 1):
            mk(box((0, -0.14, 0.24 + i * 0.05), (0.015, 0.012, 0.015)), DARK, 'torso')

    # stub legs + BIG Kenney shoes
    for side, sx in (('leg-left', 1), ('leg-right', -1)):
        mk(cyl((sx * 0.105, 0, 0.075), 0.072, 0.075), pants_col, side)
        if outfit_style == 'overalls':
            mk(box((sx * 0.118, -0.085, 0.085), (0.06, 0.02, 0.05)), pants_col, side)
        mk(box((sx * 0.108, -0.035, 0.045), (0.155, 0.235, 0.09), bev=0.025), BOOTS, side)
    # arms — flared out (Kenney bind), mitten hands live in the SKIN mesh
    ARM_TILT = 0.16
    sleeve_col = OUT if outfit_style != 'vest' else SHIRT
    for side, sx in (('arm-left', 1), ('arm-right', -1)):
        a = cyl((sx * 0.245, 0, 0.265), 0.054, 0.16)
        a.rotation_euler.y = -sx * ARM_TILT
        mk(a, sleeve_col, side)
        mk(cyl((sx * 0.258, 0, 0.185), 0.06, 0.038), BELT, side)                      # cuff
    for sx in (-1, 1):
        mk(sph((sx * 0.225, 0, 0.305), 0.062), sleeve_col, 'torso')                   # shoulders
    finish_mesh([o for o in bpy.context.scene.objects if o.type == 'MESH'], 'body-mesh', arm)

    # ── SKIN unit (head-mesh): BIG Kenney head + face + ears + HANDS ──────────
    from _charlib import char_material
    mk(box((0, 0, 0.515), (0.44, 0.30, 0.295), bev=0.05), WHITE, 'head')
    for sx in (-1, 1):
        mk(box((sx * 0.10, -0.152, 0.50), (0.07, 0.014, 0.085), bev=0.012), DARK, 'head')   # eyes
        mk(box((sx * 0.10, -0.152, 0.565), (0.085, 0.012, 0.022)), DARK, 'head')            # brows
        mk(box((sx * 0.227, 0, 0.50), (0.025, 0.06, 0.07), bev=0.01), WHITE, 'head')        # ears
    for side, sx in (('arm-left', 1), ('arm-right', -1)):                                    # hands
        mk(sph((sx * 0.272, 0, 0.145), 0.062), WHITE, side)
    finish_mesh([o for o in bpy.context.scene.objects
                 if o.type == 'MESH' and o.name != 'body-mesh'], 'head-mesh', arm,
                material=char_material('skinMat'))

    idle_action(arm)
    walk_action(arm)
    export_char(char_id)


def gen_driver():
    build_character('char-driver-a', 'jacket', OUTFITS['jacket']['colorways']['blue'])


def gen_bodies():
    for style, d in OUTFITS.items():
        for cw, col in d['colorways'].items():
            build_character(f'body-{style}-{cw}', style, col)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
    mode = argv[0] if argv else 'all'
    if mode in ('driver', 'all'): gen_driver()
    if mode in ('bodies', 'all'): gen_bodies()
