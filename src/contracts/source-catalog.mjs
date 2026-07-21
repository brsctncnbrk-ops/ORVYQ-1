import {invariant} from '../core/errors.mjs';
import {array, boolean, enumValue, indexBy, isoDate, object, string, url} from './common.mjs';

export const SOURCE_KINDS = Object.freeze(['primary', 'secondary', 'context']);

export function validateSourceCatalog(catalog) {
  object(catalog, 'SOURCE_CATALOG_INVALID', 'Source catalog must be an object');
  invariant(catalog.schema_version === '1.0', 'SOURCE_CATALOG_SCHEMA', 'Source catalog schema_version must be 1.0');
  string(catalog.project_id, 'SOURCE_CATALOG_PROJECT', 'Source catalog project_id is required');
  const sources = array(catalog.sources, 'SOURCE_CATALOG_EMPTY', 'Source catalog must contain sources', {min: 1});
  indexBy(sources, 'source_id', 'SOURCE_ID_DUPLICATE', 'source catalog');
  for (const source of sources) {
    object(source, 'SOURCE_INVALID', 'Source must be an object');
    string(source.source_id, 'SOURCE_ID_REQUIRED', 'source_id is required', {pattern: /^[A-Z0-9_\-]+$/});
    string(source.title, 'SOURCE_TITLE_REQUIRED', `${source.source_id} title is required`);
    string(source.publisher, 'SOURCE_PUBLISHER_REQUIRED', `${source.source_id} publisher is required`);
    url(source.url, 'SOURCE_URL_INVALID', `${source.source_id} URL`);
    enumValue(source.kind, SOURCE_KINDS, 'SOURCE_KIND_INVALID', `${source.source_id} kind is invalid`);
    boolean(source.active, 'SOURCE_ACTIVE_INVALID', `${source.source_id} active must be boolean`);
    boolean(source.required, 'SOURCE_REQUIRED_INVALID', `${source.source_id} required must be boolean`);
    isoDate(source.accessed_at, 'SOURCE_ACCESS_DATE_INVALID', `${source.source_id} accessed_at`);
    string(source.license_or_basis, 'SOURCE_BASIS_REQUIRED', `${source.source_id} license_or_basis is required`, {min: 8});
    if (source.published_at != null) isoDate(source.published_at, 'SOURCE_PUBLISH_DATE_INVALID', `${source.source_id} published_at`);
    const host = new URL(source.url).hostname.toLowerCase();
    invariant(!/(?:githubusercontent|github\.com)$/i.test(host), 'SOURCE_RUNTIME_REPOSITORY_FORBIDDEN', `${source.source_id} cannot use a GitHub repository as an editorial source`);
  }
  invariant(sources.some((source) => source.kind === 'primary' && source.active), 'PRIMARY_SOURCE_MISSING', 'At least one active primary source is required');
  return catalog;
}
