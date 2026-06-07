"""diag-base.py — for turret GLBs, compute the bottom-slice XZ center via bbox-midpoint,
centroid, and median, at several slice fractions. Reveals mantlet skew and the most robust
center method. Babylon frame: GLB X=width, Y=height, Z=forward (part GLBs bake this)."""
import bpy, math
from mathutils import Vector

def stats(vals):
    s = sorted(vals)
    n = len(s)
    med = s[n//2] if n % 2 else (s[n//2-1]+s[n//2])/2
    return min(s), max(s), sum(s)/n, med

def analyze(path, label, yaw=0.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    # glTF import puts the model Y-up into Blender Z-up; bbox corners in world.
    # We want the part's own game frame. Easiest: read each vertex via world matrix, then
    # remap Blender(x,y,z)->game(x, z, -y) to match Babylon import. Apply optional yaw about Y.
    pts = []
    for o in meshes:
        wm = o.matrix_world
        for v in o.data.vertices:
            w = wm @ v.co
            gx, gy, gz = w.x, w.z, -w.y     # Blender->Babylon axis map
            if yaw:
                c, s = math.cos(yaw), math.sin(yaw)
                gx, gz = c*gx + s*gz, -s*gx + c*gz
            pts.append((gx, gy, gz))
    ys = [p[1] for p in pts]
    yMin, yMax = min(ys), max(ys)
    print(f"\n=== {label} === verts={len(pts)} yRange=[{yMin:.2f},{yMax:.2f}] height={yMax-yMin:.2f}")
    for frac in (0.05, 0.10, 0.15):
        cut = yMin + frac*(yMax-yMin)
        xs = [p[0] for p in pts if p[1] <= cut]
        zs = [p[2] for p in pts if p[1] <= cut]
        if not xs: continue
        xmin,xmax,xmean,xmed = stats(xs)
        zmin,zmax,zmean,zmed = stats(zs)
        print(f" frac={frac:.2f} n={len(xs):5d} | "
              f"X bboxMid={(xmin+xmax)/2:+.2f} mean={xmean:+.2f} med={xmed:+.2f} ext={xmax-xmin:.2f} | "
              f"Z bboxMid={(zmin+zmax)/2:+.2f} mean={zmean:+.2f} med={zmed:+.2f} ext={zmax-zmin:.2f}")

base = '/Users/cliowu/claude-workspace/game/public/assets/models/tanks/parts/'
analyze(base+'turret-m26.glb', 'turret-m26 (no yaw)', yaw=0.0)
analyze(base+'turret-t55.glb', 'turret-t55 (yaw 180)', yaw=math.pi)
print()
