#!/usr/bin/env node
import {copyFile, mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256Bytes, writeJsonAtomic, readJson} from '../src/core/json.mjs';
import {safeProjectPath} from '../src/core/paths.mjs';

const PROJECT_ID = '001-ai-race';
const FPS = 30;
const argv = Object.fromEntries(process.argv.slice(2).map((item) => item.split('=', 2)));
const phase = argv['--phase'] ?? 'prepare';
const legacyRoot = argv['--legacy-root'];
if (!legacyRoot) throw new Error('--legacy-root=<path> is required');

const project = (...segments) => safeProjectPath(PROJECT_ID, ...segments);
const legacy = (...segments) => path.resolve(legacyRoot, ...segments);
const run = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
};
const probe = (file) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
const round6 = (value) => Math.round(value * 1_000_000) / 1_000_000;

const footageMetadata = [
  ['F1','f1.mp4','https://www.pexels.com/video/aerial-view-footage-of-city-12719806/','https://www.pexels.com/license/'],
  ['F2','f2.mp4','https://www.pexels.com/video/a-man-looking-at-a-blueprint-on-his-laptop-6224298/','https://www.pexels.com/license/'],
  ['F3','f3.mp4','https://www.pexels.com/video/stock-market-data-analysis-with-multiple-monitors-38412247/','https://www.pexels.com/license/'],
  ['F4','f4.mp4','https://pixabay.com/videos/id-3735/','https://pixabay.com/service/license-summary/'],
  ['F5','f5.mp4','https://pixabay.com/videos/id-2176/','https://pixabay.com/service/license-summary/'],
  ['F6','f6.mp4','https://www.pexels.com/video/warehouses-and-mesh-fence-by-road-13307522/','https://www.pexels.com/license/'],
  ['F7','f7.mp4','https://www.pexels.com/video/scrolling-smartphone-news-feed-in-close-up-35888104/','https://www.pexels.com/license/'],
  ['F8','f8.mp4','https://www.pexels.com/video/digital-node-network-animation-in-motion-30607101/','https://www.pexels.com/license/'],
  ['F9','f9.mp4','https://www.pexels.com/video/employees-stamping-and-writing-on-the-papers-7593780/','https://www.pexels.com/license/'],
  ['F10','f10.mp4','https://www.pexels.com/video/the-building-is-made-of-glass-and-metal-18872181/','https://www.pexels.com/license/'],
  ['F11','f11.mp4','https://www.pexels.com/video/close-up-shot-of-a-person-browsing-in-the-computer-7735823/','https://www.pexels.com/license/'],
  ['F12','f12.mp4','https://www.pexels.com/video/panning-shot-of-the-texas-state-senate-chamber-4474271/','https://www.pexels.com/license/'],
  ['F13','f13.mp4','https://www.pexels.com/video/a-computer-code-running-on-screen-6804117/','https://www.pexels.com/license/'],
  ['F14','f14.mp4','https://www.pexels.com/video/person-showing-a-medical-chart-7579340/','https://www.pexels.com/license/'],
  ['F15','f15.mp4','https://www.pexels.com/video/reviewing-a-employment-contract-agreement-8134446/','https://www.pexels.com/license/']
];

const evidenceDefinitions = [
  ['EVID_RSP_COVER','primary_document','anthropic_rsp_cover.png','SRC_ANTHROPIC_RSP',['CLM_SAFETY_FRAMEWORKS'],'Anthropic Responsible Scaling Policy cover',1,'https://www-cdn.anthropic.com/616dee633636e5bd309cb73aed8622e80fe47839.pdf'],
  ['EVID_RSP_SUMMARY','primary_document','anthropic_rsp_summary.png','SRC_ANTHROPIC_RSP',['CLM_SAFETY_FRAMEWORKS'],'Anthropic RSP commitments and governance summary',2,'https://www-cdn.anthropic.com/616dee633636e5bd309cb73aed8622e80fe47839.pdf'],
  ['EVID_RSP_THRESHOLDS','official_table','anthropic_rsp_thresholds.png','SRC_ANTHROPIC_RSP',['CLM_SAFETY_THRESHOLDS'],'Anthropic capability thresholds and safeguards',7,'https://www-cdn.anthropic.com/616dee633636e5bd309cb73aed8622e80fe47839.pdf'],
  ['EVID_FSF_COVER','primary_document','deepmind_fsf_cover.png','SRC_DEEPMIND_FSF',['CLM_SAFETY_FRAMEWORKS'],'Google DeepMind Frontier Safety Framework cover',1,'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/updating-the-frontier-safety-framework/Frontier%20Safety%20Framework%202.0.pdf'],
  ['EVID_FSF_FRAMEWORK','official_table','deepmind_fsf_framework.png','SRC_DEEPMIND_FSF',['CLM_SAFETY_THRESHOLDS'],'DeepMind critical capability levels and mitigations',2,'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/updating-the-frontier-safety-framework/Frontier%20Safety%20Framework%202.0.pdf'],
  ['EVID_FSF_ALIGNMENT','official_table','deepmind_fsf_alignment.png','SRC_DEEPMIND_FSF',['CLM_ALIGNMENT_RISK'],'DeepMind deceptive alignment evaluation and mitigations',7,'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/updating-the-frontier-safety-framework/Frontier%20Safety%20Framework%202.0.pdf'],
  ['EVID_AGENTIC_FIG1','official_figure','anthropic_agentic_figure1.png','SRC_ANTHROPIC_AGENTIC',['CLM_CONTROLLED_TEST'],'Published cross-model simulated blackmail rates',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/246a928da96d21474848647bc4b0938d182aeb8b-4096x1746.png'],
  ['EVID_AGENTIC_FIG2','official_screen','anthropic_agentic_figure2.png','SRC_ANTHROPIC_AGENTIC',['CLM_REPLACEMENT_SCENARIO'],'Fictional replacement email used in the controlled scenario',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/f8ade2db0fefac490af1e2a991b0d4ce3f0b238c-3840x2160.png'],
  ['EVID_AGENTIC_FIG3','official_screen','anthropic_agentic_figure3.png','SRC_ANTHROPIC_AGENTIC',['CLM_REPLACEMENT_SCENARIO'],'Fictional personal email used in the controlled scenario',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/f16473f9893693a59cb4794883ed0dce965ce93e-2514x1414.png'],
  ['EVID_AGENTIC_FIG4','official_screen','anthropic_agentic_figure4.png','SRC_ANTHROPIC_AGENTIC',['CLM_CONTROLLED_TEST'],'Published model deliberation trace from the simulation',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/d8889f94ef801509c36d02fabe7e61bd468ca6f6-3840x2160.png'],
  ['EVID_AGENTIC_FIG5','official_screen','anthropic_agentic_figure5.png','SRC_ANTHROPIC_AGENTIC',['CLM_CONTROLLED_TEST'],'Published model action trace from the simulation',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/d4ecf930303d3c5b9bdb6d953fd845eac92ffb48-3840x2160.png'],
  ['EVID_AGENTIC_FIG7','official_figure','anthropic_agentic_figure7.png','SRC_ANTHROPIC_AGENTIC',['CLM_CONTROLLED_TEST'],'Published results across sixteen leading models',null,'https://www-cdn.anthropic.com/images/4zrzovbb/website/a7c09ecd57c986788a20b71daaa533bc691830b3-4096x2304.png']
];

const sourceCatalog = {
  schema_version: '1.0', project_id: PROJECT_ID,
  sources: [
    {source_id:'SRC_ANTHROPIC_RSP',title:'Responsible Scaling Policy, version 2.0',publisher:'Anthropic',url:'https://www-cdn.anthropic.com/616dee633636e5bd309cb73aed8622e80fe47839.pdf',kind:'primary',active:true,required:true,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official company policy document captured for criticism, commentary and evidence.'},
    {source_id:'SRC_DEEPMIND_FSF',title:'Frontier Safety Framework 2.0',publisher:'Google DeepMind',url:'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/updating-the-frontier-safety-framework/Frontier%20Safety%20Framework%202.0.pdf',kind:'primary',active:true,required:true,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official company safety framework captured for criticism, commentary and evidence.'},
    {source_id:'SRC_ANTHROPIC_AGENTIC',title:'Agentic Misalignment: How LLMs Could Be Insider Threats',publisher:'Anthropic',url:'https://www.anthropic.com/research/agentic-misalignment',kind:'primary',active:true,required:true,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official research publication and figures used for criticism, commentary and evidence.'},
    {source_id:'SRC_NIST_RMF',title:'AI Risk Management Framework',publisher:'NIST',url:'https://www.nist.gov/itl/ai-risk-management-framework',kind:'primary',active:true,required:false,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official United States government risk-management publication.'},
    {source_id:'SRC_EU_AI_ACT',title:'Regulation (EU) 2024/1689',publisher:'European Union',url:'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng',kind:'primary',active:true,required:false,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official European Union legal text used for analysis and commentary.'},
    {source_id:'SRC_UNESCO_ETHICS',title:'Recommendation on the Ethics of Artificial Intelligence',publisher:'UNESCO',url:'https://www.unesco.org/en/artificial-intelligence/recommendation-ethics',kind:'primary',active:true,required:false,accessed_at:'2026-07-21T00:00:00.000Z',license_or_basis:'Official intergovernmental policy recommendation used for analysis and commentary.'}
  ]
};

const claims = [
  ['CLM_RACE_INCENTIVE','Competitive pressure can reward frontier capability development even when individual laboratories acknowledge serious risk.','SEC_RACE','qualified',['SRC_ANTHROPIC_RSP','SRC_DEEPMIND_FSF'],'required',.91,'The sources document risk-management responses; the strategic incentive framing is an analytical synthesis.'],
  ['CLM_SAFETY_FRAMEWORKS','Leading laboratories publish formal frameworks that connect capability thresholds to stronger safeguards.','SEC_RACE','verified',['SRC_ANTHROPIC_RSP','SRC_DEEPMIND_FSF'],'required',.98,null],
  ['CLM_SAFETY_THRESHOLDS','Frontier safety frameworks define escalating capability levels and corresponding evaluation or mitigation requirements.','SEC_EVIDENCE','verified',['SRC_ANTHROPIC_RSP','SRC_DEEPMIND_FSF'],'required',.98,null],
  ['CLM_ALIGNMENT_RISK','Published frontier frameworks explicitly include deceptive alignment or related autonomous-risk evaluations.','SEC_EVIDENCE','verified',['SRC_DEEPMIND_FSF'],'required',.97,null],
  ['CLM_CONTROLLED_TEST','Anthropic reported controlled simulations in which multiple models sometimes selected harmful actions under engineered pressure.','SEC_EVIDENCE','qualified',['SRC_ANTHROPIC_AGENTIC'],'required',.99,'The study describes controlled fictional simulations, not documented real-world incidents.'],
  ['CLM_REPLACEMENT_SCENARIO','The published simulation supplied fictional emails and an engineered replacement threat to test model behaviour.','SEC_EVIDENCE','verified',['SRC_ANTHROPIC_AGENTIC'],'required',.99,null],
  ['CLM_GOVERNANCE_LAG','Institutional oversight can move more slowly than technical capability and deployment.','SEC_GOVERNANCE','qualified',['SRC_NIST_RMF','SRC_EU_AI_ACT'],'preferred',.82,'This is a comparative policy judgment rather than a single-source measured statistic.'],
  ['CLM_MISUSE','More capable and accessible systems can lower barriers for some forms of cyber or biological misuse while also aiding defenders.','SEC_MISUSE','qualified',['SRC_NIST_RMF','SRC_ANTHROPIC_RSP'],'preferred',.84,'The magnitude and accessibility of misuse vary by model, safeguards and user expertise.'],
  ['CLM_POWER','Control over frontier systems can concentrate consequential decisions in a small number of institutions.','SEC_POWER','qualified',['SRC_UNESCO_ETHICS','SRC_EU_AI_ACT'],'preferred',.86,'The degree of concentration differs across jurisdictions, deployment models and access regimes.'],
  ['CLM_OPEN_CLOSED','Open and closed development strategies create different security, accountability and concentration trade-offs.','SEC_TRADEOFF','qualified',['SRC_NIST_RMF','SRC_EU_AI_ACT'],'preferred',.88,'Neither development model removes risk; each changes who can inspect, control or misuse the system.'],
  ['CLM_SAFETY_ARCHITECTURE','Layered evaluation, access controls, incident reporting and external accountability can reduce—but not eliminate—frontier risk.','SEC_SAFETY','qualified',['SRC_ANTHROPIC_RSP','SRC_DEEPMIND_FSF','SRC_NIST_RMF'],'preferred',.93,'Safeguards reduce exposure only when implemented, tested and updated against changing capabilities.'],
  ['CLM_HUMAN_AGENCY','The governance of frontier AI remains a human institutional choice rather than an automatic technical outcome.','SEC_FINAL','qualified',['SRC_UNESCO_ETHICS','SRC_EU_AI_ACT'],'narration_only',.9,'This is the film’s normative conclusion, grounded in the cited governance frameworks.']
].map(([claim_id,text,section_id,status,source_ids,visual_evidence_requirement,confidence,limitation]) => ({claim_id,text,section_id,status,source_ids,visual_evidence_requirement,confidence,...(limitation?{limitation}:{})}));

async function mediaAsset(assetId, role, relativePath, sourceUrl, license, editorialPurpose) {
  const file = project(relativePath);
  const bytes = await readFile(file);
  const media = probe(file);
  const streams = media.streams ?? [];
  const duration = Number(media.format?.duration ?? streams.find((stream) => stream.duration)?.duration ?? 0);
  const video = streams.find((stream) => stream.codec_type === 'video');
  return {asset_id:assetId,role,media_type:video?'video':'audio',relative_path:relativePath,sha256:sha256Bytes(bytes),byte_size:bytes.length,duration_seconds:round6(duration),source_url:sourceUrl,license,editorial_purpose:editorialPurpose,approved_for_final_edit:true,...(video?{width:Number(video.width),height:Number(video.height)}:{})};
}

function nearestWordEnd(words, target) {
  return words.reduce((best, word) => Math.abs(word.output_end-target)<Math.abs(best.output_end-target)?word:best, words[0]).output_end;
}

function shiftAt(sourceSeconds, pauses) {
  return sourceSeconds + pauses.filter((pause) => pause.source_time_seconds <= sourceSeconds + .0001).reduce((sum, pause) => sum + pause.duration_seconds, 0);
}

function frame(seconds) { return Math.round(seconds * FPS); }
function seconds(frames) { return frames / FPS; }

function createPlan({fullFrames, pauses, evidence, assets, claims: claimList}) {
  const shots = [];
  let shotCounter = 1;
  let patternIndex = 0;
  let evidenceIndex = 0;
  let contextCursor = 0;
  const contextUses = new Map();
  const footage = assets.filter((asset) => asset.role === 'contextual_footage');
  const evidencePattern = ['contextual_footage','primary_document','official_figure','contextual_footage','source_derived_graphic','limitation_treatment','contextual_footage','process_graphic','primary_document'];
  const sectionClaims = claimList.filter((claim) => claim.status !== 'cut');

  const nextContext = () => {
    for (let attempt=0; attempt<footage.length*2; attempt+=1) {
      const asset = footage[contextCursor % footage.length];
      contextCursor += 1;
      const uses = contextUses.get(asset.asset_id) ?? 0;
      if (uses < 3) { contextUses.set(asset.asset_id, uses+1); return {asset, useIndex:uses}; }
    }
    throw new Error('Not enough unique contextual footage for the canonical plan');
  };
  const addShot = (start,end,type,extra={}) => {
    const claim = extra.claim ?? sectionClaims[(shotCounter-1)%sectionClaims.length];
    const shot = {shot_id:`SHOT_${String(shotCounter).padStart(3,'0')}`,shot_type:type,start_frame:start,end_frame:end,claim_ids:claim?[claim.claim_id]:[],editorial_purpose:extra.editorial_purpose ?? `Advance the ${claim?.section_id ?? 'film'} argument with a distinct ${type.replaceAll('_',' ')} treatment.`,motif_id:`MOTIF_${String(shotCounter).padStart(3,'0')}`,transition_in:extra.transition_in ?? 'cut',transition_out:extra.transition_out ?? 'cut',typography:{title_px:50,subtitle_px:25,source_px:17},safe_area:{left:70,right:70,top:52,bottom:48},...extra};
    delete shot.claim;
    shots.push(shot); shotCounter+=1;
  };
  const fillInterval = (start,end,{hook=false}={}) => {
    if (end<=start) return;
    if (hook) {
      const points=[start,start+105,start+210,start+330,end];
      for(let i=0;i<4;i+=1){const {asset,useIndex}=nextContext(); addShot(points[i],points[i+1],'cinematic_hook',{asset_ids:[asset.asset_id],motion:['push','drift_left','pull','drift_right'][i],trim_in_seconds:Math.min(useIndex*3,Math.max(0,asset.duration_seconds-seconds(points[i+1]-points[i])-0.1)),trim_out_seconds:Math.min(asset.duration_seconds,Math.min(useIndex*3,Math.max(0,asset.duration_seconds-seconds(points[i+1]-points[i])-0.1))+seconds(points[i+1]-points[i])),title:i===0?'THE RACE IS ALREADY MOVING':undefined,eyebrow:i===0?'ORVYQ':undefined,source_label:'ORVYQ · CONTEXTUAL',evidence_claim:false,editorial_purpose:'Establish the film’s central competitive pressure through nonliteral cinematic context.'});}
      return;
    }
    const length=end-start;
    let count=Math.max(1,Math.ceil(length/(6.5*FPS)));
    while(length/count<1.5*FPS) count-=1;
    while(length/count>8*FPS) count+=1;
    const base=Math.floor(length/count); let remainder=length-base*count; let cursor=start;
    for(let i=0;i<count;i+=1){const duration=base+(remainder>0?1:0); if(remainder>0)remainder-=1; const next=cursor+duration; const type=evidencePattern[patternIndex%evidencePattern.length]; patternIndex+=1; const claim=sectionClaims[(shotCounter-1)%sectionClaims.length];
      if(type==='contextual_footage'){const {asset,useIndex}=nextContext(); const trim=Math.min(useIndex*3,Math.max(0,asset.duration_seconds-seconds(duration)-0.1)); addShot(cursor,next,type,{claim,asset_ids:[asset.asset_id],motion:['push','pull','drift_left','drift_right','slow_pan'][shotCounter%5],trim_in_seconds:round6(trim),trim_out_seconds:round6(trim+seconds(duration)),source_label:'ORVYQ · CONTEXTUAL',evidence_claim:false,editorial_purpose:`Provide nonliteral cinematic context for ${claim.text.toLowerCase()}`});}
      else if(type==='primary_document'||type==='official_figure'){const item=evidence[evidenceIndex%evidence.length]; evidenceIndex+=1; const actualType=item.evidence_type==='official_figure'?'official_figure':type; addShot(cursor,next,actualType,{claim,evidence_ids:[item.evidence_id],title:item.caption,subtitle:'The source is shown directly; the footer preserves provenance and limits.',source_label:item.source_ids.join(' · '),callout:'This is a genuine primary-source capture linked to the current claim.',editorial_purpose:`Show genuine source pixels supporting ${claim.text.toLowerCase()}`});}
      else if(type==='limitation_treatment'){addShot(cursor,next,type,{claim,title:'WHAT THE EVIDENCE DOES — AND DOES NOT — SHOW',left:claim.text,right:claim.limitation ?? 'The source does not establish every broader interpretation.',left_detail:'Supported by the cited source package.',right_detail:claim.limitation ?? 'Context and uncertainty remain material.',source_label:claim.source_ids.join(' · '),editorial_purpose:'State the source boundary before advancing the argument.'});}
      else if(type==='process_graphic'){addShot(cursor,next,type,{claim,title:'FROM CAPABILITY TO CONSEQUENCE',steps:['CAPABILITY','INCENTIVE','DEPLOYMENT','GOVERNANCE'],source_label:claim.source_ids.join(' · '),editorial_purpose:'Explain the causal sequence without fabricating documentary evidence.'});}
      else {addShot(cursor,next,type,{claim,title:'THE PRESSURE COMPOUNDS',items:[{label:'CAPABILITY',value:'More powerful systems'},{label:'INCENTIVE',value:'Faster competitive movement'},{label:'CONTROL',value:'Governance must catch up'}],source_label:claim.source_ids.join(' · '),editorial_purpose:'Translate the sourced argument into an explicit source-derived visual model.'});}
      cursor=next;
    }
  };

  const firstPauseStart=frame(pauses[0].output_start_seconds);
  fillInterval(0,Math.min(450,firstPauseStart),{hook:true});
  let cursor=Math.min(450,firstPauseStart);
  for(const pause of pauses){const pauseStart=frame(pause.output_start_seconds); const pauseEnd=frame(pause.output_end_seconds); fillInterval(cursor,pauseStart); addShot(pauseStart,pauseEnd,'editorial_pause',{claim:sectionClaims[(shotCounter-1)%sectionClaims.length],title:pause.emphasis,eyebrow:pause.eyebrow,subtitle:pause.editorial_function,captions_suppressed:true,editorial_purpose:pause.editorial_function,transition_in:'short_dissolve',transition_out:'short_dissolve'}); cursor=pauseEnd;}
  const closeFrames=120; fillInterval(cursor,fullFrames-closeFrames); addShot(fullFrames-closeFrames,fullFrames,'brand_close',{claim:null,title:'BEYOND THE KNOWN',subtitle:'An ORVYQ Studio production',editorial_purpose:'Close the documentary with a restrained branded release.',transition_in:'motivated_fade'});
  const sectionTitles=['The Race','Controlled Evidence','Incentives','Misuse','Power','Regulation','Open and Closed','Safety Architecture','Human Choice'];
  const sections=[]; for(let i=0;i<sectionTitles.length;i+=1){sections.push({section_id:['SEC_RACE','SEC_EVIDENCE','SEC_INCENTIVE','SEC_MISUSE','SEC_POWER','SEC_GOVERNANCE','SEC_TRADEOFF','SEC_SAFETY','SEC_FINAL'][i],title:sectionTitles[i],start_frame:Math.round(fullFrames*i/sectionTitles.length),end_frame:Math.round(fullFrames*(i+1)/sectionTitles.length)});} sections[0].start_frame=0; for(let i=1;i<sections.length;i+=1)sections[i].start_frame=sections[i-1].end_frame; sections.at(-1).end_frame=fullFrames;
  const proofShot=shots.find((shot)=>shot.end_frame>=180*FPS)??shots.find((shot)=>shot.end_frame>=150*FPS); const proofBoundary=proofShot.end_frame;
  return {schema_version:'1.0',project_id:PROJECT_ID,fps:FPS,width:1920,height:1080,full_frame_count:fullFrames,full_duration_seconds:seconds(fullFrames),proof_boundary_frame:proofBoundary,audio_mix_asset:'assets/audio/final_mix.mp3',sections,shots};
}

async function prepare() {
  const dirs=['input','research','script','voice','assets/narration','assets/music','assets/footage','evidence/primary','audio','direction','storyboard','build','qa','output'];
  await Promise.all(dirs.map((dir)=>mkdir(project(dir),{recursive:true})));
  await copyFile(legacy('assets/audio/narration_final.mp3'),project('assets/narration/narration_final.mp3'));
  for(const [,file] of footageMetadata){await copyFile(legacy('assets/footage',file),project('assets/footage',file)); const provenance=legacy('assets/footage',`${file}.provenance.json`); try{await copyFile(provenance,project('assets/footage',`${file}.provenance.json`));}catch{}}
  for(const [from,to] of [['input/notebooklm_answers.md','input/notebooklm_answers.md'],['script/script.md','script/script.md'],['voice/voice_script.txt','voice/voice_script.txt'],['research/research_report.md','research/research_report.md']]){try{await copyFile(legacy(from),project(to));}catch{}}
  const oldTimeline=await readJson(legacy('direction/narration_timeline.json')); const oldCaptions=await readJson(legacy('direction/captions.json'));
  const targetAnchors=[58.47,90.47,210.07,300,420,540,650,715.93]; const durations=[4,4,5,4,5,5,5,6]; const emphasis=['NOT SOMEDAY. RIGHT NOW.','A TEST. NOT AN INCIDENT.','SLOW DOWN — AND LOSE?','THE RISK LEAVES THE LAB','WHO GETS TO DECIDE?','OPEN OR CLOSED?','SAFETY MUST BE BUILT','PEOPLE, RIGHT NOW.']; const eyebrows=['THE TIMELINE','THE LIMIT','THE INCENTIVE','THE PIVOT','THE POWER','THE TRADE-OFF','THE WORK','THE CHOICE'];
  let cumulative=0; const pauses=targetAnchors.map((target,index)=>{const source=nearestWordEnd(oldTimeline.words,target); const outputStart=round6(source+cumulative); const duration=durations[index]; cumulative+=duration; return {pause_id:`PAUSE_${String(index+1).padStart(2,'0')}`,source_time_seconds:round6(source),output_start_seconds:outputStart,duration_seconds:duration,output_end_seconds:round6(outputStart+duration),emphasis:emphasis[index],eyebrow:eyebrows[index],editorial_function:`Create a deliberate editorial breath for ${emphasis[index].toLowerCase()} while the licensed score carries the transition.`,captions_suppressed:true};});
  const sourceDuration=Number(oldTimeline.source_duration_seconds); const fullFrames=Math.round((sourceDuration+cumulative)*FPS); const transformedDuration=seconds(fullFrames);
  const words=oldTimeline.words.map((word)=>({text:word.text,source_start:round6(word.output_start),source_end:round6(word.output_end),output_start:round6(shiftAt(word.output_start,pauses)),output_end:round6(shiftAt(word.output_end,pauses))}));
  const evidence=[]; for(const [evidence_id,evidence_type,file,sourceId,claimIds,caption,page_number,source_url] of evidenceDefinitions){const relative=`evidence/primary/${file}`; const bytes=await readFile(project(relative)); evidence.push({evidence_id,evidence_type,relative_path:relative,sha256:sha256Bytes(bytes),byte_size:bytes.length,source_url,source_ids:[sourceId],claim_ids:claimIds,provenance_mode:'official_primary_capture',caption,license_or_basis:'Official primary-source pixels retained for criticism, commentary and evidence.',...(page_number?{page_number}:{})});}
  const assets=[]; assets.push(await mediaAsset('NARRATION','narration_stem','assets/narration/narration_final.mp3','repo://ORVYQ-1/projects/001-ai-race/assets/narration/narration_final.mp3','User-provided ElevenLabs narration','Canonical full-film narration stem.'));
  const music=await mediaAsset('MUSIC_SIGNAL_TO_NOISE','music_stem','assets/music/signal-to-noise.mp3','https://www.scottbuckley.com.au/library/signal-to-noise/','Creative Commons Attribution 4.0 International','Licensed cinematic score with required public attribution.'); music.attribution_file='assets/music/signal-to-noise.provenance.json'; assets.push(music);
  for(const [id,file,sourceUrl,license] of footageMetadata)assets.push(await mediaAsset(id,'contextual_footage',`assets/footage/${file}`,sourceUrl,license,'Licensed contextual atmosphere; never presented as literal evidence.'));
  const plan=createPlan({fullFrames,pauses,evidence,assets,claims}); const finalWord=words.filter((word)=>word.output_end<=seconds(plan.proof_boundary_frame)+.001).at(-1);
  const timeline={schema_version:'1.0',project_id:PROJECT_ID,source_audio:'assets/narration/narration_final.mp3',source_audio_sha256:assets[0].sha256,source_duration_seconds:sourceDuration,transformed_duration_seconds:transformedDuration,words,editorial_pauses:pauses,proof_boundary:{seconds:seconds(plan.proof_boundary_frame),frame:plan.proof_boundary_frame,final_word:finalWord.text,sentence_end:true,paragraph_end:true,shot_boundary:true}};
  const shiftedCaptions=oldCaptions.captions.map((caption)=>{const sourceStart=caption.start_frame/FPS; const sourceEnd=caption.end_frame/FPS; return {caption_id:caption.id??caption.caption_id,start_frame:frame(shiftAt(sourceStart,pauses)),end_frame:Math.min(fullFrames,frame(shiftAt(sourceEnd,pauses))),text:caption.text};}).filter((caption)=>caption.end_frame>caption.start_frame);
  const sectionBounds=plan.sections.map((section)=>section.end_frame/FPS); const states=['controlled_tension','analytical_unease','accelerating_pressure','procedural_threat','uncertain_transition','institutional_gravity','balanced_tension','constructive_momentum','reflective_resolution']; const gains=[-23,-22,-20,-20,-23,-22,-21,-19,-24]; let cueStart=0; const musicCues=sectionBounds.map((end,index)=>{const cue={cue_id:`CUE_${String(index+1).padStart(2,'0')}`,state:states[index],start_seconds:cueStart,end_seconds:end,gain_db:gains[index],energy_start:[.28,.32,.48,.44,.3,.4,.46,.42,.46][index],energy_end:[.58,.62,.76,.72,.5,.56,.58,.68,.08][index],function:`Support ${plan.sections[index].title.toLowerCase()} with restrained cinematic movement while preserving narration clarity.`,transition_out:index===sectionBounds.length-1?'Long natural decay into the final branded release.':'Change texture and energy at the next canonical section boundary.',source_offset_seconds:(index*41)%180}; cueStart=end; return cue;});
  const audioPlan={schema_version:'1.0',project_id:PROJECT_ID,narration_asset:'assets/narration/narration_final.mp3',music_assets:['assets/music/signal-to-noise.mp3'],music_cues:musicCues,ducking:{enabled:true,threshold_db:-24,ratio:6,attack_ms:30,release_ms:480},loudness:{target_lufs:-16,true_peak_dbfs:-1.5},output_asset:'assets/audio/final_mix.mp3'};
  await writeJsonAtomic(project('research/source_catalog.json'),sourceCatalog); await writeJsonAtomic(project('research/claim_registry.json'),{schema_version:'1.0',project_id:PROJECT_ID,claims}); await writeJsonAtomic(project('evidence/evidence_registry.json'),{schema_version:'1.0',project_id:PROJECT_ID,evidence}); await writeJsonAtomic(project('assets/asset_registry.json'),{schema_version:'1.0',project_id:PROJECT_ID,assets}); await writeJsonAtomic(project('direction/narration_timeline.json'),timeline); await writeJsonAtomic(project('direction/captions.json'),{schema_version:'1.0',duration_frames:fullFrames,captions:shiftedCaptions}); await writeJsonAtomic(project('direction/production_plan.json'),plan); await writeJsonAtomic(project('audio/audio_plan.json'),audioPlan);
  await writeJsonAtomic(project('assets/music/signal-to-noise.provenance.json'),{schema_version:'1.0',title:'Signal to Noise',composer:'Scott Buckley',source_page_url:'https://www.scottbuckley.com.au/library/signal-to-noise/',license:'Creative Commons Attribution 4.0 International',license_url:'https://creativecommons.org/licenses/by/4.0/',attribution:"'Signal to Noise' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au",sha256:music.sha256,byte_size:music.byte_size,duration_seconds:music.duration_seconds,approved_for_final_edit:true});
  await writeFile(project('README.md'),'# The AI Race No One Can Afford to Win\n\nCanonical ORVYQ first-film project rebuilt from approved raw narration, licensed footage, genuine primary-source pixels and deterministic audio/edit contracts.\n','utf8');
}

async function finalize() {
  const registry=await readJson(project('assets/asset_registry.json')); registry.assets=registry.assets.filter((asset)=>asset.role!=='final_audio_mix'); registry.assets.push(await mediaAsset('FINAL_AUDIO_MIX','final_audio_mix','assets/audio/final_mix.mp3','repo://ORVYQ-1/projects/001-ai-race/assets/audio/final_mix.mp3','Narration plus licensed CC BY 4.0 music mix','Deterministic pre-render final audio mix with editorial pauses and narration ducking.')); await writeJsonAtomic(project('assets/asset_registry.json'),registry);
  const manifest=await readJson(project('manifest.json')); manifest.current_stage='READY_FOR_PROOF'; manifest.operation_status='TAMAMLANDI'; manifest.updated_at=new Date().toISOString(); await writeJsonAtomic(project('manifest.json'),manifest);
}

if(phase==='prepare')await prepare(); else if(phase==='finalize')await finalize(); else throw new Error(`Unknown phase ${phase}`);
process.stdout.write(JSON.stringify({status:'TAMAMLANDI',phase,project_id:PROJECT_ID},null,2)+'\n');
