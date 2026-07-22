import {invariant} from '../core/errors.mjs';

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function normalizeEvidenceClaimBindings(productionPlan, evidenceRegistry) {
  const evidenceById = new Map((evidenceRegistry.evidence ?? []).map((item) => [item.evidence_id, item]));
  const changes = [];
  const shots = productionPlan.shots.map((shot) => {
    const evidenceIds = shot.evidence_ids ?? [];
    if (evidenceIds.length === 0) return shot;

    const items = evidenceIds.map((evidenceId) => {
      const item = evidenceById.get(evidenceId);
      invariant(item, 'PLAN_EVIDENCE_UNKNOWN', `${shot.shot_id} references unknown evidence ${evidenceId}`);
      invariant(Array.isArray(item.claim_ids) && item.claim_ids.length > 0, 'EVIDENCE_CLAIMS_EMPTY', `${evidenceId} has no claim bindings`);
      return item;
    });
    const expectedClaimIds = uniqueSorted(items.flatMap((item) => item.claim_ids));
    const currentClaimIds = Array.isArray(shot.claim_ids) ? [...shot.claim_ids] : [];
    if (sameArray(currentClaimIds, expectedClaimIds)) return shot;

    changes.push({
      shot_id: shot.shot_id,
      evidence_ids: evidenceIds,
      previous_claim_ids: currentClaimIds,
      normalized_claim_ids: expectedClaimIds
    });
    return {...shot, claim_ids: expectedClaimIds};
  });

  return {
    productionPlan: {...productionPlan, shots},
    report: {
      schema_version: '1.0',
      status: 'TAMAMLANDI',
      changed_shot_count: changes.length,
      changes
    }
  };
}

export function assertEvidenceClaimBindings(productionPlan, evidenceRegistry) {
  const {report} = normalizeEvidenceClaimBindings(productionPlan, evidenceRegistry);
  invariant(report.changed_shot_count === 0, 'PLAN_EVIDENCE_BINDINGS_NOT_NORMALIZED', `${report.changed_shot_count} evidence shots have noncanonical claim bindings`);
  return report;
}
