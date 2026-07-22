import test from 'node:test';
import assert from 'node:assert/strict';
import {OrvyqError} from '../src/core/errors.mjs';
import {assertEvidenceClaimBindings, normalizeEvidenceClaimBindings} from '../src/direction/evidence-bindings.mjs';

const evidenceRegistry = {
  schema_version: '1.0',
  project_id: 'test-film',
  evidence: [
    {evidence_id: 'EVID_A', claim_ids: ['CLM_A']},
    {evidence_id: 'EVID_B', claim_ids: ['CLM_B', 'CLM_C']}
  ]
};

test('evidence bindings replace unrelated shot claims with registry-backed claims', () => {
  const plan = {
    schema_version: '1.0',
    project_id: 'test-film',
    shots: [{shot_id: 'SHOT_1', shot_type: 'primary_document', evidence_ids: ['EVID_A', 'EVID_B'], claim_ids: ['CLM_UNRELATED']}]
  };
  const result = normalizeEvidenceClaimBindings(plan, evidenceRegistry);
  assert.deepEqual(result.productionPlan.shots[0].claim_ids, ['CLM_A', 'CLM_B', 'CLM_C']);
  assert.equal(result.report.changed_shot_count, 1);
  assert.throws(() => assertEvidenceClaimBindings(plan, evidenceRegistry), (error) => error instanceof OrvyqError && error.code === 'PLAN_EVIDENCE_BINDINGS_NOT_NORMALIZED');
  assert.equal(assertEvidenceClaimBindings(result.productionPlan, evidenceRegistry).changed_shot_count, 0);
});

test('normalization is deterministic and idempotent', () => {
  const plan = {
    schema_version: '1.0',
    project_id: 'test-film',
    shots: [{shot_id: 'SHOT_1', shot_type: 'official_figure', evidence_ids: ['EVID_B'], claim_ids: ['CLM_C', 'CLM_B']}]
  };
  const first = normalizeEvidenceClaimBindings(plan, evidenceRegistry);
  const second = normalizeEvidenceClaimBindings(first.productionPlan, evidenceRegistry);
  assert.deepEqual(first.productionPlan.shots[0].claim_ids, ['CLM_B', 'CLM_C']);
  assert.equal(second.report.changed_shot_count, 0);
});
