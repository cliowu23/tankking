# medium_hull_standard — Panzer III M-inspired boxy hull with Schuerzen, original mesh.
# Approved mockup B (2026-06-10): slab sides, near-vertical stepped front, segmented
# spaced-armor skirt plates, FRONT drive sprocket (authentic Pz III, flipped vs player).
# Axes: Z=up, -Y=front, -X = tank's RIGHT. Params: params/medium_tank.json.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, track_material,
                  assign, add_mount_empty, bevel, make_box, make_wheel, make_track_band,
                  make_profile_prism, default_hull_profile,
                  finalize_and_export, load_params, tuner_mode, game_to_blender,
                  DOCTRINE_COLORS)
from _greebles import GREEBLES
import bpy

P = {
    'hullLen': 5.4, 'bodyW': 2.0, 'trackW': 0.47,
    'groundClear': 0.45, 'beltZ': 1.05, 'hullTop': 1.62,
    'glacisPull': 0.18, 'lowerGlacisPull': 0.2, 'rearDeckPull': 0.1,
    'wheelR': 0.27, 'wheelCount': 6, 'ringY': -0.15,
}
P.update(load_params('medium_tank', 'hull'))

HULL_LEN, BODY_W, TRACK_W = P['hullLen'], P['bodyW'], P['trackW']
LOWER_Z0, LOWER_Z1, UPPER_Z1 = P['groundClear'], P['beltZ'], P['hullTop']
WHEEL_R, N_WHEELS = P['wheelR'], int(P['wheelCount'])

# Same derived no-clip running-gear math as the player hull
TRACK_GAP   = 0.04
TRACK_CX    = BODY_W / 2 + TRACK_GAP + TRACK_W / 2
TRACK_R_OUT = WHEEL_R + 0.16
TRACK_R_IN  = WHEEL_R + 0.02
WHEEL_Z     = TRACK_R_OUT
END_CY      = HULL_LEN / 2 - 0.35
END_R       = TRACK_R_IN
WHEEL_Y1    = END_CY - END_R - WHEEL_R - 0.06
WHEEL_Y0    = -WHEEL_Y1
FENDER_Z    = WHEEL_Z + TRACK_R_OUT + 0.10
UPPER_Z0    = max(LOWER_Z1, WHEEL_Z + TRACK_R_OUT + 0.06)

clear_scene()
body_mat = flat_material('medium_body', DOCTRINE_COLORS['medium'])
gear_mat = gear_material()
trk_mat  = track_material()

# ── Hull body — profile prism (Sprocket-style control points) ───────────────
PROFILE = P.get('hullProfile') or default_hull_profile(P)
make_profile_prism('hull_body', body_mat, PROFILE, BODY_W)
HULL_TOP = max(gy for _, gy in PROFILE)

# (The proud driver-step box is gone — the Pz III stepped bow now lives IN the
# hull profile itself: nose → belt → shelf → vertical driver plate → roof.)

# Fenders
for side, x in (('right', -TRACK_CX), ('left', TRACK_CX)):
    make_box(f'fender_{side}', body_mat, (x, 0.0, FENDER_Z), (TRACK_W + 0.06, HULL_LEN * 0.98, 0.07))

# ── Schuerzen: continuous wall — plates hang edge-to-edge from a mounting rail
# (real Pz III M arrangement; "make sure they are all connected")
SKIRT_X    = TRACK_CX + TRACK_W / 2 + 0.10
SKIRT_SPAN = HULL_LEN * 0.74
SKIRT_H    = 0.76
SKIRT_ZC   = FENDER_Z - 0.10
N_PLATES   = 4
PLATE_L    = SKIRT_SPAN / N_PLATES + 0.015          # slight overlap → no gaps
for side, sx in (('r', -1), ('l', 1)):
    # continuous top mounting rail tying the whole wall together
    make_box(f'skirt_rail_{side}_trim_dark', gear_mat,
             (sx * (SKIRT_X - 0.025), 0, SKIRT_ZC + SKIRT_H / 2 + 0.015),
             (0.10, SKIRT_SPAN + 0.12, 0.06))
    for i in range(N_PLATES):
        y = -SKIRT_SPAN / 2 + PLATE_L * (i + 0.5) - 0.0075
        p = make_box(f'skirt_plate_{side}{i}', body_mat,
                     (sx * SKIRT_X, y, SKIRT_ZC), (0.035, PLATE_L, SKIRT_H))
        bevel(p, width=0.012, segments=1)
    # hanger tabs at the plate seams, connecting rail to plates
    for i in range(N_PLATES + 1):
        y = -SKIRT_SPAN / 2 + PLATE_L * i - 0.0075 * (1 if 0 < i < N_PLATES else 0)
        make_box(f'skirt_tab_{side}{i}_trim_dark', gear_mat,
                 (sx * (SKIRT_X - 0.01), max(min(y, SKIRT_SPAN / 2), -SKIRT_SPAN / 2),
                  SKIRT_ZC + SKIRT_H / 2 - 0.04), (0.06, 0.05, 0.14))

# ── Running gear: FRONT drive sprocket, rear idler (authentic Pz III) ───────
for side, x in (('r', -TRACK_CX), ('l', TRACK_CX)):
    for i in range(N_WHEELS):
        y = WHEEL_Y0 + (WHEEL_Y1 - WHEEL_Y0) * i / max(N_WHEELS - 1, 1)
        make_wheel(f'wheel_road_{side}{i}', gear_mat, x, y, WHEEL_Z, WHEEL_R, TRACK_W * 0.82)
        make_wheel(f'wheel_hub_{side}{i}', trk_mat, x, y, WHEEL_Z, WHEEL_R * 0.45, TRACK_W * 0.88, verts=14)
    make_wheel(f'wheel_sprocket_{side}', gear_mat, x, -END_CY, WHEEL_Z, END_R, TRACK_W * 0.78)
    make_wheel(f'wheel_idler_{side}',    gear_mat, x,  END_CY, WHEEL_Z, END_R, TRACK_W * 0.78)

make_track_band('track_right', trk_mat, -TRACK_CX, TRACK_W, END_CY, WHEEL_Z, TRACK_R_OUT, TRACK_R_IN)
make_track_band('track_left',  trk_mat,  TRACK_CX, TRACK_W, END_CY, WHEEL_Z, TRACK_R_OUT, TRACK_R_IN)

# ── Rear: transverse muffler box + twin exhaust stubs (Pz III signature) ────
rear_y = HULL_LEN / 2
make_box('exhaust_muffler', gear_mat, (0, rear_y + 0.10, LOWER_Z1 - 0.05), (1.5, 0.22, 0.3))
for i, x in ((0, -0.45), (1, 0.45)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=0.22,
                                        location=(x, rear_y + 0.16, LOWER_Z1 + 0.14),
                                        rotation=(math.pi / 2.6, 0, 0))
    o = bpy.context.object
    o.name = f'exhaust_stub_{i}'
    assign(o, gear_mat)

# Engine deck grilles
for i, fy in enumerate((0.52, 0.74)):
    make_box(f'engine_grille_{i}', gear_mat, (0, HULL_LEN / 2 * fy, HULL_TOP + 0.015),
             (BODY_W * 0.62, 0.4, 0.05))

# Hull roof hatches (driver/radio operator, front corners)
for side, x in (('driver', -0.52), ('radioop', 0.52)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.17, depth=0.05,
                                        location=(x, -HULL_LEN / 2 + 0.85, HULL_TOP + 0.025))
    o = bpy.context.object
    o.name = f'hatch_{side}'
    assign(o, body_mat)

# Attachments (greebles placed in the tuner) — bake unless tuner preview
if not tuner_mode():
    for i, att in enumerate(load_params('medium_tank', 'attachments') or []):
        builder = GREEBLES.get(att.get('part'))
        if not builder:
            continue
        obj = builder(body_mat, gear_material())
        obj.name = f"{obj.name}_{i}"
        obj.location = game_to_blender(att['position'])
        obj.rotation_euler = (0, 0, -att.get('rotY', 0))
        s = att.get('scale', 1)
        obj.scale = (s, s, s)

add_mount_empty('turret', (0, P['ringY'], HULL_TOP))
finalize_and_export('medium_hull_standard')
