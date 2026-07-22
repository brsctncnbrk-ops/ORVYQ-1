import {invariant} from '../core/errors.mjs';

export function object(value, code, message) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), code, message);
  return value;
}

export function array(value, code, message, {min = 0} = {}) {
  invariant(Array.isArray(value) && value.length >= min, code, message);
  return value;
}

export function string(value, code, message, {min = 1, pattern} = {}) {
  invariant(typeof value === 'string' && value.trim().length >= min, code, message);
  if (pattern) invariant(pattern.test(value), code, message);
  return value;
}

export function number(value, code, message, {min = -Infinity, max = Infinity, integer = false} = {}) {
  invariant(Number.isFinite(value) && value >= min && value <= max, code, message);
  if (integer) invariant(Number.isInteger(value), code, message);
  return value;
}

export function boolean(value, code, message) {
  invariant(typeof value === 'boolean', code, message);
  return value;
}

export function enumValue(value, allowed, code, message) {
  invariant(allowed.includes(value), code, `${message}; got ${String(value)}`);
  return value;
}

export function unique(items, code, label) {
  const values = new Set(items);
  invariant(values.size === items.length, code, `${label} must be unique`);
  return items;
}

export function isoDate(value, code, label) {
  string(value, code, `${label} is required`);
  invariant(!Number.isNaN(Date.parse(value)), code, `${label} must be ISO date-time`);
  return value;
}

export function sha256(value, code, label) {
  string(value, code, `${label} is required`, {pattern: /^[0-9a-f]{64}$/});
  return value;
}

export function gitSha(value, code = 'CANDIDATE_SHA_INVALID', label = 'candidate SHA') {
  string(value, code, `${label} must be a 40-character lowercase Git SHA`, {pattern: /^[0-9a-f]{40}$/});
  return value;
}

export function repositoryRelativePath(value, code, label) {
  string(value, code, `${label} is required`);
  invariant(!value.startsWith('/') && !value.includes('..') && !value.includes('\\'), code, `${label} must be a safe repository-relative path`);
  return value;
}

export function url(value, code, label) {
  string(value, code, `${label} is required`);
  let parsed;
  try { parsed = new URL(value); } catch { invariant(false, code, `${label} must be a URL`); }
  invariant(['https:', 'repo:'].includes(parsed.protocol), code, `${label} must use https:// or repo://`);
  return value;
}

export function indexBy(items, key, code, label) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    string(value, code, `${label} item is missing ${key}`);
    invariant(!map.has(value), code, `${label} contains duplicate ${key}: ${value}`);
    map.set(value, item);
  }
  return map;
}
