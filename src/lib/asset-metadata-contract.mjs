import fs from "node:fs";
import path from "node:path";
import {OrvyqError, safeProjectPath} from "./core.mjs";

const REQUIRED_FIELDS = Object.freeze([
  "id",
  "relative_path",
  "sha256",
  "byte_size",
  "media_type",
  "duration_seconds",
  "resolution",
  "codec",
  "source_url",
  "license",
  "attribution_requirement",
  "editorial_purpose",
  "claim_ids",
  "approved_for_final_edit"
]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function validateAssetMetadataContract(projectId) {
  const registryFile = safeProjectPath(projectId, "assets/asset_registry.json");
  if (!fs.existsSync(registryFile)) {
    throw new OrvyqError("ASSET_REGISTRY_MISSING", `Required asset registry is missing: ${registryFile}`);
  }
  const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  if (!Array.isArray(registry.assets) || registry.assets.length === 0) {
    throw new OrvyqError("ASSET_REGISTRY_EMPTY", "Asset registry must contain at least one asset");
  }

  for (const asset of registry.assets) {
    for (const field of REQUIRED_FIELDS) {
      if (!hasOwn(asset, field)) {
        throw new OrvyqError("ASSET_METADATA_MISSING", `${asset.id || asset.relative_path || "asset"} is missing ${field}`);
      }
    }

    if (typeof asset.id !== "string" || asset.id.trim() === "") {
      throw new OrvyqError("ASSET_ID_INVALID", "Every asset requires a non-empty id");
    }
    if (typeof asset.relative_path !== "string" || path.isAbsolute(asset.relative_path) || asset.relative_path.split(/[\\/]/).includes("..") || !asset.relative_path.startsWith("assets/")) {
      throw new OrvyqError("ASSET_PATH_INVALID", `${asset.id} must use a safe project-relative path under assets/`);
    }
    if (!/^[0-9a-f]{64}$/.test(String(asset.sha256))) {
      throw new OrvyqError("ASSET_SHA_INVALID", `${asset.id} must declare a 64-character SHA-256`);
    }
    if (!Number.isInteger(Number(asset.byte_size)) || Number(asset.byte_size) <= 0) {
      throw new OrvyqError("ASSET_SIZE_INVALID", `${asset.id} must declare a positive byte_size`);
    }
    if (!["audio", "video", "image"].includes(asset.media_type)) {
      throw new OrvyqError("ASSET_MEDIA_TYPE_INVALID", `${asset.id} has unsupported media_type ${asset.media_type}`);
    }
    if (!Number.isFinite(Number(asset.duration_seconds)) || Number(asset.duration_seconds) < 0) {
      throw new OrvyqError("ASSET_DURATION_INVALID", `${asset.id} must declare duration_seconds >= 0`);
    }
    if (["video", "image"].includes(asset.media_type) && (asset.resolution === null || asset.resolution === "")) {
      throw new OrvyqError("ASSET_RESOLUTION_MISSING", `${asset.id} must declare resolution`);
    }
    if (typeof asset.codec !== "string" || asset.codec.trim() === "") {
      throw new OrvyqError("ASSET_CODEC_MISSING", `${asset.id} must declare codec or image format`);
    }
    for (const field of ["source_url", "license", "attribution_requirement", "editorial_purpose"]) {
      if (typeof asset[field] !== "string" || asset[field].trim() === "") {
        throw new OrvyqError("ASSET_METADATA_MISSING", `${asset.id} requires non-empty ${field}`);
      }
    }
    if (!Array.isArray(asset.claim_ids)) {
      throw new OrvyqError("ASSET_CLAIMS_INVALID", `${asset.id} claim_ids must be an array`);
    }
    if (asset.approved_for_final_edit !== true) {
      throw new OrvyqError("ASSET_NOT_APPROVED", `${asset.id} is not approved_for_final_edit`);
    }
    if (/github\.com|githubusercontent\.com/i.test(asset.source_url) && !asset.source_url.startsWith("repo://ORVYQ-1/")) {
      throw new OrvyqError("CROSS_REPO_ASSET", `${asset.id} cannot use a GitHub repository URL as a production asset source`);
    }
  }

  return {status: "TAMAMLANDI", asset_count: registry.assets.length};
}
