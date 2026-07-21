import {invariant} from '../core/errors.mjs';
import {array, boolean, enumValue, number, object, repositoryRelativePath, string} from './common.mjs';

export const MUSIC_STATES = Object.freeze([
  'controlled_tension','analytical_unease','accelerating_pressure','procedural_threat','uncertain_transition','institutional_gravity','balanced_tension','constructive_momentum','reflective_resolution'
]);

export function validateAudioPlan(plan, {durationSeconds} = {}) {
  object(plan, 'AUDIO_PLAN_INVALID', 'Audio plan must be an object');
  invariant(plan.schema_version === '1.0', 'AUDIO_PLAN_SCHEMA', 'Audio plan schema_version must be 1.0');
  string(plan.project_id, 'AUDIO_PLAN_PROJECT', 'Audio plan project_id is required');
  repositoryRelativePath(plan.narration_asset, 'AUDIO_NARRATION_PATH_INVALID', 'Audio narration asset');
  const musicAssets = array(plan.music_assets, 'AUDIO_MUSIC_ASSETS_EMPTY', 'Audio plan requires at least one music asset', {min: 1});
  for (const asset of musicAssets) repositoryRelativePath(asset, 'AUDIO_MUSIC_PATH_INVALID', 'Music asset path');
  const cues = array(plan.music_cues, 'MUSIC_CUES_EMPTY', 'Audio plan requires music cues', {min: 4});
  const states = new Set();
  let cursor = 0;
  for (const cue of cues) {
    string(cue.cue_id, 'MUSIC_CUE_ID_REQUIRED', 'Music cue ID is required');
    enumValue(cue.state, MUSIC_STATES, 'MUSIC_STATE_INVALID', `${cue.cue_id} state is invalid`);
    number(cue.start_seconds, 'MUSIC_CUE_START_INVALID', `${cue.cue_id} start_seconds is invalid`, {min: cursor});
    number(cue.end_seconds, 'MUSIC_CUE_END_INVALID', `${cue.cue_id} end_seconds is invalid`, {min: cue.start_seconds + 0.5});
    number(cue.gain_db, 'MUSIC_CUE_GAIN_INVALID', `${cue.cue_id} gain_db must remain audible`, {min: -24, max: -8});
    number(cue.energy_start, 'MUSIC_CUE_ENERGY_INVALID', `${cue.cue_id} energy_start must be between 0 and 1`, {min: 0, max: 1});
    number(cue.energy_end, 'MUSIC_CUE_ENERGY_INVALID', `${cue.cue_id} energy_end must be between 0 and 1`, {min: 0, max: 1});
    string(cue.function, 'MUSIC_CUE_FUNCTION_REQUIRED', `${cue.cue_id} function is required`, {min: 12});
    string(cue.transition_out, 'MUSIC_CUE_TRANSITION_REQUIRED', `${cue.cue_id} transition_out is required`, {min: 8});
    states.add(cue.state); cursor = cue.end_seconds;
  }
  invariant(states.size >= 4, 'MUSIC_STATE_VARIETY_LOW', 'Audio plan requires at least four distinct music states');
  if (durationSeconds != null) invariant(Math.abs(cursor - durationSeconds) <= 0.5, 'MUSIC_CUE_COVERAGE_INCOMPLETE', 'Music cues must cover the full transformed timeline');
  const ducking = object(plan.ducking, 'DUCKING_MISSING', 'Narration ducking configuration is required');
  boolean(ducking.enabled, 'DUCKING_ENABLED_INVALID', 'Ducking enabled must be boolean');
  invariant(ducking.enabled, 'NARRATION_DUCKING_REQUIRED', 'Narration ducking must be enabled');
  number(ducking.threshold_db, 'DUCKING_THRESHOLD_INVALID', 'Ducking threshold must be between -30 and -12 dB', {min: -30, max: -12});
  number(ducking.ratio, 'DUCKING_RATIO_INVALID', 'Ducking ratio must be restrained between 1.5 and 4', {min: 1.5, max: 4});
  number(ducking.attack_ms, 'DUCKING_ATTACK_INVALID', 'Ducking attack must be 10–250ms', {min: 10, max: 250});
  number(ducking.release_ms, 'DUCKING_RELEASE_INVALID', 'Ducking release must be 120–1500ms', {min: 120, max: 1500});
  const floor = object(plan.music_floor, 'MUSIC_FLOOR_MISSING', 'Separate narration and pause music floors are required');
  number(floor.narration_floor_db, 'MUSIC_NARRATION_FLOOR_INVALID', 'Narration music floor must be -30 to -18 dB', {min: -30, max: -18});
  number(floor.pause_floor_db, 'MUSIC_PAUSE_FLOOR_INVALID', 'Pause music floor must be -22 to -12 dB', {min: -22, max: -12});
  number(floor.pause_boost_db, 'MUSIC_PAUSE_BOOST_INVALID', 'Editorial pauses require a 3–10 dB music lift', {min: 3, max: 10});
  invariant(floor.pause_floor_db > floor.narration_floor_db, 'MUSIC_PAUSE_NOT_ABOVE_NARRATION', 'Pause floor must be louder than narration floor');
  const loudness = object(plan.loudness, 'LOUDNESS_POLICY_MISSING', 'Loudness policy is required');
  number(loudness.target_lufs, 'LOUDNESS_TARGET_INVALID', 'Target LUFS must be between -18 and -14', {min: -18, max: -14});
  number(loudness.true_peak_dbfs, 'TRUE_PEAK_TARGET_INVALID', 'True peak must be between -3 and -1 dBFS', {min: -3, max: -1});
  repositoryRelativePath(plan.output_asset, 'AUDIO_OUTPUT_PATH_INVALID', 'Audio output asset');
  invariant(plan.output_asset.startsWith('assets/audio/'), 'AUDIO_OUTPUT_SCOPE', 'Final audio mix must live under assets/audio/');
  return plan;
}
