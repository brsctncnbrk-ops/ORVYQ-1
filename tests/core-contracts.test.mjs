import test from 'node:test';
import assert from 'node:assert/strict';
import {OrvyqError} from '../src/core/errors.mjs';
import {stableStringify, sha256Json} from '../src/core/json.mjs';
import {safeProjectPath} from '../src/core/paths.mjs';
import {assertTransition, nextStage, transitionManifest} from '../src/core/state-machine.mjs';
import {createManifest, validateManifest} from '../src/contracts/manifest.mjs';

test('deterministic JSON ignores object insertion order', () => {
  const left = {b: 2, a: {d: 4, c: 3}};
  const right = {a: {c: 3, d: 4}, b: 2};
  assert.equal(stableStringify(left), stableStringify(right));
  assert.equal(sha256Json(left), sha256Json(right));
});

test('safe project paths reject traversal', () => {
  assert.throws(
    () => safeProjectPath('valid-project', '..', 'outside.txt'),
    (error) => error instanceof OrvyqError && error.code === 'PROJECT_PATH_ESCAPE'
  );
});

test('state machine allows only the next canonical stage', () => {
  assert.equal(nextStage('SOURCE_INTAKE'), 'RESEARCH');
  assert.equal(assertTransition('SOURCE_INTAKE', 'RESEARCH'), true);
  assert.throws(
    () => assertTransition('SOURCE_INTAKE', 'SCRIPT'),
    (error) => error instanceof OrvyqError && error.code === 'STAGE_TRANSITION_INVALID'
  );
});

test('manifest transition records an immutable audit event', () => {
  const manifest = createManifest({projectId: 'test-film', title: 'Test Film', minimumDurationSeconds: 600});
  const transitioned = transitionManifest(manifest, 'RESEARCH', 'Source intake contract completed');
  assert.equal(manifest.current_stage, 'SOURCE_INTAKE');
  assert.equal(transitioned.current_stage, 'RESEARCH');
  assert.equal(transitioned.history.length, 1);
  assert.equal(transitioned.history[0].from, 'SOURCE_INTAKE');
  assert.equal(transitioned.history[0].to, 'RESEARCH');
});

test('manifest validation rejects weak minimum duration and malformed candidate identity', () => {
  assert.throws(
    () => createManifest({projectId: 'test-film', title: 'Test Film', minimumDurationSeconds: 30}),
    (error) => error instanceof OrvyqError && error.code === 'MINIMUM_DURATION_INVALID'
  );

  const manifest = createManifest({projectId: 'test-film', title: 'Test Film'});
  assert.throws(
    () => validateManifest({...manifest, candidate_sha: 'not-a-sha'}),
    (error) => error instanceof OrvyqError && error.code === 'CANDIDATE_SHA_INVALID'
  );
});
