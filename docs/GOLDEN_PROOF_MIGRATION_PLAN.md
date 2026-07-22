# ORVYQ Golden Proof Production Migration Plan

## Objective

Do not design a new video system.

Promote the proven proof pipeline from `brsctncnbrk-ops/YouTube_pepline` commit `41ca17046acb795229950fd7a5a18463a2a97f85` into the single production pipeline used by ORVYQ-1.

The approved proof artifact is:

- workflow run: `29655003486`
- artifact: `orvyq-cinematic-proof-150s-29655003486`

Proof and full render must use the same timeline, composition, renderer, assets, audio mix, captions, transitions and visual rules. The only allowed difference is the render end frame.

## Non-negotiable constraints

1. No full render before explicit human approval of a new proof.
2. No redesign of the approved proof language.
3. No replacement renderer may be introduced.
4. No proof-only visual logic may remain.
5. No independent full-render composition may remain.
6. Any migration change that visibly diverges from the golden proof is rejected.

## Source of truth

Repository: `brsctncnbrk-ops/YouTube_pepline`

Commit: `41ca17046acb795229950fd7a5a18463a2a97f85`

Known production scripts at the source commit:

- `scripts/orvyq_audio_mix.mjs`
- `scripts/orvyq_caption_build.mjs`
- `scripts/orvyq_fetch_primary_evidence.mjs`
- `scripts/orvyq_preview_plan.mjs`
- `scripts/orvyq_edit_plan_tests.mjs`
- ORVYQ audit scripts referenced by `package.json`

## Phase 1 — Golden pipeline inventory

Extract the exact files and runtime inputs used by workflow run `29655003486`:

- GitHub Actions workflow
- render command and environment variables
- Remotion entry point and composition
- edit-plan generator
- scene and shot renderers
- captions
- audio mix
- transitions and visual effects
- typography and color constants
- project data and asset manifests
- proof frame-limit mechanism

Deliverable: a source-to-runtime dependency map. No code migration before this map is complete.

## Phase 2 — Proof-only divergence audit

Classify every source component as one of:

- shared production logic
- proof duration limiter
- proof-only hard-code
- project data
- obsolete diagnostic logic

The only proof-specific behavior allowed after migration is:

`render_end_frame = min(full_duration_frames, proof_duration_frames)`

Everything else must be shared.

## Phase 3 — Preserve the golden renderer

Move the exact approved renderer and its direct dependencies into ORVYQ-1 without aesthetic rewrites.

Preserve:

- composition structure
- shot timing
- transitions
- footage treatment
- evidence presentation
- typography
- captions
- audio behavior
- editorial pauses
- color and atmosphere

Do not replace working code with a cleaner abstraction during this phase.

## Phase 4 — Unify proof and full render

Create one canonical render path:

`project inputs -> one edit plan -> one Remotion composition -> proof or full render`

Modes:

- proof: same composition, capped end frame
- full: same composition, natural final frame

No second timeline, second composition, alternate assets or alternate audio mix.

## Phase 5 — Golden equivalence proof

Render the same 150-second range from ORVYQ-1.

Compare against the golden artifact for:

- duration and frame rate
- shot boundaries
- source assets and trims
- captions
- audio waveform and loudness behavior
- editorial pause behavior
- transitions
- typography
- visual framing

Automated checks support the review but do not replace human approval.

## Phase 6 — Human gate

Upload the migrated proof artifact.

Stop.

Do not trigger full render until the user explicitly approves the video.

## Phase 7 — Full render validation

After approval, run the same composition without the proof end-frame cap.

Before rendering, assert:

- approved proof candidate commit equals full-render candidate commit
- edit-plan hash matches
- composition source hash matches
- asset manifest hash matches
- audio mix hash matches
- only render end frame differs

## Acceptance criteria

The migration is complete only when:

1. The ORVYQ-1 proof visually and audibly matches the approved proof quality.
2. Proof and full render share one renderer and one timeline.
3. Full render cannot run without explicit proof approval.
4. No proof-only aesthetic code remains.
5. A future project can use the same pipeline with a different project dataset.

## Immediate execution order

1. Freeze the current ORVYQ-1 canonical rebuild from further aesthetic development.
2. Inventory the golden source commit and workflow run.
3. Produce the dependency map.
4. Migrate the exact renderer.
5. Remove only the duration-specific proof coupling.
6. Generate a new 150-second proof.
7. Wait for human review.
