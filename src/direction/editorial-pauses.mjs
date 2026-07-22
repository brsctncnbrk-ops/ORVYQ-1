import {invariant} from '../core/errors.mjs';

function classifyPause(emphasis = '') {
  const text = emphasis.toLowerCase();
  if (text.includes('?')) return 'open_question';
  if (/not |never|limit|risk|lose/.test(text)) return 'warning_pivot';
  if (/must|choice|people|right now/.test(text)) return 'resolution_pivot';
  return 'thesis_emphasis';
}

export function normalizeEditorialPauses(timeline, productionPlan) {
  const fps = productionPlan.fps;
  const pauseShots = productionPlan.shots.filter((shot) => shot.shot_type === 'editorial_pause');
  const normalized = (timeline.editorial_pauses ?? []).map((pause, index) => {
    const matchingShot = pauseShots.find((shot) => shot.start_frame / fps <= pause.output_start_seconds + 0.15 && shot.end_frame / fps >= pause.output_end_seconds - 0.15);
    invariant(matchingShot, 'EDITORIAL_PAUSE_SHOT_MISSING', `${pause.pause_id} has no matching editorial_pause shot`);
    const pauseType = pause.pause_type ?? classifyPause(pause.emphasis);
    const musicBehavior = pause.music_behavior ?? (pauseType === 'warning_pivot' ? 'rise_then_hold' : pauseType === 'resolution_pivot' ? 'open_then_decay' : 'sustain_under_silence');
    const visualBehavior = pause.visual_behavior ?? (pauseType === 'open_question' ? 'single_symbolic_hold' : 'single_meaningful_hold');
    const narrativeTrigger = pause.narrative_trigger ?? `After narration lands on: ${pause.emphasis}`;
    invariant(index === 0 || pause.output_start_seconds - timeline.editorial_pauses[index - 1].output_end_seconds >= 20, 'EDITORIAL_PAUSES_CLUSTERED', `${pause.pause_id} is too close to the previous pause`);
    return {...pause, pause_type: pauseType, narrative_trigger: narrativeTrigger, music_behavior: musicBehavior, visual_behavior: visualBehavior};
  });
  return {
    timeline: {...timeline, editorial_pauses: normalized},
    report: {schema_version: '1.0', status: 'TAMAMLANDI', pauses: normalized.map((pause) => ({pause_id: pause.pause_id, pause_type: pause.pause_type, music_behavior: pause.music_behavior, visual_behavior: pause.visual_behavior}))}
  };
}
