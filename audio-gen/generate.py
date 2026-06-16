#!/usr/bin/env python3
"""
Local SFX generation for the TanKING audio vertical slice, using AudioLDM2
(text-to-audio, open weights). Fully local / private — nothing leaves the
machine. Outputs N candidate .wav per slice sound to candidates/raw/;
postprocess.sh then trims + converts to .ogg for the preview page.

Run inside the conda env (env vars guard MPS fallback + OpenMP double-load):
  KMP_DUPLICATE_LIB_OK=TRUE PYTORCH_ENABLE_MPS_FALLBACK=1 \
    conda run -n audiocraft python audio-gen/generate.py
"""
import os, torch, soundfile as sf
from diffusers import AudioLDM2Pipeline

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "candidates", "raw")
os.makedirs(OUT, exist_ok=True)
SR = 16000
STEPS = 120
NEG = "low quality, muffled, noise, distortion"

# (id, prompt, clip seconds, # candidates)
JOBS = [
    ("tank.cannon_fire",            "a single heavy tank cannon firing, deep powerful explosive boom with a sharp crack", 2.0, 3),
    ("tank.hit_heavy",              "a heavy metallic impact, a shell slamming into thick steel armor plating",          2.0, 3),
    ("tank.shield_activate",        "a sci-fi energy force field switching on, quick rising electrical power-up hum",      2.0, 3),
    ("tank.shield_loop",            "a continuous sci-fi energy shield humming, steady electrical force-field drone",      4.0, 2),
    ("tank.shield_break",           "a sci-fi energy shield collapsing and powering down, descending electrical whine",    2.0, 3),
    ("enemy.sentinel_beam_charge",  "a sci-fi laser cannon charging up, rising high pitched electronic whine",             2.0, 3),
    ("enemy.sentinel_beam_fire",    "a sci-fi laser beam blast firing, sharp electric energy discharge zap",               2.0, 3),
    ("ui.wave_start",               "an industrial warning klaxon alarm blaring, alert siren",                            2.0, 3),
]

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"[gen] device={device}  steps={STEPS}", flush=True)
print("[gen] loading cvssp/audioldm2 (downloads a few GB on first run)...", flush=True)
pipe = AudioLDM2Pipeline.from_pretrained("cvssp/audioldm2", torch_dtype=torch.float32)
pipe = pipe.to(device)
pipe.set_progress_bar_config(disable=True)

# IMPORTANT: generate ONE waveform per call. Batching (num_waveforms_per_prompt>1)
# segfaults AudioLDM2's language-model step on MPS. Looping single calls is stable.
total = 0
for sid, prompt, dur, n in JOBS:
    print(f"[gen] {sid}  x{n}  ({dur}s)  :: {prompt}", flush=True)
    for k in range(1, n + 1):
        try:
            a = pipe(
                prompt, negative_prompt=NEG,
                num_inference_steps=STEPS, audio_length_in_s=dur,
                num_waveforms_per_prompt=1,
            ).audios[0]
            path = os.path.join(OUT, f"{sid}__v{k}.wav")
            sf.write(path, a, SR)
            total += 1
            print(f"   wrote {path}", flush=True)
        except Exception as e:
            print(f"   !! {sid} v{k} failed: {e}", flush=True)

print(f"[gen] DONE — {total} candidate clips in {OUT}", flush=True)
