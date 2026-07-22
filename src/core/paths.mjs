import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OrvyqError, invariant} from './errors.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDir, '..', '..');

export function repoRoot() {
  return root;
}

export function assertProjectId(projectId) {
  invariant(typeof projectId === 'string' && /^[a-z0-9][a-z0-9-]{1,79}$/.test(projectId), 'PROJECT_ID_INVALID', 'Project ID must use lowercase letters, numbers, and hyphens');
  return projectId;
}

export function projectsRoot() {
  return path.join(root, 'projects');
}

export function projectRoot(projectId) {
  return path.join(projectsRoot(), assertProjectId(projectId));
}

export function safeProjectPath(projectId, ...segments) {
  const base = projectRoot(projectId);
  const target = path.resolve(base, ...segments);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new OrvyqError('PROJECT_PATH_ESCAPE', 'Resolved path escapes the project directory', {projectId, segments});
  }
  return target;
}
