// Series identities for rules-story horror: who is speaking, the case-file overlay, the twist and sign-off,
// the sound signature and a file counter. One JSON file per identity under personalities/rules-story/identities/.
// Continuing an identity gives a project the next file number (a Short reuses its parent's number) and the
// identical sound signature, so every film in the series opens on the same sound and the same frame.
import {readFile, writeFile, readdir, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {signature} from './sound-design.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IDENTITY_DIR = path.join(ROOT, 'personalities/rules-story/identities');
const ID = /^[a-z][a-z0-9-]{1,40}$/, SLUG = /^[a-z0-9][a-z0-9-]*$/;
const TEXT = ['name', 'persona', 'twist', 'signOff'];
const dirOf = env => env.VG_IDENTITIES ? path.resolve(ROOT, env.VG_IDENTITIES) : IDENTITY_DIR;

export function validateIdentity(x) {
  const errors = [];
  if (!ID.test(x?.id || '')) errors.push('id must be lowercase letters, digits and hyphens');
  for (const k of TEXT) if (typeof x?.[k] !== 'string' || !x[k].trim()) errors.push(`${k} is required`);
  const o = x?.overlay || {};
  if (typeof o.label !== 'string' || !o.label.trim() || typeof o.unit !== 'string' || !o.unit.trim()) errors.push('overlay needs label and unit (e.g. "NIGHT OFFICE", "NOTICE")');
  if (o.danger != null && !/^#[0-9a-f]{6}$/i.test(o.danger)) errors.push('overlay.danger must be a #rrggbb colour');
  try { signature(x?.sound); } catch (e) { errors.push(`sound: ${e.message}`); }
  if (!Number.isInteger(x?.counter) || x.counter < 0) errors.push('counter must be a whole number');
  if (!Array.isArray(x?.issues)) errors.push('issues must be a list');
  if (errors.length) throw new Error(`Invalid identity ${x?.id || '(no id)'}: ${errors.join('; ')}`);
  return x;
}

export const fileNumber = n => String(n).padStart(3, '0');
/** "NIGHT OFFICE · NOTICE 001" */
export const overlayText = (identity, n) => `${identity.overlay.label} · ${identity.overlay.unit} ${fileNumber(n)}`;

export async function listIdentities(env = process.env) {
  const dir = dirOf(env), names = (await readdir(dir).catch(() => [])).filter(n => n.endsWith('.json')).sort();
  return Promise.all(names.map(async n => validateIdentity(JSON.parse(await readFile(path.join(dir, n), 'utf8')))));
}

export async function getIdentity(id, env = process.env) {
  if (!ID.test(id || '')) throw new Error('Name an identity with --id <identity> (see: npm run video -- identities).');
  const file = path.join(dirOf(env), `${id}.json`);
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw == null) throw new Error(`No identity "${id}". Existing: ${(await listIdentities(env)).map(i => i.id).join(', ') || 'none'}. Create one with identity-new.`);
  return validateIdentity(JSON.parse(raw));
}

async function store(identity, env) {
  validateIdentity(identity);
  const dir = dirOf(env), file = path.join(dir, `${identity.id}.json`), tmp = `${file}.${process.pid}.tmp`;
  await mkdir(dir, {recursive: true});
  await writeFile(tmp, JSON.stringify(identity, null, 2) + '\n');
  await rename(tmp, file);
  return identity;
}

/** A new identity. The sound seed defaults to one derived from the id, so it is stable and distinct. */
export async function createIdentity(spec, env = process.env) {
  if ((await listIdentities(env)).some(i => i.id === spec.id)) throw new Error(`Identity "${spec.id}" already exists; continue it instead.`);
  let seed = 2166136261;
  for (const c of String(spec.id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const identity = {id: spec.id, name: spec.name, overlay: {label: spec.label, unit: spec.unit, danger: spec.danger || '#e5322d'},
    persona: spec.persona, twist: spec.twist, signOff: spec.signOff,
    sound: {seed: spec.seed ?? seed % 100000, key: spec.key || 'A', scale: spec.scale || 'phrygian', bed: spec.bed || 'dread', texture: spec.texture || 'none', motif: spec.motif || [0, 1, 4]},
    counter: 0, issues: [], createdAt: new Date().toISOString()};
  return store(identity, env);
}

/** Give a project its file number. Idempotent per project; a Short (parent) shares its parent's number. */
export async function continueIdentity(id, {project, parent = null, format = null} = {}, env = process.env) {
  if (!SLUG.test(project || '')) throw new Error('identity-continue needs --project <slug>.');
  const identity = await getIdentity(id, env);
  const existing = identity.issues.find(i => i.project === project);
  if (existing) return {identity, issue: existing, overlay: overlayText(identity, existing.number), created: false};
  let number;
  if (parent) {
    const p = identity.issues.find(i => i.project === parent);
    if (!p) throw new Error(`Parent project "${parent}" has no ${identity.name} file number; continue the identity for it first.`);
    number = p.number;
  } else number = identity.counter += 1;
  const issue = {number, project, ...(parent ? {parent} : {}), ...(format ? {format} : {}), at: new Date().toISOString()};
  identity.issues.push(issue);
  await store(identity, env);
  return {identity, issue, overlay: overlayText(identity, number), created: true};
}

/** The identity and file number recorded for a project (or null). */
export async function identityForProject(project, env = process.env) {
  for (const identity of await listIdentities(env)) {
    const issue = identity.issues.find(i => i.project === project);
    if (issue) return {identity, issue, overlay: overlayText(identity, issue.number)};
  }
  return null;
}
