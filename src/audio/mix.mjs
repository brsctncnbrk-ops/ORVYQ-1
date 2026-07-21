import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {invariant} from '../core/errors.mjs';
import {safeProjectPath} from '../core/paths.mjs';
import {writeJsonAtomic} from '../core/json.mjs';
import {validateAudioPlan} from '../contracts/audio-plan.mjs';
import {validateNarrationTimeline} from '../contracts/narration-timeline.mjs';

function run(command, args, code) {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  invariant(result.status === 0, code, `${command} failed: ${result.stderr || result.stdout}`);
  return result;
}

function dbToLinear(db) { return Math.pow(10, db / 20).toFixed(8); }

function buildNarrationFilter(timeline) {
  const pauses = [...timeline.editorial_pauses].sort((a, b) => a.source_time_seconds - b.source_time_seconds);
  const parts = [];
  const labels = [];
  let sourceCursor = 0;
  let index = 0;
  for (const pause of pauses) {
    if (pause.source_time_seconds > sourceCursor) {
      const label = `narr${index}`;
      parts.push(`[0:a]atrim=start=${sourceCursor}:end=${pause.source_time_seconds},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${label}]`);
      labels.push(`[${label}]`);
      index += 1;
    }
    const silence = `sil${index}`;
    parts.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${pause.duration_seconds},asetpts=PTS-STARTPTS[${silence}]`);
    labels.push(`[${silence}]`);
    index += 1;
    sourceCursor = pause.source_time_seconds;
  }
  if (sourceCursor < timeline.source_duration_seconds) {
    const label = `narr${index}`;
    parts.push(`[0:a]atrim=start=${sourceCursor}:end=${timeline.source_duration_seconds},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${label}]`);
    labels.push(`[${label}]`);
  }
  parts.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[paused_narration]`);
  return parts;
}

function buildMusicFilters(plan, inputIndexByPath) {
  const filters = [];
  const labels = [];
  for (const [index, cue] of plan.music_cues.entries()) {
    const assetPath = cue.asset ?? plan.music_assets[index % plan.music_assets.length];
    const inputIndex = inputIndexByPath.get(assetPath);
    invariant(inputIndex != null, 'MUSIC_CUE_ASSET_UNKNOWN', `${cue.cue_id} references unknown music asset ${assetPath}`);
    const duration = cue.end_seconds - cue.start_seconds;
    const sourceOffset = Number(cue.source_offset_seconds ?? 0);
    const fade = Math.min(1.5, duration / 4);
    const delay = Math.round(cue.start_seconds * 1000);
    const label = `music${index}`;
    filters.push(`[${inputIndex}:a]atrim=start=${sourceOffset}:duration=${duration},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, duration - fade)}:d=${fade},volume=${dbToLinear(cue.gain_db)},adelay=${delay}|${delay}[${label}]`);
    labels.push(`[${label}]`);
  }
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,atrim=duration=${plan.music_cues.at(-1).end_seconds},asetpts=PTS-STARTPTS[music_raw]`);
  return filters;
}

export async function buildAudioMix({projectId, audioPlan, timeline}) {
  validateNarrationTimeline(timeline);
  validateAudioPlan(audioPlan, {durationSeconds: timeline.transformed_duration_seconds});
  const narration = safeProjectPath(projectId, audioPlan.narration_asset);
  const musicPaths = audioPlan.music_assets.map((relative) => safeProjectPath(projectId, relative));
  const output = safeProjectPath(projectId, audioPlan.output_asset);
  await mkdir(path.dirname(output), {recursive: true});
  const inputs = ['-y', '-hide_banner', '-loglevel', 'warning', '-i', narration];
  const inputIndexByPath = new Map();
  for (const [index, relative] of audioPlan.music_assets.entries()) {
    inputs.push('-stream_loop', '-1', '-i', musicPaths[index]);
    inputIndexByPath.set(relative, index + 1);
  }
  const threshold = dbToLinear(audioPlan.ducking.threshold_db);
  const filterParts = [
    ...buildNarrationFilter(timeline),
    ...buildMusicFilters(audioPlan, inputIndexByPath),
    `[music_raw][paused_narration]sidechaincompress=threshold=${threshold}:ratio=${audioPlan.ducking.ratio}:attack=${audioPlan.ducking.attack_ms}:release=${audioPlan.ducking.release_ms}[music_ducked]`,
    `[paused_narration][music_ducked]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=${audioPlan.loudness.target_lufs}:TP=${audioPlan.loudness.true_peak_dbfs}:LRA=11,atrim=duration=${timeline.transformed_duration_seconds}[final]`
  ];
  const codec = path.extname(output).toLowerCase() === '.wav' ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'libmp3lame', '-b:a', '256k'];
  run('ffmpeg', [...inputs, '-filter_complex', filterParts.join(';'), '-map', '[final]', '-ar', '48000', '-ac', '2', ...codec, output], 'AUDIO_MIX_FAILED');
  const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', output], 'AUDIO_MIX_PROBE_FAILED');
  const duration = Number(JSON.parse(probe.stdout).format?.duration ?? 0);
  invariant(Math.abs(duration - timeline.transformed_duration_seconds) <= 0.4, 'AUDIO_MIX_DURATION_MISMATCH', `Final mix duration ${duration} does not match timeline ${timeline.transformed_duration_seconds}`);
  const metadata = {schema_version: '1.0', status: 'TAMAMLANDI', project_id: projectId, output_asset: audioPlan.output_asset, duration_seconds: duration, sample_rate: 48000, channels: 2, music_cue_count: audioPlan.music_cues.length, distinct_music_states: [...new Set(audioPlan.music_cues.map((cue) => cue.state))], editorial_pause_count: timeline.editorial_pauses.length, ducking: audioPlan.ducking, loudness_target: audioPlan.loudness, created_at: new Date().toISOString()};
  await writeJsonAtomic(safeProjectPath(projectId, 'audio/final_mix.metadata.json'), metadata);
  return metadata;
}
