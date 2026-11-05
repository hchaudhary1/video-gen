// Production metadata and artifact observations; Archon owns all scheduling.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { findVisualPlan } from './timing.mjs';
import { DEFAULT_TTS_PROVIDER, TTS_PROVIDERS } from './narration.mjs';
import { parseReviewDepth, fileHash } from './review.mjs';
import { requirePersonality, loadPersonality, freezePersonality, readPersonality } from './personalities.mjs';
import { thumbnailStatus } from './thumbnails.mjs';
export const PROJECT_FILE = 'project.json';
export const GATES = ['script', 'final', 'thumbnail'];
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const text = async (f) =>
  readFile(f, 'utf8').catch((e) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
const exists = async (f) => {
  try {
    await access(f);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
const save = async (f, v) => {
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(v, null, 2) + '\n');
};
const isSlug = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s || '');
const rel = (root, file) => path.relative(root, file);
export const projectDir = (root, slug) => path.join(root, 'jobs/scripts', slug);
export const projectJob = (root, slug) => path.join(root, 'jobs', slug);
export async function loadProject(root, slug) {
  if (!isSlug(slug)) throw new Error('Explicit lowercase project slug required');
  const project = await json(path.join(projectDir(root, slug), PROJECT_FILE));
  if (!project.archon) throw new Error('Project must be created by an Archon workflow');
  readPersonality(projectDir(root, slug));
  return project;
}
export const saveProject = (root, project) =>
  save(path.join(projectDir(root, project.slug), PROJECT_FILE), project);
function gateList(value) {
  if (value === undefined) return [...GATES];
  const list = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 1 && list[0] === 'none') return [];
  if (list.some((s) => !GATES.includes(s)))
    throw new Error('review must name script,final,thumbnail or none');
  return [...new Set(list)];
}
export async function createProject(root, opts, { resolveInput = async (f) => path.resolve(root, f) } = {}) {
  const slug = opts.name;
  if (!isSlug(slug))
    throw new Error('Archon requires an explicit <lowercase-slug> (letters, digits, dashes).');
  const dir = projectDir(root, slug);
  if (await exists(path.join(dir, PROJECT_FILE)))
    throw new Error(`Project "${slug}" exists. Continue it with its Archon run.`);
  if (await exists(projectJob(root, slug)))
    throw new Error(`jobs/${slug} already exists. Choose another --name.`);
  requirePersonality(opts.profile);
  const format = opts.format ?? null;
  if (format && !['landscape', 'vertical', 'square'].includes(format))
    throw new Error('--format is landscape, vertical or square.');
  const duration = opts.duration === undefined ? null : Number(opts.duration);
  if (duration !== null && !(duration > 0)) throw new Error('--duration is the target length in seconds.');
  const tts = opts.tts || (opts.profile === 'kai-explainer' ? 'kokoro' : DEFAULT_TTS_PROVIDER);
  if (!(opts.profile === 'kai-explainer' ? ['kokoro', 'recording'] : TTS_PROVIDERS).includes(tts))
    throw new Error('--tts is ming.');
  const thumbnails = opts.thumbnails === undefined ? null : Number(opts.thumbnails);
  if (thumbnails !== null && !(Number.isInteger(thumbnails) && thumbnails >= 1 && thumbnails <= 6))
    throw new Error('--thumbnails is 1 to 6.');
  const reviewDepth = parseReviewDepth(opts['review-depth']);
  const audio = opts.audio ? rel(root, await resolveInput(opts.audio, 'Audio')) : null;
  const script = opts.script ? await resolveInput(opts.script, 'Script') : null;
  const music = opts.music ? rel(root, await resolveInput(opts.music, 'Music')) : null;
  if (audio && !script) throw new Error('A supplied recording needs its script too: add --script <file>.');
  await mkdir(dir, { recursive: true });
  const briefFile = path.join(dir, 'BRIEF.md');
  if (opts.brief) await writeFile(briefFile, String(opts.brief).trim() + '\n');
  else if (opts['brief-file']) await copyFile(path.resolve(root, opts['brief-file']), briefFile);
  const brief = await text(briefFile);
  if (!brief?.trim() && !script)
    throw new Error(
      `Write the agreed brief to jobs/scripts/${slug}/BRIEF.md first (or pass --brief-file), then start the Archon workflow.`,
    );
  const productionProfile = await freezePersonality(dir, loadPersonality(requirePersonality(opts.profile)));
  if (script) {
    // the person's own script: kept as written, and its visual plan if one sits beside it
    if (path.resolve(script) !== path.join(dir, 'SCRIPT.md'))
      await copyFile(script, path.join(dir, 'SCRIPT.md'));
    const visuals = await findVisualPlan(script);
    if (visuals && path.resolve(visuals) !== path.join(dir, 'VISUALS.md'))
      await copyFile(visuals, path.join(dir, 'VISUALS.md'));
  }
  const project = {
    version: 1,
    slug,
    createdAt: new Date().toISOString(),
    format,
    duration,
    tts,
    audio,
    inputScript: script ? rel(root, script) : null,
    suppliedScriptSha256: script ? await fileHash(path.join(dir, 'SCRIPT.md')) : null,
    music,
    productionProfile,
    review: gateList(opts.review),
    reviewDepth,
    thumbnails,
    archon: { version: 1, optOut: opts.optOut === true },
  };
  await saveProject(root, project);
  return project;
}

export function scriptDisposition(value) {
  const clean = String(value || '').replace(/[*_`]+/g, '');
  const labelled =
    /^[ \t]*(?:#{1,6}[ \t]*)?(?:final[ \t]+)?(?:disposition|verdict|status|outcome)[ \t]*:[ \t]*(pass|revise|incomplete)\b.*$/gim;
  const bare =
    /^[ \t]*(?:#{1,6}[ \t]*)?(pass|revise|incomplete)\b(?:[ \t]*$|\.[ \t]*(?:$|.+$)|[ \t]*[—:–-][ \t]+.*$)/gim;
  const verdicts = [...clean.matchAll(labelled), ...clean.matchAll(bare)].sort((a, b) => a.index - b.index);
  return verdicts.at(-1)?.[1].toLowerCase() || '';
}

export async function projectStatus(root, slug) {
  const project = await loadProject(root, slug),
    dir = projectDir(root, slug),
    job = projectJob(root, slug);
  const delivery = await json(path.join(job, 'review/delivery.json')).catch(() => null);
  const manifest = await json(path.join(job, 'job.json')).catch(() => null);
  const script = await text(path.join(dir, 'SCRIPT.md'));
  return {
    slug,
    project,
    phase: delivery ? 'Delivered artifacts' : 'Archon run owns progress',
    script: script
      ? {
          words: script.split(/\s+/).length,
          disposition: scriptDisposition(await text(path.join(dir, 'review.md'))),
        }
      : null,
    film: manifest ? { delivery } : null,
    thumbnails: manifest ? await thumbnailStatus(job) : null,
  };
}
