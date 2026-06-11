# light_gun_75mm — Sherman M3-style 75mm (M24 Chaffee armament), Light doctrine.
# Clean WWII silhouette: stepped recoil sleeve at the breech, gently tapered tube,
# plain muzzle with a thin reinforce ring. NO muzzle brake.
# Breech face at origin, tube extends along Blender +Z.
# JS module rotates root.rotation.x = Math.PI/2 after parenting → tube along +Z forward.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import clear_scene, flat_material, assign, finalize_and_export, load_params, bevel
import bpy

P = {
    'tubeL': 1.85,    # breech face → muzzle tip (composed: ~0.97 past hull nose)
    'tubeR': 0.066,   # tube radius at the sleeve junction
    'sleeveL': 0.62,  # recoil sleeve length
    'sleeveR': 0.095, # recoil sleeve radius
    'taper': 0.80,    # muzzle radius as a fraction of tubeR (gentle M3 taper)
}
P.update(load_params('light_tank', 'gun'))

clear_scene()
gun_mat = flat_material('gun_metal', (0.30, 0.30, 0.30, 1.0))

TUBE_L, TUBE_R = P['tubeL'], P['tubeR']
SLV_L,  SLV_R  = P['sleeveL'], P['sleeveR']
MUZ_R = TUBE_R * P['taper']

def cyl(name, r, depth, z, verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=(0, 0, z))
    o = bpy.context.object; o.name = name; assign(o, gun_mat)
    return o

# Recoil sleeve — the thick stepped section exiting the mantlet
bevel(cyl('gun_sleeve', SLV_R, SLV_L, SLV_L / 2, verts=14), width=0.018, segments=2)

# Collar step where the sleeve hands off to the tube (two-step M3 profile)
collar_d = 0.11
bevel(cyl('gun_collar', (SLV_R + TUBE_R) / 2, collar_d, SLV_L + collar_d / 2 - 0.01),
      width=0.012, segments=2)

# Tube — gentle taper from TUBE_R at the collar to MUZ_R at the muzzle
z0 = SLV_L + 0.02                      # buried under the collar
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=TUBE_R, radius2=MUZ_R,
                                depth=TUBE_L - z0, location=(0, 0, (z0 + TUBE_L) / 2))
o = bpy.context.object; o.name = 'gun_tube'; assign(o, gun_mat)

# Plain muzzle — thin reinforce ring, clean cut, no brake
ring_d = 0.085
bevel(cyl('gun_muzzle_ring', MUZ_R * 1.30, ring_d, TUBE_L - ring_d / 2),
      width=0.012, segments=2)

finalize_and_export('light_gun_75mm')
