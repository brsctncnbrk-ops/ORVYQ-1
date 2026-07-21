import test from 'node:test';
import assert from 'node:assert/strict';
import {OrvyqError} from '../src/core/errors.mjs';
import {validateSourceCatalog} from '../src/contracts/source-catalog.mjs';
import {validateClaimRegistry} from '../src/contracts/claim-registry.mjs';
import {validateEvidenceRegistry} from '../src/contracts/evidence-registry.mjs';
import {validateAudioPlan} from '../src/contracts/audio-plan.mjs';
import {validateProductionPlan} from '../src/contracts/production-plan.mjs';

const sourceCatalog = validateSourceCatalog({
  schema_version: '1.0',
  project_id: 'test-film',
  sources: [{source_id: 'SRC_OFFICIAL', title: 'Official report', publisher: 'Official Publisher', url: 'https://example.gov/report.pdf', kind: 'primary', active: true, required: true, accessed_at: '2026-07-21T00:00:00.000Z', license_or_basis: 'Official publication used for criticism and commentary'}]
});

const claimRegistry = validateClaimRegistry({
  schema_version: '1.0',
  project_id: 'test-film',
  claims: [{claim_id: 'CLM_ONE', text: 'The official report describes a documented threshold.', section_id: 'SEC_ONE', status: 'verified', source_ids: ['SRC_OFFICIAL'], visual_evidence_requirement: 'required', confidence: 0.95}]
}, {sourceCatalog});

test('primary evidence rejects SVG editorial cards', () => {
  assert.throws(() => validateEvidenceRegistry({
    schema_version: '1.0',
    project_id: 'test-film',
    evidence: [{evidence_id: 'EVID_ONE', evidence_type: 'primary_document', relative_path: 'evidence/documents/card.svg', sha256: 'a'.repeat(64), byte_size: 5000, source_url: 'https://example.gov/report.pdf', source_ids: ['SRC_OFFICIAL'], claim_ids: ['CLM_ONE'], provenance_mode: 'official_primary_capture', caption: 'Official report page', license_or_basis: 'Official publication'}]
  }, {sourceCatalog, claimRegistry}), (error) => error instanceof OrvyqError && error.code === 'PRIMARY_SOURCE_PIXELS_REQUIRED');
});

test('primary evidence accepts real raster capture metadata', () => {
  const registry = validateEvidenceRegistry({
    schema_version: '1.0',
    project_id: 'test-film',
    evidence: [{evidence_id: 'EVID_ONE', evidence_type: 'primary_document', relative_path: 'evidence/documents/page.png', sha256: 'a'.repeat(64), byte_size: 5000, source_url: 'https://example.gov/report.pdf', source_ids: ['SRC_OFFICIAL'], claim_ids: ['CLM_ONE'], provenance_mode: 'official_primary_capture', caption: 'Official report page one', license_or_basis: 'Official publication', page_number: 1}]
  }, {sourceCatalog, claimRegistry});
  assert.equal(registry.evidence[0].evidence_id, 'EVID_ONE');
});

test('audio plan requires four distinct states and continuous coverage', () => {
  const base = {
    schema_version: '1.0', project_id: 'test-film', narration_asset: 'assets/narration/final.mp3', music_assets: ['assets/music/bed.mp3'],
    music_cues: [
      {cue_id: 'A', state: 'controlled_tension', start_seconds: 0, end_seconds: 25, gain_db: -20, energy_start: .2, energy_end: .4, function: 'Open with restrained competitive tension', transition_out: 'Thin into procedural evidence'},
      {cue_id: 'B', state: 'analytical_unease', start_seconds: 25, end_seconds: 50, gain_db: -21, energy_start: .3, energy_end: .5, function: 'Support source reading without trailer drama', transition_out: 'Introduce a measured pulse'},
      {cue_id: 'C', state: 'accelerating_pressure', start_seconds: 50, end_seconds: 75, gain_db: -18, energy_start: .5, energy_end: .7, function: 'Carry strategic pressure through the pivot', transition_out: 'Reduce rhythm before limitation'},
      {cue_id: 'D', state: 'reflective_resolution', start_seconds: 75, end_seconds: 100, gain_db: -22, energy_start: .4, energy_end: .1, function: 'Release tension without triumph or catastrophe', transition_out: 'Decay naturally into the next section'}
    ],
    ducking: {enabled: true, threshold_db: -24, ratio: 6, attack_ms: 30, release_ms: 450},
    loudness: {target_lufs: -16, true_peak_dbfs: -1.5}, output_asset: 'assets/audio/final_mix.mp3'
  };
  assert.equal(validateAudioPlan(base, {durationSeconds: 100}).music_cues.length, 4);
  assert.throws(() => validateAudioPlan({...base, music_cues: base.music_cues.map((cue) => ({...cue, state: 'controlled_tension'}))}, {durationSeconds: 100}), (error) => error instanceof OrvyqError && error.code === 'MUSIC_STATE_VARIETY_LOW');
});

test('production plan rejects metric-driven half-second relief cuts', () => {
  const plan = {
    schema_version: '1.0', project_id: 'test-film', fps: 30, width: 1920, height: 1080, full_frame_count: 18000, full_duration_seconds: 600, proof_boundary_frame: 4500, audio_mix_asset: 'assets/audio/final_mix.mp3',
    sections: [{section_id: 'A', title: 'A', start_frame: 0, end_frame: 9000}, {section_id: 'B', title: 'B', start_frame: 9000, end_frame: 18000}],
    shots: [{shot_id: 's1', shot_type: 'contextual_footage', start_frame: 0, end_frame: 15, claim_ids: ['CLM_ONE'], asset_ids: [], editorial_purpose: 'Provide meaningful contextual visual support', motif_id: 'm1', evidence_claim: false}, {shot_id: 's2', shot_type: 'brand_close', start_frame: 15, end_frame: 18000, claim_ids: [], editorial_purpose: 'Close the complete documentary with the ORVYQ identity', motif_id: 'm2'}]
  };
  assert.throws(() => validateProductionPlan(plan, {claimRegistry, minimumDurationSeconds: 600}), (error) => error instanceof OrvyqError && error.code === 'SHOT_TOO_SHORT');
});
