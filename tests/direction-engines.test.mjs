import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSemanticFootage} from '../src/direction/semantic-footage.mjs';
import {normalizeEditorialPauses} from '../src/direction/editorial-pauses.mjs';

const claimRegistry = {claims: [
  {claim_id: 'CLM_MARKET', text: 'Markets reward capability and intensify competitive pressure.'},
  {claim_id: 'CLM_LAW', text: 'Governments face difficult regulation and governance choices.'}
]};
const assetRegistry = {assets: [
  {asset_id: 'F1', role: 'contextual_footage', media_type: 'video', approved_for_final_edit: true, semantic_description: 'Stock market screens and financial data under pressure.', semantic_keywords: ['markets','data','pressure'], editorial_purpose: 'Market competition', source_url: 'https://example.com/market', visual_class: 'real_world'},
  {asset_id: 'F2', role: 'contextual_footage', media_type: 'video', approved_for_final_edit: true, semantic_description: 'A government chamber used for regulation and lawmaking.', semantic_keywords: ['government','regulation','law'], editorial_purpose: 'Governance choices', source_url: 'https://example.com/law', visual_class: 'real_world'},
  {asset_id: 'F3', role: 'contextual_footage', media_type: 'video', approved_for_final_edit: true, semantic_description: 'Computer code and technical software architecture.', semantic_keywords: ['computer','software','code'], editorial_purpose: 'Technical implementation', source_url: 'https://example.com/code', visual_class: 'real_world'},
  {asset_id: 'F4', role: 'contextual_footage', media_type: 'video', approved_for_final_edit: true, semantic_description: 'A connected abstract network of digital nodes.', semantic_keywords: ['network','digital','systems'], editorial_purpose: 'Connected systems', source_url: 'https://example.com/network', visual_class: 'abstract'}
]};

test('semantic selector chooses footage by meaning and records deterministic score', () => {
  const plan = {shots: [
    {shot_id: 'S1', shot_type: 'contextual_footage', claim_ids: ['CLM_MARKET'], editorial_purpose: 'Show competitive market pressure', asset_ids: ['F4']},
    {shot_id: 'S2', shot_type: 'contextual_footage', claim_ids: ['CLM_LAW'], editorial_purpose: 'Show regulation and government authority', asset_ids: ['F1']}
  ]};
  const result = selectSemanticFootage(plan, {claimRegistry, assetRegistry});
  assert.deepEqual(result.productionPlan.shots.map((shot) => shot.asset_ids[0]), ['F1', 'F2']);
  assert.equal(result.report.status, 'TAMAMLANDI');
});

test('pause normalizer adds narrative, music and visual behavior', () => {
  const productionPlan = {fps: 30, shots: [{shot_id: 'P1', shot_type: 'editorial_pause', start_frame: 300, end_frame: 420}]};
  const timeline = {editorial_pauses: [{pause_id: 'PAUSE_1', output_start_seconds: 10, output_end_seconds: 14, duration_seconds: 4, emphasis: 'WHO GETS TO DECIDE?', editorial_function: 'Hold the central governance question before the next argument.', captions_suppressed: true}]};
  const result = normalizeEditorialPauses(timeline, productionPlan);
  assert.equal(result.timeline.editorial_pauses[0].pause_type, 'open_question');
  assert.equal(result.timeline.editorial_pauses[0].music_behavior, 'sustain_under_silence');
  assert.equal(result.report.status, 'TAMAMLANDI');
});
