# Micro-detail library — the TERTIARY tier of the Detail Doctrine (spec, 2026-06-10).
# Every function = one nameable real-tank feature; density comes from repetition.
# All functional metal is dark: names end '_trim_dark' or carry an UNPAINTABLE
# keyword (periscope, vision). Each element ≤ ~30 verts; budget ~2k verts/tank.
# Placed off parametric anchors (plate edges, profile heights) → survives tuning.
import bpy
import math

_ROT = {'x': (0, math.pi / 2, 0), '-x': (0, -math.pi / 2, 0),
        'y': (math.pi / 2, 0, 0), '-y': (-math.pi / 2, 0, 0),
        'z': (0, 0, 0), '-z': (0, 0, 0)}


def _cyl(name, mat, c, r, d, rot=(0, 0, 0), v=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d,
                                        location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


def _box(name, mat, c, s):
    bpy.ops.mesh.primitive_cube_add(location=c)
    o = bpy.context.object
    o.name = name
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def bolt_row(tag, mat, p0, p1, count, normal='y', r=0.018):
    """Row of fastener heads between two points; normal = face they sit on."""
    for i in range(count):
        t = i / (count - 1) if count > 1 else 0.5
        c = tuple(a + (b - a) * t for a, b in zip(p0, p1))
        _cyl(f'{tag}_bolt{i}_trim_dark', mat, c, r, 0.035, _ROT[normal])


def weld_seam(tag, mat, center, length, axis='y', r=0.014):
    """Weld bead along a plate join (axis-aligned)."""
    rot = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}[axis]
    _cyl(f'{tag}_weld_trim_dark', mat, center, r, length, rot, v=6)


def lifting_eye(tag, mat, c):
    """Crane lifting eye — small standing ring (hull/turret corners on real tanks)."""
    bpy.ops.mesh.primitive_torus_add(location=c, rotation=(math.pi / 2, 0, 0),
                                     major_radius=0.05, minor_radius=0.015,
                                     major_segments=10, minor_segments=6)
    o = bpy.context.object
    o.name = f'{tag}_lifteye_trim_dark'
    o.data.materials.append(mat)


def tow_shackle(tag, mat, c):
    """Tow shackle on the bow/stern plate: base block + standing ring."""
    _box(f'{tag}_shacklebase_trim_dark', mat, c, (0.1, 0.06, 0.1))
    bpy.ops.mesh.primitive_torus_add(
        location=(c[0], c[1] - 0.05, c[2]), rotation=(math.pi / 2, 0, 0),
        major_radius=0.06, minor_radius=0.018, major_segments=10, minor_segments=6)
    o = bpy.context.object
    o.name = f'{tag}_shackle_trim_dark'
    o.data.materials.append(mat)


def periscope(tag, mat, c):
    """Crew periscope head — base block + forward visor ('periscope' = auto-dark)."""
    _box(f'{tag}_periscope_base', mat, c, (0.1, 0.09, 0.09))
    _box(f'{tag}_periscope_visor', mat, (c[0], c[1] - 0.045, c[2] + 0.045),
         (0.11, 0.03, 0.04))


def grab_handle(tag, mat, c, length=0.22):
    """Crew grab handle: crossbar + two posts (mounted on a rear/side face)."""
    _box(f'{tag}_handlebar_trim_dark', mat, c, (length, 0.022, 0.026))
    for sx in (-1, 1):
        _box(f'{tag}_handlepost{sx}_trim_dark', mat,
             (c[0] + sx * length / 2, c[1] - 0.035, c[2]), (0.022, 0.07, 0.022))


def vision_slit(tag, mat, c, w=0.3):
    """Driver vision slit — dark inset bar ('vision' = auto-dark)."""
    _box(f'{tag}_vision_slit', mat, c, (w, 0.035, 0.055))
