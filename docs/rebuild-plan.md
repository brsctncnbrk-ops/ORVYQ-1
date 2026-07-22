# ORVYQ Canonical Rebuild Roadmap

Status: **active**

Branch: `agent/orvyq-canonical-rebuild`

The rebuild starts from the clean repository initialization commit. The superseded implementation is read-only reference material and is not part of this branch history.

## Phase 0 — Reset and contracts

- [x] Reject and close the noncanonical proof implementation.
- [x] Create a clean branch from `main`.
- [x] Define the quality contract.
- [x] Define the canonical architecture.
- [x] Define the legacy migration policy.

Exit condition: architecture and quality rules exist before production code.

## Phase 1 — Core contracts and state machine

- [ ] Package and runtime baseline.
- [ ] Structured ORVYQ error contract.
- [ ] Deterministic JSON and SHA utilities.
- [ ] Safe repository/project paths.
- [ ] Manifest schema.
- [ ] Source, claim, evidence, asset, timeline, audio, plan and candidate schemas.
- [ ] State-machine transition tests.
- [ ] Single CLI entry point.

Exit condition: invalid stage transitions and malformed contracts fail closed.

## Phase 2 — Research and evidence engine

- [ ] Source catalog builder and validator.
- [ ] Claim registry and qualification.
- [ ] Claim-to-evidence map.
- [ ] Primary-source acquisition contract.
- [ ] PDF/page/figure/screen capture registration.
- [ ] Placeholder-evidence rejection.
- [ ] Provenance and usage-basis validation.
- [ ] Evidence authenticity tests.

Exit condition: every primary claim has genuine registered source pixels or an explicit nonvisual treatment.

## Phase 3 — Asset and media system

- [ ] Repository-owned media registration.
- [ ] FFprobe metadata and integrity checks.
- [ ] LFS binary checks.
- [ ] License/provenance contract.
- [ ] Footage semantic-purpose contract.
- [ ] Music/SFX approval contract.

Exit condition: no unregistered or unverifiable asset can enter a candidate.

## Phase 4 — Direction and canonical plan

- [ ] Visual style bible.
- [ ] Reusable scene-family grammar.
- [ ] Storyboard contract.
- [ ] Semantic pacing rules.
- [ ] Evidence/context alternation rules.
- [ ] Editorial pause model.
- [ ] One full-film production plan.
- [ ] Semantic proof-boundary selection.

Exit condition: proof is a representative prefix of the single full plan.

## Phase 5 — Audio engine

- [ ] Narration registration and alignment.
- [ ] Music cue sheet.
- [ ] Four-or-more energy states for full films.
- [ ] Narration ducking automation.
- [ ] Editorial pause integration.
- [ ] Deterministic final mix.
- [ ] Loudness, true-peak, audible-music and ducking QA.

Exit condition: renderer consumes one validated final mix; optional runtime music is impossible.

## Phase 6 — Generic Remotion renderer

- [ ] Cinematic hook and contextual footage.
- [ ] Primary document and split document.
- [ ] Official figure, official screen and source article.
- [ ] Image sequence, evidence chain and source timeline.
- [ ] Source-derived comparison/process graphics.
- [ ] Limitation, editorial pause and brand treatments.
- [ ] Mobile captions and source labels.
- [ ] Brightness-safe motion and transitions.

Exit condition: no renderer component contains project-specific branches.

## Phase 7 — QA and runtime

- [ ] Static contract QA.
- [ ] Semantic visual QA.
- [ ] Pacing and motif-reuse QA.
- [ ] Brightness, black-frame and flash QA.
- [ ] Mobile-legibility QA.
- [ ] Proof representativeness QA.
- [ ] Candidate freezing and digest manifest.
- [ ] Proof approval identity.
- [ ] Full-render candidate-drift rejection.

Exit condition: technical success cannot mask missing music, fake evidence, darkening, or editorial failure.

## Phase 8 — GitHub workflows

Only these permanent workflows may exist:

- [ ] `ci.yml`
- [ ] `proof.yml`
- [ ] `full-render.yml`

Exit condition: manual proof/full workflows use exact candidate identity; no temporary request file or self-modifying workflow exists.

## Phase 9 — First film migration

For `001-ai-race`:

- [ ] Import approved NotebookLM material, research, script, voice script and narration.
- [ ] Import approved footage/music with provenance.
- [ ] Reacquire/register genuine primary evidence.
- [ ] Rebuild claim registry, evidence map and asset registry.
- [ ] Rebuild audio mix, storyboard and canonical production plan.
- [ ] Generate all QA outputs from the new implementation.
- [ ] Freeze first candidate.

Exit condition: none of the rejected proof’s plans, fake evidence cards, PASS files or repair scripts seed the candidate.

## Phase 10 — Representative proof and final film

- [ ] Render proof with all required scene families.
- [ ] Verify audible music and ducking.
- [ ] Verify real documents/figures/screens.
- [ ] Verify brightness and pacing.
- [ ] Human review and explicit approval.
- [ ] Render full film from exact approved candidate.
- [ ] Run final QA and publish downloadable artifact.

## Final acceptance

The rebuild is complete only when a second project can enter the same pipeline without project-specific renderer code or workflow changes.
