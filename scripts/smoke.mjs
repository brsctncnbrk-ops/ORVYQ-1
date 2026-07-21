#!/usr/bin/env node
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {repoRoot} from '../src/core/paths.mjs';
import {writeJsonAtomic} from '../src/core/json.mjs';
import {renderedMediaQa} from '../src/qa/rendered-media.mjs';

function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`${command} failed`);
}

const root = repoRoot();
const project = path.join(root, 'projects', 'smoke-fixture');
await mkdir(path.join(project, 'assets', 'footage'), {recursive: true});
await mkdir(path.join(project, 'assets', 'audio'), {recursive: true});
await mkdir(path.join(project, 'evidence', 'documents'), {recursive: true});
await mkdir(path.join(root, 'artifacts'), {recursive: true});

run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=12', '-vf', 'eq=brightness=0.08:saturation=0.9', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(project, 'assets', 'footage', 'smoke.mp4')]);
run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0xEEECE6:s=1920x1080:d=1', '-frames:v', '1', path.join(project, 'evidence', 'documents', 'official-page.png')]);
run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=180:duration=12:sample_rate=48000', '-f', 'lavfi', '-i', 'sine=frequency=420:duration=12:sample_rate=48000', '-filter_complex', '[0:a]volume=0.18[bed];[1:a]volume=0.08[pulse];[bed][pulse]amix=inputs=2:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=7[a]', '-map', '[a]', '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '256k', path.join(project, 'assets', 'audio', 'final_mix.mp3')]);

const renderInput = {
  schema_version: '1.0',
  project_id: 'smoke-fixture',
  plan: {
    fps: 30, width: 1920, height: 1080, full_frame_count: 360, full_duration_seconds: 12, proof_boundary_frame: 360, audio_mix_asset: 'assets/audio/final_mix.mp3',
    shots: [
      {shot_id: 'hook', shot_type: 'cinematic_hook', start_frame: 0, end_frame: 120, claim_ids: [], asset_ids: ['SMOKE_VIDEO'], editorial_purpose: 'Verify cinematic footage rendering and safe color treatment', motif_id: 'smoke-hook', motion: 'push', title: 'A SYSTEM UNDER PRESSURE', source_label: 'ORVYQ · SMOKE FIXTURE'},
      {shot_id: 'document', shot_type: 'primary_document', start_frame: 120, end_frame: 240, claim_ids: [], evidence_ids: ['SMOKE_EVIDENCE'], editorial_purpose: 'Verify real raster evidence rendering at readable scale', motif_id: 'smoke-document', title: 'OFFICIAL SOURCE PIXELS', subtitle: 'The renderer displays a raster capture instead of a generated evidence card.', source_label: 'SMOKE · PRIMARY DOCUMENT'},
      {shot_id: 'close', shot_type: 'brand_close', start_frame: 240, end_frame: 360, claim_ids: [], editorial_purpose: 'Verify clean ORVYQ brand closing composition', motif_id: 'smoke-close', title: 'BEYOND THE KNOWN', subtitle: 'Canonical renderer smoke test'}
    ]
  },
  timeline: {editorial_pauses: [], words: [{text: 'known', output_start: 10.5, output_end: 11.5}]},
  evidence: [{evidence_id: 'SMOKE_EVIDENCE', evidence_type: 'primary_document', relative_path: 'evidence/documents/official-page.png', caption: 'Smoke fixture official page', source_ids: [], claim_ids: []}],
  assets: [{asset_id: 'SMOKE_VIDEO', role: 'motion_hook_footage', media_type: 'video', relative_path: 'assets/footage/smoke.mp4', duration_seconds: 12, width: 1920, height: 1080}],
  captions: [{caption_id: 'cap-1', start_frame: 0, end_frame: 120, text: 'A deterministic renderer must prove it can render.'}],
  audio_mix_asset: 'assets/audio/final_mix.mp3'
};
await writeJsonAtomic(path.join(project, 'render_input.json'), renderInput);
const output = path.join(root, 'artifacts', 'smoke.mp4');
run('npx', ['remotion', 'render', 'src/render/index.ts', 'ORVYQVideo', output, `--props=${path.join(project, 'render_input.json')}`, '--public-dir=.', '--concurrency=1', '--codec=h264', '--audio-codec=aac', '--crf=20', '--pixel-format=yuv420p']);
const qa = renderedMediaQa(output, {expectedDuration: 12});
await writeJsonAtomic(path.join(root, 'artifacts', 'smoke-qa.json'), qa);
await writeFile(path.join(root, 'artifacts', 'smoke-status.txt'), 'TAMAMLANDI\n', 'utf8');
process.stdout.write(`${JSON.stringify(qa, null, 2)}\n`);
