# scripts/modelgen/_lib.py
# Shared helpers for TanKING procedural part generation.
# Run any part script headless:  blender --background --python scripts/modelgen/<part>.py
# Contract: _docs/TANKING_MODEL_SPEC.md → "INTEGRATION CONTRACT".
import bpy
import bmesh
import math
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
    """Track metal — effectively black, fully dielectric, matte."""
    return flat_material('track_dark', (0.028, 0.027, 0.025, 1.0), rough=0.82, metallic=0.05)


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def make_box(name, mat, center, size):
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, mat)
    return o


def make_wheel(name, mat, x, y, z, r, depth, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(x, y, z), rotation=(0, math.pi / 2, 0))
    o = bpy.context.object
    o.name = name
    assign(o, mat)
    return o


def make_track_band(name, mat, x_center, track_w, end_cy, cz, r_out, r_in, n_arc=12):
    """Closed track band: stadium ribbon (outer/inner walls + side annuli) wrapping
    the idler and sprocket circles. One manifold mesh. (Hoisted from the player
    hull — the proven Batch-1 geometry, shared by every tracked vehicle.)"""
    def loop_pts(r):
        pts = []
        for i in range(n_arc + 1):
            t = math.pi * i / n_arc
            pts.append((end_cy + r * math.sin(t), cz - r * math.cos(t)))
        for i in range(n_arc + 1):
            t = math.pi * i / n_arc
            pts.append((-end_cy - r * math.sin(t), cz + r * math.cos(t)))
        return pts

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    xl, xr = x_center - track_w / 2, x_center + track_w / 2
    V = {}
    for tag, r in (('out', r_out), ('in', r_in)):
        for side, x in (('l', xl), ('r', xr)):
            V[(tag, side)] = [bm.verts.new((x, y, z)) for (y, z) in loop_pts(r)]
    n = len(V[('out', 'l')])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((V[('out', 'l')][i], V[('out', 'l')][j], V[('out', 'r')][j], V[('out', 'r')][i]))
        bm.faces.new((V[('in', 'l')][j],  V[('in', 'l')][i],  V[('in', 'r')][i],  V[('in', 'r')][j]))
        bm.faces.new((V[('out', 'l')][j], V[('out', 'l')][i], V[('in', 'l')][i],  V[('in', 'l')][j]))
        bm.faces.new((V[('out', 'r')][i], V[('out', 'r')][j], V[('in', 'r')][j],  V[('in', 'r')][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    return o


def make_profile_prism(name, mat, profile_game, width):
    """Solid hull body from a side-profile polygon (Sprocket-style control points).
    profile_game = ordered closed loop of [zGame(fwd), yGame(up)] pairs, as edited in
    the tuner. Extruded across X to `width`. Replaces the legacy box+vertex-pull body."""
    pts = [(-gz, gy) for gz, gy in profile_game]   # game [z,y] → blender (y=-z, z=y)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    xl, xr = -width / 2, width / 2
    L = [bm.verts.new((xl, y, z)) for (y, z) in pts]
    R = [bm.verts.new((xr, y, z)) for (y, z) in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((L[i], L[j], R[j], R[i]))     # wall quads
    bm.faces.new(L)                                 # side caps (planar n-gons)
    bm.faces.new(tuple(reversed(R)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    return o


def default_hull_profile(P):
    """Legacy-equivalent profile (game [z,y] pairs): exactly the outline the old
    lower+upper boxes with vertex pulls produced. Front = +z game."""
    L, gc, belt, top = P['hullLen'], P['groundClear'], P['beltZ'], P['hullTop']
    front, rear = L / 2, -L / 2
    return [
        [front - P['lowerGlacisPull'], gc],
        [front, belt],
        [front - P['glacisPull'], top],
        [rear + P['rearDeckPull'], top],
        [rear, belt],
        [rear, gc],
    ]


def bevel(obj, width=0.05, segments=2):
    """Round an object's hard edges (angle-limited bevel, applied immediately)."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    m = obj.modifiers.new('bvl', 'BEVEL')
    m.width, m.segments, m.limit_method = width, segments, 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


def make_hull_bmesh(name, mat, profile, width,
                    bow_taper=0.0, bow_taper_len=1.0,
                    bevel_width=0.06, bevel_segs=3, bevel_angle=20):
    """Solid hull body from a Blender-space side profile.
    profile: list of [y, z] pairs from front-bottom to rear-bottom (open chain,
    NOT closed). width: full hull width split ±X. bow_taper: fraction to narrow
    at the front tip (0 = no taper, 0.08 = 8% narrower). bow_taper_len: Y-distance
    from profile[0] over which the taper ramps up to full width.
    Applies an angle-limited bevel; returns the object."""
    front_y = profile[0][0]

    def half_w(y):
        if bow_taper <= 0:
            return width / 2
        t = max(0.0, min(1.0, (y - front_y) / bow_taper_len))
        return width / 2 * ((1.0 - bow_taper) + bow_taper * t)

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    L = [bm.verts.new((-half_w(y), y, z)) for y, z in profile]
    R = [bm.verts.new(( half_w(y), y, z)) for y, z in profile]
    n = len(profile)
    for i in range(n - 1):
        bm.faces.new((L[i], L[i + 1], R[i + 1], R[i]))
    bm.faces.new(L)
    bm.faces.new(list(reversed(R)))
    bm.faces.new((L[0], R[0], R[n - 1], L[n - 1]))     # floor quad closes the solid
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('bvl', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = bevel_width, bevel_segs, 'ANGLE'
    mod.angle_limit = math.radians(bevel_angle)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def make_lofted_turret(name, mat, cross_sections,
                       bevel_width=0.06, bevel_segs=3, bevel_angle=35):
    """Turret body via bmesh loft through octagonal cross-sections.
    cross_sections: list of dicts — each must have: z (Blender Z height),
    hw (half-width X), tf (front half-depth toward -Y), tr (rear half-depth +Y).
    Requires at least 2 entries. Closes the top with a cap; bottom is left open
    (the ring collar covers it). Applies bevel for cast-steel rounding."""

    def ring_pts(hw, tf, tr):
        return [
            (-hw * 0.55, -tf),
            ( hw * 0.55, -tf),
            ( hw,        -tf * 0.45),
            ( hw,         tr * 0.45),
            ( hw * 0.60,  tr),
            (-hw * 0.60,  tr),
            (-hw,         tr * 0.45),
            (-hw,        -tf * 0.45),
        ]

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    levels = []
    for cs in cross_sections:
        pts = ring_pts(cs['hw'], cs['tf'], cs['tr'])
        levels.append([bm.verts.new((x, y, cs['z'])) for x, y in pts])
    n = len(levels[0])
    for li in range(len(levels) - 1):
        lo, hi = levels[li], levels[li + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(list(reversed(levels[-1])))    # top cap
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('bvl', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = bevel_width, bevel_segs, 'ANGLE'
    mod.angle_limit = math.radians(bevel_angle)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


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
