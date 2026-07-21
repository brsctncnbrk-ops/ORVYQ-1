import {readFile, mkdir, access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {OrvyqError, invariant} from '../core/errors.mjs';
import {assertProjectId, projectRoot, safeProjectPath} from '../core/paths.mjs';
import {assertStage} from '../core/state-machine.mjs';
import {readJson, writeJsonAtomic} from '../core/json.mjs';

export function validateManifest(manifest) {
  invariant(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'MANIFEST_INVALID', 'Manifest must be an object');
  invariant(manifest.schema_version === '1.0', 'MANIFEST_SCHEMA_VERSION', 'Manifest schema_version must be 1.0');
  assertProjectId(manifest.project_id);
  invariant(typeof manifest.title === 'string' && manifest.title.trim().length > 0, 'MANIFEST_TITLE_REQUIRED', 'Manifest title is required');
  invariant(Number.isFinite(manifest.minimum_duration_seconds) && manifest.minimum_duration_seconds >= 60, 'MINIMUM_DURATION_INVALID', 'Minimum duration must be at least 60 seconds');
  assertStage(manifest.current_stage);
  invariant(['YAPILMADI', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'BLOKE'].includes(manifest.operation_status), 'OPERATION_STATUS_INVALID', 'Invalid operation status');
  invariant(typeof manifest.created_at === 'string' && !Number.isNaN(Date.parse(manifest.created_at)), 'MANIFEST_CREATED_AT_INVALID', 'created_at must be an ISO date-time');
  invariant(typeof manifest.updated_at === 'string' && !Number.isNaN(Date.parse(manifest.updated_at)), 'MANIFEST_UPDATED_AT_INVALID', 'updated_at must be an ISO date-time');
  invariant(Array.isArray(manifest.history), 'MANIFEST_HISTORY_INVALID', 'Manifest history must be an array');
  if (manifest.candidate_sha != null) invariant(/^[0-9a-f]{40}$/.test(manifest.candidate_sha), 'CANDIDATE_SHA_INVALID', 'candidate_sha must be a 40-character lowercase SHA');
  return manifest;
}

export function createManifest({projectId, title, minimumDurationSeconds = 600}) {
  assertProjectId(projectId);
  invariant(typeof title === 'string' && title.trim().length > 0, 'PROJECT_TITLE_REQUIRED', 'Project title is required');
  invariant(Number.isFinite(minimumDurationSeconds) && minimumDurationSeconds >= 60, 'MINIMUM_DURATION_INVALID', 'Minimum duration must be at least 60 seconds');
  const now = new Date().toISOString();
  return validateManifest({
    schema_version: '1.0',
    project_id: projectId,
    title: title.trim(),
    minimum_duration_seconds: minimumDurationSeconds,
    current_stage: 'SOURCE_INTAKE',
    operation_status: 'YAPILMADI',
    created_at: now,
    updated_at: now,
    candidate_sha: null,
    approved_proof_run_id: null,
    history: []
  });
}

export async function loadManifest(projectId) {
  const file = safeProjectPath(projectId, 'manifest.json');
  try {
    return validateManifest(await readJson(file));
  } catch (error) {
    if (error?.code === 'ENOENT') throw new OrvyqError('MANIFEST_MISSING', `Project manifest does not exist: ${projectId}`);
    throw error;
  }
}

export async function initializeProject({projectId, title, minimumDurationSeconds = 600}) {
  const root = projectRoot(projectId);
  try {
    await access(root, constants.F_OK);
    throw new OrvyqError('PROJECT_ALREADY_EXISTS', `Project already exists: ${projectId}`);
  } catch (error) {
    if (error instanceof OrvyqError) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }

  for (const directory of [
    'input',
    'research',
    'evidence/documents',
    'evidence/figures',
    'evidence/screenshots',
    'evidence/crops',
    'assets/footage',
    'assets/narration',
    'assets/music',
    'assets/sfx',
    'direction',
    'storyboard',
    'audio',
    'build',
    'qa',
    'output'
  ]) {
    await mkdir(safeProjectPath(projectId, directory), {recursive: true});
  }

  const manifest = createManifest({projectId, title, minimumDurationSeconds});
  await writeJsonAtomic(safeProjectPath(projectId, 'manifest.json'), manifest);
  return manifest;
}
