#!/usr/bin/env node
import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {asOrvyqError, OrvyqError} from '../core/errors.mjs';
import {readJson, writeJsonAtomic} from '../core/json.mjs';
import {repoRoot, safeProjectPath} from '../core/paths.mjs';
import {initializeProject} from '../contracts/manifest.mjs';
import {prepareCandidate, validateProject} from '../contracts/project.mjs';
import {buildAudioMix} from '../audio/mix.mjs';
import {renderFull, renderProof} from '../runtime/render.mjs';
import {normalizeEvidenceClaimBindings} from '../direction/evidence-bindings.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new OrvyqError('CLI_ARGUMENT_INVALID', `Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new OrvyqError('CLI_ARGUMENT_VALUE_MISSING', `Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return {command, options};
}

function requiredOption(options, key) {
  const value = options[key];
  if (!value) throw new OrvyqError('CLI_REQUIRED_OPTION_MISSING', `Missing required option --${key}`);
  return value;
}

async function systemCheck() {
  const required = [
    'docs/quality-contract.md',
    'docs/architecture.md',
    'docs/migration-policy.md',
    'docs/rebuild-plan.md',
    'schemas/manifest.schema.json',
    'schemas/source-catalog.schema.json',
    'schemas/claim-registry.schema.json',
    'schemas/evidence-registry.schema.json',
    'schemas/asset-registry.schema.json',
    'schemas/narration-timeline.schema.json',
    'schemas/audio-plan.schema.json',
    'schemas/production-plan.schema.json',
    'schemas/candidate.schema.json',
    'src/contracts/source-catalog.mjs',
    'src/contracts/claim-registry.mjs',
    'src/contracts/evidence-registry.mjs',
    'src/contracts/asset-registry.mjs',
    'src/contracts/narration-timeline.mjs',
    'src/contracts/audio-plan.mjs',
    'src/contracts/production-plan.mjs',
    'src/contracts/candidate.mjs',
    'src/direction/evidence-bindings.mjs',
    'src/render/index.ts',
    'src/qa/rendered-media.mjs',
    'package.json',
    'package-lock.json'
  ];
  for (const relative of required) await access(path.join(repoRoot(), relative));
  const packageJson = JSON.parse(await readFile(path.join(repoRoot(), 'package.json'), 'utf8'));
  if (packageJson.type !== 'module') throw new OrvyqError('RUNTIME_BASELINE_INVALID', 'package.json must use ESM');
  return {ok: true, command: 'system:check', node: process.version, required_files: required};
}

async function run(command, options) {
  switch (command) {
    case 'system:check': return systemCheck();
    case 'project:init': {
      const minimumDurationSeconds = options['minimum-duration-seconds'] === undefined ? 600 : Number(options['minimum-duration-seconds']);
      const manifest = await initializeProject({projectId: requiredOption(options, 'project-id'), title: requiredOption(options, 'title'), minimumDurationSeconds});
      return {ok: true, command, manifest};
    }
    case 'project:validate': {
      const projectId = requiredOption(options, 'project-id');
      const result = await validateProject(projectId, {auditFiles: options['skip-file-audit'] !== 'true'});
      return {ok: true, command, report: result.report};
    }
    case 'plan:normalize-evidence': {
      const projectId = requiredOption(options, 'project-id');
      const productionPlan = await readJson(safeProjectPath(projectId, 'direction/production_plan.json'));
      const evidenceRegistry = await readJson(safeProjectPath(projectId, 'evidence/evidence_registry.json'));
      const normalized = normalizeEvidenceClaimBindings(productionPlan, evidenceRegistry);
      await writeJsonAtomic(safeProjectPath(projectId, 'direction/production_plan.json'), normalized.productionPlan);
      await writeJsonAtomic(safeProjectPath(projectId, 'qa/evidence_claim_bindings.json'), normalized.report);
      return {ok: true, command, report: normalized.report};
    }
    case 'audio:mix': {
      const projectId = requiredOption(options, 'project-id');
      const audioPlan = await readJson(safeProjectPath(projectId, 'audio/audio_plan.json'));
      const timeline = await readJson(safeProjectPath(projectId, 'direction/narration_timeline.json'));
      return {ok: true, command, metadata: await buildAudioMix({projectId, audioPlan, timeline})};
    }
    case 'candidate:prepare': {
      const projectId = requiredOption(options, 'project-id');
      return {ok: true, command, candidate_inputs: await prepareCandidate(projectId)};
    }
    case 'proof:render': {
      const projectId = requiredOption(options, 'project-id');
      const candidateSha = requiredOption(options, 'candidate-sha');
      const proofRunId = requiredOption(options, 'proof-run-id');
      return {ok: true, command, proof: await renderProof({projectId, candidateSha, proofRunId})};
    }
    case 'full:render': {
      const projectId = requiredOption(options, 'project-id');
      const candidateSha = requiredOption(options, 'candidate-sha');
      const approvedProofRunId = requiredOption(options, 'approved-proof-run-id');
      const proofManifestFile = requiredOption(options, 'proof-manifest-file');
      return {ok: true, command, final: await renderFull({projectId, candidateSha, approvedProofRunId, proofManifestFile})};
    }
    default: throw new OrvyqError('CLI_COMMAND_UNKNOWN', `Unknown command: ${command ?? '<missing>'}`);
  }
}

try {
  const {command, options} = parseArgs(process.argv.slice(2));
  const result = await run(command, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const normalized = asOrvyqError(error);
  process.stderr.write(`${JSON.stringify(normalized.toJSON(), null, 2)}\n`);
  process.exitCode = 1;
}
