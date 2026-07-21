#!/usr/bin/env python3
import json
import shutil
from pathlib import Path

project = Path("projects/001-ai-race")
plan_file = project / "direction/production_plan.json"
registry_file = project / "assets/asset_registry.json"
plan = json.loads(plan_file.read_text(encoding="utf-8"))
registry = json.loads(registry_file.read_text(encoding="utf-8"))
video_assets = [asset for asset in registry["assets"] if asset.get("media_type") == "video"]
if not video_assets:
    raise SystemExit("No contextual footage assets are available")

relief_index = 0
for shot in plan["shots"]:
    if shot.get("visual_class") != "emphasis_beat":
        continue
    source = video_assets[relief_index % len(video_assets)]
    relief_index += 1
    source_path = project / source["relative_path"]
    relative_path = f"assets/footage/contextual-relief-{relief_index:03d}.mp4"
    target_path = project / relative_path
    shutil.copy2(source_path, target_path)
    asset_id = f"contextual-relief-{relief_index:03d}"
    duration = (shot["end_frame"] - shot["start_frame"]) / plan["fps"]
    registry["assets"].append({
        **source,
        "id": asset_id,
        "relative_path": relative_path,
        "editorial_purpose": "Brief contextual relief between source-backed evidence treatments; not literal evidence",
        "claim_ids": [],
        "role": "contextual_relief",
    })
    shot.update({
        "visual_class": "cinematic_footage",
        "physical_asset": relative_path,
        "asset_ids": [asset_id],
        "footage_trim": {"start_seconds": 0, "end_seconds": min(duration, float(source["duration_seconds"]))},
        "asset_class": "licensed_contextual",
        "evidence_claim": False,
        "source_ids": [],
        "claim_ids": [],
        "source_label": "ORVYQ · CONTEXTUAL RELIEF",
        "semantic_purpose": "Contextual visual relief between evidence beats",
        "title": None,
        "body": None,
        "emphasis_beat": False,
    })

plan_file.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
registry_file.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
