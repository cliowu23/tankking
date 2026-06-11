# light_hull_scout — M24 Chaffee-inspired Light doctrine hull. Fable detail pass.
# Stylized per TANKING_MODEL_SPEC.md. Axes: Z=up, -Y=front (tank faces -Y).
#
# The hull body is a single bmesh solid capturing the APPROVED Chaffee silhouette
# (profile data in params/light_tank.json — do not change): vertical lower nose,
# steep 46-degree glacis, rising crew deck, the iconic step DOWN to a lower
# engine deck, and a steep sloped rear plate.
#
# Detail doctrine (matches light_turret_enclosed):
#   * Glacis reads as a PLATE — raised beveled applique with weld-seam borders,
#     not smoothed clay. Driver + co-driver hatches sit at the TOP of the glacis
#     where it meets the deck, periscopes just ahead of them on the crest.
#   * Headlights with brush guards on the upper glacis — the classic WWII face.
#   * Fenders are thin sheet metal with drooped front/rear tips, support struts,
#     stowage boxes aft, toolbox + shovel forward.
#   * Engine deck: twin louvered grille panels (tilted to the real deck slope),
#     filler caps, twin exhausts, weld seams.
#   * Running gear with character: toothed rear drive sprockets (Chaffee is
#     rear-drive), dished front idlers, rimmed road wheels with hubs, return
#     rollers riding the inner track run.
#   * Rear plate: bolted engine access door, taillights, tow shackles, grab rails.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, track_material,
                  assign, add_mount_empty, bevel, make_track_band,
                  make_hull_bmesh, finalize_and_export, load_params, tuner_mode,
                  game_to_blender, DOCTRINE_COLORS)
from _greebles import GREEBLES
from _details import (bolt_row, weld_seam, lifting_eye, tow_shackle, periscope,
                      grab_handle)
import bpy

P = {
    'hullLen': 4.8,  'bodyW': 2.9,   'trackW': 0.55,
    'groundClear': 0.42, 'beltZ': 0.62, 'hullTop': 1.55,
    'glacisPull': 1.05, 'lowerGlacisPull': 0.18, 'rearDeckPull': 0.28,
    'wheelR': 0.24, 'wheelCount': 5, 'ringY': -0.34,
    'bowTaper': 0.10, 'bowTaperLen': 1.1,
    'profile': [
        [-2.40, 0.42], [-2.36, 0.74], [-1.61, 1.52],
        [-0.70, 1.55], [ 0.10, 1.55], [ 0.50, 1.54],
        [ 0.62, 1.34], [ 1.85, 1.30], [ 2.24, 0.66],
        [ 2.40, 0.42],
    ],
}
P.update(load_params('light_tank', 'hull'))

HULL_LEN  = P['hullLen'];  BODY_W    = P['bodyW'];    TRACK_W   = P['trackW']
LOWER_Z0  = P['groundClear']
WHEEL_R   = P['wheelR'];   N_WHEELS  = int(P['wheelCount'])

TRACK_GAP   = 0.04
TRACK_CX    = BODY_W / 2 + TRACK_GAP + TRACK_W / 2
TRACK_R_OUT = WHEEL_R + 0.16
TRACK_R_IN  = WHEEL_R + 0.02
WHEEL_Z     = TRACK_R_OUT
END_CY      = HULL_LEN / 2 - 0.38
END_R       = TRACK_R_IN
WHEEL_Y1    = END_CY - END_R - WHEEL_R - 0.05
WHEEL_Y0    = -WHEEL_Y1
FENDER_Z    = WHEEL_Z + TRACK_R_OUT + 0.10
OUTBOARD_X  = TRACK_CX + TRACK_W / 2 + 0.045   # just past the track band wall

# Key planes derived from the profile array (single source of truth)
_prof         = P['profile']
HF            = _prof[0][0]                    # -2.40  front Y
HR            = _prof[-1][0]                   # +2.40  rear Y
Z_FLOOR       = _prof[0][1]                    # 0.42
Z_BELT        = _prof[1][1]                    # 0.74   lower-nose top
Z_DECK        = _prof[2][1]                    # 1.52   glacis top
Z_TOP         = max(z for _, z in _prof)       # 1.55   crew-deck peak
HULL_TOP      = Z_TOP
Z_EDECK       = _prof[6][1]                    # 1.34   engine deck (front)
Z_EDECK_R     = _prof[7][1]                    # 1.30   engine deck (rear)
Y_GLACIS_BASE = _prof[1][0]                    # -2.36
Y_GLACIS_TOP  = _prof[2][0]                    # -1.61
Y_DECK_END    = _prof[5][0]                    # +0.50
Y_EDECK_START = _prof[6][0]                    # +0.62
Y_REAR_SLOPE  = _prof[7][0]                    # +1.85
Y_REAR_TIP    = HR
REAR_BASE_Y   = _prof[8][0]                    # +2.24  rear plate base
REAR_BASE_Z   = _prof[8][1]                    # +0.66

GLACIS_ANG = math.atan2(Z_DECK - Z_BELT, Y_GLACIS_TOP - Y_GLACIS_BASE)
GN         = (0, -math.sin(GLACIS_ANG), math.cos(GLACIS_ANG))  # glacis outward normal
BELT_Z     = Z_BELT                            # alias used by detail-pass bolt rows

EDECK_ANG  = math.atan2(Z_EDECK_R - Z_EDECK, Y_REAR_SLOPE - Y_EDECK_START)
REAR_ANG   = math.atan2(REAR_BASE_Z - Z_EDECK_R, REAR_BASE_Y - Y_REAR_SLOPE)
_rr        = math.hypot(REAR_BASE_Y - Y_REAR_SLOPE, REAR_BASE_Z - Z_EDECK_R)
RT         = ((REAR_BASE_Y - Y_REAR_SLOPE) / _rr, (REAR_BASE_Z - Z_EDECK_R) / _rr)
RN         = (-RT[1], RT[0])                   # rear plate outward normal (y,z)


def glacis_z(y):
    """Z of the upper glacis surface at Blender Y (valid on the glacis run)."""
    t = (y - Y_GLACIS_BASE) / (Y_GLACIS_TOP - Y_GLACIS_BASE)
    return Z_BELT + t * (Z_DECK - Z_BELT)


def glacis_pt(x, y, off):
    """Point `off` above the glacis surface along its outward normal."""
    return (x, y + GN[1] * off, glacis_z(y) + GN[2] * off)


def deck_z(y):
    """Z of the gently rising crew deck at Blender Y."""
    t = (y - Y_GLACIS_TOP) / (Y_DECK_END - Y_GLACIS_TOP)
    return Z_DECK + t * (Z_TOP - Z_DECK)


def edeck_z(y):
    """Z of the (slightly sloped) lower engine deck at Blender Y."""
    t = (y - Y_EDECK_START) / (Y_REAR_SLOPE - Y_EDECK_START)
    return Z_EDECK + t * (Z_EDECK_R - Z_EDECK)


def rear_pt(x, t, off):
    """Point on the sloped rear plate: t=0 top edge → t=1 base, `off` along normal."""
    y = Y_REAR_SLOPE + t * (REAR_BASE_Y - Y_REAR_SLOPE) + RN[0] * off
    z = Z_EDECK_R + t * (REAR_BASE_Z - Z_EDECK_R) + RN[1] * off
    return (x, y, z)


clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()
trk_mat  = track_material()


def _box(name, mat, c, s, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    assign(o, mat)
    return o


def _cyl(name, mat, c, r, d, rot=(0, 0, 0), v=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d,
                                        location=c, rotation=rot)
    o = bpy.context.object
    o.name = name
    assign(o, mat)
    return o


def _torus(name, mat, c, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=c, rotation=rot,
                                     major_radius=major, minor_radius=minor,
                                     major_segments=12, minor_segments=6)
    o = bpy.context.object
    o.name = name
    assign(o, mat)
    return o


# ================================================================== hull body
make_hull_bmesh('hull_body', body_mat, _prof, BODY_W,
                bow_taper=P['bowTaper'], bow_taper_len=P['bowTaperLen'])

# Nose cap — angled transmission-cover wedge across the lower bow. Leans
# forward ~10 deg at the top so the bow reads as a plate, not an open edge.
bpy.ops.mesh.primitive_cube_add(location=(0, HF + 0.04, (Z_FLOOR + Z_BELT) / 2))
nose = bpy.context.object
nose.name = 'hull_nose_cap'
nose.scale = (BODY_W * 0.92 / 2, 0.10, (Z_BELT - Z_FLOOR) / 2 + 0.03)
nose.rotation_euler.x = math.radians(10)
bpy.ops.object.transform_apply(rotation=True, scale=True)
bevel(nose, width=0.04, segments=2)
assign(nose, body_mat)
# Transmission-cover bolt strip across the nose face
bolt_row('nose_cover', gear_mat,
         (-BODY_W * 0.34, HF - 0.065, (Z_FLOOR + Z_BELT) / 2 + 0.04),
         ( BODY_W * 0.34, HF - 0.065, (Z_FLOOR + Z_BELT) / 2 + 0.04), 7, 'y')

# ================================================================ glacis face
# Raised armor plate — crisp beveled applique so the glacis reads as a single
# clean plate of rolled armor, framed by weld beads at the plate joins.
GLA_MID_Y = (Y_GLACIS_BASE + Y_GLACIS_TOP) / 2
GLA_RUN   = math.hypot(Y_GLACIS_TOP - Y_GLACIS_BASE, Z_DECK - Z_BELT)
gla = _box('glacis_plate', body_mat, glacis_pt(0, GLA_MID_Y, 0.012),
           (BODY_W * 0.86, GLA_RUN * 0.90, 0.05), rot=(GLACIS_ANG, 0, 0))
bevel(gla, width=0.02, segments=2)
weld_seam('glacis_deck_join', gear_mat,
          (0, Y_GLACIS_TOP + 0.02, Z_DECK + 0.004), BODY_W * 0.78, 'x')
weld_seam('glacis_belt_join', gear_mat,
          (0, Y_GLACIS_BASE + 0.02, Z_BELT + 0.025), BODY_W * 0.80, 'x')

# Driver + co-driver hatches — flat covers slightly proud of the crew deck at
# the TOP edge of the glacis (where the real Chaffee crew sat), with hinge
# blocks aft and pull handles forward.
HATCH_Y = -1.40
for name, x in (('hatch_driver', BODY_W * 0.27), ('hatch_codriver', -BODY_W * 0.27)):
    hz = deck_z(HATCH_Y)
    cover = _cyl(name, body_mat, (x, HATCH_Y, hz + 0.025), 0.18, 0.05, v=16)
    bevel(cover, width=0.015, segments=2)
    _box(f'{name}_hinge_trim_dark', gear_mat, (x, HATCH_Y + 0.20, hz + 0.022),
         (0.07, 0.05, 0.035))
    _box(f'{name}_handle_trim_dark', gear_mat, (x, HATCH_Y - 0.10, hz + 0.055),
         (0.06, 0.02, 0.02))

# Crew periscopes on the glacis crest, ahead of the hatches ('periscope' = dark)
periscope('driver',   gear_mat, ( BODY_W * 0.27, -1.63, Z_DECK + 0.025))
periscope('codriver', gear_mat, (-BODY_W * 0.27, -1.63, Z_DECK + 0.025))


# Headlights with brush guards on the upper glacis — the classic WWII face.
def headlight(tag, x):
    lamp_c = glacis_pt(x, -1.78, 0.115)
    _box(f'{tag}_base_trim_dark', gear_mat, glacis_pt(x, -1.78, 0.04),
         (0.08, 0.08, 0.08), rot=(GLACIS_ANG, 0, 0))
    _cyl(f'{tag}_lamp_trim_dark', gear_mat, lamp_c, 0.068, 0.11,
         rot=(math.pi / 2, 0, 0), v=12)
    _cyl(f'{tag}_lens', gear_mat,
         (lamp_c[0], lamp_c[1] - 0.058, lamp_c[2]), 0.052, 0.018,
         rot=(math.pi / 2, 0, 0), v=12)
    gy = lamp_c[1] - 0.095
    for sx in (-1, 1):   # brush-guard cage: two uprights + crossbar
        _box(f'{tag}_guard{sx}_trim_dark', gear_mat,
             (x + sx * 0.095, gy, lamp_c[2] - 0.015), (0.02, 0.02, 0.21),
             rot=(GLACIS_ANG * 0.5, 0, 0))
    _box(f'{tag}_guardtop_trim_dark', gear_mat,
         (x, gy, lamp_c[2] + 0.095), (0.21, 0.02, 0.02))


headlight('headlight_l',  1.12)
headlight('headlight_r', -1.12)

# Bow machine gun — ball casting half-set into the glacis plate, stub barrel
# along the plate normal ('mg' keyword = UNPAINTABLE). Right side, as built.
MG_X, MG_Y = -BODY_W * 0.30, -2.02
bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.115,
                                     location=glacis_pt(MG_X, MG_Y, 0.02))
mg_ball = bpy.context.object
mg_ball.name = 'mg_ball_mount'
assign(mg_ball, gear_mat)
_cyl('mg_hull_barrel', gear_mat, glacis_pt(MG_X, MG_Y, 0.20), 0.034, 0.30,
     rot=(GLACIS_ANG, 0, 0), v=10)

# ============================================================== rear armor
# Rear armor plate — spans the main slope from profile[7] to profile[8]
bpy.ops.mesh.primitive_cube_add(
    location=(0, (Y_REAR_SLOPE + REAR_BASE_Y) / 2 + 0.02,
              (Z_EDECK_R + REAR_BASE_Z) / 2 + 0.02))
rear_plate = bpy.context.object
rear_plate.name = 'hull_rear_plate'
rear_plate.scale = (BODY_W * 0.94 / 2, _rr / 2 * 0.92, 0.045)
rear_plate.rotation_euler.x = math.radians(90) - REAR_ANG
bpy.ops.object.transform_apply(rotation=True, scale=True)
assign(rear_plate, body_mat)

# Bolted circular engine access door in the center of the rear plate
_cyl('engine_access_door', gear_mat, rear_pt(0, 0.42, 0.085), 0.27, 0.05,
     rot=(REAR_ANG, 0, 0), v=16)
_door_c = rear_pt(0, 0.42, 0.10)
for k in range(8):
    a = k * 2 * math.pi / 8
    _cyl(f'engine_door_bolt{k}', gear_mat,
         (_door_c[0] + 0.33 * math.cos(a),
          _door_c[1] + RT[0] * 0.33 * math.sin(a),
          _door_c[2] + RT[1] * 0.33 * math.sin(a)),
         0.018, 0.03, rot=(REAR_ANG, 0, 0), v=8)

# Taillights, rear tow shackles, crew grab rails on the rear plate
for sx in (-1, 1):
    _box(f'taillight{sx}_trim_dark', gear_mat, rear_pt(sx * 1.00, 0.16, 0.07),
         (0.10, 0.05, 0.06))
    sb = rear_pt(sx * 0.95, 0.78, 0.05)
    _box(f'rear_shackle{sx}_base_trim_dark', gear_mat, sb, (0.10, 0.10, 0.10))
    _torus(f'rear_shackle{sx}_trim_dark', gear_mat,
           (sb[0], sb[1] + 0.08, sb[2]), 0.06, 0.018, rot=(math.pi / 2, 0, 0))
    grab_handle(f'rear{sx}', gear_mat, rear_pt(sx * 0.55, 0.40, 0.10))

# Turret-ring pedestal — fills the gap under the ring where it overhangs the
# glacis (ring sits forward at ringY; the deck slopes away beneath it).
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.04, radius2=0.96,
                                depth=Z_TOP - 1.02,
                                location=(0, P['ringY'], (Z_TOP + 1.02) / 2))
ped = bpy.context.object
ped.name = 'hull_ring_pedestal'
assign(ped, body_mat)

# ================================================================== fenders
# Thin sheet-metal fenders with drooped front/rear tips, support struts under
# the inner edge, stowage boxes aft, toolbox + pioneer shovel forward.
FEND_T       = 0.05
FENDER_LEN   = HULL_LEN * 0.77
FENDER_MID_Y = 0.06
FENDER_W     = TRACK_W + 0.08
FY0 = FENDER_MID_Y - FENDER_LEN / 2
FY1 = FENDER_MID_Y + FENDER_LEN / 2
for side, xs in (('left', 1), ('right', -1)):
    x = xs * TRACK_CX
    f = _box(f'fender_{side}', body_mat, (x, FENDER_MID_Y, FENDER_Z),
             (FENDER_W, FENDER_LEN, FEND_T))
    bevel(f, width=0.015, segments=2)
    _box(f'fender_{side}_tip_f', body_mat, (x, FY0 - 0.165, FENDER_Z - 0.067),
         (FENDER_W, 0.36, FEND_T), rot=(math.radians(22), 0, 0))
    _box(f'fender_{side}_tip_r', body_mat, (x, FY1 + 0.155, FENDER_Z - 0.057),
         (FENDER_W, 0.33, FEND_T), rot=(math.radians(-20), 0, 0))
    for i, sy in enumerate((-1.2, 0.0, 1.2)):
        _box(f'fender_{side}_strut{i}_trim_dark', gear_mat,
             (xs * (BODY_W / 2 + 0.02), sy, FENDER_Z - 0.095), (0.04, 0.05, 0.14))
    # Rear stowage box (paintable, like the real strapped-on bins)
    box = _box(f'stowage_{side}', body_mat, (x, 1.45, FENDER_Z + 0.175),
               (TRACK_W - 0.02, 0.78, 0.30))
    bevel(box, width=0.03, segments=2)
    for j, sy in enumerate((1.25, 1.65)):
        _box(f'stowage_{side}_strap{j}_trim_dark', gear_mat,
             (x, sy, FENDER_Z + 0.33), (TRACK_W - 0.01, 0.035, 0.018))

# Toolbox on the left front fender; pioneer shovel on the right
tbx = _box('toolbox_fender', body_mat, (TRACK_CX, -1.28, FENDER_Z + 0.125),
           (TRACK_W - 0.06, 0.55, 0.20))
bevel(tbx, width=0.02, segments=2)
_box('toolbox_clasp_trim_dark', gear_mat,
     (TRACK_CX, -1.28, FENDER_Z + 0.215), (0.08, 0.20, 0.025))
_cyl('shovel_shaft_trim_dark', gear_mat, (-TRACK_CX, -0.92, FENDER_Z + 0.05),
     0.02, 0.95, rot=(math.pi / 2, 0, 0), v=8)
_box('shovel_blade_trim_dark', gear_mat, (-TRACK_CX, -1.50, FENDER_Z + 0.05),
     (0.14, 0.24, 0.035))

# Tow cable run along the left hull side: cable + end eyes + clamps
CAB_X, CAB_Z = BODY_W / 2 + 0.035, 1.10
_cyl('towcable_run_trim_dark', gear_mat, (CAB_X, 0.45, CAB_Z), 0.024, 2.3,
     rot=(math.pi / 2, 0, 0), v=8)
for tag, ey in (('f', -0.72), ('r', 1.62)):
    _torus(f'towcable_eye_{tag}_trim_dark', gear_mat, (CAB_X, ey, CAB_Z),
           0.05, 0.016, rot=(0, math.pi / 2, 0))
for j, cy in enumerate((-0.20, 1.10)):
    _box(f'towcable_clamp{j}_trim_dark', gear_mat, (CAB_X - 0.015, cy, CAB_Z),
         (0.05, 0.06, 0.10))

# =============================================================== engine deck
# Twin louvered grille panels tilted to the true deck slope, center fuel
# fillers, twin exhaust stacks. ('engine'/'exhaust' keywords stay dark.)
GRILLE_Y = 1.08
for gi, gx in ((0, 0.62), (1, -0.62)):
    _box(f'engine_grille_{gi}', gear_mat,
         (gx, GRILLE_Y, edeck_z(GRILLE_Y) + 0.012), (0.86, 0.92, 0.024),
         rot=(EDECK_ANG, 0, 0))
    for si in range(6):
        sy = GRILLE_Y - 0.38 + si * 0.152
        _box(f'engine_grille_{gi}_slat{si}', gear_mat,
             (gx, sy, edeck_z(sy) + 0.034), (0.86, 0.062, 0.022),
             rot=(EDECK_ANG, 0, 0))
for fi, fy in ((0, 0.80), (1, 1.30)):
    _cyl(f'engine_filler_{fi}', gear_mat, (0, fy, edeck_z(fy) + 0.022),
         0.07, 0.045, v=12)
bolt_row('edeck_step', gear_mat,
         (-0.85, 0.70, edeck_z(0.70) + 0.012),
         ( 0.85, 0.70, edeck_z(0.70) + 0.012), 6, 'z')
weld_seam('deck_step_join', gear_mat,
          (0, Y_EDECK_START + 0.01, Z_EDECK + 0.004), BODY_W * 0.80, 'x')

# Twin Cadillac V8 exhaust stacks at the deck rear
for i, x in enumerate((-0.55, 0.55)):
    _cyl(f'exhaust_pipe_{i}', gear_mat, (x, 1.70, edeck_z(1.70) + 0.08),
         0.07, 0.30, v=10)
    cap = _cyl(f'exhaust_cap_{i}', gear_mat, (x, 1.70, edeck_z(1.70) + 0.235),
               0.085, 0.05, v=10)
    bevel(cap, width=0.015, segments=2)

# ============================================================== running gear
ROLLER_R = WHEEL_R * 0.38
for side, xs in (('l', 1), ('r', -1)):
    x  = xs * TRACK_CX
    ox = xs * OUTBOARD_X
    # Road wheels: rubber tire + dished disc + rim ring + proud hub
    for i in range(N_WHEELS):
        y = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * i / max(N_WHEELS - 1, 1)
        _cyl(f'wheel_tire_{side}{i}', trk_mat, (x, y, WHEEL_Z),
             WHEEL_R, TRACK_W * 0.72, rot=(0, math.pi / 2, 0), v=20)
        _cyl(f'wheel_disc_{side}{i}', gear_mat, (x, y, WHEEL_Z),
             WHEEL_R * 0.78, TRACK_W * 0.80, rot=(0, math.pi / 2, 0), v=16)
        _torus(f'wheel_rim_{side}{i}', gear_mat,
               (xs * (TRACK_CX + TRACK_W * 0.40), y, WHEEL_Z),
               WHEEL_R * 0.70, 0.014, rot=(0, math.pi / 2, 0))
        _cyl(f'wheel_hub_{side}{i}', gear_mat, (x, y, WHEEL_Z),
             0.075, TRACK_W * 0.92, rot=(0, math.pi / 2, 0), v=10)
    # Return rollers riding under the inner top run
    for j in range(4):
        ry = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * (j + 0.5) / 4
        rz = WHEEL_Z + TRACK_R_IN - ROLLER_R
        _cyl(f'wheel_roller_{side}{j}', gear_mat, (x, ry, rz),
             ROLLER_R, TRACK_W * 0.55, rot=(0, math.pi / 2, 0), v=10)
        _cyl(f'wheel_roller_hub_{side}{j}', gear_mat, (x, ry, rz),
             0.035, TRACK_W * 0.66, rot=(0, math.pi / 2, 0), v=8)
    # Front idler: drum + dished outboard face + rim ring + hub
    _cyl(f'idler_front_drum_{side}', gear_mat, (x, -END_CY, WHEEL_Z),
         END_R * 0.88, TRACK_W * 0.70, rot=(0, math.pi / 2, 0), v=14)
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.25, radius2=0.13,
                                    depth=0.05, location=(ox, -END_CY, WHEEL_Z),
                                    rotation=(0, xs * math.pi / 2, 0))
    dish = bpy.context.object
    dish.name = f'idler_front_dish_{side}'
    assign(dish, gear_mat)
    _torus(f'idler_front_rim_{side}', gear_mat, (ox, -END_CY, WHEEL_Z),
           0.245, 0.022, rot=(0, math.pi / 2, 0))
    _cyl(f'idler_front_hub_{side}', gear_mat,
         (ox + xs * 0.03, -END_CY, WHEEL_Z), 0.075, 0.06,
         rot=(0, math.pi / 2, 0), v=10)
    # Rear drive sprocket (Chaffee is rear-drive): drum + visible tooth ring
    _cyl(f'sprocket_rear_drum_{side}', gear_mat, (x, END_CY, WHEEL_Z),
         0.24, TRACK_W * 0.80, rot=(0, math.pi / 2, 0), v=14)
    _cyl(f'sprocket_rear_disc_{side}', gear_mat, (ox, END_CY, WHEEL_Z),
         0.30, 0.04, rot=(0, math.pi / 2, 0), v=18)
    for t in range(12):
        a = t * 2 * math.pi / 12
        _box(f'sprocket_tooth_{side}{t}', gear_mat,
             (ox, END_CY + 0.33 * math.sin(a), WHEEL_Z + 0.33 * math.cos(a)),
             (0.04, 0.055, 0.085), rot=(-a, 0, 0))
    _cyl(f'sprocket_hub_{side}', gear_mat, (ox + xs * 0.035, END_CY, WHEEL_Z),
         0.085, 0.06, rot=(0, math.pi / 2, 0), v=10)

make_track_band('track_left',   trk_mat,  TRACK_CX, TRACK_W, END_CY, WHEEL_Z, TRACK_R_OUT, TRACK_R_IN)
make_track_band('track_right',  trk_mat, -TRACK_CX, TRACK_W, END_CY, WHEEL_Z, TRACK_R_OUT, TRACK_R_IN)

# Stowage (baked from tuner attachments)
if not tuner_mode():
    p2 = flat_material('light_body', DOCTRINE_COLORS['light'])
    d2 = gear_material()
    for i, att in enumerate(load_params('light_tank', 'attachments') or []):
        builder = GREEBLES.get(att.get('part'))
        if not builder: continue
        obj = builder(p2, d2)
        obj.name = f"{obj.name}_{i}"
        obj.location = game_to_blender(att['position'])
        obj.rotation_euler = (0, 0, -att.get('rotY', 0))
        s = att.get('scale', 1); obj.scale = (s, s, s)

# Tertiary detail pass (anchored to the profile heights — the belt-line bolt
# rows make the side walls above the tracks read as bolted armor plate).
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'hull_belt_{nrm}', gear_mat,
             (sx * (BODY_W/2 + 0.01), -1.25, BELT_Z + 0.04),
             (sx * (BODY_W/2 + 0.01),  1.70, BELT_Z + 0.04), 10, nrm)
    bolt_row(f'hull_upper_{nrm}', gear_mat,
             (sx * (BODY_W/2 + 0.01), -0.55, 1.40),
             (sx * (BODY_W/2 + 0.01),  0.45, 1.40), 5, nrm)
bolt_row('glacis_top', gear_mat,
         (-BODY_W * 0.36, Y_GLACIS_TOP + 0.10, Z_DECK + 0.01),
         ( BODY_W * 0.36, Y_GLACIS_TOP + 0.10, Z_DECK + 0.01), 6, 'z')
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'fender_bolt_{nrm}', gear_mat,
             (sx * (TRACK_CX + FENDER_W / 2 - 0.02), -1.55, FENDER_Z),
             (sx * (TRACK_CX + FENDER_W / 2 - 0.02),  1.70, FENDER_Z), 7, nrm)
# Plate-join welds: engine-deck side edges + vertical side-wall joins
for sx in (-1, 1):
    weld_seam(f'roof{sx}', gear_mat,
              (sx * (BODY_W/2 - 0.01), (Y_EDECK_START + Y_REAR_SLOPE) / 2,
               edeck_z((Y_EDECK_START + Y_REAR_SLOPE) / 2) - 0.006),
              Y_REAR_SLOPE - Y_EDECK_START, 'y')
    for wi, wy in enumerate((-0.70, 0.55)):
        weld_seam(f'side{sx}_{wi}', gear_mat,
                  (sx * (BODY_W/2 + 0.005), wy, 0.78), 0.55, 'z')
for sx in (-1, 1):
    tow_shackle(f'bow{sx}', gear_mat,
                (sx * BODY_W * 0.36, -HULL_LEN/2 - 0.02, BELT_Z - 0.24))
for sx in (-1, 1):  # front pair on the glacis
    lifting_eye(f'hull{sx}-1', gear_mat,
                (sx * (BODY_W/2 - 0.15), -1.58, glacis_z(-1.58) + 0.06))
for sx in (-1, 1):  # rear pair on the engine deck
    lifting_eye(f'hull{sx}1', gear_mat,
                (sx * (BODY_W/2 - 0.15), 1.58, edeck_z(1.58) + 0.04))

add_mount_empty('turret', (0, P['ringY'], HULL_TOP))
finalize_and_export('light_hull_scout')
