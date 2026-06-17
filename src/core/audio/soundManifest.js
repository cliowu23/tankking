// src/core/audio/soundManifest.js
// The audio registry: every sound the game can play, declared once.
// AudioManager preloads these and routes each to its category bus.
//
// Adding a sound = add a row here + drop the file at public/assets/audio/<url>.
// Per-sound knobs:
//   bus       — category bus for mixing/ducking: sfx | ui | music | ambience | voice
//   spatial   — true → 3D positional (mono source, follows an emitter mesh)
//   loop      — true → loops until stopped (engine/ambience/shield)
//   duck      — true → briefly ducks music+ambience while this plays (impactful SFX)
//   pitchVar  — ± random playbackRate per play (anti-repetition); 0.12 = ±12%
//   gain      — per-sound volume (0..1), on top of the bus volume
//   maxInstances — max simultaneous copies (polyphony for rapid fire)
//
// NOTE: files are currently ffmpeg-generated PLACEHOLDER TONES. Replace the
// .ogg files in place (same path/id) with real assets and nothing else changes.

export const BUSES = {
  sfx:      { volume: 0.90 },
  ui:       { volume: 0.70 },
  music:    { volume: 0.60 },
  ambience: { volume: 0.50 },
  voice:    { volume: 1.00 },
};

// Buses ducked when a `duck` sound fires, and how hard/long.
export const DUCK = { buses: ['music', 'ambience'], amount: 0.30, attack: 0.05, release: 0.40 };

export const SOUNDS = {
  // --- Player tank ---
  'tank.cannon_fire':   { url: 'sfx/tank/cannon_fire.ogg',   bus: 'sfx', spatial: true,  duck: true, pitchVar: 0.12, gain: 0.60, maxInstances: 4 },
  'tank.hit_heavy':     { url: 'sfx/tank/hit_heavy.ogg',     bus: 'sfx', spatial: false, pitchVar: 0.10, gain: 0.90, maxInstances: 3 },
  'tank.hit_light':     { url: 'sfx/tank/hit_light.ogg',     bus: 'sfx', spatial: false, pitchVar: 0.12, gain: 0.75, maxInstances: 3 },
  'tank.shield_activate': { url: 'sfx/tank/shield_activate.ogg', bus: 'sfx', gain: 0.80 },
  'tank.shield_loop':   { url: 'sfx/tank/shield_loop.ogg',   bus: 'sfx', loop: true, gain: 0.45 },
  'tank.shield_break':  { url: 'sfx/tank/shield_break.ogg',  bus: 'sfx', gain: 0.80 },
  'tank.destroyed':     { url: 'sfx/tank/destroyed.ogg',     bus: 'sfx', duck: true, gain: 1.00 },
  'tank.engine':        { url: 'sfx/tank/engine.ogg',        bus: 'sfx', spatial: true, loop: true, gain: 0.10 },
  'tank.reload':        { url: 'sfx/tank/reload.ogg',        bus: 'sfx', spatial: true, pitchVar: 0.05, gain: 0.55 },
  'tank.turret_servo':  { url: 'sfx/tank/turret_servo.ogg',  bus: 'sfx', spatial: true, loop: true, gain: 0.28 },
  'tank.low_fuel':      { url: 'sfx/tank/low_fuel.ogg',      bus: 'ui',  gain: 0.50 },

  // --- The King's machines (spatial — emit from the bot) ---
  'enemy.sentinel_step':        { url: 'sfx/enemy/sentinel_step.ogg',        bus: 'sfx', spatial: true, pitchVar: 0.04, gain: 0.22, maxInstances: 4 },
  'enemy.sentinel_beam_charge': { url: 'sfx/enemy/sentinel_beam_charge.ogg', bus: 'sfx', spatial: true, gain: 0.85 },
  'enemy.sentinel_beam_fire':   { url: 'sfx/enemy/sentinel_beam_fire.ogg',   bus: 'sfx', spatial: true, duck: true, gain: 1.00, maxInstances: 4 },
  'enemy.sentinel_beam_impact': { url: 'sfx/enemy/sentinel_beam_impact.ogg', bus: 'sfx', spatial: true, gain: 0.80, maxInstances: 3 },
  'enemy.sentinel_death':       { url: 'sfx/enemy/sentinel_death.ogg',       bus: 'sfx', spatial: true, gain: 0.90, maxInstances: 3 },
  'enemy.chaff_step':           { url: 'sfx/enemy/chaff_step.ogg',           bus: 'sfx', spatial: true, pitchVar: 0.06, gain: 0.16, maxInstances: 8 },
  'enemy.chaff_laser_fire':     { url: 'sfx/enemy/chaff_laser_fire.ogg',     bus: 'sfx', spatial: true, pitchVar: 0.15, gain: 0.65, maxInstances: 6 },
  'enemy.chaff_death':          { url: 'sfx/enemy/chaff_death.ogg',          bus: 'sfx', spatial: true, pitchVar: 0.12, gain: 0.65, maxInstances: 4 },

  // --- UI ---
  'ui.hover':           { url: 'ui/hover.ogg',   bus: 'ui', gain: 0.45 },
  'ui.select':          { url: 'ui/select.ogg',  bus: 'ui', gain: 0.70 },
  'ui.confirm':         { url: 'ui/confirm.ogg', bus: 'ui', gain: 0.80 },
  'ui.wave_start':      { url: 'ui/wave_start.ogg', bus: 'ui', gain: 0.80 },
};
