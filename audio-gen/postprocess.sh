#!/bin/bash
# Trim leading silence + loudness-normalize each generated candidate, output mono .ogg.
cd "$(dirname "$0")"
mkdir -p candidates
n=0
for f in candidates/raw/*.wav; do
  [ -e "$f" ] || continue
  base=$(basename "$f" .wav)
  ffmpeg -y -i "$f" -ac 1 \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,loudnorm=I=-16:TP=-1.5:LRA=11" \
    "candidates/$base.ogg" -loglevel error && n=$((n+1))
done
echo "postprocessed $n clips → candidates/*.ogg"
