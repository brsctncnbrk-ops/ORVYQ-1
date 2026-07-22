# ORVYQ-1

Clean, self-contained ORVYQ cinematic video production system.

Production code, workflows, and project assets remain repository-owned and do not depend on legacy repositories at runtime.

## Canonical rebuild

The production system is being rebuilt from the clean repository initialization commit on branch `agent/orvyq-canonical-rebuild`.

Normative documents:

- [Quality contract](docs/quality-contract.md)
- [Canonical architecture](docs/architecture.md)
- [Legacy migration policy](docs/migration-policy.md)
- [Active rebuild roadmap](docs/rebuild-plan.md)

The superseded initial implementation and rejected proof are preserved only for audit and migration reference. They are not part of the canonical branch history.

## Non-negotiable rules

- one canonical full-film production plan,
- proof is a semantic prefix of that plan,
- real primary-source pixels rather than generated evidence cards,
- deterministic pre-render audio mix with music and narration ducking,
- brightness, pacing, semantic and mobile-legibility quality gates,
- no full render without explicit human approval of the exact frozen candidate,
- no video-specific patches or self-modifying workflows.
