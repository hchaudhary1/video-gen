import {syntheticSpeechEvidence} from './speech-fixture.mjs';
import {nativeFixture} from './helpers/native-fixture.mjs';
// Reviews of the built HTML (no render before the final review), the person's own review, and one render at the end.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {buildFilm} from '../lib/film.mjs';
import {sourceFingerprint, fileHash, loadReviewPack, submitReview, qualifyDelivery, reviewStatus, REVIEW_ROLES} from '../lib/review.mjs';
import {recordHumanReview, humanDecision} from '../lib/review.mjs';
import {loadPersonality, freezePersonality} from '../lib/personalities.mjs';

const put = (job, file, value) => writeFile(path.join(job, file), JSON.stringify(value));
const read = async (job, file) => JSON.parse(await readFile(path.join(job, file), 'utf8'));

async function fixture(t, {human} = {}) {
  const job = await mkdtemp(path.join(os.tmpdir(), 'html-review-'));
  t.after(() => rm(job, {recursive: true, force: true}));
  for (const dir of ['shots', 'inputs', 'review', 'assets']) await mkdir(path.join(job, dir));
  const words = ['opening', 'comparison', 'ending'].map((text, i) => ({id: `w${i}`, text, start: i * 6, end: i * 6 + 1}));
  const manifest = {duration: 18, width: 1920, height: 1080, status: 'prepared', review: {producerAgentIds: ['/fixture/producer'], producerAgentRecords: [{agentId: '/fixture/producer', role: 'builder'}]}, ...(human ? {humanReview: human} : {})};
  const film = {version: 2, title: 'Fixture', concept: 'A comparison', theme: {name: 'Test look', description: 'Chunky white outlines on a near-black stage,flat saturated fills,hard offset shadows and heavy display type for prices.', bg: '#101010', colors: {white: '#f0f0f0', grey: '#888888', dim: '#444444', faint: '#222222', blue: '#1488dd', yellow: '#ffd23f', red: '#e0342f', green: '#3fbf6f'}, meanings: {yellow: 'money'}},
    alternatives: [{concept: 'A', rejected: 'B'}, {concept: 'C', rejected: 'D'}], subjects: [{id: 'subject', what: 'Recurring subject'}],
    scenes: words.map((w, i) => ({id: w.text, start: i ? {phrase: w.text} : {boundary: 'start'}, idea: 'Idea', mechanism: 'Operation', states: ['initial', 'operation', 'consequence'], payoff: 'Result', camera: 'Static', handoff: 'Same subject', why_not_basic: 'Meaning', alternatives: ['Other'], carry: i ? ['subject'] : []}))};
  await put(job, 'job.json', manifest); await put(job, 'alignment.json', {matchRatio: 1, words}); await put(job, 'film.json', film);
  await freezePersonality(job, loadPersonality('rules-story'));
  await writeFile(path.join(job, 'assets/narration.wav'), 'Synthetic narration fixture');
  for (const id of ['opening', 'comparison', 'ending'])
    await put(job, `shots/${id}.json`, {scene: id, objects: id === 'opening' ? [{id: 'subject', type: 'circle', at: [960, 540], r: 100}] : [], actions: []});
  await writeFile(path.join(job,'inputs/narration.txt'),'Synthetic script');
  await nativeFixture(job,film);
  return job;
}

// A synthetic html pack (what review-pack writes from the built film), then the two visual reviews.
async function htmlPack(job, {start = 0, end = 18, verdict = 'pass'} = {}) {
  const stage = 'final';
  await mkdir(path.join(job, `review/${stage}`), {recursive: true});
  const sourceHash = await sourceFingerprint(job), evidence = [];
  for (const [name, kind] of [['frame.png', 'frames'], ['sheet.png', 'contact-sheet']]) {
    const file = `review/${stage}/${name}`; await writeFile(path.join(job, file), 'Synthetic evidence fixture');
    evidence.push({path: file, kind, start, end: kind === 'frames' ? start : end, sha256: await fileHash(path.join(job, file))});
  }
  evidence.push({path: 'assets/narration.wav', kind: 'audio', start: 0, end: 18, sha256: await fileHash(path.join(job, 'assets/narration.wav'))});
  await put(job, `review/${stage}/pack.json`, {version: 1, stage, source: 'html', sourceHash, videoSha256: null, duration: 18, interval: {start, end},
    scenes: [{id: 'opening', start: 0, end: 6}, {id: 'comparison', start: 6, end: 12}, {id: 'ending', start: 12, end: 18}].filter(s => s.end > start && s.start < end)
      .map(s => ({...s, start: Math.max(s.start, start), end: Math.min(s.end, end)})), evidence});
  const context = await loadReviewPack(job, stage);
  for (const role of REVIEW_ROLES) await submitReview(job, {version: 1, stage, role, sourceHash, videoSha256: null, packSha256: context.packSha256,
    reviewer: {agentId: `/fixture/${stage}-${role}`, independent: true},
    inspection: {mode: 'frame-sequence', visual: 'viewed', evidence: [evidence[0].path], limitations: ['Synthetic test judgment.'], },
    initialObservation: 'Synthetic fixture', coverage: [{start, end}], verdict, findings: []});
  return context;
}

async function render(job, {integrity = true} = {}) {
  await mkdir(path.join(job, 'renders'), {recursive: true});
  await writeFile(path.join(job, 'renders/video.mp4'), 'Synthetic render fixture, not video');
  const videoSha256 = await fileHash(path.join(job, 'renders/video.mp4'));
  await put(job, 'review/render-source.json', {version: 1, sourceHash: await sourceFingerprint(job), videoSha256});
  await put(job, 'review/render-verification.json', {ok: true, sha256: videoSha256, narrationIntegrity: {ok: integrity}});
  await syntheticSpeechEvidence(job);
  await put(job, 'review/pixels.json', {ok: true, errors: []});
  await writeFile(path.join(job, 'review/REPORT.md'), 'Production report fixture.');
}

test('built timeline reviews bind sources and human decisions to the full current evidence pack',async t=>{
 const job=await fixture(t,{human:['final']});await buildFilm(job,{inspect:false,print:false});
 const context=await htmlPack(job);
 assert.equal((await reviewStatus(job,'final')).ok,true);
 await recordHumanReview(job,{stage:'final',decision:'approve'});
 assert.equal((await humanDecision(job,'final',context.packSha256)).decision,'approve');
 await writeFile(path.join(job,'compositions/opening.html'),'Changed scene');
 await assert.rejects(loadReviewPack(job,'final'),/stale/);
 assert.equal((await reviewStatus(job,'final')).ok,false);
});
