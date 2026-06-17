# Audio Polish / Revisit List

Running list of sounds that work as placeholders but the user wants to revisit
and bring to the next level. **Strategy: build the whole library to breadth
first, then do a dedicated polish pass over this list.**

Tune synth sounds in `sfx-synth-studio.html` (sliders), then re-bake. Volumes
live in `src/core/audio/soundManifest.js` (`gain` per sound). Beep cadence lives
as `STEP_INTERVAL` in each enemy's `_moveBeep`.

## To revisit
- [ ] **tank.engine** — great placeholder / amazing start, but user has critiques to bring it next-level (2026-06-17).
- [ ] **enemy.chaff_step / enemy.sentinel_step** (movement beeps) — concept approved but "okay, will need to revisit"; dialled volume down for now (chaff gain 0.16, sentinel 0.22). Revisit tone/cadence/feel later (2026-06-17).

## Ideas / reserved
- [ ] **amb.sea** (`ambience/sea.ogg`) — the old "arena wind" reads as ocean surf; user liked it for a future **coastal / sea leg**. Baked + in manifest, NOT wired. Use when a sea/ocean zone exists.
- [ ] **Grassy-zone ambience (W1)** — user undecided (maybe none). Pending cozy-grassland ambient research (2026-06-17). Hangar hum kept (liked).

## Done / resolved
- cannon_fire was too loud → gain 1.0 → 0.6 (2026-06-17).
- enemy idle drones (whir/skitter) too loud/annoying → replaced with movement beeps (2026-06-17).
