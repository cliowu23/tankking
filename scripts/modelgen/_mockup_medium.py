# SILHOUETTE MOCKUP — medium doctrine (T-44 replacement), Panzer III-leaning.
# Three variants in one GLB, grey, no detail — for direction approval only.
# A (left):  clean early Pz III — boxy slab hull, stepped front, faceted turret, drum cupola, short 50mm
# B (middle): Pz III M — same + Schuerzen side skirts and turret skirt, longer L/60 gun
# C (right):  Tiger-leaning hybrid — wider/squarer everything, stubby 75mm
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, EXPORT_DIR
import bpy

clear_scene()
grey  = flat_material('mock_grey',  (0.52, 0.52, 0.54, 1.0))
dark  = flat_material('mock_dark',  (0.10, 0.10, 0.10, 1.0))
skirt = flat_material('mock_skirt', (0.66, 0.66, 0.68, 1.0))


def box(mat, c, s, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=c, rotation=rot)
    o = bpy.context.object
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    assign(o, mat)
    return o


def cyl(mat, c, r, d, rot=(0, 0, 0), v=14, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=c, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r, radius2=r2, depth=d, location=c, rotation=rot)
    o = bpy.context.object
    assign(o, mat)
    return o


def variant(ox, L, W_body, W_total, h_hull, turret_w, turret_facets, gun_l, gun_r,
            skirts=False, overlap_wheels=False, stub_brake=False):
    tw = (W_total - W_body) / 2 - 0.03            # track width per side
    tcx = W_body / 2 + 0.03 + tw / 2
    # tracks: boxy band + wheels (silhouette only)
    for sx in (-1, 1):
        box(dark, (ox + sx * tcx, 0, 0.5), (tw, L * 0.96, 1.0))
        n = 7 if overlap_wheels else 6
        for i in range(n):
            y = -L * 0.38 + L * 0.76 * i / (n - 1)
            zz = 0.42 if (not overlap_wheels or i % 2 == 0) else 0.5
            cyl(dark, (ox + sx * (tcx + 0.02), y, zz), 0.3, tw + 0.06, rot=(0, math.pi / 2, 0))
    # hull: boxy slab, near-vertical front with a small step (Pz III), flat roof
    box(grey, (ox, 0, 0.55 + (h_hull - 0.55) / 2), (W_body, L, h_hull - 0.55))
    box(grey, (ox, -L / 2 + 0.25, h_hull - 0.12), (W_body, 0.5, 0.24))      # stepped driver plate
    for sx in (-1, 1):                                                       # fenders
        box(grey, (ox + sx * tcx, 0, 1.06), (tw + 0.05, L * 0.98, 0.07))
    # faceted turret on the hull roof
    tz = h_hull
    cyl(grey, (ox, -0.15, tz + 0.3), turret_w / 2, 0.6, v=turret_facets, r2=turret_w / 2 * 0.78)
    o = bpy.context.object
    o.scale = (1.0, 1.15, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    cyl(grey, (ox, 0.35, tz + 0.68), 0.26, 0.18, v=12)                       # drum cupola, rear-center
    # gun: slim, external mantlet block
    box(dark, (ox, -turret_w / 2 - 0.32, tz + 0.32), (0.4, 0.34, 0.36))
    cyl(grey, (ox, -turret_w / 2 - 0.4 - gun_l / 2, tz + 0.32), gun_r, gun_l,
        rot=(math.pi / 2, 0, 0), v=10)
    if stub_brake:
        cyl(grey, (ox, -turret_w / 2 - 0.4 - gun_l - 0.08, tz + 0.32), gun_r + 0.05, 0.16,
            rot=(math.pi / 2, 0, 0), v=10)
    if skirts:
        # Schuerzen: segmented plates standing off the hull sides above the tracks
        for sx in (-1, 1):
            for i in range(4):
                y = -L * 0.36 + (L * 0.72) * i / 3
                box(skirt, (ox + sx * (tcx + tw / 2 + 0.10), y, 1.05), (0.03, L * 0.16, 0.75))
        # turret skirt band
        cyl(skirt, (ox, -0.15, tz + 0.35), turret_w / 2 + 0.22, 0.5, v=8)
        o = bpy.context.object
        o.scale = (1.0, 1.2, 1.0)
        bpy.ops.object.transform_apply(scale=True)


# A: clean early Pz III — 5.4 long, narrow, short 50mm
variant(-4.6, 5.4, 2.0, 3.0, 1.6, 1.7, 10, 1.7, 0.05)
# B: Pz III M — Schuerzen skirts + longer L/60 gun w/ small brake
variant(0.0, 5.4, 2.0, 3.0, 1.6, 1.7, 10, 2.2, 0.05, skirts=True, stub_brake=True)
# C: Tiger-leaning — wider, squarer turret, overlapping wheels, stubby 75mm
variant(4.6, 5.7, 2.4, 3.4, 1.75, 2.0, 4, 1.5, 0.075, overlap_wheels=True, stub_brake=True)

out = os.path.abspath(os.path.join(EXPORT_DIR, '_mockup_medium.glb'))
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.data.name = obj.name
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
print(f'[modelgen] exported {out}')
