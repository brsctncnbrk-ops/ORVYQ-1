# ORVYQ-1

Self-contained, deterministic ORVYQ cinematic video-production system.

## Guarantees

- One repository, one root CLI, one project manifest, one full-film production plan, and one narration timeline.
- NotebookLM is used only for topic and claim discovery. Section C is retained only for final originality comparison and is never passed into research or script generation.
- Proof is a semantic prefix of the frozen full-film composition. No proof-only cut, asset, overlay, caption set, or renderer exists.
- Full narration, alignment, storyboard, assets, provenance, captions, and full render input must be complete before proof.
- Proof and full render are bound to the same immutable 40-character candidate commit SHA and prefix digest.
- No runtime access to legacy repositories, artifacts, workflows, LFS stores, or materializers.
- Only `.github/workflows/ci.yml`, `.github/workflows/proof.yml`, and `.github/workflows/full-render.yml` are allowed.

## Root CLI

```bash
npm run orvyq -- new --project-id 002-example --source-url "https://youtube.com/watch?v=..." --minimum-minutes 10
npm run orvyq -- status --project-id 002-example
npm run orvyq -- questions --project-id 002-example
npm run orvyq -- ingest-notebooklm --project-id 002-example --file notebooklm_answers.md
npm run orvyq -- next --project-id 002-example
npm run orvyq -- retry --project-id 002-example
npm run orvyq -- validate --project-id 002-example
npm run orvyq -- smoke
npm run orvyq -- proof --project-id 002-example --candidate-sha <40-char-sha> --proof-run-id <run-id>
npm run orvyq -- full --project-id 002-example --candidate-sha <40-char-sha> --approved-proof-run-id <run-id> --proof-manifest <path>
```

All state changes are made by this CLI. Do not edit `manifest.json` manually.

## Project contract

Every project lives in `projects/<project_id>/`. Required production media is physically stored under its own `assets/` directory and registered in `assets/asset_registry.json` with SHA-256, byte size, media metadata, provenance, license, editorial purpose, claim IDs, and final-edit approval.

The system reports operation outcomes only as: `TAMAMLANDI`, `BAŞARISIZ`, `DOĞRULANMADI`, `YAPILMADI`, or `BLOKE`.
