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
  }

  // ---- public ----
  playMenu()   { this._setMode('menu'); }
  playHangar() { this._setMode('hangar'); }
  playCombat() { this._setMode('combat'); }

  setIntensity(x) { this._intensity = Math.max(0, Math.min(1, x)); this._applyIntensity(); }
  setMasterVolume(v) { if (this.master) this.master.gain.rampTo(v, 0.2); }

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
      this.master.gain.rampTo(0.55, 0.5);
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
    const verb = new Tone.Freeverb(0.7, 2200).connect(m); nodes.push(verb);
    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 }, volume: -16 }).connect(verb); nodes.push(pad);
    const dly = new Tone.FeedbackDelay('4n', 0.25); dly.wet.value = 0.3; dly.connect(verb); nodes.push(dly);
    const arp = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0, release: 0.3 }, volume: -20 }).connect(dly); nodes.push(arp);
    nodes.push(new Tone.Sequence((t, c) => pad.triggerAttackRelease(c, '1m', t), CHORDS, '1m').start(0));
    nodes.push(new Tone.Sequence((t, n) => arp.triggerAttackRelease(n, '8n', t), MENU_ARP, '4n').start(0));
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
}

export const music = new MusicManager();
if (typeof window !== 'undefined') window.__music = music;
