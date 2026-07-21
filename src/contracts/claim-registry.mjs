import {invariant} from '../core/errors.mjs';
import {array, enumValue, indexBy, number, object, string} from './common.mjs';

export const CLAIM_STATUSES = Object.freeze(['verified', 'qualified', 'cut']);
export const VISUAL_EVIDENCE_REQUIREMENTS = Object.freeze(['required', 'preferred', 'contextual_only', 'narration_only']);

export function validateClaimRegistry(registry, {sourceCatalog} = {}) {
  object(registry, 'CLAIM_REGISTRY_INVALID', 'Claim registry must be an object');
  invariant(registry.schema_version === '1.0', 'CLAIM_REGISTRY_SCHEMA', 'Claim registry schema_version must be 1.0');
  string(registry.project_id, 'CLAIM_REGISTRY_PROJECT', 'Claim registry project_id is required');
  const claims = array(registry.claims, 'CLAIM_REGISTRY_EMPTY', 'Claim registry must contain claims', {min: 1});
  indexBy(claims, 'claim_id', 'CLAIM_ID_DUPLICATE', 'claim registry');
  const sourceIds = new Set(sourceCatalog?.sources?.map((source) => source.source_id) ?? []);
  for (const claim of claims) {
    object(claim, 'CLAIM_INVALID', 'Claim must be an object');
    string(claim.claim_id, 'CLAIM_ID_REQUIRED', 'claim_id is required', {pattern: /^[A-Z0-9_\-]+$/});
    string(claim.text, 'CLAIM_TEXT_REQUIRED', `${claim.claim_id} text is required`, {min: 10});
    string(claim.section_id, 'CLAIM_SECTION_REQUIRED', `${claim.claim_id} section_id is required`);
    enumValue(claim.status, CLAIM_STATUSES, 'CLAIM_STATUS_INVALID', `${claim.claim_id} status is invalid`);
    enumValue(claim.visual_evidence_requirement, VISUAL_EVIDENCE_REQUIREMENTS, 'CLAIM_VISUAL_REQUIREMENT_INVALID', `${claim.claim_id} visual evidence requirement is invalid`);
    number(claim.confidence, 'CLAIM_CONFIDENCE_INVALID', `${claim.claim_id} confidence must be between 0 and 1`, {min: 0, max: 1});
    const ids = array(claim.source_ids, 'CLAIM_SOURCE_IDS_INVALID', `${claim.claim_id} source_ids must be an array`);
    if (claim.status !== 'cut') invariant(ids.length > 0, 'CLAIM_SOURCE_MISSING', `${claim.claim_id} requires at least one source`);
    for (const sourceId of ids) {
      string(sourceId, 'CLAIM_SOURCE_ID_INVALID', `${claim.claim_id} contains an invalid source ID`);
      if (sourceCatalog) invariant(sourceIds.has(sourceId), 'CLAIM_SOURCE_UNKNOWN', `${claim.claim_id} references unknown source ${sourceId}`);
    }
    if (claim.status === 'qualified') string(claim.limitation, 'CLAIM_LIMITATION_REQUIRED', `${claim.claim_id} qualified claim requires a limitation`, {min: 12});
    if (claim.status === 'verified' && claim.limitation != null) string(claim.limitation, 'CLAIM_LIMITATION_INVALID', `${claim.claim_id} limitation must be meaningful`, {min: 8});
  }
  const unresolved = claims.filter((claim) => !CLAIM_STATUSES.includes(claim.status));
  invariant(unresolved.length === 0, 'CLAIM_UNRESOLVED', 'All claims must be verified, qualified or cut');
  return registry;
}
