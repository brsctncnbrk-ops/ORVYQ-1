import test from 'node:test';
import assert from 'node:assert/strict';
import {OrvyqError} from '../src/core/errors.mjs';
import {semanticVisualQa, editorialPauseQa} from '../src/qa/static.mjs';

const claimRegistry = {
  claims: [{claim_id: 'CLM_ONE', summary: 'Competitive AI development pressure changes accountability.'}]
};
const evidenceRegistry = {evidence: []};
const assetRegistry = {
  assets: [{
    asset_id: 'F1',
    editorial_purpose: 'Contextual footage of competitive technology development pressure.',
    semantic_description: 'Technology teams working under competitive pressure.',
    semantic_keywords: ['technology', 'competitive', 'pressure'],
    source_url: 'https://example.com/technology-pressure.mp4'
  }]
};

function contracts(editorialPurpose, overrides = {}) {
  return {
    claimRegistry,
    evidenceRegistry,
    assetRegistry: overrides.assetRegistry ?? assetRegistry,
    productionPlan: {
      shots: [{
        shot_id: 'SHOT_ONE',
        shot_type: 'contextual_footage',
        claim_ids: ['CLM_ONE'],
        asset_ids: ['F1'],
        semantic_keywords: ['technology', 'competitive', 'pressure'],
        evidence_claim: false,
        editorial_purpose: editorialPurpose,
        ...overrides.shot
      }]
    }
  };
}

test('semantic QA accepts words that merely contain ratio as letters', () => {
  const report = semanticVisualQa(contracts('Explain how open and closed development strategies change accountability trade-offs.'));
  assert.equal(report.status, 'TAMAMLANDI');
});

test('semantic QA rejects metric-driven filler language as whole words', () => {
  assert.throws(
    () => semanticVisualQa(contracts('Add generic filler footage to satisfy the visual ratio.')),
    (error) => error instanceof OrvyqError && error.code === 'EDITORIAL_PURPOSE_NONSEMANTIC'
  );
});

test('semantic QA rejects footage without a defensible semantic connection', () => {
  const unrelatedRegistry = {
    assets: [{asset_id: 'F1', editorial_purpose: 'Ocean wildlife atmosphere.', semantic_description: 'Whales underwater.', semantic_keywords: ['ocean', 'whale'], source_url: 'https://example.com/whales.mp4'}]
  };
  assert.throws(
    () => semanticVisualQa(contracts('Explain competitive AI development pressure.', {assetRegistry: unrelatedRegistry, shot: {semantic_keywords: []}})),
    (error) => error instanceof OrvyqError && error.code === 'CONTEXTUAL_SEMANTIC_MISMATCH'
  );
});

test('editorial pause QA requires a matching pause shot and meaningful function', () => {
  const timeline = {
    transformed_duration_seconds: 120,
    editorial_pauses: [
      {pause_id: 'P1', duration_seconds: 4, captions_suppressed: true, editorial_function: 'Let the central consequence land before the argument turns.', emphasis: 'THE CONSEQUENCE', output_start_seconds: 30, output_end_seconds: 34},
      {pause_id: 'P2', duration_seconds: 5, captions_suppressed: true, editorial_function: 'Create a final breath before the concluding human choice.', emphasis: 'THE CHOICE', output_start_seconds: 90, output_end_seconds: 95}
    ]
  };
  const productionPlan = {
    fps: 30,
    shots: [
      {shot_id: 'PAUSE_1', shot_type: 'editorial_pause', start_frame: 900, end_frame: 1020},
      {shot_id: 'PAUSE_2', shot_type: 'editorial_pause', start_frame: 2700, end_frame: 2850}
    ]
  };
  assert.equal(editorialPauseQa(timeline, productionPlan).status, 'TAMAMLANDI');
});
