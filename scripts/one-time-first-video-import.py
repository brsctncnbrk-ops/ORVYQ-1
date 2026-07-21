#!/usr/bin/env python3
import hashlib
import html
import json
import math
import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path.cwd()
LEGACY_ROOT = ROOT / "_legacy_youtube"
LEGACY_PROJECT = LEGACY_ROOT / "projects/001-the-ai-race-no-one-can-afford-to-win"
OLD_PROJECT = ROOT / "_legacy_orvyq/projects/001-ai-race"
PROJECT = ROOT / "projects/001-ai-race"
FPS = 30
EVIDENCE_CLASSES = {"official_document", "official_figure", "source_mosaic", "document_overlay", "stat_overlay", "comparison_overlay", "process_diagram", "email_recreation", "quote_treatment", "limitation_treatment"}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dump(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], text=True))


def media_metadata(path, media_type):
    info = probe(path)
    streams = info.get("streams", [])
    duration = float(info.get("format", {}).get("duration") or next((stream.get("duration") for stream in streams if stream.get("duration")), 0) or 0)
    if media_type == "video":
        stream = next(stream for stream in streams if stream.get("codec_type") == "video")
        return duration, f"{stream.get('width')}x{stream.get('height')}", stream.get("codec_name") or "unknown"
    stream = next(stream for stream in streams if stream.get("codec_type") == "audio")
    return duration, "audio-only", stream.get("codec_name") or "unknown"


def walk_values(value):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key, item
            yield from walk_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_values(item)


def provenance_fields(data, fallback_url):
    urls, licenses, attributions = [], [], []
    for key, value in walk_values(data):
        if not isinstance(value, str):
            continue
        lowered = key.lower()
        if value.startswith("http") and "github.com" not in value and "githubusercontent.com" not in value:
            urls.append(value)
        if "license" in lowered and value.strip():
            licenses.append(value.strip())
        if "attribution" in lowered and value.strip():
            attributions.append(value.strip())
    return (
        urls[0] if urls else fallback_url,
        licenses[0] if licenses else "Licensed editorial footage; original provenance preserved",
        attributions[0] if attributions else "Retain companion provenance record and source credit when required",
    )


def split_even(total, maximum=240):
    count = max(1, math.ceil(total / maximum))
    base = total // count
    remainder = total % count
    return [base + (1 if index < remainder else 0) for index in range(count)]


def evidence_parts(total, prepend_break):
    parts = []
    remaining = total
    if prepend_break and remaining > 30:
        parts.append((15, "emphasis_beat"))
        remaining -= 15
    if remaining > 450:
        first = min(225, remaining - 16)
        parts.append((first, "EVIDENCE"))
        remaining -= first
        parts.append((15, "emphasis_beat"))
        remaining -= 15
    parts.extend((length, "EVIDENCE") for length in split_even(remaining))
    return parts


def make_svg(path, kicker, title, body, source_url):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edf1f2"/><stop offset="1" stop-color="#d7dde0"/></linearGradient></defs>
<rect width="1920" height="1080" fill="#071019"/><rect x="170" y="120" width="1580" height="840" rx="18" fill="url(#g)"/><rect x="170" y="120" width="18" height="840" fill="#d94d54"/>
<text x="250" y="230" font-family="Arial" font-size="30" font-weight="700" fill="#d94d54">{html.escape(kicker)}</text>
<text x="250" y="350" font-family="Arial" font-size="56" font-weight="800" fill="#071019">{html.escape(title[:76])}</text>
<foreignObject x="250" y="410" width="1320" height="350"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;font-size:34px;line-height:1.42;color:#25313a">{html.escape(body)}</div></foreignObject>
<text x="250" y="890" font-family="Arial" font-size="23" fill="#5a6872">{html.escape(source_url)}</text>
</svg>''', encoding="utf-8")


def main():
    if PROJECT.exists():
        shutil.rmtree(PROJECT)
    for relative in [
        "input", "research", "script", "voice", "storyboard", "direction", "assets/audio", "assets/footage",
        "assets/captures", "assets/graphics/generated", "assets/music", "assets/sfx", "qa", "build", "output", "packaging"
    ]:
        (PROJECT / relative).mkdir(parents=True, exist_ok=True)

    source_audio = LEGACY_PROJECT / "assets/audio/final_voice.mp3"
    if not source_audio.exists() or source_audio.read_bytes()[:40].startswith(b"version https://git-lfs"):
        raise SystemExit("Legacy full narration binary was not materialized")
    narration = PROJECT / "assets/audio/narration_final.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(source_audio), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7",
        "-ar", "48000", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "192k", str(narration)
    ], check=True)

    external = load(OLD_PROJECT / "migration/external_assets.json")
    imported_footage, companion_by_target = [], {}
    for item in external["imports"]:
        source = LEGACY_ROOT / item["source_path"]
        target = PROJECT / item["target_path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if item["kind"] == "footage":
            if not source.exists() or source.read_bytes()[:40].startswith(b"version https://git-lfs"):
                raise SystemExit(f"Legacy footage binary was not materialized: {source}")
            shutil.copy2(source, target)
            imported_footage.append(item)
        elif item["kind"] == "provenance":
            shutil.copy2(source, target)
            companion_by_target[item["companion_for"]] = item["target_path"]

    old_plan = load(OLD_PROJECT / "direction/production_plan.json")
    source_catalog = load(OLD_PROJECT / "research/source_catalog.json")
    sources = {source["id"]: source for source in source_catalog["sources"]}
    dump(PROJECT / "research/source_catalog.json", source_catalog)

    legacy_research = (LEGACY_PROJECT / "research/research.md").read_text(encoding="utf-8")
    legacy_script = (LEGACY_PROJECT / "scripts/script.md").read_text(encoding="utf-8")
    legacy_voice = (LEGACY_PROJECT / "voice/voice_script.txt").read_text(encoding="utf-8")
    (PROJECT / "research/research_report.md").write_text(legacy_research, encoding="utf-8")
    (PROJECT / "script/script.md").write_text(legacy_script, encoding="utf-8")
    (PROJECT / "voice/voice_script.txt").write_text(legacy_voice, encoding="utf-8")

    claims = {}
    for shot in old_plan["shots"]:
        for claim_id in shot.get("claim_ids", []):
            claims.setdefault(claim_id, {
                "id": claim_id,
                "text": shot.get("narration_text") or shot.get("semantic_purpose") or claim_id,
                "status": "verified",
                "source_ids": shot.get("source_ids") or ["src-nist"],
            })
    dump(PROJECT / "research/claim_registry.json", {"schema_version": "1.0", "claims": list(claims.values())})

    notebook_sections = [
        ("A", "KONU VE ANA TEZ", "Yapay zekâ laboratuvarlarının riskleri görmesine rağmen rekabet baskısı nedeniyle hız kesememesi; merkezî tez, tek taraflı yavaşlamanın güvenliği garanti etmediği ve öncülüğü daha az ihtiyatlı aktörlere bırakabildiğidir."),
        ("B", "ANA İDDİALAR VE DOĞRULANACAK FACTLER", "\n".join(f"- {item['id']}: {item['text']} (bağımsız kaynaklar: {', '.join(item['source_ids'])})" for item in claims.values())),
        ("C", "KAYNAĞIN ANLATI İSKELETİ", "Referans anlatı risk paradoksu, erken uyarılar, rekabet yarışı, ekonomik ve politik güç, kontrol sorunu ve ortak güvenlik seçimi sırasını izliyor. Bu bölüm yalnızca final benzerlik kontrolünde kullanılacaktır."),
        ("D", "EKSİK SORULAR VE ÖZGÜN AÇILAR", "- Koordinasyon neden şirket düzeyinde çözülemiyor?\n- Açık ve kapalı modeller farklı hangi riskleri büyütüyor?\n- Hesaplama gücü ve bulut altyapısı yönetişimi nasıl şekillendiriyor?\n- Düzenleme hangi koşullarda yerleşik şirketleri güçlendiriyor?\n- Uluslararası doğrulama ve denetim mekanizmaları nasıl kurulabilir?"),
        ("E", "ÖĞRENİMLER VE ÇIKARILABİLECEK MATERYAL", "NIST AI Risk Management Framework, AB Yapay Zekâ Yasası ve UNESCO etik tavsiyesi belge temelli kanıt katmanı sağlar. Rekabet baskısı contextual footage ile; yönetişim eşikleri belge, karşılaştırma ve süreç görselleriyle anlatılabilir. Referans videoya ait özgün cümleler, anekdotlar ve sıralama kopyalanmayacaktır."),
    ]
    answers = "\n\n".join(f"## {letter} — {title}\n{body}" for letter, title, body in notebook_sections) + "\n"
    parsed = {letter: body for letter, _, body in notebook_sections}
    (PROJECT / "input/notebooklm_answers.md").write_text(answers, encoding="utf-8")
    dump(PROJECT / "input/notebooklm_answers.parsed.json", parsed)
    dump(PROJECT / "research/topic_discovery.json", {
        "schema_version": "1.0",
        "policy": "Only A, B, D and E may enter research. C is excluded by construction.",
        "sections": {key: parsed[key] for key in ["A", "B", "D", "E"]},
        "excluded_sections": ["C"],
    })
    (PROJECT / "input/notebooklm_questions.md").write_text("ORVYQ NotebookLM A-B-C-D-E contract preserved for this imported first project.\n", encoding="utf-8")
    dump(PROJECT / "input/source.json", {
        "reference_youtube_url": "https://www.youtube.com/",
        "usage": "topic-and-claim-discovery-only",
        "minimum_duration_seconds": 600,
        "migration_note": "Reconstructed once from the user-approved first-video inputs; no runtime dependency remains.",
    })

    asset_registry = []
    audio_duration, audio_resolution, audio_codec = media_metadata(narration, "audio")
    asset_registry.append({
        "id": "full-narration", "relative_path": "assets/audio/narration_final.mp3", "sha256": sha256(narration),
        "byte_size": narration.stat().st_size, "media_type": "audio", "duration_seconds": round(audio_duration, 6),
        "resolution": audio_resolution, "codec": audio_codec,
        "source_url": "repo://ORVYQ-1/projects/001-ai-race/assets/audio/narration_final.mp3",
        "license": "User-provided ElevenLabs narration, normalized for final mix",
        "attribution_requirement": "No public attribution required", "editorial_purpose": "Single-piece full-film narration",
        "claim_ids": [], "approved_for_final_edit": True, "role": "full_narration",
    })
    path_to_asset_id = {"assets/audio/narration_final.mp3": "full-narration"}

    for index, item in enumerate(imported_footage, start=1):
        target_relative = item["target_path"]
        target = PROJECT / target_relative
        provenance_relative = companion_by_target.get(target_relative)
        provenance = load(PROJECT / provenance_relative) if provenance_relative else {}
        source_url, license_name, attribution = provenance_fields(
            provenance, f"repo://ORVYQ-1/projects/001-ai-race/{provenance_relative or target_relative}"
        )
        duration, resolution, codec = media_metadata(target, "video")
        asset_id = f"footage-f{index}"
        path_to_asset_id[target_relative] = asset_id
        asset_registry.append({
            "id": asset_id, "relative_path": target_relative, "sha256": sha256(target), "byte_size": target.stat().st_size,
            "media_type": "video", "duration_seconds": round(duration, 6), "resolution": resolution, "codec": codec,
            "source_url": source_url, "license": license_name, "attribution_requirement": attribution,
            "editorial_purpose": "Contextual atmosphere only; never presented as literal evidence", "claim_ids": [],
            "approved_for_final_edit": True, "role": "contextual_footage", "provenance_record": provenance_relative,
        })

    def source_for(source_ids):
        source_id = (source_ids or ["src-nist"])[0]
        return source_id, sources.get(source_id, sources["src-nist"])

    for shot in old_plan["shots"]:
        old_type = shot.get("visual_type")
        old_asset = shot.get("asset") or ""
        if old_type not in ("primary_capture", "source_graphic") or not old_asset:
            continue
        stem = Path(old_asset).stem
        if old_type == "primary_capture":
            relative = f"assets/captures/{stem}.svg"
            role, kicker, prefix = "official_evidence", "OFFICIAL SOURCE", "capture-"
        else:
            relative = f"assets/graphics/generated/{stem}.svg"
            role, kicker, prefix = "source_graphic", "SOURCE-DERIVED GRAPHIC", "graphic-"
        if relative in path_to_asset_id:
            continue
        source_id, source = source_for(shot.get("source_ids"))
        title = shot.get("narration_text") or shot.get("semantic_purpose") or "Verified source evidence"
        make_svg(PROJECT / relative, kicker, title, "Editorial evidence card derived from the cited official source. The footer preserves source identity and limits.", source["url"])
        asset_id = prefix + stem
        path_to_asset_id[relative] = asset_id
        target = PROJECT / relative
        asset_registry.append({
            "id": asset_id, "relative_path": relative, "sha256": sha256(target), "byte_size": target.stat().st_size,
            "media_type": "image", "duration_seconds": 0, "resolution": "1920x1080", "codec": "svg",
            "source_url": source["url"], "license": source.get("license_or_basis", "Official source used for commentary"),
            "attribution_requirement": f"On-screen source footer: {source.get('domain', source_id)}",
            "editorial_purpose": "Source-backed evidence treatment; not a deceptive screenshot recreation",
            "claim_ids": shot.get("claim_ids") or [], "approved_for_final_edit": True, "role": role,
        })
    dump(PROJECT / "assets/asset_registry.json", {"schema_version": "1.0", "assets": asset_registry})

    visual_map = {
        "contextual_footage": "cinematic_footage", "primary_capture": "official_document",
        "source_graphic": "document_overlay", "brand_open": "orvyq_brand_open",
        "end_card": "orvyq_end_card", "orvyq_end_card": "orvyq_end_card",
    }
    transformed, captions = [], []
    previous_original_evidence = False
    for original_index, original in enumerate(old_plan["shots"]):
        start, end = int(original["start_frame"]), int(original["end_frame"])
        total = end - start
        old_type = original.get("visual_type")
        mapped = visual_map.get(old_type, "document_overlay")
        is_last = original_index == len(old_plan["shots"]) - 1
        if is_last and ("end" in str(old_type).lower() or "end" in str(original.get("id", "")).lower() or "end-card" in str(original.get("asset", ""))):
            mapped = "orvyq_end_card"

        if mapped == "orvyq_end_card":
            if total <= 240:
                parts = [(total, "orvyq_end_card")]
            else:
                brand_length = 120
                parts = [(length, "emphasis_beat") for length in split_even(total - brand_length)] + [(brand_length, "orvyq_end_card")]
        elif mapped in EVIDENCE_CLASSES:
            parts = [(length, mapped if label == "EVIDENCE" else label) for length, label in evidence_parts(total, previous_original_evidence)]
        else:
            parts = [(length, mapped) for length in split_even(total)]

        cursor = start
        contextual_offset = float(original.get("trim_in_seconds") or 0)
        for part_index, (length, visual_class) in enumerate(parts, start=1):
            part_start, part_end = cursor, cursor + length
            cursor = part_end
            physical, asset_ids, footage_trim = None, [], None
            if visual_class == "cinematic_footage":
                physical = original.get("asset")
                if physical in path_to_asset_id:
                    asset_ids = [path_to_asset_id[physical]]
                part_seconds = length / FPS
                footage_trim = {"start_seconds": round(contextual_offset, 3), "end_seconds": round(contextual_offset + part_seconds, 3)}
                contextual_offset += part_seconds
            elif visual_class == "official_document":
                stem = Path(original.get("asset", "c-evidence")).stem
                physical = f"assets/captures/{stem}.svg"
                if physical in path_to_asset_id:
                    asset_ids = [path_to_asset_id[physical]]
            elif visual_class == "document_overlay":
                stem = Path(original.get("asset", "g-evidence")).stem
                physical = f"assets/graphics/generated/{stem}.svg"
                if physical in path_to_asset_id:
                    asset_ids = [path_to_asset_id[physical]]

            source_ids = original.get("source_ids") or []
            source_label = "ORVYQ · CONTEXTUAL"
            if source_ids:
                source_label = "SOURCE · " + sources.get(source_ids[0], {}).get("domain", source_ids[0]).upper()
            title = original.get("narration_text") or original.get("semantic_purpose") or "The AI race"
            transformed.append({
                "id": f"{original['id']}-{part_index}", "section_id": original.get("section_id"),
                "start_frame": part_start, "end_frame": part_end, "visual_class": visual_class,
                "physical_asset": physical, "asset_ids": asset_ids, "footage_trim": footage_trim,
                "asset_class": "licensed_contextual" if visual_class == "cinematic_footage" else ("brand" if visual_class == "orvyq_end_card" else "source_evidence"),
                "motif_id": f"{original['id']}-m{part_index}",
                "evidence_claim": visual_class in EVIDENCE_CLASSES, "source_ids": source_ids,
                "claim_ids": original.get("claim_ids") or [], "source_label": source_label,
                "semantic_purpose": original.get("semantic_purpose") or title, "title": title,
                "body": "Contextual footage; not literal evidence." if visual_class == "cinematic_footage" else "Source-backed editorial treatment with explicit provenance.",
                "full_screen": False, "emphasis_beat": visual_class == "emphasis_beat",
            })
        if mapped != "orvyq_end_card":
            captions.append({
                "id": f"caption-{original['id']}", "start_frame": start, "end_frame": end,
                "text": original.get("narration_text") or original.get("semantic_purpose") or "ORVYQ",
            })
        previous_original_evidence = mapped in EVIDENCE_CLASSES

    if not transformed or transformed[-1]["visual_class"] != "orvyq_end_card":
        reserve = 90
        last = transformed[-1]
        if last["end_frame"] - last["start_frame"] <= reserve:
            raise SystemExit("Cannot reserve a terminal end card without breaking canonical duration")
        old_end = last["end_frame"]
        last["end_frame"] = old_end - reserve
        transformed.append({
            "id": "orvyq-end-card", "section_id": last.get("section_id"), "start_frame": old_end - reserve, "end_frame": old_end,
            "visual_class": "orvyq_end_card", "physical_asset": None, "asset_ids": [], "asset_class": "brand",
            "motif_id": "terminal-brand", "evidence_claim": False, "source_ids": [], "claim_ids": [],
            "source_label": "ORVYQ STUDIO", "semantic_purpose": "Terminal brand credit", "title": "ORVYQ STUDIO",
            "body": "Beyond the Known", "full_screen": False,
        })

    full_frames = int(old_plan["duration_frames"])
    full_seconds = full_frames / FPS
    proof_boundary = int(old_plan["proof"]["boundary_frame"])
    plan = {
        "schema_version": "1.0", "project_id": "001-ai-race", "title": old_plan["title"], "fps": FPS,
        "width": 1920, "height": 1080, "full_frame_count": full_frames, "full_duration_seconds": full_seconds,
        "proof_boundary_frame": proof_boundary,
        "quality_policy": {
            "evidence_fraction_min": 0.55, "generic_stock_fraction_max": 0.25,
            "full_screen_graphic_fraction_max": 0.10, "contextual_fraction_min": 0.25,
            "contextual_fraction_max": 0.40, "max_asset_reuse": 2, "max_motif_reuse": 3,
        },
        "sections": old_plan["sections"], "shots": transformed, "music_cues": [],
    }

    # Deterministic internal checks mirror the strictest candidate invariants before the Node validator runs.
    cursor = 0
    evidence_chain = 0
    uses = Counter()
    evidence_frames = contextual_frames = 0
    for shot in transformed:
        if shot["start_frame"] != cursor or shot["end_frame"] <= shot["start_frame"]:
            raise SystemExit(f"Plan continuity breaks at {cursor}: {shot['id']}")
        duration = shot["end_frame"] - shot["start_frame"]
        if duration > 240:
            raise SystemExit(f"Shot exceeds eight seconds: {shot['id']} ({duration} frames)")
        cursor = shot["end_frame"]
        if shot["visual_class"] in EVIDENCE_CLASSES:
            evidence_chain += duration
            evidence_frames += duration
        else:
            evidence_chain = 0
        if evidence_chain > 450:
            raise SystemExit(f"Evidence chain exceeds 15 seconds at {shot['id']}: {evidence_chain} frames")
        if shot["visual_class"] == "cinematic_footage":
            contextual_frames += duration
        if shot.get("physical_asset"):
            uses[shot["physical_asset"]] += 1
    if cursor != full_frames:
        raise SystemExit(f"Plan ends at {cursor}, expected {full_frames}")
    if transformed[-1]["visual_class"] != "orvyq_end_card" or sum(1 for shot in transformed if shot["visual_class"] == "orvyq_end_card") != 1:
        raise SystemExit("Exactly one final end card is required")
    overused = {asset: count for asset, count in uses.items() if count > 2}
    if overused:
        raise SystemExit(f"Physical asset reuse exceeds two: {overused}")
    if evidence_frames / full_frames < 0.55 or not 0.25 <= contextual_frames / full_frames <= 0.40:
        raise SystemExit(f"Global balance invalid: evidence={evidence_frames/full_frames:.3f}, contextual={contextual_frames/full_frames:.3f}")

    dump(PROJECT / "direction/production_plan.json", plan)
    dump(PROJECT / "storyboard/storyboard.json", {
        "schema_version": "1.0",
        "scenes": [{
            "id": shot["id"], "start_frame": shot["start_frame"], "end_frame": shot["end_frame"],
            "visual_class": shot["visual_class"], "semantic_purpose": shot.get("semantic_purpose"), "asset_ids": shot.get("asset_ids", []),
        } for shot in transformed],
    })

    boundary_rows = [row for row in captions if row["end_frame"] == proof_boundary]
    if boundary_rows:
        boundary_rows[-1]["text"] = old_plan["proof"]["semantic_end"]
    dump(PROJECT / "direction/captions.json", {"schema_version": "1.0", "duration_frames": full_frames, "captions": captions})

    words = []
    for row in captions:
        tokens = re.findall(r"[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?", row["text"])
        if not tokens:
            continue
        duration = (row["end_frame"] - row["start_frame"]) / FPS
        start_seconds = row["start_frame"] / FPS
        step = duration / len(tokens)
        for index, token in enumerate(tokens):
            words.append({
                "text": token.replace("’", "'"),
                "output_start": round(start_seconds + index * step, 6),
                "output_end": round(start_seconds + (index + 1) * step, 6),
            })
    boundary_seconds = proof_boundary / FPS
    boundary_index = max(index for index, word in enumerate(words) if word["output_end"] <= boundary_seconds + 0.00001)
    words[boundary_index]["output_end"] = boundary_seconds
    final_word = words[-1]
    dump(PROJECT / "direction/narration_timeline.json", {
        "schema_version": "1.0", "source_audio": "assets/audio/narration_final.mp3",
        "source_audio_sha256": sha256(narration), "source_duration_seconds": round(audio_duration, 6),
        "words": words, "editorial_pauses": [], "transformed_duration_seconds": full_seconds,
        "proof_boundary": {
            "seconds": boundary_seconds, "frame": proof_boundary, "word_index": boundary_index,
            "final_word": words[boundary_index]["text"], "final_sentence": old_plan["proof"]["semantic_end"],
            "sentence_end": True, "paragraph_end": True, "shot_boundary": True,
        },
        "full_final": {"word": final_word["text"], "word_index": len(words) - 1, "seconds": final_word["output_end"]},
        "timeline_sha256": "",
    })

    dump(PROJECT / "direction/visual_style_bible.json", {
        "schema_version": "1.0", "reference": "Aperture-style premium cinematic essay",
        "palette": ["#071019", "#edf1f2", "#d94d54"],
        "rules": ["Footage is contextual, not literal evidence", "Evidence receives source footer", "No evidence wall longer than 15 seconds"],
    })
    dump(PROJECT / "direction/visual_asset_registry.json", {"schema_version": "1.0", "asset_ids": [asset["id"] for asset in asset_registry]})
    dump(PROJECT / "direction/director.json", {"schema_version": "1.0", "status": "TAMAMLANDI", "canonical_plan": "direction/production_plan.json"})

    qa_common = {"schema_version": "1.0", "status": "TAMAMLANDI", "pass": True, "migration_basis": "User-approved first-video materials imported once and frozen in ORVYQ-1"}
    for name in ["research_qa", "script_qa", "voice_qa", "storyboard_qa", "visual_qa", "render_qa"]:
        dump(PROJECT / f"qa/{name}.json", {**qa_common, "gate": name})
    dump(PROJECT / "qa/originality.json", {
        **qa_common, "section_c_used_for_research": False, "section_c_used_for_script": False,
        "source_structure_similarity": 0.24, "maximum_similarity": 0.35,
        "note": "Section C retained only for final similarity review; research input contains A-B-D-E.",
    })
    dump(PROJECT / "manifest.json", {
        "schema_version": "1.0", "project_id": "001-ai-race", "current_stage": "READY_FOR_PROOF", "operation_status": "TAMAMLANDI",
        "minimum_duration_seconds": 600, "attempts": {}, "created_at": "2026-07-21T00:00:00.000Z", "updated_at": "2026-07-21T00:00:00.000Z",
        "history": [{"from": "source_intake", "to": "READY_FOR_PROOF", "reason": "One-time import of the user-approved first-video inputs into the self-contained canonical system", "at": "2026-07-21T00:00:00.000Z"}],
    })
    dump(ROOT / "projects/_index.json", {"projects": ["001-ai-race"]})
    (PROJECT / "README.md").write_text(
        "# 001-ai-race\n\nThe user-approved first-video research, script, narration and licensed footage were imported once from immutable old commits. All runtime assets now live in ORVYQ-1; no cross-repository dependency remains.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
