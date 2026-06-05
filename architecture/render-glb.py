"""render-glb.py — quick side+top render of a GLB so we can see the model and verify the
turret/hull split. Renders the full model, then the same view with a chosen mesh subset
isolated (to confirm classification). Blender Z-up: X=width, Y=length, Z=height.
Usage: blender --background --python architecture/render-glb.py -- <path.glb> <out_dir>
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
src, out_dir = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.data.objects if o.type=='MESH']
pts=[]
for o in meshes:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
cx=sum(p.x for p in pts)/len(pts); cy=sum(p.y for p in pts)/len(pts); cz=sum(p.z for p in pts)/len(pts)
size=max(max(p.x for p in pts)-min(p.x for p in pts),
         max(p.y for p in pts)-min(p.y for p in pts),
         max(p.z for p in pts)-min(p.z for p in pts))
center=Vector((cx,cy,cz))

# target empty at model center
tgt=bpy.data.objects.new('tgt',None); bpy.context.scene.collection.objects.link(tgt); tgt.location=center
# camera (perspective, 3/4 side view) aimed via TRACK_TO constraint
cam_data=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.location=center+Vector((-size*1.4, -size*1.7, size*1.0))
con=cam.constraints.new('TRACK_TO'); con.target=tgt
con.track_axis='TRACK_NEGATIVE_Z'; con.up_axis='UP_Y'
bpy.context.scene.camera=cam
bpy.context.view_layer.update()

# sun
sd=bpy.data.lights.new('sun','SUN'); sun=bpy.data.objects.new('sun',sd)
bpy.context.scene.collection.objects.link(sun); sun.rotation_euler=(0.6,0.2,0.4); sd.energy=4
bpy.context.scene.world=bpy.data.worlds.new('w'); bpy.context.scene.world.use_nodes=True
bpy.context.scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.6,0.7,0.85,1)

sc=bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT','BLENDER_EEVEE','BLENDER_WORKBENCH'):
    try: sc.render.engine=eng; break
    except Exception: continue
sc.render.resolution_x=900; sc.render.resolution_y=600; sc.render.film_transparent=False

def render(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True); print(f"[render] {path}")

render(f"{out_dir}/t44-full.png")

# isolate turret set
TURRET={'Object_2','Object_3','Object_4','Object_5','Object_7','Object_9','Object_11','Object_12','Object_13','Object_20','Object_21'}
for o in meshes: o.hide_render = (o.name not in TURRET)
render(f"{out_dir}/t44-turret.png")
# isolate hull set
for o in meshes: o.hide_render = (o.name in TURRET)
render(f"{out_dir}/t44-hull.png")
print("[render] done")
