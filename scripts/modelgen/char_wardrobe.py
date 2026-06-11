# char_wardrobe — wardrobe piece generators + registry emitter (W1: full approved set).
# USER-APPROVED ASSET LIST (plan 2026-06-11): 6 hair, 6 headwear, 5 face, 3 back —
# builders below implement exactly that list, nothing else without approval.
# Static GLBs in characters/wardrobe/, authored at the target-bone origin
# (Blender Z=up, -Y=front, calibrated). Fit contract constants in _charlib.
# Run: blender --background --python scripts/modelgen/char_wardrobe.py
# Emits: GLBs + public/assets/models/characters/wardrobe.json (UI registry).
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import (clear_scene, tint, char_material, export_attachment,
                      HAT_BRIM_Z, HAT_MIN_R, HAIR_MAX_Z, HAIR_MAX_R, EXPORT_DIR)
from char_mini import OUTFITS, SKINS
import bpy

DARK = (0.09, 0.08, 0.08, 1.0)
HAIR_COLORS = {
    'brown': (0.32, 0.20, 0.10, 1), 'black': (0.10, 0.09, 0.09, 1),
    'blond': (0.78, 0.62, 0.32, 1), 'grey':  (0.62, 0.62, 0.60, 1),
}


def box(c, s, col, name, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    tint(o, col)
    o.data.materials.append(char_material())
    return o


def sph(c, r, col, name, scale=(1, 1, 1), seg=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=9, radius=r, location=c)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    tint(o, col)
    o.data.materials.append(char_material())
    return o


def cyl(c, r, d, col, name, rot=(0, 0, 0), v=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    tint(o, col)
    o.data.materials.append(char_material())
    return o


def torus(c, major, minor, col, name, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=c, rotation=rot, major_radius=major,
                                     minor_radius=minor, major_segments=16, minor_segments=8)
    o = bpy.context.object
    o.name = name
    tint(o, col)
    o.data.materials.append(char_material())
    return o


# ── HEADWEAR (6) ──────────────────────────────────────────────────────────────
def hw_tanker_cap(col=(0.35, 0.30, 0.24, 1)):
    sph((0, 0, HAT_BRIM_Z), 0.185, col, 'hat_dome', scale=(1, 1.05, 0.82))
    cyl((0, 0, HAT_BRIM_Z), 0.19, 0.055, col, 'hat_band')
    for i, x in ((0, -0.07), (1, 0.0), (2, 0.07)):
        torus((x, 0, HAT_BRIM_Z + 0.01), 0.155, 0.018, col, f'hat_rib_{i}', rot=(0, math.pi / 2, 0))
    for sx in (-1, 1):
        box((sx * 0.175, 0.01, 0.10), (0.028, 0.115, 0.13), col, f'hat_earflap_{sx}')


def hw_helmet(col=(0.32, 0.36, 0.30, 1)):
    sph((0, 0, HAT_BRIM_Z + 0.005), 0.195, col, 'helmet_pot', scale=(1, 1.06, 0.78))
    cyl((0, 0, HAT_BRIM_Z - 0.015), 0.20, 0.028, col, 'helmet_rim')
    box((0, -0.19, HAT_BRIM_Z - 0.01), (0.10, 0.03, 0.02), col, 'helmet_browlip')


def hw_beanie(col=(0.55, 0.30, 0.22, 1)):
    sph((0, 0, HAT_BRIM_Z + 0.01), 0.176, col, 'beanie_dome', scale=(1, 1.03, 0.88))
    cyl((0, 0, HAT_BRIM_Z - 0.01), 0.182, 0.06, col, 'beanie_fold')
    sph((0, 0, HAT_BRIM_Z + 0.17), 0.035, col, 'beanie_pom', seg=10)


def hw_headset(col=DARK):
    torus((0, 0, HAT_BRIM_Z + 0.02), 0.175, 0.018, col, 'headset_band', rot=(0, math.pi / 2, 0))
    for sx in (-1, 1):
        cyl((sx * 0.165, 0, 0.07), 0.058, 0.045, col, f'headset_cup_{sx}', rot=(0, math.pi / 2, 0), v=14)
    box((-0.16, -0.09, 0.045), (0.018, 0.10, 0.018), col, 'headset_boom')
    sph((-0.155, -0.145, 0.04), 0.022, col, 'headset_mic', seg=8)


def hw_goggles_up(col=(0.30, 0.27, 0.22, 1)):
    cyl((0, 0, 0.215), 0.168, 0.035, DARK, 'goggle_strap')
    for sx in (-1, 1):
        cyl((sx * 0.058, -0.155, 0.225), 0.046, 0.04, col, f'goggle_lensrim_{sx}', rot=(math.pi / 2, 0, 0), v=14)
        cyl((sx * 0.058, -0.168, 0.225), 0.036, 0.012, (0.5, 0.65, 0.7, 1), f'goggle_lens_{sx}', rot=(math.pi / 2, 0, 0), v=12)


def hw_ushanka(col=(0.42, 0.34, 0.26, 1)):
    fur = (0.62, 0.55, 0.45, 1)
    sph((0, 0, HAT_BRIM_Z + 0.015), 0.182, col, 'ushanka_dome', scale=(1, 1.04, 0.85))
    cyl((0, 0, HAT_BRIM_Z - 0.01), 0.19, 0.065, fur, 'ushanka_furband')
    for sx in (-1, 1):
        box((sx * 0.175, 0.015, 0.05), (0.045, 0.125, 0.17), fur, f'ushanka_flap_{sx}')
    box((0, -0.165, 0.245), (0.14, 0.07, 0.025), fur, 'ushanka_frontflap', rot=(0.25, 0, 0))


# ── HAIR (6, ×4 colors; shell-contained above the brim line) ─────────────────
def hair_short(col):
    sph((0, 0.005, 0.195), 0.163, col, 'hair_cap', scale=(1, 1.04, 0.72))
    box((0, -0.142, 0.165), (0.20, 0.035, 0.05), col, 'hair_fringe')
    box((0, 0.13, 0.10), (0.24, 0.05, 0.12), col, 'hair_back')


def hair_side(col):
    sph((0, 0.005, 0.195), 0.163, col, 'hair_cap', scale=(1, 1.04, 0.72))
    box((0.045, -0.140, 0.17), (0.11, 0.035, 0.045), col, 'hair_fringe_main', rot=(0, 0.12, 0))
    box((-0.075, -0.138, 0.185), (0.06, 0.03, 0.03), col, 'hair_fringe_side')
    box((0, 0.13, 0.10), (0.24, 0.05, 0.12), col, 'hair_back')


def hair_buzz(col):
    sph((0, 0.003, 0.205), 0.152, col, 'hair_buzz', scale=(1, 1.02, 0.62))


def hair_bob(col):
    sph((0, 0.005, 0.19), 0.166, col, 'hair_cap', scale=(1, 1.05, 0.75))
    box((0, -0.140, 0.175), (0.22, 0.035, 0.045), col, 'hair_fringe')
    for sx in (-1, 1):
        box((sx * 0.155, 0.01, 0.07), (0.04, 0.16, 0.20), col, f'hair_curtain_{sx}')
    box((0, 0.145, 0.05), (0.27, 0.05, 0.22), col, 'hair_back')


def hair_pony(col):
    sph((0, 0.003, 0.20), 0.156, col, 'hair_cap', scale=(1, 1.02, 0.68))
    box((0, -0.140, 0.18), (0.18, 0.03, 0.035), col, 'hair_fringe')
    c = cyl((0, 0.175, 0.10), 0.042, 0.20, col, 'hair_tail', rot=(0.55, 0, 0), v=10)
    cyl((0, 0.155, 0.165), 0.05, 0.03, DARK, 'hair_tie', rot=(0.55, 0, 0), v=10)


def hair_curly(col):
    for (x, y, z, r) in ((0, 0, 0.24, 0.105), (0.09, -0.05, 0.215, 0.08), (-0.09, -0.05, 0.215, 0.08),
                         (0.095, 0.07, 0.21, 0.085), (-0.095, 0.07, 0.21, 0.085), (0, -0.10, 0.21, 0.085),
                         (0, 0.11, 0.20, 0.09)):
        sph((x, y, z), r, col, f'hair_curl_{x}_{y}', seg=10)


# ── FACE (5; beard/stache in hair colors) ────────────────────────────────────
def face_glasses(col=DARK):
    for sx in (-1, 1):
        torus((sx * 0.062, -0.135, 0.145), 0.042, 0.011, col, f'glasses_rim_{sx}', rot=(math.pi / 2, 0, 0))
        box((sx * 0.10, -0.04, 0.15), (0.012, 0.19, 0.012), col, f'glasses_arm_{sx}')
    box((0, -0.135, 0.15), (0.05, 0.012, 0.012), col, 'glasses_bridge')


def face_shades(col=DARK):
    for sx in (-1, 1):
        box((sx * 0.062, -0.138, 0.145), (0.075, 0.018, 0.055), col, f'shades_lens_{sx}')
        box((sx * 0.10, -0.04, 0.15), (0.012, 0.19, 0.012), col, f'shades_arm_{sx}')
    box((0, -0.138, 0.155), (0.05, 0.014, 0.014), col, 'shades_bridge')


def face_mask(col=(0.72, 0.70, 0.64, 1)):
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


# ── BACK (3; torso-bone frame: origin at torso bone, back plane y ≈ +0.115) ──
def back_toolpack(col=(0.42, 0.36, 0.26, 1)):
    box((0, 0.165, 0.07), (0.21, 0.10, 0.23), col, 'pack_body')
    box((0, 0.16, 0.165), (0.215, 0.105, 0.05), DARK, 'pack_flap')
    box((0.05, 0.165, 0.225), (0.022, 0.022, 0.09), DARK, 'pack_wrench')
    for sx in (-1, 1):
        box((sx * 0.07, 0.10, 0.07), (0.03, 0.04, 0.20), DARK, f'pack_strap_{sx}')


def back_satchel(col=(0.46, 0.32, 0.20, 1)):
    box((0, 0.16, 0.01), (0.19, 0.08, 0.135), col, 'satchel_body')
    box((0, 0.155, 0.065), (0.195, 0.085, 0.04), DARK, 'satchel_flap')
    box((0, 0.13, 0.16), (0.16, 0.025, 0.16), DARK, 'satchel_strap', rot=(0, 0.5, 0))


def back_bedroll(col=(0.52, 0.48, 0.38, 1)):
    cyl((0, 0.16, 0.16), 0.052, 0.25, col, 'bedroll', rot=(0, math.pi / 2, 0), v=12)
    for sx in (-1, 1):
        cyl((sx * 0.075, 0.16, 0.16), 0.056, 0.018, DARK, f'bedroll_strap_{sx}', rot=(0, math.pi / 2, 0), v=10)


PIECES = [
    ('hw-tanker-cap', 'headwear', 'Tanker Cap', hw_tanker_cap, None),
    ('hw-helmet',     'headwear', 'Helmet',     hw_helmet,     None),
    ('hw-beanie',     'headwear', 'Beanie',     hw_beanie,     None),
    ('hw-headset',    'headwear', 'Headset',    hw_headset,    None),
    ('hw-goggles',    'headwear', 'Goggles',    hw_goggles_up, None),
    ('hw-ushanka',    'headwear', 'Ushanka',    hw_ushanka,    None),
    ('hair-short', 'hair', 'Short',    hair_short, True),
    ('hair-side',  'hair', 'Side Part', hair_side, True),
    ('hair-buzz',  'hair', 'Buzz',     hair_buzz,  True),
    ('hair-bob',   'hair', 'Bob',      hair_bob,   True),
    ('hair-pony',  'hair', 'Ponytail', hair_pony,  True),
    ('hair-curly', 'hair', 'Curly',    hair_curly, True),
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
    'heads':  [{ 'id': f'char-skin-{s}', 'label': f'Skin {s.upper()}' } for s in SKINS],
    'bodies': [{ 'id': f'body-{style}-{cw}', 'label': f"{d['label']} ({cw})" }
               for style, d in OUTFITS.items() for cw in d['colorways']],
    'slots': { 'hair': [], 'headwear': [], 'face': [], 'back': [] },
}

for pid, slot, label, fn, colorways in PIECES:
    if colorways:
        for cname, col in HAIR_COLORS.items():
            clear_scene()
            fn(col)
            export_attachment(f'{pid}-{cname}')
            registry['slots'][slot].append({ 'id': f'{pid}-{cname}', 'label': f'{label} ({cname})' })
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
      + f", heads:{len(registry['heads'])}, bodies:{len(registry['bodies'])}")
