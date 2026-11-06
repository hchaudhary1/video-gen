// Fault-injection fixtures exercise recovery contracts, not creative acceptance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { initializeEngine, kaiFontIssues, run } from '../scripts/archon/kai-explainer.mjs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stageOperation, saveJSON, scriptBinding } from '../scripts/archon/stages.mjs';
import { validateResearch } from '../scripts/archon/contracts.mjs';
import { saveScriptReview } from '../scripts/archon/script-review-report.mjs';
import { loadProject } from '../engines/explainroo/src/project.js';
import { fileHash, sourceFingerprint } from '../lib/review.mjs';
import { freezePersonality, loadPersonality } from '../lib/personalities.mjs';
const root = path.resolve(import.meta.dirname, '..');
async function fixture(t) {
  const base = await mkdtemp(path.join(root, '.cache/archon-recovery-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const ctx = { root, dir: path.join(base, 'script'), job: path.join(base, 'job'),
    project: { slug: 'fixture', review: [], thumbnails: 1,
      productionProfile: { id: 'kai-explainer' }, format: 'landscape' } };
  await mkdir(ctx.dir, { recursive: true });
  await mkdir(ctx.job, { recursive: true });
  ctx.project.productionProfile = await freezePersonality(ctx.dir, loadPersonality('kai-explainer'));
  await writeFile(path.join(ctx.dir, 'SCRIPT.md'), '## hook\nHello world.');
  await writeFile(path.join(ctx.dir, 'VISUALS.md'), 'Synthetic visual intent.');
  return ctx;
}
test('malformed Kai opening is routed back to writing before review/approval/narration', async t => {
  const ctx = await fixture(t);
  await writeFile(path.join(ctx.dir, 'SCRIPT.md'), 'Unheaded hook.\n\n## scene\nMore words.');
  const binding = await scriptBinding(ctx.dir);
  await writeFile(path.join(ctx.dir, 'review.md'), `Binding: ${binding}\nDisposition: pass\nSynthetic fixture only.`);
  const report = await stageOperation('script-reviewed', ctx, { expected: binding });
  assert.equal(report.disposition, 'incomplete');
  const state = await stageOperation('script-status', ctx, {});
  assert.equal(state.needsWrite, true);
  assert.equal(state.valid, false);
  assert.match(state.errors.join(), /scene-id/);
  assert.equal((await stageOperation('script-ready', ctx, {})).done, false);
  ctx.project.inputScript = 'supplied.md';
  assert.equal((await stageOperation('script-status', ctx, {})).needsWrite, false,
    'supplied narration must not be silently rewritten');
});
test('partial engine initialization recovers without overwriting authored scenes; font setup is local', async t => {
  const ctx = await fixture(t);
  const error = new Error('Injected interruption after config and script writes');
  await assert.rejects(initializeEngine(ctx, { loadProject() { throw error; } }), error);
  await assert.rejects(access(path.join(ctx.job, 'job.json')), { code: 'ENOENT' });
  const config = await readFile(path.join(ctx.job, 'video.json'));
  await writeFile(path.join(ctx.job, 'scenes.js'), 'export default { hook(s) { s.bg("blue"); } };');
  await writeFile(path.join(ctx.job, 'script.md'), 'Stale interrupted copy.');
  const p = await initializeEngine(ctx, { loadProject });
  assert.deepEqual(await kaiFontIssues(p), []);
  assert.equal(p.script.scenes[0].id, 'hook');
  assert.match(await readFile(path.join(ctx.job, 'scenes.js'), 'utf8'), /s.bg\("blue"\)/);
  assert.deepEqual(await readFile(path.join(ctx.job, 'video.json')), config);
  const look = JSON.parse(await readFile(path.join(ctx.job, 'kai.json')));
  assert.ok(Object.values(look.fonts).every(f => f.weight === 800 && f.family === 'Production Inter'));
  for (const weight of [700, 800]) assert.equal(
    await fileHash(path.join(ctx.job, `assets/fonts/inter-latin-${weight}-normal.woff2`)),
    await fileHash(path.join(root, `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`)));
  const before = await fileHash(path.join(ctx.job, 'job.json'));
  await initializeEngine(ctx, { loadProject });
  assert.equal(await fileHash(path.join(ctx.job, 'job.json')), before);
  p.config.look.fonts.body.weight = 400;
  assert.match((await kaiFontIssues(p)).map(i => i.message).join(), /actual loaded heavy/);
});
test('interrupted narration preserves partial takes and refuses changed voice settings on resume', async t => {
  const slug = 'recovery-test-' + randomUUID().slice(0, 8);
  const dir = path.join(root, 'jobs/scripts', slug), job = path.join(root, 'jobs', slug);
  t.after(async () => { await rm(dir, { recursive: true, force: true }); await rm(job, { recursive: true, force: true }); });
  await run('init', slug, { brief: 'Synthetic fixture only.', review: 'none', optOut: true });
  await writeFile(path.join(dir, 'SCRIPT.md'), '## hook\nSynthetic fixture.');
  await writeFile(path.join(dir, 'VISUALS.md'), 'Synthetic visual intent.');
  await writeFile(path.join(dir, 'review.md'), `Binding: ${await scriptBinding(dir)}\nDisposition: pass\nSynthetic fixture only.`);
  const project = JSON.parse(await readFile(path.join(dir, 'project.json')));
  await stageOperation('script-reviewed', { root, dir, job, project }, { expected: await scriptBinding(dir) });
  let attempts = 0;
  const take = path.join(job, 'build/voice/hook.wav');
  const media = { loadProject, prepare: async () => {
    attempts++;
    await mkdir(path.dirname(take), { recursive: true });
    await writeFile(take, 'SYNTHETIC PARTIAL TAKE');
    throw new Error('Injected interruption');
  } };
  await assert.rejects(run('narration', slug, {}, { media }), /Injected interruption/);
  const configFile = path.join(job, 'video.json');
  const config = JSON.parse(await readFile(configFile));
  config.speed = 1.4;
  await saveJSON(configFile, config);
  await assert.rejects(run('narration', slug, {}, { media }), /inputs changed after generation started/);
  assert.equal(attempts, 1);
  assert.equal(await readFile(take, 'utf8'), 'SYNTHETIC PARTIAL TAKE');
});
test('syntax is rejected before partial engine files are written; existing takes are never replaced', async t => {
  const ctx = await fixture(t);
  await writeFile(path.join(ctx.dir, 'SCRIPT.md'), 'Unheaded narration.');
  await assert.rejects(initializeEngine(ctx, { loadProject }), /scene-id/);
  await assert.rejects(access(path.join(ctx.job, 'video.json')), { code: 'ENOENT' });
  await mkdir(path.join(ctx.job, 'build/voice'), { recursive: true });
  const take = path.join(ctx.job, 'build/voice/hook.wav');
  await writeFile(take, 'SYNTHETIC TAKE, not audio');
  await assert.rejects(initializeEngine(ctx, { loadProject }), /preserve takes/);
  assert.equal(await readFile(take, 'utf8'), 'SYNTHETIC TAKE, not audio');
});
test('no-op research cannot unlock writing; real retained evidence satisfies only the structural contract', async t => {
  const ctx = await fixture(t);
  assert.equal((await validateResearch(ctx.dir, ctx.project)).done, false);
  await writeFile(path.join(ctx.dir, 'SOURCES.md'), 'Synthetic source index.');
  assert.equal((await validateResearch(ctx.dir, ctx.project)).done, false);
  await mkdir(path.join(ctx.dir, 'sources'));
  await writeFile(path.join(ctx.dir, 'sources/fixture.md'), 'Synthetic retained source, not production evidence.');
  assert.equal((await validateResearch(ctx.dir, ctx.project)).done, true);
});
test('review helper binds exact assigned artifacts, retains judgment, refuses stale inputs', async t => {
  const ctx = await fixture(t);
  const draft = 'Synthetic independent-review fixture only. No real media inspection or creative approval is claimed.\nDisposition: pass\n';
  await writeFile(path.join(ctx.dir, 'review-draft.md'), draft);
  const binding = await scriptBinding(ctx.dir);
  await saveScriptReview(ctx.dir, binding);
  assert.equal(await readFile(path.join(ctx.dir, 'review.md'), 'utf8'), `Binding: ${binding}\n\n${draft}`);
  await writeFile(path.join(ctx.dir, 'SCRIPT.md'), '## hook\nChanged words.');
  await assert.rejects(saveScriptReview(ctx.dir, binding), /changed/);
});
test('review CLI uses an explicit slug and rejects a different Archon run identity', async t => {
  const slug = 'review-test-' + randomUUID().slice(0, 8);
  const dir = path.join(root, 'jobs/scripts', slug);
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'SCRIPT.md'), '## hook\nSynthetic fixture.');
  await writeFile(path.join(dir, 'review-draft.md'),
    'Synthetic fixture findings only. This test does not inspect media or approve a real script.\nDisposition: pass\n');
  const binding = await scriptBinding(dir);
  await saveJSON(path.join(dir, 'archon/script-review-request.json'), { binding, runId: 'assigned-review-run' });
  const execute = promisify(execFile);
  const env = { ...process.env, WORKFLOW_ID: 'other-run' };
  delete env.INPUTS_PROJECT; // AI nodes receive identity, not exec-node input variables.
  const args = ['scripts/archon/script-review-report.mjs', slug];
  await assert.rejects(execute(process.execPath, args, { cwd: root, env }), /Current Archon/);
  await execute(process.execPath, args, { cwd: root, env: { ...env, WORKFLOW_ID: 'assigned-review-run' } });
  assert.match(await readFile(path.join(dir, 'review.md'), 'utf8'), new RegExp(`^Binding: ${binding}`));
});
test('an unaccepted or stale build fails closed before evidence capture', async t => {
  const ctx = await fixture(t);
  const sourceHash = await sourceFingerprint(ctx.job);
  await saveJSON(path.join(ctx.job, 'review/build.json'), { ok: false, scope: 'all', sourceHash });
  await assert.rejects(stageOperation('build-check', ctx, {}), /unusable after its technical repair round/);
  const { acceptBuild } = await import('../lib/acceptance.mjs');
  await acceptBuild(ctx.job, { sourceHash, issues: ['Synthetic remaining layout error'] });
  assert.equal((await stageOperation('build-check', ctx, {})).accepted, true, 'an accepted build continues');
  await saveJSON(path.join(ctx.job, 'review/build.json'), { ok: true, scope: 'all', sourceHash });
  assert.equal((await stageOperation('build-check', ctx, {})).done, true);
  await writeFile(path.join(ctx.job, 'scenes.js'), 'changed source');
  await assert.rejects(stageOperation('build-check', ctx, {}), /unusable after its technical repair round/);
});
