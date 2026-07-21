import {invariant} from '../core/errors.mjs';
import {summarizeRange} from '../contracts/production-plan.mjs';

const PRIMARY_TYPES = new Set(['primary_document', 'split_documents', 'official_figure', 'official_screen', 'official_article', 'image_sequence']);
const CONTEXT_TYPES = new Set(['cinematic_hook', 'contextual_footage']);
const NONSEMANTIC_PURPOSE_WORDS = /\b(?:generic|filler|ratio|relief)\b/i;
const STOP_WORDS = new Set(['the','a','an','and','or','to','of','in','on','for','with','as','is','are','be','through','this','that','while','into','from','by','not','never']);

function semanticTokens(value = '') {
  return new Set(String(value).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function overlapScore(left, right) {
  const a = semanticTokens(left);
  const b = semanticTokens(right);
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const token of a) if (b.has(token)) matches += 1;
  return matches / Math.min(a.size, b.size);
}

export function semanticVisualQa({productionPlan, claimRegistry, evidenceRegistry, assetRegistry}) {
  const claims = new Map(claimRegistry.claims.map((claim) => [claim.claim_id, claim]));
  const evidence = new Map(evidenceRegistry.evidence.map((item) => [item.evidence_id, item]));
  const assets = new Map((assetRegistry?.assets ?? []).map((asset) => [asset.asset_id, asset]));
  const reports = [];
  const recentContextAssets = [];

  for (const shot of productionPlan.shots) {
    const shotClaims = (shot.claim_ids ?? []).map((id) => claims.get(id));
    invariant(shotClaims.every(Boolean), 'SEMANTIC_CLAIM_UNKNOWN', `${shot.shot_id} references an unknown claim`);
    if (PRIMARY_TYPES.has(shot.shot_type)) {
      invariant((shot.evidence_ids ?? []).length > 0, 'SEMANTIC_EVIDENCE_MISSING', `${shot.shot_id} has no primary evidence`);
      for (const evidenceId of shot.evidence_ids) {
        const item = evidence.get(evidenceId);
        invariant(item, 'SEMANTIC_EVIDENCE_UNKNOWN', `${shot.shot_id} references unknown evidence ${evidenceId}`);
        invariant(shot.claim_ids.some((claimId) => item.claim_ids.includes(claimId)), 'SEMANTIC_EVIDENCE_CLAIM_MISMATCH', `${shot.shot_id} evidence ${evidenceId} is not linked to any shot claim`);
      }
    }

    let semanticScore = null;
    if (CONTEXT_TYPES.has(shot.shot_type)) {
      invariant(shot.evidence_claim !== true, 'CONTEXTUAL_AS_LITERAL_EVIDENCE', `${shot.shot_id} presents contextual footage as literal evidence`);
      const contextAssets = (shot.asset_ids ?? []).map((id) => assets.get(id)).filter(Boolean);
      invariant(contextAssets.length > 0, 'CONTEXTUAL_ASSET_MISSING', `${shot.shot_id} requires contextual footage`);
      const intent = [shot.editorial_purpose, ...(shot.semantic_keywords ?? []), ...shotClaims.map((claim) => claim.summary ?? claim.claim ?? claim.text ?? '')].join(' ');
      const descriptor = contextAssets.map((asset) => [asset.editorial_purpose, asset.semantic_description, ...(asset.semantic_keywords ?? []), asset.source_url].filter(Boolean).join(' ')).join(' ');
      semanticScore = overlapScore(intent, descriptor);
      const explicitKeywords = (shot.semantic_keywords ?? []).length > 0 && contextAssets.every((asset) => (asset.semantic_keywords ?? []).length > 0);
      invariant(explicitKeywords || semanticScore >= 0.08, 'CONTEXTUAL_SEMANTIC_MISMATCH', `${shot.shot_id} footage has no defensible semantic connection to its editorial intent`);
      for (const asset of contextAssets) {
        invariant(!recentContextAssets.slice(-2).includes(asset.asset_id), 'CONTEXTUAL_ASSET_REPEATED_TOO_SOON', `${asset.asset_id} repeats within three contextual shots`);
        recentContextAssets.push(asset.asset_id);
      }
    }

    invariant(!NONSEMANTIC_PURPOSE_WORDS.test(shot.editorial_purpose), 'EDITORIAL_PURPOSE_NONSEMANTIC', `${shot.shot_id} editorial purpose describes a metric/filler rather than meaning`);
    reports.push({shot_id: shot.shot_id, status: 'TAMAMLANDI', claim_count: shotClaims.length, evidence_count: shot.evidence_ids?.length ?? 0, semantic_score: semanticScore});
  }
  return {schema_version: '1.0', status: 'TAMAMLANDI', shots: reports};
}

export function pacingQa(productionPlan) {
  const shotDurations = productionPlan.shots.map((shot) => ({shot_id: shot.shot_id, seconds: (shot.end_frame - shot.start_frame) / productionPlan.fps, shot_type: shot.shot_type}));
  const average = shotDurations.reduce((sum, shot) => sum + shot.seconds, 0) / shotDurations.length;
  invariant(average >= 2.8 && average <= 6.8, 'AVERAGE_SHOT_DURATION_INVALID', `Average shot duration ${average.toFixed(2)}s is outside 2.8–6.8s`);
  invariant(!shotDurations.some((shot) => shot.seconds < 1.5), 'FLASH_CUT_FORBIDDEN', 'Sub-1.5-second cuts are forbidden');
  const hookBoundary = Math.min(productionPlan.full_frame_count, productionPlan.fps * 15);
  const hook = productionPlan.shots.filter((shot) => shot.start_frame < hookBoundary);
  invariant(hook.length >= 3 && hook.length <= 7, 'HOOK_PACING_INVALID', 'First 15 seconds must contain 3–7 shots');
  invariant(hook.every((shot) => ['cinematic_hook', 'contextual_footage', 'brand_open'].includes(shot.shot_type)), 'HOOK_DOCUMENT_WALL', 'Opening hook cannot begin with documents or evidence cards');
  const windows = [];
  const size = productionPlan.fps * 30;
  const step = productionPlan.fps * 5;
  for (let start = 0; start + size <= productionPlan.full_frame_count; start += step) {
    const summary = summarizeRange(productionPlan, start, start + size);
    const types = Object.keys(summary.shot_type_seconds);
    invariant(types.length >= 3, 'PACING_WINDOW_MONOTONY', `30-second window at ${(start / productionPlan.fps).toFixed(1)}s has fewer than three visual classes`);
    windows.push({start_seconds: start / productionPlan.fps, ...summary});
  }
  return {schema_version: '1.0', status: 'TAMAMLANDI', average_shot_seconds: average, shot_count: shotDurations.length, shots: shotDurations, windows};
}

export function editorialPauseQa(timeline, productionPlan) {
  const pauses = timeline.editorial_pauses ?? [];
  invariant(pauses.length >= 2, 'EDITORIAL_PAUSE_COUNT_LOW', 'A long-form film requires at least two deliberate editorial pauses');
  let previousEnd = 0;
  const reports = [];
  for (const pause of pauses) {
    invariant(pause.duration_seconds >= 3 && pause.duration_seconds <= 6.5, 'EDITORIAL_PAUSE_DURATION_INVALID', `${pause.pause_id} must last 3–6.5 seconds`);
    invariant(pause.captions_suppressed === true, 'EDITORIAL_PAUSE_CAPTIONS_VISIBLE', `${pause.pause_id} must suppress captions`);
    invariant(String(pause.editorial_function ?? '').length >= 24, 'EDITORIAL_PAUSE_FUNCTION_WEAK', `${pause.pause_id} needs a specific editorial function`);
    invariant(String(pause.emphasis ?? '').trim().length >= 4, 'EDITORIAL_PAUSE_EMPHASIS_MISSING', `${pause.pause_id} needs a meaningful emphasis line`);
    invariant(pause.output_start_seconds - previousEnd >= 20 || previousEnd === 0, 'EDITORIAL_PAUSES_CLUSTERED', `${pause.pause_id} is too close to the previous pause`);
    const matchingShot = productionPlan.shots.find((shot) => shot.shot_type === 'editorial_pause' && shot.start_frame / productionPlan.fps <= pause.output_start_seconds + 0.15 && shot.end_frame / productionPlan.fps >= pause.output_end_seconds - 0.15);
    invariant(matchingShot, 'EDITORIAL_PAUSE_SHOT_MISSING', `${pause.pause_id} has no matching editorial_pause shot`);
    previousEnd = pause.output_end_seconds;
    reports.push({pause_id: pause.pause_id, duration_seconds: pause.duration_seconds, shot_id: matchingShot.shot_id, status: 'TAMAMLANDI'});
  }
  invariant(timeline.transformed_duration_seconds - pauses.at(-1).output_end_seconds <= 90, 'FINAL_EDITORIAL_PAUSE_TOO_EARLY', 'The final act needs a deliberate pause within the last 90 seconds');
  return {schema_version: '1.0', status: 'TAMAMLANDI', pause_count: pauses.length, pauses: reports};
}

export function mobileLegibilityQa(productionPlan) {
  const reports = [];
  for (const shot of productionPlan.shots) {
    const typography = shot.typography ?? {};
    if (shot.title) invariant((typography.title_px ?? 44) >= 40, 'MOBILE_TITLE_TOO_SMALL', `${shot.shot_id} title is below 40px`);
    if (shot.subtitle) invariant((typography.subtitle_px ?? 24) >= 22, 'MOBILE_SUBTITLE_TOO_SMALL', `${shot.shot_id} subtitle is below 22px`);
    if (shot.source_label) invariant((typography.source_px ?? 16) >= 15, 'MOBILE_SOURCE_TOO_SMALL', `${shot.shot_id} source label is below 15px`);
    const safe = shot.safe_area ?? {left: 64, right: 64, top: 48, bottom: 48};
    invariant(safe.left >= 48 && safe.right >= 48 && safe.top >= 36 && safe.bottom >= 36, 'MOBILE_SAFE_AREA_INVALID', `${shot.shot_id} violates safe area`);
    if (shot.title) invariant(shot.title.length <= 110, 'MOBILE_TITLE_TOO_LONG', `${shot.shot_id} title is too long`);
    if (shot.subtitle) invariant(shot.subtitle.length <= 190, 'MOBILE_SUBTITLE_TOO_LONG', `${shot.shot_id} subtitle is too long`);
    reports.push({shot_id: shot.shot_id, status: 'TAMAMLANDI'});
  }
  return {schema_version: '1.0', status: 'TAMAMLANDI', shots: reports};
}

export function musicCueQa(audioPlan, timeline) {
  const states = [...new Set(audioPlan.music_cues.map((cue) => cue.state))];
  invariant(states.length >= 4, 'MUSIC_STATE_VARIETY_LOW', 'At least four music states are required');
  invariant(audioPlan.music_cues[0].start_seconds === 0, 'MUSIC_CUE_START_GAP', 'Music cues must start at 0');
  let cursor = 0;
  for (const cue of audioPlan.music_cues) {
    invariant(Math.abs(cue.start_seconds - cursor) <= 0.02, 'MUSIC_CUE_GAP_OR_OVERLAP', `${cue.cue_id} does not start at ${cursor}`);
    cursor = cue.end_seconds;
  }
  invariant(Math.abs(cursor - timeline.transformed_duration_seconds) <= 0.5, 'MUSIC_CUE_COVERAGE_INCOMPLETE', 'Music cues do not cover the film');
  for (const pause of timeline.editorial_pauses) {
    invariant(audioPlan.music_cues.some((cue) => cue.start_seconds < pause.output_end_seconds && cue.end_seconds > pause.output_start_seconds), 'PAUSE_WITHOUT_MUSIC', `${pause.pause_id} is not covered by music`);
  }
  return {schema_version: '1.0', status: 'TAMAMLANDI', distinct_states: states, cue_count: audioPlan.music_cues.length, pause_count: timeline.editorial_pauses.length};
}
