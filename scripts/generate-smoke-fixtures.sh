#!/usr/bin/env bash
set -euo pipefail
OUT="fixtures/smoke/generated"
mkdir -p "$OUT"
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v espeak >/dev/null
if [ ! -s "$OUT/footage.webm" ]; then
  ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=1280x720:rate=30" -t 12 -c:v libvpx-vp9 -b:v 650k -an "$OUT/footage.webm"
fi
if [ ! -s "$OUT/narration.ogg" ]; then
  TMP="$(mktemp --suffix=.wav)"
  trap 'rm -f "$TMP"' EXIT
  espeak -s 145 -w "$TMP" "Every system needs a trustworthy beginning. This smoke render verifies footage, evidence, captions, narration, music, and the final ORVYQ end card."
  ffmpeg -y -loglevel error -i "$TMP" -af "apad=pad_dur=12,volume=1.8" -t 12 -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$OUT/narration.ogg"
fi
if [ ! -s "$OUT/music.ogg" ]; then
  ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=110:sample_rate=48000:duration=12" -af "volume=0.04,afade=t=in:st=0:d=1,afade=t=out:st=10:d=2" -ac 2 -c:a libvorbis -q:a 4 "$OUT/music.ogg"
fi
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$OUT/footage.webm" >/dev/null
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$OUT/narration.ogg" >/dev/null
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$OUT/music.ogg" >/dev/null
