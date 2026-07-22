import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {invariant} from '../core/errors.mjs';
import {sha256Bytes} from '../core/json.mjs';
import {safeProjectPath} from '../core/paths.mjs';
import {array, boolean, enumValue, indexBy, number, object, repositoryRelativePath, sha256, string, url} from './common.mjs';

export const ASSET_ROLES = Object.freeze([
  'narration_stem','music_stem','sfx_stem','final_audio_mix','contextual_footage','motion_hook_footage','brand_asset'
]);
export const MEDIA_TYPES = Object.freeze(['audio', 'video', 'image']);

function probe(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  invariant(result.status === 0, 'MEDIA_PROBE_FAILED', `ffprobe failed for ${file}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

export function validateAssetRegistry(registry) {
  object(registry, 'ASSET_REGISTRY_INVALID', 'Asset registry must be an object');
  invariant(registry.schema_version === '1.0', 'ASSET_REGISTRY_SCHEMA', 'Asset registry schema_version must be 1.0');
  string(registry.project_id, 'ASSET_REGISTRY_PROJECT', 'Asset registry project_id is required');
  const assets = array(registry.assets, 'ASSET_REGISTRY_EMPTY', 'Asset registry must contain assets', {min: 1});
  indexBy(assets, 'asset_id', 'ASSET_ID_DUPLICATE', 'asset registry');
  for (const asset of assets) {
    object(asset, 'ASSET_INVALID', 'Asset must be an object');
    string(asset.asset_id, 'ASSET_ID_REQUIRED', 'asset_id is required', {pattern: /^[A-Z0-9_\-]+$/});
    enumValue(asset.role, ASSET_ROLES, 'ASSET_ROLE_INVALID', `${asset.asset_id} role is invalid`);
    enumValue(asset.media_type, MEDIA_TYPES, 'ASSET_MEDIA_TYPE_INVALID', `${asset.asset_id} media type is invalid`);
    repositoryRelativePath(asset.relative_path, 'ASSET_PATH_INVALID', `${asset.asset_id} relative_path`);
    invariant(asset.relative_path.startsWith('assets/'), 'ASSET_PATH_SCOPE', `${asset.asset_id} must live under assets/`);
    sha256(asset.sha256, 'ASSET_SHA_INVALID', `${asset.asset_id} sha256`);
    number(asset.byte_size, 'ASSET_SIZE_INVALID', `${asset.asset_id} byte_size must be positive`, {min: 1, integer: true});
    number(asset.duration_seconds, 'ASSET_DURATION_INVALID', `${asset.asset_id} duration must be positive`, {min: 0.05});
    url(asset.source_url, 'ASSET_SOURCE_URL_INVALID', `${asset.asset_id} source_url`);
    string(asset.license, 'ASSET_LICENSE_REQUIRED', `${asset.asset_id} license is required`, {min: 4});
    string(asset.editorial_purpose, 'ASSET_PURPOSE_REQUIRED', `${asset.asset_id} editorial_purpose is required`, {min: 8});
    boolean(asset.approved_for_final_edit, 'ASSET_APPROVAL_INVALID', `${asset.asset_id} approved_for_final_edit must be boolean`);
    invariant(asset.approved_for_final_edit, 'ASSET_NOT_APPROVED', `${asset.asset_id} is not approved for final edit`);
    if (asset.media_type === 'video') {
      number(asset.width, 'ASSET_WIDTH_INVALID', `${asset.asset_id} width is required`, {min: 1920, integer: true});
      number(asset.height, 'ASSET_HEIGHT_INVALID', `${asset.asset_id} height is required`, {min: 1080, integer: true});
    }
    if (asset.role === 'contextual_footage') {
      string(asset.semantic_description, 'ASSET_SEMANTIC_DESCRIPTION_MISSING', `${asset.asset_id} semantic_description is required`, {min: 20});
      const keywords = array(asset.semantic_keywords, 'ASSET_SEMANTIC_KEYWORDS_MISSING', `${asset.asset_id} semantic_keywords are required`, {min: 3});
      for (const keyword of keywords) string(keyword, 'ASSET_SEMANTIC_KEYWORD_INVALID', `${asset.asset_id} semantic keyword is invalid`, {min: 3});
      enumValue(asset.visual_class, ['real_world', 'abstract'], 'ASSET_VISUAL_CLASS_INVALID', `${asset.asset_id} visual_class is invalid`);
    }
    if (asset.role === 'music_stem') {
      invariant(asset.attribution_file, 'MUSIC_ATTRIBUTION_MISSING', `${asset.asset_id} requires attribution_file`);
      repositoryRelativePath(asset.attribution_file, 'MUSIC_ATTRIBUTION_PATH_INVALID', `${asset.asset_id} attribution_file`);
    }
  }
  invariant(assets.filter((asset) => asset.role === 'narration_stem').length === 1, 'NARRATION_STEM_COUNT', 'Exactly one narration_stem is required');
  invariant(assets.filter((asset) => asset.role === 'music_stem').length >= 1, 'MUSIC_STEM_MISSING', 'At least one music_stem is required');
  invariant(assets.filter((asset) => asset.role === 'contextual_footage').length >= 4, 'CONTEXTUAL_FOOTAGE_POOL_TOO_SMALL', 'At least four contextual footage assets are required');
  return registry;
}

export async function auditAssetFiles(projectId, registry) {
  const reports = [];
  for (const asset of registry.assets) {
    const file = safeProjectPath(projectId, asset.relative_path);
    const metadata = await stat(file);
    invariant(metadata.isFile(), 'ASSET_FILE_MISSING', `${asset.asset_id} is not a file`);
    invariant(metadata.size === asset.byte_size, 'ASSET_SIZE_MISMATCH', `${asset.asset_id} byte size mismatch`);
    const bytes = await readFile(file);
    invariant(!bytes.subarray(0, 200).toString('utf8').includes('git-lfs.github.com/spec'), 'LFS_POINTER_NOT_BINARY', `${asset.asset_id} is an LFS pointer`);
    invariant(sha256Bytes(bytes) === asset.sha256, 'ASSET_SHA_MISMATCH', `${asset.asset_id} SHA-256 mismatch`);
    const media = probe(file);
    const streams = media.streams ?? [];
    const duration = Number(media.format?.duration ?? streams.find((stream) => stream.duration)?.duration ?? 0);
    invariant(duration > 0 && Math.abs(duration - asset.duration_seconds) <= 0.35, 'ASSET_DURATION_MISMATCH', `${asset.asset_id} duration mismatch`);
    if (asset.media_type === 'video') {
      const video = streams.find((stream) => stream.codec_type === 'video');
      invariant(video, 'VIDEO_STREAM_MISSING', `${asset.asset_id} has no video stream`);
      invariant(Number(video.width) >= 1920 && Number(video.height) >= 1080, 'VIDEO_BELOW_1080P', `${asset.asset_id} is below 1080p`);
    }
    if (asset.media_type === 'audio') invariant(streams.some((stream) => stream.codec_type === 'audio'), 'AUDIO_STREAM_MISSING', `${asset.asset_id} has no audio stream`);
    reports.push({asset_id: asset.asset_id, role: asset.role, duration_seconds: duration, status: 'TAMAMLANDI'});
  }
  return {status: 'TAMAMLANDI', asset_count: reports.length, assets: reports};
}
