# player_hull_base — M26 Pershing-inspired hull, original mesh (no third-party geometry).
# Stylized per TANKING_MODEL_SPEC.md; proportions from the real vehicle:
#   hull ~6.3m long x 3.5m wide, 6 road wheels/side, rear drive sprocket, front idler,
#   0.6m tracks, sloped glacis, fenders, rear engine deck.
# Axes (Batch-0 calibrated): Z=up, -Y=front, -X = tank's RIGHT.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, assign, add_mount_empty,
                  finalize_and_export, DOCTRINE_COLORS)
import bpy
import bmesh

# ── Dimensions (1u = 1m game scale) ─────────────────────────────────────────
HULL_LEN    = 6.3
BODY_W      = 2.2          # hull body between the tracks
TRACK_W     = 0.62
TRACK_GAP   = 0.04         # clearance between body and track
TRACK_CX    = BODY_W / 2 + TRACK_GAP + TRACK_W / 2   # ±1.45 → total width 3.52
LOWER_Z0, LOWER_Z1 = 0.50, 1.20    # lower hull box
UPPER_Z1    = 1.70                  # upper hull top (turret deck)
GLACIS_PULL = 1.10                  # how far the top-front edge slopes back
WHEEL_R     = 0.34
WHEEL_Z     = 0.50
WHEEL_Y0, WHEEL_Y1 = -2.20, 2.20    # 6 road wheels evenly spaced over this span
END_CY      = 2.75                  # idler (front) / sprocket (rear) centers ±Y
END_R       = 0.36                  # idler/sprocket radius (fills the track caps)
TRACK_R_OUT = 0.50                  # track band outer radius at the caps
TRACK_R_IN  = 0.36                  # → band thickness 0.14, top run at z=1.0
RING_Y      = -0.20                 # turret ring slightly forward of center

clear_scene()
body_mat = flat_material('player_body', DOCTRINE_COLORS['player'])
gear_mat = flat_material('gear_dark',  (0.16, 0.155, 0.15, 1.0))
trk_mat  = flat_material('track_dark', (0.115, 0.11, 0.105, 1.0))


def box(name, mat, center, size):
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, mat)
    return o


def wheel(name, x, y, z, r, depth, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(x, y, z),
                                        rotation=(0, math.pi / 2, 0))
    o = bpy.context.object
    o.name = name
    assign(o, mat)
    return o


def make_track(name, x_center):
    """Closed track band: stadium ribbon (outer/inner walls + side annuli) wrapping
    the idler and sprocket circles, extruded to TRACK_W. One manifold mesh."""
    n_arc = 12
    cz = WHEEL_Z

    def loop_pts(r):
        pts = []
        for i in range(n_arc + 1):                       # rear cap: bottom → top
            t = math.pi * i / n_arc
            pts.append((END_CY + r * math.sin(t), cz - r * math.cos(t)))
        for i in range(n_arc + 1):                       # front cap: top → bottom
            t = math.pi * i / n_arc
            pts.append((-END_CY - r * math.sin(t), cz + r * math.cos(t)))
        return pts

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    xl, xr = x_center - TRACK_W / 2, x_center + TRACK_W / 2
    V = {}
    for tag, r in (('out', TRACK_R_OUT), ('in', TRACK_R_IN)):
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
    assign(o, trk_mat)
    return o


# ── Hull body ────────────────────────────────────────────────────────────────
lower = box('hull_lower', body_mat, (0, 0, (LOWER_Z0 + LOWER_Z1) / 2),
            (BODY_W, HULL_LEN, LOWER_Z1 - LOWER_Z0))
for v in lower.data.vertices:                       # lower glacis: bottom-front tucks back
    if v.co.y < 0 and v.co.z < (LOWER_Z0 + LOWER_Z1) / 2:
        v.co.y += 0.45

upper = box('hull_upper', body_mat, (0, 0, (LOWER_Z1 + UPPER_Z1) / 2),
            (BODY_W, HULL_LEN, UPPER_Z1 - LOWER_Z1))
for v in upper.data.vertices:
    if v.co.y < 0 and v.co.z > (LOWER_Z1 + UPPER_Z1) / 2:
        v.co.y += GLACIS_PULL                       # main glacis slope
    if v.co.y > 0 and v.co.z > (LOWER_Z1 + UPPER_Z1) / 2:
        v.co.y -= 0.30                              # rear deck slope

# Fenders over the tracks (body color, like the real vehicle)
for side, x in (('right', -TRACK_CX), ('left', TRACK_CX)):
    box(f'fender_{side}', body_mat, (x, 0.05, 1.11), (TRACK_W + 0.06, HULL_LEN * 0.98, 0.08))

# Driver + co-driver hatches on the glacis top
for side, x in (('driver', -0.55), ('codriver', 0.55)):
    wheel_o = bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.19, depth=0.06,
                                                  location=(x, -1.55, UPPER_Z1 + 0.03))
    o = bpy.context.object
    o.name = f'hatch_{side}'
    assign(o, body_mat)

# Rear engine deck grilles ('engine' keyword → stays dark at runtime)
for i, gy in enumerate((1.55, 2.15, 2.70)):
    box(f'engine_grille_{i}', gear_mat, (0, gy, UPPER_Z1 + 0.015), (1.7, 0.42, 0.05))

# ── Running gear: 6 road wheels + idler + sprocket per side ────────────────
for side, x in (('r', -TRACK_CX), ('l', TRACK_CX)):
    for i in range(6):
        y = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * i / 5
        wheel(f'wheel_road_{side}{i}', x, y, WHEEL_Z, WHEEL_R, TRACK_W * 0.82, gear_mat)
        wheel(f'wheel_hub_{side}{i}',  x, y, WHEEL_Z, WHEEL_R * 0.45, TRACK_W * 0.88, trk_mat, verts=16)
    wheel(f'wheel_idler_{side}',    x, -END_CY, WHEEL_Z, END_R, TRACK_W * 0.78, gear_mat)
    wheel(f'wheel_sprocket_{side}', x,  END_CY, WHEEL_Z, END_R, TRACK_W * 0.78, gear_mat)

make_track('track_right', -TRACK_CX)
make_track('track_left',   TRACK_CX)

# ── Turret ring mount (Integration Contract) ────────────────────────────────
add_mount_empty('turret', (0, RING_Y, UPPER_Z1))

finalize_and_export('player_hull_base')
