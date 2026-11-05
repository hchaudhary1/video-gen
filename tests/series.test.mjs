import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {captionChunks, seriesCaptions, prepareSeries, renderSoundKit, renderSingle} from '../lib/series.mjs';
import {createIdentity, continueIdentity, getIdentity, listIdentities, identityForProject, overlayText} from '../lib/identities.mjs';
import {inspectBundle} from '../lib/assets.mjs';
import {tokens} from '../lib/timing.mjs';
import {decodeWav} from '../lib/audio.mjs';

const tmp = prefix => mkdtemp(path.join(os.tmpdir(), prefix));
async function registry() {
  const dir = await tmp('vg-ids-');
  // Fresh counters: the shipped registry records real productions.
  for (const f of await readdir('personalities/rules-story/identities')) {
    const identity = JSON.parse(await readFile(path.join('personalities/rules-story/identities', f), 'utf8'));
    await writeFile(path.join(dir, f), JSON.stringify({...identity, counter: 0, issues: []}, null, 2));
  }
  return {VG_IDENTITIES: dir};
}

test('captions follow sentences and break long ones at clauses', () => {
  const chunks = captionChunks('There are five rules. Most people break the third. If someone knocks after midnight, count the knocks, and whatever you hear, do not open the door.', {maxWords: 8});
  assert.deepEqual(chunks.slice(0, 2), ['There are five rules.', 'Most people break the third.']);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every(c => tokens(c).length <= 10), JSON.stringify(chunks));
  assert.equal(chunks.join(' '), 'There are five rules. Most people break the third. If someone knocks after midnight, count the knocks, and whatever you hear, do not open the door.');
  assert.deepEqual(captionChunks('If your door ever knocks back… DON\'T ANSWER IT. Rule one.'), ['If your door ever knocks back…', 'DON\'T ANSWER IT.', 'Rule one.']);
});

test('caption times come from measured words; unmatched chunks sit between neighbours', () => {
  const script = 'Rule one. Count the knocks. Three means stay in bed.';
  const toks = tokens(script);
  const words = toks.map((text, i) => ({id: `w${i}`, text, start: 0.5 + i * 0.4, end: 0.8 + i * 0.4, scriptIndex: i === 3 ? null : i, scriptText: text}));
  const caps = seriesCaptions(script, {words}, 6);
  assert.equal(caps.length, 3);
  assert.equal(caps[0].start, 0.5);
  assert.equal(caps[1].start, 1.3); // "Count" (index 2)
  assert.ok(caps[1].hold <= caps[2].start && caps[2].hold <= 6);
  assert.equal(caps[2].text, 'Three means stay in bed.');
});

test('identity registry: create, continue, Shorts share their parent number, idempotent per project', async () => {
  const env = await registry();
  const made = await createIdentity({id: 'test-desk', name: 'Test Desk', label: 'TEST DESK', unit: 'MEMO', persona: 'p', twist: 't', signOff: 's', key: 'D', scale: 'minor'}, env);
  assert.equal(overlayText(made, 1), 'TEST DESK · MEMO 001');
  await assert.rejects(createIdentity({id: 'test-desk', name: 'x', label: 'x', unit: 'x', persona: 'p', twist: 't', signOff: 's'}, env), /already exists/);
  const a = await continueIdentity('night-office', {project: 'story-a'}, env);
  const b = await continueIdentity('night-office', {project: 'story-b'}, env);
  const short = await continueIdentity('night-office', {project: 'story-a-short-1', parent: 'story-a'}, env);
  const again = await continueIdentity('night-office', {project: 'story-a'}, env);
  assert.equal(a.overlay, 'NIGHT OFFICE · NOTICE 001');
  assert.equal(b.issue.number, 2);
  assert.equal(short.issue.number, 1); assert.equal(short.issue.parent, 'story-a');
  assert.equal(again.created, false); assert.equal(again.issue.number, 1);
  assert.equal((await getIdentity('night-office', env)).counter, 2);
  assert.equal((await identityForProject('story-b', env)).overlay, 'NIGHT OFFICE · NOTICE 002');
  await assert.rejects(continueIdentity('night-office', {project: 'x-short', parent: 'missing'}, env), /no Night Office file number/);
  await assert.rejects(getIdentity('nobody', env), /No identity/);
  assert.equal((await listIdentities(env)).length, 5);
});

test('series-kit writes identity, rules and captions and installs the kit; synth writes provenance', async () => {
  const env = await registry();
  const job = path.join(await tmp('vg-series-'), 'series-job');
  for (const d of ['inputs', 'assets']) await mkdir(path.join(job, d), {recursive: true});
  const script = 'If someone knocks three times after midnight… do not open the door. There are five rules. Rule one. Count the knocks.';
  const toks = tokens(script);
  await writeFile(path.join(job, 'inputs/source-script.md'), script + '\n');
  await writeFile(path.join(job, 'job.json'), JSON.stringify({duration: 12, width: 1080, height: 1920, fps: 30}));
  await writeFile(path.join(job, 'alignment.json'), JSON.stringify({matchRatio: 1, words: toks.map((text, i) => ({id: `w${i}`, text, start: 0.5 + i * 0.5, end: 0.9 + i * 0.5, scriptIndex: i, scriptText: text}))}));
  await writeFile(path.join(job, 'series.json'), JSON.stringify({identity: 'night-office', rules: [{n: 1, title: 'Count the knocks', at: {phrase: 'Rule one'}}, {n: 2, title: 'Not reached', at: null}]}));
  const slug = path.basename(job);
  await assert.rejects(prepareSeries(job, {env}), /Archon identity node/);
  await continueIdentity('night-office', {project: slug}, env);
  const r = await prepareSeries(job, {env});
  assert.equal(r.kitInstalled, true);
  assert.equal(r.data.identity.overlay, 'NIGHT OFFICE · NOTICE 001');
  assert.equal(r.data.rules[0].start, 0.5 + toks.indexOf('Rule') * 0.5);
  assert.equal(r.data.rules[1].start, null, 'a rule the film does not reach keeps its box without a start');
  const sandbox = {window: {}};
  vm.runInNewContext(await readFile(path.join(job, 'assets/series/series-data.js'), 'utf8'), sandbox);
  assert.equal(sandbox.window.RulesSeriesData.captions[0].text, 'If someone knocks three times after midnight…');
  await readFile(path.join(job, 'assets/library/rules-series-kit/1.0.0/kit.js'));
  assert.match(await readFile(path.join(job, 'review/series-captions.md'), 'utf8'), /Count the knocks/);
  assert.equal((await prepareSeries(job, {env})).kitInstalled, false, 'a second run keeps the frozen copy');

  const kit = await renderSoundKit(job, 'night-office', {duration: 4, env});
  assert.ok(kit.files.includes('music/night-office-bed.wav') && kit.files.includes('sfx/night-office-ident.wav'));
  const sources = JSON.parse(await readFile(path.join(job, 'assets/SOURCES.json'), 'utf8'));
  const bed = sources.find(s => s.name === 'music/night-office-bed.wav');
  assert.match(bed.source, /explainroo/); assert.match(bed.license, /MIT/); assert.match(bed.src, /^synth:bed\?identity=night-office/);
  assert.ok(Math.abs(decodeWav(await readFile(path.join(job, 'assets/music/night-office-bed.wav'))).duration - 4) < 0.01);
  const one = await renderSingle(job, {effect: 'knock', name: 'sfx/knock-5.wav', count: 5, seed: 3});
  assert.ok(one.duration > 2);
  await assert.rejects(renderSingle(job, {effect: 'knock', name: 'knock.wav'}), /--name must look like/);
});

test('the kit bundle is a valid library artifact and its script defines the API', async () => {
  const bundle = await inspectBundle('library/rules-series-kit/1.0.0');
  assert.equal(bundle.manifest.entry, 'kit.js');
  const window = {};
  vm.runInNewContext(await readFile('library/rules-series-kit/1.0.0/kit.js', 'utf8'), {window, document: {}});
  for (const fn of ['mount', 'ruleCard', 'exhibit', 'redX', 'check', 'you', 'boxes', 'sequence', 'cue', 'captionsIn']) assert.equal(typeof window.RulesSeries[fn], 'function', fn);
  assert.equal(window.RulesSeries.timecode(83.5, 30), '01:23:15');
});
