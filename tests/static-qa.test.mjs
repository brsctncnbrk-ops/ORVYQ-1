import test from 'node:test';
import assert from 'node:assert/strict';
import {OrvyqError} from '../src/core/errors.mjs';
import {semanticVisualQa} from '../src/qa/static.mjs';

const claimRegistry = {
  claims: [{claim_id: 'CLM_ONE'}]
};
const evidenceRegistry = {
  evidence: []
};

function contracts(editorialPurpose) {
  return {
    claimRegistry,
    evidenceRegistry,
    productionPlan: {
      shots: [{
        shot_id: 'SHOT_ONE',
        shot_type: 'contextual_footage',
        claim_ids: ['CLM_ONE'],
        evidence_claim: false,
        editorial_purpose: editorialPurpose
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
