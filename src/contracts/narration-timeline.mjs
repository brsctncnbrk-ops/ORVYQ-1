import {invariant} from '../core/errors.mjs';
import {array, boolean, number, object, repositoryRelativePath, sha256, string} from './common.mjs';

export function validateNarrationTimeline(timeline) {
  object(timeline, 'TIMELINE_INVALID', 'Narration timeline must be an object');
  invariant(timeline.schema_version === '1.0', 'TIMELINE_SCHEMA', 'Narration timeline schema_version must be 1.0');
  string(timeline.project_id, 'TIMELINE_PROJECT', 'Timeline project_id is required');
  repositoryRelativePath(timeline.source_audio, 'TIMELINE_AUDIO_PATH_INVALID', 'Timeline source_audio');
  sha256(timeline.source_audio_sha256, 'TIMELINE_AUDIO_SHA_INVALID', 'Timeline source_audio_sha256');
  number(timeline.source_duration_seconds, 'TIMELINE_SOURCE_DURATION_INVALID', 'Timeline source duration must be positive', {min: 1});
  number(timeline.transformed_duration_seconds, 'TIMELINE_DURATION_INVALID', 'Timeline transformed duration must be positive', {min: timeline.source_duration_seconds});
  const words = array(timeline.words, 'TIMELINE_WORDS_EMPTY', 'Timeline must contain aligned words', {min: 1});
  let previousOutputEnd = 0;
  let previousSourceEnd = 0;
  for (const [index, word] of words.entries()) {
    object(word, 'TIMELINE_WORD_INVALID', `Timeline word ${index} must be an object`);
    string(word.text, 'TIMELINE_WORD_TEXT_INVALID', `Timeline word ${index} text is required`);
    number(word.output_start, 'TIMELINE_WORD_OUTPUT_START_INVALID', `Timeline word ${index} output_start is invalid`, {min: previousOutputEnd});
    number(word.output_end, 'TIMELINE_WORD_OUTPUT_END_INVALID', `Timeline word ${index} output_end is invalid`, {min: word.output_start});
    if (word.source_start != null || word.source_end != null) {
      number(word.source_start, 'TIMELINE_WORD_SOURCE_START_INVALID', `Timeline word ${index} source_start is invalid`, {min: previousSourceEnd});
      number(word.source_end, 'TIMELINE_WORD_SOURCE_END_INVALID', `Timeline word ${index} source_end is invalid`, {min: word.source_start});
      previousSourceEnd = word.source_end;
    }
    previousOutputEnd = word.output_end;
  }
  const pauses = array(timeline.editorial_pauses, 'TIMELINE_PAUSES_INVALID', 'editorial_pauses must be an array', {min: 1});
  let previousSourceTime = 0;
  let previousOutputEnd = 0;
  let totalPauseSeconds = 0;
  for (const pause of pauses) {
    string(pause.pause_id, 'PAUSE_ID_REQUIRED', 'Editorial pause ID is required');
    number(pause.source_time_seconds, 'PAUSE_SOURCE_TIME_INVALID', `${pause.pause_id} source_time_seconds is invalid`, {min: previousSourceTime, max: timeline.source_duration_seconds});
    number(pause.output_start_seconds, 'PAUSE_START_INVALID', `${pause.pause_id} output_start_seconds is invalid`, {min: previousOutputEnd});
    number(pause.duration_seconds, 'PAUSE_DURATION_INVALID', `${pause.pause_id} duration must be 1–12 seconds`, {min: 1, max: 12});
    const declaredEnd = pause.output_end_seconds ?? pause.output_start_seconds + pause.duration_seconds;
    number(declaredEnd, 'PAUSE_END_INVALID', `${pause.pause_id} output_end_seconds is invalid`, {min: pause.output_start_seconds + pause.duration_seconds - 0.01});
    invariant(Math.abs(declaredEnd - (pause.output_start_seconds + pause.duration_seconds)) <= 0.02, 'PAUSE_DURATION_MISMATCH', `${pause.pause_id} output end and duration disagree`);
    string(pause.editorial_function ?? pause.visual_intent, 'PAUSE_FUNCTION_REQUIRED', `${pause.pause_id} editorial function is required`, {min: 12});
    invariant(pause.captions_suppressed !== false, 'PAUSE_CAPTIONS_MUST_BE_SUPPRESSED', `${pause.pause_id} must suppress captions`);
    previousSourceTime = pause.source_time_seconds;
    previousOutputEnd = declaredEnd;
    totalPauseSeconds += pause.duration_seconds;
  }
  invariant(Math.abs(timeline.source_duration_seconds + totalPauseSeconds - timeline.transformed_duration_seconds) <= 0.75, 'TIMELINE_PAUSE_TOTAL_MISMATCH', 'Source duration plus editorial pauses must equal transformed duration');
  const boundary = object(timeline.proof_boundary, 'PROOF_BOUNDARY_MISSING', 'Timeline proof_boundary is required');
  number(boundary.seconds, 'PROOF_BOUNDARY_TOO_EARLY', 'Proof boundary must be at least 150 seconds', {min: 150, max: timeline.transformed_duration_seconds});
  number(boundary.frame, 'PROOF_BOUNDARY_FRAME_INVALID', 'Proof boundary frame must be positive', {min: 1, integer: true});
  boolean(boundary.sentence_end, 'PROOF_BOUNDARY_SENTENCE_INVALID', 'Proof boundary sentence_end must be boolean');
  boolean(boundary.paragraph_end, 'PROOF_BOUNDARY_PARAGRAPH_INVALID', 'Proof boundary paragraph_end must be boolean');
  boolean(boundary.shot_boundary, 'PROOF_BOUNDARY_SHOT_INVALID', 'Proof boundary shot_boundary must be boolean');
  invariant(boundary.sentence_end && boundary.paragraph_end && boundary.shot_boundary, 'PROOF_BOUNDARY_NOT_SEMANTIC', 'Proof boundary must end a sentence, paragraph and shot');
  string(boundary.final_word, 'PROOF_FINAL_WORD_REQUIRED', 'Proof boundary final_word is required');
  invariant(previousOutputEnd <= timeline.transformed_duration_seconds, 'TIMELINE_WORDS_EXCEED_DURATION', 'Aligned words exceed transformed duration');
  invariant(timeline.transformed_duration_seconds - previousOutputEnd <= 15, 'TIMELINE_FINAL_RELEASE_TOO_LONG', 'Final release after the last word cannot exceed 15 seconds');
  return timeline;
}
