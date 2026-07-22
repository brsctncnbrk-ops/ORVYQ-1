import {access, readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {OrvyqError, invariant} from '../core/errors.mjs';
import {readJson, sha256Bytes, sha256Json, writeJsonAtomic} from '../core/json.mjs';
import {safeProjectPath} from '../core/paths.mjs';
import {loadManifest} from './manifest.mjs';
import {validateSourceCatalog} from './source-catalog.mjs';
import {validateClaimRegistry} from './claim-registry.mjs';
import {auditEvidenceFiles, validateEvidenceRegistry} from './evidence-registry.mjs';
import {auditAssetFiles, validateAssetRegistry} from './asset-registry.mjs';
import {validateNarrationTimeline} from './narration-timeline.mjs';
import {validateAudioPlan} from './audio-plan.mjs';
import {validateProductionPlan} from './production-plan.mjs';
import {CANDIDATE_DIGEST_KEYS, validateCandidate} from './candidate.mjs';
import {editorialPauseQa, mobileLegibilityQa, musicCueQa, pacingQa, semanticVisualQa} from '../qa/static.mjs';

async function requiredJson(projectId, relative, code) {
  try { return await readJson(safeProjectPath(projectId, relative)); }
  catch (error) {
    if (error?.code === 'ENOENT') throw new OrvyqError(code, `Required project file is missing: ${relative}`);
    throw error;
  }
}
async function requiredFile(projectId, relative, code) {
  const file = safeProjectPath(projectId, relative);
  try { await access(file, constants.R_OK); return file; }
  catch (error) { if (error?.code === 'ENOENT') throw new OrvyqError(code, `Required project file is missing: ${relative}`); throw error; }
}

export async function loadCanonicalContracts(projectId) {
  const manifest = await loadManifest(projectId);
  const sourceCatalog = validateSourceCatalog(await requiredJson(projectId, 'research/source_catalog.json', 'SOURCE_CATALOG_MISSING'));
  const claimRegistry = validateClaimRegistry(await requiredJson(projectId, 'research/claim_registry.json', 'CLAIM_REGISTRY_MISSING'), {sourceCatalog});
  const evidenceRegistry = validateEvidenceRegistry(await requiredJson(projectId, 'evidence/evidence_registry.json', 'EVIDENCE_REGISTRY_MISSING'), {sourceCatalog, claimRegistry});
  const assetRegistry = validateAssetRegistry(await requiredJson(projectId, 'assets/asset_registry.json', 'ASSET_REGISTRY_MISSING'));
  const narrationTimeline = validateNarrationTimeline(await requiredJson(projectId, 'direction/narration_timeline.json', 'NARRATION_TIMELINE_MISSING'));
  const audioPlan = validateAudioPlan(await requiredJson(projectId, 'audio/audio_plan.json', 'AUDIO_PLAN_MISSING'), {durationSeconds: narrationTimeline.transformed_duration_seconds});
  const productionPlan = validateProductionPlan(await requiredJson(projectId, 'direction/production_plan.json', 'PRODUCTION_PLAN_MISSING'), {claimRegistry,evidenceRegistry,assetRegistry,audioPlan,minimumDurationSeconds: manifest.minimum_duration_seconds});
  invariant(productionPlan.project_id === projectId && sourceCatalog.project_id === projectId && claimRegistry.project_id === projectId && evidenceRegistry.project_id === projectId && assetRegistry.project_id === projectId && narrationTimeline.project_id === projectId && audioPlan.project_id === projectId, 'PROJECT_ID_MISMATCH', 'All canonical contracts must use the same project_id');
  invariant(Math.abs(productionPlan.full_duration_seconds - narrationTimeline.transformed_duration_seconds) <= 0.05, 'PLAN_TIMELINE_DURATION_MISMATCH', 'Production plan and narration timeline duration disagree');
  invariant(productionPlan.proof_boundary_frame === narrationTimeline.proof_boundary.frame, 'PROOF_BOUNDARY_MISMATCH', 'Production plan and narration timeline proof boundary disagree');
  return {manifest, sourceCatalog, claimRegistry, evidenceRegistry, assetRegistry, narrationTimeline, audioPlan, productionPlan};
}

export async function buildRenderInput(projectId, contracts) {
  const captions = await requiredJson(projectId, 'direction/captions.json', 'CAPTIONS_MISSING');
  invariant(captions.schema_version === '1.0' && Array.isArray(captions.captions), 'CAPTIONS_INVALID', 'Captions contract is invalid');
  const renderInput = {schema_version: '1.0', project_id: projectId, plan: contracts.productionPlan, timeline: contracts.narrationTimeline, evidence: contracts.evidenceRegistry.evidence, assets: contracts.assetRegistry.assets, captions: captions.captions, audio_mix_asset: contracts.audioPlan.output_asset};
  await writeJsonAtomic(safeProjectPath(projectId, 'build/render_input.json'), renderInput);
  return renderInput;
}

function runCandidateStaticQa(contracts) {
  return {
    semantic: semanticVisualQa(contracts),
    pacing: pacingQa(contracts.productionPlan),
    mobile: mobileLegibilityQa(contracts.productionPlan),
    music: musicCueQa(contracts.audioPlan, contracts.narrationTimeline),
    pauses: editorialPauseQa(contracts.narrationTimeline, contracts.productionPlan)
  };
}

export async function validateProject(projectId, {auditFiles = true, writeReports = true} = {}) {
  const contracts = await loadCanonicalContracts(projectId);
  const evidenceAudit = auditFiles ? await auditEvidenceFiles(projectId, contracts.evidenceRegistry) : {status: 'SKIPPED'};
  const assetAudit = auditFiles ? await auditAssetFiles(projectId, contracts.assetRegistry) : {status: 'SKIPPED'};
  const mixFile = await requiredFile(projectId, contracts.audioPlan.output_asset, 'FINAL_AUDIO_MIX_MISSING');
  const mixBytes = await readFile(mixFile);
  const mixSha = sha256Bytes(mixBytes);
  const mixAsset = contracts.assetRegistry.assets.find((asset) => asset.role === 'final_audio_mix');
  invariant(mixAsset, 'FINAL_AUDIO_MIX_UNREGISTERED', 'Asset registry requires final_audio_mix before candidate validation');
  invariant(mixAsset.relative_path === contracts.audioPlan.output_asset && mixAsset.sha256 === mixSha, 'FINAL_AUDIO_MIX_DRIFT', 'Final audio mix does not match audio plan and asset registry');
  const staticQa = runCandidateStaticQa(contracts);
  const renderInput = await buildRenderInput(projectId, contracts);
  const report = {
    schema_version: '1.0', status: 'TAMAMLANDI', project_id: projectId, validated_at: new Date().toISOString(),
    digests: {source_catalog_sha256: sha256Json(contracts.sourceCatalog), claim_registry_sha256: sha256Json(contracts.claimRegistry), evidence_registry_sha256: sha256Json(contracts.evidenceRegistry), asset_registry_sha256: sha256Json(contracts.assetRegistry), narration_timeline_sha256: sha256Json(contracts.narrationTimeline), audio_plan_sha256: sha256Json(contracts.audioPlan), audio_mix_sha256: mixSha, production_plan_sha256: sha256Json(contracts.productionPlan), render_input_sha256: sha256Json(renderInput)},
    evidence_audit: evidenceAudit, asset_audit: assetAudit,
    static_qa: {semantic: staticQa.semantic.status, pacing: staticQa.pacing.status, mobile: staticQa.mobile.status, music: staticQa.music.status, pauses: staticQa.pauses.status}
  };
  if (writeReports) {
    await Promise.all([
      writeJsonAtomic(safeProjectPath(projectId, 'qa/candidate_preflight.json'), report),
      writeJsonAtomic(safeProjectPath(projectId, 'qa/semantic_visual.json'), staticQa.semantic),
      writeJsonAtomic(safeProjectPath(projectId, 'qa/pacing.json'), staticQa.pacing),
      writeJsonAtomic(safeProjectPath(projectId, 'qa/mobile_legibility.json'), staticQa.mobile),
      writeJsonAtomic(safeProjectPath(projectId, 'qa/music_cues.json'), staticQa.music),
      writeJsonAtomic(safeProjectPath(projectId, 'qa/editorial_pauses.json'), staticQa.pauses)
    ]);
  }
  return {contracts, renderInput, report, staticQa};
}

function proofPrefix(renderInput) {
  const boundary = renderInput.plan.proof_boundary_frame;
  return {shots: renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).map((shot) => ({...shot, end_frame: Math.min(shot.end_frame, boundary)})), captions: renderInput.captions.filter((caption) => caption.start_frame < boundary).map((caption) => ({...caption, end_frame: Math.min(caption.end_frame, boundary)})), evidence_ids: [...new Set(renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).flatMap((shot) => shot.evidence_ids ?? []))].sort(), asset_ids: [...new Set(renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).flatMap((shot) => shot.asset_ids ?? []))].sort(), proof_boundary_frame: boundary};
}
function currentDigests(renderInput, report) { return {...report.digests, proof_prefix_sha256: sha256Json(proofPrefix(renderInput))}; }
export async function prepareCandidate(projectId) {
  const {renderInput, report} = await validateProject(projectId);
  const digests = currentDigests(renderInput, report);
  for (const key of CANDIDATE_DIGEST_KEYS) invariant(digests[key], 'CANDIDATE_DIGEST_MISSING', `Candidate digest missing: ${key}`);
  const prepared = {schema_version: '1.0', project_id: projectId, prepared_at: new Date().toISOString(), digests};
  await writeJsonAtomic(safeProjectPath(projectId, 'build/candidate_inputs.json'), prepared);
  return prepared;
}
export async function assertFrozenCandidate(projectId, candidateSha) {
  invariant(/^[0-9a-f]{40}$/.test(candidateSha), 'CANDIDATE_SHA_INVALID', 'candidate SHA must be a 40-character lowercase SHA');
  const prepared = await requiredJson(projectId, 'build/candidate_inputs.json', 'CANDIDATE_INPUTS_MISSING');
  invariant(prepared.schema_version === '1.0' && prepared.project_id === projectId && prepared.digests, 'CANDIDATE_INPUTS_INVALID', 'Prepared candidate inputs are invalid');
  const {renderInput, report} = await validateProject(projectId, {writeReports: false});
  const current = currentDigests(renderInput, report);
  for (const key of CANDIDATE_DIGEST_KEYS) invariant(prepared.digests[key] === current[key], 'CANDIDATE_CHANGED_AFTER_PREPARATION', `${key} changed after candidate preparation`);
  const candidate = validateCandidate({schema_version: '1.0', project_id: projectId, candidate_sha: candidateSha, frozen_at: prepared.prepared_at, digests: current});
  return {candidate, renderInput};
}
