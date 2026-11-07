import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {ASR_MODEL,speechReport,verifySpeech,assertSpeechEvidence} from '../lib/speech.mjs';
import {syntheticSpeechEvidence} from './speech-fixture.mjs';
const raw = (text,offset=0) => ({model:ASR_MODEL,words:text.split(' ').map((text,i)=>({text,start:offset+i*.2,end:offset+i*.2+.1}))});
test('full script rejects missing endings while supplied excerpts remain supported',()=>{
  const script = 'Start now the approved recording has ended completely';
  assert.equal(speechReport(raw('the approved recording'),script,3).ok,false);
  assert.equal(speechReport(raw('the approved recording'),script,3,{fullScript:false}).ok,true);
});
test('localized failures cannot hide in a long good prefix; unconfirmed words retain estimated times',()=>{
  const good=Array(100).fill('hello').join(' ');
  const input=raw(good+' wrong'); input.words.at(-1).start=31;input.words.at(-1).end=31.2;
  const report=speechReport(input,good+' elephant',33,{stage:'final-mix'});
  assert(report.matchRate>.85);assert.equal(report.ok,false);
  assert(report.unconfirmed.some(w=>w.expected==='elephant'&&w.timestampEstimated));
  assert(report.warnings.length);assert.match(report.limitations.join(' '),/not listening/);
  assert.equal(report.chunks[1].transcript,'wrong');
});
test('number normalization reuses Explainroo and wrong backend fails',()=>{
  assert.equal(speechReport(raw('five percent'),'5%',1).ok,true);
  assert.throws(()=>speechReport({...raw('hello'),model:'whisper'},'hello',1),/Parakeet/);
});
test('unavailable recognition writes failed hash-bound evidence; missing and changed receipts block',async t=>{
  await mkdir('.cache',{recursive:true});const job=await mkdtemp(path.resolve('.cache/speech-test-'));t.after(()=>rm(job,{recursive:true,force:true}));
  for(const d of ['review','assets','renders']) await mkdir(path.join(job,d));
  const audio=path.join(job,'assets/narration.wav');await writeFile(audio,'fixture');await writeFile(path.join(job,'renders/video.mp4'),'fixture');
  const output=path.join(job,'review/speech-narration.json');
  const report=await verifySpeech({audio,script:'hello',duration:1,output},async()=>{throw new Error('missing runtime');});
  assert.equal(report.ok,false);assert.match(report.error,/missing runtime/);assert.equal(report.audioSha256.length,64);
  await assert.rejects(assertSpeechEvidence(job));
  await writeFile(path.join(job,'job.json'),'{}');
  await syntheticSpeechEvidence(job);await assertSpeechEvidence(job);
  await writeFile(audio,'changed');await assert.rejects(assertSpeechEvidence(job),/stale/);
  assert.equal(JSON.parse(await readFile(output)).model,ASR_MODEL);
});

test('inserted and repeated speech cannot pass on expected-word coverage alone', () => {
  const report = speechReport(raw('the approved words the approved words'), 'the approved words', 3);
  assert.equal(report.expectedCoverage, 1);
  assert.equal(report.ok, false);
  assert(report.unexpected.length > 0);
  assert(report.unexpected.every(w => Number.isFinite(w.start)));
});

test('changing approved source text invalidates otherwise current speech receipts', async t => {
  const job=await mkdtemp(path.resolve('.cache/speech-script-')); t.after(()=>rm(job,{recursive:true,force:true}));
  for(const dir of ['review','assets','renders','inputs']) await mkdir(path.join(job,dir));
  await writeFile(path.join(job,'job.json'),JSON.stringify({script:{path:'inputs/source-script.md'}}));
  await writeFile(path.join(job,'inputs/narration.txt'),'Approved text.');
  await writeFile(path.join(job,'inputs/source-script.md'),'Approved text.');
  await writeFile(path.join(job,'assets/narration.wav'),'synthetic');
  await writeFile(path.join(job,'renders/video.mp4'),'synthetic');
  await syntheticSpeechEvidence(job); await assertSpeechEvidence(job);
  await writeFile(path.join(job,'inputs/source-script.md'),'Revised approved text.');
  await assert.rejects(assertSpeechEvidence(job),/Approved source script changed/);
});

test('Speech evidence hashes files by streaming, matching a whole-buffer hash', async () => {
  const { hashFile, speechHash } = await import('../lib/speech.mjs');
  const { mkdtemp, writeFile: write, rm: remove } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const dir = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.hash-'));
  try {
    const bytes = Buffer.alloc(3 * 1024 * 1024 + 7, 7);
    await write(path.join(dir, 'a.bin'), bytes);
    assert.equal(await hashFile(path.join(dir, 'a.bin')), speechHash(bytes));
  } finally { await remove(dir, { recursive: true, force: true }); }
});
