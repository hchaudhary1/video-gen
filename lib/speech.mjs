// Automated recognition evidence, never listening or a naturalness judgment.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {cacheDir} from './media.mjs';
import {reconcile, normalizeWords, extractNarration} from './timing.mjs';
import {alignWords, expand} from '../engines/explainroo/src/align.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ASR_MODEL = 'nvidia/parakeet-tdt-0.6b-v2';
export const speechHash = value => createHash('sha256').update(value).digest('hex');
// Streamed: encoded deliveries routinely exceed Node's 2 GiB whole-file read limit.
export const hashFile = async file => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
export async function recognizeSpeech(audio, output, {language = 'en', env = process.env} = {}) {
  if (language !== 'en') throw new Error('Parakeet v2 supports English only; no ASR fallback is permitted.');
  const cache = cacheDir(env);
  await mkdir(path.join(cache, 'tmp'), {recursive:true});
  await mkdir(path.dirname(output), {recursive:true});
  await new Promise((resolve, reject) => {
    const child = spawn('uv', ['run', '--locked', '--script', path.join(ROOT, 'scripts/parakeet.py'), audio, output], {
      cwd: ROOT, env: {...env, UV_CACHE_DIR:path.join(cache,'uv'), HF_HOME:path.join(cache,'huggingface'), NEMO_CACHE_DIR:path.join(cache,'nemo'), TORCH_HOME:path.join(cache,'torch'), XDG_CACHE_HOME:cache, TMPDIR:path.join(cache,'tmp')}, stdio:['ignore','ignore','pipe']});
    let error = ''; child.stderr.on('data', d => {error = (error + d).slice(-4000);});
    child.on('error',reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`Parakeet v2 failed (${code}): ${error}`)));
  });
  return JSON.parse(await readFile(output,'utf8'));
}
export function speechReport(raw, script, duration, {fullScript = true, stage = 'narration'} = {}) {
  if (raw.model !== ASR_MODEL) throw new Error('Speech evidence must use Parakeet v2.');
  const heard = normalizeWords(raw, duration);
  const excerpt = fullScript ? script : reconcile(heard, script).excerpt.text;
  const expected = (excerpt.match(/\S+/g) || []).map(spoken => ({spoken}));
  if (!expected.length || expected.length * heard.length > 5_000_000) throw new Error('Speech comparison empty or exceeds alignment budget.');
  // Penalize inserted speech as well as omissions. Explainroo's aligner measures
  // expected-token coverage alone, so a fully repeated take could otherwise pass.
  const expandedExpected = expected.flatMap(w => expand(w.spoken));
  const expandedHeard = heard.flatMap(w => expand(w.text).map(text => ({...w,text})));
  const comparison = reconcile(expandedHeard, expandedExpected.join(' '), {fullScript:true});
  const unexpected = comparison.discrepancies.filter(d => d.kind === 'extra-spoken').map(d => {
    const w = heard.find(w => w.id === d.wordId); return {...d,start:w?.start,end:w?.end};
  });
  const insertionPenalty = expandedExpected.length / Math.max(expandedExpected.length, expandedHeard.length);
  const aligned = alignWords(expected, heard, duration);
  const matchRate = Math.min(aligned.matchRate, insertionPenalty);
  const words = aligned.words.map((w,i) => ({...w, expected:expected[i].spoken, timestampEstimated:!w.matched}));
  const chunks = Array.from({length:Math.ceil(duration / 30)}, (_,i) => {
    const start = i * 30, end = Math.min(duration,start + 30);
    const local = words.filter(w => w.start >= start && (w.start < end || i === Math.ceil(duration/30)-1 && w.start === end));
    const transcript = heard.filter(w => w.start >= start && w.start < end);
    return {start,end,expected:local.map(w=>w.expected).join(' '),transcript:transcript.map(w=>w.text).join(' '),words:transcript,
      matchRate:local.length ? Math.min(local.filter(w=>w.matched).length/local.length, local.flatMap(w=>expand(w.expected)).length / Math.max(1,transcript.flatMap(w=>expand(w.text)).length)) : (transcript.length ? 0 : 1), unexpected:unexpected.filter(w=>w.start>=start&&w.start<end), unconfirmed:local.filter(w=>!w.matched)};
  });
  const unconfirmed = words.filter(w=>!w.matched);
  const threshold = stage === 'final-mix' ? .85 : .9;
  const warnings = unconfirmed.filter(w=>w.expected.length > 3).map(w=>`Unconfirmed word '${w.expected}' near ${w.start.toFixed(2)}s (estimated interval).`);
  warnings.push(...chunks.filter(c=>c.matchRate < .9).map(c=>`Low chunk match rate ${(c.matchRate*100).toFixed(1)}% at ${c.start}-${c.end}s.`));
  warnings.push(...unexpected.map(w=>`Unexpected spoken token '${w.observed}' near ${w.start}s.`));
  const ok = matchRate >= threshold && chunks.every(c=>c.matchRate >= .8);
  return {version:1,model:ASR_MODEL,stage,fullScript,duration,ok,matchRate,expectedCoverage:aligned.matchRate,unexpected,threshold,chunkThreshold:.8,words,unconfirmed,chunks,warnings,
    transcript:heard,device:raw.device,limitations:['ASR comparison is not listening, proof of naturalness, pronunciation or intelligibility. Chunk cuts may split words. Unconfirmed timestamps are interpolated estimates; fuzzy spoken/display normalization may accept similar words. English only.']};
}
export async function verifySpeech({audio,script,duration,output,fullScript=true,stage='narration',language='en',env=process.env}, recognize=recognizeSpeech) {
  const bindings = {audioSha256:await hashFile(audio),scriptSha256:speechHash(script)};
  let report;
  try {report = speechReport(await recognize(audio, output+'.transcript.json',{language,env}),script,duration,{fullScript,stage});}
  catch(error) {report={version:1,model:ASR_MODEL,stage,ok:false,error:error.message,limitations:['Speech verification unavailable; no listening performed.']};}
  report = {...report,...bindings};
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  return report;
}
export async function assertSpeechEvidence(job) {
  const script = await readFile(path.join(job,'inputs/narration.txt'),'utf8');
  const manifest = JSON.parse(await readFile(path.join(job,'job.json'),'utf8'));
  if (manifest.script?.path && extractNarration(await readFile(path.join(job,manifest.script.path),'utf8')) !== script)
    throw new Error('Approved source script changed since preparation; create a new job with the approved script.');
  for (const [name,audio] of [['narration','assets/narration.wav'],['final-mix','renders/video.mp4']]) {
    const report = JSON.parse(await readFile(path.join(job,`review/speech-${name}.json`),'utf8'));
    if (report.version !== 1 || report.model !== ASR_MODEL || report.stage !== name || report.ok !== true || report.fullScript !== Boolean(manifest.script?.fullScript) || report.duration !== manifest.duration || report.scriptSha256 !== speechHash(script) || report.audioSha256 !== await hashFile(path.join(job,audio)))
      throw new Error(`Missing, failed or stale automated speech evidence: ${name}. Run transcribe and verify.`);
  }
}
