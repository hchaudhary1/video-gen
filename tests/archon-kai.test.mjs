// Synthetic media/recognition fixtures exercise adapter contracts, never creative approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  run,
  validateEngineChecks,
  validateEngineVerification,
  qualifyKai,
} from '../scripts/archon/kai-explainer.mjs';
import { stageOperation, scriptBinding, saveJSON } from '../scripts/archon/stages.mjs';
import { loadReviewPack, submitReview, fileHash } from '../lib/review.mjs';
import { loadProject } from '../engines/explainroo/src/project.js';
import { voicePaths } from '../engines/explainroo/src/voice.js';
const root = path.resolve(import.meta.dirname, '..');
test('Kai verification fails missing streams, changed canvas, weak speech and encoded warnings', () => {
  const manifest = { width: 1920, height: 1080, fps: 30, duration: 2 };
  const report = {
    video: { width: 1920, height: 1080, fps: '30/1' },
    audio: { codec: 'aac' },
    duration: 2,
    speech: { matchRate: 0.99, scenes: [{ matchRate: 0.99 }] },
    issues: [],
  };
  assert.equal(validateEngineVerification(report, manifest), true);
  for (const bad of [
    { ...report, audio: null },
    { ...report, video: { ...report.video, width: 720 } },
    { ...report, speech: { matchRate: 0.5 } },
    { ...report, issues: [{ level: 'warn', message: 'black frame' }] },
  ])
    assert.throws(() => validateEngineVerification(bad, manifest));
  assert.equal(validateEngineChecks({ issues: [{ level: 'hint' }] }), true);
  assert.equal(validateEngineChecks({ issues: [{ level: 'warn' }] }), false);
});
test('Kai direct nodes retain recording, reuse narration/render and reject stale evidence or take edits', async (t) => {
  const base = await mkdtemp(path.join(root, '.cache/kai-test-')),
    slug = 'kai-test-' + randomUUID().slice(0, 8);
  const dir = path.join(root, 'jobs/scripts', slug),
    job = path.join(root, 'jobs', slug);
  t.after(async () => {
    for (const f of [base, dir, job]) await rm(f, { recursive: true, force: true });
  });
  const script = path.join(base, 'SCRIPT.md'),
    audio = path.join(base, 'recording.wav');
  await writeFile(script, '# Synthetic fixture\n\n## intro\nHello world.');
  await writeFile(audio, 'SYNTHETIC recording fixture, not audio');
  const options = { script, audio, review: 'none', optOut: true };
  await run('init', slug, options);
  await writeFile(path.join(dir, 'VISUALS.md'), 'Synthetic visual intent fixture.');
  await writeFile(
    path.join(dir, 'review.md'),
    `Binding: ${await scriptBinding(dir)}\nDisposition: pass\nSynthetic fixture judgment, not an actual creative review.`,
  );
  const ctx = { root, dir, job, project: JSON.parse(await readFile(path.join(dir, 'project.json'))) };
  await stageOperation('script-reviewed', ctx, {
    expected: await scriptBinding(dir),
  });
  let preparations = 0,
    renders = 0,
    previews = 0,
    verifications = 0;
  const media = {
    loadProject,
    voicePaths,
    prepare: async (p) => {
      preparations++;
      await mkdir(p.paths.voice, { recursive: true });
      await writeFile(voicePaths(p, 'intro').wav, 'SYNTHETIC scene take');
      await saveJSON(voicePaths(p, 'intro').json, { duration: 2, matchRate: 1 });
      const timeline = { duration: 2, scenes: [{ id: 'intro', start: 0, dur: 2 }] };
      await saveJSON(path.join(job, 'build/timeline.json'), timeline);
      return { timeline, voices: { intro: { duration: 2, matchRate: 1 } } };
    },
    check: async () => ({ issues: [], duration: 2, scenes: 1 }),
    stills: async () => {
      const file = path.join(job, 'out/frame.png');
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'SYNTHETIC frame bytes');
      return [{ file, time: 1 }];
    },
    sheet: async () => {
      const file = path.join(job, 'out/sheet.jpg');
      await writeFile(file, 'SYNTHETIC sheet bytes');
      return { file, frames: 2 };
    },
    render: async (p, opts) => {
      if (opts.draft) previews++;
      else renders++;
      await writeFile(opts.out, 'SYNTHETIC MP4 bytes');
    },
    verify: async () => {
      verifications++;
      return {
        video: { width: 1920, height: 1080, fps: '30/1' },
        audio: { codec: 'aac' },
        duration: 2,
        speech: { matchRate: 1, scenes: [{ id: 'intro', matchRate: 1 }] },
        issues: [],
      };
    },
  };
  const op = (stage, opts = {}) => run(stage, slug, opts, { media });
  await op('narration');
  await op('narration');
  assert.equal(preparations, 1);
  assert.equal(await readFile(audio, 'utf8'), 'SYNTHETIC recording fixture, not audio');
  const evidence = (await op('audio-evidence')).artifacts;
  await op('audio-review');
  await op('audio-reviewed');
  await op('producer', { runId: 'synthetic-fixture', role: 'director' });
  assert.deepEqual((await op('production-loop-result')).artifacts, { done: false });
  const check = media.check;
  media.check = async () => { throw new Error('scenes.js has no function for scene "shelf"'); };
  assert.equal((await op('build')).status, 'repair');
  assert.equal(JSON.parse(await readFile(path.join(job, 'review/build.json'))).ok, false);
  media.check = async () => { throw new Error('Chrome executable unavailable'); };
  await assert.rejects(op('build'), /Chrome executable unavailable/);
  media.check = check;
  assert.equal((await op('build')).status, 'complete');
  await op('preview');
  await op('preview');
  assert.equal(previews, 1);
  await op('freeze');
  await op('visual-evidence');
  const { serveWatch } = await import('../lib/watch.mjs');
  const { server, url } = await serveWatch(root, slug);
  try {
    assert.match(await fetch(url).then((r) => r.text()), /Kai review preview/);
    const response = await fetch(url + `file/jobs/${slug}/review/preview/video.mp4`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'SYNTHETIC MP4 bytes');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const { pack, packSha256 } = await loadReviewPack(job, 'final');
  for (const role of ['visual-review'])
    await submitReview(job, {
      version: 1,
      stage: 'final',
      role,
      sourceHash: pack.sourceHash,
      videoSha256: null,
      packSha256,
      reviewer: { agentId: 'synthetic-' + role, independent: true },
      inspection: {
        mode: 'frame-sequence',
        visual: 'viewed',
        evidence: [pack.evidence[0].path],
        limitations: ['Synthetic fixture inspection only, not actually viewed.'],
      },
      initialObservation: 'Synthetic fixture',
      coverage: [{ start: 0, end: 2 }],
      verdict: 'pass',
      findings: [],
    });
  await writeFile(path.join(job,'review/revision-notes.md'),'Synthetic fixture revision: no changes needed.');
  await op('revision-complete');
  const frozenHash = await fileHash(path.join(job, 'review/final/pack.json'));
  await op('visual-evidence');
  await op('visual-evidence');
  assert.equal(await fileHash(path.join(job, 'review/final/pack.json')), frozenHash,
    'resume must not replace a reviewed pack with a nested evidence archive');
  assert.equal((await op('visual-review-status')).artifacts.done, true);
  await op('render');
  await op('render');
  assert.equal(renders, 1);
  await op('verify');
  await op('verify');
  assert.equal(verifications, 1);
  await op('deliver');
  assert.equal((await qualifyKai(job)).engine, 'explainroo');
  assert.deepEqual((await op('publish')).artifacts, { optOut: true });
  await writeFile(path.join(job, 'out/frame.png'), 'Changed fixture evidence');
  await assert.doesNotReject(op('render'), 'regenerating source preview files must preserve the archived review evidence');
  await writeFile(path.join(job,pack.evidence.find(e=>e.kind==='frames').path),'Tampered frozen evidence');
  await assert.rejects(op('render'), /Review evidence changed/);
  const config = JSON.parse(await readFile(path.join(job, 'video.json')));
  config.transition = 'fade';
  await saveJSON(path.join(job, 'video.json'), config);
  await op('narration');
  assert.equal(preparations, 1, 'visual transition should not regenerate approved speech');
  await writeFile(voicePaths(loadProject(job), 'intro').wav, 'Changed take');
  await assert.rejects(op('narration'), /narration\/timing changed/);
});
test('Kai narration duration miss routes to one script fix, regenerates once and continues', async (t) => {
  const slug = 'kai-duration-' + randomUUID().slice(0, 8);
  const dir = path.join(root, 'jobs/scripts', slug), job = path.join(root, 'jobs', slug);
  t.after(async () => { for (const f of [dir, job]) await rm(f, { recursive: true, force: true }); });
  await run('init', slug, { brief: 'Synthetic duration fixture brief.', review: 'none', optOut: true, duration: 10 });
  await writeFile(path.join(dir, 'SCRIPT.md'), '# Synthetic fixture\n\n## intro\nOne two three four five six seven eight.');
  await writeFile(path.join(dir, 'VISUALS.md'), 'Synthetic visual intent fixture.');
  const ctx = { root, dir, job, project: JSON.parse(await readFile(path.join(dir, 'project.json'))) };
  await writeFile(path.join(dir, 'review.md'),
    `Binding: ${await scriptBinding(dir)}\nDisposition: pass\nSynthetic fixture judgment, not an actual creative review.`);
  await stageOperation('script-reviewed', ctx, { expected: await scriptBinding(dir) });
  let measured = 20, preparations = 0;
  const media = {
    loadProject, voicePaths,
    prepare: async (p) => {
      preparations++;
      await mkdir(p.paths.voice, { recursive: true });
      await writeFile(voicePaths(p, 'intro').wav, 'SYNTHETIC take ' + preparations);
      await saveJSON(voicePaths(p, 'intro').json, { id: 'intro', duration: measured, matchRate: 1 });
      const timeline = { duration: measured, scenes: [{ id: 'intro', start: 0, dur: measured }] };
      await saveJSON(path.join(job, 'build/timeline.json'), timeline);
      return { timeline };
    },
  };
  const first = await run('narration', slug, {}, { media });
  assert.equal(first.status, 'repair');
  assert.equal(first.artifacts.reason, 'duration');
  assert.equal(first.artifacts.targetWords, 4);
  // The fix node trims the script; the final attempt binds that revision without a review.
  await writeFile(path.join(dir, 'SCRIPT.md'), '# Synthetic fixture\n\n## intro\nOne two three four.');
  measured = 13;
  const final = await run('narration', slug, { final: true }, { media });
  assert.equal(final.status, 'complete');
  assert.equal(preparations, 2);
  const revision = JSON.parse(await readFile(path.join(dir, 'archon/script-revision.json')));
  assert.equal(revision.mode, 'duration-fix');
  assert.equal((await stageOperation('script-ready', ctx, {})).done, true);
  const receipt = JSON.parse(await readFile(path.join(job, 'review/kai-narration.json')));
  assert.equal(receipt.duration, 13);
  // 13 s is still outside 8–12 s after the fix round: production continues and discloses it.
  assert.match(receipt.durationMiss, /13\.0 s against the 10 s target/);
  const { listContinuations } = await import('../lib/acceptance.mjs');
  assert.deepEqual((await listContinuations(job)).map((e) => e.stage), ['narration-duration']);
  assert.equal(await readFile(path.join(job, 'script.md'), 'utf8'), await readFile(path.join(dir, 'SCRIPT.md'), 'utf8'));
  // The earlier take is retained, not deleted.
  const { readdir } = await import('node:fs/promises');
  assert.equal((await readdir(path.join(job, 'review/narration-attempts'))).length, 1);
});

test('Kai verification routes issues to one fix and accepts what remains; fatal problems still stop', async () => {
  const { verificationProblems } = await import('../scripts/archon/kai-explainer.mjs');
  const manifest = { width: 1920, height: 1080, fps: 30, duration: 2 };
  const report = {
    video: { width: 1920, height: 1080, fps: '30/1' }, audio: { codec: 'aac' }, duration: 2,
    speech: { matchRate: 0.99, scenes: [{ matchRate: 0.99 }] }, issues: [],
  };
  assert.deepEqual(verificationProblems(report, manifest), { fatal: [], issues: [] });
  assert.equal(verificationProblems({ ...report, issues: [{ level: 'warn', message: 'black frame' }] }, manifest).issues.length, 1);
  assert.equal(verificationProblems({ ...report, speech: { matchRate: 0.7, scenes: [{ matchRate: 0.7 }] } }, manifest).fatal.length, 0);
  for (const bad of [{ ...report, audio: null }, { ...report, video: { ...report.video, width: 720 } },
    { ...report, duration: 9 }, { ...report, speech: { matchRate: 0.2 } }])
    assert.ok(verificationProblems(bad, manifest).fatal.length, JSON.stringify(bad));
});
