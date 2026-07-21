import {invariant} from '../core/errors.mjs';
import {array, boolean, enumValue, indexBy, number, object, repositoryRelativePath, string} from './common.mjs';

export const SHOT_TYPES = Object.freeze([
  'cinematic_hook',
  'contextual_footage',
  'primary_document',
  'split_documents',
  'official_figure',
  'official_screen',
  'official_article',
  'image_sequence',
  'source_timeline',
  'evidence_chain',
  'source_derived_graphic',
  'comparison_graphic',
  'process_graphic',
  'limitation_treatment',
  'editorial_pause',
  'brand_open',
  'brand_close'
]);

const PRIMARY_TYPES = new Set(['primary_document', 'split_documents', 'official_figure', 'official_screen', 'official_article', 'image_sequence']);
const EVIDENCE_TYPES = new Set([...PRIMARY_TYPES, 'source_timeline', 'evidence_chain', 'source_derived_graphic', 'comparison_graphic', 'process_graphic', 'limitation_treatment']);
const CONTEXT_TYPES = new Set(['cinematic_hook', 'contextual_footage']);
const REPRESENTATIVE_PROOF_TYPES = [
  'cinematic_hook',
  'primary_document',
  'official_figure',
  'contextual_footage',
  'source_derived_graphic',
  'limitation_treatment',
  'editorial_pause'
];

function overlap(shot, start, end) {
  return Math.max(0, Math.min(shot.end_frame, end) - Math.max(shot.start_frame, start));
}

export function validateProductionPlan(plan, {claimRegistry, evidenceRegistry, assetRegistry, audioPlan, minimumDurationSeconds = 600} = {}) {
  object(plan, 'PRODUCTION_PLAN_INVALID', 'Production plan must be an object');
  invariant(plan.schema_version === '1.0', 'PRODUCTION_PLAN_SCHEMA', 'Production plan schema_version must be 1.0');
  string(plan.project_id, 'PRODUCTION_PLAN_PROJECT', 'Production plan project_id is required');
  number(plan.fps, 'PRODUCTION_FPS_INVALID', 'FPS must be 24, 25 or 30', {integer: true});
  invariant([24, 25, 30].includes(plan.fps), 'PRODUCTION_FPS_INVALID', 'FPS must be 24, 25 or 30');
  number(plan.width, 'PRODUCTION_WIDTH_INVALID', 'Width must be at least 1920', {min: 1920, integer: true});
  number(plan.height, 'PRODUCTION_HEIGHT_INVALID', 'Height must be at least 1080', {min: 1080, integer: true});
  number(plan.full_frame_count, 'PRODUCTION_FRAME_COUNT_INVALID', 'Full frame count must be positive', {min: 1, integer: true});
  number(plan.full_duration_seconds, 'PRODUCTION_DURATION_INVALID', 'Full duration must meet minimum', {min: minimumDurationSeconds});
  invariant(Math.abs(plan.full_frame_count / plan.fps - plan.full_duration_seconds) <= 0.05, 'PRODUCTION_DURATION_MISMATCH', 'Frame count and duration disagree');
  number(plan.proof_boundary_frame, 'PROOF_BOUNDARY_FRAME_INVALID', 'Proof boundary frame must be positive', {min: plan.fps * 150, max: plan.full_frame_count, integer: true});
  const sections = array(plan.sections, 'PRODUCTION_SECTIONS_EMPTY', 'Production plan requires sections', {min: 2});
  indexBy(sections, 'section_id', 'SECTION_ID_DUPLICATE', 'production sections');
  let sectionCursor = 0;
  for (const section of sections) {
    string(section.section_id, 'SECTION_ID_REQUIRED', 'Section ID is required');
    string(section.title, 'SECTION_TITLE_REQUIRED', `${section.section_id} title is required`);
    number(section.start_frame, 'SECTION_START_INVALID', `${section.section_id} start_frame is invalid`, {min: sectionCursor, integer: true});
    invariant(section.start_frame === sectionCursor, 'SECTION_GAP_OR_OVERLAP', `${section.section_id} must start at ${sectionCursor}`);
    number(section.end_frame, 'SECTION_END_INVALID', `${section.section_id} end_frame is invalid`, {min: section.start_frame + 1, integer: true});
    sectionCursor = section.end_frame;
  }
  invariant(sectionCursor === plan.full_frame_count, 'SECTION_COVERAGE_INCOMPLETE', 'Sections must cover the full film');
  const shots = array(plan.shots, 'PRODUCTION_SHOTS_EMPTY', 'Production plan requires shots', {min: 1});
  indexBy(shots, 'shot_id', 'SHOT_ID_DUPLICATE', 'production shots');
  const claimIds = new Set(claimRegistry?.claims?.map((claim) => claim.claim_id) ?? []);
  const evidenceIds = new Set(evidenceRegistry?.evidence?.map((item) => item.evidence_id) ?? []);
  const assetIds = new Set(assetRegistry?.assets?.map((asset) => asset.asset_id) ?? []);
  let cursor = 0;
  let evidenceChainFrames = 0;
  const typeFrames = new Map();
  const assetUse = new Map();
  const motifUse = new Map();
  for (const shot of shots) {
    object(shot, 'SHOT_INVALID', 'Shot must be an object');
    string(shot.shot_id, 'SHOT_ID_REQUIRED', 'shot_id is required');
    enumValue(shot.shot_type, SHOT_TYPES, 'SHOT_TYPE_INVALID', `${shot.shot_id} shot_type is invalid`);
    number(shot.start_frame, 'SHOT_START_INVALID', `${shot.shot_id} start_frame is invalid`, {min: cursor, integer: true});
    invariant(shot.start_frame === cursor, 'SHOT_GAP_OR_OVERLAP', `${shot.shot_id} must start at ${cursor}`);
    number(shot.end_frame, 'SHOT_END_INVALID', `${shot.shot_id} end_frame is invalid`, {min: shot.start_frame + 1, integer: true});
    const duration = (shot.end_frame - shot.start_frame) / plan.fps;
    invariant(duration >= 1.5 || shot.shot_type === 'brand_close', 'SHOT_TOO_SHORT', `${shot.shot_id} is shorter than 1.5 seconds`);
    invariant(duration <= 8.01, 'SHOT_TOO_LONG', `${shot.shot_id} exceeds 8 seconds`);
    string(shot.editorial_purpose, 'SHOT_PURPOSE_REQUIRED', `${shot.shot_id} editorial_purpose is required`, {min: 12});
    string(shot.motif_id, 'SHOT_MOTIF_REQUIRED', `${shot.shot_id} motif_id is required`);
    motifUse.set(shot.motif_id, (motifUse.get(shot.motif_id) ?? 0) + 1);
    const ids = array(shot.claim_ids, 'SHOT_CLAIM_IDS_INVALID', `${shot.shot_id} claim_ids must be an array`);
    for (const id of ids) if (claimRegistry) invariant(claimIds.has(id), 'SHOT_CLAIM_UNKNOWN', `${shot.shot_id} references unknown claim ${id}`);
    const shotEvidence = array(shot.evidence_ids ?? [], 'SHOT_EVIDENCE_IDS_INVALID', `${shot.shot_id} evidence_ids must be an array`);
    for (const id of shotEvidence) if (evidenceRegistry) invariant(evidenceIds.has(id), 'SHOT_EVIDENCE_UNKNOWN', `${shot.shot_id} references unknown evidence ${id}`);
    const shotAssets = array(shot.asset_ids ?? [], 'SHOT_ASSET_IDS_INVALID', `${shot.shot_id} asset_ids must be an array`);
    for (const id of shotAssets) {
      if (assetRegistry) invariant(assetIds.has(id), 'SHOT_ASSET_UNKNOWN', `${shot.shot_id} references unknown asset ${id}`);
      assetUse.set(id, (assetUse.get(id) ?? 0) + 1);
    }
    if (PRIMARY_TYPES.has(shot.shot_type)) invariant(shotEvidence.length > 0, 'PRIMARY_SHOT_EVIDENCE_MISSING', `${shot.shot_id} primary evidence shot requires evidence_ids`);
    if (CONTEXT_TYPES.has(shot.shot_type)) invariant(shot.evidence_claim !== true, 'CONTEXTUAL_AS_LITERAL_EVIDENCE', `${shot.shot_id} cannot present contextual footage as literal evidence`);
    if (shot.shot_type === 'editorial_pause') {
      boolean(shot.captions_suppressed, 'EDITORIAL_PAUSE_CAPTION_POLICY', `${shot.shot_id} captions_suppressed must be boolean`);
      invariant(shot.captions_suppressed, 'EDITORIAL_PAUSE_CAPTIONS_VISIBLE', `${shot.shot_id} must suppress captions`);
    }
    evidenceChainFrames = EVIDENCE_TYPES.has(shot.shot_type) ? evidenceChainFrames + (shot.end_frame - shot.start_frame) : 0;
    invariant(evidenceChainFrames / plan.fps <= 15.01, 'EVIDENCE_CHAIN_TOO_LONG', `Evidence/document chain exceeds 15 seconds at ${shot.shot_id}`);
    typeFrames.set(shot.shot_type, (typeFrames.get(shot.shot_type) ?? 0) + (shot.end_frame - shot.start_frame));
    cursor = shot.end_frame;
  }
  invariant(cursor === plan.full_frame_count, 'SHOT_COVERAGE_INCOMPLETE', 'Shots must cover the full film');
  const closes = shots.filter((shot) => shot.shot_type === 'brand_close');
  invariant(closes.length === 1 && closes[0] === shots.at(-1), 'BRAND_CLOSE_POSITION', 'Exactly one brand_close must be the final shot');
  invariant(shots.some((shot) => shot.end_frame === plan.proof_boundary_frame), 'PROOF_BOUNDARY_NOT_SHOT_END', 'Proof boundary must be a shot boundary');
  const proofShots = shots.filter((shot) => shot.start_frame < plan.proof_boundary_frame);
  for (const requiredType of REPRESENTATIVE_PROOF_TYPES) invariant(proofShots.some((shot) => shot.shot_type === requiredType), 'PROOF_NOT_REPRESENTATIVE', `Proof must contain ${requiredType}`);
  const proofTypes = new Set(proofShots.map((shot) => shot.shot_type));
  invariant(proofTypes.size >= 7, 'PROOF_VISUAL_VARIETY_LOW', 'Proof requires at least seven distinct shot types');
  const total = plan.full_frame_count;
  const evidenceFrames = [...typeFrames].filter(([type]) => EVIDENCE_TYPES.has(type)).reduce((sum, [, frames]) => sum + frames, 0);
  const contextualFrames = [...typeFrames].filter(([type]) => CONTEXT_TYPES.has(type)).reduce((sum, [, frames]) => sum + frames, 0);
  invariant(evidenceFrames / total >= 0.5 && evidenceFrames / total <= 0.68, 'EVIDENCE_FRACTION_INVALID', 'Evidence and source-derived graphics must occupy 50–68% of the film');
  invariant(contextualFrames / total >= 0.25 && contextualFrames / total <= 0.4, 'CONTEXTUAL_FRACTION_INVALID', 'Contextual footage must occupy 25–40% of the film');
  for (const [assetId, uses] of assetUse) invariant(uses <= 3, 'ASSET_REUSE_EXCESSIVE', `${assetId} is used ${uses} times`);
  for (const [motifId, uses] of motifUse) invariant(uses <= 3, 'MOTIF_REUSE_EXCESSIVE', `${motifId} is used ${uses} times`);
  if (audioPlan) invariant(audioPlan.output_asset === plan.audio_mix_asset, 'PLAN_AUDIO_MIX_MISMATCH', 'Production plan must reference the canonical final audio mix');
  repositoryRelativePath(plan.audio_mix_asset, 'PLAN_AUDIO_MIX_PATH_INVALID', 'Production plan audio_mix_asset');
  return plan;
}

export function summarizeRange(plan, startFrame, endFrame) {
  const shots = plan.shots.filter((shot) => shot.start_frame < endFrame && shot.end_frame > startFrame);
  const totals = {};
  for (const shot of shots) totals[shot.shot_type] = (totals[shot.shot_type] ?? 0) + overlap(shot, startFrame, endFrame) / plan.fps;
  return {duration_seconds: (endFrame - startFrame) / plan.fps, shot_count: shots.length, shot_type_seconds: totals};
}
