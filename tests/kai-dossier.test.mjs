import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dossierErrors } from '../scripts/archon/contracts.mjs';

const DOSSIER = (community) => `## Claims and evidence\nclaim\n## Independent research\nchecks\n## Community reactions\n${community}\n## Candidate takes\ntakes\n`;

test('take dossier needs every section and retained community evidence or a stated gap', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kai-dossier-'));
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
