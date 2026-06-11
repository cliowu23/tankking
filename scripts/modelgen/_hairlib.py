# _hairlib — the curve-lock hair engine (hair v5, CHARACTER_MODEL_SPEC).
# Kenney finding: their whole head-mesh is ~500 verts — quality is sculpted FORM
# (swoops, layered locks, pointed tips), not density. A Blender curve with
# bevel_depth + per-point radius taper, converted to mesh, IS a hair lock.
# A hairstyle = thin scalp base + 8-20 locks placed by a per-style flow.
# Frame: head-bone local (origin=bone, Z=up, -Y=front). Budget ~800 verts/style.
import bpy
import math

# Head shell references (match char_wardrobe HW/HD/HTOP)
HX, HY, HTOP = 0.234, 0.164, 0.205   # Kenney-proportioned head


def lock(points, radius=0.034, tip=0.25, bevel_res=1, res_u=4):
    """One hair lock: smooth curve through `points` [(x,y,z)..], round profile of
    `radius`, tapering to `tip` fraction at the end. Returns the converted mesh."""
    cu = bpy.data.curves.new('lock', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.resolution_u = res_u
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(points) - 1)
    n = len(points)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
        t = i / (n - 1)
        sp.points[i].radius = 1.0 - (1.0 - tip) * t      # taper toward the tip
    sp.use_endpoint_u = True
    sp.order_u = min(3, n)
    obj = bpy.data.objects.new('hair_lock', cu)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth()
    return bpy.context.object


def crown_flow(n=12, length=0.17, droop=0.10, crown=(0.03, 0.03), front_clear=0.45,
               sweep=0.0, out=1.0):
    """Lock paths radiating from a crown point across the scalp, ending down the
    sides/back. front_clear: fraction of the front arc left open (the face).
    sweep: sideways bias (side-part). Returns list of point-lists for lock()."""
    paths = []
    cx, cy = crown
    # angles around the head, skipping the face opening (front = -Y = angle -pi/2)
    a0 = -math.pi / 2 + math.pi * front_clear
    a1 = 3 * math.pi / 2 - math.pi * front_clear
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        dx, dy = math.cos(a), math.sin(a)
        ex = dx * (HX + 0.015) + sweep
        ey = dy * (HY + 0.015)
        paths.append([
            (cx, cy, HTOP + 0.055),
            (cx + (ex - cx) * 0.45, cy + (ey - cy) * 0.45, HTOP + 0.045),
            (ex * out, ey * out, HTOP - droop * 0.45),
            (ex * (out + 0.06), ey * (out + 0.06), HTOP - droop),
        ])
    return paths


def fringe_swoops(k=3, width=0.20, drop=0.085, sweep=0.0, radius_z=0.0):
    """Forehead swoop paths: from above the brow line sweeping across/down."""
    paths = []
    for i in range(k):
        t = (i + 0.5) / k - 0.5
        x0 = t * width + sweep * 0.3
        x1 = t * width * 1.25 + sweep
        paths.append([
            (x0 - sweep * 0.6, -HY + 0.025, HTOP + 0.045),
            (x0, -HY - 0.012, HTOP + 0.01 + radius_z),
            (x1, -HY - 0.022, HTOP - drop),
        ])
    return paths
