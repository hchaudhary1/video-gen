import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../src/browser.js';
import { loadProject } from '../src/project.js';
import { speechChunks } from '../src/script.js';
import { sceneHash, voicePaths } from '../src/voice.js';
import { writeWav } from '../src/wav.js';
import { probe } from '../src/ffmpeg.js';

let chrome;
try { chrome = findChrome(); } catch {}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-sizes-browser-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'video.json'), JSON.stringify({ size: '320x180', theme: 'clean', fps: 24, music: false, sfx: false, end: 0, lead: 0, hold: 0 }));
  fs.writeFileSync(path.join(dir, 'script.md'), '# Sizes\n\n## intro {min=0.5 chapter="Intro"}\nHello.');
  fs.writeFileSync(path.join(dir, 'scenes.js'), `export default { intro(s) {
    s.text(s.portrait ? 'Tall' : 'Wide', { x: s.cx, y: s.safe.y + s.safe.h / 2, size: s.W * 0.05, at: 0 });
  } };`);
  // A short cached tone avoids loading speech models for output tests.
  const project = loadProject(dir);
  const scene = project.script.scenes[0];
  const chunks = speechChunks(scene.units, project.config);
  fs.mkdirSync(project.paths.voice, { recursive: true });
  const files = voicePaths(project, scene.id);
  writeWav(files.wav, Float32Array.from({ length: 6000 }, (_, i) => 0.1 * Math.sin(i * Math.PI / 24)), 24000);
  fs.writeFileSync(files.json, JSON.stringify({ hash: sceneHash(scene, chunks, project.config), id: scene.id,
    duration: 0.25, words: [{ text: 'Hello.', spoken: 'Hello.', start: 0, end: 0.25, matched: true }],
    marks: {}, chunks: [{ start: 0, end: 0.25, text: 'Hello.' }], transcript: 'Hello.', matchRate: 1, unmatched: [] }));
  return dir;
}

test('direct rendering, stills and sheets respect saved canvas and reuse cached voice', {skip:!chrome,timeout:180000}, async t=>{
 const dir=fixture(t);
 const {render}=await import('../src/render.js');
 const {check,stills,sheet}=await import('../src/qa.js');
 const voiceFile=voicePaths(loadProject(dir),'intro').json,mtime=fs.statSync(voiceFile).mtimeMs;
 for(const size of ['320x180','180x320']) {
  const p=loadProject(dir,{size});
  const result=await render(p,{out:path.join(dir,`render-${size}.mp4`),workers:1});
  const info=await probe(result.out),video=info.streams.find(s=>s.codec_type==='video');
  assert.equal(video.width,p.config.width);assert.equal(video.height,p.config.height);
  assert.ok(fs.statSync(result.subtitles.srt).size>0);
  const frames=await stills(p,[],{scale:.5});assert.ok(frames.length);
  assert.ok(fs.statSync((await sheet(p)).file).size>0);
  assert.ok(Array.isArray((await check(p)).issues));
 }
 assert.equal(fs.statSync(voiceFile).mtimeMs,mtime);
});
