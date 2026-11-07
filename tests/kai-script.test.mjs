import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dossierErrors, redo } from '../scripts/archon/kai-script.mjs';

const DOSSIER = (community) => `## Claims and evidence\nclaim\n## Independent research\nchecks\n## Community reactions\n${community}\n## Candidate takes\ntakes\n`;

test('take dossier needs every section and retained community evidence or a stated gap', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kai-script-'));
  assert.match((await dossierErrors(dir))[0], /ANALYSIS\.md/);
  await mkdir(path.join(dir, 'sources'), { recursive: true });
  await writeFile(path.join(dir, 'sources/ANALYSIS.md'), DOSSIER('camps'));
  assert.deepEqual((await dossierErrors(dir)).map((e) => e.match(/sources\/\w+\//)?.[0]), ['sources/community/']);
  await writeFile(path.join(dir, 'sources/ANALYSIS.md'), DOSSIER('Unavailable: Reddit and X blocked every request.'));
  assert.deepEqual(await dossierErrors(dir), []);
  await mkdir(path.join(dir, 'sources/community'), { recursive: true });
  await writeFile(path.join(dir, 'sources/community/thread.md'), 'retained thread');
  await writeFile(path.join(dir, 'sources/ANALYSIS.md'), DOSSIER('camps'));
  assert.deepEqual(await dossierErrors(dir), []);
  await writeFile(path.join(dir, 'sources/ANALYSIS.md'), DOSSIER('camps').replace('takes\n', ''));
  assert.match((await dossierErrors(dir)).join(), /Candidate takes/);
});

test('redo archives the replaced outputs once per run and keeps the brief and research', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kai-redo-'));
  const dir = path.join(root, 'jobs/scripts/demo');
  await mkdir(path.join(dir, 'sources'), { recursive: true });
  for (const f of ['BRIEF.md', 'SOURCES.md', 'SCRIPT.md', 'VISUALS.md', 'research.md', 'review.md', 'sources/a.md'])
    await writeFile(path.join(dir, f), f);
  const previous = process.env.WORKFLOW_ID;
  process.env.WORKFLOW_ID = 'run-a';
  try {
    const first = await redo('demo', 'review', root);
    assert.deepEqual(first.archived, ['review.md']);
    assert.equal(await readFile(path.join(dir, first.to, 'review.md'), 'utf8'), 'review.md');
    assert.equal((await redo('demo', 'write', root)).skipped, 'already applied in this run');
    process.env.WORKFLOW_ID = 'run-b';
    assert.deepEqual((await redo('demo', 'write', root)).archived, ['SCRIPT.md', 'VISUALS.md', 'research.md']);
    assert.deepEqual((await readdir(dir)).sort(), ['BRIEF.md', 'SOURCES.md', 'archon', 'sources']);
    await assert.rejects(redo('demo', 'everything', root), /redo must be one of/);
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_ID;
    else process.env.WORKFLOW_ID = previous;
  }
});
