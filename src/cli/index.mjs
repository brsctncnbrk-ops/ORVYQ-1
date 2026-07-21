#!/usr/bin/env node
import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {asOrvyqError, OrvyqError} from '../core/errors.mjs';
import {repoRoot} from '../core/paths.mjs';
import {initializeProject} from '../contracts/manifest.mjs';

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

async function systemCheck() {
  const required = [
    'docs/quality-contract.md',
    'docs/architecture.md',
    'docs/migration-policy.md',
    'docs/rebuild-plan.md',
    'schemas/manifest.schema.json',
    'package.json',
    'package-lock.json'
  ];
  for (const relative of required) await access(path.join(repoRoot(), relative));
  const packageJson = JSON.parse(await readFile(path.join(repoRoot(), 'package.json'), 'utf8'));
  if (packageJson.type !== 'module') throw new OrvyqError('RUNTIME_BASELINE_INVALID', 'package.json must use ESM');
  return {
    ok: true,
    command: 'system:check',
    node: process.version,
    required_files: required
  };
}

async function run(command, options) {
  switch (command) {
    case 'system:check':
      return systemCheck();
    case 'project:init': {
      const minimumDurationSeconds = options['minimum-duration-seconds'] === undefined
        ? 600
        : Number(options['minimum-duration-seconds']);
      const manifest = await initializeProject({
        projectId: options['project-id'],
        title: options.title,
        minimumDurationSeconds
      });
      return {ok: true, command, manifest};
    }
    default:
      throw new OrvyqError('CLI_COMMAND_UNKNOWN', `Unknown command: ${command ?? '<missing>'}`);
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
