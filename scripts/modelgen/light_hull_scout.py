# light_hull_scout — M24 Chaffee-inspired Light doctrine hull.
# Stylized per TANKING_MODEL_SPEC.md. Axes: Z=up, -Y=front (tank faces -Y).
# Hull body is a single bmesh solid capturing the real Chaffee silhouette:
# vertical lower nose, steep 47-degree glacis, rising crew deck, the iconic
# step DOWN to a lower engine deck, and a steep sloped rear plate.
# Tunables in params/light_tank.json (hull group).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, track_material,
                  assign, add_mount_empty, bevel, make_track_band,
                  finalize_and_export, load_params, tuner_mode,
                  game_to_blender, DOCTRINE_COLORS)
from _greebles import GREEBLES
from _details import bolt_row, weld_seam, lifting_eye, tow_shackle, periscope
import bpy
import bmesh

P = {
    'hullLen': 4.8,  'bodyW': 2.9,   'trackW': 0.55,
    'groundClear': 0.42, 'beltZ': 0.62, 'hullTop': 1.55,
    'glacisPull': 1.05, 'lowerGlacisPull': 0.18, 'rearDeckPull': 0.28,
    'wheelR': 0.24, 'wheelCount': 5, 'ringY': -0.34,
}
P.update(load_params('light_tank', 'hull'))

HULL_LEN  = P['hullLen'];  BODY_W    = P['bodyW'];    TRACK_W   = P['trackW']
LOWER_Z0  = P['groundClear']; BELT_Z = P['beltZ'];   HULL_TOP  = P['hullTop']
WHEEL_R   = P['wheelR'];   N_WHEELS  = int(P['wheelCount'])

TRACK_GAP  = 0.04
TRACK_CX   = BODY_W / 2 + TRACK_GAP + TRACK_W / 2
TRACK_R_OUT = WHEEL_R + 0.16
TRACK_R_IN  = WHEEL_R + 0.02
WHEEL_Z    = TRACK_R_OUT
END_CY     = HULL_LEN / 2 - 0.38
END_R      = TRACK_R_IN
WHEEL_Y1   = END_CY - END_R - WHEEL_R - 0.05
WHEEL_Y0   = -WHEEL_Y1
FENDER_Z   = WHEEL_Z + TRACK_R_OUT + 0.10

# ---- Chaffee silhouette key planes (all derived from tunables) -------------
HF = -HULL_LEN / 2          # front Y (Blender -Y = front)
HR =  HULL_LEN / 2          # rear Y

Z_FLOOR = LOWER_Z0          # 0.42 — hull floor
Z_BELT  = BELT_Z            # 0.62 — lower-nose top / glacis base / rear-plate base
Z_TOP   = HULL_TOP          # 1.55 — crew-deck peak (hull top)
Z_DECK  = HULL_TOP - 0.13   # 1.42 — crew deck at glacis junction
Z_EDECK = HULL_TOP - 0.23   # 1.32 — engine deck (sits LOWER — the iconic step)

Y_NOSE_TIP    = HF          # -2.40  lower-nose stub tip
Y_GLACIS_BASE = HF + 0.25   # -2.15  lower nose meets glacis
Y_GLACIS_TOP  = HF + 1.60   # -0.80  glacis tops out at crew deck
Y_DECK_END    = HR - 2.00   # +0.40  crew deck ends, step down begins
Y_EDECK_START = HR - 1.80   # +0.60  engine deck flat begins
Y_REAR_SLOPE  = HR - 0.40   # +2.00  rear plate slope starts
Y_REAR_TIP    = HR          # +2.40  rear stub

GLACIS_ANG = math.atan2(Z_DECK - Z_BELT, Y_GLACIS_TOP - Y_GLACIS_BASE)  # ~31 deg


def glacis_z(y):
    """Z of the upper glacis surface at Blender Y (valid on the glacis run)."""
    t = (y - Y_GLACIS_BASE) / (Y_GLACIS_TOP - Y_GLACIS_BASE)
    return Z_BELT + t * (Z_DECK - Z_BELT)


def deck_z(y):
    """Z of the gently rising crew deck at Blender Y."""
    t = (y - Y_GLACIS_TOP) / (Y_DECK_END - Y_GLACIS_TOP)
    return Z_DECK + t * (Z_TOP - Z_DECK)


clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()
trk_mat  = track_material()


# ---- Hull body — single bmesh solid from the Chaffee side profile ----------
def build_hull_body(name, mat):
    # Side profile, front-bottom going up-over-and-back (open at the floor;
    # closed by an explicit floor quad).
    profile = [
        (Y_NOSE_TIP,    Z_FLOOR),   # 0: floor front
        (Y_NOSE_TIP,    Z_BELT),    # 1: top of lower nose stub
        (Y_GLACIS_BASE, Z_BELT),    # 2: glacis base (small horizontal ledge)
        (Y_GLACIS_TOP,  Z_DECK),    # 3: top of the steep glacis
        (Y_DECK_END,    Z_TOP),     # 4: crew-deck peak (hull top)
        (Y_EDECK_START, Z_EDECK),   # 5: engine-step landing (lower!)
        (Y_REAR_SLOPE,  Z_EDECK),   # 6: engine deck rear edge
        (Y_REAR_TIP,    Z_BELT),    # 7: rear plate base
        (Y_REAR_TIP,    Z_FLOOR),   # 8: floor rear
    ]

    # Plan-view taper: the bow narrows ~8% over the front 1.0u.
    TAPER_LEN, TAPER_MIN = 1.0, 0.92
    def taper(y):
        if y > HF + TAPER_LEN:
            return 1.0
        t = (y - HF) / TAPER_LEN
        return TAPER_MIN + (1.0 - TAPER_MIN) * t

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    L = [bm.verts.new((-BODY_W / 2 * taper(y), y, z)) for y, z in profile]
    R = [bm.verts.new(( BODY_W / 2 * taper(y), y, z)) for y, z in profile]
    n = len(profile)
    for i in range(n - 1):                       # wall quads (open along floor)
        bm.faces.new((L[i], L[i + 1], R[i + 1], R[i]))
    bm.faces.new(L)                              # left cap (n-gon)
    bm.faces.new(list(reversed(R)))              # right cap
    bm.faces.new((L[0], R[0], R[n - 1], L[n - 1]))  # floor quad → closed solid
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    # Soften plate transitions (glacis base/top, engine step, all verticals).
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('bvl', 'BEVEL')
    mod.width, mod.segments, mod.limit_method = 0.06, 3, 'ANGLE'
    mod.angle_limit = math.radians(20)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


build_hull_body('hull_body', body_mat)

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

# Rear armor plate — thin slab lying flush on the sloped rear face for visual
# plate thickness (rotated to match the ~60 deg rear slope).
REAR_ANG = math.atan2(Z_EDECK - Z_BELT, Y_REAR_TIP - Y_REAR_SLOPE)  # from horiz
bpy.ops.mesh.primitive_cube_add(
    location=(0, (Y_REAR_SLOPE + Y_REAR_TIP) / 2 + 0.02, (Z_EDECK + Z_BELT) / 2 + 0.02))
rear_plate = bpy.context.object
rear_plate.name = 'hull_rear_plate'
REAR_RUN = math.hypot(Y_REAR_TIP - Y_REAR_SLOPE, Z_EDECK - Z_BELT)
rear_plate.scale = (BODY_W * 0.94 / 2, REAR_RUN / 2 * 0.92, 0.045)
rear_plate.rotation_euler.x = math.radians(90) - REAR_ANG
bpy.ops.object.transform_apply(rotation=True, scale=True)
assign(rear_plate, body_mat)

# Turret-ring pedestal — fills the gap under the ring where it overhangs the
# glacis (ring sits forward at ringY; the deck slopes away beneath it).
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.04, radius2=0.96,
                                depth=Z_TOP - 1.02,
                                location=(0, P['ringY'], (Z_TOP + 1.02) / 2))
ped = bpy.context.object
ped.name = 'hull_ring_pedestal'
assign(ped, body_mat)

# Fender skirts (body color — partial coverage, 77% of hull length)
FENDER_LEN = HULL_LEN * 0.77
FENDER_MID_Y = 0.06
for side, x in (('left', TRACK_CX), ('right', -TRACK_CX)):
    bpy.ops.mesh.primitive_cube_add(location=(x, FENDER_MID_Y, FENDER_Z))
    o = bpy.context.object
    o.name = f'fender_{side}'
    o.scale = (TRACK_W / 2 + 0.04, FENDER_LEN / 2, 0.055)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, body_mat)

# Engine grilles on the lowered rear deck ('engine' keyword stays dark)
for i, gy in enumerate((0.85, 1.25, 1.65)):
    bpy.ops.mesh.primitive_cube_add(location=(0, gy, Z_EDECK + 0.008))
    g = bpy.context.object
    g.name = f'engine_grille_{i}'
    g.scale = (BODY_W * 0.32, 0.16, 0.032)
    bpy.ops.object.transform_apply(scale=True)
    assign(g, gear_mat)

# Twin Cadillac V8 exhausts on the engine deck ('exhaust' = UNPAINTABLE)
for i, x in enumerate((-0.55, 0.55)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.068, depth=0.40,
                                        location=(x, 1.92, Z_EDECK - 0.03))
    o = bpy.context.object; o.name = f'exhaust_pipe_{i}'; assign(o, gear_mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.082, depth=0.055,
                                        location=(x, 1.92, Z_EDECK - 0.03 + 0.21))
    cap = bpy.context.object; cap.name = f'exhaust_cap_{i}'; assign(cap, gear_mat)

# Driver + co-driver hatches — set INTO the steep glacis, tilted to match it
# (the Chaffee crew hatches ride the sloped front roof).
HATCH_Y = -1.30
HATCH_N = (0, -math.sin(GLACIS_ANG), math.cos(GLACIS_ANG))   # glacis normal
for name, x in (('hatch_driver', BODY_W * 0.27), ('hatch_codriver', -BODY_W * 0.27)):
    sz = glacis_z(HATCH_Y)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=14, radius=0.165, depth=0.052,
        location=(x, HATCH_Y + HATCH_N[1] * 0.026, sz + HATCH_N[2] * 0.026),
        rotation=(GLACIS_ANG, 0, 0))
    o = bpy.context.object; o.name = name; assign(o, body_mat)

# Driver periscope at the glacis top edge ('periscope' = UNPAINTABLE)
periscope('driver', gear_mat, (BODY_W * 0.27, -0.88, glacis_z(-0.88) + 0.055))

# Hull MG ball mount in the glacis ('mg' keyword = UNPAINTABLE)
MG_Y = -1.90
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.052, depth=0.24,
                                    location=(-BODY_W * 0.30, MG_Y, glacis_z(MG_Y)),
                                    rotation=(GLACIS_ANG, 0, 0))
mg = bpy.context.object; mg.name = 'mg_hull_front'; assign(mg, gear_mat)

# Running gear
for side, xs in (('l', 1), ('r', -1)):
    x = xs * TRACK_CX
    for i in range(N_WHEELS):
        y = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * i / max(N_WHEELS - 1, 1)
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=WHEEL_R, depth=TRACK_W * 0.78,
                                            location=(x, y, WHEEL_Z), rotation=(0, math.pi/2, 0))
        o = bpy.context.object; o.name = f'wheel_road_{side}{i}'; assign(o, gear_mat)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=WHEEL_R * 0.40, depth=TRACK_W * 0.88,
                                            location=(x, y, WHEEL_Z), rotation=(0, math.pi/2, 0))
        hub = bpy.context.object; hub.name = f'wheel_hub_{side}{i}'; assign(hub, trk_mat)
    # 4 return rollers
    for j in range(4):
        ry = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * (j + 0.5) / 4
        rz = WHEEL_Z + TRACK_R_OUT + WHEEL_R * 0.38 - 0.04
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=WHEEL_R * 0.38, depth=TRACK_W * 0.58,
                                            location=(x, ry, rz), rotation=(0, math.pi/2, 0))
        roller = bpy.context.object; roller.name = f'wheel_roller_{side}{j}'; assign(roller, gear_mat)
    # Front idler
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=END_R * 0.88, depth=TRACK_W * 0.70,
                                        location=(x, -END_CY, WHEEL_Z), rotation=(0, math.pi/2, 0))
    idler = bpy.context.object; idler.name = f'idler_front_{side}'; assign(idler, gear_mat)
    # Rear drive sprocket (Chaffee-specific: rear drive)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=END_R, depth=TRACK_W * 0.78,
                                        location=(x, END_CY, WHEEL_Z), rotation=(0, math.pi/2, 0))
    sprocket = bpy.context.object; sprocket.name = f'sprocket_rear_{side}'; assign(sprocket, gear_mat)

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

# Tertiary detail pass (anchored to the new profile heights)
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'hull_belt_{nrm}', gear_mat,
             (sx * (BODY_W/2 + 0.01), -HULL_LEN * 0.30, BELT_Z + 0.04),
             (sx * (BODY_W/2 + 0.01),  HULL_LEN * 0.35, BELT_Z + 0.04), 8, nrm)
bolt_row('glacis_top', gear_mat,
         (-BODY_W * 0.36, Y_GLACIS_TOP + 0.10, Z_DECK + 0.01),
         ( BODY_W * 0.36, Y_GLACIS_TOP + 0.10, Z_DECK + 0.01), 6, 'z')
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'fender_bolt_{nrm}', gear_mat,
             (sx * (TRACK_CX - TRACK_W/2 - 0.01), -HULL_LEN * 0.18, FENDER_Z - 0.04),
             (sx * (TRACK_CX - TRACK_W/2 - 0.01),  HULL_LEN * 0.22, FENDER_Z - 0.04), 5, nrm)
for sx in (-1, 1):
    weld_seam(f'roof{sx}', gear_mat,
              (sx * (BODY_W/2 - 0.01), (Y_EDECK_START + Y_REAR_SLOPE) / 2,
               Z_EDECK - 0.012), Y_REAR_SLOPE - Y_EDECK_START, 'y')
for sx in (-1, 1):
    tow_shackle(f'bow{sx}', gear_mat,
                (sx * BODY_W * 0.36, -HULL_LEN/2 - 0.02, BELT_Z - 0.24))
for sx in (-1, 1):  # front pair on the glacis
    lifting_eye(f'hull{sx}-1', gear_mat,
                (sx * (BODY_W/2 - 0.15), -1.58, glacis_z(-1.58) + 0.04))
for sx in (-1, 1):  # rear pair on the engine deck
    lifting_eye(f'hull{sx}1', gear_mat,
                (sx * (BODY_W/2 - 0.15), 1.58, Z_EDECK + 0.04))

add_mount_empty('turret', (0, P['ringY'], HULL_TOP))
finalize_and_export('light_hull_scout')
