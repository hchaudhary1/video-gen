// Series production helpers for rules-story horror: sentence captions from measured words, the series data file
// the HyperFrames kit reads, and an identity's synthesized sound kit with provenance.
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tokens} from './timing.mjs';
import {resolveSceneCue} from './composition.mjs';
import {getIdentity, identityForProject, overlayText, fileNumber} from './identities.mjs';
import {identityKitPlan, renderPlanned, renderEffect, renderBed, toWav, ENGINE, signature} from './sound-design.mjs';
import {useBundle} from './assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KIT_ITEM = 'rules-series-kit@1.0.0';
const json = async f => JSON.parse(await readFile(f, 'utf8'));
const exists = f => access(f).then(() => true, () => false);
const sha = buf => createHash('sha256').update(buf).digest('hex');

/** Split narration into caption chunks: whole sentences, long ones broken at clause marks into at most maxWords. */
export function captionChunks(script, {maxWords = 10} = {}) {
  const text = String(script).replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["”’)]*|$)/g)?.map(s => s.trim()).filter(Boolean) || [];
  const out = [];
  for (const sentence of sentences) {
    if (tokens(sentence).length <= maxWords) { out.push(sentence); continue; }
    const clauses = sentence.match(/[^,;:—–]+(?:[,;:—–]+|$)/g).map(s => s.trim()).filter(Boolean);
    let current = '';
    for (const clause of clauses) {
      const joined = current ? `${current} ${clause}` : clause;
      if (current && tokens(joined).length > maxWords) { out.push(current); current = clause; } else current = joined;
    }
    if (current) out.push(current);
  }
  // Clauses longer than the limit are split evenly by words.
  return out.flatMap(chunk => {
    const words = chunk.split(' '), n = tokens(chunk).length;
    if (n <= maxWords + 2) return [chunk];
    const parts = Math.ceil(n / maxWords), size = Math.ceil(words.length / parts);
    return Array.from({length: parts}, (_, k) => words.slice(k * size, (k + 1) * size).join(' ')).filter(Boolean);
  });
}

/** Caption timing from measured words: [{start, end, hold, text}] in recording seconds. */
export function seriesCaptions(script, alignment, duration, {maxWords = 10, linger = 2.5} = {}) {
  const chunks = captionChunks(script, {maxWords});
  let index = 0;
  const caps = chunks.map(text => {
    const n = tokens(text).length, from = index, to = index + n;
    index = to;
    const words = alignment.words.filter(w => w.scriptIndex != null && w.scriptIndex >= from && w.scriptIndex < to);
    return {text, start: words.length ? Math.min(...words.map(w => w.start)) : null, end: words.length ? Math.max(...words.map(w => w.end)) : null};
  });
  caps.forEach((c, k) => { // unmatched chunks sit between their neighbours
    if (c.start != null) return;
    const prev = caps.slice(0, k).reverse().find(x => x.end != null), next = caps.slice(k + 1).find(x => x.start != null);
    c.start = prev ? prev.end : 0; c.end = next ? next.start : duration;
  });
  return caps.map((c, k) => {
    const next = caps[k + 1];
    const hold = next ? Math.min(next.start, c.end + linger) : Math.min(duration, c.end + 1.5);
    return {start: +c.start.toFixed(3), end: +c.end.toFixed(3), hold: +Math.max(hold, c.end).toFixed(3), text: c.text};
  });
}

/** Write assets/series/series-data.js (identity, rules, captions) and install the kit bundle. */
export async function prepareSeries(job, {library = process.env.VG_LIBRARY || path.join(ROOT, 'library'), env = process.env} = {}) {
  const manifest = await json(path.join(job, 'job.json')), alignment = await json(path.join(job, 'alignment.json'));
  const series = await json(path.join(job, 'series.json')).catch(e => { throw new Error(e.code === 'ENOENT' ? `${path.relative(ROOT, job)}/series.json is missing. Write {"identity": "<id>", "rules": [{"n": 1, "title": "...", "at": {"phrase": "..."}}]}.` : `series.json: ${e.message}`); });
  const project = series.project || path.basename(job);
  const found = await identityForProject(project, env);
  if (!found) throw new Error(`Project ${project} has no series file number. Run: npm run video -- identity-continue --id ${series.identity || '<id>'} --project ${project}`);
  if (series.identity && series.identity !== found.identity.id) throw new Error(`series.json names ${series.identity} but ${project} is registered to ${found.identity.id}.`);
  const warnings = [], rules = (series.rules || []).map((r, k) => {
    if (!Number.isInteger(r.n) || r.n < 1 || typeof r.title !== 'string' || !r.title.trim()) throw new Error(`series.json rules[${k}] needs n (whole number) and title`);
    return {n: r.n, title: r.title, start: resolveSceneCue(r.at, alignment, manifest.duration, 0, manifest.duration, `series.json rules[${k}]`, warnings)};
  });
  const script = await readFile(path.join(job, 'inputs/source-script.md'), 'utf8');
  const captions = seriesCaptions(script, alignment, manifest.duration, {maxWords: series.captionWords || (manifest.height > manifest.width ? 7 : 10)});
  const {identity, issue} = found;
  const data = {version: 1, identity: {id: identity.id, name: identity.name, label: identity.overlay.label, unit: identity.overlay.unit, number: fileNumber(issue.number),
    overlay: overlayText(identity, issue.number), danger: identity.overlay.danger || '#e5322d'},
  canvas: {width: manifest.width, height: manifest.height, fps: manifest.fps}, duration: manifest.duration, rules, captions};
  await mkdir(path.join(job, 'assets/series'), {recursive: true});
  await writeFile(path.join(job, 'assets/series/series-data.js'), `/* Generated by series-kit from series.json, alignment.json and the identity registry; do not hand-edit. */\nwindow.RulesSeriesData = ${JSON.stringify(data, null, 1)};\n`);
  const table = ['# Caption cues', '', 'Index, start (s), text. Use RulesSeries.cue(sceneId, index) for local times.', '', '| # | start | end | text |', '|---|---|---|---|',
    ...captions.map((c, i) => `| ${i} | ${c.start.toFixed(2)} | ${c.end.toFixed(2)} | ${c.text.replace(/\|/g, '/')} |`), ''];
  await mkdir(path.join(job, 'review'), {recursive: true});
  await writeFile(path.join(job, 'review/series-captions.md'), table.join('\n'));
  let kit = null;
  const ledger = await json(path.join(job, 'library.json')).catch(() => ({items: []}));
  if (!ledger.items.some(i => i.item === KIT_ITEM)) kit = await useBundle(library, KIT_ITEM, job);
  const gaps = captions.slice(1).map((c, k) => c.start - captions[k].start).sort((a, b) => a - b);
  return {data, warnings, kitInstalled: Boolean(kit), captionCount: captions.length, medianCaptionSeconds: gaps.length ? +gaps[Math.floor(gaps.length / 2)].toFixed(2) : null};
}

async function upsertSources(job, entries) {
  const file = path.join(job, 'assets/SOURCES.json');
  const ledger = (await json(file).catch(() => [])).filter(e => !entries.some(n => n.name === e.name));
  ledger.push(...entries);
  await writeFile(file, JSON.stringify(ledger, null, 2) + '\n');
}

const PROVENANCE = {source: `Synthesized locally by lib/sound-design.mjs (video-gen) on the vendored ${ENGINE}`,
  license: 'Project-owned synthesis output; no third-party recordings. Synth engine: explainroo engine/audio, MIT, Copyright (c) 2026 Vincent Schmalbach.'};

async function writeAudio(job, name, audio, note, params) {
  const buf = toWav(audio), file = path.join(job, 'assets', name);
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, buf);
  return {name, src: `synth:${note.split(':')[0]}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])).toString()}`,
    ...PROVENANCE, sha256: sha(buf), note, title: note, tags: ['synth', 'horror', 'series']};
}

/** Render an identity's sound kit into a job: the bed for the film's length (plus a tail), the ident and every effect. */
export async function renderSoundKit(job, id, {duration, env = process.env} = {}) {
  const identity = await getIdentity(id, env), manifest = await json(path.join(job, 'job.json')).catch(() => null);
  const length = duration ?? (manifest ? manifest.duration + 2 : null);
  if (!Number.isFinite(length) || length <= 0) throw new Error('synth --identity needs a prepared job (job.json) or --duration <seconds>.');
  const entries = [];
  for (const file of identityKitPlan(identity.id, identity.sound, {duration: +length.toFixed(3)})) {
    const audio = renderPlanned(file), label = file.kind === 'bed' ? `bed:${identity.name} ${file.params.style} drone bed` : `${file.effect}:${identity.name} ${file.effect}`;
    entries.push(await writeAudio(job, file.name, audio, `${label} (identity ${identity.id}, seed ${identity.sound.seed}, ${identity.sound.key} ${identity.sound.scale})`, {identity: identity.id, ...file.params}));
  }
  await upsertSources(job, entries);
  return {identity: identity.id, signature: signature(identity.sound), files: entries.map(e => e.name), music: {src: `assets/music/${identity.id}-bed.wav`, ...PROVENANCE}};
}

/** One named effect or bed with explicit parameters. */
export async function renderSingle(job, {effect, bed, name, ...params}) {
  if (!name) throw new Error('synth needs --name sfx/<file>.wav (effects) or music/<file>.wav (beds).');
  if (!/^(sfx|music)\/[a-z0-9][a-z0-9._-]*\.wav$/.test(name)) throw new Error('--name must look like sfx/knock-3.wav or music/bed.wav');
  const audio = bed ? renderBed({style: bed, ...params}) : renderEffect(effect, params);
  const entry = await writeAudio(job, name, audio, `${bed ? 'bed' : effect}:${bed ? `${bed} drone bed` : effect} (seed ${params.seed ?? 1}, ${params.key ?? 'A'} ${params.scale ?? 'minor'})`, {...(bed ? {bed} : {effect}), ...params});
  await upsertSources(job, [entry]);
  return {file: `assets/${name}`, duration: +audio.duration.toFixed(3), sha256: entry.sha256};
}

export {exists};
