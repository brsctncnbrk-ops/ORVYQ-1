# ORVYQ Legacy Migration Policy

Status: **normative**

The canonical rebuild may inspect legacy repositories, but legacy implementation history is not the production foundation.

## 1. Source repositories

Legacy repositories may be used only as read-only references for:

- approved raw project data,
- user-provided narration,
- licensed media,
- source captures,
- research material,
- proven general design decisions,
- renderer concepts that can be reimplemented generically,
- QA ideas that can be rewritten as stable contracts.

## 2. Allowed migration classes

### Raw editorial inputs

- NotebookLM A–E answers,
- research notes and source lists,
- approved script and voice script,
- final narration audio,
- approved licensed footage,
- approved licensed music and provenance,
- genuine primary-source captures,
- approved brand assets.

### Generalizable knowledge

- evidence presentation families,
- visual rhythm rules,
- music-state and ducking policy,
- brightness thresholds,
- pacing thresholds,
- mobile-legibility rules,
- proof/full identity principles.

Generalizable knowledge must be expressed in new contracts and clean implementation. It must not be copied as accumulated repair history.

## 3. Prohibited migration classes

The following must not be copied or cherry-picked:

- legacy workflow files,
- temporary trigger files,
- recovery or diagnostic scripts,
- repair-request mechanisms,
- self-modifying CI jobs,
- video-specific renderer branches,
- stale PASS reports,
- old production plans,
- old render inputs,
- old proof/full manifests,
- generated source-summary cards presented as evidence,
- sub-second contextual-relief planning,
- code that references a legacy repository at runtime.

## 4. First-video migration rules

For `001-ai-race`, preserve only approved raw inputs. Rebuild the following from canonical contracts:

- source catalog,
- claim registry,
- claim/evidence map,
- evidence registry,
- genuine evidence captures,
- asset registry,
- storyboard,
- visual plan,
- music cue sheet,
- final audio mix,
- canonical production plan,
- render input,
- candidate manifest,
- all QA reports.

The previous proof and all of its PASS files are rejected evidence and may not seed approval state.

## 5. Evidence authenticity

A migrated primary-evidence file must be checked against its source and registered with page/figure/region metadata. An SVG or image containing only newly written editorial prose is a source-derived graphic, never primary evidence.

## 6. Media provenance

Every migrated media file must have:

- repository-owned binary,
- SHA-256,
- byte size,
- duration/resolution/codec when applicable,
- source URL,
- license or usage basis,
- editorial purpose,
- approval state.

Missing provenance blocks migration.

## 7. No runtime legacy dependency

Production commands, workflows, tests, and renderers must succeed when legacy repositories are unavailable. URLs pointing to legacy GitHub repositories are forbidden as asset sources unless they are historical documentation and never used at runtime.

## 8. Migration acceptance

A migrated project is accepted only when:

- every retained file is classified as allowed,
- every retained binary passes integrity and provenance checks,
- every canonical plan and QA output is newly generated,
- no prohibited implementation file appears in the rebuild branch,
- the project passes the same contracts required for a brand-new project.
