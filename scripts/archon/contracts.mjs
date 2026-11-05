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
  } else if (!(await text(path.join(dir, 'identity.json'))).trim()) {
    errors.push('identity.json is required for the saved rules-story series.');
  }
  return { done: !errors.length, errors };
}
