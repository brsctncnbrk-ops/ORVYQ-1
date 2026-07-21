import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    );
  }
  return value;
}

export function stableStringify(value, spacing = 2) {
  return `${JSON.stringify(normalize(value), null, spacing)}\n`;
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(stableStringify(value, 0), 'utf8'));
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, stableStringify(value), 'utf8');
  await rename(temporary, file);
}
