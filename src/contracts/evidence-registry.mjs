import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {invariant} from '../core/errors.mjs';
import {sha256Bytes} from '../core/json.mjs';
import {safeProjectPath} from '../core/paths.mjs';
import {array, enumValue, indexBy, number, object, repositoryRelativePath, sha256, string, url} from './common.mjs';

export const EVIDENCE_TYPES = Object.freeze([
  'primary_document',
  'official_figure',
  'official_screen',
  'official_article',
  'official_table',
  'primary_image_sequence'
]);

const PIXEL_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);
const PLACEHOLDER_PATTERNS = [
  /editorial evidence card/i,
  /derived from the cited official source/i,
  /source-backed editorial treatment/i,
  /official source[^\n]{0,100}editorial/i
];

export function validateEvidenceRegistry(registry, {sourceCatalog, claimRegistry} = {}) {
  object(registry, 'EVIDENCE_REGISTRY_INVALID', 'Evidence registry must be an object');
  invariant(registry.schema_version === '1.0', 'EVIDENCE_REGISTRY_SCHEMA', 'Evidence registry schema_version must be 1.0');
  string(registry.project_id, 'EVIDENCE_REGISTRY_PROJECT', 'Evidence registry project_id is required');
  const evidence = array(registry.evidence, 'EVIDENCE_REGISTRY_EMPTY', 'Evidence registry must contain evidence', {min: 1});
  indexBy(evidence, 'evidence_id', 'EVIDENCE_ID_DUPLICATE', 'evidence registry');
  const sourceIds = new Set(sourceCatalog?.sources?.map((source) => source.source_id) ?? []);
  const claimIds = new Set(claimRegistry?.claims?.map((claim) => claim.claim_id) ?? []);
  for (const item of evidence) {
    object(item, 'EVIDENCE_INVALID', 'Evidence entry must be an object');
    string(item.evidence_id, 'EVIDENCE_ID_REQUIRED', 'evidence_id is required', {pattern: /^[A-Z0-9_\-]+$/});
    enumValue(item.evidence_type, EVIDENCE_TYPES, 'EVIDENCE_TYPE_INVALID', `${item.evidence_id} evidence type is invalid`);
    repositoryRelativePath(item.relative_path, 'EVIDENCE_PATH_INVALID', `${item.evidence_id} relative_path`);
    invariant(item.relative_path.startsWith('evidence/'), 'EVIDENCE_PATH_SCOPE', `${item.evidence_id} must live under evidence/`);
    const extension = path.extname(item.relative_path).toLowerCase();
    invariant(PIXEL_EXTENSIONS.has(extension), 'PRIMARY_SOURCE_PIXELS_REQUIRED', `${item.evidence_id} must use a real PDF or raster capture; SVG/HTML/generated cards are forbidden`);
    sha256(item.sha256, 'EVIDENCE_SHA_INVALID', `${item.evidence_id} sha256`);
    number(item.byte_size, 'EVIDENCE_SIZE_INVALID', `${item.evidence_id} byte_size must be positive`, {min: 1024, integer: true});
    url(item.source_url, 'EVIDENCE_SOURCE_URL_INVALID', `${item.evidence_id} source_url`);
    string(item.provenance_mode, 'EVIDENCE_PROVENANCE_REQUIRED', `${item.evidence_id} provenance_mode is required`);
    invariant(item.provenance_mode === 'official_primary_capture', 'EVIDENCE_PROVENANCE_INVALID', `${item.evidence_id} must use official_primary_capture`);
    const itemSourceIds = array(item.source_ids, 'EVIDENCE_SOURCE_IDS_INVALID', `${item.evidence_id} source_ids must be an array`, {min: 1});
    const itemClaimIds = array(item.claim_ids, 'EVIDENCE_CLAIM_IDS_INVALID', `${item.evidence_id} claim_ids must be an array`, {min: 1});
    for (const sourceId of itemSourceIds) if (sourceCatalog) invariant(sourceIds.has(sourceId), 'EVIDENCE_SOURCE_UNKNOWN', `${item.evidence_id} references unknown source ${sourceId}`);
    for (const claimId of itemClaimIds) if (claimRegistry) invariant(claimIds.has(claimId), 'EVIDENCE_CLAIM_UNKNOWN', `${item.evidence_id} references unknown claim ${claimId}`);
    string(item.caption, 'EVIDENCE_CAPTION_REQUIRED', `${item.evidence_id} caption is required`, {min: 8});
    string(item.license_or_basis, 'EVIDENCE_BASIS_REQUIRED', `${item.evidence_id} license_or_basis is required`, {min: 8});
    if (extension === '.pdf' || item.page_number != null) number(item.page_number, 'EVIDENCE_PAGE_INVALID', `${item.evidence_id} page_number must be positive`, {min: 1, integer: true});
  }
  return registry;
}

export async function auditEvidenceFiles(projectId, registry) {
  const reports = [];
  for (const item of registry.evidence) {
    const file = safeProjectPath(projectId, item.relative_path);
    const metadata = await stat(file);
    invariant(metadata.isFile(), 'EVIDENCE_FILE_MISSING', `${item.evidence_id} is not a file`);
    invariant(metadata.size === item.byte_size, 'EVIDENCE_SIZE_MISMATCH', `${item.evidence_id} byte size mismatch`);
    const bytes = await readFile(file);
    invariant(sha256Bytes(bytes) === item.sha256, 'EVIDENCE_SHA_MISMATCH', `${item.evidence_id} SHA-256 mismatch`);
    const prefix = bytes.subarray(0, Math.min(bytes.length, 32768)).toString('utf8');
    invariant(!PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(prefix)), 'PLACEHOLDER_EVIDENCE_FORBIDDEN', `${item.evidence_id} contains generated placeholder language`);
    invariant(!/^\s*<svg\b/i.test(prefix), 'PRIMARY_SOURCE_PIXELS_REQUIRED', `${item.evidence_id} cannot be an SVG card`);
    reports.push({evidence_id: item.evidence_id, status: 'TAMAMLANDI', byte_size: metadata.size, sha256: item.sha256});
  }
  return {status: 'TAMAMLANDI', evidence_count: reports.length, files: reports};
}
