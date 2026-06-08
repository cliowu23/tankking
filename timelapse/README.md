# TanKING — Development Timelapse

A living visual record of the game's growth. Open `index.html` (via a local server) and
scrub/replay from the first Phaser rectangles to today.

```
python3 -m http.server 8091   # from this folder, then open http://localhost:8091/
```

## How it works
- **`index.html`** — the Procreate-style replay viewer (crossfade, scrubber, play/pause).
- **`frames.js`** — the manifest (`window.TIMELAPSE_FRAMES`). The viewer reads frames from here.
- **`frames/`** — the captured PNGs (all 2560×1600).
- **`tools/`** — the capture pipeline (git worktree → headless build → screenshot).

## Add a frame when something big ships

One command captures a commit and appends it to the timeline:

```bash
# first time only: install the headless-browser driver
cd tools && npm install && cd ..

# then, after any milestone commit:
tools/record-frame.sh <commit> <mode> <outName> "<date>" "<title>" "<desc>" [section]
```

- **mode** = how to pose the game before the shot:
  - `arena` — deploy into combat
  - `hangar` — the bunker/base
  - `designer` — the modular tank designer
  - `raw` — whatever loads first (earliest builds auto-start in the arena)
- **section** = optional. Pass `base` to tag it into the cyan "Base Evolution" sub-series.

### Examples
```bash
tools/record-frame.sh HEAD arena   frame6-0620-boss.png   "Jun 20" "First Boss"      "The Iron Keep boss fight lands."
tools/record-frame.sh HEAD hangar  base5-0620.png         "Jun 20" "The Base · Radio" "Radio desk + map table wired in." base
```

Then refresh the viewer. The frame is now part of the permanent record.

## Notes
- The tooling never touches your working tree or the running dev servers — it builds an
  isolated `git worktree` in `/tmp`, screenshots, and cleans up.
- Captures use committed states (reproducible). Commit your milestone first, then record it.
