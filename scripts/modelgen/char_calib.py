# Batch C0 — character calibration dummy. NOT game art.
# Proves: 7-bone armature → rigid skin → vertex colors → idle/walk actions → GLB →
# DriverCharacter (loads, animates, accessory attaches, head-graft works).
# Color coding doubles as a side/axis check: LEFT limbs RED, RIGHT limbs BLUE,
# torso GREY, head YELLOW with a dark nose marker on the FRONT (-Y blender = +Z game).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _charlib import (clear_scene, make_armature, tint, bind_part, finish_mesh,
                      idle_action, walk_action, export_char)
import bpy

clear_scene()
arm = make_armature()

RED, BLUE = (0.85, 0.2, 0.2, 1), (0.2, 0.35, 0.9, 1)
GREY, YELLOW, DARK = (0.55, 0.55, 0.55, 1), (0.9, 0.8, 0.2, 1), (0.1, 0.1, 0.1, 1)


def box(c, s):
    bpy.ops.mesh.primitive_cube_add(location=c)
    o = bpy.context.object
    o.scale = (s[0] / 2, s[1] / 2, s[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    return o


def cyl(c, r, d, v=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=c)
    return bpy.context.object


# Body parts (rigid-bound to their bones BEFORE joining)
torso = box((0, 0, 0.385), (0.26, 0.16, 0.17)); tint(torso, GREY);  bind_part(torso, 'torso')
hips  = box((0, 0, 0.285), (0.24, 0.15, 0.05)); tint(hips, GREY);   bind_part(hips, 'root')
ll = cyl((0.085, 0, 0.15), 0.05, 0.26);  tint(ll, RED);   bind_part(ll, 'leg-left')
lr = cyl((-0.085, 0, 0.15), 0.05, 0.26); tint(lr, BLUE);  bind_part(lr, 'leg-right')
al = cyl((0.175, 0, 0.33), 0.04, 0.21);  tint(al, RED);   bind_part(al, 'arm-left')
ar = cyl((-0.175, 0, 0.33), 0.04, 0.21); tint(ar, BLUE);  bind_part(ar, 'arm-right')
body = finish_mesh([torso, hips, ll, lr, al, ar], 'body-mesh', arm)

# Head parts (big chibi block + front nose marker)
head = box((0, 0, 0.565), (0.24, 0.2, 0.2));    tint(head, YELLOW); bind_part(head, 'head')
nose = box((0, -0.115, 0.55), (0.05, 0.04, 0.05)); tint(nose, DARK); bind_part(nose, 'head')
headm = finish_mesh([head, nose], 'head-mesh', arm)

idle_action(arm)
walk_action(arm)
export_char('char-calib')
