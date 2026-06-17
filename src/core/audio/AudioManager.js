// src/core/audio/AudioManager.js
// Thin, manifest-driven wrapper over Babylon.js Audio Engine v2 (Babylon 8+).
//
// Responsibilities:
//   • own the audio engine + per-category buses (sfx/ui/music/ambience/voice)
//   • preload every sound declared in soundManifest.js
//   • play one-shots with anti-repetition pitch variation
//   • 3D positional playback (attach a sound to an emitter mesh)
//   • looping sounds (shield hold, engines, ambience)
//   • ducking — drop music/ambience under impactful SFX
//   • follow the player with the spatial listener
//
// Designed to fail SILENTLY: if the audio engine can't init, the game keeps
// running without sound rather than crashing.
//
// Usage:
//   import { audio } from './core/audio/AudioManager.js';
//   await audio.init();                 // once, early
//   audio.attachListener(tank.root);    // make 3D audio relative to the player
//   audio.play('tank.cannon_fire', { emitter: barrelTipMesh });
//   audio.startLoop('tank.shield_loop'); audio.stopLoop('tank.shield_loop');

import { CreateAudioEngineAsync, CreateSoundAsync, CreateAudioBusAsync } from '@babylonjs/core';
import { BUSES, DUCK, SOUNDS } from './soundManifest.js';

const BASE = `${import.meta.env.BASE_URL}assets/audio/`;

class AudioManager {
  constructor() {
    this.engine = null;
    this.buses = {};         // name -> AudioBus
    this.sounds = {};        // id   -> { snd, def, _looping }
    this.ready = false;      // sounds loaded
    this.unlocked = false;   // browser granted playback (after a user gesture)
    this._initStarted = false;
    this._duckTimer = null;
  }

  async init() {
    if (this._initStarted) return;
    this._initStarted = true;
    try {
      this.engine = await CreateAudioEngineAsync();

      // Category buses — everything routes through one of these for group mixing.
      for (const [name, cfg] of Object.entries(BUSES)) {
        const bus = await CreateAudioBusAsync(name);
        bus.volume = cfg.volume;
        this.buses[name] = bus;
      }

      // Preload + route every declared sound.
      await Promise.all(Object.entries(SOUNDS).map(async ([id, def]) => {
        const snd = await CreateSoundAsync(id, BASE + def.url, {
          spatialEnabled: !!def.spatial,
          maxInstances: def.maxInstances ?? 1,
        });
        if (this.buses[def.bus]) snd.outBus = this.buses[def.bus];
        if (def.gain != null) snd.volume = def.gain;
        this.sounds[id] = { snd, def, _looping: false };
      }));

      this.ready = true;

      // Resolves the moment the browser allows audio (first user gesture).
      this.engine.unlockAsync().then(() => { this.unlocked = true; });
    } catch (err) {
      console.warn('[audio] init failed — continuing without sound:', err);
    }
  }

  // Bind the spatial listener to the player so 3D sounds pan/attenuate relative
  // to the tank (enemy on the left → pans left).
  attachListener(node) {
    const l = this.engine && this.engine.listener;
    if (!l || !node) return;
    if (typeof l.attach === 'function') l.attach(node);
    else if (l.spatial && typeof l.spatial.attach === 'function') l.spatial.attach(node);
  }

  // Fire-and-forget one-shot. opts.emitter (a mesh) spatializes it.
  play(id, opts = {}) {
    const entry = this.sounds[id];
    if (!this.ready || !entry) {
      if (this.ready && !entry) console.warn('[audio] unknown sound id:', id);
      return;
    }
    const { snd, def } = entry;
    if (def.pitchVar) snd.playbackRate = 1 + (Math.random() * 2 - 1) * def.pitchVar;
    if (def.spatial && opts.emitter && snd.spatial && typeof snd.spatial.attach === 'function') {
      snd.spatial.attach(opts.emitter);
    }
    if (def.duck) this._duck();
    try { snd.play(); } catch (_) { /* not yet unlocked */ }
  }

  startLoop(id, opts = {}) {
    const entry = this.sounds[id];
    if (!this.ready || !entry || entry._looping) return;
    const { snd, def } = entry;
    if (def.spatial && opts.emitter && snd.spatial && typeof snd.spatial.attach === 'function') {
      snd.spatial.attach(opts.emitter);
    }
    entry._looping = true;
    try { snd.play({ loop: true }); } catch (_) {}
  }

  stopLoop(id) {
    const entry = this.sounds[id];
    if (!entry || !entry._looping) return;
    entry._looping = false;
    try { entry.snd.stop(); } catch (_) {}
  }

  // Live volume change on a playing sound (e.g. engine swell with speed).
  // Throttled by the caller; uses a short ramp to avoid clicks.
  setVolume(id, v, dur = 0.12) {
    const entry = this.sounds[id];
    if (!entry) return;
    try {
      if (typeof entry.snd.setVolume === 'function') entry.snd.setVolume(v, { duration: dur });
      else entry.snd.volume = v;
    } catch (_) {}
  }

  // Briefly pull down music/ambience so an impactful SFX reads, then restore.
  _duck() {
    clearTimeout(this._duckTimer);
    for (const name of DUCK.buses) this._setBusVolume(name, BUSES[name].volume * DUCK.amount, DUCK.attack);
    this._duckTimer = setTimeout(() => {
      for (const name of DUCK.buses) this._setBusVolume(name, BUSES[name].volume, DUCK.release);
    }, (DUCK.attack + 0.05) * 1000);
  }

  _setBusVolume(name, v, dur) {
    const bus = this.buses[name];
    if (!bus) return;
    if (dur && typeof bus.setVolume === 'function') bus.setVolume(v, { duration: dur });
    else bus.volume = v;
  }
}

export const audio = new AudioManager();

// Dev hook so the pipeline can be exercised from the console / tests.
if (typeof window !== 'undefined') window.__audio = audio;
