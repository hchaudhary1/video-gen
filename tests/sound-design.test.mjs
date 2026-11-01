import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {SCALES, modeNote, parseScale, tonalCentre, renderEffect, renderBed, EFFECT_NAMES, toWav, identityKitPlan, signature} from '../lib/sound-design.mjs';
import {limitStereo, mixSettings, mixdown, decodeWav, TARGET_LUFS} from '../lib/audio.mjs';
import {compileFilm, SpecError} from '../lib/composition.mjs';
import {listIdentities} from '../lib/identities.mjs';

const VENDOR = new URL('../lib/vendor/explainroo-audio/', import.meta.url);
const peakDb = a => { let p = 0; for (const c of [a.L, a.R]) for (const v of c) p = Math.max(p, Math.abs(v)); return 20 * Math.log10(p); };

test('vendored explainroo audio files are byte-identical to the pinned upstream commit', async () => {
  const source = JSON.parse(await readFile(new URL('SOURCE.json', VENDOR), 'utf8'));
  assert.equal(source.commit, 'e95232c8d535ed2aa390e7b1caee0d1326dd9e83');
  assert.equal(source.license, 'MIT');
  const files = (await readdir(new URL('upstream/', VENDOR))).filter(f => f !== 'package.json').sort();
  assert.deepEqual(files, Object.keys(source.files).sort());
  for (const [file, hash] of Object.entries(source.files))
    assert.equal(createHash('sha256').update(await readFile(new URL(`upstream/${file}`, VENDOR))).digest('hex'), hash, file);
  assert.match(await readFile(new URL('upstream/LICENSE', VENDOR), 'utf8'), /Vincent Schmalbach/);
});

test('dark scales and tonal centres', () => {
  assert.deepEqual(SCALES.phrygian, [0, 1, 3, 5, 7, 8, 10]);
  assert.equal(modeNote(60, 1, 'phrygian'), 61);
  assert.equal(modeNote(60, 2, 'minor'), 63);
  assert.equal(modeNote(60, -1, 'minor'), 58);
  assert.equal(modeNote(60, 7, 'harmonic minor'), 72);
  assert.equal(modeNote(60, 6, 'harmonic-minor'), 71);
  assert.equal(parseScale('Harmonic Minor'), 'harmonic-minor');
  assert.throws(() => parseScale('lydian dominant'), /Unknown scale/);
  const c = tonalCentre('C#', 'phrygian');
  assert.equal(c.pc, 1); assert.ok(c.root >= 33 && c.root <= 44);
});

test('every effect renders deterministically from its seed, normalized and finite', () => {
  for (const name of EFFECT_NAMES) {
    const a = renderEffect(name, {seed: 7, key: 'D', scale: 'phrygian', motif: [0, 1, 4]});
    const b = renderEffect(name, {seed: 7, key: 'D', scale: 'phrygian', motif: [0, 1, 4]});
    assert.ok(a.duration > 0.2, name);
    assert.ok(a.L.every(Number.isFinite) && a.R.every(Number.isFinite), name);
    assert.ok(toWav(a).equals(toWav(b)), `${name} is not deterministic`);
    assert.ok(peakDb(a) <= -0.9 && peakDb(a) > -15, `${name} peak ${peakDb(a)}`);
  }
  const k1 = renderEffect('knock', {seed: 1}), k2 = renderEffect('knock', {seed: 2});
  assert.ok(!toWav(k1).equals(toWav(k2)), 'a different seed gives a different take');
  assert.ok(renderEffect('knock', {count: 5, interval: 0.4}).duration > renderEffect('knock', {count: 1}).duration);
  assert.throws(() => renderEffect('whistle'), /Unknown effect/);
  assert.throws(() => renderEffect('knock', {count: 2.5}), /whole number/);
});

test('a bed starts identically whatever its length, so a series always opens on the same sound', () => {
  for (const [style, texture] of [['dread', 'hum'], ['pulse', 'tick'], ['music-box', 'hiss']]) {
    const short = renderBed({style, texture, key: 'E', scale: 'phrygian', seed: 11, duration: 6});
    const long = renderBed({style, texture, key: 'E', scale: 'phrygian', seed: 11, duration: 9});
    for (let i = 0; i < 48000 * 5.5; i++) if (short.L[i] !== long.L[i] || short.R[i] !== long.R[i]) assert.fail(`${style} differs at sample ${i}`);
    assert.ok(peakDb(long) <= -2.9, `${style} bed peak ${peakDb(long)}`);
  }
  assert.throws(() => renderBed({style: 'polka', duration: 3}), /Unknown bed style/);
});

test('identity signatures validate and plan a complete kit', async () => {
  const ids = await listIdentities();
  assert.ok(['night-office', 'lost-and-found', 'household-safety-bureau', 'quiet-line'].every(id => ids.some(i => i.id === id)));
  assert.equal(new Set(ids.map(i => i.sound.seed)).size, ids.length, 'each identity has its own seed');
  const plan = identityKitPlan('night-office', ids.find(i => i.id === 'night-office').sound, {duration: 30});
  assert.equal(plan[0].name, 'music/night-office-bed.wav');
  for (const e of EFFECT_NAMES) assert.ok(plan.some(f => f.name === `sfx/night-office-${e}.wav`), e);
  assert.throws(() => signature({seed: 1, motif: [0]}), /motif/);
  assert.throws(() => signature({key: 'C'}), /seed/);
});

test('the master limiter caps peaks; films without a mix block keep the old single-gain master', () => {
  assert.deepEqual(mixSettings({}), {targetLufs: TARGET_LUFS, limiter: false, maxLimitDb: 6});
  assert.deepEqual(mixSettings({mix: {targetLufs: -15}}), {targetLufs: -15, limiter: true, maxLimitDb: 6});
  assert.equal(mixSettings({mix: {targetLufs: -15, limiter: false}}).limiter, false);
  const buf = new Float32Array(48000 * 2);
  for (let i = 0; i < 48000; i++) { const v = (i % 4800 === 100 ? 0.95 : 0.2) * Math.sin(i / 7); buf[2 * i] = v; buf[2 * i + 1] = v; }
  const r = limitStereo(buf, -6);
  assert.ok(r.maxReductionDb > 0 && r.limitedShare > 0);
  assert.ok(Math.max(...buf.map(Math.abs)) <= 10 ** (-6 / 20) + 1e-6);
});

test('film.json mix settings are validated', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vg-mix-'));
  const alignment = {matchRatio: 1, words: [{id: 'w0', text: 'one', start: 0.2, end: 0.5}]};
  const film = {version: 2, title: 't', concept: 'c', scenes: [{id: 'a', idea: 'i', kind: 'html', file: 'compositions/a.html'}], mix: {targetLufs: -8, limiter: 'yes', loud: 1}};
  await assert.rejects(compileFilm(dir, film, alignment, {duration: 2, width: 1920, height: 1080, fps: 30}, {allowMissing: true}),
    e => e instanceof SpecError && e.errors.some(x => /targetLufs/.test(x)) && e.errors.some(x => /limiter/.test(x)) && e.errors.some(x => /unknown field/.test(x)));
  film.mix = {targetLufs: -15};
  await compileFilm(dir, film, alignment, {duration: 2, width: 1920, height: 1080, fps: 30}, {allowMissing: true});
});

test('a series mix reaches its loudness target under the peak ceiling with the limiter', async t => {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) return t.skip('ffmpeg unavailable');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vg-limiter-'));
  for (const d of ['assets', 'renders', 'review']) await mkdir(path.join(dir, d), {recursive: true});
  // Speech-like test signal: quiet syllables with sharp transients (a high crest factor, like real narration).
  const sr = 48000, n = sr * 8, data = Buffer.alloc(n * 2), h = Buffer.alloc(44);
  for (let i = 0; i < n; i++) {
    const tt = i / sr, on = (tt % 0.5) < 0.32 ? 1 : 0, spike = (i % 12000) < 40 ? 0.9 : 0;
    data.writeInt16LE(Math.round((on * 0.07 * Math.sin(2 * Math.PI * 220 * tt) * (1 + Math.sin(2 * Math.PI * 3 * tt)) + spike * Math.sin(2 * Math.PI * 900 * tt)) * 32767), i * 2);
  }
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  await writeFile(path.join(dir, 'assets/narration.wav'), Buffer.concat([h, data]));
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x36:r=30:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 'renders/picture.mp4')]).status, 0);
  const plain = await mixdown(dir, {world: {sounds: []}, film: {}, manifest: {duration: 8}});
  assert.equal(plain.limiter, undefined);
  assert.equal(plain.limitedBy, 'peak ceiling');
  const loud = await mixdown(dir, {world: {sounds: []}, film: {mix: {targetLufs: -15}}, manifest: {duration: 8}});
  assert.ok(loud.limiter && loud.limiter.maxReductionDb > 0, JSON.stringify(loud.limiter));
  assert.ok(loud.peaksOk, JSON.stringify(loud.attempts));
  assert.ok(loud.integratedLufs > plain.integratedLufs + 2, `${loud.integratedLufs} vs ${plain.integratedLufs}`);
  assert.ok(Math.abs(loud.integratedLufs - -15) <= 1.2 || loud.limitedBy === 'limiter cap', JSON.stringify(loud.attempts));
  assert.match(loud.narration, /look-ahead peak limiter/);
  assert.ok(decodeWav(await readFile(path.join(dir, 'renders/mix.wav'))).duration > 7.9);
});
