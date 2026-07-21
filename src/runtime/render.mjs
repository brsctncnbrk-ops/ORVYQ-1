import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {invariant} from '../core/errors.mjs';
import {readJson, sha256Json, writeJsonAtomic} from '../core/json.mjs';
import {repoRoot, safeProjectPath} from '../core/paths.mjs';
import {assertFrozenCandidate} from '../contracts/project.mjs';
import {runStaticQa, runRenderedQa} from '../qa/run.mjs';

function run(command, args, code, {inherit = false} = {}) {
  const result = spawnSync(command, args, {encoding: inherit ? undefined : 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 128 * 1024 * 1024});
  invariant(result.status === 0, code, `${command} failed: ${result.stderr || result.stdout || ''}`);
  return result;
}

function assertCheckedOutSha(candidateSha) {
  const head = run('git', ['rev-parse', 'HEAD'], 'GIT_HEAD_FAILED').stdout.trim();
  invariant(head === candidateSha, 'CANDIDATE_SHA_MISMATCH', `Checked out ${head}, expected ${candidateSha}`);
}

function renderRemotion({propsFile, output, frames}) {
  const args = ['remotion', 'render', 'src/render/index.ts', 'ORVYQVideo', output, `--props=${propsFile}`, '--public-dir=.', '--concurrency=1', '--max-retries=3', '--codec=h264', '--audio-codec=aac', '--crf=17', '--pixel-format=yuv420p'];
  if (frames) args.push(`--frames=${frames}`);
  run('npx', args, 'REMOTION_RENDER_FAILED', {inherit: true});
}

function contactSheet(video, output, durationSeconds) {
  const interval = Math.max(5, Math.floor(durationSeconds / 12));
  run('ffmpeg', ['-y', '-i', video, '-vf', `fps=1/${interval},scale=480:-1,tile=4x3`, '-frames:v', '1', output], 'CONTACT_SHEET_FAILED');
}

function proofPrefixDigest(renderInput) {
  const boundary = renderInput.plan.proof_boundary_frame;
  return sha256Json({
    shots: renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).map((shot) => ({...shot, end_frame: Math.min(shot.end_frame, boundary)})),
    captions: renderInput.captions.filter((caption) => caption.start_frame < boundary).map((caption) => ({...caption, end_frame: Math.min(caption.end_frame, boundary)})),
    evidence_ids: [...new Set(renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).flatMap((shot) => shot.evidence_ids ?? []))].sort(),
    asset_ids: [...new Set(renderInput.plan.shots.filter((shot) => shot.start_frame < boundary).flatMap((shot) => shot.asset_ids ?? []))].sort(),
    proof_boundary_frame: boundary
  });
}

export async function renderProof({projectId, candidateSha, proofRunId}) {
  assertCheckedOutSha(candidateSha);
  const {candidate, renderInput} = await assertFrozenCandidate(projectId, candidateSha);
  const contracts = {
    productionPlan: renderInput.plan,
    narrationTimeline: renderInput.timeline,
    evidenceRegistry: {evidence: renderInput.evidence},
    assetRegistry: {assets: renderInput.assets},
    claimRegistry: await readJson(safeProjectPath(projectId, 'research/claim_registry.json')),
    audioPlan: await readJson(safeProjectPath(projectId, 'audio/audio_plan.json'))
  };
  await runStaticQa(projectId, contracts);
  const output = safeProjectPath(projectId, 'output/proof.mp4');
  await mkdir(path.dirname(output), {recursive: true});
  renderRemotion({propsFile: safeProjectPath(projectId, 'build/render_input.json'), output, frames: `0-${renderInput.plan.proof_boundary_frame - 1}`});
  const qa = await runRenderedQa(projectId, contracts, output, {mode: 'proof'});
  contactSheet(output, safeProjectPath(projectId, 'output/proof-contact-sheet.jpg'), qa.duration_seconds);
  const manifest = {
    schema_version: '1.0',
    status: 'TAMAMLANDI',
    runtime_stage: 'WAITING_FOR_PROOF_APPROVAL',
    project_id: projectId,
    candidate_sha: candidateSha,
    proof_run_id: String(proofRunId),
    proof_boundary_frame: renderInput.plan.proof_boundary_frame,
    proof_prefix_sha256: proofPrefixDigest(renderInput),
    candidate_digests: candidate.digests,
    rendered_qa_sha256: sha256Json(qa),
    created_at: new Date().toISOString()
  };
  await writeJsonAtomic(safeProjectPath(projectId, 'build/proof_manifest.json'), manifest);
  return manifest;
}

export async function renderFull({projectId, candidateSha, approvedProofRunId, proofManifestFile}) {
  assertCheckedOutSha(candidateSha);
  const {candidate, renderInput} = await assertFrozenCandidate(projectId, candidateSha);
  const proof = await readJson(path.resolve(proofManifestFile));
  invariant(proof.status === 'TAMAMLANDI', 'PROOF_NOT_COMPLETE', 'Proof manifest is not complete');
  invariant(proof.project_id === projectId && proof.candidate_sha === candidateSha && String(proof.proof_run_id) === String(approvedProofRunId), 'PROOF_APPROVAL_IDENTITY_MISMATCH', 'Approved proof identity does not match project, candidate or run ID');
  invariant(proof.proof_prefix_sha256 === proofPrefixDigest(renderInput), 'PROOF_PREFIX_CHANGED', 'Canonical proof prefix changed after approval');
  for (const [key, value] of Object.entries(candidate.digests)) invariant(proof.candidate_digests[key] === value, 'CANDIDATE_CHANGED_AFTER_PROOF', `${key} changed after proof`);
  const contracts = {
    productionPlan: renderInput.plan,
    narrationTimeline: renderInput.timeline,
    evidenceRegistry: {evidence: renderInput.evidence},
    assetRegistry: {assets: renderInput.assets},
    claimRegistry: await readJson(safeProjectPath(projectId, 'research/claim_registry.json')),
    audioPlan: await readJson(safeProjectPath(projectId, 'audio/audio_plan.json'))
  };
  await runStaticQa(projectId, contracts);
  const output = safeProjectPath(projectId, 'output/final.mp4');
  await mkdir(path.dirname(output), {recursive: true});
  renderRemotion({propsFile: safeProjectPath(projectId, 'build/render_input.json'), output});
  const qa = await runRenderedQa(projectId, contracts, output, {mode: 'full'});
  contactSheet(output, safeProjectPath(projectId, 'output/final-contact-sheet.jpg'), qa.duration_seconds);
  const manifest = {
    schema_version: '1.0',
    status: 'TAMAMLANDI',
    runtime_stage: 'DONE',
    project_id: projectId,
    candidate_sha: candidateSha,
    approved_proof_run_id: String(approvedProofRunId),
    candidate_digests: candidate.digests,
    final_qa_sha256: sha256Json(qa),
    completed_at: new Date().toISOString()
  };
  await writeJsonAtomic(safeProjectPath(projectId, 'build/final_manifest.json'), manifest);
  return manifest;
}
