import {syntheticSpeechEvidence, syntheticAsrEnv} from './speech-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {reconcile} from '../lib/timing.mjs';
import {buildFilm,filmAudit,planCheck} from '../lib/film.mjs';
import {useBundle} from '../lib/assets.mjs';
import {sourceFingerprint, fileHash, loadReviewPack, REVIEW_ROLES} from '../lib/review.mjs';
import {loadPersonality, freezePersonality} from '../lib/personalities.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testCache = path.join(ROOT, '.cache', 'cleanup-tests');

async function fixture(t) {
  await mkdir(testCache, {recursive: true});
  const job = await mkdtemp(path.join(testCache, 'video-pipeline-'));
  t.after(()=>rm(job,{recursive:true,force:true}));
  for (const dir of ['assets','compositions','review']) await mkdir(path.join(job,dir));
  // Synthetic test fixture only; production preparation obtains real ASR words.
  const audio = Buffer.from('test recording bytes');
  await writeFile(path.join(job,'assets/narration.wav'),audio);
  const manifest = {duration:2,width:1920,height:1080,name:'fixture',canvas:'#f0eadf',
    transcription:{language:'en'},audio:{sha256:createHash('sha256').update(audio).digest('hex')},
    review:{producerAgentIds:['/fixture/producer'],producerAgentRecords:[{agentId:'/fixture/producer',role:'builder'}]}};
  const a = reconcile([{id:'w0',text:'local',start:.1,end:.4},{id:'w1',text:'machine',start:.5,end:1}], 'local machine');
  const film = {version: 2, title: 'Fixture', concept: 'A device appears',
    theme: {name: 'Test', description: 'Bold white device outlines on a dark surface, with yellow highlights for the active parts. Heavy labels and direct, deliberate motion keep the subject readable.', bg: '#101010', colors: {white: '#ffffff', yellow: '#ffd23f'}},
    scenes: [{id: 'opening', start: {boundary: 'start'}, idea: 'Show the device', kind: 'html', file: 'compositions/opening.html'}]};
  for (const [name, data] of Object.entries({'job.json': manifest, 'alignment.json': a, 'film.json': film}))
    await writeFile(path.join(job, name), JSON.stringify(data));
  await freezePersonality(job, loadPersonality('rules-story'));
  await writeFile(path.join(job, 'compositions/opening.html'), '<template><div data-composition-id="opening"><div id="opening-device"></div></div></template>');
  return {job, film};
}
const buildFixture = job => buildFilm(job, {inspect: false, print: false});
test('film assembly preserves supplied audio, kit scripts and timed hosts', async t => {
  const {job} = await fixture(t), result = await buildFixture(job);
  assert.equal(result.ok, true, result.errors.join('\n'));
  const root = await readFile(path.join(job, 'index.html'), 'utf8');
  assert.match(root, /data-composition-src="compositions\/opening.html"/);
  assert.match(root, /id="narration" src="assets\/narration.wav"/);
  assert.match(root, /assets\/kit\/gsap.min.js/);
  await filmAudit(job);
});
test('film audit rejects edited sources until rebuilt', async t => {
  const {job, film} = await fixture(t);
  assert.equal((await buildFixture(job)).ok, true);
  film.scenes[0].idea = 'A revised device';
  await writeFile(path.join(job, 'film.json'), JSON.stringify(film));
  await assert.rejects(filmAudit(job),/Pipeline audit failed/);
  assert.match((await readFile(path.join(job,'review/audit.json'),'utf8')),/Sources changed/);
});
test('modified audio cannot silently reuse old word timings', async t => {
  const {job} = await fixture(t);
  await writeFile(path.join(job, 'assets/narration.wav'), 'different recording');
  await assert.rejects(planCheck(job),/Narration changed/);
});
test('film audit checks installed library files against frozen hashes', async t => {
  const {job} = await fixture(t);
  const result = await useBundle(path.join(ROOT, 'library'), 'motion-primitives@1.0.0', job);
  assert.equal((await buildFixture(job)).ok, true);
  await filmAudit(job);
  await writeFile(path.join(job, result.path, 'motion.js'), 'changed helper');
  await assert.rejects(filmAudit(job),/Pipeline audit failed/);
  assert.match((await readFile(path.join(job,'review/audit.json'),'utf8')),/frozen file changed/);
});
