# light_hull_scout — M24 Chaffee-inspired Light doctrine hull.
# Stylized per TANKING_MODEL_SPEC.md. Axes: Z=up, -Y=front (tank faces -Y).
# Tunables in params/light_tank.json (hull group).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, track_material,
                  assign, add_mount_empty, bevel, make_profile_prism,
                  default_hull_profile, make_track_band,
                  finalize_and_export, load_params, tuner_mode,
                  game_to_blender, DOCTRINE_COLORS)
from _greebles import GREEBLES
from _details import bolt_row, weld_seam, lifting_eye, tow_shackle, periscope
import bpy

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

clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()
trk_mat  = track_material()

# Hull body — profile prism with steep Chaffee glacis
PROFILE = P.get('hullProfile') or default_hull_profile(P)
make_profile_prism('hull_body', body_mat, PROFILE, BODY_W)
HULL_TOP = max(gy for _, gy in PROFILE)  # actual top Z from profile (overrides default)

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

# Engine deck (rear top section)
bpy.ops.mesh.primitive_cube_add(location=(0, HULL_LEN * 0.30, HULL_TOP - 0.028))
deck = bpy.context.object
deck.name = 'rear_deck'
deck.scale = (BODY_W * 0.44, HULL_LEN * 0.38 / 2, 0.042)
bpy.ops.object.transform_apply(scale=True)
assign(deck, body_mat)

# Engine grilles ('engine' keyword stays dark at runtime)
for i, fy in enumerate((0.22, 0.44, 0.66)):
    bpy.ops.mesh.primitive_cube_add(location=(0, HULL_LEN * (0.14 + fy * 0.38), HULL_TOP + 0.008))
    g = bpy.context.object
    g.name = f'engine_grille_{i}'
    g.scale = (BODY_W * 0.32, 0.25, 0.032)
    bpy.ops.object.transform_apply(scale=True)
    assign(g, gear_mat)

# Twin Cadillac V8 exhausts ('exhaust' keyword = UNPAINTABLE)
for i, x in enumerate((-0.30, 0.30)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.068, depth=0.40,
                                        location=(x, HULL_LEN / 2 * 0.86, HULL_TOP - 0.045))
    o = bpy.context.object; o.name = f'exhaust_pipe_{i}'; assign(o, gear_mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.082, depth=0.055,
                                        location=(x, HULL_LEN / 2 * 0.86, HULL_TOP - 0.045 + 0.21))
    cap = bpy.context.object; cap.name = f'exhaust_cap_{i}'; assign(cap, gear_mat)

# Driver + co-driver hatches
for name, x in (('hatch_driver', BODY_W * 0.27), ('hatch_codriver', -BODY_W * 0.27)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.165, depth=0.052,
                                        location=(x, -HULL_LEN * 0.30, HULL_TOP + 0.022))
    o = bpy.context.object; o.name = name; assign(o, body_mat)

# Driver periscope ('periscope' keyword = UNPAINTABLE)
periscope('driver', gear_mat, (BODY_W * 0.27, -HULL_LEN * 0.32, HULL_TOP + 0.075))

# Hull MG ('mg' keyword = UNPAINTABLE)
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.052, depth=0.16,
                                    location=(-BODY_W * 0.30, -HULL_LEN / 2 + 0.20, BELT_Z + 0.04),
                                    rotation=(math.pi / 2, 0, 0))
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

# Tertiary detail pass
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'hull_belt_{nrm}', gear_mat,
             (sx * (BODY_W/2 + 0.01), -HULL_LEN * 0.30, BELT_Z + 0.04),
             (sx * (BODY_W/2 + 0.01),  HULL_LEN * 0.35, BELT_Z + 0.04), 8, nrm)
bolt_row('glacis_top', gear_mat,
         (-BODY_W * 0.36, -HULL_LEN/2 + 0.18, HULL_TOP - 0.02),
         ( BODY_W * 0.36, -HULL_LEN/2 + 0.18, HULL_TOP - 0.02), 6, 'y')
for sx, nrm in ((1, 'x'), (-1, '-x')):
    bolt_row(f'fender_bolt_{nrm}', gear_mat,
             (sx * (TRACK_CX - TRACK_W/2 - 0.01), -HULL_LEN * 0.18, FENDER_Z - 0.04),
             (sx * (TRACK_CX - TRACK_W/2 - 0.01),  HULL_LEN * 0.22, FENDER_Z - 0.04), 5, nrm)
for sx in (-1, 1):
    weld_seam(f'roof{sx}', gear_mat,
              (sx * (BODY_W/2 - 0.01), 0.20, HULL_TOP - 0.012), HULL_LEN * 0.42, 'y')
for sx in (-1, 1):
    tow_shackle(f'bow{sx}', gear_mat,
                (sx * BODY_W * 0.36, -HULL_LEN/2 - 0.02, BELT_Z - 0.24))
for sy in (-1, 1):
    for sx in (-1, 1):
        lifting_eye(f'hull{sx}{sy}', gear_mat,
                    (sx * (BODY_W/2 - 0.15), sy * (HULL_LEN/2 - 0.82), HULL_TOP + 0.04))

add_mount_empty('turret', (0, P['ringY'], HULL_TOP))
finalize_and_export('light_hull_scout')
