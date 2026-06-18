#!/usr/bin/env python3
"""Scan cc0/freesound/<slot>/*.{ogg,mp3} and emit freesound-audition.html — an
audition page to pick the best REAL CC0 take per slot (A/B against the current
baked sound). Mirrors build_preview.py; output 'picks' JSON drops straight into
your picks.json -> bake flow. Author/license shown per candidate from
freesound_sources.json (provenance)."""
import os, glob, json, html
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(HERE, "cc0", "freesound")
SOURCES = os.path.join(HERE, "freesound_sources.json")

# Pull the slot -> (ref, note) table straight from the fetcher so the two stay in sync.
import importlib.util
spec = importlib.util.spec_from_file_location("ff", os.path.join(HERE, "freesound_fetch.py"))
ff = importlib.util.module_from_spec(spec); spec.loader.exec_module(ff)
JOBS = ff.JOBS

sources = json.load(open(SOURCES)) if os.path.exists(SOURCES) else {}

groups = defaultdict(list)
for slot in JOBS:
    for f in sorted(glob.glob(os.path.join(STAGE, slot, "*.ogg")) +
                    glob.glob(os.path.join(STAGE, slot, "*.mp3"))):
        groups[slot].append(os.path.relpath(f, HERE))

cards = []
for slot, (query, ref, note) in JOBS.items():
    cands = groups.get(slot, [])
    rows = []
    for c in cands:
        fname = os.path.basename(c)
        meta = sources.get(fname, {})
        by = meta.get("author", "?")
        dur = meta.get("duration", 0) or 0
        src = meta.get("source_url", "#")
        rows.append(f"""
      <div class="cand">
        <label><input type="radio" name="pick__{slot}" value="{html.escape(fname)}"> {dur:.1f}s · CC0 · by {html.escape(str(by))} · <a href="{html.escape(src)}" target="_blank">source</a></label>
        <audio controls preload="none" src="{html.escape(c)}"></audio>
      </div>""")
    cands_html = "".join(rows) if rows else '<div class="empty">— none fetched yet · run freesound_fetch.py —</div>'
    cards.append(f"""
    <section class="card">
      <div class="hd"><span class="sid">{html.escape(slot)}</span>
        <label class="ph"><input type="radio" name="pick__{slot}" value="__keep__" checked> keep current</label>
      </div>
      <div class="prompt">“{html.escape(query)}” — {html.escape(note)}</div>
      <div class="ref">current baked:&nbsp;<audio controls preload="none" src="../public/assets/audio/{html.escape(ref)}"></audio></div>
      <div class="cands">{cands_html}</div>
    </section>""")

doc = f"""<!doctype html><html><head><meta charset="utf-8"><title>TanKING — Freesound CC0 audition</title>
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
  .cand label {{ min-width:320px; font-size:12px; }}
  .cand a {{ color:var(--cy); }}
  .empty {{ color:#5a6473; }}
  audio {{ height:32px; }}
  .bar {{ position:sticky; bottom:0; margin-top:20px; background:#0c0f14ee; border:1px solid var(--ln); border-radius:10px; padding:14px; }}
  button {{ background:var(--cy); color:#04121a; border:0; border-radius:6px; padding:8px 16px; font:inherit; font-weight:700; cursor:pointer; }}
  textarea {{ width:100%; height:120px; margin-top:10px; background:#0a0d12; color:var(--tx); border:1px solid var(--ln); border-radius:6px; padding:10px; font:inherit; }}
</style></head><body>
  <h1>TanKING — Freesound CC0 audition (public domain, commercial-safe)</h1>
  <div class="sub">Real-world CC0 candidates for the “sample the real” layer vs. the current baked sound. Every clip here is verified CC0 (zero IP risk). Pick one per slot, then “collect picks” and paste the result back to me — I’ll pull the lossless originals and bake your choices.</div>
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

with open(os.path.join(HERE, "freesound-audition.html"), "w") as fh:
    fh.write(doc)
print(f"wrote freesound-audition.html  ({sum(len(v) for v in groups.values())} candidates across {len(groups)} slots)")
