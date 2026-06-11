# char_wardrobe — wardrobe piece generators + registry emitter.
# USER-APPROVED ASSET LIST lives in the plan/spec; builders here implement exactly it.
# Pieces are static GLBs in characters/wardrobe/, authored at the target-bone origin
# (Blender Z=up, -Y=front, calibrated 2026-06-11). Fit contract constants in _charlib.
# Run: blender --background --python scripts/modelgen/char_wardrobe.py
# Emits: GLBs + public/assets/models/characters/wardrobe.json (UI registry).
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import (clear_scene, tint, char_material, export_attachment,
                      HAT_BRIM_Z, HAT_MIN_R, HAIR_MAX_Z, HAIR_MAX_R, EXPORT_DIR)
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


# ── HEADWEAR builders ─────────────────────────────────────────────────────────
def hw_tanker_cap(col=(0.35, 0.30, 0.24, 1)):
    """Padded Soviet tanker helmet — THE signature piece. Dome + 3 sagittal padded
    ribs + brow band + ear flaps."""
    sph((0, 0, HAT_BRIM_Z), 0.185, col, 'hat_dome', scale=(1, 1.05, 0.82))
    cyl((0, 0, HAT_BRIM_Z), 0.19, 0.055, col, 'hat_band')
    for i, x in ((0, -0.07), (1, 0.0), (2, 0.07)):
        torus((x, 0, HAT_BRIM_Z + 0.01), 0.155, 0.018, col, f'hat_rib_{i}',
              rot=(0, math.pi / 2, 0))
    for sx in (-1, 1):
        box((sx * 0.175, 0.01, 0.10), (0.028, 0.115, 0.13), col, f'hat_earflap_{sx}')


# ── HAIR builders (col injected per colorway) ────────────────────────────────
def hair_short(col):
    """Short crop: skull cap + small fringe; back/sides drop below the brim line."""
    sph((0, 0.005, 0.195), 0.163, col, 'hair_cap', scale=(1, 1.04, 0.72))
    box((0, -0.142, 0.165), (0.20, 0.035, 0.05), col, 'hair_fringe')
    box((0, 0.13, 0.10), (0.24, 0.05, 0.12), col, 'hair_back')


PIECES = [
    # (id, slot, label, build_fn, colorways: None | dict name)
    ('hw-tanker-cap', 'headwear', 'Tanker Cap', hw_tanker_cap, None),
    ('hair-short', 'hair', 'Short Crop', hair_short, 'HAIR_COLORS'),
]

# ── Build everything + emit the registry ─────────────────────────────────────
registry = {
    'presets': [
        { 'id': 'char-driver-a', 'label': 'OG' },
        *[{ 'id': f'character-male-{c}', 'label': f'M{i+1}' } for i, c in enumerate('abcdef')],
        *[{ 'id': f'character-female-{c}', 'label': f'F{i+1}' } for i, c in enumerate('abcdef')],
    ],
    'slots': { 'hair': [], 'headwear': [], 'face': [], 'back': [] },
}
# Legacy Kenney face accessories remain available until W2 replaces them
registry['slots']['face'] += [
    { 'id': 'aid-glasses', 'label': 'Glasses' },
    { 'id': 'aid-sunglasses', 'label': 'Shades' },
    { 'id': 'aid-mask', 'label': 'Mask' },
]

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
      + ', '.join(f"{k}:{len(v)}" for k, v in registry['slots'].items()))
