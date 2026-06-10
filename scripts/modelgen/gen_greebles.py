# Export every greeble as a small preview GLB for the tuner's drag-to-place palette.
# Run after any _greebles.py change:  blender --background --python scripts/modelgen/gen_greebles.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, finalize_and_export, DOCTRINE_COLORS, EXPORT_DIR
from _greebles import GREEBLES
import bpy

out_dir = os.path.join(EXPORT_DIR, 'greebles')
os.makedirs(out_dir, exist_ok=True)

for gid, builder in GREEBLES.items():
    clear_scene()
    paint = flat_material('player_body', DOCTRINE_COLORS['player'])
    dark = flat_material('gear_dark', (0.16, 0.155, 0.15, 1.0))
    builder(paint, dark)
    # export into the greebles/ subdir by temporarily pointing the exporter there
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.data.name = obj.name
    path = os.path.join(out_dir, f'greeble_{gid}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB')
    print(f'[modelgen] exported {path}')
