// src/core/audio/MusicManager.js
// Claude-composed music via Tone.js — separate from the SFX AudioManager (Tone
// runs its own transport/scheduler). Two themes share one transport and all
// sequences run continuously in sync; what you HEAR is controlled by bus/layer
// gains (vertical layering):
//
//   master ─┬─ hangarBus (pad + arp)
//           └─ combatBus ─┬─ layerBase (bass + kick)      always on in combat
//                         ├─ layerMid  (hats + snare)     fades in w/ intensity
//                         └─ layerHigh (lead arp)         fades in w/ intensity
//
// Crossfade hangar<->combat by ramping the two bus gains. setIntensity(0..1)
// (driven by live enemy count) fades the mid/high combat layers.
//
// Fails silently if Tone can't start. Key: A minor, Am–F–C–G.

import * as Tone from 'tone';

const CHORDS = [['A3','C4','E4'], ['F3','A3','C4'], ['C4','E4','G4'], ['G3','B3','D4']];
const ROOTS  = ['A1','F1','C1','G1'];
// hangar arp (gentle, '4n', 16 steps) + combat lead ('8n', 32 steps w/ rests)
const ARP = [];
[['A4','C5','E5','C5'], ['F4','A4','C5','A4'], ['C5','E5','G5','E5'], ['G4','B4','D5','B4']].forEach(a => ARP.push(...a));
const BASS = [];
ROOTS.forEach(r => { for (let i = 0; i < 8; i++) BASS.push(r); });
const LEAD = [];
[['A5','C6'], ['F5','A5'], ['E5','G5'], ['D5','G5']].forEach(([a, b]) => LEAD.push(a, null, b, null, a, b, null, null));

const BPM = 112;

class MusicManager {
  constructor() {
    this.ready = false;
    this.started = false;
    this._initStarted = false;
    this._mode = null;       // 'hangar' | 'combat' | null
    this._intensity = 0;
  }

  init() {
    if (this._initStarted) return;
    this._initStarted = true;
    try {
      Tone.getTransport().bpm.value = BPM;

      this.master  = new Tone.Gain(0.55).toDestination();
      this.hangarBus = new Tone.Gain(0).connect(this.master);
      this.combatBus = new Tone.Gain(0).connect(this.master);
      this.layerBase = new Tone.Gain(1).connect(this.combatBus);
      this.layerMid  = new Tone.Gain(0).connect(this.combatBus);
      this.layerHigh = new Tone.Gain(0).connect(this.combatBus);

      // ---- Hangar: warm pad + gentle plucked arp ----
      const verb = new Tone.Freeverb(0.7, 2200).connect(this.hangarBus);
      this.pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 },
        volume: -16,
      }).connect(verb);
      const arpDelay = new Tone.FeedbackDelay('4n', 0.25); arpDelay.wet.value = 0.3; arpDelay.connect(verb);
      this.arp = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.0, release: 0.3 },
        volume: -20,
      }).connect(arpDelay);

      // ---- Combat: bass + drums + lead ----
      this.bass = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1 },
        filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.3, baseFrequency: 120, octaves: 2.6 },
        volume: -14,
      }).connect(this.layerBase);
      this.kick = new Tone.MembraneSynth({ volume: -6 }).connect(this.layerBase);
      this.hat  = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -22 }).connect(this.layerMid);
      this.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -16 }).connect(this.layerMid);
      const leadDelay = new Tone.FeedbackDelay('8n', 0.3); leadDelay.wet.value = 0.35; leadDelay.connect(this.layerHigh);
      this.lead = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 },
        volume: -20,
      }).connect(leadDelay);

      // ---- Sequences (all start at 0; gated by gains) ----
      this.seqPad  = new Tone.Sequence((t, c) => this.pad.triggerAttackRelease(c, '1m', t), CHORDS, '1m').start(0);
      this.seqArp  = new Tone.Sequence((t, n) => this.arp.triggerAttackRelease(n, '8n', t), ARP, '4n').start(0);
      this.seqBass = new Tone.Sequence((t, n) => this.bass.triggerAttackRelease(n, '8n', t), BASS, '8n').start(0);
      this.seqLead = new Tone.Sequence((t, n) => { if (n) this.lead.triggerAttackRelease(n, '8n', t); }, LEAD, '8n').start(0);
      this.loopKick  = new Tone.Loop(t => this.kick.triggerAttackRelease('C1', '8n', t), '4n').start(0);
      this.loopHat   = new Tone.Loop(t => this.hat.triggerAttackRelease('16n', t), '8n').start('8n'); // offbeat hats
      this.loopSnare = new Tone.Loop(t => this.snare.triggerAttackRelease('16n', t), '2n').start('4n'); // backbeat

      this.ready = true;
    } catch (err) {
      console.warn('[music] init failed — continuing without music:', err);
    }
  }

  // Must be called from a user gesture (deploy/enter click). Builds the Tone graph
  // AFTER the context is running, so node creation doesn't spam autoplay warnings.
  async start() {
    if (this.started) return;
    this.started = true; // re-entry guard
    try {
      await Tone.start();
      this.init();               // build graph now (context already running)
      Tone.getTransport().start();
      if (this._mode) this._applyMode(this._mode, 0.3);
    } catch (e) { this.started = false; console.warn('[music] start failed:', e); }
  }

  playHangar() { this._mode = 'hangar'; if (this.started && this.ready) this._applyMode('hangar'); else this.start(); }
  playCombat() { this._mode = 'combat'; if (this.started && this.ready) this._applyMode('combat'); else this.start(); }

  _applyMode(mode, fade = 1.2) {
    if (!this.ready) return;
    this.hangarBus.gain.rampTo(mode === 'hangar' ? 1 : 0, fade);
    this.combatBus.gain.rampTo(mode === 'combat' ? 1 : 0, fade);
  }

  // 0..1 — fades the mid (hats/snare) then high (lead) combat layers.
  setIntensity(x) {
    if (!this.ready) return;
    x = Math.max(0, Math.min(1, x));
    this._intensity = x;
    this.layerMid.gain.rampTo(Math.min(1, x * 1.6), 1.5);          // comes in early
    this.layerHigh.gain.rampTo(Math.max(0, (x - 0.45) / 0.55), 1.5); // comes in late
  }

  stop(fade = 1.0) { this._mode = null; if (this.ready) { this.hangarBus.gain.rampTo(0, fade); this.combatBus.gain.rampTo(0, fade); } }

  setMasterVolume(v) { if (this.ready) this.master.gain.rampTo(v, 0.2); }
}

export const music = new MusicManager();
if (typeof window !== 'undefined') window.__music = music;
