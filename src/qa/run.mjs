import {writeJsonAtomic} from '../core/json.mjs';
import {safeProjectPath} from '../core/paths.mjs';
import {semanticVisualQa, pacingQa, mobileLegibilityQa, musicCueQa} from './static.mjs';
import {renderedMediaQa} from './rendered-media.mjs';

export async function runStaticQa(projectId, contracts) {
  const semantic = semanticVisualQa(contracts);
  const pacing = pacingQa(contracts.productionPlan);
  const mobile = mobileLegibilityQa(contracts.productionPlan);
  const music = musicCueQa(contracts.audioPlan, contracts.narrationTimeline);
  await Promise.all([
    writeJsonAtomic(safeProjectPath(projectId, 'qa/semantic_visual.json'), semantic),
    writeJsonAtomic(safeProjectPath(projectId, 'qa/pacing.json'), pacing),
    writeJsonAtomic(safeProjectPath(projectId, 'qa/mobile_legibility.json'), mobile),
    writeJsonAtomic(safeProjectPath(projectId, 'qa/music_cues.json'), music)
  ]);
  return {status: 'TAMAMLANDI', semantic, pacing, mobile, music};
}

export async function runRenderedQa(projectId, contracts, file, {mode = 'proof'} = {}) {
  const boundary = contracts.productionPlan.proof_boundary_frame / contracts.productionPlan.fps;
  const expectedDuration = mode === 'proof' ? boundary : contracts.productionPlan.full_duration_seconds;
  const pauses = contracts.narrationTimeline.editorial_pauses.filter((pause) => pause.output_start_seconds < expectedDuration);
  const words = contracts.narrationTimeline.words.filter((word) => word.output_end <= expectedDuration + 0.05);
  const finalWord = words.at(-1);
  const shotBoundarySeconds = contracts.productionPlan.shots
    .map((shot) => shot.end_frame / contracts.productionPlan.fps)
    .filter((second) => second > 0 && second < expectedDuration - 0.05);
  const qa = renderedMediaQa(file, {
    expectedDuration,
    editorialPauses: pauses,
    shotBoundarySeconds,
    finalWordWindow: finalWord ? {start: finalWord.output_start, end: finalWord.output_end} : undefined
  });
  await writeJsonAtomic(safeProjectPath(projectId, `qa/rendered.${mode}.json`), qa);
  return qa;
}
