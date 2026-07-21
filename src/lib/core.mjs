import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";

export const REPORT_STATUSES = Object.freeze(["TAMAMLANDI", "BAŞARISIZ", "DOĞRULANMADI", "YAPILMADI", "BLOKE"]);
export const STAGES = Object.freeze([
  "source_intake", "research", "research_qa", "script", "fact_audit", "script_qa",
  "voice_script", "voice_qa", "WAITING_FOR_AUDIO", "audio_alignment", "storyboard",
  "storyboard_qa", "footage_retrieval", "visual_style_bible", "visual_asset_planning",
  "visual_qa", "director", "production_plan", "render_qa", "READY_FOR_PROOF",
  "WAITING_FOR_PROOF_APPROVAL", "READY_FOR_FULL_RENDER", "packaging", "final_qa", "DONE"
]);

export const NOTEBOOK_QUESTIONS = `# ORVYQ NotebookLM Question Contract

Use the reference video only to discover the topic, claims, missing questions, and research directions. Do not copy its wording, anecdotes, sequence, or structure. Return every section below.

## A — KONU VE ANA TEZ
- Kaynağın asıl konusu nedir?
- Savunduğu merkezî tez nedir?
- İzleyiciye cevaplamaya çalıştığı ana soru nedir?

## B — ANA İDDİALAR VE DOĞRULANACAK FACTLER
- En önemli 5–10 iddia
- İsimler, tarihler, kurumlar, kitaplar, araştırmalar ve istatistikler
- Bağımsız doğrulama gerektiren iddialar
- Kaynağın kendi yorumları ile doğrulanabilir factlerin ayrımı

## C — KAYNAĞIN ANLATI İSKELETİ
- Konuların sırası
- Argument sequence
- Hook ve kapanış yaklaşımı
- Tekrarlanan anlatım teknikleri

C bölümü yalnızca final benzerlik kontrolü içindir. Research veya script yapısı üretiminde kullanılamaz.

## D — EKSİK SORULAR VE ÖZGÜN AÇILAR
- Kaynağın cevaplamadığı sorular
- Zayıf veya tek taraflı bıraktığı alanlar
- Araştırılabilecek karşı görüşler
- En az beş özgün video açısı

## E — ÖĞRENİMLER VE ÇIKARILABİLECEK MATERYAL
- Doğrudan alıntı yapmadan kullanılabilecek temel öğrenimler
- Araştırma başlangıç noktaları
- Görsel olarak kanıtlanabilecek iddialar
- Belge, grafik, timeline veya contextual footage ile anlatılabilecek noktalar
- Kullanılmaması gereken kişisel anekdotlar, özgün ifadeler ve kaynağa özel unsurlar
`;

const EVIDENCE_CLASSES = new Set(["official_document", "official_figure", "source_mosaic", "document_overlay", "stat_overlay", "comparison_overlay", "process_diagram", "email_recreation", "quote_treatment", "limitation_treatment"]);
const FULL_GRAPHIC_CLASSES = new Set(["stat_overlay", "comparison_overlay", "process_diagram"]);
const MEDIA_EXTENSIONS = new Set([".mp3", ".wav", ".mp4", ".mov", ".mkv", ".webm", ".ogg", ".m4a", ".png", ".jpg", ".jpeg"]);

export class OrvyqError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrvyqError";
    this.code = code;
    this.details = details;
  }
}

export const repoRoot = () => path.resolve(process.env.ORVYQ_REPO_ROOT || process.cwd());
export const projectDir = (projectId) => path.join(repoRoot(), "projects", projectId);

export function assertProjectId(projectId) {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(String(projectId || ""))) {
    throw new OrvyqError("INVALID_PROJECT_ID", "project_id must match ^[a-z0-9][a-z0-9-]{2,79}$");
  }
}

export function safeProjectPath(projectId, relativePath = "") {
  assertProjectId(projectId);
  const base = projectDir(projectId);
  const resolved = path.resolve(base, relativePath);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new OrvyqError("PATH_ESCAPE", `Path escapes project directory: ${relativePath}`);
  }
  return resolved;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export const hashText = (text) => crypto.createHash("sha256").update(text).digest("hex");
export const hashJson = (value) => hashText(JSON.stringify(canonicalize(value)));
export const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export function isLfsPointer(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size > 1024) return false;
  const text = fs.readFileSync(file, "utf8");
  return text.startsWith("version https://git-lfs.github.com/spec/v1") && /oid sha256:[0-9a-f]{64}/.test(text);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot(),
    env: {...process.env, ...(options.env || {})},
    encoding: "utf8",
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: options.inherit ? "inherit" : "pipe"
  });
  if (result.error || result.status !== 0) {
    throw new OrvyqError(options.code || "COMMAND_FAILED", `${command} ${args.join(" ")} failed`, {
      status: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error?.message
    });
  }
  return {stdout: result.stdout || "", stderr: result.stderr || ""};
}

export function ffprobe(file) {
  const {stdout} = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {code: "FFPROBE_FAILED"});
  return JSON.parse(stdout);
}

function requireFile(file, code = "MISSING_FILE") {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new OrvyqError(code, `Required file is missing: ${file}`);
  return file;
}

function requireJson(file, code = "MISSING_JSON") {
  return readJson(requireFile(file, code));
}

function requirePass(file, code) {
  const value = requireJson(file, code);
  if (value.pass !== true || value.status === "BAŞARISIZ" || value.status === "BLOKE") {
    throw new OrvyqError(code, `QA did not pass: ${file}`);
  }
  return value;
}

export function parseNotebookAnswers(markdown) {
  const sections = {A: [], B: [], C: [], D: [], E: []};
  let active = null;
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:#{1,6}\s*)?([ABCDE])\s*(?:—|-|:)/i);
    if (match) {
      active = match[1].toUpperCase();
      continue;
    }
    if (active) sections[active].push(line);
  }
  const normalized = Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]));
  const missing = Object.entries(normalized).filter(([, text]) => text.length < 20).map(([key]) => key);
  if (missing.length) throw new OrvyqError("NOTEBOOKLM_SECTIONS_MISSING", `NotebookLM answer is missing complete sections: ${missing.join(", ")}`);
  return normalized;
}

export function buildTopicDiscovery(parsed) {
  return {
    schema_version: "1.0",
    policy: "Only A, B, D and E may enter research. C is excluded by construction.",
    sections: {A: parsed.A, B: parsed.B, D: parsed.D, E: parsed.E},
    excluded_sections: ["C"]
  };
}

function manifestFile(projectId) { return safeProjectPath(projectId, "manifest.json"); }

export function loadManifest(projectId) {
  const manifest = requireJson(manifestFile(projectId), "MANIFEST_MISSING");
  if (manifest.project_id !== projectId || !STAGES.includes(manifest.current_stage) || !REPORT_STATUSES.includes(manifest.operation_status)) {
    throw new OrvyqError("MANIFEST_INVALID", "Manifest identity, stage, or operation status is invalid");
  }
  return manifest;
}

function saveManifest(projectId, manifest) {
  writeJsonAtomic(manifestFile(projectId), manifest);
}

function transition(projectId, nextStage, reason, status = "TAMAMLANDI") {
  const manifest = loadManifest(projectId);
  if (!STAGES.includes(nextStage)) throw new OrvyqError("INVALID_STAGE", `Unknown stage: ${nextStage}`);
  manifest.history.push({from: manifest.current_stage, to: nextStage, reason, at: new Date().toISOString()});
  manifest.current_stage = nextStage;
  manifest.operation_status = status;
  manifest.updated_at = new Date().toISOString();
  saveManifest(projectId, manifest);
  return manifest;
}

export function createProject({projectId, sourceUrl, minimumMinutes = 10}) {
  assertProjectId(projectId);
  if (!/^https:\/\//.test(String(sourceUrl || ""))) throw new OrvyqError("SOURCE_URL_REQUIRED", "A reference YouTube URL is required");
  const base = projectDir(projectId);
  if (fs.existsSync(base)) throw new OrvyqError("PROJECT_EXISTS", `Project already exists: ${projectId}`);
  const directories = [
    "input", "research", "script", "voice", "storyboard", "direction", "assets/audio", "assets/footage",
    "assets/captures", "assets/graphics", "assets/music", "assets/sfx", "qa", "build", "output", "packaging"
  ];
  directories.forEach((directory) => fs.mkdirSync(path.join(base, directory), {recursive: true}));
  fs.writeFileSync(path.join(base, "input", "notebooklm_questions.md"), NOTEBOOK_QUESTIONS, "utf8");
  writeJsonAtomic(path.join(base, "input", "source.json"), {
    reference_youtube_url: sourceUrl,
    usage: "topic-and-claim-discovery-only",
    minimum_duration_seconds: Math.round(Number(minimumMinutes) * 60)
  });
  const now = new Date().toISOString();
  saveManifest(projectId, {
    schema_version: "1.0",
    project_id: projectId,
    current_stage: "source_intake",
    operation_status: "YAPILMADI",
    minimum_duration_seconds: Math.round(Number(minimumMinutes) * 60),
    attempts: {},
    created_at: now,
    updated_at: now,
    history: []
  });
  const indexFile = path.join(repoRoot(), "projects", "_index.json");
  const index = fs.existsSync(indexFile) ? readJson(indexFile) : {projects: []};
  index.projects = [...new Set([...(index.projects || []), projectId])].sort();
  writeJsonAtomic(indexFile, index);
  return loadManifest(projectId);
}

export function ingestNotebook(projectId, answersFile) {
  const manifest = loadManifest(projectId);
  if (manifest.current_stage !== "source_intake") throw new OrvyqError("INVALID_STAGE", "NotebookLM answers can only be ingested during source_intake");
  const markdown = fs.readFileSync(requireFile(path.resolve(answersFile), "NOTEBOOKLM_FILE_MISSING"), "utf8");
  const parsed = parseNotebookAnswers(markdown);
  fs.writeFileSync(safeProjectPath(projectId, "input/notebooklm_answers.md"), markdown, "utf8");
  writeJsonAtomic(safeProjectPath(projectId, "input/notebooklm_answers.parsed.json"), parsed);
  const discovery = buildTopicDiscovery(parsed);
  if (Object.prototype.hasOwnProperty.call(discovery.sections, "C") || JSON.stringify(discovery.sections).includes(parsed.C)) {
    throw new OrvyqError("SECTION_C_LEAK", "Section C entered research topic discovery");
  }
  writeJsonAtomic(safeProjectPath(projectId, "research/topic_discovery.json"), discovery);
  return transition(projectId, "research", "NotebookLM A-B-C-D-E contract accepted; research receives A-B-D-E only");
}

function validateClaims(projectId) {
  const registry = requireJson(safeProjectPath(projectId, "research/claim_registry.json"), "CLAIM_REGISTRY_MISSING");
  if (!Array.isArray(registry.claims) || !registry.claims.length) throw new OrvyqError("CLAIM_REGISTRY_EMPTY", "Claim registry must contain claims");
  const unresolved = registry.claims.filter((claim) => !["verified", "replaced", "cut"].includes(claim.status));
  if (unresolved.length) throw new OrvyqError("UNRESOLVED_CLAIM", `Unresolved claims block voice: ${unresolved.map((claim) => claim.id).join(", ")}`);
  for (const claim of registry.claims) {
    if (claim.status === "verified" && (!Array.isArray(claim.source_ids) || claim.source_ids.length === 0)) {
      throw new OrvyqError("CLAIM_SOURCE_MISSING", `Verified claim ${claim.id} has no independent source`);
    }
  }
  return registry;
}

function validateAssetRegistry(projectId, {allowFixture = false} = {}) {
  const registry = requireJson(safeProjectPath(projectId, "assets/asset_registry.json"), "ASSET_REGISTRY_MISSING");
  if (!Array.isArray(registry.assets) || !registry.assets.length) throw new OrvyqError("ASSET_REGISTRY_EMPTY", "Asset registry is empty");
  for (const asset of registry.assets) {
    const required = ["relative_path", "sha256", "byte_size", "media_type", "source_url", "license", "editorial_purpose", "claim_ids", "approved_for_final_edit"];
    for (const key of required) if (asset[key] === undefined || asset[key] === null || asset[key] === "") throw new OrvyqError("ASSET_METADATA_MISSING", `${asset.id || asset.relative_path} is missing ${key}`);
    if (!Array.isArray(asset.claim_ids)) throw new OrvyqError("ASSET_CLAIMS_INVALID", `${asset.id} claim_ids must be an array`);
    if (asset.approved_for_final_edit !== true) throw new OrvyqError("ASSET_NOT_APPROVED", `${asset.id} is not approved for final edit`);
    if (!allowFixture && /github\.com\/(?:[^/]+)\/(?:[^/]+)|raw\.githubusercontent\.com/i.test(asset.source_url) && !asset.source_url.startsWith("repo://ORVYQ-1/")) {
      throw new OrvyqError("CROSS_REPO_ASSET", `${asset.id} uses a repository URL at runtime`);
    }
    const absolute = safeProjectPath(projectId, asset.relative_path);
    requireFile(absolute, "ASSET_FILE_MISSING");
    if (isLfsPointer(absolute)) throw new OrvyqError("LFS_POINTER_NOT_BINARY", `${asset.relative_path} is an LFS pointer, not media`);
    const stat = fs.statSync(absolute);
    if (stat.size !== Number(asset.byte_size)) throw new OrvyqError("ASSET_SIZE_MISMATCH", `${asset.id} byte size mismatch`);
    if (hashFile(absolute) !== asset.sha256) throw new OrvyqError("ASSET_SHA_MISMATCH", `${asset.id} SHA-256 mismatch`);
    const extension = path.extname(absolute).toLowerCase();
    if (MEDIA_EXTENSIONS.has(extension)) {
      const probe = ffprobe(absolute);
      const streams = probe.streams || [];
      if (!streams.length) throw new OrvyqError("CORRUPT_MEDIA", `${asset.id} has no decodable media stream`);
      const duration = Number(probe.format?.duration || streams.find((stream) => stream.duration)?.duration || 0);
      if (["audio", "video"].includes(asset.media_type) && !(duration > 0)) throw new OrvyqError("MEDIA_DURATION_INVALID", `${asset.id} has invalid duration`);
      if (asset.duration_seconds != null && Math.abs(duration - Number(asset.duration_seconds)) > 0.25) throw new OrvyqError("MEDIA_DURATION_MISMATCH", `${asset.id} duration mismatch`);
      const video = streams.find((stream) => stream.codec_type === "video");
      if (asset.media_type === "video") {
        if (!video) throw new OrvyqError("VIDEO_STREAM_MISSING", `${asset.id} has no video stream`);
        if (!allowFixture && (Number(video.width) < 1920 || Number(video.height) < 1080)) throw new OrvyqError("VIDEO_BELOW_1080P", `${asset.id} is below 1080p`);
      }
    }
  }
  return registry;
}

function validateNarration(projectId, registry) {
  const narration = registry.assets.find((asset) => asset.role === "full_narration");
  if (!narration) throw new OrvyqError("FULL_NARRATION_MISSING", "A single full_narration asset is required before proof");
  if (!/^assets\/audio\//.test(narration.relative_path)) throw new OrvyqError("NARRATION_PATH_INVALID", "Full narration must live under assets/audio");
  const probe = ffprobe(safeProjectPath(projectId, narration.relative_path));
  if (!(probe.streams || []).some((stream) => stream.codec_type === "audio")) throw new OrvyqError("NARRATION_AUDIO_STREAM_MISSING", "Full narration has no audio stream");
  return narration;
}

function validateStoryboard(projectId, fullFrames) {
  const storyboard = requireJson(safeProjectPath(projectId, "storyboard/storyboard.json"), "STORYBOARD_MISSING");
  if (!Array.isArray(storyboard.scenes) || !storyboard.scenes.length) throw new OrvyqError("STORYBOARD_EMPTY", "Storyboard has no scenes");
  const scenes = [...storyboard.scenes].sort((a, b) => a.start_frame - b.start_frame);
  let cursor = 0;
  for (const scene of scenes) {
    if (scene.start_frame !== cursor || scene.end_frame <= scene.start_frame) throw new OrvyqError("STORYBOARD_COVERAGE_GAP", `Storyboard breaks at frame ${cursor}`);
    cursor = scene.end_frame;
  }
  if (cursor !== fullFrames) throw new OrvyqError("STORYBOARD_INCOMPLETE", `Storyboard ends at ${cursor}, expected ${fullFrames}`);
  return storyboard;
}

function timelineDigest(timeline) {
  const copy = structuredClone(timeline);
  delete copy.timeline_sha256;
  return hashJson(copy);
}

function validateTimeline(projectId, plan, narration) {
  const timeline = requireJson(safeProjectPath(projectId, "direction/narration_timeline.json"), "TIMELINE_MISSING");
  const required = ["source_audio", "source_audio_sha256", "source_duration_seconds", "words", "editorial_pauses", "transformed_duration_seconds", "proof_boundary", "full_final", "timeline_sha256"];
  for (const key of required) if (timeline[key] === undefined) throw new OrvyqError("TIMELINE_FIELD_MISSING", `Narration timeline is missing ${key}`);
  if (timeline.source_audio !== narration.relative_path || timeline.source_audio_sha256 !== narration.sha256) throw new OrvyqError("TIMELINE_AUDIO_MISMATCH", "Timeline does not reference the registered full narration binary");
  if (!Array.isArray(timeline.words) || !timeline.words.length) throw new OrvyqError("ALIGNMENT_MISSING", "Complete word alignment is required");
  let previousEnd = 0;
  for (const [index, word] of timeline.words.entries()) {
    if (!word.text || !Number.isFinite(word.output_start) || !Number.isFinite(word.output_end) || word.output_start < previousEnd || word.output_end <= word.output_start) {
      throw new OrvyqError("ALIGNMENT_INVALID", `Word alignment is invalid at index ${index}`);
    }
    previousEnd = word.output_end;
  }
  const finalWord = timeline.words.at(-1);
  if (timeline.full_final.word !== finalWord.text || Math.abs(Number(timeline.transformed_duration_seconds) - Number(plan.full_duration_seconds)) > 0.05) {
    throw new OrvyqError("FULL_TIMELINE_INCOMPLETE", "Timeline does not end with the full final word or full film duration");
  }
  const boundary = timeline.proof_boundary;
  if (Number(boundary.seconds) < 150 || boundary.frame !== plan.proof_boundary_frame) throw new OrvyqError("PROOF_BOUNDARY_TOO_EARLY", "Proof boundary must be at least 150 seconds and match the plan");
  if (boundary.sentence_end !== true || boundary.paragraph_end !== true || boundary.shot_boundary !== true) throw new OrvyqError("PROOF_BOUNDARY_NOT_SEMANTIC", "Proof boundary must end a sentence, paragraph, and shot");
  const boundaryWord = timeline.words[boundary.word_index];
  if (!boundaryWord || boundaryWord.text !== boundary.final_word || Math.abs(boundaryWord.output_end - boundary.seconds) > 0.12) throw new OrvyqError("PROOF_FINAL_WORD_MISMATCH", "Proof boundary does not match the declared final word");
  if (timelineDigest(timeline) !== timeline.timeline_sha256) throw new OrvyqError("TIMELINE_SHA_MISMATCH", "Narration timeline SHA-256 is stale");
  return timeline;
}

function shotDuration(shot, fps) { return (shot.end_frame - shot.start_frame) / fps; }
function overlapDuration(shot, start, end, fps) { return Math.max(0, Math.min(shot.end_frame, end) - Math.max(shot.start_frame, start)) / fps; }

function auditRange(shots, start, end, fps, label, strict = true) {
  const duration = (end - start) / fps;
  const relevant = shots.filter((shot) => shot.start_frame < end && shot.end_frame > start);
  const classes = new Set(relevant.map((shot) => shot.visual_class));
  const evidence = relevant.reduce((sum, shot) => sum + (EVIDENCE_CLASSES.has(shot.visual_class) ? overlapDuration(shot, start, end, fps) : 0), 0);
  const contextual = relevant.reduce((sum, shot) => sum + (shot.visual_class === "cinematic_footage" ? overlapDuration(shot, start, end, fps) : 0), 0);
  const generic = relevant.reduce((sum, shot) => sum + (shot.asset_class === "generic_stock" ? overlapDuration(shot, start, end, fps) : 0), 0);
  const graphic = relevant.reduce((sum, shot) => sum + (FULL_GRAPHIC_CLASSES.has(shot.visual_class) && shot.full_screen === true ? overlapDuration(shot, start, end, fps) : 0), 0);
  if (strict && duration >= 20 && classes.size < 2) throw new OrvyqError("VISUAL_CLASS_MONOTONY", `${label} has fewer than two visual classes`);
  if (strict && duration >= 30 && contextual === 0 && evidence / duration > 0.75) throw new OrvyqError("SECTION_VISUAL_BALANCE", `${label} is an evidence/document wall without contextual relief`);
  return {duration, evidence_fraction: evidence / duration, contextual_fraction: contextual / duration, generic_fraction: generic / duration, full_screen_graphic_fraction: graphic / duration, visual_classes: [...classes]};
}

function validatePlan(projectId, {smoke = false} = {}) {
  const direction = safeProjectPath(projectId, "direction");
  const forbidden = fs.readdirSync(direction).filter((name) => /(?:proof|preview|full)[-_]?(?:cut|plan)|edit_plan/i.test(name) && name !== "production_plan.json");
  if (forbidden.length) throw new OrvyqError("ALTERNATIVE_PLAN_FORBIDDEN", `Separate proof/preview/full plan files are forbidden: ${forbidden.join(", ")}`);
  const plan = requireJson(path.join(direction, "production_plan.json"), "PRODUCTION_PLAN_MISSING");
  if (!Number.isInteger(plan.fps) || !Number.isInteger(plan.full_frame_count) || plan.full_frame_count <= 0 || !Array.isArray(plan.shots) || !plan.shots.length) throw new OrvyqError("PRODUCTION_PLAN_INVALID", "Production plan core fields are invalid");
  if (Math.abs(plan.full_frame_count / plan.fps - Number(plan.full_duration_seconds)) > 0.02) throw new OrvyqError("PLAN_DURATION_MISMATCH", "Frame count and duration disagree");
  const shots = [...plan.shots].sort((a, b) => a.start_frame - b.start_frame);
  let cursor = 0;
  let evidenceChain = 0;
  const assetUses = new Map();
  const motifUses = new Map();
  for (const shot of shots) {
    if (shot.start_frame !== cursor || shot.end_frame <= shot.start_frame) throw new OrvyqError("PLAN_GAP_OR_OVERLAP", `Shot continuity breaks at frame ${cursor}`);
    const seconds = shotDuration(shot, plan.fps);
    if (!smoke && seconds > 8.001) throw new OrvyqError("SHOT_TOO_LONG", `${shot.id} exceeds 8 seconds`);
    cursor = shot.end_frame;
    evidenceChain = EVIDENCE_CLASSES.has(shot.visual_class) ? evidenceChain + seconds : 0;
    if (!smoke && evidenceChain > 15.001) throw new OrvyqError("EVIDENCE_CHAIN_TOO_LONG", `Evidence/document chain exceeds 15 seconds at ${shot.id}`);
    if (shot.physical_asset) assetUses.set(shot.physical_asset, (assetUses.get(shot.physical_asset) || 0) + 1);
    if (shot.motif_id) motifUses.set(shot.motif_id, (motifUses.get(shot.motif_id) || 0) + 1);
    if (shot.visual_class === "cinematic_footage" && shot.evidence_claim === true) throw new OrvyqError("CONTEXTUAL_AS_LITERAL_EVIDENCE", `${shot.id} labels contextual footage as literal evidence`);
  }
  if (cursor !== plan.full_frame_count) throw new OrvyqError("PLAN_INCOMPLETE", `Shots end at ${cursor}, expected ${plan.full_frame_count}`);
  const endCards = shots.filter((shot) => shot.visual_class === "orvyq_end_card");
  if (endCards.length !== 1 || endCards[0] !== shots.at(-1)) throw new OrvyqError("END_CARD_POSITION", "Exactly one ORVYQ end card must be the final shot");
  if (!smoke && !shots.some((shot) => shot.end_frame === plan.proof_boundary_frame)) throw new OrvyqError("PROOF_BOUNDARY_NOT_SHOT_END", "Proof boundary must be a shot boundary");
  if (!smoke) {
    for (const [asset, uses] of assetUses) if (uses > Number(plan.quality_policy?.max_asset_reuse || 2)) throw new OrvyqError("ASSET_REUSE_EXCESSIVE", `${asset} is used ${uses} times`);
    for (const [motif, uses] of motifUses) if (uses > Number(plan.quality_policy?.max_motif_reuse || 3)) throw new OrvyqError("MOTIF_REUSE_EXCESSIVE", `${motif} is used ${uses} times`);
    const global = auditRange(shots, 0, plan.full_frame_count, plan.fps, "full film", false);
    if (global.evidence_fraction < Number(plan.quality_policy?.evidence_fraction_min || 0.55)) throw new OrvyqError("EVIDENCE_FRACTION_LOW", "Source-backed evidence and graphics are below 55%");
    if (global.generic_fraction > Number(plan.quality_policy?.generic_stock_fraction_max || 0.25)) throw new OrvyqError("GENERIC_STOCK_HIGH", "Generic stock exceeds 25%");
    if (global.full_screen_graphic_fraction > Number(plan.quality_policy?.full_screen_graphic_fraction_max || 0.10)) throw new OrvyqError("FULL_SCREEN_GRAPHIC_HIGH", "Full-screen graphics exceed 10%");
    if (global.contextual_fraction < Number(plan.quality_policy?.contextual_fraction_min || 0.25) || global.contextual_fraction > Number(plan.quality_policy?.contextual_fraction_max || 0.40)) throw new OrvyqError("CONTEXTUAL_DISTRIBUTION", "Contextual footage must remain approximately 25–40%");
    if (!Array.isArray(plan.sections) || !plan.sections.length) throw new OrvyqError("SECTIONS_MISSING", "Full-film sections are required");
    for (const section of plan.sections) auditRange(shots, section.start_frame, section.end_frame, plan.fps, `section ${section.id}`, true);
    const windowFrames = Math.round(plan.fps * 30);
    const stepFrames = Math.round(plan.fps * 5);
    for (let start = 0; start + windowFrames <= plan.full_frame_count; start += stepFrames) auditRange(shots, start, start + windowFrames, plan.fps, `window ${start}-${start + windowFrames}`, true);
  }
  return plan;
}

function validateCaptions(projectId, plan, timeline) {
  const captions = requireJson(safeProjectPath(projectId, "direction/captions.json"), "CAPTIONS_MISSING");
  if (!Array.isArray(captions.captions) || !captions.captions.length || captions.duration_frames !== plan.full_frame_count) throw new OrvyqError("CAPTIONS_INCOMPLETE", "Captions must cover the full timeline contract");
  let previous = 0;
  for (const caption of captions.captions) {
    if (caption.start_frame < previous || caption.end_frame <= caption.start_frame || caption.end_frame > plan.full_frame_count) throw new OrvyqError("CAPTION_TIMING_INVALID", `Caption ${caption.id} is invalid`);
    previous = caption.end_frame;
  }
  const proofCaptions = captions.captions.filter((caption) => caption.end_frame <= plan.proof_boundary_frame);
  if (!proofCaptions.length || !proofCaptions.at(-1).text.toLowerCase().includes(String(timeline.proof_boundary.final_word).replace(/[^a-z0-9']/gi, "").toLowerCase())) {
    throw new OrvyqError("PROOF_CAPTION_FINAL_WORD", "Proof captions do not end with the semantic final word");
  }
  return captions;
}

function validateOriginality(projectId) {
  const originality = requirePass(safeProjectPath(projectId, "qa/originality.json"), "ORIGINALITY_QA_MISSING");
  if (originality.section_c_used_for_research === true || originality.section_c_used_for_script === true) throw new OrvyqError("SECTION_C_USED", "NotebookLM section C cannot guide research or script structure");
  if (Number(originality.source_structure_similarity) > Number(originality.maximum_similarity || 0.35)) throw new OrvyqError("SOURCE_STRUCTURE_TOO_SIMILAR", "Script structure is too similar to the source structure");
  return originality;
}

function buildRenderInput(projectId, plan, timeline, registry, captions) {
  return {schema_version: "1.0", project_id: projectId, plan, timeline, assets: registry.assets, captions: captions.captions};
}

export function validateProject(projectId, {frozen = false, smoke = false} = {}) {
  loadManifest(projectId);
  const parsed = parseNotebookAnswers(fs.readFileSync(requireFile(safeProjectPath(projectId, "input/notebooklm_answers.md"), "NOTEBOOKLM_ANSWERS_MISSING"), "utf8"));
  const discovery = requireJson(safeProjectPath(projectId, "research/topic_discovery.json"), "TOPIC_DISCOVERY_MISSING");
  if (Object.prototype.hasOwnProperty.call(discovery.sections || {}, "C") || JSON.stringify(discovery.sections || {}).includes(parsed.C)) throw new OrvyqError("SECTION_C_LEAK", "Section C leaked into research input");
  requireFile(safeProjectPath(projectId, "research/research_report.md"), "RESEARCH_REPORT_MISSING");
  requireJson(safeProjectPath(projectId, "research/source_catalog.json"), "SOURCE_CATALOG_MISSING");
  validateClaims(projectId);
  requireFile(safeProjectPath(projectId, "script/script.md"), "SCRIPT_MISSING");
  requireFile(safeProjectPath(projectId, "voice/voice_script.txt"), "VOICE_SCRIPT_MISSING");
  requirePass(safeProjectPath(projectId, "qa/research_qa.json"), "RESEARCH_QA_MISSING");
  requirePass(safeProjectPath(projectId, "qa/script_qa.json"), "SCRIPT_QA_MISSING");
  requirePass(safeProjectPath(projectId, "qa/voice_qa.json"), "VOICE_QA_MISSING");
  requirePass(safeProjectPath(projectId, "qa/storyboard_qa.json"), "STORYBOARD_QA_MISSING");
  requirePass(safeProjectPath(projectId, "qa/visual_qa.json"), "VISUAL_QA_MISSING");
  requirePass(safeProjectPath(projectId, "qa/render_qa.json"), "RENDER_QA_MISSING");
  validateOriginality(projectId);
  const registry = validateAssetRegistry(projectId, {allowFixture: smoke});
  const narration = validateNarration(projectId, registry);
  const plan = validatePlan(projectId, {smoke});
  if (!smoke && plan.full_duration_seconds < loadManifest(projectId).minimum_duration_seconds) throw new OrvyqError("MINIMUM_DURATION", "Full film is below the user minimum duration");
  validateStoryboard(projectId, plan.full_frame_count);
  const timeline = validateTimeline(projectId, plan, narration);
  const captions = validateCaptions(projectId, plan, timeline);
  const renderInput = buildRenderInput(projectId, plan, timeline, registry, captions);
  const renderInputFile = safeProjectPath(projectId, "build/render_input.json");
  if (frozen) {
    const existing = requireJson(renderInputFile, "FROZEN_RENDER_INPUT_MISSING");
    if (hashJson(existing) !== hashJson(renderInput)) throw new OrvyqError("FROZEN_RENDER_INPUT_DRIFT", "Frozen render input differs from canonical inputs");
  } else {
    writeJsonAtomic(renderInputFile, renderInput);
  }
  const result = {status: "TAMAMLANDI", project_id: projectId, plan_sha256: hashJson(plan), timeline_sha256: hashJson(timeline), asset_digest: hashJson(registry.assets), render_input_sha256: hashJson(renderInput)};
  writeJsonAtomic(safeProjectPath(projectId, "qa/candidate_preflight.json"), result);
  return result;
}

function validateStageGate(projectId, stage) {
  switch (stage) {
    case "source_intake": parseNotebookAnswers(fs.readFileSync(requireFile(safeProjectPath(projectId, "input/notebooklm_answers.md"), "NOTEBOOKLM_ANSWERS_MISSING"), "utf8")); break;
    case "research": requireFile(safeProjectPath(projectId, "research/research_report.md")); requireJson(safeProjectPath(projectId, "research/claim_registry.json")); requireJson(safeProjectPath(projectId, "research/source_catalog.json")); break;
    case "research_qa": requirePass(safeProjectPath(projectId, "qa/research_qa.json"), "RESEARCH_QA_MISSING"); break;
    case "script": requireFile(safeProjectPath(projectId, "script/script.md")); break;
    case "fact_audit": validateClaims(projectId); break;
    case "script_qa": requirePass(safeProjectPath(projectId, "qa/script_qa.json"), "SCRIPT_QA_MISSING"); validateOriginality(projectId); break;
    case "voice_script": requireFile(safeProjectPath(projectId, "voice/voice_script.txt")); break;
    case "voice_qa": requirePass(safeProjectPath(projectId, "qa/voice_qa.json"), "VOICE_QA_MISSING"); break;
    case "WAITING_FOR_AUDIO": { const registry = validateAssetRegistry(projectId); validateNarration(projectId, registry); break; }
    case "audio_alignment": requireJson(safeProjectPath(projectId, "direction/narration_timeline.json")); break;
    case "storyboard": requireJson(safeProjectPath(projectId, "storyboard/storyboard.json")); break;
    case "storyboard_qa": requirePass(safeProjectPath(projectId, "qa/storyboard_qa.json"), "STORYBOARD_QA_MISSING"); break;
    case "footage_retrieval": validateAssetRegistry(projectId); break;
    case "visual_style_bible": requireJson(safeProjectPath(projectId, "direction/visual_style_bible.json")); break;
    case "visual_asset_planning": requireJson(safeProjectPath(projectId, "direction/visual_asset_registry.json")); break;
    case "visual_qa": requirePass(safeProjectPath(projectId, "qa/visual_qa.json"), "VISUAL_QA_MISSING"); break;
    case "director": requireJson(safeProjectPath(projectId, "direction/director.json")); break;
    case "production_plan": validatePlan(projectId); break;
    case "render_qa": validateProject(projectId, {frozen: false}); break;
    default: throw new OrvyqError("MANUAL_RUNTIME_STAGE", `${stage} changes only through proof/full runtime commands`);
  }
}

export function advanceProject(projectId) {
  const manifest = loadManifest(projectId);
  if (["READY_FOR_PROOF", "WAITING_FOR_PROOF_APPROVAL", "READY_FOR_FULL_RENDER", "packaging", "final_qa", "DONE"].includes(manifest.current_stage)) throw new OrvyqError("RUNTIME_STAGE_LOCKED", `${manifest.current_stage} is controlled by proof/full runtime`);
  validateStageGate(projectId, manifest.current_stage);
  const index = STAGES.indexOf(manifest.current_stage);
  const next = STAGES[index + 1];
  return transition(projectId, next, `Gate passed for ${manifest.current_stage}`);
}

export function retryProject(projectId) {
  const manifest = loadManifest(projectId);
  manifest.attempts[manifest.current_stage] = (manifest.attempts[manifest.current_stage] || 0) + 1;
  manifest.operation_status = "YAPILMADI";
  manifest.updated_at = new Date().toISOString();
  saveManifest(projectId, manifest);
  return manifest;
}

export function candidateDigests(projectId) {
  const plan = requireJson(safeProjectPath(projectId, "direction/production_plan.json"));
  const timeline = requireJson(safeProjectPath(projectId, "direction/narration_timeline.json"));
  const assets = requireJson(safeProjectPath(projectId, "assets/asset_registry.json"));
  const captions = requireJson(safeProjectPath(projectId, "direction/captions.json"));
  const boundary = plan.proof_boundary_frame;
  const prefix = {
    shots: plan.shots.filter((shot) => shot.start_frame < boundary).map((shot) => ({...shot, end_frame: Math.min(shot.end_frame, boundary)})),
    words: timeline.words.filter((word) => word.output_end <= timeline.proof_boundary.seconds),
    captions: captions.captions.filter((caption) => caption.start_frame < boundary).map((caption) => ({...caption, end_frame: Math.min(caption.end_frame, boundary)})),
    asset_ids: [...new Set(plan.shots.filter((shot) => shot.start_frame < boundary).flatMap((shot) => shot.asset_ids || []))].sort()
  };
  return {plan_sha256: hashJson(plan), timeline_sha256: hashJson(timeline), asset_digest: hashJson(assets.assets), prefix_digest: hashJson(prefix), render_input_sha256: hashJson(requireJson(safeProjectPath(projectId, "build/render_input.json")))};
}

export function assertCandidateSha(candidateSha) {
  if (!/^[0-9a-f]{40}$/.test(String(candidateSha || ""))) throw new OrvyqError("CANDIDATE_SHA_INVALID", "candidate_sha must be exactly 40 lowercase hexadecimal characters");
  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  if (head !== candidateSha) throw new OrvyqError("CANDIDATE_SHA_MISMATCH", `Checked out ${head}, expected ${candidateSha}`);
}

function parseDetection(stderr, name) {
  const pattern = new RegExp(`${name}_start:([0-9.]+)[\\s\\S]*?${name}_duration:([0-9.]+)`, "g");
  return [...stderr.matchAll(pattern)].map((match) => ({start: Number(match[1]), duration: Number(match[2])}));
}

export function renderedQa(video, {expectedDuration, finalWordWindow, mode = "production"} = {}) {
  const probe = ffprobe(video);
  const streams = probe.streams || [];
  if (!streams.some((stream) => stream.codec_type === "video") || !streams.some((stream) => stream.codec_type === "audio")) throw new OrvyqError("RENDER_STREAMS_MISSING", "Rendered MP4 must contain video and audio streams");
  const duration = Number(probe.format?.duration || 0);
  if (!(duration > 0) || (expectedDuration && Math.abs(duration - expectedDuration) > 0.35)) throw new OrvyqError("RENDER_DURATION_INVALID", `Rendered duration ${duration} does not match ${expectedDuration}`);
  const black = spawnSync("ffmpeg", ["-v", "info", "-i", video, "-vf", "blackdetect=d=0.5:pix_th=0.10", "-an", "-f", "null", "-"], {encoding: "utf8", maxBuffer: 32 * 1024 * 1024});
  const blackSegments = parseDetection(black.stderr || "", "black");
  const nonterminalBlack = blackSegments.filter((segment) => segment.start + segment.duration < duration - 0.25);
  if (nonterminalBlack.length) throw new OrvyqError("NONTERMINAL_BLACK", "Rendered video contains a nonterminal black segment", {nonterminalBlack});
  const silence = spawnSync("ffmpeg", ["-v", "info", "-i", video, "-af", "silencedetect=n=-45dB:d=1.5", "-vn", "-f", "null", "-"], {encoding: "utf8", maxBuffer: 32 * 1024 * 1024});
  const silenceSegments = parseDetection(silence.stderr || "", "silence");
  if (silenceSegments.some((segment) => segment.duration > 3.0)) throw new OrvyqError("LONG_SILENCE", "Rendered video contains more than 3 seconds of silence");
  if (finalWordWindow && silenceSegments.some((segment) => segment.start < finalWordWindow.end && segment.start + segment.duration > finalWordWindow.start)) throw new OrvyqError("FINAL_WORD_SILENT", "Rendered audio is silent during the declared final word");
  const loud = spawnSync("ffmpeg", ["-hide_banner", "-i", video, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"], {encoding: "utf8", maxBuffer: 32 * 1024 * 1024});
  const lufsMatches = [...(loud.stderr || "").matchAll(/I:\s*(-?[0-9.]+) LUFS/g)];
  const peakMatches = [...(loud.stderr || "").matchAll(/Peak:\s*(-?[0-9.]+) dBFS/g)];
  const integratedLufs = Number(lufsMatches.at(-1)?.[1]);
  const truePeak = Number(peakMatches.at(-1)?.[1]);
  if (mode === "production" && (!Number.isFinite(integratedLufs) || integratedLufs < -19 || integratedLufs > -13 || !Number.isFinite(truePeak) || truePeak > -1.0)) throw new OrvyqError("LOUDNESS_QA", `Loudness/peak outside policy: ${integratedLufs} LUFS, ${truePeak} dBFS`);
  return {status: "TAMAMLANDI", duration_seconds: duration, streams: streams.map((stream) => ({codec_type: stream.codec_type, codec_name: stream.codec_name, width: stream.width, height: stream.height, sample_rate: stream.sample_rate, channels: stream.channels})), black_segments: blackSegments, silence_segments: silenceSegments, integrated_lufs: integratedLufs, true_peak_dbfs: truePeak};
}

function renderRemotion({propsFile, output, frames}) {
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const args = ["remotion", "render", "src/render/index.ts", "ORVYQVideo", output, `--props=${propsFile}`, "--public-dir=.", "--concurrency=1", "--max-retries=3"];
  if (frames) args.push(`--frames=${frames}`);
  run("npx", args, {inherit: true, code: "REMOTION_RENDER_FAILED"});
}

function contactSheet(video, output) {
  run("ffmpeg", ["-y", "-i", video, "-vf", "fps=1/15,scale=480:-1,tile=4x3", "-frames:v", "1", output], {code: "CONTACT_SHEET_FAILED"});
}

export function runSmoke() {
  run("bash", ["scripts/generate-smoke-fixtures.sh"], {inherit: true});
  const props = path.join(repoRoot(), "fixtures", "smoke", "render_input.json");
  const input = readJson(props);
  const endCards = input.plan.shots.filter((shot) => shot.visual_class === "orvyq_end_card");
  if (input.plan.full_duration_seconds < 10 || input.plan.full_duration_seconds > 15 || endCards.length !== 1 || endCards[0] !== input.plan.shots.at(-1)) throw new OrvyqError("SMOKE_FIXTURE_INVALID", "Smoke fixture must be 10–15 seconds with final-only end card");
  for (const asset of input.assets) requireFile(path.join(repoRoot(), asset.relative_path), "SMOKE_ASSET_MISSING");
  const output = path.join(repoRoot(), "artifacts", "smoke.mp4");
  renderRemotion({propsFile: props, output});
  const qa = renderedQa(output, {expectedDuration: input.plan.full_duration_seconds, mode: "smoke"});
  writeJsonAtomic(path.join(repoRoot(), "artifacts", "smoke-qa.json"), qa);
  return qa;
}

export function runProof({projectId, candidateSha, proofRunId}) {
  assertCandidateSha(candidateSha);
  const manifest = loadManifest(projectId);
  if (manifest.current_stage !== "READY_FOR_PROOF") throw new OrvyqError("NOT_READY_FOR_PROOF", "Manifest must be READY_FOR_PROOF");
  validateProject(projectId, {frozen: true});
  const plan = requireJson(safeProjectPath(projectId, "direction/production_plan.json"));
  const timeline = requireJson(safeProjectPath(projectId, "direction/narration_timeline.json"));
  const output = safeProjectPath(projectId, "output/proof.mp4");
  renderRemotion({propsFile: safeProjectPath(projectId, "build/render_input.json"), output, frames: `0-${plan.proof_boundary_frame - 1}`});
  const boundaryWord = timeline.words[timeline.proof_boundary.word_index];
  const qa = renderedQa(output, {expectedDuration: plan.proof_boundary_frame / plan.fps, finalWordWindow: {start: boundaryWord.output_start, end: boundaryWord.output_end}, mode: "production"});
  writeJsonAtomic(safeProjectPath(projectId, "qa/rendered.proof.json"), qa);
  const digests = candidateDigests(projectId);
  const proofManifest = {
    schema_version: "1.0",
    status: "TAMAMLANDI",
    runtime_stage: "WAITING_FOR_PROOF_APPROVAL",
    project_id: projectId,
    candidate_sha: candidateSha,
    proof_run_id: String(proofRunId),
    proof_boundary_frame: plan.proof_boundary_frame,
    proof_final_sentence: timeline.proof_boundary.final_sentence,
    proof_final_word: timeline.proof_boundary.final_word,
    ...digests,
    created_at: new Date().toISOString()
  };
  writeJsonAtomic(safeProjectPath(projectId, "build/proof_manifest.json"), proofManifest);
  contactSheet(output, safeProjectPath(projectId, "output/proof-contact-sheet.jpg"));
  return proofManifest;
}

export function validateProofForFull({projectId, candidateSha, approvedProofRunId, proofManifestFile}) {
  assertCandidateSha(candidateSha);
  const proof = requireJson(path.resolve(proofManifestFile), "PROOF_MANIFEST_MISSING");
  if (proof.project_id !== projectId || proof.candidate_sha !== candidateSha || String(proof.proof_run_id) !== String(approvedProofRunId)) throw new OrvyqError("PROOF_APPROVAL_MISMATCH", "Approved proof identity does not match project, candidate, or run ID");
  const current = candidateDigests(projectId);
  for (const key of ["plan_sha256", "timeline_sha256", "asset_digest", "prefix_digest", "render_input_sha256"]) if (proof[key] !== current[key]) throw new OrvyqError("CANDIDATE_CHANGED_AFTER_PROOF", `${key} changed after proof`);
  return {proof, current};
}

export function runFull({projectId, candidateSha, approvedProofRunId, proofManifestFile}) {
  validateProject(projectId, {frozen: true});
  const {proof} = validateProofForFull({projectId, candidateSha, approvedProofRunId, proofManifestFile});
  const plan = requireJson(safeProjectPath(projectId, "direction/production_plan.json"));
  const timeline = requireJson(safeProjectPath(projectId, "direction/narration_timeline.json"));
  const approval = {
    status: "TAMAMLANDI",
    runtime_stage: "READY_FOR_FULL_RENDER",
    project_id: projectId,
    candidate_sha: candidateSha,
    proof_run_id: String(approvedProofRunId),
    proof_prefix_digest: proof.prefix_digest,
    production_plan_sha256: proof.plan_sha256,
    narration_timeline_sha256: proof.timeline_sha256,
    human_approval_timestamp: new Date().toISOString()
  };
  writeJsonAtomic(safeProjectPath(projectId, "build/runtime-approval.json"), approval);
  const output = safeProjectPath(projectId, "output/final.mp4");
  renderRemotion({propsFile: safeProjectPath(projectId, "build/render_input.json"), output});
  const finalWord = timeline.words.at(-1);
  const qa = renderedQa(output, {expectedDuration: plan.full_duration_seconds, finalWordWindow: {start: finalWord.output_start, end: finalWord.output_end}, mode: "production"});
  writeJsonAtomic(safeProjectPath(projectId, "qa/rendered.full.json"), qa);
  const runtimeManifest = {...loadManifest(projectId), current_stage: "DONE", operation_status: "TAMAMLANDI", approved_proof_run_id: String(approvedProofRunId), candidate_sha: candidateSha, completed_at: new Date().toISOString()};
  writeJsonAtomic(safeProjectPath(projectId, "build/runtime-final-manifest.json"), runtimeManifest);
  return runtimeManifest;
}

export function temporaryProject(prefix = "orvyq-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
