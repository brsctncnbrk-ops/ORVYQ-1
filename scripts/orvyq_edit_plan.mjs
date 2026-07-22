#!/usr/bin/env node
import path from "node:path";
import { projectDir, readJson, writeJsonAtomic, pathExists } from "./lib/fs-utils.mjs";
import { loadResolvedEvidenceMap } from "./lib/orvyq-evidence.mjs";
import { buildOrvyqPreviewPlan } from "./orvyq_preview_plan.mjs";

const PROJECT_ID = "001-the-ai-race-no-one-can-afford-to-win";
const ALLOWED_ROLES = new Set(["evidence", "archive", "context", "metaphor", "graphic"]);
const ALLOWED_TRANSITIONS = new Set(["cut", "fade", "dissolve"]);

function round(value) {
  return Math.round(value * 1000) / 1000;
}

export async function buildOrvyqEditPlan(projectId = PROJECT_ID) {
  const previewFrames = Number.parseInt(process.env.ORVYQ_PREVIEW_FRAMES || "0", 10);
  if (previewFrames > 0) return buildOrvyqPreviewPlan(projectId);

  const dir = projectDir(projectId);
  const [composition, blueprint, evidenceMap] = await Promise.all([
    readJson(path.join(dir, "remotion", "composition.json")),
    readJson(path.join(dir, "direction", "editorial_blueprint.json")),
    loadResolvedEvidenceMap(dir),
  ]);

  const full = blueprint.full_production;
  const unresolved = evidenceMap.claims.filter((claim) => ["rewrite_required", "source_required"].includes(claim.status));
  const unresolvedIds = new Set(unresolved.map((claim) => claim.claim_id));
  const activeDeclaredBlockers = (full.blocking_claim_ids || []).filter((claimId) => unresolvedIds.has(claimId));
  if (full.status !== "ready") throw new Error(`Full ORVYQ edit is blocked: full_production.status=${full.status}`);
  if (activeDeclaredBlockers.length || unresolved.length) throw new Error(`Full ORVYQ edit is blocked by unresolved claims: ${[...activeDeclaredBlockers, ...unresolved.map((claim) => claim.claim_id)].join(", ")}`);
  if (!Array.isArray(full.shots) || !full.shots.length) throw new Error("Full ORVYQ edit requires an explicit full_production.shots array; automatic footage fallback is forbidden");

  const claimIds = new Set(evidenceMap.claims.filter((claim) => claim.status !== "removed").map((claim) => claim.claim_id));
  const sourceUsage = new Map();
  let cursor = 0;
  const shots = [];

  for (let index = 0; index < full.shots.length; index += 1) {
    const spec = full.shots[index];
    const duration = Number(spec.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > blueprint.global_rules.max_shot_seconds) throw new Error(`full_production.shots[${index}] has invalid duration ${spec.duration}`);
    if (!claimIds.has(spec.claim_id)) throw new Error(`full_production.shots[${index}] has unknown or removed claim_id ${spec.claim_id}`);
    if (!ALLOWED_ROLES.has(spec.visual_role)) throw new Error(`full_production.shots[${index}] has invalid visual_role ${spec.visual_role}`);
    if (!spec.editorial_purpose || spec.editorial_purpose.length < 18) throw new Error(`full_production.shots[${index}] needs a specific editorial_purpose`);

    const startFrame = Math.round(cursor * composition.fps);
    cursor += duration;
    const endFrame = Math.round(cursor * composition.fps);
    const transitionIn = spec.transition_in || (index === 0 ? "fade" : "cut");
    const transitionOut = spec.transition_out || (index === full.shots.length - 1 ? "fade" : "cut");
    if (!ALLOWED_TRANSITIONS.has(transitionIn) || !ALLOWED_TRANSITIONS.has(transitionOut)) throw new Error(`full_production.shots[${index}] has an invalid transition`);

    const common = {
      shot_id: `shot_${String(index + 1).padStart(3, "0")}`,
      scene_id: spec.scene_id,
      section_id: spec.section_id,
      start_frame: startFrame,
      end_frame: endFrame,
      claim_id: spec.claim_id,
      visual_role: spec.visual_role,
      generic_stock: spec.generic_stock === true,
      editorial_purpose: spec.editorial_purpose,
      editorial_overlay: spec.overlay || null,
      motif: spec.motif || spec.asset || spec.graphic?.type,
      transition_in: transitionIn,
      transition_out: transitionOut,
      text_overlay: null,
      sound_cue: null,
    };

    if (spec.asset_type === "graphic") {
      if (!spec.graphic?.title) throw new Error(`full_production.shots[${index}] graphic requires a title`);
      shots.push({ ...common, asset_type: "graphic", graphic: spec.graphic });
      continue;
    }

    if (spec.asset_type !== "footage" || !spec.asset) throw new Error(`full_production.shots[${index}] must explicitly declare a footage asset or graphic`);
    if (!(await pathExists(path.join(dir, spec.asset)))) throw new Error(`Missing full-edit asset: ${spec.asset}`);
    sourceUsage.set(spec.asset, (sourceUsage.get(spec.asset) || 0) + 1);
    if (sourceUsage.get(spec.asset) > blueprint.global_rules.max_uses_per_source) throw new Error(`${spec.asset} exceeds the ${blueprint.global_rules.max_uses_per_source}-use limit`);
    const trimIn = Number(spec.trim_in_sec || 0);
    const trimOut = Number(spec.trim_out_sec || trimIn + duration);
    if (Math.abs((trimOut - trimIn) - duration) > 0.02) throw new Error(`full_production.shots[${index}] trim does not match timeline duration`);
    shots.push({ ...common, asset_type: "footage", video_asset: spec.asset, trim_in_sec: round(trimIn), trim_out_sec: round(trimOut), motion_variant: spec.motion || "hold" });
  }

  if (Math.abs(cursor * composition.fps - composition.duration_frames) > 1) throw new Error(`Explicit full edit totals ${cursor.toFixed(3)}s, but composition is ${(composition.duration_frames / composition.fps).toFixed(3)}s`);

  const plan = {
    schema_version: "5.1-evidence-led-full",
    project_id: projectId,
    fps: composition.fps,
    duration_frames: composition.duration_frames,
    preview: false,
    production_mode: blueprint.production_mode,
    resolved_evidence_schema: evidenceMap.schema_version,
    audio_mix_asset: "assets/audio/final_mix.mp3",
    captions_asset: "remotion/captions.json",
    art_direction: { principle: "evidence first, context second, metaphor only after the claim is established" },
    quality_policy: { ...blueprint.global_rules, keyword_only_visual_matching_forbidden: true, fake_data_graphics_forbidden: true, unrelated_stock_fallback_forbidden: true },
    blacklisted_assets: [],
    source_usage: Object.fromEntries([...sourceUsage.entries()].sort((a, b) => b[1] - a[1])),
    shots,
  };

  await writeJsonAtomic(path.join(dir, "direction", "edit_plan.json"), plan);
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildOrvyqEditPlan().then((plan) => console.log(JSON.stringify({ ok: true, preview: plan.preview, production_mode: plan.production_mode, shot_count: plan.shots.length, output: "direction/edit_plan.json" }))).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}
