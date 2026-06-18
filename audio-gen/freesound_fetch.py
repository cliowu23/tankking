#!/usr/bin/env python3
"""
Fetch REAL CC0 sound candidates from Freesound for the TanKING "sample the real"
audio layer — engine rumble, metal impacts, explosions, gravel, etc. The synth
studio (sfx-synth-studio.html) owns the *synthetic* sounds; this owns the *real*.

ZERO IP RISK is priority #1, so CC0 is enforced TWICE, independently:
  1. The search query filters server-side to license:"Creative Commons 0".
  2. Every returned sound is RE-VERIFIED against the CC0 public-domain deed
     before a single byte is downloaded. Anything that doesn't match is
     discarded, not saved. (Belt and suspenders.)

For provenance, every saved file is logged to freesound_sources.json with its
Freesound id, author, license URL, and source page — a permanent paper trail
even though CC0 legally requires no attribution.

Fetches token-only HQ previews (fast, audition many candidates). Lossless
originals for your final picks are pulled later via OAuth (see --originals path,
wired once you've curated picks.json).

Setup (~2 min, no pip installs — stdlib only):
  1. Get an API key: https://freesound.org/apiv2/apply
  2. Put it in your shell:  export FREESOUND_API_KEY=xxxxx
     ...or drop a line  FREESOUND_API_KEY=xxxxx  in audio-gen/.env (gitignored)

Run:
  python3 audio-gen/freesound_fetch.py              # fetch all JOBS below
  python3 audio-gen/freesound_fetch.py tank.engine  # fetch one slot only
"""
import os, sys, json, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(HERE, "cc0", "freesound")          # gitignored staging
SOURCES = os.path.join(HERE, "freesound_sources.json")   # TRACKED provenance log
API = "https://freesound.org/apiv2"

# The CC0 deed every saved sound must resolve to. Freesound returns `license`
# as a URL; we accept ONLY the public-domain-zero deed. Nothing else downloads.
CC0_MARKER = "publicdomain/zero"

# How many candidates to pull per slot, and the HQ preview format we save.
PER_SLOT = 12
PREVIEW_KEY = "preview-hq-ogg"   # ogg keeps the pipeline ogg-native; falls back to mp3

# slot id -> (search query, current baked ref under public/assets/audio, note)
# These are the "real" sounds where synth/Kenney is weakest. Edit freely —
# add a row, rerun, audition. The slot id matches soundManifest.js so picks
# flow straight into your existing picks.json -> bake path.
JOBS = {
    "tank.engine":      ("diesel engine idle",       "sfx/tank/engine.m4a",      "low diesel idle rumble (loops)"),
    "tank.hit_heavy":   ("metal impact",             "sfx/tank/hit_heavy.m4a",   "shell into thick steel plate"),
    "tank.hit_light":   ("metal ricochet",           "sfx/tank/hit_light.m4a",   "glancing hit / ricochet"),
    "tank.destroyed":   ("explosion",                "sfx/tank/destroyed.m4a",   "tank brewing up — explosion + debris"),
    "tank.cannon_fire": ("cannon fire boom artillery",            "sfx/tank/cannon_fire.m4a", "heavy cannon — deep boom + crack"),
    "tank.reload":      ("mechanical clank",         "sfx/tank/reload.m4a",      "breech / mechanical reload clank"),
}


def load_env_key():
    """FREESOUND_API_KEY from env, or from a gitignored audio-gen/.env."""
    key = os.environ.get("FREESOUND_API_KEY")
    if key:
        return key.strip()
    envf = os.path.join(HERE, ".env")
    if os.path.exists(envf):
        for line in open(envf):
            line = line.strip()
            if line.startswith("FREESOUND_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


import time, urllib.error

# Freesound's infra flickers (intermittent 502/503). Retry with backoff so a
# single run powers through outages instead of needing manual re-runs.
RETRIES = 6
BACKOFF = 4   # seconds: 4, 8, 12, 16, 20, 24

def _get(url, timeout):
    """GET with retry/backoff on transient server errors + timeouts."""
    req = urllib.request.Request(url, headers={"User-Agent": "TanKING-audio-fetch"})
    for attempt in range(1, RETRIES + 1):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            # 4xx (bad key, bad query) won't fix itself — fail fast. Retry only 5xx.
            if e.code < 500 or attempt == RETRIES:
                raise
            print(f"      .. server {e.code}, retry {attempt}/{RETRIES} in {BACKOFF*attempt}s", flush=True)
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == RETRIES:
                raise
            print(f"      .. {e}, retry {attempt}/{RETRIES} in {BACKOFF*attempt}s", flush=True)
        time.sleep(BACKOFF * attempt)


def search(query, token):
    """Text search, server-side filtered to CC0. Returns the results list."""
    params = urllib.parse.urlencode({
        "query": query,
        "filter": 'license:"Creative Commons 0"',
        "fields": "id,name,username,license,previews,url,duration,type",
        "page_size": PER_SLOT,
        "sort": "score",
        "token": token,
    })
    with _get(f"{API}/search/text/?{params}", timeout=30) as r:
        return json.load(r).get("results", [])


def is_cc0(snd):
    """Independent re-verification — the gate that makes 'CC0 only' real."""
    return CC0_MARKER in (snd.get("license") or "").lower()


def download(url, dest):
    with _get(url, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def main():
    token = load_env_key()
    if not token:
        sys.exit("!! No FREESOUND_API_KEY. Get one at https://freesound.org/apiv2/apply\n"
                 "   then: export FREESOUND_API_KEY=xxxxx   (or add it to audio-gen/.env)")

    only = sys.argv[1] if len(sys.argv) > 1 else None
    jobs = {only: JOBS[only]} if only and only in JOBS else JOBS
    if only and only not in JOBS:
        sys.exit(f"!! unknown slot '{only}'. known: {', '.join(JOBS)}")

    sources = json.load(open(SOURCES)) if os.path.exists(SOURCES) else {}
    total, rejected = 0, 0

    for slot, (query, _ref, _note) in jobs.items():
        outdir = os.path.join(STAGE, slot)
        os.makedirs(outdir, exist_ok=True)
        print(f"[fs] {slot}  :: \"{query}\"", flush=True)
        try:
            results = search(query, token)
        except Exception as e:
            print(f"   !! search failed: {e}", flush=True)
            continue

        k = 0
        for snd in results:
            # GATE 2: reject anything not literally CC0, no matter what the filter said.
            if not is_cc0(snd):
                rejected += 1
                print(f"   xx rejected #{snd.get('id')} (license={snd.get('license')})", flush=True)
                continue
            prev = snd.get("previews", {})
            url = prev.get(PREVIEW_KEY) or prev.get("preview-hq-mp3")
            if not url:
                continue
            k += 1
            ext = ".ogg" if url.endswith(".ogg") else ".mp3"
            fname = f"{slot}__v{k}__fs{snd['id']}{ext}"
            dest = os.path.join(outdir, fname)
            try:
                download(url, dest)
            except Exception as e:
                print(f"   !! download #{snd['id']} failed: {e}", flush=True)
                k -= 1
                continue
            sources[fname] = {
                "freesound_id": snd["id"],
                "name": snd.get("name"),
                "author": snd.get("username"),
                "license": snd.get("license"),
                "source_url": snd.get("url"),
                "duration": snd.get("duration"),
                "query": query,
                "slot": slot,
            }
            total += 1
            print(f"   ok {fname}  ({snd.get('duration', 0):.1f}s)  by {snd.get('username')}", flush=True)

    json.dump(sources, open(SOURCES, "w"), indent=2)
    print(f"\n[fs] DONE — {total} CC0 clips fetched, {rejected} non-CC0 rejected.", flush=True)
    print(f"[fs] provenance -> {os.path.relpath(SOURCES, HERE)}", flush=True)
    print(f"[fs] now build the audition page:  python3 audio-gen/build_freesound_preview.py", flush=True)


if __name__ == "__main__":
    main()
