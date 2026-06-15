# TanKING — procedural tileable texture generator (v2: distinct pattern per material)
# Authored in-house (numpy), 100% IP-clean. Run in Blender (uses bpy to save PNGs):
#     exec(open('/Users/cliowu/claude-workspace/game/scripts/texgen/textures.py').read())
#
# Each material uses its OWN pattern (brick/plank/tile/weave/panel/mottle/...), not
# one noise recoloured. Everything is seamless: noise lattices wrap, and the grid
# patterns (brick/tile/plank/weave/panel) are periodic by construction.
# Output: public/assets/textures/{world1,hangar}/<name>_diff.png / _nrm.png

import numpy as np, os
try:
    import bpy; _HAS_BPY = True
except Exception:
    _HAS_BPY = False

N = 1024
ROOT = "/Users/cliowu/claude-workspace/game/public/assets/textures"
_xs = np.linspace(0, 1, N, endpoint=False)
X, Y = np.meshgrid(_xs, _xs)            # X across cols, Y down rows, both [0,1)

# ── tileable value noise (rectangular → anisotropy) + fbm + normal ───────────
def vnoise(N, Px, Py, seed):
    rng = np.random.default_rng(seed); lat = rng.random((Py, Px))
    cx = np.linspace(0, Px, N, endpoint=False); cy = np.linspace(0, Py, N, endpoint=False)
    ix0 = np.floor(cx).astype(int) % Px; ix1 = (ix0+1) % Px; fx = cx-np.floor(cx); fx = fx*fx*(3-2*fx)
    iy0 = np.floor(cy).astype(int) % Py; iy1 = (iy0+1) % Py; fy = cy-np.floor(cy); fy = fy*fy*(3-2*fy)
    v00 = lat[np.ix_(iy0,ix0)]; v01 = lat[np.ix_(iy0,ix1)]; v10 = lat[np.ix_(iy1,ix0)]; v11 = lat[np.ix_(iy1,ix1)]
    FX, FY = fx[None,:], fy[:,None]
    return (v00*(1-FX)+v01*FX)*(1-FY) + (v10*(1-FX)+v11*FX)*FY

def fbm(N, Px, Py, oct, seed, persist=0.5):
    out = np.zeros((N,N)); amp=1.0; tot=0.0
    for o in range(oct):
        out += amp*vnoise(N, Px*(2**o), Py*(2**o), seed+o*17); tot += amp; amp *= persist
    return out/tot

def to_normal(h, strength):
    dx = (np.roll(h,1,1)-np.roll(h,-1,1))*strength
    dy = (np.roll(h,1,0)-np.roll(h,-1,0))*strength
    nz = np.ones_like(h); L = np.sqrt(dx*dx+dy*dy+nz*nz)
    return np.stack([dx/L*0.5+0.5, dy/L*0.5+0.5, nz/L*0.5+0.5, np.ones_like(h)], -1)

def cellhash(ci, cj, mi, mj, seed):           # per-cell random that WRAPS (tileable)
    ci = ci % mi; cj = cj % mj
    n = (ci*73856093) ^ (cj*19349663) ^ (seed*83492791)
    n = (n ^ (n >> 13)) & 0x7fffffff
    return (n % 10000) / 10000.0

def diff_of(shade, grain, base, lite, grAmt):
    t = np.clip(shade, 0, 1)
    r = base[0]+t*(lite[0]-base[0]); g = base[1]+t*(lite[1]-base[1]); b = base[2]+t*(lite[2]-base[2])
    mod = 1.0 + (grain-0.5)*grAmt
    return np.stack([np.clip(r*mod,0,1), np.clip(g*mod,0,1), np.clip(b*mod,0,1), np.ones_like(t)], -1)

# ── PATTERNS ─────────────────────────────────────────────────────────────────
def mottle(p):                                # organic: grass / dirt / stone / concrete
    macro = fbm(N, p["macP"], p["macP"], 4, p["seed"], 0.5)
    grain = fbm(N, p["grP"],  p["grP"],  3, p["seed"]+99, 0.6)
    shade = np.clip((macro-0.5)/0.457 + 0.5, 0, 1)   # macroBlotch 1.05× (0.48/1.05)
    return diff_of(shade, grain, p["base"], p["lite"], p.get("grAmt",0.14)), 0.4*macro+0.6*grain

def leaf(p):                                  # hedge: fine mottle + leaf speckle
    macro = fbm(N, 12, 12, 4, p["seed"], 0.5)
    grain = fbm(N, p["grP"], p["grP"], 3, p["seed"]+5, 0.6)
    speck = (fbm(N, 200, 200, 2, p["seed"]+9, 0.7) > 0.63) * 0.10
    shade = np.clip((macro-0.5)/0.476 + 0.5, 0, 1)   # macroBlotch 1.05× (0.50/1.05)
    d = diff_of(shade, grain, p["base"], p["lite"], 0.22)
    d[...,:3] = np.clip(d[...,:3] - speck[...,None], 0, 1)
    return d, 0.5*macro+0.5*grain

def plaster(p):                               # stucco: very fine grain + faint trowel streaks
    fine = fbm(N, 110, 110, 3, p["seed"], 0.55)
    streak = vnoise(N, 3, 46, p["seed"]+7)
    shade = np.clip(0.5 + (fine-0.5)*0.35 + (streak-0.5)*0.12, 0, 1)
    return diff_of(shade, fine, p["base"], p["lite"], 0.05), 0.7*fine+0.3*streak

def brick(p):                                 # offset rows + mortar (stone blocks / brick walls)
    rows, cols, m = p["rows"], p["cols"], p["mortar"]
    ry = Y*rows; row = np.floor(ry).astype(int); fy = ry-row
    cx = X*cols + (row % 2)*0.5; col = np.floor(cx).astype(int); fx = cx-col
    edge = (fx < m) | (fx > 1-m) | (fy < m) | (fy > 1-m)
    var = cellhash(row, col, rows, cols, p["seed"])
    grain = fbm(N, 110, 110, 3, p["seed"]+3, 0.6)
    shade = np.where(edge, 0.20, 0.55 + var*0.38)
    h = np.where(edge, 0.12, 0.85) - (grain-0.5)*0.06
    return diff_of(shade, grain, p["base"], p["lite"], 0.10), h

def planks(p):                                # vertical planks + along-grain streaks
    P = p["planks"]; cx = X*P; col = np.floor(cx).astype(int); fx = cx-col
    gap = (fx < 0.03) | (fx > 0.97)
    var = cellhash(col, np.zeros_like(col), P, 1, p["seed"])
    grain = vnoise(N, 40, 3, p["seed"]+2)     # fine across X, coarse along Y → wood grain
    knot  = fbm(N, P*3, 6, 2, p["seed"]+4, 0.6)
    shade = np.where(gap, 0.28, 0.50 + var*0.22 + (grain-0.5)*0.30 + (knot-0.5)*0.10)
    h = np.where(gap, 0.15, 0.78 + (grain-0.5)*0.18)
    return diff_of(np.clip(shade,0,1), grain, p["base"], p["lite"], 0.10), h

def tile(p):                                  # roof shingles: offset rows, overhang shadow
    rows, cols = p["rows"], p["cols"]
    ry = Y*rows; row = np.floor(ry).astype(int); fy = ry-row
    cx = X*cols + (row % 2)*0.5; col = np.floor(cx).astype(int); fx = cx-col
    side = (fx < 0.05) | (fx > 0.95)
    topshadow = np.clip((0.4-fy)/0.4, 0, 1)*0.45             # shadow under the row above
    var = cellhash(row, col, rows, cols, p["seed"])
    grain = fbm(N, 130, 130, 2, p["seed"]+4, 0.6)
    shade = np.clip(0.62 + var*0.22 - topshadow - side*0.4, 0, 1)
    h = np.clip(0.85 - topshadow*0.7 - side*0.5, 0, 1)
    return diff_of(shade, grain, p["base"], p["lite"], 0.08), h

def weave(p):                                 # fabric: over-under thread weave
    f = p["threads"]
    warp = np.abs(np.sin(X*np.pi*f)); weft = np.abs(np.sin(Y*np.pi*f))
    checker = ((np.floor(X*f).astype(int) + np.floor(Y*f).astype(int)) % 2) == 0
    thread = np.where(checker, warp, weft)
    grain = fbm(N, 160, 160, 2, p["seed"]+1, 0.6)
    return diff_of(np.clip(0.45+thread*0.30,0,1), grain, p["base"], p["lite"], 0.08), thread

def panel(p):                                 # metal: panels + seams + rivets + brushed
    P = p["panels"]; rx = (X*P) % 1; rry = (Y*P) % 1
    seam = (rx < 0.02) | (rry < 0.02)
    rivet = (((rx < 0.06) | (rx > 0.94)) & ((rry < 0.06) | (rry > 0.94))) * 0.18
    brushed = vnoise(N, 240, 4, p["seed"]+2)
    shade = np.clip(np.where(seam, 0.40, 0.60 + (brushed-0.5)*0.15) + rivet, 0, 1)
    h = np.clip(np.where(seam, 0.30, 0.70) + rivet, 0, 1)
    return diff_of(shade, brushed, p["base"], p["lite"], 0.06), h

PAT = {"mottle":mottle, "leaf":leaf, "plaster":plaster, "brick":brick,
       "planks":planks, "tile":tile, "weave":weave, "panel":panel}

# ── material library: each picks a pattern + palette ─────────────────────────
MATERIALS = {
  # Pastel-studio bake 2026-06-13: range 0.68× (tighter base↔lite), fineGrain 1.35×, nrm 1.5×, macroBlotch ~current.
  "grass":      dict(dir="world1", pat="mottle",  base=(0.14,0.34,0.08), lite=(0.19,0.44,0.11), macP=4, grP=64, grAmt=0.216, nrm=3.9, seed=11),
  "dirt":       dict(dir="world1", pat="mottle",  base=(0.64,0.53,0.39), lite=(0.72,0.61,0.45), macP=4, grP=70, grAmt=0.216, nrm=3.3, seed=2),
  "stone":      dict(dir="world1", pat="mottle",  base=(0.50,0.48,0.44), lite=(0.58,0.55,0.50), macP=5, grP=60, grAmt=0.162, nrm=3.3, seed=3),
  "concrete":   dict(dir="hangar", pat="mottle",  base=(0.52,0.51,0.49), lite=(0.60,0.59,0.57), macP=5, grP=85, grAmt=0.07, nrm=1.5, seed=5),
  "hedge":      dict(dir="world1", pat="leaf",    base=(0.19,0.38,0.15), lite=(0.25,0.47,0.19), grP=90, nrm=3.6, seed=4),
  "plaster":    dict(dir="world1", pat="plaster", base=(0.73,0.69,0.61), lite=(0.79,0.75,0.67), nrm=1.95, seed=9),
  "stoneblock": dict(dir="world1", pat="brick",   base=(0.48,0.46,0.42), lite=(0.58,0.55,0.50), rows=6,  cols=4, mortar=0.07, nrm=4.5, seed=12),
  "rooftile":   dict(dir="world1", pat="tile",    base=(0.50,0.26,0.20), lite=(0.60,0.33,0.25), rows=11, cols=8, nrm=4.2, seed=13),
  "wood":       dict(dir="hangar", pat="planks",  base=(0.38,0.26,0.14), lite=(0.50,0.36,0.21), planks=5, nrm=2.0, seed=8),
  "fabric":     dict(dir="hangar", pat="weave",   base=(0.40,0.12,0.12), lite=(0.50,0.18,0.18), threads=12, nrm=1.6, seed=6),
  "metal":      dict(dir="hangar", pat="panel",   base=(0.40,0.42,0.46), lite=(0.50,0.52,0.56), panels=3, nrm=1.4, seed=7),
  # Long Road POI props (treepatch.glb) — subtle grain at the approved prop palette, matted in-engine.
  "prop_foliage": dict(dir="props", pat="leaf",   base=(0.24,0.50,0.20), lite=(0.31,0.58,0.25), grP=94, nrm=2.4, seed=21),
  "prop_bark":    dict(dir="props", pat="planks", base=(0.36,0.25,0.14), lite=(0.46,0.33,0.20), planks=4, nrm=1.7, seed=22),
  "prop_stone":   dict(dir="props", pat="mottle", base=(0.53,0.51,0.47), lite=(0.60,0.57,0.52), macP=5, grP=72, grAmt=0.10, nrm=2.0, seed=23),
}

def save_png(name, arr, path, is_data):
    if _HAS_BPY:
        img = bpy.data.images.get(name)
        if img: bpy.data.images.remove(img)
        img = bpy.data.images.new(name, N, N, alpha=False, float_buffer=False)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels.foreach_set(arr.astype(np.float32).flatten())
        img.update(); img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    else:
        from PIL import Image
        Image.fromarray((np.clip(arr,0,1)*255).astype(np.uint8), 'RGBA').save(path)

def generate_all(only=None):
    made = []
    for name, p in MATERIALS.items():
        if only and name not in only: continue
        out = os.path.join(ROOT, p["dir"]); os.makedirs(out, exist_ok=True)
        diff, h = PAT[p["pat"]](p)
        nrm = to_normal(h, p.get("nrm", 2.0))
        save_png(f"{name}_diff", diff, os.path.join(out, f"{name}_diff.png"), False)
        save_png(f"{name}_nrm",  nrm,  os.path.join(out, f"{name}_nrm.png"),  True)
        made.append(f"{p['dir']}/{name}({p['pat']})")
    return made

if _HAS_BPY or __name__ == "__main__":
    print("generated:", generate_all())
