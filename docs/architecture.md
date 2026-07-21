# ORVYQ Canonical Architecture

Status: **normative**

## 1. Design goals

The system must be:

- self-contained in this repository,
- deterministic from frozen candidate to final artifact,
- evidence-led,
- fail-closed,
- reusable across future films,
- free of runtime dependencies on legacy repositories,
- proof/full identical for the approved prefix.

## 2. Repository layout

```text
src/
  cli/
  core/
  contracts/
  research/
  evidence/
  assets/
  direction/
  audio/
  render/
  qa/
  runtime/
schemas/
tests/
docs/
projects/
.github/workflows/
```

Each project owns all production inputs and outputs:

```text
projects/<project-id>/
  input/
  research/
  evidence/
    documents/
    figures/
    screenshots/
    crops/
  assets/
    footage/
    narration/
    music/
    sfx/
  direction/
  storyboard/
  audio/
  build/
  qa/
  output/
  manifest.json
```

## 3. Layer boundaries

### `core`

Owns repository paths, hashing, atomic writes, error types, process execution, media probing, and deterministic JSON serialization.

### `contracts`

Owns schemas and typed validation. Business logic must not silently coerce invalid production data.

### `research`

Owns source catalog, claim registry, claim qualification, and claim-to-evidence requirements.

### `evidence`

Owns acquisition, capture, cropping, authenticity validation, page/figure metadata, and claim links. It must reject generated summary cards as primary evidence.

### `assets`

Owns provenance, licensing/usage basis, hashes, media metadata, and approval state for footage, narration, music, SFX, and evidence assets.

### `direction`

Owns visual grammar, storyboard, section design, pacing, semantic shot selection, and the single canonical production plan.

### `audio`

Owns narration alignment, editorial pauses, cue sheet, music states, ducking, SFX policy, final mix, and loudness targets.

### `render`

Owns reusable Remotion scene families. It consumes frozen render input only and does not invent assets, timing, music, or editorial structure at render time.

### `qa`

Owns static, rendered, semantic, brightness, audio, pacing, provenance, mobile-legibility, and proof-representativeness gates.

### `runtime`

Owns candidate freezing, proof render, proof identity, human approval record, full render, final QA, and artifact manifests.

## 4. State machine

Canonical stages:

```text
SOURCE_INTAKE
RESEARCH
RESEARCH_QA
SCRIPT
FACT_AUDIT
VOICE
EVIDENCE_COLLECTION
EVIDENCE_QA
VISUAL_PLANNING
AUDIO_MIX
READY_FOR_CANDIDATE
READY_FOR_PROOF
WAITING_FOR_PROOF_APPROVAL
READY_FOR_FULL_RENDER
FINAL_QA
DONE
```

Only validated transitions are allowed. Failed stages remain failed until their canonical inputs are corrected. Repair-request files and hidden transition shortcuts are forbidden.

## 5. CLI

Single entry point:

```bash
npm run orvyq -- <command>
```

Required commands:

```text
project:init
source:ingest
research:build
research:validate
evidence:collect
evidence:validate
script:build
script:validate
audio:register
audio:mix
storyboard:build
plan:build
candidate:freeze
proof:render
proof:approve
full:render
package:build
```

Each command must have:

- explicit inputs,
- schema validation,
- deterministic outputs,
- structured error code,
- no implicit network or legacy-repository fallback.

## 6. Canonical data contracts

Required top-level project contracts:

- `manifest.json`
- `research/source_catalog.json`
- `research/claim_registry.json`
- `research/claim_evidence_map.json`
- `evidence/evidence_registry.json`
- `assets/asset_registry.json`
- `direction/narration_timeline.json`
- `direction/visual_style_bible.json`
- `direction/storyboard.json`
- `direction/production_plan.json`
- `audio/music_cue_sheet.json`
- `audio/audio_mix_manifest.json`
- `build/render_input.json`
- `build/candidate_manifest.json`
- `build/proof_manifest.json`
- `build/runtime_approval.json`
- `qa/*.json`

## 7. Primary-evidence contract

An evidence asset must identify:

- actual source pixels,
- source ID,
- claim IDs,
- page/figure/region,
- capture method,
- source URL,
- capture time,
- SHA-256,
- usage basis,
- limitation,
- final-edit approval.

Primary evidence cannot be created by writing source-derived prose onto a blank SVG.

## 8. Canonical production plan

There is one plan only:

`direction/production_plan.json`

The plan contains the full film. Proof rendering clips this plan at `proof_boundary_frame`; it does not create a second plan.

Each shot must include:

- shot and section ID,
- start/end frame,
- visual family,
- physical asset IDs,
- claim/source IDs where applicable,
- semantic purpose,
- motion,
- transition,
- caption behavior,
- audio cue reference,
- limitation/source presentation.

## 9. Audio architecture

Audio is mixed before candidate freezing.

Inputs:

- narration stem,
- approved music stems,
- optional approved SFX,
- narration timeline,
- editorial pauses,
- music cue sheet,
- ducking automation.

Outputs:

- final mixed audio,
- mix manifest,
- loudness report,
- music-presence report,
- ducking report.

The renderer receives final mixed audio. Optional runtime music lookup is forbidden.

## 10. Renderer architecture

Reusable scene families must include:

- `CinematicHook`
- `ContextualFootage`
- `PrimaryDocument`
- `SplitDocuments`
- `OfficialFigure`
- `OfficialScreen`
- `SourceArticle`
- `ImageSequence`
- `EvidenceChain`
- `SourceTimeline`
- `SourceDerivedGraphic`
- `ComparisonGraphic`
- `ProcessGraphic`
- `LimitationTreatment`
- `EditorialPause`
- `BrandOpen`
- `BrandClose`

Renderer components must not contain project IDs or video-specific conditionals.

## 11. Candidate freezing

`candidate:freeze` validates and hashes:

- canonical plan,
- narration timeline,
- evidence registry,
- asset registry,
- audio mix,
- cue sheet,
- render input,
- proof prefix.

Candidate freezing is blocked unless all mandatory QA reports pass.

## 12. Proof and approval

Proof requirements are defined in `docs/quality-contract.md`.

`proof:approve` records:

- candidate SHA,
- proof run ID,
- proof manifest digest,
- all frozen input digests,
- approval timestamp.

No approval can be reused after candidate drift.

## 13. Full render

Full render validates proof identity before rendering. It uses the exact frozen inputs and renderer revision used by proof. Final QA produces a runtime final manifest and downloadable artifact.

## 14. Workflows

Only three permanent workflows are allowed:

- `ci.yml`
- `proof.yml`
- `full-render.yml`

Temporary trigger files, self-modifying workflows, and proof repair jobs are forbidden.

## 15. Testing strategy

Tests must include:

- schema and contract tests,
- negative evidence-authenticity tests,
- state-transition tests,
- candidate-drift tests,
- proof/full prefix identity tests,
- audio-mix and ducking tests,
- brightness and black-frame fixtures,
- representative proof validation,
- renderer smoke test with real audio and video streams.
