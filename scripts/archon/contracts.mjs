// Deterministic artifact contracts. These validate outputs; Archon schedules repairs.
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { parseScript } from '../../engines/explainroo/src/script.js';

const text = async (file) => readFile(file, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});

export async function validateScript(dir, project) {
  const errors = [];
  const script = await text(path.join(dir, 'SCRIPT.md'));
  if (!script.trim()) errors.push('SCRIPT.md is missing or empty.');
  if (!(await text(path.join(dir, 'VISUALS.md'))).trim()) errors.push('VISUALS.md is missing or empty.');
  if (script.trim() && project.productionProfile?.id === 'kai-explainer') {
    try {
      const parsed = parseScript(script);
      if (!parsed.scenes.some(scene => scene.units.some(unit => unit.type === 'word')))
        errors.push('Kai script must contain spoken narration.');
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { valid: !errors.length, errors };
}

const filesIn = async (dir) => {
  const list = await readdir(dir, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
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

// The Kai take dossier (script-writing references/kai-take.md, section 1).
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

export async function validateResearch(dir, project) {
  const errors = [];
  if (!(await text(path.join(dir, 'SOURCES.md'))).trim()) errors.push('SOURCES.md is missing or empty.');
  if (project.productionProfile?.id === 'kai-explainer') {
    const files = await readdir(path.join(dir, 'sources'), { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const evidence = await Promise.all(files.filter(f => f.isFile()).map(f =>
      text(path.join(dir, 'sources', f.name))));
    if (!evidence.some(body => body.trim())) errors.push('sources/ needs retained primary-source evidence.');
    errors.push(...(await dossierErrors(dir)));
  } else if (!(await text(path.join(dir, 'identity.json'))).trim()) {
    errors.push('identity.json is required for the saved rules-story series.');
  }
  return { done: !errors.length, errors };
}
