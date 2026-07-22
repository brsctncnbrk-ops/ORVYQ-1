# ORVYQ Golden Proof Source Lock

## Canonical source

- Source repository: `brsctncnbrk-ops/YouTube_pepline`
- Source PR: `#10 — Build ORVYQ 150-second cinematic proof`
- Source branch: `agent/orvyq-video-revision`
- Head commit: `41ca17046acb795229950fd7a5a18463a2a97f85`
- GitHub pull-request merge commit used by the successful workflow checkout: `9affbd2494d8197a564c4a552b879fadb0e14a4a`
- Successful workflow run: `29655003486`
- Golden artifact: `orvyq-cinematic-proof-150s-29655003486`

This source is the visual and technical golden master. ORVYQ-1 must not redesign or replace its render language.

## Verified proof/full relationship

The successful proof used the same production chain with preview limits supplied as environment variables:

- `ORVYQ_PREVIEW_FRAMES=4500`
- `ORVYQ_AUDIO_LIMIT_SECONDS=150`
- `ORVYQ_NARRATION_LIMIT_SECONDS=114.2`
- `ORVYQ_EDITORIAL_PAUSES=1`
- `ORVYQ_CINEMATIC_PROOF=1`
- `ORVYQ_REQUIRE_APPROVED_MUSIC=1`

The production correction is therefore not a new renderer. It is to preserve the same timeline/composition/audio/asset pipeline and make the render range the only proof/full difference.

## Migration groups

### A. Renderer and composition core — migrate physically

- `templates/remotion/src/CaptionLayer.tsx`
- `templates/remotion/src/EditorialOverlay.tsx`
- `templates/remotion/src/EmphasisCard.tsx`
- `templates/remotion/src/EvidenceVisual.tsx`
- `templates/remotion/src/OrvyqGraphic.tsx`
- `templates/remotion/src/PrimaryEvidence.tsx`
- `templates/remotion/src/PrimaryEvidenceV2.tsx`
- `templates/remotion/src/Scene.tsx`
- `templates/remotion/src/Video.tsx`
- `scripts/remotion_build.mjs`

### B. Canonical timeline, captions, audio and evidence generation — migrate physically

- `scripts/orvyq_preview_plan.mjs`
- `scripts/orvyq_edit_plan.mjs`
- `scripts/orvyq_caption_build.mjs`
- `scripts/orvyq_audio_mix.mjs`
- `scripts/orvyq_fetch_primary_evidence.mjs`
- `scripts/orvyq_fetch_proof_music.mjs`
- `scripts/lib/orvyq-evidence.mjs`
- `scripts/lib/orvyq-motion-hook.mjs`

### C. Quality gates required to preserve the approved output — migrate physically

- `scripts/orvyq_edit_plan_tests.mjs`
- `scripts/orvyq_evidence_asset_audit.mjs`
- `scripts/orvyq_evidence_audit.mjs`
- `scripts/orvyq_license_audit.mjs`
- `scripts/orvyq_media_qa.mjs`
- `scripts/orvyq_mobile_legibility_audit.mjs`
- `scripts/orvyq_music_cue_audit.mjs`
- `scripts/orvyq_pacing_audit.mjs`
- `scripts/orvyq_semantic_visual_audit.mjs`
- `scripts/orvyq_alignment_score.mjs`
- `scripts/orvyq_speech_qa.py`
- `scripts/orvyq_brightness_repair.mjs`

### D. Project production data — migrate as the first canonical fixture

- `direction/cinematic_proof_cut.json`
- `direction/cinematic_revision_plan.json`
- `direction/edit_plan.json`
- `direction/editorial_pause_map.json`
- `direction/motion_hook.json`
- `direction/music_cue_sheet.json`
- `research/evidence_asset_manifest.json`
- `research/evidence_map.json`
- `research/evidence_resolutions.json`
- `research/primary_evidence_manifest.json`
- `voice/audio_repair.json`
- `voice/narration_status.json`
- `voice/voice_script.txt`

### E. Workflow behavior — reproduce, do not redesign

The source workflow performs this sequence:

1. checkout exact source with Git LFS
2. fetch and verify primary evidence
3. fetch approved music
4. build paused narration, music and restrained SFX
5. verify narration
6. build captions and cinematic edit plan
7. run editorial/evidence/pacing/mobile/music audits
8. build the render-ready project from the shared template
9. type-check
10. render the selected frame range
11. repair isolated brightness corruption
12. verify rendered speech and post-render media quality
13. upload proof and diagnostics

ORVYQ-1 must preserve this order.

### F. Do not migrate as production architecture

- generated `render_ready_project` source/data files; these must remain build outputs
- QA result JSON files; these must be regenerated
- debug trigger files
- historical render request files
- proof-only naming and duplicated workflow variants

## Mandatory implementation rules

1. One canonical timeline.
2. One Remotion composition/render language.
3. One audio mix system.
4. One evidence/asset resolver.
5. Proof mode changes only the render range and artifact name.
6. Full mode cannot select a different renderer, edit plan, audio path or visual fallback.
7. Full render remains disabled until a newly migrated proof is watched and explicitly approved by the user.
8. Automated QA success is not human creative approval.
