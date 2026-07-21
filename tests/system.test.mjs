import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {
  OrvyqError, buildTopicDiscovery, candidateDigests, hashFile, hashJson, isLfsPointer,
  parseNotebookAnswers, validateProject, validateProofForFull, writeJsonAtomic
} from '../src/lib/core.mjs';

const NOTEBOOK = `## A — KONU VE ANA TEZ
A complete central topic and thesis for independent research.
## B — ANA İDDİALAR VE DOĞRULANACAK FACTLER
Ten claims, names, dates and statistics that require independent verification.
## C — KAYNAĞIN ANLATI İSKELETİ
A unique source-only hook, sequence and closing structure that must never guide the script.
## D — EKSİK SORULAR VE ÖZGÜN AÇILAR
Five original angles, counterarguments and unanswered questions for new reporting.
## E — ÖĞRENİMLER VE ÇIKARILABİLECEK MATERYAL
Documents, charts, timelines, visual evidence and source-specific elements to avoid.
`;

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof OrvyqError && error.code === code, `Expected ${code}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function makeValidRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orvyq-system-test-'));
  process.env.ORVYQ_REPO_ROOT = root;
  const projectId = '001-system-test';
  const project = path.join(root, 'projects', projectId);
  for (const directory of ['input','research','script','voice','storyboard','direction','assets/audio','assets/graphics','qa','build','output']) fs.mkdirSync(path.join(project, directory), {recursive: true});
  writeJsonAtomic(path.join(project, 'manifest.json'), {schema_version:'1.0',project_id:projectId,current_stage:'READY_FOR_PROOF',operation_status:'TAMAMLANDI',minimum_duration_seconds:0,attempts:{},history:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  fs.writeFileSync(path.join(project, 'input', 'notebooklm_answers.md'), NOTEBOOK);
  const parsed = parseNotebookAnswers(NOTEBOOK);
  writeJsonAtomic(path.join(project, 'input', 'notebooklm_answers.parsed.json'), parsed);
  writeJsonAtomic(path.join(project, 'research', 'topic_discovery.json'), buildTopicDiscovery(parsed));
  fs.writeFileSync(path.join(project, 'research', 'research_report.md'), '# Independent research\nPrimary and institutional sources verified.');
  writeJsonAtomic(path.join(project, 'research', 'source_catalog.json'), {sources:[{id:'src-1',type:'primary',url:'https://example.org/report'}]});
  writeJsonAtomic(path.join(project, 'research', 'claim_registry.json'), {claims:[{id:'claim-1',status:'verified',source_ids:['src-1']}]});
  fs.writeFileSync(path.join(project, 'script', 'script.md'), '# Original English script\nA calm, curious and essayistic nine-beat narrative.');
  fs.writeFileSync(path.join(project, 'voice', 'voice_script.txt'), 'Original full voice script for the deterministic candidate.');
  for (const name of ['research_qa','script_qa','voice_qa','storyboard_qa','visual_qa','render_qa']) writeJsonAtomic(path.join(project, 'qa', `${name}.json`), {status:'TAMAMLANDI',pass:true});
  writeJsonAtomic(path.join(project, 'qa', 'originality.json'), {status:'TAMAMLANDI',pass:true,section_c_used_for_research:false,section_c_used_for_script:false,source_structure_similarity:0.12,maximum_similarity:0.35});

  const narrationPath = path.join(project, 'assets', 'audio', 'narration.ogg');
  run('ffmpeg', ['-y','-loglevel','error','-f','lavfi','-i','sine=frequency=240:sample_rate=48000:duration=180','-ac','2','-c:a','libvorbis','-q:a','0',narrationPath], root);
  const assets = [{id:'narration',relative_path:'assets/audio/narration.ogg',sha256:hashFile(narrationPath),byte_size:fs.statSync(narrationPath).size,media_type:'audio',duration_seconds:180,resolution:null,codec:'vorbis',source_url:'repo://ORVYQ-1/fixtures/narration',license:'Repository-owned test fixture',attribution_requirement:'none',editorial_purpose:'Full narration',claim_ids:[],approved_for_final_edit:true,role:'full_narration'}];

  const shots = [];
  for (let index = 0; index < 29; index += 1) {
    const relative = `assets/graphics/shot-${String(index + 1).padStart(3,'0')}.svg`;
    const absolute = path.join(project, relative);
    fs.writeFileSync(absolute, `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#eef0ed"/><text x="100" y="180" font-size="64">SOURCE ${index + 1}</text></svg>`);
    assets.push({id:`asset-${index + 1}`,relative_path:relative,sha256:hashFile(absolute),byte_size:fs.statSync(absolute).size,media_type:'image',duration_seconds:0,resolution:'1600x900',codec:'svg',source_url:`repo://ORVYQ-1/${relative}`,license:'Repository-owned test fixture',attribution_requirement:'none',editorial_purpose:'Source-backed visual',claim_ids:['claim-1'],approved_for_final_edit:true});
    const visualClass = index % 3 === 2 ? 'cinematic_footage' : 'official_document';
    shots.push({id:`shot-${index + 1}`,start_frame:index*180,end_frame:(index+1)*180,visual_class:visualClass,physical_asset:relative,asset_ids:[`asset-${index + 1}`],asset_class:visualClass === 'cinematic_footage' ? 'contextual' : 'source_backed',evidence_claim:false,motif_id:`motif-${index + 1}`,semantic_purpose:'Test coverage',source_ids:['src-1'],claim_ids:['claim-1'],source_label:'TEST SOURCE'});
  }
  shots.push({id:'shot-30',start_frame:5220,end_frame:5400,visual_class:'orvyq_end_card',semantic_purpose:'Terminal end card',asset_ids:[],source_ids:[],claim_ids:[]});
  const sections = Array.from({length:6}, (_, index) => ({id:`section-${index + 1}`,start_frame:index*900,end_frame:(index+1)*900}));
  const plan = {schema_version:'1.0',fps:30,width:1920,height:1080,full_duration_seconds:180,full_frame_count:5400,proof_boundary_frame:4500,sections,shots,quality_policy:{max_asset_reuse:2,max_motif_reuse:3,evidence_fraction_min:0.55,generic_stock_fraction_max:0.25,full_screen_graphic_fraction_max:0.10,contextual_fraction_min:0.25,contextual_fraction_max:0.40},music_cues:[]};
  writeJsonAtomic(path.join(project, 'direction', 'production_plan.json'), plan);
  const words = Array.from({length:30}, (_, index) => ({text:`word${index + 1}`,source_start:index*6,source_end:(index+1)*6,output_start:index*6,output_end:(index+1)*6,sentence_end:true,paragraph_end:true}));
  const timeline = {schema_version:'1.0',source_audio:'assets/audio/narration.ogg',source_audio_sha256:assets[0].sha256,source_duration_seconds:180,words,editorial_pauses:[],transformed_duration_seconds:180,proof_boundary:{frame:4500,seconds:150,final_sentence:'word25',final_word:'word25',word_index:24,sentence_end:true,paragraph_end:true,shot_boundary:true},full_final:{final_sentence:'word30',word:'word30',word_index:29}};
  timeline.timeline_sha256 = hashJson(timeline);
  writeJsonAtomic(path.join(project, 'direction', 'narration_timeline.json'), timeline);
  writeJsonAtomic(path.join(project, 'direction', 'captions.json'), {schema_version:'1.0',duration_frames:5400,captions:words.map((word,index)=>({id:`caption-${index + 1}`,start_frame:index*180,end_frame:(index+1)*180,text:word.text}))});
  writeJsonAtomic(path.join(project, 'storyboard', 'storyboard.json'), {scenes:shots.map((shot)=>({id:shot.id,start_frame:shot.start_frame,end_frame:shot.end_frame,narration_range:[shot.start_frame/30,shot.end_frame/30]}))});
  writeJsonAtomic(path.join(project, 'assets', 'asset_registry.json'), {schema_version:'1.0',assets});
  writeJsonAtomic(path.join(project, 'direction', 'visual_style_bible.json'), {style:'ORVYQ premium evidence-led'});
  writeJsonAtomic(path.join(project, 'direction', 'visual_asset_registry.json'), {assets:assets.map((asset)=>asset.id)});
  writeJsonAtomic(path.join(project, 'direction', 'director.json'), {approved:true});
  validateProject(projectId);
  return {root, project, projectId};
}

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { writeJsonAtomic(file, value); }
function refreshTimelineSha(file) { const timeline = read(file); delete timeline.timeline_sha256; timeline.timeline_sha256 = hashJson(timeline); write(file, timeline); }

test('NotebookLM A-B-C-D-E is mandatory', () => {
  expectCode(() => parseNotebookAnswers('## A — KONU\nOnly A exists and all other sections are absent.'), 'NOTEBOOKLM_SECTIONS_MISSING');
});

test('NotebookLM section C is excluded from research input by construction', () => {
  const parsed = parseNotebookAnswers(NOTEBOOK);
  const discovery = buildTopicDiscovery(parsed);
  assert.deepEqual(Object.keys(discovery.sections), ['A','B','D','E']);
  assert.equal(JSON.stringify(discovery.sections).includes(parsed.C), false);
});

test('Unverified claim blocks the voice-ready candidate', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'research', 'claim_registry.json');
  write(file, {claims:[{id:'claim-1',status:'unresolved',source_ids:[]}]});
  expectCode(() => validateProject(projectId), 'UNRESOLVED_CLAIM');
});

test('Missing full narration blocks proof preflight', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'assets', 'asset_registry.json');
  const registry = read(file); registry.assets = registry.assets.filter((asset)=>asset.role !== 'full_narration'); write(file, registry);
  expectCode(() => validateProject(projectId), 'FULL_NARRATION_MISSING');
});

test('LFS pointer is never accepted as a real asset', () => {
  const {project, projectId} = makeValidRepo();
  const narration = path.join(project, 'assets', 'audio', 'narration.ogg');
  fs.writeFileSync(narration, 'version https://git-lfs.github.com/spec/v1\noid sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nsize 100\n');
  assert.equal(isLfsPointer(narration), true);
  expectCode(() => validateProject(projectId), 'LFS_POINTER_NOT_BINARY');
});

test('Corrupt MP3 is rejected by FFprobe', () => {
  const {project, projectId} = makeValidRepo();
  const registryFile = path.join(project, 'assets', 'asset_registry.json');
  const registry = read(registryFile);
  const bad = path.join(project, 'assets', 'audio', 'narration.mp3'); fs.writeFileSync(bad, 'not an mp3');
  registry.assets[0].relative_path = 'assets/audio/narration.mp3'; registry.assets[0].sha256 = hashFile(bad); registry.assets[0].byte_size = fs.statSync(bad).size; write(registryFile, registry);
  expectCode(() => validateProject(projectId), 'FFPROBE_FAILED');
});

test('Corrupt MP4 is rejected by FFprobe', () => {
  const {project, projectId} = makeValidRepo();
  const registryFile = path.join(project, 'assets', 'asset_registry.json');
  const registry = read(registryFile);
  const bad = path.join(project, 'assets', 'graphics', 'bad.mp4'); fs.writeFileSync(bad, 'not an mp4');
  registry.assets.push({id:'bad-video',relative_path:'assets/graphics/bad.mp4',sha256:hashFile(bad),byte_size:fs.statSync(bad).size,media_type:'video',duration_seconds:5,resolution:'1920x1080',codec:'h264',source_url:'repo://ORVYQ-1/bad',license:'test',attribution_requirement:'none',editorial_purpose:'negative test',claim_ids:[],approved_for_final_edit:true}); write(registryFile, registry);
  expectCode(() => validateProject(projectId), 'FFPROBE_FAILED');
});

test('Missing license or provenance is rejected', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'assets', 'asset_registry.json'); const registry = read(file); delete registry.assets[1].license; write(file, registry);
  expectCode(() => validateProject(projectId), 'ASSET_METADATA_MISSING');
});

test('Storyboard must cover the complete narration duration', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'storyboard', 'storyboard.json'); const storyboard = read(file); storyboard.scenes.at(-1).end_frame -= 1; write(file, storyboard);
  expectCode(() => validateProject(projectId), 'STORYBOARD_INCOMPLETE');
});

test('Production plan gap or overlap is rejected', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'production_plan.json'); const plan = read(file); plan.shots[1].start_frame += 1; write(file, plan);
  expectCode(() => validateProject(projectId), 'PLAN_GAP_OR_OVERLAP');
});

test('Proof boundary must end a shot, sentence and paragraph', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'narration_timeline.json'); const timeline = read(file); timeline.proof_boundary.paragraph_end = false; delete timeline.timeline_sha256; timeline.timeline_sha256 = hashJson(timeline); write(file, timeline);
  expectCode(() => validateProject(projectId), 'PROOF_BOUNDARY_NOT_SEMANTIC');
});

test('A separate proof plan is forbidden', () => {
  const {project, projectId} = makeValidRepo();
  write(path.join(project, 'direction', 'proof_cut.json'), {shots:[]});
  expectCode(() => validateProject(projectId), 'ALTERNATIVE_PLAN_FORBIDDEN');
});

test('End card can only be the final shot', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'production_plan.json');
  const plan = read(file);
  plan.shots[0].visual_class = 'orvyq_end_card';
  plan.shots.at(-1).visual_class = 'cinematic_footage';
  plan.shots.at(-1).asset_class = 'contextual';
  write(file, plan);
  expectCode(() => validateProject(projectId), 'END_CARD_POSITION');
});

test('Section-level visual monotony blocks proof even when global ratios pass', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'production_plan.json'); const plan = read(file);
  for (const index of [2,3,4,5]) { plan.shots[index].visual_class = 'cinematic_footage'; plan.shots[index].asset_class = 'contextual'; }
  plan.sections[0] = {id:'monotone-section',start_frame:360,end_frame:1080}; write(file, plan);
  expectCode(() => validateProject(projectId), 'VISUAL_CLASS_MONOTONY');
});

test('Evidence/document chain longer than 15 seconds is rejected', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'production_plan.json'); const plan = read(file); for (const index of [0,1,2]) plan.shots[index].visual_class = 'official_document'; write(file, plan);
  expectCode(() => validateProject(projectId), 'EVIDENCE_CHAIN_TOO_LONG');
});

test('Excessive asset reuse is rejected', () => {
  const {project, projectId} = makeValidRepo();
  const file = path.join(project, 'direction', 'production_plan.json'); const plan = read(file); for (const index of [0,1,2]) plan.shots[index].physical_asset = plan.shots[0].physical_asset; write(file, plan);
  expectCode(() => validateProject(projectId), 'ASSET_REUSE_EXCESSIVE');
});

test('Full render requires approval from the same candidate and proof run', () => {
  const {root, project, projectId} = makeValidRepo();
  run('git', ['init','-b','main'], root); run('git', ['config','user.email','test@example.com'], root); run('git', ['config','user.name','ORVYQ Test'], root); run('git', ['add','.'], root); run('git', ['commit','-m','candidate'], root);
  const candidateSha = run('git', ['rev-parse','HEAD'], root);
  const digests = candidateDigests(projectId);
  const proofFile = path.join(root, 'proof_manifest.json');
  write(proofFile, {project_id:projectId,candidate_sha:candidateSha,proof_run_id:'123',...digests});
  expectCode(() => validateProofForFull({projectId,candidateSha,approvedProofRunId:'123',proofManifestFile:path.join(root,'missing.json')}), 'PROOF_MANIFEST_MISSING');
  expectCode(() => validateProofForFull({projectId,candidateSha:'0000000000000000000000000000000000000000',approvedProofRunId:'123',proofManifestFile:proofFile}), 'CANDIDATE_SHA_MISMATCH');
  const planFile = path.join(project, 'direction', 'production_plan.json'); const plan = read(planFile); plan.shots[0].title = 'post-proof mutation'; write(planFile, plan);
  expectCode(() => validateProofForFull({projectId,candidateSha,approvedProofRunId:'123',proofManifestFile:proofFile}), 'CANDIDATE_CHANGED_AFTER_PROOF');
});
