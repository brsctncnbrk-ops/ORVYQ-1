#!/usr/bin/env node
import path from "node:path";
import { promises as fs } from "node:fs";
import { TEMPLATES_DIR, projectDir, pathExists, readJson, writeJsonAtomic, copyDir, parseArgs, printJson, CliError } from "./lib/fs-utils.mjs";

function isPathInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export async function assertSafeBundleOutput({ publicDir, outputDir, sourceRoot }) {
  const resolvedPublic = path.resolve(publicDir);
  const resolvedOutput = path.resolve(outputDir);
  const resolvedSource = path.resolve(sourceRoot);
  if (resolvedOutput === resolvedPublic) throw new CliError("Bundle output directory cannot equal the Remotion public directory", "RENDER_CONFIG_MISSING");
  if (isPathInside(resolvedOutput, resolvedPublic)) throw new CliError("Bundle output directory cannot be inside the Remotion public directory", "RENDER_CONFIG_MISSING");
  if (isPathInside(resolvedPublic, resolvedOutput)) throw new CliError("Remotion public directory cannot be inside the bundle output directory", "RENDER_CONFIG_MISSING");
  if (resolvedOutput === resolvedSource || isPathInside(resolvedOutput, resolvedSource)) throw new CliError("Bundle output directory cannot be inside the source tree", "RENDER_CONFIG_MISSING");
  return { public_dir: resolvedPublic, output_dir: resolvedOutput, source_root: resolvedSource };
}

async function loadComposition(projectId) {
  const compPath = path.join(projectDir(projectId), "remotion", "composition.json");
  if (!(await pathExists(compPath))) throw new CliError(`remotion/composition.json not found for ${projectId}`, "RENDER_CONFIG_MISSING");
  return readJson(compPath);
}

export async function deriveConfigs({ projectId }) {
  const comp = await loadComposition(projectId);
  const dir = projectDir(projectId);
  const sceneConfig = {
    fps: comp.fps,
    width: comp.width,
    height: comp.height,
    duration_frames: comp.duration_frames,
    scenes: comp.scenes.map((scene) => {
      const base = {
        scene_id: scene.scene_id,
        start_frame: scene.start_frame,
        end_frame: scene.end_frame,
        asset_type: scene.asset_type,
        text_overlay: scene.text_overlay ?? null,
        transition_in: scene.transition_in,
        transition_out: scene.transition_out,
      };
      return scene.asset_type === "footage"
        ? { ...base, trim_in_sec: scene.trim_in_sec, trim_out_sec: scene.trim_out_sec }
        : { ...base, camera_motion: scene.camera_motion };
    }),
  };
  const assetMap = { audio_asset: comp.audio_asset, asset_map: comp.asset_map };
  await writeJsonAtomic(path.join(dir, "remotion", "scene_config.json"), sceneConfig);
  await writeJsonAtomic(path.join(dir, "remotion", "asset_map.json"), assetMap);
  return { project_id: projectId, derived: ["remotion/scene_config.json", "remotion/asset_map.json"], scene_count: sceneConfig.scenes.length, duration_frames: sceneConfig.duration_frames };
}

async function refreshAssetManifest(projectId, comp) {
  const dir = projectDir(projectId);
  const durationSeconds = comp.fps ? Math.round((comp.duration_frames / comp.fps) * 100) / 100 : null;
  const footageManifestPath = path.join(dir, "footage", "footage_manifest.json");
  const footageManifest = (await pathExists(footageManifestPath)) ? await readJson(footageManifestPath) : null;
  const footageById = new Map((footageManifest?.scenes || []).map((scene) => [scene.scene_id, scene]));
  const mixMetadataPath = path.join(dir, "assets", "audio", "final_mix.metadata.json");
  const mixMetadata = (await pathExists(mixMetadataPath)) ? await readJson(mixMetadataPath) : null;

  const music = [];
  if (mixMetadata?.music_asset) {
    music.push({
      file: mixMetadata.music_asset,
      status: (await pathExists(path.join(dir, mixMetadata.music_asset))) ? "available" : "missing",
      source: mixMetadata.music_profile === "approved_licensed_bed" ? "User-approved licensed music bed" : "Unknown",
    });
  }

  const sfx = mixMetadata
    ? await Promise.all((mixMetadata.sfx_assets || []).filter(Boolean).map(async (file) => ({
        file,
        status: (await pathExists(path.join(dir, file))) ? "available" : "missing",
        source: "Approved sound design asset",
      })))
    : [];

  const manifest = {
    audio: {
      main_voice: { path: comp.audio_asset, status: (await pathExists(path.join(dir, comp.audio_asset))) ? "available" : "missing", duration_seconds: durationSeconds },
      final_mix: mixMetadata ? { path: mixMetadata.mix_asset, status: (await pathExists(path.join(dir, mixMetadata.mix_asset))) ? "available" : "missing" } : null,
    },
    visuals: [],
    music,
    sfx,
    captions: { file: "remotion/captions.json", status: (await pathExists(path.join(dir, "remotion", "captions.json"))) ? "available" : "missing" },
  };

  for (const scene of comp.scenes) {
    const isFootage = scene.asset_type === "footage";
    const rel = isFootage ? scene.video_asset : scene.image_asset;
    const footageEntry = footageById.get(scene.scene_id);
    manifest.visuals.push({
      scene_id: scene.scene_id,
      asset_type: scene.asset_type,
      file: rel,
      status: (await pathExists(path.join(dir, rel))) ? "available" : "missing",
      source: isFootage ? footageEntry?.source || "unknown" : "Leonardo AI",
      license: isFootage ? footageEntry?.license || null : null,
      seed: null,
      style_reference: null,
    });
  }

  await writeJsonAtomic(path.join(dir, "assets", "asset_manifest.json"), manifest);
  return manifest;
}

export async function buildProject({ projectId }) {
  const dir = projectDir(projectId);
  const comp = await loadComposition(projectId);
  for (const rel of ["remotion/scene_config.json", "remotion/asset_map.json", "remotion/captions.json"]) {
    if (!(await pathExists(path.join(dir, rel)))) throw new CliError(`${rel} missing - generate render data first`, "RENDER_CONFIG_MISSING");
  }
  const editPlanPath = path.join(dir, "direction", "edit_plan.json");
  if (!(await pathExists(editPlanPath))) throw new CliError("direction/edit_plan.json missing - create the editorial shot plan before rendering", "RENDER_CONFIG_MISSING");
  const templateDir = path.join(TEMPLATES_DIR, "remotion");
  if (!(await pathExists(templateDir))) throw new CliError("templates/remotion/ is missing from the repo", "RENDER_CONFIG_MISSING");
  const dest = path.join(dir, "remotion", "render_ready_project");
  const previousHumanNotesPath = path.join(dest, "src", "data", "human_notes.json");
  const previousHumanNotes = (await pathExists(previousHumanNotesPath)) ? await fs.readFile(previousHumanNotesPath) : null;
  await fs.rm(dest, { recursive: true, force: true });
  await copyDir(templateDir, dest);
  const dataDir = path.join(dest, "src", "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.copyFile(path.join(dir, "remotion", "scene_config.json"), path.join(dataDir, "scene_config.json"));
  await fs.copyFile(path.join(dir, "remotion", "asset_map.json"), path.join(dataDir, "asset_map.json"));
  await fs.copyFile(path.join(dir, "remotion", "captions.json"), path.join(dataDir, "captions.json"));
  await fs.copyFile(editPlanPath, path.join(dataDir, "edit_plan.json"));
  if (previousHumanNotes) await fs.writeFile(path.join(dataDir, "human_notes.json"), previousHumanNotes);
  const assetManifest = await refreshAssetManifest(projectId, comp);
  const missingAssets = [
    ...(assetManifest.audio.main_voice.status === "missing" ? [assetManifest.audio.main_voice.path] : []),
    ...(assetManifest.audio.final_mix?.status === "missing" ? [assetManifest.audio.final_mix.path] : []),
    ...assetManifest.visuals.filter((visual) => visual.status === "missing").map((visual) => visual.file),
    ...assetManifest.music.filter((item) => item.status === "missing").map((item) => item.file),
    ...assetManifest.sfx.filter((item) => item.status === "missing").map((item) => item.file),
    ...(assetManifest.captions.status === "missing" ? [assetManifest.captions.file] : []),
  ];
  return { project_id: projectId, render_ready_project: "remotion/render_ready_project", copied_configs: ["src/data/scene_config.json", "src/data/asset_map.json", "src/data/edit_plan.json", "src/data/captions.json"], asset_manifest_refreshed: true, missing_assets: missingAssets };
}

async function validateBundleOutputCommand(args) {
  return assertSafeBundleOutput({ publicDir: args["public-dir"], outputDir: args["output-dir"], sourceRoot: args["source-root"] || process.cwd() });
}

const SUBCOMMANDS = { "derive-configs": deriveConfigs, "build-project": buildProject, "validate-bundle-output": validateBundleOutputCommand };
async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const handler = SUBCOMMANDS[subcommand];
  if (!handler) {
    console.log("Usage: node scripts/remotion_build.mjs <derive-configs|build-project|validate-bundle-output> --project-id <id>");
    process.exitCode = subcommand ? 1 : 0;
    return;
  }
  const args = parseArgs(rest);
  try {
    const result = subcommand === "validate-bundle-output" ? await handler(args) : await handler({ projectId: args["project-id"] });
    printJson({ ok: true, ...result });
  } catch (error) {
    printJson({ ok: false, error_code: error.code || "UNKNOWN_ERROR", message: error.message });
    process.exitCode = 1;
  }
}
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
