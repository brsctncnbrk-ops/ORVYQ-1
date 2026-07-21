import {invariant} from '../core/errors.mjs';

const CONTEXT_TYPES = new Set(['cinematic_hook', 'contextual_footage']);
const STOP = new Set(['the','and','that','with','from','into','while','through','this','film','provide','establish','context','contextual','nonliteral','cinematic','central','reported','under','never','presented','literal','evidence']);

function tokens(values) {
  const text = Array.isArray(values) ? values.join(' ') : String(values ?? '');
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word)));
}

function intersection(left, right) {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
}

function scoreAsset({asset, intent, recentAssetIds, globalUse}) {
  const descriptor = tokens([asset.semantic_description, ...(asset.semantic_keywords ?? []), asset.editorial_purpose, asset.source_url]);
  const matches = intersection(intent, descriptor);
  const explicit = intersection(tokens(asset.semantic_keywords ?? []), intent);
  const recencyPenalty = recentAssetIds.includes(asset.asset_id) ? 8 : 0;
  const reusePenalty = (globalUse.get(asset.asset_id) ?? 0) * 1.75;
  const realWorldBonus = asset.visual_class === 'real_world' ? 1.25 : 0;
  return matches * 2 + explicit * 3 + realWorldBonus - recencyPenalty - reusePenalty;
}

export function selectSemanticFootage(productionPlan, {claimRegistry, assetRegistry}) {
  const claims = new Map(claimRegistry.claims.map((claim) => [claim.claim_id, claim]));
  const candidates = assetRegistry.assets.filter((asset) => asset.role === 'contextual_footage' && asset.media_type === 'video' && asset.approved_for_final_edit === true);
  invariant(candidates.length >= 4, 'SEMANTIC_FOOTAGE_POOL_TOO_SMALL', 'At least four approved contextual footage assets are required');
  for (const asset of candidates) {
    invariant(String(asset.semantic_description ?? '').length >= 20, 'ASSET_SEMANTIC_DESCRIPTION_MISSING', `${asset.asset_id} requires semantic_description`);
    invariant((asset.semantic_keywords ?? []).length >= 3, 'ASSET_SEMANTIC_KEYWORDS_MISSING', `${asset.asset_id} requires at least three semantic_keywords`);
  }

  const recentAssetIds = [];
  const globalUse = new Map();
  const report = [];
  const shots = productionPlan.shots.map((shot) => {
    if (!CONTEXT_TYPES.has(shot.shot_type)) return shot;
    const claimText = (shot.claim_ids ?? []).map((id) => claims.get(id)?.text ?? '').join(' ');
    const intent = tokens([shot.editorial_purpose, claimText, ...(shot.semantic_keywords ?? [])]);
    const ranked = candidates.map((asset) => ({asset, score: scoreAsset({asset, intent, recentAssetIds: recentAssetIds.slice(-2), globalUse})}))
      .sort((a, b) => b.score - a.score || a.asset.asset_id.localeCompare(b.asset.asset_id));
    const selected = ranked[0];
    invariant(selected && selected.score > 0, 'NO_SEMANTIC_FOOTAGE_MATCH', `${shot.shot_id} has no defensible footage match`);
    recentAssetIds.push(selected.asset.asset_id);
    globalUse.set(selected.asset.asset_id, (globalUse.get(selected.asset.asset_id) ?? 0) + 1);
    report.push({shot_id: shot.shot_id, asset_id: selected.asset.asset_id, score: Number(selected.score.toFixed(3)), alternatives: ranked.slice(1, 4).map(({asset, score}) => ({asset_id: asset.asset_id, score: Number(score.toFixed(3))}))});
    return {...shot, asset_ids: [selected.asset.asset_id], semantic_selection: {engine: 'orvyq-semantic-v1', score: Number(selected.score.toFixed(3)), intent_keywords: [...intent].sort()}};
  });

  return {productionPlan: {...productionPlan, shots}, report: {schema_version: '1.0', status: 'TAMAMLANDI', selections: report}};
}
