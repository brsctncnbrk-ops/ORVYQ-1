import {invariant} from '../core/errors.mjs';
import {gitSha, isoDate, object, sha256, string} from './common.mjs';

export const CANDIDATE_DIGEST_KEYS = Object.freeze([
  'source_catalog_sha256',
  'claim_registry_sha256',
  'evidence_registry_sha256',
  'asset_registry_sha256',
  'narration_timeline_sha256',
  'audio_plan_sha256',
  'audio_mix_sha256',
  'production_plan_sha256',
  'render_input_sha256',
  'proof_prefix_sha256'
]);

export function validateCandidate(candidate) {
  object(candidate, 'CANDIDATE_INVALID', 'Candidate must be an object');
  invariant(candidate.schema_version === '1.0', 'CANDIDATE_SCHEMA', 'Candidate schema_version must be 1.0');
  string(candidate.project_id, 'CANDIDATE_PROJECT', 'Candidate project_id is required');
  gitSha(candidate.candidate_sha);
  isoDate(candidate.frozen_at, 'CANDIDATE_FROZEN_AT_INVALID', 'candidate frozen_at');
  object(candidate.digests, 'CANDIDATE_DIGESTS_MISSING', 'Candidate digests are required');
  for (const key of CANDIDATE_DIGEST_KEYS) sha256(candidate.digests[key], 'CANDIDATE_DIGEST_INVALID', key);
  return candidate;
}
