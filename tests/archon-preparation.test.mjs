// Synthetic recognition fixture: tests routing and real preparation, not speech quality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { syntheticAsrEnv } from './speech-fixture.mjs';
const exec = promisify(execFile),
  root = path.resolve(import.meta.dirname, '..');
test('direct Archon preparation preserves recording, reuses timing, blocks changed source and rejects the removed stage entrypoint', async (t) => {
  const base = await mkdtemp(path.join(root, '.cache/archon-prepare-'));
  const slug = 'archon-test-' + randomUUID().slice(0, 8),
    dir = path.join(root, 'jobs/scripts', slug),
    job = path.join(root, 'jobs', slug);
  t.after(async () => {
    for (const p of [base, dir, job]) await rm(p, { recursive: true, force: true });
  });
  const script = path.join(base, 'SCRIPT.md'),
    audio = path.join(base, 'recording.wav');
  await writeFile(script, '# Fixture\n\nThe setting is visible.');
  await exec('ffmpeg', [
    '-nostdin',
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=4',
    '-c:a',
    'pcm_s16le',
    audio,
  ]);
  const original = await readFile(audio);
  const env = await syntheticAsrEnv(base, 'The setting is visible.');
  const operation = async (stage, opts) =>
    JSON.parse(
      (
        await exec(
          process.execPath,
          ['scripts/archon/rules-story.mjs', stage, slug, ...(opts ? [JSON.stringify(opts)] : [])],
          { cwd: root, env },
        )
      ).stdout,
    );
  await operation('init', { script, audio, review: '', format: 'landscape' });
  const state = await operation('script-status');
  await writeFile(path.join(dir, 'review.md'), 'Disposition: pass\nSynthetic fixture review only.');
  // Execute the same scalar/object environment binding convention as an Archon script node.
  await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    const {emit}=await import('./scripts/archon/rules-story.mjs');
    await emit('script-reviewed',{expected:process.env.INPUTS_BINDING,report:JSON.parse(process.env.INPUTS_REPORT)});
  `,
    ],
    {
      cwd: root,
      env: {
        ...env,
        INPUTS_PROJECT: slug,
        INPUTS_BINDING: state.artifacts.binding,
        INPUTS_REPORT: JSON.stringify({
          pass: true,
          findings: 'Synthetic fixture, not independent creative evidence',
        }),
      },
    },
  );
  await operation('narration'); // Supplied recording: no TTS invocation.
  await operation('prepare');
  await operation('asr-timing');
  const before = (await stat(path.join(job, 'alignment.json'))).mtimeMs;
  await operation('asr-timing');
  assert.equal(
    (await stat(path.join(job, 'alignment.json'))).mtimeMs,
    before,
    'timing was unnecessarily regenerated',
  );
  assert.deepEqual(await readFile(audio), original, 'supplied recording changed');
  const manifest = JSON.parse(await readFile(path.join(job, 'job.json')));
  assert.equal(manifest.orchestrator, 'archon');
  assert.equal(manifest.width, 1920);
  assert.equal(manifest.height, 1080);
  await assert.rejects(exec(process.execPath, ['scripts/video.mjs', 'next'], { cwd: root }), (e) =>
    /MODULE_NOT_FOUND/.test(e.stderr),
  );
  await writeFile(audio, Buffer.concat([original, Buffer.from('changed fixture')]));
  await assert.rejects(operation('prepare'), (e) => /Source audio changed/.test(e.stdout));
});
