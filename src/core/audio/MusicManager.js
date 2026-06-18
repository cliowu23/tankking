// src/core/audio/MusicManager.js
// Claude-composed music via Tone.js (separate from the SFX AudioManager).
// Four themes, each its own tempo/feel — built on demand and disposed on switch
// (cleaner than one shared transport for differing BPMs). Master gain dips during
// a switch for a quick crossfade.
//
//   menu    — "Signal Home": hummable bell hook over a warm pad bed + soft breath
//   hangar  — cozy lo-fi groove: soft swung beat, warm sine bass, mellow keys
//   combat  — driving darksynth, VERTICAL-LAYERED by intensity (live enemy count):
//             base (bass+kick) always · mid (hats+snare) · high (lead arp)
//   arena   — "Test Chamber": sparse bitcrushed lab tone — the DEV ARENA · TEST sandbox
//
// All A minor (Am–F–C–G). Fails silently. window.__music for debug.
// Parked candidates / palette audition pages live in audio-gen/*-audition.html
// (e.g. menu "Long Road" + the old menu theme, dev-arena alternates, synthwave theme C).

import * as Tone from 'tone';

const LOFI_CH = [['A3','C4','E4','G4'], ['F3','A3','C4','E4'], ['C4','E4','G4','B4'], ['G3','B3','D4','E4']];
const ROOTS   = ['A1','F1','C1','G1'];
// Menu "Signal Home" hook: a hummable bell motif over the Am–F–C–G cycle (8n grid,
// 2 bars, with rests so it breathes). The tune that sets the title-screen tone.
const MENU_MEL = [
  'A4','C5','E5',null, 'E5','D5',null,null, 'F4','A4','C5',null, 'C5','B4',null,null,
  'C5','E5','G5',null, 'G5','E5',null,null, 'G4','B4','D5',null, 'E5',null,null,null,
];
const CBASS = [];
ROOTS.forEach(r => { for (let i = 0; i < 8; i++) CBASS.push(r); });
const CLEAD = [];
[['A5','C6'], ['F5','A5'], ['E5','G5'], ['D5','G5']].forEach(([a, b]) => CLEAD.push(a, null, b, null, a, b, null, null));

const CFG = {
  menu:   { bpm: 84,  swing: 0 },
  hangar: { bpm: 78,  swing: 0.35 },
  combat: { bpm: 112, swing: 0 },
  arena:  { bpm: 88,  swing: 0 },   // dev test arena — "Test Chamber"
};

// Dev-arena "Test Chamber" melody: sparse, uneasy chromatic/tritone steps with
// lots of rests — clinical lab-console feel. (8n grid, 2 bars.)
const ARENA_MEL = [
  'A4', null, null, 'D#5', null, null, 'C5', null,   null, 'B4', null, null,  'F4', null, null, null,
  'A4', null, 'E5', null,   null, null, 'D#5', null,  'G4', null, null, 'C5',  null, null, null, null,
];

class MusicManager {
  constructor() {
    this.master = null;
    this._started = false;
    this._mode = null;      // current theme id
    this._pending = null;
    this._theme = null;     // { nodes:[], layerMid?, layerHigh? }
    this._intensity = 0;
    this._swT = null;
    this._muted = false;
    this._baseVol = 0.55;
    this._lastTheme = null; // remembers the last theme so restart() works after a stop()
  }

  // ---- public ----
  playMenu()   { this._setMode('menu'); }
  playHangar() { this._setMode('hangar'); }
  playCombat() { this._setMode('combat'); }
  playArena()  { this._setMode('arena'); }   // dev test arena soundtrack

  // Replay the current theme from bar 0 — used by the in-run RESTART so the
  // music restarts with the run. Falls back to the last theme if the theme was
  // already stopped (e.g. death stops it before RESTART is pressed). Also lifts
  // a paused transport, so restarting from the pause menu resumes playback.
  restart() {
    const id = this._mode || this._lastTheme;
    if (!id || !this._started) return;
    this._mode = null;          // bypass the same-mode early-return in _switch
    this._switch(id, true);     // rebuild immediately from position 0
  }

  // Freeze / un-freeze the transport with the game (PAUSE). The music holds its
  // place and resumes where it left off. Stingers ride their own clock (_fxOut),
  // so the needle-lift and other one-shots still sound while paused.
  pause()  { if (this._started) { const T = Tone.getTransport(); if (T.state === 'started') T.pause(); } }
  resume() { if (this._started) { const T = Tone.getTransport(); if (T.state === 'paused')  T.start(); } }

  // Fade-then-freeze for the game PAUSE: ramp the music down, then halt the
  // transport once it's silent (so it still resumes from the same bar). Paired
  // with fadeResume(). Replaces the abrupt needle-lift as the pause transition.
  fadePause(ms = 400) {
    if (!this._started) return;
    const T = Tone.getTransport();
    if (this.master) this.master.gain.rampTo(0, ms / 1000);
    // Tempo winds DOWN with the SFX tape-stop (synth music can't pitch-bend, but
    // the rhythm grinding to a halt sells the same "everything stopping" feel).
    if (this._bpmSaved == null) this._bpmSaved = T.bpm.value;
    try { T.bpm.rampTo(this._bpmSaved * 0.3, ms / 1000); } catch (_) {}
    clearTimeout(this._pauseT);
    this._pauseT = setTimeout(() => { if (T.state === 'started') T.pause(); }, ms + 20);
  }
  fadeResume(ms = 400) {
    if (!this._started) return;
    clearTimeout(this._pauseT);             // cancel a still-pending freeze if we resume fast
    const T = Tone.getTransport();
    if (this._bpmSaved != null) { try { T.bpm.value = this._bpmSaved; } catch (_) {} this._bpmSaved = null; } // restore tempo before unpausing
    if (T.state === 'paused') T.start();
    if (this.master) this.master.gain.rampTo(this._activeVol(), ms / 1000);
  }

  // ---- one-shot stingers + transition SFX (fire-and-forget, survive theme stop) ----
  // These are game FEEDBACK, not music: they ride their own output (_fxOut) so a
  // theme crossfade/stop can't cut them off, and they ignore the music mute.
  //   extract  — Duckov-style reward jingle (extract summary)
  //   defeat   — short descending downer (death screen)
  //   shutter  — soft aperture whoosh for the IRIS wipe (game start / enter hangar)
  //   retro    — 8-bit blip cascade for the CHECKER wipe (designer enter/exit)
  //   crtOff   — descending whine + thunk for the CRT power-off (return to menu)
  playExtract() { this._fire(this._sting_extract); }
  playDefeat()  { this._fire(this._sting_defeat); }
  playShutter() { this._fire(this._fx_shutter); }
  playRetro()     { this._fire(this._fx_retro); }
  playRetroDown() { this._fire(this._fx_retroDown); }
  playCrtOff()  { this._fire(this._fx_crtOff); }
  playHitmark() { this._fire(this._fx_hitmark); }  // shell connects with an enemy
  playHitCrit() { this._fire(this._fx_hitcrit); }  // dead-center critical hit
  playPickup()  { this._fire(this._fx_pickup); }   // salvage grabbed — coin ding
  playNeedleLift() { this._fire(this._fx_needleLift); } // pause — record needle lifts off the groove

  setIntensity(x) { this._intensity = Math.max(0, Math.min(1, x)); this._applyIntensity(); }
  setMasterVolume(v) { this._baseVol = v; if (this.master && !this._muted) this.master.gain.rampTo(v, 0.2); }

  get muted() { return this._muted; }
  setMuted(b) { this._muted = !!b; if (this.master) this.master.gain.rampTo(this._muted ? 0 : this._baseVol, 0.3); }
  toggleMuted() { this.setMuted(!this._muted); return this._muted; }

  _activeVol() { return this._muted ? 0 : this._baseVol; }

  stop(fade = 0.6) {
    this._pending = null;
    clearTimeout(this._swT);
    if (this.master) this.master.gain.rampTo(0, fade);
    this._swT = setTimeout(() => this._disposeTheme(), fade * 1000 + 50);
    this._mode = null;
  }

  // ---- internal ----
  _setMode(id) {
    this._pending = id;
    if (!this._started) this.start();
    else this._switch(id);
  }

  // First call must be inside a user gesture (scene-entry click/key) for autoplay.
  async start() {
    if (this._started) return;
    this._started = true;
    try {
      await Tone.start();
      this.master = new Tone.Gain(0).toDestination();
      this._switch(this._pending || 'menu', true);
    } catch (e) { this._started = false; console.warn('[music] start failed:', e); }
  }

  _switch(id, immediate = false) {
    if (id === this._mode && this._theme) return;
    const build = () => {
      clearTimeout(this._swT); // cancel a pending stop()-dispose so it can't kill this fresh theme
      this._disposeTheme();
      const T = Tone.getTransport();
      T.stop();
      T.bpm.value = CFG[id].bpm;
      this._bpmSaved = null;   // fresh theme = known tempo; don't let a stale pause-save restore the wrong bpm
      T.swing = CFG[id].swing; T.swingSubdivision = '8n';
      T.position = 0;
      this._theme = this[`_build_${id}`]();
      this._mode = id;
      this._lastTheme = id;
      T.start();
      if (id === 'combat') this._applyIntensity();
      this.master.gain.rampTo(this._activeVol(), 0.5); // respects mute across switches
    };
    if (immediate || !this._mode) build();
    else { this.master.gain.rampTo(0, 0.4); clearTimeout(this._swT); this._swT = setTimeout(build, 430); }
  }

  _disposeTheme() {
    if (!this._theme) return;
    for (const n of this._theme.nodes) { try { n.stop && n.stop(); } catch (_) {} try { n.dispose && n.dispose(); } catch (_) {} }
    this._theme = null;
  }

  _applyIntensity() {
    if (this._mode !== 'combat' || !this._theme) return;
    const x = this._intensity;
    this._theme.layerMid?.gain.rampTo(Math.min(1, x * 1.6), 1.2);
    this._theme.layerHigh?.gain.rampTo(Math.max(0, (x - 0.45) / 0.55), 1.2);
  }

  // ---- theme builders (return { nodes, layerMid?, layerHigh? }) ----
  _build_menu() { // "Signal Home" — hummable, hopeful, sets the title-screen tone
    const m = this.master, nodes = [];
    // Warm pad bed + sine bass + a soft pink-noise "breath" each bar, with the
    // bell hook (MENU_MEL) entering after the first bar so the theme blooms in
    // rather than starting all at once. The transport resets to 0 on each menu
    // entry, so the bloom replays every time you return to the title screen.
    const verb = new Tone.Freeverb(0.7, 3500).connect(m); nodes.push(verb);
    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 0.5, sustain: 0.6, release: 1.5 }, volume: -23 }).connect(verb); nodes.push(pad);
    const bass = new Tone.MonoSynth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.4 }, volume: -13 }).connect(m); nodes.push(bass);
    const swell = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.2, decay: 0.3, sustain: 0 }, volume: -30 }).connect(verb); nodes.push(swell);
    const dly = new Tone.PingPongDelay('8n.', 0.28); dly.wet.value = 0.32; dly.connect(verb); nodes.push(dly);
    const bell = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.6 }, volume: -14 }).connect(dly); nodes.push(bell);
    nodes.push(new Tone.Sequence((t, c) => pad.triggerAttackRelease(c, '1m', t), LOFI_CH, '1m').start(0));
    nodes.push(new Tone.Sequence((t, r) => bass.triggerAttackRelease(r, '2n', t), ROOTS, '1m').start(0));
    nodes.push(new Tone.Loop(t => swell.triggerAttackRelease('2n', t), '1m').start(0)); // soft breath each bar
    nodes.push(new Tone.Sequence((t, n) => { if (n) bell.triggerAttackRelease(n, '8n', t); }, MENU_MEL, '8n').start('1m'));
    return { nodes };
  }

  _build_hangar() { // cozy lo-fi
    const m = this.master, nodes = [];
    const keys = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.5, sustain: 0.4, release: 1.2 }, volume: -15 }).connect(m); nodes.push(keys);
    const bass = new Tone.MonoSynth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.3 }, volume: -10 }).connect(m); nodes.push(bass);
    const kick = new Tone.MembraneSynth({ volume: -8 }).connect(m); nodes.push(kick);
    const snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -20 }).connect(m); nodes.push(snare);
    const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.02, sustain: 0 }, volume: -30 }).connect(m); nodes.push(hat);
    nodes.push(new Tone.Sequence((t, c) => keys.triggerAttackRelease(c, '2n.', t), LOFI_CH, '1m').start(0));
    nodes.push(new Tone.Sequence((t, r) => bass.triggerAttackRelease(r, '4n.', t), ROOTS, '1m').start(0));
    nodes.push(new Tone.Loop(t => kick.triggerAttackRelease('C1', '8n', t), '2n').start(0));
    nodes.push(new Tone.Loop(t => snare.triggerAttackRelease('8n', t), '2n').start('4n'));
    nodes.push(new Tone.Loop(t => hat.triggerAttackRelease('16n', t), '8n').start('8n'));
    return { nodes };
  }

  _build_combat() {
    const m = this.master, nodes = [];
    const layerBase = new Tone.Gain(1).connect(m); nodes.push(layerBase);
    const layerMid  = new Tone.Gain(0).connect(m); nodes.push(layerMid);
    const layerHigh = new Tone.Gain(0).connect(m); nodes.push(layerHigh);
    const bass = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1 }, filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.3, baseFrequency: 120, octaves: 2.6 }, volume: -14 }).connect(layerBase); nodes.push(bass);
    const kick = new Tone.MembraneSynth({ volume: -6 }).connect(layerBase); nodes.push(kick);
    const hat  = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -22 }).connect(layerMid); nodes.push(hat);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -16 }).connect(layerMid); nodes.push(snare);
    const dly = new Tone.FeedbackDelay('8n', 0.3); dly.wet.value = 0.35; dly.connect(layerHigh); nodes.push(dly);
    const lead = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 }, volume: -20 }).connect(dly); nodes.push(lead);
    nodes.push(new Tone.Sequence((t, n) => bass.triggerAttackRelease(n, '8n', t), CBASS, '8n').start(0));
    nodes.push(new Tone.Sequence((t, n) => { if (n) lead.triggerAttackRelease(n, '8n', t); }, CLEAD, '8n').start(0));
    nodes.push(new Tone.Loop(t => kick.triggerAttackRelease('C1', '8n', t), '4n').start(0));
    nodes.push(new Tone.Loop(t => hat.triggerAttackRelease('16n', t), '8n').start('8n'));
    nodes.push(new Tone.Loop(t => snare.triggerAttackRelease('16n', t), '2n').start('4n'));
    return { nodes, layerMid, layerHigh };
  }

  _build_arena() { // dev test arena — "Test Chamber": sparse, eerie, bitcrushed lab
    const m = this.master, nodes = [];
    // group gains preserve the audition mix balance (master is the bus here)
    const gFilt  = new Tone.Gain(0.70).connect(m); nodes.push(gFilt);
    const gCrush = new Tone.Gain(0.85).connect(m); nodes.push(gCrush);
    const gTick  = new Tone.Gain(0.60).connect(m); nodes.push(gTick);
    const gSub   = new Tone.Gain(0.80).connect(m); nodes.push(gSub);
    const filt  = new Tone.Filter({ type: 'lowpass', frequency: 600, Q: 1 }).connect(gFilt); nodes.push(filt);
    const drone = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2 }, detune: 8, volume: -30 }).connect(filt); nodes.push(drone);
    const crush = new Tone.BitCrusher({ bits: 5 }); crush.wet.value = 0.7; crush.connect(gCrush); nodes.push(crush);
    const dly   = new Tone.FeedbackDelay('4n', 0.35); dly.wet.value = 0.4; dly.connect(crush); nodes.push(dly);
    const bleep = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 }, volume: -16 }).connect(dly); nodes.push(bleep);
    const tick  = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 8, resonance: 2000, volume: -34 }).connect(gTick); nodes.push(tick);
    const sub   = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, volume: -12 }).connect(gSub); nodes.push(sub);
    nodes.push(new Tone.Sequence((t, c) => drone.triggerAttackRelease(c, '1m', t), [['A2', 'E3'], ['C3', 'G3']], '1m').start(0));
    nodes.push(new Tone.Sequence((t, n) => { if (n) bleep.triggerAttackRelease(n, '16n', t); }, ARENA_MEL, '8n').start(0));
    nodes.push(new Tone.Loop(t => tick.triggerAttackRelease('16n', t), '4n').start('8n')); // dry data-tick metronome
    nodes.push(new Tone.Loop(t => sub.triggerAttackRelease('A1', '8n', t), '1m').start(0)); // distant heartbeat thud
    return { nodes };
  }

  // ---- one-shot infra ----
  // Dedicated output for stingers/transition SFX — separate from the theme master
  // so a crossfade/stop never cuts them off. Not muted by the music toggle (these
  // are feedback). Created lazily; nodes self-dispose via _disposeLater.
  _fxDest() {
    if (!this._fxOut) this._fxOut = new Tone.Gain(0.9).toDestination();
    return this._fxOut;
  }
  // Run a builder once the audio context is live (first call may be the game-start
  // gesture, before any theme has started Tone).
  _fire(fn) {
    const go = () => { try { fn.call(this); } catch (e) { console.warn('[music] fx failed:', e); } };
    try {
      if (Tone.getContext().state === 'running') go();
      else Tone.start().then(go).catch(e => console.warn('[music] fx ctx failed:', e));
    } catch (e) { console.warn('[music] fx failed:', e); }
  }
  _disposeLater(nodes, ms) {
    setTimeout(() => { for (const n of nodes) { try { n.dispose && n.dispose(); } catch (_) {} } }, ms);
  }

  // ---- stinger / transition builders ----
  _sting_extract() { // bright Duckov-style reward — ascending pluck resolving to a C-major shimmer
    const out = this._fxDest();
    const verb = new Tone.Freeverb(0.6, 3000).connect(out);
    const bell = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.6 }, volume: -8 }).connect(verb);
    const chord = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 1.2 }, volume: -14 }).connect(verb);
    const t = Tone.now() + 0.02;
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => bell.triggerAttackRelease(n, '16n', t + i * 0.11));
    chord.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n', t + 0.44);
    this._disposeLater([bell, chord, verb], 2200);
  }

  _sting_defeat() { // short descending downer — minor fall + a dying sub-bass sag
    const out = this._fxDest();
    const verb = new Tone.Freeverb(0.7, 1600).connect(out);
    const lead = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.7 }, volume: -10 }).connect(verb);
    const sub = new Tone.MonoSynth({ oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 1.0 }, filterEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.2, baseFrequency: 80, octaves: 1.8 }, volume: -12 }).connect(verb);
    const t = Tone.now() + 0.02;
    lead.triggerAttackRelease('E4', '8n', t);
    lead.triggerAttackRelease('C4', '8n', t + 0.22);
    lead.triggerAttackRelease('A3', '4n', t + 0.46);
    sub.triggerAttackRelease('A1', '2n', t + 0.46);
    sub.frequency.setValueAtTime(Tone.Frequency('A1').toFrequency(), t + 0.46);
    sub.frequency.exponentialRampToValueAtTime(Tone.Frequency('E1').toFrequency(), t + 1.3);
    this._disposeLater([lead, sub, verb], 1800);
  }

  _fx_shutter() { // iris wipe — pink-noise band sweeps up (close) then down (open) + a soft thunk
    const out = this._fxDest();
    const filt = new Tone.Filter({ type: 'bandpass', frequency: 400, Q: 1.2 }).connect(out);
    const noise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.18, decay: 0, sustain: 1, release: 0.22 }, volume: -16 }).connect(filt);
    const sub = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 3, volume: -10 }).connect(out);
    const t = Tone.now() + 0.01;
    noise.triggerAttackRelease(0.34, t);
    filt.frequency.setValueAtTime(300, t);
    filt.frequency.exponentialRampToValueAtTime(1800, t + 0.2);  // aperture closes
    filt.frequency.exponentialRampToValueAtTime(500, t + 0.42);  // aperture opens
    sub.triggerAttackRelease('C2', '8n', t + 0.18);              // thunk at full cover
    this._disposeLater([noise, filt, sub], 900);
  }

  _fx_retro() { // checker/pixelated wipe — rapid 8-bit square-wave blip cascade
    const out = this._fxDest();
    const blip = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, volume: -16 }).connect(out);
    const t = Tone.now() + 0.01;
    ['A4', 'C5', 'E5', 'A5', 'C6', 'E6'].forEach((n, i) => blip.triggerAttackRelease(n, '32n', t + i * 0.05));
    this._disposeLater([blip], 700);
  }

  _fx_retroDown() { // back to menu — the retro cascade reversed (descending)
    const out = this._fxDest();
    const blip = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, volume: -16 }).connect(out);
    const t = Tone.now() + 0.01;
    ['E6', 'C6', 'A5', 'E5', 'C5', 'A4'].forEach((n, i) => blip.triggerAttackRelease(n, '32n', t + i * 0.05));
    this._disposeLater([blip], 700);
  }

  _fx_crtOff() { // return to menu — CRT flyback whine collapses down to a thunk
    const out = this._fxDest();
    const whine = new Tone.Oscillator({ type: 'sine', frequency: 1200, volume: -18 }).connect(out);
    const thunk = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, volume: -8 }).connect(out);
    const t = Tone.now() + 0.01;
    whine.start(t).stop(t + 0.34);
    whine.frequency.setValueAtTime(1200, t);
    whine.frequency.exponentialRampToValueAtTime(60, t + 0.3);   // whine dies
    thunk.triggerAttackRelease('C1', '8n', t + 0.3);
    this._disposeLater([whine, thunk], 800);
  }

  _fx_hitmark() { // crisp short tick — your shell connected
    const out = this._fxDest();
    const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, volume: -13 }).connect(out);
    s.triggerAttackRelease('C6', '64n', Tone.now() + 0.001);
    this._disposeLater([s], 250);
  }

  _fx_hitcrit() { // brighter ascending 2-note ding + sparkle — dead-center crit
    const out = this._fxDest();
    const verb = new Tone.Freeverb(0.4, 4500).connect(out);
    const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 }, volume: -10 }).connect(verb);
    const t = Tone.now() + 0.001;
    s.triggerAttackRelease('E6', '64n', t);
    s.triggerAttackRelease('B6', '32n', t + 0.045);
    this._disposeLater([s, verb], 500);
  }

  _fx_pickup() { // salvage grabbed — classic two-note coin "ding" (low blip up a 5th)
    const out = this._fxDest();
    const verb = new Tone.Freeverb(0.3, 5000).connect(out);
    const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.12 }, volume: -9 }).connect(verb);
    const t = Tone.now() + 0.001;
    const wob = (Math.random() * 2 - 1) * 1.5; // ±1.5 semitone so a salvage run doesn't sound machine-gunned
    s.triggerAttackRelease(Tone.Frequency('B5').transpose(wob), '32n', t);
    s.triggerAttackRelease(Tone.Frequency('E6').transpose(wob), '16n', t + 0.075);
    this._disposeLater([s, verb], 500);
  }

  _fx_needleLift() { // PAUSE — turntable needle lifts: platter spins down + a stylus scrape
    const out = this._fxDest();
    const osc = new Tone.Oscillator({ type: 'sawtooth', frequency: 320, volume: -16 }).connect(out);
    const bp  = new Tone.Filter({ type: 'bandpass', frequency: 2600, Q: 2 }).connect(out);
    const scr = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.18, sustain: 0 }, volume: -22 }).connect(bp);
    const t = Tone.now() + 0.01;
    osc.start(t).stop(t + 0.4);
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.36);   // platter winds down to a halt
    scr.triggerAttackRelease(0.12, t);                          // stylus scrape as it lifts
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    this._disposeLater([osc, scr, bp], 900);
  }
}

export const music = new MusicManager();
if (typeof window !== 'undefined') window.__music = music;
