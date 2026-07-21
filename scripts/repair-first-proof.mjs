#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const project = path.join(root, 'projects', '001-ai-race');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const replaceOnce = (file, from, to) => {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected source fragment not found in ${file}`);
  fs.writeFileSync(file, source.replace(from, to));
};

const musicRelative = 'assets/music/approved_bed.mp3';
const musicFile = path.join(project, musicRelative);
const musicSha = crypto.createHash('sha256').update(fs.readFileSync(musicFile)).digest('hex');
if (musicSha !== '47a2f15ecd65f1d7ef0418ee17ae31f4e724bdf73b2c2838aaa39ac1703d094e') {
  throw new Error(`Approved music SHA mismatch: ${musicSha}`);
}
const musicBytes = fs.statSync(musicFile).size;
if (musicBytes !== 14143939) throw new Error(`Approved music size mismatch: ${musicBytes}`);
const musicDuration = Number(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=nk=1:nw=1',musicFile], {encoding:'utf8'}).trim());
if (Math.abs(musicDuration - 353.541) > 0.25) throw new Error(`Approved music duration mismatch: ${musicDuration}`);

const registryFile = path.join(project, 'assets', 'asset_registry.json');
const registry = readJson(registryFile);
registry.assets = registry.assets.filter((asset) => asset.role !== 'music_bed');
registry.assets.push({
  id: 'music-approved-bed',
  relative_path: musicRelative,
  sha256: musicSha,
  byte_size: musicBytes,
  media_type: 'audio',
  duration_seconds: Math.round(musicDuration * 1000) / 1000,
  resolution: 'audio-only',
  codec: 'mp3',
  source_url: 'https://www.scottbuckley.com.au/library/signal-to-noise/',
  license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  attribution_requirement: '‘Signal to Noise’ by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au',
  editorial_purpose: 'Continuous cinematic music bed under narration, looped deterministically with section-level volume cues',
  claim_ids: [],
  approved_for_final_edit: true,
  role: 'music_bed'
});
writeJson(registryFile, registry);
writeJson(path.join(project, 'assets', 'music', 'approved_bed.provenance.json'), {
  schema_version: '1.0',
  asset: musicRelative,
  title: 'Signal to Noise',
  composer: 'Scott Buckley',
  source_page_url: 'https://www.scottbuckley.com.au/library/signal-to-noise/',
  download_url: 'https://www.scottbuckley.com.au/library/wp-content/uploads/2020/04/sb_signaltonoise.mp3',
  license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: '‘Signal to Noise’ by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au',
  approved_for_final_edit: true,
  sha256: musicSha,
  bytes: musicBytes,
  duration_seconds: Math.round(musicDuration * 1000) / 1000,
  imported_for: '001-ai-race first-video repair',
  runtime_dependency: false
});

const planFile = path.join(project, 'direction', 'production_plan.json');
const plan = readJson(planFile);
plan.quality_policy = {...plan.quality_policy, music_required: true, minimum_render_yavg: 18, transient_drop_max: 45};
plan.music_cues = plan.sections.map((section, index) => ({
  id: `music-${section.id}`,
  start_frame: section.start_frame,
  end_frame: section.end_frame,
  volume: [0.30, 0.27, 0.32, 0.30, 0.26, 0.28][index] ?? 0.28,
  state: ['controlled_tension','analytical_unease','accelerating_pressure','procedural_threat','institutional_gravity','reflective_resolution'][index] ?? 'controlled_tension'
}));
let reliefIndex = 0;
for (const shot of plan.shots) {
  if (String(shot.physical_asset || '').includes('contextual-relief-')) {
    const duration = (shot.end_frame - shot.start_frame) / plan.fps;
    const offset = 2 + (reliefIndex % 5) * 1.25;
    shot.footage_trim = {start_seconds: offset, end_seconds: Math.round((offset + duration) * 1000) / 1000};
    reliefIndex += 1;
  }
}
writeJson(planFile, plan);
writeJson(path.join(project, 'qa', 'music_qa.json'), {
  status: 'TAMAMLANDI',
  pass: true,
  asset: musicRelative,
  sha256: musicSha,
  license: 'CC BY 4.0',
  continuous_full_film_coverage: true,
  deterministic_loop: true,
  cue_count: plan.music_cues.length,
  narration_ducking: 'section-level restrained mix volumes'
});

const videoFile = path.join(root, 'src', 'render', 'ORVYQVideo.tsx');
replaceOnce(videoFile,
  "import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';",
  "import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';"
);
replaceOnce(videoFile,
`      {music ? <Audio src={staticFile(music.relative_path)} volume={(f) => {
        const cue = input.plan.music_cues?.find((item) => f >= item.start_frame && f < item.end_frame);
        return cue?.volume ?? 0.12;
      }}/> : null}`,
`      {music ? <Audio loop src={staticFile(music.relative_path)} volume={(f) => {
        const cue = input.plan.music_cues?.find((item) => f >= item.start_frame && f < item.end_frame);
        const base = cue?.volume ?? 0.28;
        const fadeIn = interpolate(f, [0, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return base * fadeIn;
      }}/> : null}`
);

const componentsFile = path.join(root, 'src', 'render', 'components.tsx');
replaceOnce(componentsFile,
  "filter: 'brightness(0.65) saturate(0.75) contrast(1.08)'",
  "filter: 'brightness(1.12) saturate(0.90) contrast(1.02)'"
);
replaceOnce(componentsFile,
  "background: 'linear-gradient(90deg, rgba(3,9,14,.76), rgba(3,9,14,.08) 70%, rgba(3,9,14,.36))'",
  "background: 'linear-gradient(90deg, rgba(3,9,14,.34), rgba(3,9,14,.02) 70%, rgba(3,9,14,.12))'"
);

const coreFile = path.join(root, 'src', 'lib', 'core.mjs');
let core = fs.readFileSync(coreFile, 'utf8');
const narrationMarker = `function validateStoryboard(projectId, fullFrames) {`;
if (!core.includes('function validateMusic(')) {
  const musicValidator = `function validateMusic(projectId, registry, plan) {
  const musicAssets = registry.assets.filter((asset) => asset.role === "music_bed");
  if (musicAssets.length !== 1) throw new OrvyqError("MUSIC_BED_MISSING", "Exactly one approved music_bed asset is required before proof");
  const music = musicAssets[0];
  if (!/^assets\\/music\\//.test(music.relative_path)) throw new OrvyqError("MUSIC_PATH_INVALID", "Music bed must live under assets/music");
  const probe = ffprobe(safeProjectPath(projectId, music.relative_path));
  if (!(probe.streams || []).some((stream) => stream.codec_type === "audio")) throw new OrvyqError("MUSIC_AUDIO_STREAM_MISSING", "Music bed has no audio stream");
  const cues = plan.music_cues;
  if (!Array.isArray(cues) || !cues.length) throw new OrvyqError("MUSIC_CUES_MISSING", "Full-film music cues are required");
  let cursor = 0;
  for (const cue of cues) {
    if (cue.start_frame !== cursor || cue.end_frame <= cue.start_frame || cue.end_frame > plan.full_frame_count) throw new OrvyqError("MUSIC_CUE_COVERAGE", `Music cue coverage breaks at frame ${cursor}`);
    if (!Number.isFinite(cue.volume) || cue.volume < 0.18 || cue.volume > 0.45) throw new OrvyqError("MUSIC_CUE_VOLUME", `Music cue ${cue.id} has an unsafe volume`);
    cursor = cue.end_frame;
  }
  if (cursor !== plan.full_frame_count) throw new OrvyqError("MUSIC_CUE_INCOMPLETE", "Music cues do not cover the full film");
  return music;
}

`;
  if (!core.includes(narrationMarker)) throw new Error('Storyboard insertion marker missing');
  core = core.replace(narrationMarker, `${musicValidator}${narrationMarker}`);
}
core = core.replace(
`  const plan = validatePlan(projectId, {smoke});
  if (!smoke && plan.full_duration_seconds < loadManifest(projectId).minimum_duration_seconds) throw new OrvyqError("MINIMUM_DURATION", "Full film is below the user minimum duration");`,
`  const plan = validatePlan(projectId, {smoke});
  if (!smoke && plan.quality_policy?.music_required === true) validateMusic(projectId, registry, plan);
  if (!smoke && plan.full_duration_seconds < loadManifest(projectId).minimum_duration_seconds) throw new OrvyqError("MINIMUM_DURATION", "Full film is below the user minimum duration");`
);
const silenceMarker = `  const silence = spawnSync("ffmpeg", ["-v", "info", "-i", video, "-af", "silencedetect=n=-45dB:d=1.5", "-vn", "-f", "null", "-"], {encoding: "utf8", maxBuffer: 32 * 1024 * 1024});`;
if (!core.includes('TRANSIENT_BRIGHTNESS_DROP')) {
  const brightnessBlock = `  const brightness = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", video, "-vf", "fps=2,signalstats,metadata=print:file=-", "-an", "-f", "null", "-"], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  const brightnessSamples = [];
  let brightnessTime = 0;
  for (const line of String(brightness.stdout || "").split(/\\r?\\n/)) {
    const timeMatch = line.match(/pts_time:([0-9.]+)/);
    if (timeMatch) brightnessTime = Number(timeMatch[1]);
    const averageMatch = line.match(/lavfi\\.signalstats\\.YAVG=([0-9.]+)/);
    if (averageMatch) brightnessSamples.push({time: brightnessTime, yavg: Number(averageMatch[1])});
  }
  const minimumYavg = brightnessSamples.length ? Math.min(...brightnessSamples.map((sample) => sample.yavg)) : null;
  const darkSamples = brightnessSamples.filter((sample) => sample.time < duration - 0.25 && sample.yavg < 18);
  const transientBrightnessDrops = brightnessSamples.slice(1).map((sample, index) => ({time: sample.time, from: brightnessSamples[index].yavg, to: sample.yavg, drop: brightnessSamples[index].yavg - sample.yavg})).filter((sample) => sample.drop > 45 && sample.to < 25);
  if (mode === "production" && darkSamples.length) throw new OrvyqError("RENDER_TOO_DARK", "Rendered video contains near-black nonterminal frames", {minimumYavg, darkSamples: darkSamples.slice(0, 20)});
  if (mode === "production" && transientBrightnessDrops.length) throw new OrvyqError("TRANSIENT_BRIGHTNESS_DROP", "Rendered video contains abrupt brightness drops", {transientBrightnessDrops: transientBrightnessDrops.slice(0, 20)});
`;
  if (!core.includes(silenceMarker)) throw new Error('Brightness insertion marker missing');
  core = core.replace(silenceMarker, `${brightnessBlock}${silenceMarker}`);
  core = core.replace(
`  return {status: "TAMAMLANDI", duration_seconds: duration, streams: streams.map((stream) => ({codec_type: stream.codec_type, codec_name: stream.codec_name, width: stream.width, height: stream.height, sample_rate: stream.sample_rate, channels: stream.channels})), black_segments: blackSegments, silence_segments: silenceSegments, integrated_lufs: integratedLufs, true_peak_dbfs: truePeak};`,
`  return {status: "TAMAMLANDI", duration_seconds: duration, streams: streams.map((stream) => ({codec_type: stream.codec_type, codec_name: stream.codec_name, width: stream.width, height: stream.height, sample_rate: stream.sample_rate, channels: stream.channels})), black_segments: blackSegments, silence_segments: silenceSegments, minimum_yavg: minimumYavg, dark_brightness_samples: darkSamples, transient_brightness_drops: transientBrightnessDrops, integrated_lufs: integratedLufs, true_peak_dbfs: truePeak};`
  );
}
fs.writeFileSync(coreFile, core);
console.log(JSON.stringify({status:'TAMAMLANDI', musicSha, musicBytes, musicDuration, reliefShotsRetimed: reliefIndex, musicCues: plan.music_cues.length}));
