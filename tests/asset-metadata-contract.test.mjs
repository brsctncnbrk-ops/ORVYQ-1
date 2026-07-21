import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {validateAssetMetadataContract} from "../src/lib/asset-metadata-contract.mjs";
import {OrvyqError} from "../src/lib/core.mjs";

function fixture(asset) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orvyq-asset-contract-"));
  process.env.ORVYQ_REPO_ROOT = root;
  const projectId = "001-asset-contract";
  const directory = path.join(root, "projects", projectId, "assets");
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, "asset_registry.json"), JSON.stringify({assets: [asset]}, null, 2));
  return projectId;
}

const valid = {
  id: "asset-1",
  relative_path: "assets/footage/asset.mp4",
  sha256: "a".repeat(64),
  byte_size: 1024,
  media_type: "video",
  duration_seconds: 6.2,
  resolution: "1920x1080",
  codec: "h264",
  source_url: "https://example.org/licensed-source",
  license: "Licensed for editorial use",
  attribution_requirement: "Source label required",
  editorial_purpose: "Contextual footage, not literal evidence",
  claim_ids: [],
  approved_for_final_edit: true
};

test("complete asset metadata passes the contract", () => {
  const projectId = fixture(valid);
  assert.deepEqual(validateAssetMetadataContract(projectId), {status: "TAMAMLANDI", asset_count: 1});
});

test("missing duration, resolution, codec or attribution blocks candidate validation", () => {
  for (const field of ["duration_seconds", "resolution", "codec", "attribution_requirement"]) {
    const asset = {...valid};
    delete asset[field];
    const projectId = fixture(asset);
    assert.throws(
      () => validateAssetMetadataContract(projectId),
      (error) => error instanceof OrvyqError && error.code === "ASSET_METADATA_MISSING",
      `Expected missing ${field} to block validation`
    );
  }
});

test("cross-repository GitHub production asset URLs are blocked", () => {
  const projectId = fixture({...valid, source_url: "https://github.com/example/legacy/raw/main/asset.mp4"});
  assert.throws(
    () => validateAssetMetadataContract(projectId),
    (error) => error instanceof OrvyqError && error.code === "CROSS_REPO_ASSET"
  );
});
