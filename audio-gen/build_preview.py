#!/usr/bin/env python3
"""Scan candidates/*.ogg and emit preview.html — an audition page to pick the
best AudioGen take per slice sound (A/B against the placeholder tone)."""
import os, glob, json, html
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

# slice id -> (placeholder path under public/assets/audio, text prompt used)
META = {
    "tank.cannon_fire":           ("sfx/tank/cannon_fire.ogg",           "heavy tank cannon firing — deep boom + sharp crack"),
    "tank.hit_heavy":             ("sfx/tank/hit_heavy.ogg",             "shell slamming into thick steel armor"),
    "tank.shield_activate":       ("sfx/tank/shield_activate.ogg",       "energy force field switching on — rising hum"),
    "tank.shield_loop":           ("sfx/tank/shield_loop.ogg",           "continuous shield hum — steady drone (loops)"),
    "tank.shield_break":          ("sfx/tank/shield_break.ogg",          "shield collapsing — descending whine"),
    "enemy.sentinel_beam_charge": ("sfx/enemy/sentinel_beam_charge.ogg", "laser cannon charging — rising whine (dodge tell)"),
    "enemy.sentinel_beam_fire":   ("sfx/enemy/sentinel_beam_fire.ogg",   "laser beam blast — energy discharge zap"),
    "ui.wave_start":              ("ui/wave_start.ogg",                  "industrial warning klaxon / alert siren"),
}

groups = defaultdict(list)
for f in sorted(glob.glob(os.path.join(HERE, "candidates", "*.ogg"))):
    name = os.path.basename(f)
    sid = name.split("__v")[0]
    groups[sid].append(name)

cards = []
for sid in META:
    placeholder, prompt = META[sid]
    cands = groups.get(sid, [])
    def _label(fname, i):
        # filename: <id>__v<k>__<source>.ogg  → show the CC0 source name
        parts = fname[:-4].split("__")
        src = parts[2] if len(parts) >= 3 else f"v{i+1}"
        return f"v{i+1} · {src}"
    rows = [f"""
      <div class="cand">
        <label><input type="radio" name="pick__{sid}" value="{html.escape(c)}"> {html.escape(_label(c,i))}</label>
        <audio controls preload="none" src="candidates/{html.escape(c)}"></audio>
      </div>""" for i, c in enumerate(cands)]
    cands_html = "".join(rows) if rows else '<div class="empty">— no candidates generated —</div>'
    cards.append(f"""
    <section class="card">
      <div class="hd"><span class="sid">{html.escape(sid)}</span>
        <label class="ph"><input type="radio" name="pick__{sid}" value="__placeholder__" checked> keep placeholder</label>
      </div>
      <div class="prompt">“{html.escape(prompt)}”</div>
      <div class="ref">placeholder ref:&nbsp;<audio controls preload="none" src="../public/assets/audio/{placeholder}"></audio></div>
      <div class="cands">{cands_html}</div>
    </section>""")

doc = f"""<!doctype html><html><head><meta charset="utf-8"><title>TanKING — AudioGen audition</title>
<style>
  :root {{ --bg:#0c0f14; --pnl:#141a23; --ln:#1f2a38; --cy:#4fd6ff; --tx:#cdd6e2; --dim:#7f8da0; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--tx); font:14px/1.5 ui-monospace,Menlo,monospace; padding:28px; }}
  h1 {{ color:var(--cy); font-size:18px; letter-spacing:.06em; margin:0 0 4px; }}
  .sub {{ color:var(--dim); margin-bottom:24px; }}
  .card {{ background:var(--pnl); border:1px solid var(--ln); border-radius:10px; padding:16px 18px; margin-bottom:14px; }}
  .hd {{ display:flex; justify-content:space-between; align-items:center; }}
  .sid {{ color:var(--cy); font-weight:600; letter-spacing:.04em; }}
  .ph {{ color:var(--dim); font-size:12px; }}
  .prompt {{ color:var(--dim); font-style:italic; margin:6px 0 12px; }}
  .ref {{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--dim); margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed var(--ln); }}
  .cands {{ display:flex; flex-direction:column; gap:8px; }}
  .cand {{ display:flex; align-items:center; gap:12px; }}
  .cand label {{ min-width:46px; }}
  .empty {{ color:#5a6473; }}
  audio {{ height:32px; }}
  .bar {{ position:sticky; bottom:0; margin-top:20px; background:#0c0f14ee; border:1px solid var(--ln); border-radius:10px; padding:14px; }}
  button {{ background:var(--cy); color:#04121a; border:0; border-radius:6px; padding:8px 16px; font:inherit; font-weight:700; cursor:pointer; }}
  textarea {{ width:100%; height:120px; margin-top:10px; background:#0a0d12; color:var(--tx); border:1px solid var(--ln); border-radius:6px; padding:10px; font:inherit; }}
</style></head><body>
  <h1>TanKING — CC0 sound audition (Kenney, public domain)</h1>
  <div class="sub">Real CC0 game-SFX candidates (Kenney Sci-Fi + Interface packs — free, commercial-safe) vs. the placeholder tone. Pick one per sound, then “collect picks” and paste the result back to me — I’ll bake your choices into the game.</div>
  {''.join(cards)}
  <div class="bar">
    <button onclick="collect()">collect picks ▾</button>
    <textarea id="out" readonly placeholder="your picks appear here"></textarea>
  </div>
<script>
function collect() {{
  const picks = {{}};
  document.querySelectorAll('input[type=radio]:checked').forEach(r => {{
    picks[r.name.replace('pick__','')] = r.value;
  }});
  document.getElementById('out').value = JSON.stringify(picks, null, 2);
}}
</script>
</body></html>"""

with open(os.path.join(HERE, "preview.html"), "w") as fh:
    fh.write(doc)
print(f"wrote preview.html  ({sum(len(v) for v in groups.values())} candidates across {len(groups)} sounds)")
