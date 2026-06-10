# Greeble library — small parametric detail parts ("asymmetric stowage = lived-in").
# SINGLE geometry source: gen_greebles.py exports these as preview GLBs for the tuner,
# and player_hull_base.py builds the same functions when baking attachments — zero drift.
#
# Detail pass (2026-06-10) researched from the real WWII objects: jerry can X-stamp +
# triple handle, crate battens + rope handles, track-link guide horns, toolbox latches,
# antenna insulator + spring + tapered whip, headlight brush guard, spare-wheel bolt
# ring + lightening holes, segmented tarp roll with strap buckles.
#
# Two-tone contract: each builder returns ONE main object (painted at runtime) with an
# optional '<name>_trim_dark' child ('trim_dark' is an UNPAINTABLE keyword → stays dark).
# Names with wheel_/track_/antenna_ are dark already via the standard keywords.
# Authored at origin, Blender axes (Z up, -Y front), sized in game meters.
import bpy
import math


def _box(name, mat, center, size, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def _cyl(name, mat, center, r, depth, rot=(0, 0, 0), verts=16, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                            location=center, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2,
                                        depth=depth, location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o


def _torus(name, mat, center, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=center, rotation=rot,
                                     major_radius=major, minor_radius=minor,
                                     major_segments=20, minor_segments=10)
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
    # Normalize to identity: join inherits the ACTIVE part's object rotation, and
    # the attachment bake OVERWRITES rotation with the placement yaw — a rotated
    # first part (tarp!) ended up vertical in-game. Bake it into the mesh instead.
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o


def _two(name, paint_parts, dark_parts):
    """Join into painted main + dark '<name>_trim_dark' child. Returns the main."""
    main = _join(paint_parts, name) if paint_parts else None
    if dark_parts:
        dark = _join(dark_parts, f'{name}_trim_dark')
        if main:
            dark.parent = main
            dark.matrix_parent_inverse = main.matrix_world.inverted()
        else:
            main = dark
            main.name = name if not paint_parts else main.name
    return main


# ── Builders: (paint_mat, dark_mat) → main object at origin ──────────────────
def jerrycan(paint, dark):
    W, D, H = 0.36, 0.18, 0.46
    body = _box('a', paint, (0, 0, H / 2), (W, D, H))
    p = [body]
    # X-shaped stamped reinforcement on both faces (the signature) — thin diagonal
    # ribs proud of each side face, rotated about the face normal
    for fy in (-(D / 2 + 0.005), D / 2 + 0.005):
        for ang in (0.7, -0.7):
            p.append(_box('x', paint, (0, fy, H * 0.55), (0.32, 0.012, 0.05), rot=(0, ang, 0)))
    # triple top handles
    d = []
    for i, x in ((0, -0.09), (1, 0.0), (2, 0.09)):
        d.append(_box('h', dark, (x, 0, H + 0.035), (0.035, D * 0.7, 0.05)))
    # filler cap, offset to one end
    d.append(_cyl('cap', dark, (0.13, 0, H + 0.02), 0.035, 0.06, verts=10))
    return _two('stowage_jerrycan', p, d)


def crate(paint, dark):
    W, D, H = 0.52, 0.4, 0.34
    p = [_box('a', paint, (0, 0, H / 2), (W, D, H)),
         _box('lid', paint, (0, 0, H + 0.025), (W + 0.04, D + 0.04, 0.05))]
    # lid battens + corner reinforcements
    for x in (-W * 0.3, W * 0.3):
        p.append(_box('bat', paint, (x, 0, H + 0.06), (0.06, D + 0.02, 0.025)))
    d = []
    for x in (-(W / 2 + 0.012), W / 2 + 0.012):       # rope/steel end handles
        d.append(_box('hdl', dark, (x, 0, H * 0.62), (0.025, 0.16, 0.04)))
    for sx in (-1, 1):                                 # corner strips
        for sy in (-1, 1):
            d.append(_box('c', dark, (sx * (W / 2 - 0.015), sy * (D / 2 - 0.015), H / 2),
                          (0.03, 0.03, H)))
    return _two('stowage_crate', p, d)


def tracklinks(paint, dark):
    objs = []
    for i in range(3):
        z = 0.05 + i * 0.105
        jit = (i - 1) * 0.04
        objs.append(_box(f'pad{i}', dark, (jit, 0, z), (0.58, 0.30, 0.075)))
        for sx in (-0.26, 0.26):                       # end connector pins
            objs.append(_cyl(f'pin{i}', dark, (jit + sx, 0, z), 0.045, 0.34,
                             rot=(math.pi / 2, 0, 0), verts=10))
        objs.append(_box(f'horn{i}', dark, (jit, 0, z + 0.07), (0.07, 0.09, 0.07)))
    return _two('track_spare_links', [], objs)


def toolbox(paint, dark):
    W, D, H = 0.5, 0.22, 0.16
    p = [_box('a', paint, (0, 0, H / 2), (W, D, H)),
         _box('lid', paint, (0, 0, H + 0.02), (W + 0.03, D + 0.03, 0.045))]
    d = []
    for x in (-0.12, 0.12):                            # front latch clasps
        d.append(_box('latch', dark, (x, -(D / 2 + 0.012), H * 0.75), (0.045, 0.02, 0.07)))
    for x in (-(W / 2 + 0.014), W / 2 + 0.014):        # end carry handles
        d.append(_box('hdl', dark, (x, 0, H * 0.7), (0.024, 0.12, 0.035)))
    for y in (-D * 0.32, D * 0.32):                    # base runners
        d.append(_box('foot', dark, (0, y, 0.012), (W * 0.94, 0.03, 0.024)))
    return _two('stowage_toolbox', p, d)


def antenna(paint, dark):
    p = [_box('plate', paint, (0, 0, 0.015), (0.14, 0.14, 0.03)),
         _cyl('insulator', paint, (0, 0, 0.075), 0.05, 0.09, verts=12, r2=0.025)]
    d = [_cyl('spring', dark, (0, 0, 0.155), 0.028, 0.07, verts=10)]
    for i in range(3):                                 # spring coil ridges
        d.append(_cyl(f'coil{i}', dark, (0, 0, 0.135 + i * 0.022), 0.034, 0.012, verts=10))
    d.append(_cyl('whip', dark, (0, 0, 0.19 + 0.62), 0.013, 1.24, verts=8, r2=0.004))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.014,
                                         location=(0, 0, 0.19 + 1.24))
    tip = bpy.context.object
    tip.name = 'tip'
    tip.data.materials.append(dark)
    d.append(tip)
    return _two('antenna_whip', p, d)


def headlight(paint, dark):
    p = [_cyl('stalk', paint, (0, 0, 0.05), 0.022, 0.1, verts=10),
         _cyl('body', paint, (0, 0.02, 0.13), 0.07, 0.11, rot=(math.pi / 2, 0, 0), verts=14)]
    d = [_cyl('lens', dark, (0, -0.042, 0.13), 0.058, 0.02, rot=(math.pi / 2, 0, 0), verts=14)]
    # brush guard: three thin bars caged over the lens (the WWII signature)
    d.append(_box('bar_v', dark, (0, -0.062, 0.13), (0.014, 0.014, 0.15)))
    for ang in (0.7, -0.7):
        d.append(_box('bar_d', dark, (0, -0.062, 0.13), (0.014, 0.014, 0.15), rot=(0, ang, 0)))
    return _two('headlight_unit', p, d)


def sparewheel(paint, dark):
    # lying flat: tire torus + bolted disc + hub + fake lightening holes
    d = [_torus('tire', dark, (0, 0, 0.10), 0.27, 0.085)]
    p = [_cyl('disc', paint, (0, 0, 0.10), 0.24, 0.10, verts=20),
         _cyl('hub', paint, (0, 0, 0.165), 0.07, 0.05, verts=12)]
    for i in range(6):                                 # bolt ring
        a = i * math.pi / 3
        p.append(_cyl(f'bolt{i}', paint, (0.115 * math.cos(a), 0.115 * math.sin(a), 0.158),
                      0.018, 0.025, verts=8))
    for i in range(4):                                 # lightening holes (dark insets)
        a = i * math.pi / 2 + math.pi / 4
        d.append(_cyl(f'hole{i}', dark, (0.18 * math.cos(a), 0.18 * math.sin(a), 0.153),
                      0.034, 0.012, verts=10))
    main = _two('wheel_spare', p, d)
    return main


def tarp(paint, dark):
    # segmented canvas roll: bulges between cinch straps, inset ends
    p = []
    for cx, r, ln in ((-0.24, 0.115, 0.24), (0.0, 0.125, 0.26), (0.24, 0.115, 0.24)):
        p.append(_cyl(f'roll{cx}', paint, (cx, 0, 0.12), r, ln,
                      rot=(0, math.pi / 2, 0), verts=14))
    d = []
    for x in (-0.13, 0.13):                            # cinch straps + buckles
        d.append(_cyl(f'strap{x}', dark, (x, 0, 0.12), 0.128, 0.035,
                      rot=(0, math.pi / 2, 0), verts=14))
        d.append(_box(f'buckle{x}', dark, (x, -0.115, 0.18), (0.05, 0.02, 0.035)))
    for x in (-(0.36 + 0.008), 0.36 + 0.008):          # inset roll ends
        d.append(_cyl(f'end{x}', dark, (x, 0, 0.12), 0.095, 0.02,
                      rot=(0, math.pi / 2, 0), verts=12))
    return _two('stowage_tarp', p, d)


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
