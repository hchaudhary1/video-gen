#!/usr/bin/env node
// Script-only lab for Kai explainers (`kai-script` workflow). Every stage the full
// kai-explainer workflow also runs is delegated to scripts/archon/kai-explainer.mjs, so a
// project made here continues unchanged in `kai-explainer`. Two stages are lab-specific:
//   research-status  the base research check plus the take dossier (analysis, community)
//   redo             archive earlier outputs so a re-run repeats review, writing or research
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, mkdir, rename, stat } from 'node:fs/promises';
import { run as kai } from './kai-explainer.mjs';
import { saveJSON, readJSON } from './stages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const text = (f) => readFile(f, 'utf8').catch((e) => (e.code === 'ENOENT' ? '' : Promise.reject(e)));
const exists = (f) => stat(f).then(() => true, (e) => (e.code === 'ENOENT' ? false : Promise.reject(e)));
const filesIn = async (dir) => {
  const list = await readdir(dir, { withFileTypes: true }).catch((e) => (e.code === 'ENOENT' ? [] : Promise.reject(e)));
  const found = [];
  for (const entry of list) {
    if (entry.isDirectory()) found.push(...(await filesIn(path.join(dir, entry.name))));
    else if (entry.isFile() && (await text(path.join(dir, entry.name))).trim()) found.push(entry.name);
  }
  return found;
};
// Body of a `## Heading` section up to the next `## `.
const section = (md, heading) => {
  const m = md.match(new RegExp(`^##[ \\t]+${heading}[^\\n]*\\n([\\s\\S]*?)(?=^##[ \\t]|(?![\\s\\S]))`, 'im'));
  return m ? m[1].trim() : null;
};

export const DOSSIER = [
  { heading: 'Claims and evidence' },
  { heading: 'Independent research' },
  { heading: 'Community reactions', folder: 'community' },
  { heading: 'Candidate takes' },
];

export async function dossierErrors(dir) {
  const errors = [];
  const analysis = await text(path.join(dir, 'sources/ANALYSIS.md'));
  if (!analysis.trim()) return ['sources/ANALYSIS.md (the take dossier) is missing or empty.'];
  for (const { heading, folder } of DOSSIER) {
    const body = section(analysis, heading);
    if (!body) {
      errors.push(`sources/ANALYSIS.md needs a non-empty "## ${heading}" section.`);
      continue;
    }
    // A blocked platform is acceptable when the dossier says what was tried and what is unknown.
    if (folder && !(await filesIn(path.join(dir, 'sources', folder))).length && !/^\s*Unavailable:/im.test(body))
      errors.push(`sources/${folder}/ has no retained files; retain them, or add an "Unavailable:" line under "## ${heading}" saying what was tried.`);
  }
  return errors;
}

const ARCHIVE = {
  review: ['review.md', 'review-draft.md', 'archon/script-review.json', 'archon/script-review-request.json',
    'archon/script-revision.json'],
  write: ['SCRIPT.md', 'VISUALS.md', 'research.md', 'archon/script-decision.json'],
  research: ['SOURCES.md', 'sources'],
};
const LEVELS = { none: [], review: ['review'], write: ['review', 'write'], research: ['review', 'write', 'research'] };

export async function redo(slug, level, root = ROOT) {
  if (!(level in LEVELS)) throw new Error(`redo must be one of ${Object.keys(LEVELS).join(', ')}`);
  const dir = path.join(root, 'jobs/scripts', slug);
  const runId = process.env.WORKFLOW_ID || null;
  const receiptFile = path.join(dir, 'archon/redo.json');
  const receipt = await readJSON(receiptFile).catch(() => null);
  // A resumed run must not archive the work its own earlier nodes produced.
  if (runId && receipt?.runId === runId) return { level, archived: [], skipped: 'already applied in this run' };
  const target = path.join(dir, 'archon/iterations', new Date().toISOString().replace(/[:.]/g, '-'));
  const archived = [];
  for (const group of LEVELS[level])
    for (const rel of ARCHIVE[group]) {
      if (!(await exists(path.join(dir, rel)))) continue;
      await mkdir(path.dirname(path.join(target, rel)), { recursive: true });
      await rename(path.join(dir, rel), path.join(target, rel));
      archived.push(rel);
    }
  if (level !== 'none')
    await saveJSON(receiptFile, { version: 1, runId, level, archived, to: path.relative(dir, target), at: new Date().toISOString() });
  return { level, archived, to: archived.length ? path.relative(dir, target) : null };
}

export async function run(stage, slug, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('Explicit project slug required');
  if (stage === 'redo') return { version: 1, status: 'complete', stage, artifacts: await redo(slug, options.level || 'none') };
  const result = await kai(stage, slug, options);
  if (stage === 'research-status') {
    const errors = [...(result.artifacts.errors || []), ...(await dossierErrors(path.join(ROOT, 'jobs/scripts', slug)))];
    result.artifacts = { ...result.artifacts, done: !errors.length, errors };
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log = (...args) => console.error(...args);
  try {
    const [stage, slug, arg] = process.argv.slice(2);
    const options = stage === 'redo' ? { level: arg || 'none' } : arg && arg !== '--route' ? JSON.parse(arg) : {};
    process.stdout.write(JSON.stringify(await run(stage, slug, options)) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'error', error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
