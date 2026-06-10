# Batch 0 calibration part — NOT game art. Purpose:
#   1. Lock the Blender→glTF→Babylon axis mapping by observation (front + right markers).
#   2. Prove the full script → GLB → part-module → assembleTank chain.
# Authoring assumption under test (Blender convention): Z = up, -Y = front, +X = right.
# The designer screenshot tells us where the markers actually land in Babylon.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (clear_scene, flat_material, assign, add_mount_empty,
                  finalize_and_export, STANDARD_RING_DIAMETER)
import bpy

clear_scene()
body_mat   = flat_material('calib_body',   (0.5, 0.5, 0.5, 1.0))   # grey hull
front_mat  = flat_material('calib_front',  (1.0, 0.1, 0.1, 1.0))   # RED = front
right_mat  = flat_material('calib_right',  (0.1, 0.3, 1.0, 1.0))   # BLUE = right
ring_mat   = flat_material('calib_ring',   (1.0, 0.85, 0.1, 1.0))  # GOLD = ring seat

# Hull slab: 2.4 wide (X), 4.0 long (Y), 0.8 tall — origin at ground center.
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.4))
body = bpy.context.object
body.name = 'hull_body'
body.scale = (1.2, 2.0, 0.4)
assign(body, body_mat)

# FRONT marker: red prong sticking out at Blender -Y.
bpy.ops.mesh.primitive_cone_add(radius1=0.3, depth=0.8, location=(0, -2.4, 0.4),
                                rotation=(-1.5708, 0, 0))
front = bpy.context.object
front.name = 'front_marker'
assign(front, front_mat)

# RIGHT marker: blue cube on Blender +X (disambiguates handedness).
bpy.ops.mesh.primitive_cube_add(location=(1.45, 0, 0.4))
right = bpy.context.object
right.name = 'side_marker_right'
right.scale = (0.25, 0.25, 0.25)
assign(right, right_mat)

# Ring seat: gold disc at the standard diameter, top center — the turret sits here.
bpy.ops.mesh.primitive_cylinder_add(radius=STANDARD_RING_DIAMETER / 2, depth=0.06,
                                    location=(0, 0, 0.83))
ring = bpy.context.object
ring.name = 'ring_seat'
assign(ring, ring_mat)

# Mount empty per the Integration Contract: 'turret' at the ring center.
add_mount_empty('turret', (0, 0, 0.86))

finalize_and_export('calib_hull_axes')
