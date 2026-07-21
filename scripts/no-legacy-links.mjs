import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const allowedWorkflows = ['ci.yml', 'full-render.yml', 'proof.yml'];
const actual = fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml')).sort();
if (JSON.stringify(actual) !== JSON.stringify(allowedWorkflows)) throw new Error(`Only three workflows are allowed. Found: ${actual.join(', ')}`);

const forbidden = [
  ['YouTube', '_pepline'].join(''),
  ['external', '_assets.json'].join(''),
  ['material', 'ize-assets'].join(''),
  ['cross', '-repo'].join(''),
  ['legacy', '-repo'].join('')
];
const roots = ['src', '.github', 'package.json', 'package-lock.json'];
const files = [];
const walk = (entry) => {
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
  else files.push(entry);
};
for (const relative of roots) walk(path.join(root, relative));
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const token of forbidden) if (text.includes(token)) throw new Error(`Forbidden runtime dependency token ${token} in ${path.relative(root, file)}`);
}
console.log('No legacy runtime links and exactly three workflows: PASS');
