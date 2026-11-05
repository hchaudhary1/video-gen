import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import * as project from '../lib/project.mjs';
import * as film from '../lib/film.mjs';
import * as thumbnails from '../lib/thumbnails.mjs';
test('Archon is the only stage controller; removed entrypoints and handoff configuration stay absent', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  for (const name of ['video', 'next', 'render', 'dev', 'check']) assert.equal(pkg.scripts[name], undefined);
  for (const file of [
    'scripts/video.mjs',
    'chat.config.json',
    'engines/explainroo/src/cli.js',
    'engines/explainroo/bin/explainroo.js',
  ])
    await assert.rejects(access(new URL('../' + file, import.meta.url)), { code: 'ENOENT' });
  for (const name of ['projectStep', 'closeDelegation', 'adaptStep', 'roleTarget', 'assertNoDelegation'])
    assert.equal(project[name], undefined);
  assert.equal(film.nextStep, undefined);
  assert.equal(film.jobProgress, undefined);
  assert.equal(thumbnails.thumbnailStep, undefined);
  const engine = JSON.parse(await readFile(new URL('../engines/explainroo/package.json', import.meta.url)));
  assert.equal(engine.bin, undefined);
});
