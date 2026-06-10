# player_hull_base — M26 Pershing-inspired hull, original mesh (no third-party geometry).
# Stylized per TANKING_MODEL_SPEC.md. Axes (Batch-0): Z=up, -Y=front, -X = tank's RIGHT.
# ALL tunables come from params/player_tank.json (edited live by the Tank Tuner).
# Track geometry is DERIVED from wheel size so sliders can never break the wheel/track fit.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, track_material,
                  assign, add_mount_empty, bevel, make_profile_prism,
                  default_hull_profile,
                  finalize_and_export, load_params, tuner_mode, game_to_blender,
                  DOCTRINE_COLORS)
from _greebles import GREEBLES
import bpy
import bmesh

# ── Parameters (defaults = current canon; JSON overrides) ───────────────────
P = {
    'hullLen': 6.3, 'bodyW': 2.2, 'trackW': 0.62,
    'groundClear': 0.5, 'beltZ': 1.2, 'hullTop': 1.7,
    'glacisPull': 1.1, 'lowerGlacisPull': 0.45, 'rearDeckPull': 0.3,
    'wheelR': 0.34, 'wheelCount': 6, 'ringY': -0.2,
}
P.update(load_params('player_tank', 'hull'))

HULL_LEN, BODY_W, TRACK_W = P['hullLen'], P['bodyW'], P['trackW']
LOWER_Z0, LOWER_Z1, UPPER_Z1 = P['groundClear'], P['beltZ'], P['hullTop']
WHEEL_R, N_WHEELS = P['wheelR'], int(P['wheelCount'])

# Derived (feedback_no_hardcoding: derive, don't offset) ──────────────────────
TRACK_GAP   = 0.04
TRACK_CX    = BODY_W / 2 + TRACK_GAP + TRACK_W / 2
TRACK_R_OUT = WHEEL_R + 0.16          # band outer radius — bottom run sits at z=0
TRACK_R_IN  = WHEEL_R + 0.02          # band inner radius — wheels show through
WHEEL_Z     = TRACK_R_OUT             # wheel axle height
END_CY      = HULL_LEN / 2 - 0.40     # idler / sprocket centers
END_R       = TRACK_R_IN              # they fill the band's end caps exactly
# Road-wheel span DERIVED from the idler/sprocket radii so the end wheels can
# NEVER clip the drive wheels, at any slider combination (tuning-pass pins #1-4).
WHEEL_Y1    = END_CY - END_R - WHEEL_R - 0.06
WHEEL_Y0    = -WHEEL_Y1
FENDER_Z    = WHEEL_Z + TRACK_R_OUT + 0.11
# Upper hull stays INSIDE the track guards (tuning pass 2: "make the hull not
# overlap with the trackguards") — flush with the lower hull, fenders exposed.
UPPER_W     = BODY_W
UPPER_Z0    = max(LOWER_Z1, WHEEL_Z + TRACK_R_OUT + 0.06)
# Glacis nose taper only when the upper hull is wider than the nose target
NOSE_TAPER  = min(1.0, (BODY_W + 0.5) / UPPER_W)

clear_scene()
body_mat = flat_material('player_body', DOCTRINE_COLORS['player'])
gear_mat = gear_material()
trk_mat  = track_material()


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


# ── Hull body — profile prism (Sprocket-style control points) ───────────────
# params.hullProfile = ordered [zGame, yGame] loop, draggable in the tuner.
# Absent → derived from the legacy shape sliders (identical silhouette).
PROFILE = P.get('hullProfile') or default_hull_profile(P)
make_profile_prism('hull_body', body_mat, PROFILE, BODY_W)
HULL_TOP = max(gy for _, gy in PROFILE)

# Fenders over the tracks (body color, like the real vehicle)
for side, x in (('right', -TRACK_CX), ('left', TRACK_CX)):
    box(f'fender_{side}', body_mat, (x, 0.05, FENDER_Z), (TRACK_W + 0.06, HULL_LEN * 0.98, 0.08))

# M26-style fender stowage: flat, wide bins ON the track guards, ~70% of the
# guard length (tuning pass 2 pin — "look at how the m26 looks").
BIN_LEN = HULL_LEN * 0.98 * 0.70
for side, x in (('right', -TRACK_CX), ('left', TRACK_CX)):
    b = box(f'stowage_bin_{side}', body_mat, (x, 0.25, FENDER_Z + 0.04 + 0.09),
            (TRACK_W - 0.08, BIN_LEN, 0.18))
    bevel(b, width=0.025, segments=2)

# Twin Tiger-style exhausts on the rear plate (tuning-pass pin), armored-shroud look
rear_y = HULL_LEN / 2
for i, x in ((0, -0.38), (1, 0.38)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.115, depth=0.62,
                                        location=(x, rear_y + 0.06, LOWER_Z1 + 0.18))
    o = bpy.context.object
    o.name = f'exhaust_pipe_{i}'
    assign(o, gear_mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.085, depth=0.14,
                                        location=(x, rear_y + 0.06, LOWER_Z1 + 0.18 + 0.36))
    cap = bpy.context.object
    cap.name = f'exhaust_tip_{i}'
    assign(cap, gear_mat)

# Driver + co-driver hatches on the glacis top
for side, x in (('driver', -0.55), ('codriver', 0.55)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.19, depth=0.06,
                                        location=(x, -1.55, HULL_TOP + 0.03))
    o = bpy.context.object
    o.name = f'hatch_{side}'
    assign(o, body_mat)

# Rear engine deck grilles ('engine' keyword → stays dark at runtime)
for i, fy in enumerate((0.49, 0.68, 0.86)):
    box(f'engine_grille_{i}', gear_mat, (0, HULL_LEN / 2 * fy, HULL_TOP + 0.015),
        (BODY_W * 0.58, 0.42, 0.05))

# ── Running gear: N road wheels + idler + sprocket per side ─────────────────
for side, x in (('r', -TRACK_CX), ('l', TRACK_CX)):
    for i in range(N_WHEELS):
        y = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * i / max(N_WHEELS - 1, 1)
        wheel(f'wheel_road_{side}{i}', x, y, WHEEL_Z, WHEEL_R, TRACK_W * 0.82, gear_mat)
        wheel(f'wheel_hub_{side}{i}',  x, y, WHEEL_Z, WHEEL_R * 0.45, TRACK_W * 0.88, trk_mat, verts=16)
    wheel(f'wheel_idler_{side}',    x, -END_CY, WHEEL_Z, END_R, TRACK_W * 0.78, gear_mat)
    wheel(f'wheel_sprocket_{side}', x,  END_CY, WHEEL_Z, END_R, TRACK_W * 0.78, gear_mat)

make_track('track_right', -TRACK_CX)
make_track('track_left',   TRACK_CX)

# ── Attachments (greebles placed in the tuner) ───────────────────────────────
# Baked into the hull GLB for the game; SKIPPED in tuner mode (the tuner shows
# them as live draggable instances instead — same _greebles.py geometry).
if not tuner_mode():
    paint2 = flat_material('player_body', DOCTRINE_COLORS['player'])
    dark2 = gear_material()
    for i, att in enumerate(load_params('player_tank', 'attachments') or []):
        builder = GREEBLES.get(att.get('part'))
        if not builder:
            continue
        obj = builder(paint2, dark2)
        obj.name = f"{obj.name}_{i}"
        obj.location = game_to_blender(att['position'])
        obj.rotation_euler = (0, 0, -att.get('rotY', 0))   # game +Y rot = blender -Z rot
        s = att.get('scale', 1)
        obj.scale = (s, s, s)

# ── Turret ring mount (Integration Contract) ────────────────────────────────
add_mount_empty('turret', (0, P['ringY'], HULL_TOP))

finalize_and_export('player_hull_base')
