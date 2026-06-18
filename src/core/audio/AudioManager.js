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

// Every browser loads the 48 kHz AAC (.m4a). The original .ogg sources were
// 192 kHz — out of spec, so iOS Safari was silent AND real Chrome couldn't
// actually produce sound from them (it only "played" them in name). AAC at
// 48 kHz is universally decodable (Chrome/Firefox/Safari/iOS/Android), so the
// manifest's .ogg paths are simply mapped to their .m4a sibling.
const srcUrl = (url) => BASE + url.replace(/\.ogg$/, '.m4a');

class AudioManager {
  constructor() {
    this.engine = null;
    this.buses = {};         // name -> AudioBus
    this.sounds = {};        // id   -> { snd, def, _looping }
    this.pools = {};         // id   -> { def, free:[Sound], used:Map<handle,Sound> } (per-emitter loops)
    this.ready = false;      // sounds loaded
    this.unlocked = false;   // browser granted playback (after a user gesture)
    this._initStarted = false;
    this._duckTimer = null;
  }

  async init() {
    if (this._initStarted) return;
    this._initStarted = true;
    try {
      // disableDefaultUI: suppress Babylon's built-in "unmute" overlay button
      // (the stray top-left button) — we have our own music toggle, and
      // resumeOnInteraction (default true) still unlocks audio on first gesture.
      this.engine = await CreateAudioEngineAsync({ disableDefaultUI: true });

      // Category buses — everything routes through one of these for group mixing.
      for (const [name, cfg] of Object.entries(BUSES)) {
        const bus = await CreateAudioBusAsync(name);
        bus.volume = cfg.volume;
        this.buses[name] = bus;
      }

      // Preload + route every declared sound. `poolSize` ids get a pool of
      // independent spatial instances instead (one looped emitter per enemy).
      await Promise.all(Object.entries(SOUNDS).map(async ([id, def]) => {
        if (def.poolSize) {
          const free = [];
          for (let k = 0; k < def.poolSize; k++) {
            const s = await CreateSoundAsync(`${id}#${k}`, srcUrl(def.url), { spatialEnabled: true, maxInstances: 1 });
            if (this.buses[def.bus]) s.outBus = this.buses[def.bus];
            if (def.gain != null) s.volume = def.gain;
            free.push(s);
          }
          this.pools[id] = { def, free, used: new Map() };
          return;
        }
        const snd = await CreateSoundAsync(id, srcUrl(def.url), {
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
    // Pre-play tweaks must NEVER prevent the sound — a throw here (e.g. a duck or
    // spatial-attach failing on some browser) used to silently swallow the whole
    // play() and the sound went mute. Each step is isolated; play() always runs.
    try {
      if (def.pitchVar) snd.playbackRate = 1 + (Math.random() * 2 - 1) * def.pitchVar;
      if (def.spatial && opts.emitter && snd.spatial && typeof snd.spatial.attach === 'function') {
        snd.spatial.attach(opts.emitter);
      }
    } catch (e) { console.warn('[audio] pre-play tweak failed:', id, e); }
    try { snd.play(); } catch (e) { console.warn('[audio] play failed:', id, e); }
    try { if (def.duck) this._duck(); } catch (e) { console.warn('[audio] duck failed:', id, e); }
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

  // Live pitch change on a playing sound (e.g. engine RPM with throttle). A loop's
  // playbackRate maps to the source's AudioParam, so it's safe to set every frame;
  // the caller smooths the value so there's no zipper noise.
  setPlaybackRate(id, rate) {
    const entry = this.sounds[id];
    if (!entry) return;
    try { entry.snd.playbackRate = rate; } catch (_) {}
  }

  // TAPE-STOP pause: every live loop bends DOWN in pitch (playbackRate → near-0)
  // while its bus fades to silence — the classic "wind down to a halt." Volume
  // rides a native bus ramp (works even if rAF is throttled on a hidden tab);
  // pitch rides a rAF ramp. The _paused flag stops an in-flight duck from fighting.
  pauseAll(ms = 400) {
    if (!this.ready) return;
    this._paused = true;
    this._stopRamp();
    const dur = ms / 1000;
    for (const name in this.buses) this._setBusVolume(name, 0, dur);
    const srcs = this._activeSources().map(snd => ({ snd, from: (snd.playbackRate ?? 1) || 1 }));
    // ease-in (p²) so it lingers near speed then drops away fast → from → from*0.06
    this._rampPitch(srcs, ms, (from, p) => from * (1 - 0.94 * (p * p)));
  }

  // TAPE-START resume: pitch spins back up to normal as the buses fade back in.
  // (Tank.update re-owns the engine's playbackRate within a frame; the volume
  // fade-in masks the hand-off.)
  resumeAll(ms = 400) {
    this._paused = false;
    this._stopRamp();
    const dur = ms / 1000;
    for (const name in this.buses) this._setBusVolume(name, BUSES[name].volume, dur);
    const srcs = this._activeSources().map(snd => ({ snd, from: (snd.playbackRate ?? 0.06) || 0.06 }));
    // ease-out so it picks up quickly then settles at 1.0
    this._rampPitch(srcs, ms, (from, p) => from + (1 - from) * (p * (2 - p)));
  }

  // Every currently-audible looping source: declared loops + pooled spatial loops.
  _activeSources() {
    const out = [];
    for (const id in this.sounds) if (this.sounds[id]._looping) out.push(this.sounds[id].snd);
    for (const id in this.pools) for (const inst of this.pools[id].used.values()) out.push(inst);
    return out;
  }

  // Drive playbackRate over `ms` via rAF. fn(from, p)->rate, p in [0,1].
  _rampPitch(srcs, ms, fn) {
    if (!srcs.length) return;
    const apply = (p) => { for (const s of srcs) { try { s.snd.playbackRate = Math.max(0.0625, fn(s.from, p)); } catch (_) {} } };
    if (ms <= 0) { apply(1); return; }
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      apply(p);
      this._rampRAF = p < 1 ? requestAnimationFrame(step) : null;
    };
    this._rampRAF = requestAnimationFrame(step);
  }

  _stopRamp() { if (this._rampRAF) { cancelAnimationFrame(this._rampRAF); this._rampRAF = null; } }

  // Master volume for a whole category bus (e.g. the settings SFX slider). Updates
  // the live bus and the BUSES baseline so the duck system restores to the new
  // level. Safe before init — the baseline is read when buses are created.
  setBusVolume(name, v) {
    if (BUSES[name]) BUSES[name].volume = v;
    const bus = this.buses[name];
    if (bus) { try { bus.volume = v; } catch (_) {} }
  }

  // Per-emitter looped sound: borrow a pooled spatial instance, attach it to the
  // emitter mesh, loop it, and return a handle. Each enemy gets its OWN positioned
  // loop (engine/whir/skitter). Returns null if not ready or pool exhausted —
  // callers should retry next frame (lazy attach). detachLoop() on death.
  attachLoop(id, emitter) {
    const pool = this.pools[id];
    if (!this.ready || !pool || pool.free.length === 0) return null;
    const inst = pool.free.pop();
    const handle = { id, inst };
    try { if (emitter && inst.spatial && typeof inst.spatial.attach === 'function') inst.spatial.attach(emitter); } catch (_) {}
    try { inst.play({ loop: true }); } catch (_) {}
    pool.used.set(handle, inst);
    return handle;
  }

  detachLoop(handle) {
    if (!handle) return;
    const pool = this.pools[handle.id];
    if (!pool || !pool.used.has(handle)) return;
    try { handle.inst.stop(); } catch (_) {}
    pool.used.delete(handle);
    pool.free.push(handle.inst);
  }

  // Stop + reclaim every pooled loop (call on arena teardown/restart so loops
  // don't leak across runs).
  releaseAllPooled() {
    for (const id in this.pools) {
      const p = this.pools[id];
      for (const inst of p.used.values()) { try { inst.stop(); } catch (_) {} p.free.push(inst); }
      p.used.clear();
    }
  }

  // Briefly pull down music/ambience so an impactful SFX reads, then restore.
  _duck() {
    clearTimeout(this._duckTimer);
    for (const name of DUCK.buses) this._setBusVolume(name, BUSES[name].volume * DUCK.amount, DUCK.attack);
    this._duckTimer = setTimeout(() => {
      if (this._paused) return; // a pause fade owns the buses now; don't fight it
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
