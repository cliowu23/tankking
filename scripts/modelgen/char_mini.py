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
    'overalls':   { 'label': 'Mechanic Overalls', 'colorways': { 'denim': (0.22, 0.42, 0.78, 1), 'green': (0.24, 0.66, 0.30, 1) } },
    'vest':       { 'label': 'Merchant Vest',     'colorways': { 'rust': (0.85, 0.42, 0.15, 1) } },
    'medic':      { 'label': 'Medic Coat',        'colorways': { 'white': (0.95, 0.95, 0.93, 1) } },
    'telogreika': { 'label': 'Padded Jacket',     'colorways': { 'teal': (0.12, 0.62, 0.58, 1), 'mustard': (0.90, 0.68, 0.14, 1) } },
    'workshirt':  { 'label': 'Work Shirt',        'colorways': { 'red': (0.88, 0.22, 0.18, 1), 'yellow': (0.94, 0.78, 0.20, 1) } },
}

W = H = 1.12  # the plump-toyish house build (locked at the C1 gate)


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
    if outfit_style == 'workshirt':
        torso_col = OUT
    pants_col = OUT if outfit_style == 'overalls' else PANTS

    # ── BODY (outfit, no skin parts) ──────────────────────────────────────────
    mk(box((0, 0, 0.247), (0.285, 0.195, 0.055), bev=0.018), pants_col, 'root')
    mk(box((0, 0, 0.277), (0.295, 0.205, 0.034), bev=0.01), BELT, 'root')
    mk(box((0, -0.106, 0.277), (0.05, 0.012, 0.028)), DARK, 'root')                  # buckle
    mk(box((0, 0, 0.327), (0.30, 0.205, 0.105), bev=0.034), torso_col, 'torso')      # belly
    mk(box((0, 0, 0.398), (0.25, 0.17, 0.085), bev=0.024), torso_col, 'torso')       # chest

    if outfit_style == 'jacket':
        mk(box((0, -0.081, 0.413), (0.075, 0.014, 0.04)), SHIRT, 'torso')            # shirt v
        mk(box((0, 0, 0.439), (0.215, 0.15, 0.026), bev=0.008), OUT, 'torso')        # collar
        mk(box((0, -0.099, 0.355), (0.012, 0.012, 0.125)), DARK, 'torso')            # zip
        for sx in (-1, 1):
            mk(box((sx * 0.068, -0.099, 0.355), (0.055, 0.012, 0.04)), OUT, 'torso')
            mk(box((sx * 0.068, -0.102, 0.373), (0.055, 0.01, 0.012)), BELT, 'torso')
    elif outfit_style == 'overalls':
        mk(box((0, -0.103, 0.40), (0.165, 0.014, 0.13), bev=0.01), OUT, 'torso')     # bib
        mk(box((0, -0.107, 0.415), (0.075, 0.012, 0.05)), OUT, 'torso')              # bib pocket
        for sx in (-1, 1):                                                            # straps
            mk(box((sx * 0.07, -0.10, 0.455), (0.04, 0.014, 0.06)), OUT, 'torso')
            mk(box((sx * 0.07, 0.0, 0.468), (0.04, 0.20, 0.014)), OUT, 'torso')
    elif outfit_style == 'vest':
        for sx in (-1, 1):                                                            # front panels
            mk(box((sx * 0.078, -0.102, 0.385), (0.085, 0.014, 0.135), bev=0.01), OUT, 'torso')
        mk(box((0, 0.10, 0.385), (0.24, 0.016, 0.14), bev=0.01), OUT, 'torso')        # back panel
    elif outfit_style == 'medic':
        mk(box((0, -0.081, 0.413), (0.075, 0.014, 0.04)), SHIRT, 'torso')
        mk(box((0, 0, 0.439), (0.215, 0.15, 0.026), bev=0.008), OUT, 'torso')
        mk(box((0, 0, 0.245), (0.30, 0.21, 0.06), bev=0.015), OUT, 'root')            # coat hem
        mk(box((0.07, -0.103, 0.41), (0.035, 0.012, 0.012)), (0.8, 0.15, 0.12, 1), 'torso')  # red cross
        mk(box((0.07, -0.103, 0.41), (0.012, 0.012, 0.035)), (0.8, 0.15, 0.12, 1), 'torso')
    elif outfit_style == 'telogreika':
        for i, z in enumerate((0.305, 0.345, 0.385, 0.425)):                          # quilt ridges
            mk(box((0, -0.10, z), (0.235, 0.014, 0.016)), OUT, 'torso')
            mk(box((0, 0.10, z), (0.235, 0.014, 0.016)), OUT, 'torso')
        mk(box((0, 0, 0.445), (0.20, 0.155, 0.038), bev=0.01), OUT, 'torso')          # stand collar
    elif outfit_style == 'workshirt':
        for sx in (-1, 1):                                                            # suspenders
            mk(box((sx * 0.065, -0.102, 0.40), (0.032, 0.012, 0.14)), DARK, 'torso')
            mk(box((sx * 0.065, 0.102, 0.40), (0.032, 0.012, 0.14)), DARK, 'torso')
        for sx in (-1, 1):                                                            # chest buttons
            mk(box((0, -0.104, 0.36 + (sx + 1) * 0.02), (0.012, 0.01, 0.012)), DARK, 'torso')

    for side, sx in (('leg-left', 1), ('leg-right', -1)):
        mk(cyl((sx * 0.088, 0, 0.155), 0.062, 0.175), pants_col, side)
        mk(cyl((sx * 0.088, 0, 0.085), 0.067, 0.035), pants_col, side)
        mk(box((sx * 0.088, -0.025, 0.038), (0.13, 0.20, 0.076), bev=0.018), BOOTS, side)
    ARM_TILT = 0.12
    sleeve_col = OUT if outfit_style != 'vest' else SHIRT
    for side, sx in (('arm-left', 1), ('arm-right', -1)):
        a = cyl((sx * 0.193, 0, 0.30), 0.048, 0.17)
        a.rotation_euler.y = -sx * ARM_TILT
        mk(a, sleeve_col, side)
        mk(cyl((sx * 0.204, 0, 0.213), 0.054, 0.036), BELT, side)                     # cuff
    for sx in (-1, 1):
        mk(sph((sx * 0.182, 0, 0.403), 0.056), sleeve_col, 'torso')                   # shoulders
    finish_mesh([o for o in bpy.context.scene.objects if o.type == 'MESH'], 'body-mesh', arm)

    # ── SKIN unit (head-mesh): bald head + face + ears + HANDS ────────────────
    # Skin parts WHITE on 'skinMat' -> the game tints the material = COLOR WHEEL
    from _charlib import char_material
    mk(box((0, 0, 0.527), (0.26, 0.225, 0.215), bev=0.035), WHITE, 'head')
    for sx in (-1, 1):
        mk(box((sx * 0.056, -0.114, 0.54), (0.03, 0.012, 0.038)), DARK, 'head')       # eyes
        mk(box((sx * 0.056, -0.114, 0.572), (0.038, 0.01, 0.013)), DARK, 'head')      # brows
        mk(box((sx * 0.136, 0, 0.523), (0.02, 0.045, 0.055)), WHITE, 'head')          # ears
    for side, sx in (('arm-left', 1), ('arm-right', -1)):                             # bare hands
        mk(sph((sx * 0.208, 0, 0.17), 0.052), WHITE, side)
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
