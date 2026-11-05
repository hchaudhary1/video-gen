#!/usr/bin/env node
// Called by the independent reviewer after writing its findings, never by a producer.
// Attach the exact assigned input without asking the model to transcribe a SHA-256.
import path from 'node:path';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { scriptBinding } from './stages.mjs';

export async function saveScriptReview(dir, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected || '') || await scriptBinding(dir) !== expected)
    throw new Error('Script changed during review or its assigned binding is missing.');
  const draft = await readFile(path.join(dir, 'review-draft.md'), 'utf8');
  if (!/^Disposition: (pass|revise|incomplete)\s*$/m.test(draft) || draft.trim().length < 80)
    throw new Error('Write substantive independent findings and a valid Disposition in review-draft.md.');
  const report = `Binding: ${expected}\n\n${draft.replace(/^Binding:.*\r?\n/gm, '')}`;
  const file = path.join(dir, 'review.md');
  await writeFile(file + '.tmp', report);
  // Fail closed if the reviewed artifact was changed while the report was saved.
  if (await scriptBinding(dir) !== expected) throw new Error('Script changed during review.');
  await rename(file + '.tmp', file);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('Explicit project slug required.');
  const dir = path.resolve('jobs/scripts', slug);
  const request = JSON.parse(await readFile(path.join(dir, 'archon/script-review-request.json'), 'utf8'));
  if (!process.env.WORKFLOW_ID || request.runId !== process.env.WORKFLOW_ID)
    throw new Error('Current Archon script-review assignment required.');
  await saveScriptReview(dir, request.binding);
}
