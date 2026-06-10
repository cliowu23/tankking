# scripts/modelgen/_lib.py
# Shared helpers for TanKING procedural part generation.
# Run any part script headless:  blender --background --python scripts/modelgen/<part>.py
# Contract: _docs/TANKING_MODEL_SPEC.md → "INTEGRATION CONTRACT".
import bpy
import os

# One ring diameter for ALL doctrines — cross-doctrine turret/hull mixes compose at
# scale ≈ 1. Calibrated against the composed M26's measured base (1.83) in Batch 0.
STANDARD_RING_DIAMETER = 1.8

EXPORT_DIR = os.path.join(os.path.dirname(__file__), '..', '..',
                          'public', 'assets', 'models', 'tanks', 'parts')
PARAMS_DIR = os.path.join(os.path.dirname(__file__), 'params')


def load_params(tank, group):
    """Read a parameter group from the canon JSON (single source of truth — the
    tuner edits this same file). Missing file/group → empty dict; scripts merge
    over their own defaults."""
    import json
    path = os.path.join(PARAMS_DIR, f'{tank}.json')
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f).get(group, {}) or {}


def tuner_mode():
    """True when the tuner server invoked us: skip baking attachments into the
    hull GLB (the tuner previews them as live draggable instances instead)."""
    return os.environ.get('TANK_TUNER') == '1'


def game_to_blender(p):
    """Game-space [x,y,z] (Babylon, Y up, +Z fwd) → Blender (Z up, -Y front).
    Inverse of the Batch-0 calibrated mapping. Rotation about game Y = -rotation
    about Blender Z."""
    return (-p[0], -p[2], p[1])

# Doctrine preview colors (runtime paint replaces these — spec "Materials" section)
DOCTRINE_COLORS = {
    'light':   (0.545, 0.722, 0.478, 1.0),  # 8BB87A sage
    'medium':  (0.784, 0.663, 0.431, 1.0),  # C8A96E sand
    'heavy':   (0.420, 0.482, 0.553, 1.0),  # 6B7B8D steel blue-grey
    'player':  (0.361, 0.478, 0.306, 1.0),  # 5C7A4E olive (color decision pending)
    'teadee':  (0.176, 0.290, 0.478, 1.0),  # 2D4A7A navy
    'tanking': (0.545, 0.102, 0.102, 1.0),  # 8B1A1A deep red
}


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def flat_material(name, rgba, rough=0.9, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metallic
    return mat


def gear_material():
    """Dark gunmetal for running gear / fittings (unpaintable meshes keep this GLB
    material at runtime). Low metallic — with no env map, high metallic just
    desaturates to flat grey in Babylon."""
    return flat_material('gear_dark', (0.10, 0.097, 0.095, 1.0), rough=0.55, metallic=0.25)


def track_material():
    """Track metal — near-black, mostly dielectric so the dark base color shows."""
    return flat_material('track_dark', (0.055, 0.053, 0.05, 1.0), rough=0.72, metallic=0.12)


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def bevel(obj, width=0.05, segments=2):
    """Round an object's hard edges (angle-limited bevel, applied immediately)."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    m = obj.modifiers.new('bvl', 'BEVEL')
    m.width, m.segments, m.limit_method = width, segments, 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


def add_mount_empty(name, location):
    """Mount empties per the Integration Contract: 'turret' on hulls, 'mount' on turrets."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_size = 0.2
    empty.location = location
    bpy.context.collection.objects.link(empty)
    return empty


def finalize_and_export(part_id):
    """Apply transforms, sync mesh data names (paint system needs them), export GLB."""
    # MESHES ONLY — transform_apply on an empty ZEROES its location, which silently
    # destroys the mount empties ('turret'/'mount'). Found the hard way in Batch 0.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.data.name = obj.name
    out = os.path.abspath(os.path.join(EXPORT_DIR, f'{part_id}.glb'))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
    print(f'[modelgen] exported {out}')
    return out
