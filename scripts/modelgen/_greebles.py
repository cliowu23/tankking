# Greeble library — small parametric detail parts ("asymmetric stowage = lived-in").
# SINGLE geometry source: gen_greebles.py exports these as preview GLBs for the tuner,
# and player_hull_base.py builds the same functions when baking attachments — zero drift.
# Mesh names drive runtime paint: wheel_/track_/antenna_ stay dark, stowage_ gets painted.
# Authored at origin, Blender axes (Z up, -Y front), sized in game meters.
import bpy
import math


def _box(name, mat, center, size):
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def _cyl(name, mat, center, r, depth, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


def _join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    return o


# Each builder: (paint_mat, dark_mat) → single joined object at origin.
def jerrycan(paint, dark):
    body = _box('a', paint, (0, 0, 0.24), (0.35, 0.17, 0.48))
    handle = _box('b', dark, (0, 0, 0.52), (0.2, 0.05, 0.06))
    return _join([body, handle], 'stowage_jerrycan')


def crate(paint, dark):
    body = _box('a', paint, (0, 0, 0.21), (0.5, 0.42, 0.42))
    lid = _box('b', paint, (0, 0, 0.45), (0.54, 0.46, 0.06))
    return _join([body, lid], 'stowage_crate')


def tracklinks(paint, dark):
    rows = [_box(f't{i}', dark, (0, 0, 0.05 + i * 0.09), (0.62, 0.3, 0.07))
            for i in range(3)]
    return _join(rows, 'track_spare_links')


def toolbox(paint, dark):
    body = _box('a', paint, (0, 0, 0.1), (0.48, 0.2, 0.2))
    clasp = _box('b', dark, (0, -0.105, 0.1), (0.08, 0.02, 0.08))
    return _join([body, clasp], 'stowage_toolbox')


def antenna(paint, dark):
    base = _cyl('a', dark, (0, 0, 0.05), 0.04, 0.1, verts=10)
    rod = _cyl('b', dark, (0, 0, 0.7), 0.012, 1.3, verts=8)
    return _join([base, rod], 'antenna_whip')


def headlight(paint, dark):
    bracket = _box('a', paint, (0, 0.05, 0.07), (0.1, 0.1, 0.05))
    lamp = _cyl('b', dark, (0, -0.03, 0.1), 0.07, 0.12,
                rot=(math.pi / 2, 0, 0), verts=14)
    return _join([bracket, lamp], 'headlight_unit')


def sparewheel(paint, dark):
    tire = _cyl('a', dark, (0, 0, 0.13), 0.34, 0.22, verts=22)
    hub = _cyl('b', dark, (0, 0, 0.13), 0.15, 0.26, verts=14)
    return _join([tire, hub], 'wheel_spare')


def tarp(paint, dark):
    roll = _cyl('a', paint, (0, 0, 0.12), 0.12, 0.7,
                rot=(0, math.pi / 2, 0), verts=14)
    straps = [_cyl(f's{i}', dark, (x, 0, 0.12), 0.125, 0.04,
                   rot=(0, math.pi / 2, 0), verts=12) for i, x in ((0, -0.2), (1, 0.2))]
    return _join([roll] + straps, 'stowage_tarp')


GREEBLES = {
    'jerrycan':   jerrycan,
    'crate':      crate,
    'tracklinks': tracklinks,
    'toolbox':    toolbox,
    'antenna':    antenna,
    'headlight':  headlight,
    'sparewheel': sparewheel,
    'tarp':       tarp,
}
