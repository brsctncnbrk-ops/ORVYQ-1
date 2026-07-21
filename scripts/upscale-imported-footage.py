#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

project = Path("projects/001-ai-race")
registry_file = project / "assets/asset_registry.json"
registry = json.loads(registry_file.read_text(encoding="utf-8"))

for asset in registry["assets"]:
    if asset.get("media_type") != "video":
        continue
    path = project / asset["relative_path"]
    info = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(path)
    ], text=True))
    stream = info["streams"][0]
    width, height = int(stream["width"]), int(stream["height"])
    if width >= 1920 and height >= 1080:
        continue
    temporary = path.with_suffix(".1080p.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-i", str(path),
        "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temporary)
    ], check=True)
    temporary.replace(path)

# The main builder recomputes metadata before this repair. Recompute every changed
# video registry field after the self-contained derivative is created.
import hashlib

def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()

for asset in registry["assets"]:
    if asset.get("media_type") != "video":
        continue
    path = project / asset["relative_path"]
    info = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], text=True))
    video = next(stream for stream in info["streams"] if stream.get("codec_type") == "video")
    asset["sha256"] = digest(path)
    asset["byte_size"] = path.stat().st_size
    asset["duration_seconds"] = round(float(info["format"]["duration"]), 6)
    asset["resolution"] = f"{video['width']}x{video['height']}"
    asset["codec"] = video.get("codec_name") or "unknown"
    if int(video["width"]) == 1920 and int(video["height"]) == 1080:
        asset["editorial_purpose"] += "; self-contained 1080p derivative created during one-time migration"

registry_file.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
