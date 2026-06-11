# light_turret_enclosed — M24 Chaffee turret, Light doctrine. Full rewrite.
# Origin at ring center. Ring base = STANDARD_RING_DIAMETER. 'mount' at -Y front, Z>0.
# Axes: Z=up, -Y=front, -X = tank's RIGHT (commander's cupola on -X side).
#
# Shape doctrine (real M24):
#   * Wide flat body — width 1.76 vs height 0.63, NOT a dome. Custom 10-point
#     plan loft: flat near-vertical front face, cheeks raking to max width at the
#     ring, then tapering into an INTEGRAL rear bustle (narrower, slightly lower)
#     that is part of the same casting loft — no bolted-on block.
#   * Sides rake ~17 deg from vertical; front face ~6 deg (nearly vertical).
#   * Roof = the loft's planar top cap with a slight ~2 deg front-up tilt.
#   * Mantlet = thick rounded-pill armor casting: horizontal-axis cylinder
#     (axis along X), flattened front-to-back, rims rounded by heavy bevel.
#     Reads as the big D-shaped rotor shield, not a sphere or disc.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, gear_material, assign, add_mount_empty,
                  bevel, finalize_and_export, load_params,
                  STANDARD_RING_DIAMETER, DOCTRINE_COLORS)
from _details import bolt_row, weld_seam, lifting_eye, periscope, grab_handle
import bpy
import bmesh

P = {
    'cupolaR': 0.22, 'cupolaX': -0.38,
    'mountY': -1.02, 'mountZ': 0.38,
    'mant_protrude': 0.24,
}
P.update(load_params('light_tank', 'turret'))

clear_scene()
body_mat = flat_material('light_body', DOCTRINE_COLORS['light'])
gear_mat = gear_material()

RING_R    = STANDARD_RING_DIAMETER / 2
BASE_Z    = 0.07          # ring collar top = casting base
TOP_Z     = 0.69          # roof plate height at centerline
ROOF_TILT = 0.04          # z += -y * tilt on the top ring → ~2.3 deg front-up roof
MOUNT     = (0, P['mountY'], P['mountZ'])

# Loft levels. hw = max half-width (at the cheeks), fw = front-face half-width,
# tf = front extent (-Y), bw = bustle half-width, tr = bustle rear extent (+Y).
# Base 1.76 wide x 1.60 deep x 0.62 tall; sides rake 17 deg; bustle to +0.74.
LEVELS = [
    dict(z=0.07, hw=0.88, fw=0.64, tf=0.86, bw=0.56, tr=0.74),
    dict(z=0.28, hw=0.85, fw=0.63, tf=0.85, bw=0.55, tr=0.74),
    dict(z=0.52, hw=0.77, fw=0.58, tf=0.82, bw=0.51, tr=0.70),
    dict(z=0.69, hw=0.69, fw=0.53, tf=0.79, bw=0.46, tr=0.63),
]


def roof_z(y):
    """Roof surface height at depth y (top cap is the tilted plane z = TOP_Z - y*tilt)."""
    return TOP_Z - y * ROOF_TILT


def plan_ring(hw, fw, tf, bw, tr):
    """One cross-section, CCW from front-left. Flat front face, raked cheeks to
    max width near the ring, diagonal shoulders narrowing into the bustle, flat
    rear face — the bustle is IN the plan, so the loft casts it integrally."""
    return [
        (-fw, -tf),          # front face, left corner
        ( fw, -tf),          # front face, right corner
        ( hw, -tf * 0.34),   # right cheek -> max width
        ( hw,  tr * 0.18),   # right side, just aft of ring center
        ( bw,  tr * 0.60),   # right shoulder, tapering into bustle
        ( bw,  tr),          # bustle rear, right corner
        (-bw,  tr),          # bustle rear, left corner
        (-bw,  tr * 0.60),   # left shoulder
        (-hw,  tr * 0.18),   # left side
        (-hw, -tf * 0.34),   # left cheek
    ]


def build_body(name, mat):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings, last = [], len(LEVELS) - 1
    for li, L in enumerate(LEVELS):
        pts = plan_ring(L['hw'], L['fw'], L['tf'], L['bw'], L['tr'])
        ring = []
        for x, y in pts:
            z = roof_z(y) if li == last else L['z']   # tilted (planar) roof ring
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    n = len(rings[0])
    for li in range(len(rings) - 1):
        lo, hi = rings[li], rings[li + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(list(reversed(rings[-1])))   # roof cap (planar n-gon)
    bm.faces.new(rings[0])                    # floor cap (hidden against hull)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    assign(o, mat)
    bevel(o, width=0.07, segments=3)          # cast-steel rounding (angle-limited)
    return o


# ---------------------------------------------------------------- ring collar
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=RING_R, depth=BASE_Z,
                                    location=(0, 0, BASE_Z / 2))
ring = bpy.context.object
ring.name = 'turret_ring'
assign(ring, body_mat)

# ---------------------------------------------------------------- turret body
build_body('turret_shell', body_mat)

# ---------------------------------------------------------------- mantlet
# Rounded-pill rotor shield: cylinder with its axis along X (so the round
# profile faces sideways = rounded top/bottom), flattened 25% front-to-back,
# rim edges rounded hard. 0.96 wide x 0.52 tall, protruding ~0.24 past the face.
MANT_Y, MANT_RZ, MANT_W, MANT_FLAT = -0.88, 0.26, 0.96, 0.75
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=MANT_RZ, depth=MANT_W,
                                    location=(0, MANT_Y, P['mountZ']),
                                    rotation=(0, math.pi / 2, 0))
mant = bpy.context.object
mant.name = 'mantlet_casting'
mant.scale = (1.0, MANT_FLAT, 1.0)            # local Y == world Y here
bpy.ops.object.transform_apply(rotation=True, scale=True)
bevel(mant, width=0.09, segments=3)           # rounds the rims -> pill casting
assign(mant, gear_mat)

# Gun collar poking out of the casting center (the gun part sockets onto 'mount')
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.12, depth=0.18,
                                    location=(0, MANT_Y - MANT_RZ * MANT_FLAT + 0.05,
                                              P['mountZ']),
                                    rotation=(math.pi / 2, 0, 0))
collar = bpy.context.object
collar.name = 'mantlet_collar'
assign(collar, gear_mat)

# Rotor-shield bolts across the casting's upper front
bolt_row('mantlet_face', gear_mat, (-0.30, -1.06, 0.50), (0.30, -1.06, 0.50), 4, 'y')

# ---------------------------------------------------------------- cupola (cmdr, -X)
CUP_X, CUP_Y = P['cupolaX'], 0.10
cup_base_z = roof_z(CUP_Y) - 0.02
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['cupolaR'], depth=0.16,
                                    location=(CUP_X, CUP_Y, cup_base_z + 0.08))
cupola = bpy.context.object
cupola.name = 'cupola_commander'
assign(cupola, body_mat)

bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=P['cupolaR'] + 0.015, depth=0.04,
                                    location=(CUP_X, CUP_Y, cup_base_z + 0.18))
cup_lid = bpy.context.object
cup_lid.name = 'hatch_cupola'
bevel(cup_lid, width=0.018, segments=2)
assign(cup_lid, body_mat)

# Vision blocks around the cupola's forward arc (auto-dark via 'periscope')
for i, a in enumerate((-0.9, 0.0, 0.9)):
    bpy.ops.mesh.primitive_cube_add(
        location=(CUP_X + 0.20 * math.sin(a), CUP_Y - 0.20 * math.cos(a),
                  cup_base_z + 0.12))
    vb = bpy.context.object
    vb.name = f'cupola_periscope{i}'
    vb.scale = (0.035, 0.025, 0.026)
    bpy.ops.object.transform_apply(scale=True)
    vb.rotation_euler = (0, 0, a)
    assign(vb, gear_mat)

# ---------------------------------------------------------------- gunner hatch (+X)
GH_X, GH_Y = 0.40, -0.05
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.185, depth=0.05,
                                    location=(GH_X, GH_Y, roof_z(GH_Y) + 0.012))
hatch_g = bpy.context.object
hatch_g.name = 'hatch_gunner'
bevel(hatch_g, width=0.015, segments=2)
assign(hatch_g, body_mat)

bpy.ops.mesh.primitive_cube_add(location=(GH_X + 0.20, GH_Y, roof_z(GH_Y) + 0.02))
hinge = bpy.context.object
hinge.name = 'hatch_gunner_hinge_trim_dark'
hinge.scale = (0.035, 0.027, 0.022)
bpy.ops.object.transform_apply(scale=True)
assign(hinge, gear_mat)

# ---------------------------------------------------------------- roof furniture
# Ventilator dome on the centerline behind the hatches
bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.09, depth=0.055,
                                    location=(0, 0.30, roof_z(0.30) + 0.018))
vent = bpy.context.object
vent.name = 'roof_ventilator'
bevel(vent, width=0.022, segments=2)
assign(vent, body_mat)

# Crew periscopes ahead of the hatches
for sx in (-1, 1):
    periscope(f'roof{sx}', gear_mat, (sx * 0.28, -0.45, roof_z(-0.45) + 0.035))

# Antenna base on the bustle roof
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.035, depth=0.10,
                                    location=(-0.30, 0.52, roof_z(0.52) + 0.04))
ant = bpy.context.object
ant.name = 'antenna_base_trim_dark'
assign(ant, gear_mat)

# ---------------------------------------------------------------- tertiary pass
# Lifting eyes low on the wide cheeks of the casting
for sx in (-1, 1):
    lifting_eye(f'tur{sx}', gear_mat, (sx * 0.84, -0.10, 0.30))
# Weld bead where the roof plate meets the front casting
weld_seam('turret_roof', gear_mat, (0, -0.50, roof_z(-0.50) + 0.005), 1.0, 'x')
# Horizontal welds along the lower side plates (flush — walls are planar in Y here)
for sx in (-1, 1):
    weld_seam(f'turret_side{sx}', gear_mat, (sx * 0.875, -0.08, 0.20), 0.40, 'y')
# Bustle rear: bolted radio-access panel + crew grab handle
bolt_row('bustle_panel', gear_mat, (-0.30, 0.745, 0.28), (0.30, 0.745, 0.28), 5, 'y')
grab_handle('bustle', gear_mat, (0, 0.75, 0.46))

# ---------------------------------------------------------------- export
add_mount_empty('mount', MOUNT)
finalize_and_export('light_turret_enclosed')
