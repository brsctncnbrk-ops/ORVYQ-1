import {invariant} from '../core/errors.mjs';

const CONTEXT_TYPES = new Set(['cinematic_hook', 'contextual_footage']);
const STOP = new Set(['the','and','that','with','from','into','while','through','this','film','provide','establish','context','contextual','nonliteral','cinematic','central','reported','under','never','presented','literal','evidence']);
const MAX_USES_PER_ASSET = 3;

function tokens(values) {
  const text = Array.isArray(values) ? values.join(' ') : String(values ?? '');
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word)));
}
function intersection(left, right) { let count = 0; for (const item of left) if (right.has(item)) count += 1; return count; }
function scoreAsset({asset, intent, recentAssetIds, globalUse}) {
  const descriptor = tokens([asset.semantic_description, ...(asset.semantic_keywords ?? []), asset.editorial_purpose, asset.source_url]);
  const matches = intersection(intent, descriptor);
  const explicit = intersection(tokens(asset.semantic_keywords ?? []), intent);
  const recencyPenalty = recentAssetIds.includes(asset.asset_id) ? 4 : 0;
  const reusePenalty = (globalUse.get(asset.asset_id) ?? 0) * 0.75;
  const realWorldBonus = asset.visual_class === 'real_world' ? 1.5 : 0.5;
  return {score: matches * 2 + explicit * 3 + realWorldBonus - recencyPenalty - reusePenalty, matches: matches + explicit};
}

export function selectSemanticFootage(productionPlan, {claimRegistry, assetRegistry}) {
  const claims = new Map(claimRegistry.claims.map((claim) => [claim.claim_id, claim]));
  const candidates = assetRegistry.assets.filter((asset) => asset.role === 'contextual_footage' && asset.media_type === 'video' && asset.approved_for_final_edit === true);
  invariant(candidates.length >= 4, 'SEMANTIC_FOOTAGE_POOL_TOO_SMALL', 'At least four approved contextual footage assets are required');
  const contextualShotCount = productionPlan.shots.filter((shot) => CONTEXT_TYPES.has(shot.shot_type)).length;
  invariant(candidates.length * MAX_USES_PER_ASSET >= contextualShotCount, 'SEMANTIC_FOOTAGE_CAPACITY_LOW', 'Footage pool cannot satisfy the three-use reuse cap');
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
    invariant(intent.size > 0, 'SEMANTIC_INTENT_EMPTY', `${shot.shot_id} has no semantic intent`);
    const available = candidates.filter((asset) => (globalUse.get(asset.asset_id) ?? 0) < MAX_USES_PER_ASSET);
    invariant(available.length > 0, 'SEMANTIC_FOOTAGE_CAP_EXHAUSTED', `${shot.shot_id} exhausted the footage reuse pool`);
    const ranked = available.map((asset) => ({asset, ...scoreAsset({asset, intent, recentAssetIds: recentAssetIds.slice(-2), globalUse})}))
      .sort((a, b) => b.score - a.score || b.matches - a.matches || (globalUse.get(a.asset.asset_id) ?? 0) - (globalUse.get(b.asset.asset_id) ?? 0) || a.asset.asset_id.localeCompare(b.asset.asset_id));
    const direct = ranked.find((item) => item.matches > 0 && !recentAssetIds.slice(-2).includes(item.asset.asset_id));
    const fallback = ranked.find((item) => item.asset.visual_class === 'real_world' && !recentAssetIds.slice(-2).includes(item.asset.asset_id)) ?? ranked[0];
    const selected = direct ?? fallback;
    invariant(selected, 'NO_SEMANTIC_FOOTAGE_MATCH', `${shot.shot_id} has no footage candidate`);
    const mode = direct ? 'direct_semantic' : 'diverse_real_world_fallback';
    const normalizedScore = Number(Math.max(0.25, selected.score).toFixed(3));
    recentAssetIds.push(selected.asset.asset_id);
    globalUse.set(selected.asset.asset_id, (globalUse.get(selected.asset.asset_id) ?? 0) + 1);
    report.push({shot_id: shot.shot_id, asset_id: selected.asset.asset_id, score: normalizedScore, mode, matched_terms: selected.matches, use_index: globalUse.get(selected.asset.asset_id), alternatives: ranked.slice(0, 4).filter((item) => item.asset.asset_id !== selected.asset.asset_id).slice(0, 3).map(({asset, score, matches}) => ({asset_id: asset.asset_id, score: Number(score.toFixed(3)), matched_terms: matches}))});
    return {...shot, asset_ids: [selected.asset.asset_id], semantic_selection: {engine: 'orvyq-semantic-v1', score: normalizedScore, mode, intent_keywords: [...intent].sort()}};
  });
  const usage = [...globalUse.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([asset_id, uses]) => ({asset_id, uses}));
  invariant(usage.every((item) => item.uses <= MAX_USES_PER_ASSET), 'SEMANTIC_REUSE_CAP_BROKEN', 'Semantic selector exceeded the footage reuse cap');
  return {productionPlan: {...productionPlan, shots}, report: {schema_version: '1.0', status: 'TAMAMLANDI', direct_selection_count: report.filter((item) => item.mode === 'direct_semantic').length, fallback_selection_count: report.filter((item) => item.mode !== 'direct_semantic').length, asset_usage: usage, selections: report}};
}
