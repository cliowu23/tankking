// src/core/audio/MusicManager.js
// Claude-composed music via Tone.js (separate from the SFX AudioManager).
// Three themes, each its own tempo/feel — built on demand and disposed on switch
// (cleaner than one shared transport for differing BPMs). Master gain dips during
// a switch for a quick crossfade.
//
//   menu    — calm pad + plucked arp (the old hangar theme; title-screen vibe)
//   hangar  — cozy lo-fi groove: soft swung beat, warm sine bass, mellow keys
//   combat  — driving darksynth, VERTICAL-LAYERED by intensity (live enemy count):
//             base (bass+kick) always · mid (hats+snare) · high (lead arp)
//
// All A minor (Am–F–C–G). Fails silently. window.__music for debug.
// (Synthwave "theme C" lives in audio-gen/hangar-theme-preview.html — reserved
//  for a future level / minigame.)

import * as Tone from 'tone';

const CHORDS  = [['A3','C4','E4'], ['F3','A3','C4'], ['C4','E4','G4'], ['G3','B3','D4']];
const LOFI_CH = [['A3','C4','E4','G4'], ['F3','A3','C4','E4'], ['C4','E4','G4','B4'], ['G3','B3','D4','E4']];
const ROOTS   = ['A1','F1','C1','G1'];
// Menu arp: 4 notes per chord (triad tones + a return step, e.g. A–C–E–C) that
// carry the melody an octave above the pad. Each group aligns to its chord in the
// Am–F–C–G cycle (one chord per measure), played at '4n'.
const MENU_ARP = [];
[['A4','C5','E5','C5'], ['F4','A4','C5','A4'], ['C5','E5','G5','E5'], ['G4','B4','D5','B4']].forEach(a => MENU_ARP.push(...a));
const CBASS = [];
ROOTS.forEach(r => { for (let i = 0; i < 8; i++) CBASS.push(r); });
const CLEAD = [];
[['A5','C6'], ['F5','A5'], ['E5','G5'], ['D5','G5']].forEach(([a, b]) => CLEAD.push(a, null, b, null, a, b, null, null));

const CFG = {
  menu:   { bpm: 100, swing: 0 },
  hangar: { bpm: 78,  swing: 0.35 },
  combat: { bpm: 112, swing: 0 },
};

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
  }

  // ---- public ----
  playMenu()   { this._setMode('menu'); }
  playHangar() { this._setMode('hangar'); }
  playCombat() { this._setMode('combat'); }

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
  playRetro()   { this._fire(this._fx_retro); }
  playCrtOff()  { this._fire(this._fx_crtOff); }
  playHitmark() { this._fire(this._fx_hitmark); }  // shell connects with an enemy
  playHitCrit() { this._fire(this._fx_hitcrit); }  // dead-center critical hit

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
      T.swing = CFG[id].swing; T.swingSubdivision = '8n';
      T.position = 0;
      this._theme = this[`_build_${id}`]();
      this._mode = id;
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
  _build_menu() {
    const m = this.master, nodes = [];
    // Structured intro: warm held chords play ALONE first, then the SINE arp (an
    // octave above the pad) DROPS IN — a little melodic "beat drop" so the title
    // theme has an arc instead of both parts competing from bar one (user: the
    // simultaneous start sounded messy — 2026-06-17). Drop lands when the 4-bar
    // Am–F–C–G progression loops back. ARP_DROP is the one knob: '2m' = snappier,
    // '4m' = full-cycle build. The transport resets to 0 on each menu entry, so
    // the intro + drop replays every time you return to the menu.
    const ARP_DROP = '4m';
    const verb = new Tone.Freeverb(0.7, 2200).connect(m); nodes.push(verb);
    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 }, volume: -15 }).connect(verb); nodes.push(pad);
    const arp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 }, volume: -19 }).connect(verb); nodes.push(arp);
    nodes.push(new Tone.Sequence((t, c) => pad.triggerAttackRelease(c, '1m', t), CHORDS, '1m').start(0));
    nodes.push(new Tone.Sequence((t, n) => arp.triggerAttackRelease(Tone.Frequency(n).transpose(12), '8n', t), MENU_ARP, '4n').start(ARP_DROP));
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
}

export const music = new MusicManager();
if (typeof window !== 'undefined') window.__music = music;
