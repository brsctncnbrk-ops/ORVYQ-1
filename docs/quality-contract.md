# ORVYQ Canonical Quality Contract

Status: **normative**

This document defines the minimum acceptable quality for every ORVYQ film. A pipeline run that violates any blocking rule must fail closed. Passing technical render checks alone is not sufficient.

## 1. Creative reference

- Primary creative reference: Aperture (`@ApertureThinking`).
- The approved legacy ORVYQ proof is a technical and editorial baseline, not a codebase to copy.
- Target: faceless, cinematic, premium video essays with evidence-led storytelling.
- The system must generalize to future videos. Video-specific code paths and one-off repair scripts are forbidden.

## 2. Editorial rhythm

The canonical rhythm is:

`cinematic hook → primary evidence → interpretation → contextual footage → source-derived graphic → primary evidence → editorial breath`

Rules:

- A film must not become a document wall or a stock-footage montage.
- The opening must establish tension or curiosity before sustained evidence presentation.
- The first 8–15 seconds should normally contain 3–5 meaningful visual beats.
- Contextual footage must never be presented as literal evidence.
- Evidence and contextual material must alternate according to narrative meaning, not merely to satisfy ratios.
- Normal shot duration: 2.5–7 seconds.
- Hard minimum shot duration: 1.5 seconds, except deliberate transition frames.
- Hard maximum shot duration: 8 seconds unless explicitly justified by a readable primary source.
- Sub-second contextual-relief clips are forbidden.
- A continuous evidence/document chain must not exceed 15 seconds without a contextual, explanatory, or editorial break.

## 3. Primary evidence authenticity

Primary evidence means visible pixels from the actual source material:

- official PDF page,
- official web-page capture,
- published figure or chart,
- official screen or interface,
- article page,
- table,
- source image sequence.

Generated cards that only summarize a source are **not** primary evidence.

Blocking rules:

- `PRIMARY_SOURCE_PIXELS_REQUIRED`
- `PLACEHOLDER_EVIDENCE_FORBIDDEN`
- `CLAIM_EVIDENCE_LINK_REQUIRED`
- `SOURCE_PROVENANCE_REQUIRED`

Every primary-evidence asset must include:

- asset ID,
- source ID,
- claim IDs,
- source URL,
- page/figure/region information when applicable,
- capture timestamp,
- SHA-256,
- usage basis or license,
- limitation text,
- approval state.

## 4. Visual grammar

The renderer must support distinct, reusable scene families:

- cinematic hook,
- contextual footage,
- primary document,
- split documents,
- official figure,
- official screen,
- source article,
- image sequence,
- evidence chain,
- source timeline,
- source-derived comparison,
- process graphic,
- limitation treatment,
- editorial pause,
- brand open,
- brand close.

The same layout or motif must not dominate a section. Visual variety must be semantic, not random.

## 5. Motion and transitions

Allowed footage motion includes hold, push, pull, drift, slow pan, and focus reframe.

Allowed evidence motion includes page reveal, focus crop, slow push, callout reveal, figure trace, and comparison reveal.

Transitions must be motivated. Repeated fades are forbidden. Full black may be used only for a justified section break, deliberate silence, or final release.

## 6. Brightness and color

The image must remain legible on mobile and television displays.

Default guidance:

- footage brightness: approximately 0.90–1.00,
- saturation: approximately 0.82–0.96,
- contrast: approximately 1.02–1.08,
- overlays must be scene-specific and restrained.

Blocking rendered checks:

- no nonterminal black segment,
- no unexplained transient dark frame,
- no flash-like brightness jump,
- `minimum_yavg >= 18`,
- `transient_brightness_drops = 0`.

## 7. Audio and music

Music is a required production asset, not an optional renderer decoration.

The audio pipeline must produce a deterministic final mix from:

- narration stem,
- music stem(s),
- optional approved SFX stems,
- cue sheet,
- narration ducking automation,
- editorial pauses,
- loudness normalization.

Blocking rules:

- at least four distinct musical energy states for a full film,
- continuous single-level looping is forbidden,
- narration ducking is required,
- music provenance is required,
- proof must contain audible music,
- music must remain subordinate to narration,
- random trailer booms, whooshes, glitches, and impacts are forbidden.

Renderer input must reference the final mixed audio asset. Missing or stale audio mix blocks candidate freezing.

## 8. Editorial pauses

A pause may extend the film beyond the narration duration when it serves comprehension or atmosphere.

During an editorial pause:

- narration may stop,
- music may rise,
- captions should normally disappear,
- the image must carry a clear editorial purpose.

Pauses must be represented in the canonical timeline and audio mix, not added during proof rendering.

## 9. Canonical plan

There is exactly one production plan per candidate:

`direction/production_plan.json`

Separate proof, preview, and full edit plans are forbidden. The proof is a semantic prefix of the full canonical plan.

The plan must include:

- sections and beats,
- shots and assets,
- claim/evidence links,
- motion and transitions,
- captions,
- music cues,
- editorial pauses,
- proof boundary,
- final frame.

## 10. Representative proof

A proof must be at least 150 seconds and end at a semantic boundary:

- complete sentence,
- complete paragraph,
- shot boundary,
- meaningful section or subsection end.

A representative proof must include:

- cinematic hook,
- real primary document,
- real figure/table/screen,
- contextual footage,
- source-derived graphic,
- music-state change,
- narration ducking,
- at least one editorial pause,
- captions,
- limitation treatment,
- visible source attribution.

If any required family is absent, the proof is not representative and cannot be approved.

## 11. Proof/full identity

The frozen candidate records:

- candidate SHA,
- production-plan digest,
- narration-timeline digest,
- asset-registry digest,
- audio-mix digest,
- cue-sheet digest,
- render-input digest,
- proof-prefix digest.

Any change invalidates the previous proof approval. Full render must use the exact approved candidate.

## 12. Quality gates

### Static gates

- schema validation,
- file and SHA integrity,
- LFS binary validation,
- provenance and usage basis,
- claim coverage,
- primary-evidence authenticity,
- scene duration,
- asset/motif reuse,
- cue coverage.

### Rendered gates

- video/audio streams,
- duration, resolution, codecs,
- integrated loudness and true peak,
- narration presence,
- audible music and ducking,
- silence windows,
- black-frame and brightness analysis,
- caption completeness,
- mobile legibility,
- final-word presence,
- contact sheet.

### Semantic gates

- visual matches narration,
- evidence supports the linked claim,
- contextual footage is not presented as proof,
- source limitations are visible,
- no document wall,
- no meaningless visual-ratio filler,
- premium Aperture-style video-essay judgment.

Automated PASS does not replace human proof approval.

## 13. Definition of done

The production system is complete only when:

- a representative proof passes every gate,
- the user approves the proof,
- full render uses the exact same frozen candidate,
- final QA passes,
- a downloadable artifact is produced,
- a second project can enter the pipeline without video-specific renderer code.
