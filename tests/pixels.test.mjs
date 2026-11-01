import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pixelChecks} from '../lib/pixels.mjs';

const exec = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let available = true;
try { await exec('ffmpeg', ['-version']); } catch { available = false; }

test('pixel checks report black gaps after a bright scene as advisory warnings', {skip: !available}, async t => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, {recursive: true});
  const dir = await mkdtemp(path.join(cache, 'pixel-check-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const video = path.join(dir, 'white-then-black.mp4');
  await exec('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=320x180:r=30:d=1',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=2', '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
  const timing = {scenes: [{id: 'scene', start: 0, end: 3}]};
  const advisory = await pixelChecks(video, timing);
  assert.ok(advisory.warnings.some(message => /empty frame/.test(message)));
  assert.equal(advisory.errors.length, 0);
  assert.ok(advisory.scenes.scene.blankShare > 0.5);
});

test('a sustained solid-color frame counts as content, not an empty frame', {skip: !available}, async t => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, {recursive: true});
  const dir = await mkdtemp(path.join(cache, 'pixel-flat-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const video = path.join(dir, 'flat-colour.mp4');
  await exec('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x4a90e2:s=320x180:r=30:d=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
  const result = await pixelChecks(video, {scenes: [{id: 'flat', start: 0, end: 3}]});
  assert.deepEqual(result.errors, []);
  assert.equal(result.scenes['flat'].blankShare, 0);
});
