"""render-coded.py — render a GLB with each mesh a distinct flat color + print the legend,
so meshes can be identified by name (e.g. which Object_N are the road wheels).
Usage: blender --background --python architecture/render-coded.py -- <path.glb> <out_dir>
"""
import bpy, sys, math, colorsys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
src, out_dir = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=src)

meshes = sorted([o for o in bpy.data.objects if o.type=='MESH'], key=lambda o:o.name)
print("\n#### COLOR LEGEND ####")
for i,o in enumerate(meshes):
    h = (i/max(1,len(meshes)))
    r,g,b = colorsys.hsv_to_rgb(h, 0.9, 1.0)
    m = bpy.data.materials.new(o.name+'_c'); m.use_nodes=False; m.diffuse_color=(r,g,b,1)
    o.data.materials.clear(); o.data.materials.append(m)
    print(f"  {o.name:12s} -> hue {int(h*360):3d}deg  rgb({r:.2f},{g:.2f},{b:.2f})")
print("#### END LEGEND ####")

pts=[]
for o in meshes:
    for c in o.bound_box: pts.append(o.matrix_world @ Vector(c))
cx=sum(p.x for p in pts)/len(pts); cy=sum(p.y for p in pts)/len(pts); cz=sum(p.z for p in pts)/len(pts)
size=max(max(p.x for p in pts)-min(p.x for p in pts), max(p.y for p in pts)-min(p.y for p in pts), max(p.z for p in pts)-min(p.z for p in pts))
center=Vector((cx,cy,cz))
tgt=bpy.data.objects.new('tgt',None); bpy.context.scene.collection.objects.link(tgt); tgt.location=center
cam_data=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cam_data); bpy.context.scene.collection.objects.link(cam)
cam.location=center+Vector((-size*0.3,-size*1.9,size*0.5))  # near side-on
con=cam.constraints.new('TRACK_TO'); con.target=tgt; con.track_axis='TRACK_NEGATIVE_Z'; con.up_axis='UP_Y'
bpy.context.scene.camera=cam
sd=bpy.data.lights.new('s','SUN'); sun=bpy.data.objects.new('s',sd); bpy.context.scene.collection.objects.link(sun); sd.energy=3
bpy.context.scene.world=bpy.data.worlds.new('w'); bpy.context.scene.world.use_nodes=True
bpy.context.scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.1,0.1,0.12,1)
sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'
sc.display.shading.color_type='MATERIAL'
sc.render.resolution_x=1000; sc.render.resolution_y=560
bpy.context.view_layer.update()
sc.render.filepath=f"{out_dir}/coded-side.png"; bpy.ops.render.render(write_still=True)
cam.location=center+Vector((-size*1.1,-size*1.4,size*0.9))
bpy.context.view_layer.update()
sc.render.filepath=f"{out_dir}/coded-34.png"; bpy.ops.render.render(write_still=True)
print("[render-coded] done")
