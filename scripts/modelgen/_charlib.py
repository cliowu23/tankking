# Character generation library — CHARACTER_MODEL_SPEC.md implementation.
# The 7-bone standard skeleton, rigid per-part skinning, vertex-color blocking,
# procedural idle/walk actions, and character-safe GLB export.
# NOTE: characters are NEVER transform-applied (armatures break) — author at identity.
import bpy
import math
import os

EXPORT_DIR = os.path.join(os.path.dirname(__file__), '..', '..',
                          'public', 'assets', 'models', 'characters')

# The standard skeleton (Integration Contract): identical across ALL variants.
# All bones straight/vertical, roll 0 → swing fwd/back = bone-local X everywhere.
# Heights in bind-pose units (total character ≈ 0.67 incl. head mesh).
BONES = [
    # name        head(x,y,z)          tail(x,y,z)         parent
    ('root',      (0, 0, 0.30),        (0, 0, 0.36),       None),
    ('leg-left',  (0.085, 0, 0.30),    (0.085, 0, 0.02),   'root'),
    ('leg-right', (-0.085, 0, 0.30),   (-0.085, 0, 0.02),  'root'),
    ('torso',     (0, 0, 0.30),        (0, 0, 0.46),       'root'),
    ('arm-left',  (0.175, 0, 0.435),   (0.175, 0, 0.22),   'torso'),
    ('arm-right', (-0.175, 0, 0.435),  (-0.175, 0, 0.22),  'torso'),
    ('head',      (0, 0, 0.46),        (0, 0, 0.67),       'torso'),
]


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def make_armature():
    data = bpy.data.armatures.new('Rig')
    arm = bpy.data.objects.new('Rig', data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for name, head, tail, parent in BONES:
        eb = data.edit_bones.new(name)
        eb.head, eb.tail, eb.roll = head, tail, 0.0
        if parent:
            eb.parent = ebs[parent]
        ebs[name] = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def char_material():
    """ONE material for the whole character — color comes from vertex colors
    (multiple materials would split glTF primitives and break the 2-mesh contract)."""
    mat = bpy.data.materials.get('charMat')
    if mat is None:
        mat = bpy.data.materials.new('charMat')
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.85
        vc = nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def tint(obj, rgba):
    """Flood the part with one vertex color (the color-blocking primitive)."""
    col = obj.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for d in col.data:
        d.color = rgba


def bind_part(obj, bone):
    """Rigid skinning: every vertex of this part → 100% to one bone."""
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')


def finish_mesh(parts, name, arm):
    """Join parts (vertex groups + colors survive) into ONE named skinned mesh."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(char_material())
    obj.parent = arm
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    return obj


def add_action(arm, name, frames):
    """Procedural clip. frames = {frame: {bone: (rx, ry, rz) | (rx, ry, rz, lift)}}.
    lift = bone-local Y offset (vertical for our straight bones — used for bobs).
    Pushed to an NLA strip so multiple actions export as separate glTF animations."""
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    for f in sorted(frames):
        for bone, pose in frames[f].items():
            pb = arm.pose.bones[bone]
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = pose[:3]
            pb.keyframe_insert('rotation_euler', frame=f)
            if len(pose) > 3:
                pb.location = (0.0, pose[3], 0.0)
                pb.keyframe_insert('location', frame=f)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(min(frames)), act)
    strip.name = name
    arm.animation_data.action = None
    return act


def idle_action(arm):
    """~2.4s breathing loop (24fps, frames 1-58, first==last)."""
    b, frames = 0.004, {}
    for f, t in ((1, 0.0), (15, 0.5), (29, 1.0), (43, 1.5), (58, 2.0)):
        s = math.sin(t * math.pi)
        frames[f] = {
            'torso':     (0.015 * s, 0, 0, b * s),
            'arm-left':  (0.04 * s, 0, 0.03),
            'arm-right': (-0.04 * s, 0, -0.03),
            'head':      (0, 0.05 * math.sin(t * math.pi / 2), 0),
            'root':      (0, 0, 0),
        }
    return add_action(arm, 'idle', frames)


def walk_action(arm):
    """~0.8s stride loop (24fps, frames 1-20, first==last). Opposite arm/leg swing."""
    SW, AR = 0.55, 0.42
    frames = {}
    for f, t in ((1, 0.0), (6, 0.25), (11, 0.5), (16, 0.75), (20, 1.0)):
        s = math.sin(t * 2 * math.pi)
        bob = 0.008 * abs(math.sin(t * 2 * math.pi))
        frames[f] = {
            'leg-left':  (SW * s, 0, 0),
            'leg-right': (-SW * s, 0, 0),
            'arm-left':  (-AR * s, 0, 0.04),
            'arm-right': (AR * s, 0, -0.04),
            'torso':     (0.07, 0, 0),
            'root':      (0, 0, 0, bob),
        }
    return add_action(arm, 'walk', frames)


# ── Attachment (wardrobe) authoring frame ────────────────────────────────────
# Convention (decoded from Kenney aid-glasses + live calibration): author the piece
# in Blender at the ORIGIN = target bone origin, Z = up along the bone, front = -Y
# (same as characters). Attachments ride the BONE (unscaled), while character meshes
# carry the 1.12 build scale — so fit targets below are for the SCALED standard head.
ATT_SCALP_Z = 0.251    # top of the scaled bald head (bone-local)
# HAIR/HAT FIT CONTRACT (shell containment — supersedes the draft "crown plane"):
# hats fully SHELL hair above the brim line; hair below the brim peeks out (good!).
HAT_BRIM_Z  = 0.19     # hats are opaque from here up...
HAT_MIN_R   = 0.18     # ...with at least this inner radius
HAIR_MAX_Z  = 0.31     # hair above HAT_BRIM_Z must stay under this height...
HAIR_MAX_R  = 0.17     # ...and inside this radius (below the brim: free)
ATT_HEAD_W  = 0.292    # scaled head width  (head box 0.26 * 1.12)
ATT_HEAD_D  = 0.252    # scaled head depth
ATT_FACE_Y  = -0.126   # front face plane (-Y)
ATT_EYE_Z   = 0.145    # eye height, bone-local
ATT_BACK_Y  = 0.115    # torso-bone back plane (+Y) for the back slot
WARDROBE_DIR = os.path.join(EXPORT_DIR, 'wardrobe')


def export_attachment(att_id):
    """Static (unskinned, unanimated) wardrobe piece → characters/wardrobe/."""
    os.makedirs(WARDROBE_DIR, exist_ok=True)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.data.name = obj.name
    out = os.path.abspath(os.path.join(WARDROBE_DIR, f'{att_id}.glb'))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False)
    print(f'[modelgen] exported {out}')
    return out


def export_char(char_id, subdir=''):
    """Character-safe export: NO transform_apply anywhere (armature would break)."""
    out_dir = os.path.join(EXPORT_DIR, subdir) if subdir else EXPORT_DIR
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.abspath(os.path.join(out_dir, f'{char_id}.glb'))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                              export_animations=True, export_skins=True,
                              export_animation_mode='ACTIONS')
    print(f'[modelgen] exported {out}')
    return out
