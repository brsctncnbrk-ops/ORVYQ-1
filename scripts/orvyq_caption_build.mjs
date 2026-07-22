#!/usr/bin/env node
import path from "node:path";
import { promises as fs } from "node:fs";
import { projectDir, readJson, writeJsonAtomic } from "./lib/fs-utils.mjs";

const PROJECT_ID = "001-the-ai-race-no-one-can-afford-to-win";
const MAX_WORDS = 7;
const MAX_CHARS = 52;
const MAX_SPEECH_GAP_SECONDS = 0.8;

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalize = (value) => clean(value).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");

function recognizedWords(words = []) {
  const out = [];
  for (const word of words) {
    const text = clean(word.text);
    if (!text) continue;
    if (/^[-–—]/.test(text) && out.length) {
      const previous = out.at(-1);
      previous.text += text;
      previous.end = Number(word.end);
      previous.normalized = normalize(previous.text);
      continue;
    }
    const normalized = normalize(text);
    if (!normalized) continue;
    out.push({ text, normalized, start: Number(word.start), end: Number(word.end) });
  }
  return out;
}

function scriptWords(text) {
  return clean(text).split(" ").map((text) => ({ text, normalized: normalize(text) })).filter((word) => word.normalized);
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = saved;
    }
  }
  return row[b.length];
}

function substitutionCost(a, b) {
  if (a === b) return 0;
  const singularA = a.endsWith("s") ? a.slice(0, -1) : a;
  const singularB = b.endsWith("s") ? b.slice(0, -1) : b;
  if (singularA === singularB) return 0.2;
  const similarity = 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
  if (similarity >= 0.82) return 0.35;
  if (similarity >= 0.62) return 0.72;
  return 1.25;
}

function align(script, speech) {
  const target = script.slice(0, Math.min(script.length, speech.length + 160));
  const n = target.length;
  const m = speech.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i += 1) { dp[i][0] = i * 0.92; move[i][0] = 1; }
  for (let j = 1; j <= m; j += 1) { dp[0][j] = j * 0.92; move[0][j] = 2; }
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diagonal = dp[i - 1][j - 1] + substitutionCost(target[i - 1].normalized, speech[j - 1].normalized);
      const deleteScript = dp[i - 1][j] + 0.92;
      const insertSpeech = dp[i][j - 1] + 0.92;
      if (diagonal <= deleteScript && diagonal <= insertSpeech) { dp[i][j] = diagonal; move[i][j] = 0; }
      else if (deleteScript <= insertSpeech) { dp[i][j] = deleteScript; move[i][j] = 1; }
      else { dp[i][j] = insertSpeech; move[i][j] = 2; }
    }
  }
  let endI = Math.max(1, Math.min(n, m));
  let score = Number.POSITIVE_INFINITY;
  for (let i = Math.max(1, m - 60); i <= n; i += 1) {
    const candidate = dp[i][m] + Math.abs(i - m) * 0.004;
    if (candidate < score) { score = candidate; endI = i; }
  }
  const mapping = new Map();
  let i = endI;
  let j = m;
  while (i > 0 || j > 0) {
    const direction = move[i][j];
    if (i > 0 && j > 0 && direction === 0) { mapping.set(i - 1, j - 1); i -= 1; j -= 1; }
    else if (i > 0 && (j === 0 || direction === 1)) i -= 1;
    else if (j > 0) j -= 1;
    else break;
  }
  return { target, mapping, score };
}

function addTimings(tokens, mapping, speech) {
  const indexes = [...mapping.keys()].sort((a, b) => a - b);
  if (!indexes.length) throw new Error("No approved script words aligned to narration");
  const result = tokens.slice(0, indexes.at(-1) + 1).map((token, index) => {
    const speechIndex = mapping.get(index);
    return speechIndex === undefined ? { ...token, start: null, end: null, matched: false } : { ...token, start: speech[speechIndex].start, end: speech[speechIndex].end, matched: true };
  });
  for (let index = 0; index < result.length; index += 1) {
    if (result[index].matched) continue;
    let previous = index - 1;
    while (previous >= 0 && !result[previous].matched) previous -= 1;
    let next = index + 1;
    while (next < result.length && !result[next].matched) next += 1;
    if (previous >= 0 && next < result.length) {
      const start = Number(result[previous].end);
      const step = (Number(result[next].start) - start) / Math.max(1, next - previous);
      result[index].start = start + step * (index - previous - 1);
      result[index].end = Math.max(result[index].start + 0.04, start + step * (index - previous));
    } else if (previous >= 0) {
      result[index].start = Number(result[previous].end) + (index - previous - 1) * 0.12;
      result[index].end = result[index].start + 0.12;
    } else {
      const boundary = Math.max(0, Number(result[next]?.start || 0));
      const step = boundary / Math.max(1, next + 1);
      result[index].start = step * index;
      result[index].end = Math.max(result[index].start + 0.04, step * (index + 1));
    }
  }
  return result;
}

function chunks(words) {
  const output = [];
  let current = [];
  for (const word of words) {
    const text = current.map((item) => item.text).join(" ");
    const gap = current.length ? Number(word.start) - Number(current.at(-1).end) : 0;
    const mustBreak = current.length && (gap > MAX_SPEECH_GAP_SECONDS || current.length >= MAX_WORDS || `${text} ${word.text}`.trim().length > MAX_CHARS || (/[.!?…]$/.test(text) && current.length >= 3));
    if (mustBreak) { output.push(current); current = []; }
    current.push(word);
    if (/[.!?…]$/.test(word.text) && current.length >= 3) { output.push(current); current = []; }
  }
  if (current.length) output.push(current);
  return output;
}

export async function buildOrvyqCaptions(projectId = PROJECT_ID) {
  const dir = projectDir(projectId);
  const [composition, transcript, approvedScript, audioMetadata] = await Promise.all([
    readJson(path.join(dir, "remotion", "composition.json")),
    readJson(path.join(dir, "qa", "speech_transcript.json")),
    fs.readFile(path.join(dir, "voice", "voice_script.txt"), "utf8"),
    readJson(path.join(dir, "assets", "audio", "final_mix.metadata.json")),
  ]);
  if (!transcript.passed) throw new Error("Cannot build captions from a failed speech transcript");
  const speech = recognizedWords(transcript.words);
  if (!speech.length) throw new Error("Speech transcript has no word timestamps");
  const previewFrames = Number.parseInt(process.env.ORVYQ_PREVIEW_FRAMES || "0", 10);
  const maxFrame = previewFrames > 0 ? Math.min(previewFrames, composition.duration_frames) : composition.duration_frames;
  const maxSeconds = maxFrame / composition.fps;
  const pauses = (audioMetadata.pause_windows || []).map((pause) => ({ id: pause.pause_id, start: Math.ceil(Number(pause.start) * composition.fps), end: Math.floor(Number(pause.end) * composition.fps) }));
  const alignment = align(scriptWords(approvedScript), speech.filter((word) => word.start < maxSeconds));
  const timed = addTimings(alignment.target, alignment.mapping, speech).filter((word) => Number(word.start) < maxSeconds && Number(word.start) < Number(audioMetadata.narration_duration_seconds ?? maxSeconds));
  const captions = [];
  let previousEndFrame = 0;
  for (const chunk of chunks(timed)) {
    let startFrame = Math.max(Math.floor(Number(chunk[0].start) * composition.fps), previousEndFrame, 0);
    let endFrame = Math.min(maxFrame, Math.max(startFrame + 4, Math.ceil((Number(chunk.at(-1).end) + 0.08) * composition.fps)));
    for (const pause of pauses) {
      if (startFrame < pause.start && endFrame > pause.end) throw new Error(`Caption chunk spans editorial pause ${pause.id}`);
      if (startFrame < pause.start && endFrame > pause.start) endFrame = pause.start;
      else if (startFrame < pause.end && endFrame > pause.end) startFrame = pause.end;
    }
    if (startFrame >= maxFrame || endFrame <= startFrame) continue;
    captions.push({ caption_id: `caption_${String(captions.length + 1).padStart(3, "0")}`, scene_id: null, start_frame: startFrame, end_frame: endFrame, text: chunk.map((item) => item.text).join(" ").replace(/\s+([,.;!?])/g, "$1") });
    previousEndFrame = endFrame;
  }
  const payload = {
    schema_version: "3.1-editorial-pause-aware",
    project_id: projectId,
    fps: composition.fps,
    duration_frames: maxFrame,
    source: "qa/speech_transcript.json",
    text_source: "voice/voice_script.txt",
    alignment_method: "dynamic-programming alignment of approved script words to verified narration timestamps",
    timing_policy: "approved script text with speech-derived timings; long gaps split captions; editorial pauses remain caption-free",
    alignment: { recognized_words: speech.length, aligned_script_words: timed.length, mapped_words: alignment.mapping.size, score: Math.round(alignment.score * 1000) / 1000 },
    style: { placement: "bottom_safe", line_count: 1, max_words: MAX_WORDS, max_chars: MAX_CHARS, max_speech_gap_seconds: MAX_SPEECH_GAP_SECONDS, font_family: "Arial, Helvetica, sans-serif", font_size_px: 36, background: "none", active_word_effect: false },
    captions,
  };
  await writeJsonAtomic(path.join(dir, "remotion", "captions.json"), payload);
  return { caption_count: captions.length, duration_frames: maxFrame, text_source: payload.text_source, source: payload.source };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildOrvyqCaptions().then((result) => console.log(JSON.stringify({ ok: true, ...result }))).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
}
