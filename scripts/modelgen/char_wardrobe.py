# char_wardrobe — wardrobe piece generators + registry emitter.
# W1.1 (user art critique 2026-06-11): CUBIC hair + headwear (Minecraft/Kenney box
# style fitting the box head), satchel/bedroll rebuilt snug, vibrant saturated palette.
# USER-APPROVED ASSET LIST unchanged (6 hair, 6 headwear, 5 face, 3 back).
# Head box (bone-local): half-w 0.146, half-d 0.126, top 0.250, bottom 0.010.
# Hair = box shell margin ~0.012; hats = bigger box shells (margin ~0.03) over hair.
# Run: blender --background --python scripts/modelgen/char_wardrobe.py
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import clear_scene, tint, char_material, export_attachment, EXPORT_DIR
from char_mini import OUTFITS
import bpy

DARK = (0.09, 0.08, 0.08, 1.0)
HAIR_COLORS = {  # vibrant set (grey benched; red in, per art critique)
    'brown': (0.55, 0.32, 0.14, 1), 'black': (0.13, 0.12, 0.13, 1),
    'blond': (0.96, 0.78, 0.30, 1), 'red':   (0.80, 0.30, 0.10, 1),
}
SKIN_TONES = ['#f6d7b8', '#eebb94', '#dd9d6b', '#c08152', '#9c6240', '#7a4a30', '#5d3a26', '#43291b']

# Head-box fit constants (bone-local)
HW, HD, HTOP, HBOT = 0.146, 0.126, 0.250, 0.010


def soften(obj, levels=2):
    """Kenney-organic: box proportions + subdivision + smooth shading."""
    m = obj.modifiers.new('sub', 'SUBSURF')
    m.levels = m.render_levels = levels
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.shade_smooth()
    return obj


def box(c, s, col, name, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    tint(o, col)
    o.data.materials.append(char_material())
    return o


# ── HAIR (6, x4 colors) — v4: thick OVERLAPPING masses, bevel-rounded + smooth.
# (v3 lesson: subsurf SHRINKS boxes -> gaps/"balding". Bevel rounds WITHOUT
# shrinking; connectedness comes from real geometric overlap >= 0.02 everywhere.)
HX, HY = HW + 0.012, HD + 0.012          # hair shell half-extents

def hpiece(c, sz, col, name):
    o = box(c, sz, col, name)
    b = min(0.032, min(sz) / 3)
    m = o.modifiers.new('bvl', 'BEVEL')
    m.width, m.segments, m.limit_method = b, 3, 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.shade_smooth()
    return o


def _wrap(col, thick=0.085, side_drop=0.15, back_drop=0.19, grow=0.0):
    """Connected helmet wrap: top slab + side slabs + back slab, all overlapping."""
    hpiece((0, 0.012, HTOP + thick / 2 - 0.025), (2 * HX + grow, 2 * HY + grow, thick + 0.05), col, 'hair_top')
    for sx in (-1, 1):
        hpiece((sx * (HX + 0.006), 0.018, HTOP - side_drop / 2 + 0.02),
               (0.05, 2 * HY - 0.03, side_drop + 0.06), col, f'hair_side_{sx}')
    hpiece((0, HY + 0.002, HTOP - back_drop / 2 + 0.02),
           (2 * HX - 0.01, 0.06, back_drop + 0.06), col, 'hair_back')


def _fringe(col, w=0.25, drop=0.10, sweep=0.0):
    hpiece((sweep, -HY - 0.002, HTOP - drop / 2 + 0.015), (w, 0.055, drop + 0.06), col, 'hair_fringe')


def hair_short(col):
    _wrap(col)
    _fringe(col)


def hair_side(col):
    _wrap(col)
    _fringe(col, w=0.17, drop=0.115, sweep=0.05)
    _fringe(col, w=0.09, drop=0.07, sweep=-0.085)


def hair_buzz(col):
    _wrap(col, thick=0.055, side_drop=0.11, back_drop=0.13, grow=-0.025)


def hair_bob(col):
    _wrap(col, thick=0.095, side_drop=0.30, back_drop=0.34, grow=0.015)
    _fringe(col, w=0.28, drop=0.095)
    for sx in (-1, 1):                                  # extra width at the curtain bottoms
        hpiece((sx * (HX + 0.012), 0.018, 0.06), (0.055, 2 * HY - 0.02, 0.12), col, f'hair_curtain_{sx}')


def hair_pony(col):
    _wrap(col, thick=0.065)
    _fringe(col, w=0.22, drop=0.075)
    hpiece((0, HY + 0.03, 0.245), (0.10, 0.10, 0.085), col, 'hair_bun')
    hpiece((0, HY + 0.045, 0.115), (0.07, 0.065, 0.24), col, 'hair_tail')
    box((0, HY + 0.042, 0.205), (0.082, 0.07, 0.026), DARK, 'hair_tie')


def hair_curly(col):
    _wrap(col, thick=0.075)                             # base wrap keeps it connected
    for (x, y, z, sx, sy, sz) in (
        (0, 0.01, HTOP + 0.075, 0.27, 0.25, 0.12),
        (0.10, -0.05, HTOP + 0.035, 0.14, 0.13, 0.11), (-0.10, -0.05, HTOP + 0.035, 0.14, 0.13, 0.11),
        (0.105, 0.08, HTOP + 0.025, 0.14, 0.14, 0.12), (-0.105, 0.08, HTOP + 0.025, 0.14, 0.14, 0.12),
        (0, -0.10, HTOP + 0.02, 0.17, 0.11, 0.11), (0, 0.12, HTOP + 0.005, 0.19, 0.11, 0.13),
    ):
        hpiece((x, y, z), (sx, sy, sz), col, f'hair_puff_{x}_{y}')


# ── HEADWEAR (6) — box shells over the hair envelope ────────────────────────
WX, WY = HW + 0.034, HD + 0.034          # hat shell half-extents (covers hair tops)

def hw_tanker_cap(col=(0.62, 0.40, 0.18, 1)):
    box((0, 0.005, 0.315), (2 * WX, 2 * WY, 0.115), col, 'hat_crown')
    box((0, 0.005, 0.235), (2 * WX + 0.014, 2 * WY + 0.014, 0.055), col, 'hat_band')
    for i, x in ((0, -0.075), (1, 0.0), (2, 0.075)):
        box((x, 0.005, 0.378), (0.035, 2 * WY - 0.02, 0.024), col, f'hat_rib_{i}')
    for sx in (-1, 1):
        box((sx * (WX + 0.012), 0.015, 0.15), (0.028, 0.12, 0.16), col, f'hat_earflap_{sx}')


def hw_helmet(col=(0.42, 0.58, 0.30, 1)):
    box((0, 0.005, 0.315), (2 * WX + 0.01, 2 * WY + 0.01, 0.12), col, 'helmet_pot')
    box((0, 0.005, 0.243), (2 * WX + 0.045, 2 * WY + 0.045, 0.035), col, 'helmet_rim')


def hw_beanie(col=(0.92, 0.25, 0.20, 1)):
    box((0, 0.005, 0.31), (2 * WX - 0.01, 2 * WY - 0.01, 0.10), col, 'beanie_dome')
    box((0, 0.005, 0.243), (2 * WX + 0.01, 2 * WY + 0.01, 0.055), col, 'beanie_fold')
    box((0, 0.005, 0.385), (0.055, 0.055, 0.05), (0.96, 0.92, 0.80, 1), 'beanie_pom')


def hw_headset(col=DARK):
    acc = (0.95, 0.62, 0.10, 1)
    box((0, 0.005, 0.345), (0.34, 0.05, 0.035), col, 'headset_band')
    for sx in (-1, 1):
        box((sx * 0.18, 0.005, 0.21), (0.03, 0.05, 0.25), col, f'headset_arm_{sx}')
        box((sx * 0.19, 0.005, 0.075), (0.045, 0.095, 0.10), acc, f'headset_cup_{sx}')
    box((-0.165, -0.085, 0.05), (0.02, 0.13, 0.02), col, 'headset_boom')
    box((-0.16, -0.15, 0.04), (0.04, 0.04, 0.035), acc, 'headset_mic')


def hw_goggles_up(col=(0.55, 0.35, 0.15, 1)):
    lens = (0.35, 0.80, 0.85, 1)
    box((0, 0.005, 0.272), (2 * HX + 0.02, 2 * HY + 0.02, 0.045), DARK, 'goggle_strap')
    for sx in (-1, 1):
        box((sx * 0.062, -HY - 0.02, 0.272), (0.085, 0.04, 0.07), col, f'goggle_frame_{sx}')
        box((sx * 0.062, -HY - 0.042, 0.272), (0.062, 0.012, 0.05), lens, f'goggle_lens_{sx}')


def hw_ushanka(col=(0.72, 0.46, 0.24, 1)):
    fur = (0.94, 0.88, 0.74, 1)
    box((0, 0.005, 0.315), (2 * WX, 2 * WY, 0.11), col, 'ushanka_crown')
    box((0, 0.005, 0.245), (2 * WX + 0.025, 2 * WY + 0.025, 0.06), fur, 'ushanka_furband')
    for sx in (-1, 1):
        box((sx * (WX + 0.02), 0.02, 0.135), (0.045, 0.13, 0.22), fur, f'ushanka_flap_{sx}')
    box((0, -WY - 0.02, 0.30), (0.16, 0.055, 0.03), fur, 'ushanka_frontflap')


# ── FACE (5) — unchanged style (user-approved as great), brighter accents ───
def face_glasses(col=DARK):
    for sx in (-1, 1):
        box((sx * 0.062, -0.138, 0.145), (0.075, 0.014, 0.06), col, f'glasses_rim_{sx}')
        box((sx * 0.062, -0.142, 0.145), (0.055, 0.01, 0.042), (0.72, 0.88, 0.92, 1), f'glasses_lens_{sx}')
        box((sx * 0.105, -0.04, 0.152), (0.012, 0.19, 0.012), col, f'glasses_arm_{sx}')
    box((0, -0.138, 0.152), (0.05, 0.012, 0.012), col, 'glasses_bridge')


def face_shades(col=DARK):
    for sx in (-1, 1):
        box((sx * 0.062, -0.138, 0.145), (0.075, 0.018, 0.055), col, f'shades_lens_{sx}')
        box((sx * 0.105, -0.04, 0.152), (0.012, 0.19, 0.012), col, f'shades_arm_{sx}')
    box((0, -0.138, 0.155), (0.05, 0.014, 0.014), col, 'shades_bridge')


def face_mask(col=(0.88, 0.86, 0.78, 1)):
    box((0, -0.128, 0.085), (0.165, 0.055, 0.105), col, 'mask_body')
    for sx in (-1, 1):
        box((sx * 0.11, -0.04, 0.10), (0.012, 0.18, 0.012), DARK, f'mask_strap_{sx}')


def face_beard(col):
    box((0, -0.118, 0.025), (0.175, 0.06, 0.115), col, 'beard_chin')
    for sx in (-1, 1):
        box((sx * 0.105, -0.095, 0.075), (0.035, 0.05, 0.105), col, f'beard_cheek_{sx}')
    box((0, -0.137, 0.098), (0.095, 0.03, 0.028), col, 'beard_stache')


def face_stache(col):
    box((0, -0.135, 0.098), (0.10, 0.03, 0.03), col, 'stache')
    for sx in (-1, 1):
        box((sx * 0.058, -0.132, 0.092), (0.025, 0.026, 0.024), col, f'stache_tip_{sx}', rot=(0, sx * 0.3, 0))


# ── BACK (3) — toolpack kept (approved); satchel + bedroll rebuilt snug/cubic ─
def back_toolpack(col=(0.78, 0.52, 0.20, 1)):
    box((0, 0.165, 0.07), (0.21, 0.10, 0.23), col, 'pack_body')
    box((0, 0.16, 0.165), (0.215, 0.105, 0.05), DARK, 'pack_flap')
    box((0.05, 0.165, 0.225), (0.022, 0.022, 0.09), DARK, 'pack_wrench')
    for sx in (-1, 1):
        box((sx * 0.07, 0.10, 0.07), (0.03, 0.04, 0.20), DARK, f'pack_strap_{sx}')


def back_satchel(col=(0.85, 0.50, 0.18, 1)):
    box((0, 0.155, 0.02), (0.20, 0.075, 0.15), col, 'satchel_body')
    box((0, 0.158, 0.075), (0.205, 0.08, 0.05), DARK, 'satchel_flap')
    box((0, 0.16, -0.02), (0.06, 0.082, 0.035), DARK, 'satchel_clasp')
    for sx in (-1, 1):
        box((sx * 0.065, 0.10, 0.07), (0.028, 0.04, 0.18), DARK, f'satchel_strap_{sx}')


def back_bedroll(col=(0.36, 0.70, 0.38, 1)):
    box((0, 0.16, 0.17), (0.27, 0.095, 0.095), col, 'bedroll_body')
    for sx in (-1, 1):
        box((sx * 0.085, 0.16, 0.17), (0.03, 0.105, 0.105), DARK, f'bedroll_strap_{sx}')
        box((sx * 0.142, 0.16, 0.17), (0.014, 0.08, 0.08), (0.96, 0.92, 0.80, 1), f'bedroll_end_{sx}')


PIECES = [
    ('hw-tanker-cap', 'headwear', 'Tanker Cap', hw_tanker_cap, None),
    ('hw-helmet',     'headwear', 'Helmet',     hw_helmet,     None),
    ('hw-beanie',     'headwear', 'Beanie',     hw_beanie,     None),
    ('hw-headset',    'headwear', 'Headset',    hw_headset,    None),
    ('hw-goggles',    'headwear', 'Goggles',    hw_goggles_up, None),
    ('hw-ushanka',    'headwear', 'Ushanka',    hw_ushanka,    None),
    ('hair-short', 'hair', 'Short',     hair_short, True),
    ('hair-side',  'hair', 'Side Part', hair_side,  True),
    ('hair-buzz',  'hair', 'Buzz',      hair_buzz,  True),
    ('hair-bob',   'hair', 'Bob',       hair_bob,   True),
    ('hair-pony',  'hair', 'Ponytail',  hair_pony,  True),
    ('hair-curly', 'hair', 'Curly',     hair_curly, True),
    ('face-glasses', 'face', 'Glasses', face_glasses, None),
    ('face-shades',  'face', 'Shades',  face_shades,  None),
    ('face-mask',    'face', 'Mask',    face_mask,    None),
    ('face-beard',   'face', 'Beard',   face_beard,   True),
    ('face-stache',  'face', 'Stache',  face_stache,  True),
    ('back-toolpack', 'back', 'Toolpack', back_toolpack, None),
    ('back-satchel',  'back', 'Satchel',  back_satchel,  None),
    ('back-bedroll',  'back', 'Bedroll',  back_bedroll,  None),
]

registry = {
    'presets': [
        { 'id': 'char-driver-a', 'label': 'OG' },
        *[{ 'id': f'character-male-{c}', 'label': f'M{i+1}' } for i, c in enumerate('abcdef')],
        *[{ 'id': f'character-female-{c}', 'label': f'F{i+1}' } for i, c in enumerate('abcdef')],
    ],
    'skinTones': SKIN_TONES,
    'bodies': [{ 'model': f'body-{style}', 'label': d['label'],
                  'variants': [{ 'id': f'body-{style}-{cw}', 'cw': cw,
                                 'hex': '#%02x%02x%02x' % tuple(int(c * 255) for c in col[:3]) }
                               for cw, col in d['colorways'].items()] }
               for style, d in OUTFITS.items()],
    'slots': { 'hair': [], 'headwear': [], 'face': [], 'back': [] },
}

def hexc(col):
    return '#%02x%02x%02x' % tuple(int(max(0, min(1, c)) * 255) for c in col[:3])


for pid, slot, label, fn, colorways in PIECES:
    if colorways:
        variants = []
        for cname, col in HAIR_COLORS.items():
            clear_scene()
            fn(col)
            export_attachment(f'{pid}-{cname}')
            variants.append({ 'id': f'{pid}-{cname}', 'cw': cname, 'hex': hexc(col) })
        # ONE entry per MODEL with color variants (UI shows one button + color dots)
        registry['slots'][slot].append({ 'model': pid, 'label': label, 'variants': variants })
    else:
        clear_scene()
        fn()
        export_attachment(pid)
        registry['slots'][slot].append({ 'id': pid, 'label': label })

reg_path = os.path.abspath(os.path.join(EXPORT_DIR, 'wardrobe.json'))
with open(reg_path, 'w') as f:
    json.dump(registry, f, indent=2)
print(f'[modelgen] registry {reg_path} — '
      + ', '.join(f"{k}:{len(v)}" for k, v in registry['slots'].items())
      + f", bodies:{len(registry['bodies'])}, skinTones:{len(registry['skinTones'])}")
