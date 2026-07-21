import {OrvyqError, invariant} from './errors.mjs';

export const STAGES = Object.freeze([
  'SOURCE_INTAKE',
  'RESEARCH',
  'RESEARCH_QA',
  'SCRIPT',
  'FACT_AUDIT',
  'VOICE',
  'EVIDENCE_COLLECTION',
  'EVIDENCE_QA',
  'VISUAL_PLANNING',
  'AUDIO_MIX',
  'READY_FOR_CANDIDATE',
  'READY_FOR_PROOF',
  'WAITING_FOR_PROOF_APPROVAL',
  'READY_FOR_FULL_RENDER',
  'FINAL_QA',
  'DONE'
]);

const NEXT = new Map(STAGES.slice(0, -1).map((stage, index) => [stage, STAGES[index + 1]]));

export function assertStage(stage) {
  invariant(STAGES.includes(stage), 'STAGE_INVALID', `Unknown ORVYQ stage: ${stage}`);
  return stage;
}

export function nextStage(stage) {
  assertStage(stage);
  return NEXT.get(stage) ?? null;
}

export function assertTransition(from, to) {
  assertStage(from);
  assertStage(to);
  const expected = nextStage(from);
  if (expected !== to) {
    throw new OrvyqError('STAGE_TRANSITION_INVALID', `Cannot transition from ${from} to ${to}; expected ${expected ?? 'no further stage'}`);
  }
  return true;
}

export function transitionManifest(manifest, to, reason) {
  assertTransition(manifest.current_stage, to);
  invariant(typeof reason === 'string' && reason.trim().length >= 8, 'TRANSITION_REASON_REQUIRED', 'A meaningful transition reason is required');
  const now = new Date().toISOString();
  return {
    ...manifest,
    current_stage: to,
    operation_status: 'TAMAMLANDI',
    updated_at: now,
    history: [
      ...(Array.isArray(manifest.history) ? manifest.history : []),
      {from: manifest.current_stage, to, reason: reason.trim(), at: now}
    ]
  };
}
