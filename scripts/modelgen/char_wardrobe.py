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
HW, HD, HTOP, HBOT = 0.222, 0.152, 0.205, -0.090   # Kenney-proportioned head (bone-local)


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


# ── HAIR — v6 "shell + sculpted hairline" (proven live vs Kenney refs 2026-06-11).
# Kenney formula (observed in-viewport): ONE thin shell hugging top/sides/back of
# the skull; ALL style lives in the hairline edge (diagonal sweep / arc / blunt).
# Built as a subdivided cube, faces deleted by per-style windows, solidified.
import bmesh as _bmesh
from _hairlib import lock
HX, HY = HW + 0.012, HD + 0.012

def hpiece(c, sz, col, name):
    o = box(c, sz, col, name)
    b = min(0.032, min(sz) / 3)
    m = o.modifiers.new('bvl', 'BEVEL')
    m.width, m.segments, m.limit_method = b, 3, 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.shade_smooth()
    return o


def hair_shell(col, hairline, cz=0.068, hz=0.148, shx=0.2245, shy=0.1545,
               side_cut=-0.005, nape_cut=-0.062, thick=0.028, bump=0.0, name='hair_shell'):
    # shell half-extents = head + 0.002 -> base surface touches the head; the
    # solidify grows OUTWARD, so the hair hugs instead of floating (user fix)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0.012, cz))
    o = bpy.context.object
    o.name = name
    o.scale = (shx, shy, hz)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.subdivide(number_cuts=9)
    bpy.ops.object.mode_set(mode='OBJECT')

    def keep(c):
        x, y, z = c.x, c.y - 0.012, c.z - cz
        if y < -0.11 and z < hairline(x):
            return False
        if z < side_cut and y < 0.06:
            return False
        if z < nape_cut:
            return False
        return True

    bm = _bmesh.new()
    bm.from_mesh(o.data)
    _bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())],
                      context='FACES')
    bm.to_mesh(o.data)
    bm.free()
    # snap the cut boundary to the exact hairline -> crisp straight edge, no staircase
    cell = 2 * hz / 10
    for v in o.data.vertices:
        x, y, z = v.co.x, v.co.y - 0.012, v.co.z - cz
        hl = hairline(x)
        if y < -0.07 and hl - cell * 0.2 <= z <= hl + cell * 1.3:
            v.co.z = cz + hl
    m = o.modifiers.new('sol', 'SOLIDIFY')
    m.thickness = thick
    m.offset = 1.0
    bpy.ops.object.modifier_apply(modifier=m.name)
    if bump > 0:                                  # curly: noisy outward push
        import math as _m
        for v in o.data.vertices:
            n = 0.5 + 0.5 * _m.sin(v.co.x * 53 + v.co.y * 71 + v.co.z * 37)
            d = (v.co - type(v.co)((0, 0.012, cz))).normalized()
            v.co += d * bump * n
    tint(o, col)
    o.data.materials.append(char_material())
    return o


def hair_short(col):                               # curtained hairline: high center,
    hair_shell(col, lambda x: 0.125 - 1.4 * x * x)     # temples covered (no corner gaps)


def hair_side(col):                                # the proven diagonal sweep
    hair_shell(col, lambda x: 0.118 - 0.22 * x)


def hair_bob(col):                                 # blunt low fringe + deep curtains
    hair_shell(col, lambda x: 0.092, cz=0.055, hz=0.175,
               side_cut=-0.095, nape_cut=-0.112, thick=0.032)


def hair_pony(col):                                # arc hairline + bun + thick tail
    hair_shell(col, lambda x: 0.125 - 1.2 * x * x)
    hpiece((0, HY + 0.035, 0.185), (0.10, 0.10, 0.085), col, 'hair_bun')
    o = lock([(0, HY + 0.05, 0.175), (0, HY + 0.105, 0.09),
              (0, HY + 0.10, -0.02), (0, HY + 0.06, -0.09)], radius=0.05, tip=0.3)
    o.name = 'hair_tail'
    tint(o, col)
    o.data.materials.append(char_material())
    box((0, HY + 0.045, 0.145), (0.10, 0.09, 0.03), DARK, 'hair_tie')


def hair_curly(col):                               # shell + noise puff
    hair_shell(col, lambda x: 0.090 + 1.0 * x * x, hz=0.16, thick=0.048, bump=0.026)


# ── HEADWEAR (6) — box shells over the hair envelope ────────────────────────
WX, WY = HW + 0.034, HD + 0.034          # hat shell half-extents (covers hair tops)

def hw_tanker_cap(col=(0.62, 0.40, 0.18, 1)):
    box((0, 0.005, 0.225), (2 * WX, 2 * WY, 0.125), col, 'hat_crown')
    box((0, 0.005, 0.145), (2 * WX + 0.014, 2 * WY + 0.014, 0.06), col, 'hat_band')
    for i, x in ((0, -0.075), (1, 0.0), (2, 0.075)):
        box((x, 0.005, 0.293), (0.04, 2 * WY - 0.02, 0.026), col, f'hat_rib_{i}')
    for sx in (-1, 1):
        box((sx * (WX + 0.012), 0.015, 0.045), (0.03, 0.13, 0.17), col, f'hat_earflap_{sx}')


def hw_helmet(col=(0.42, 0.58, 0.30, 1)):
    box((0, 0.005, 0.225), (2 * WX + 0.01, 2 * WY + 0.01, 0.13), col, 'helmet_pot')
    box((0, 0.005, 0.15), (2 * WX + 0.045, 2 * WY + 0.045, 0.04), col, 'helmet_rim')


def hw_beanie(col=(0.92, 0.25, 0.20, 1)):
    box((0, 0.005, 0.22), (2 * WX - 0.01, 2 * WY - 0.01, 0.11), col, 'beanie_dome')
    box((0, 0.005, 0.15), (2 * WX + 0.01, 2 * WY + 0.01, 0.06), col, 'beanie_fold')
    box((0, 0.005, 0.30), (0.06, 0.06, 0.055), (0.96, 0.92, 0.80, 1), 'beanie_pom')


def hw_headset(col=DARK):
    acc = (0.95, 0.62, 0.10, 1)
    box((0, 0.005, 0.26), (0.46, 0.055, 0.04), col, 'headset_band')
    for sx in (-1, 1):
        box((sx * 0.245, 0.005, 0.13), (0.035, 0.055, 0.26), col, f'headset_arm_{sx}')
        box((sx * 0.255, 0.005, 0.01), (0.05, 0.105, 0.11), acc, f'headset_cup_{sx}')
    box((-0.225, -0.10, -0.01), (0.022, 0.15, 0.022), col, 'headset_boom')
    box((-0.215, -0.175, -0.02), (0.045, 0.045, 0.04), acc, 'headset_mic')


def hw_goggles_up(col=(0.55, 0.35, 0.15, 1)):
    lens = (0.35, 0.80, 0.85, 1)
    box((0, 0.005, 0.175), (2 * HX + 0.02, 2 * HY + 0.02, 0.05), DARK, 'goggle_strap')
    for sx in (-1, 1):
        box((sx * 0.085, -HY - 0.025, 0.175), (0.10, 0.045, 0.08), col, f'goggle_frame_{sx}')
        box((sx * 0.085, -HY - 0.05, 0.175), (0.075, 0.014, 0.06), lens, f'goggle_lens_{sx}')


def hw_ushanka(col=(0.72, 0.46, 0.24, 1)):
    fur = (0.94, 0.88, 0.74, 1)
    box((0, 0.005, 0.225), (2 * WX, 2 * WY, 0.12), col, 'ushanka_crown')
    box((0, 0.005, 0.15), (2 * WX + 0.025, 2 * WY + 0.025, 0.065), fur, 'ushanka_furband')
    for sx in (-1, 1):
        box((sx * (WX + 0.02), 0.02, 0.03), (0.05, 0.14, 0.23), fur, f'ushanka_flap_{sx}')
    box((0, -WY - 0.02, 0.21), (0.20, 0.06, 0.034), fur, 'ushanka_frontflap')


# ── FACE (5) — unchanged style (user-approved as great), brighter accents ───
def face_glasses(col=DARK):
    for sx in (-1, 1):
        box((sx * 0.10, -0.168, 0.045), (0.095, 0.016, 0.075), col, f'glasses_rim_{sx}')
        box((sx * 0.10, -0.172, 0.045), (0.072, 0.012, 0.055), (0.72, 0.88, 0.92, 1), f'glasses_lens_{sx}')
        box((sx * 0.165, -0.04, 0.055), (0.014, 0.24, 0.014), col, f'glasses_arm_{sx}')
    box((0, -0.168, 0.055), (0.065, 0.014, 0.014), col, 'glasses_bridge')


def face_shades(col=DARK):
    for sx in (-1, 1):
        box((sx * 0.10, -0.168, 0.045), (0.095, 0.02, 0.07), col, f'shades_lens_{sx}')
        box((sx * 0.165, -0.04, 0.055), (0.014, 0.24, 0.014), col, f'shades_arm_{sx}')
    box((0, -0.168, 0.058), (0.065, 0.016, 0.016), col, 'shades_bridge')


def face_mask(col=(0.88, 0.86, 0.78, 1)):
    box((0, -0.162, -0.015), (0.23, 0.06, 0.13), col, 'mask_body')
    for sx in (-1, 1):
        box((sx * 0.17, -0.04, 0.0), (0.014, 0.23, 0.014), DARK, f'mask_strap_{sx}')


def face_beard(col):
    box((0, -0.15, -0.065), (0.25, 0.065, 0.13), col, 'beard_chin')
    for sx in (-1, 1):
        box((sx * 0.155, -0.12, -0.01), (0.045, 0.055, 0.12), col, f'beard_cheek_{sx}')
    box((0, -0.168, 0.0), (0.13, 0.034, 0.032), col, 'beard_stache')


def face_stache(col):
    box((0, -0.166, 0.0), (0.135, 0.034, 0.034), col, 'stache')
    for sx in (-1, 1):
        box((sx * 0.078, -0.162, -0.007), (0.03, 0.03, 0.028), col, f'stache_tip_{sx}', rot=(0, sx * 0.3, 0))


# ── BACK (3) — toolpack kept (approved); satchel + bedroll rebuilt snug/cubic ─
def back_toolpack(col=(0.78, 0.52, 0.20, 1)):
    box((0, 0.195, 0.04), (0.26, 0.11, 0.25), col, 'pack_body')
    box((0, 0.19, 0.145), (0.265, 0.115, 0.055), DARK, 'pack_flap')
    box((0.06, 0.195, 0.21), (0.025, 0.025, 0.10), DARK, 'pack_wrench')
    for sx in (-1, 1):
        box((sx * 0.09, 0.125, 0.04), (0.035, 0.045, 0.22), DARK, f'pack_strap_{sx}')


def back_satchel(col=(0.85, 0.50, 0.18, 1)):
    box((0, 0.19, -0.01), (0.25, 0.08, 0.16), col, 'satchel_body')
    box((0, 0.193, 0.05), (0.255, 0.085, 0.055), DARK, 'satchel_flap')
    box((0, 0.195, -0.05), (0.07, 0.088, 0.04), DARK, 'satchel_clasp')
    for sx in (-1, 1):
        box((sx * 0.085, 0.125, 0.03), (0.032, 0.045, 0.20), DARK, f'satchel_strap_{sx}')


def back_bedroll(col=(0.36, 0.70, 0.38, 1)):
    box((0, 0.195, 0.135), (0.33, 0.10, 0.10), col, 'bedroll_body')
    for sx in (-1, 1):
        box((sx * 0.105, 0.195, 0.135), (0.035, 0.11, 0.11), DARK, f'bedroll_strap_{sx}')
        box((sx * 0.172, 0.195, 0.135), (0.016, 0.085, 0.085), (0.96, 0.92, 0.80, 1), f'bedroll_end_{sx}')


PIECES = [
    ('hw-tanker-cap', 'headwear', 'Tanker Cap', hw_tanker_cap, None),
    ('hw-helmet',     'headwear', 'Helmet',     hw_helmet,     None),
    ('hw-beanie',     'headwear', 'Beanie',     hw_beanie,     None),
    ('hw-headset',    'headwear', 'Headset',    hw_headset,    None),
    ('hw-goggles',    'headwear', 'Goggles',    hw_goggles_up, None),
    ('hw-ushanka',    'headwear', 'Ushanka',    hw_ushanka,    None),
    ('hair-short', 'hair', 'Short',     hair_short, True),
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
