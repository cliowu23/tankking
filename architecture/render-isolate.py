"""render-isolate.py — render each named mesh alone (rest hidden) to identify it.
Usage: blender --background --python architecture/render-isolate.py -- <glb> <out_dir> <m1,m2,...>
"""
import bpy, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
src, out_dir, names = argv[0], argv[1], argv[2].split(",")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
pts=[]
for o in meshes:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
cx=sum(p.x for p in pts)/len(pts); cy=sum(p.y for p in pts)/len(pts); cz=sum(p.z for p in pts)/len(pts)
size=max(max(p.x for p in pts)-min(p.x for p in pts), max(p.y for p in pts)-min(p.y for p in pts), max(p.z for p in pts)-min(p.z for p in pts))
center=Vector((cx,cy,cz))
tgt=bpy.data.objects.new('t',None); bpy.context.scene.collection.objects.link(tgt); tgt.location=center
cam_data=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cam_data); bpy.context.scene.collection.objects.link(cam)
cam.location=center+Vector((-size*0.5,-size*1.8,size*0.45))
con=cam.constraints.new('TRACK_TO'); con.target=tgt; con.track_axis='TRACK_NEGATIVE_Z'; con.up_axis='UP_Y'
bpy.context.scene.camera=cam
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'; sc.display.shading.color_type='SINGLE'
sc.display.shading.single_color=(0.85,0.2,0.2)
sc.render.resolution_x=800; sc.render.resolution_y=480
for nm in names:
    for o in meshes: o.hide_render = (o.name != nm)
    bpy.context.view_layer.update()
    sc.render.filepath=f"{out_dir}/iso-{nm}.png"; bpy.ops.render.render(write_still=True)
    print(f"[iso] {nm}")
print("[iso] done")
