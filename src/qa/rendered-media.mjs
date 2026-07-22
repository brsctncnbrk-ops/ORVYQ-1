import {spawnSync} from 'node:child_process';
import {invariant} from '../core/errors.mjs';

function run(command, args, code) {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 128 * 1024 * 1024});
  invariant(result.status === 0, code, `${command} failed: ${result.stderr || result.stdout}`);
  return result;
}

function parseBlack(stderr) {
  return [...stderr.matchAll(/black_start:([0-9.]+)\s+black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g)].map((match) => ({start: Number(match[1]), end: Number(match[2]), duration: Number(match[3])}));
}

function parseYavg(text) {
  return [...text.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)].map((match) => Number(match[1]));
}

function parseLoudness(stderr) {
  const lufs = [...stderr.matchAll(/I:\s*(-?[0-9.]+) LUFS/g)].map((match) => Number(match[1]));
  const peaks = [...stderr.matchAll(/Peak:\s*(-?[0-9.]+) dBFS/g)].map((match) => Number(match[1]));
  return {integrated_lufs: lufs.at(-1), true_peak_dbfs: peaks.at(-1)};
}

function meanVolume(file, start, duration) {
  const result = run('ffmpeg', ['-hide_banner', '-ss', String(start), '-t', String(duration), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], 'AUDIO_SEGMENT_QA_FAILED');
  const match = (result.stderr || '').match(/mean_volume:\s*(-?[0-9.]+) dB/);
  invariant(match, 'AUDIO_SEGMENT_VOLUME_MISSING', 'Could not read audio segment mean volume');
  return Number(match[1]);
}

function nearBoundary(second, boundaries, tolerance = 1.1) {
  return boundaries.some((boundary) => Math.abs(second - boundary) <= tolerance);
}

export function renderedMediaQa(file, {expectedDuration, editorialPauses = [], finalWordWindow, shotBoundarySeconds = [], allowTerminalBlackSeconds = 0.5} = {}) {
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], 'RENDER_PROBE_FAILED').stdout);
  const streams = probe.streams ?? [];
  const duration = Number(probe.format?.duration ?? 0);
  invariant(streams.some((stream) => stream.codec_type === 'video'), 'RENDER_VIDEO_STREAM_MISSING', 'Rendered media has no video stream');
  invariant(streams.some((stream) => stream.codec_type === 'audio'), 'RENDER_AUDIO_STREAM_MISSING', 'Rendered media has no audio stream');
  invariant(!expectedDuration || Math.abs(duration - expectedDuration) <= 0.4, 'RENDER_DURATION_MISMATCH', `Rendered duration ${duration} does not match ${expectedDuration}`);
  const video = streams.find((stream) => stream.codec_type === 'video');
  invariant(Number(video.width) >= 1920 && Number(video.height) >= 1080, 'RENDER_BELOW_1080P', 'Rendered media must be at least 1920x1080');

  const blackRun = run('ffmpeg', ['-v', 'info', '-i', file, '-vf', 'blackdetect=d=0.25:pix_th=0.10', '-an', '-f', 'null', '-'], 'BLACK_DETECT_FAILED');
  const blackSegments = parseBlack(blackRun.stderr || '');
  const nonterminalBlack = blackSegments.filter((segment) => segment.start + segment.duration < duration - allowTerminalBlackSeconds);
  invariant(nonterminalBlack.length === 0, 'NONTERMINAL_BLACK', 'Rendered video contains nonterminal black segments');

  const brightnessRun = run('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'fps=1,signalstats,metadata=print:file=-', '-an', '-f', 'null', '-'], 'BRIGHTNESS_QA_FAILED');
  const yavg = parseYavg(`${brightnessRun.stdout}\n${brightnessRun.stderr}`);
  invariant(yavg.length > 0, 'BRIGHTNESS_SAMPLES_MISSING', 'No brightness samples were produced');
  const minimumYavg = Math.min(...yavg);
  const darkSamples = yavg.map((value, index) => ({second: index, yavg: value})).filter((sample) => sample.yavg < 18);
  const transientDrops = [];
  for (let index = 1; index < yavg.length; index += 1) {
    if (nearBoundary(index, shotBoundarySeconds)) continue;
    if (yavg[index - 1] >= 24 && yavg[index] < yavg[index - 1] * 0.55) transientDrops.push({second: index, before: yavg[index - 1], after: yavg[index]});
  }
  invariant(minimumYavg >= 18, 'BRIGHTNESS_TOO_DARK', `Minimum YAVG ${minimumYavg} is below 18`);
  invariant(transientDrops.length === 0, 'TRANSIENT_BRIGHTNESS_DROP', 'Rendered video contains sudden within-shot brightness drops');

  const loudRun = run('ffmpeg', ['-hide_banner', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], 'LOUDNESS_QA_FAILED');
  const loudness = parseLoudness(loudRun.stderr || '');
  invariant(Number.isFinite(loudness.integrated_lufs) && loudness.integrated_lufs >= -18.5 && loudness.integrated_lufs <= -13, 'LOUDNESS_OUT_OF_RANGE', `Integrated loudness ${loudness.integrated_lufs} LUFS is outside policy`);
  invariant(Number.isFinite(loudness.true_peak_dbfs) && loudness.true_peak_dbfs <= -1, 'TRUE_PEAK_OUT_OF_RANGE', `True peak ${loudness.true_peak_dbfs} dBFS exceeds -1 dBFS`);

  const pauseVolumes = editorialPauses.map((pause) => ({pause_id: pause.pause_id, mean_volume_db: meanVolume(file, pause.output_start_seconds, Math.min(pause.duration_seconds, 4))}));
  for (const pause of pauseVolumes) invariant(pause.mean_volume_db > -38, 'MUSIC_NOT_AUDIBLE_IN_PAUSE', `${pause.pause_id} is effectively silent; music bed is not audible`);
  if (pauseVolumes.length >= 2) {
    const spread = Math.max(...pauseVolumes.map((pause) => pause.mean_volume_db)) - Math.min(...pauseVolumes.map((pause) => pause.mean_volume_db));
    invariant(spread >= 0.5, 'MUSIC_DYNAMIC_STATES_NOT_RENDERED', 'Editorial pauses have no measurable music-level variation');
  }
  if (finalWordWindow) {
    const finalVolume = meanVolume(file, finalWordWindow.start, Math.max(0.25, finalWordWindow.end - finalWordWindow.start));
    invariant(finalVolume > -45, 'FINAL_WORD_SILENT', 'Final declared word is silent');
  }

  return {
    schema_version: '1.0',
    status: 'TAMAMLANDI',
    duration_seconds: duration,
    streams: streams.map((stream) => ({codec_type: stream.codec_type, codec_name: stream.codec_name, width: stream.width, height: stream.height, sample_rate: stream.sample_rate, channels: stream.channels})),
    black_segments: blackSegments,
    minimum_yavg: minimumYavg,
    dark_brightness_samples: darkSamples,
    transient_brightness_drops: transientDrops,
    brightness_sample_count: yavg.length,
    shot_boundary_seconds: shotBoundarySeconds,
    ...loudness,
    editorial_pause_audio: pauseVolumes
  };
}
