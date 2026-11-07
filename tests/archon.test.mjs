import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, validateDecision, run } from '../scripts/archon/rules-story.mjs';
test('an agent-accessible answer is not operator provenance', () => {
  assert.throws(() => validateDecision({ decision: 'approve', quote: 'yes' }, 'abc'), /provenance/);
});
test('approval binds the actual artifact; stale approval and empty quote fail', () => {
  const sha256 = hash('film');
  const record = {
    source: 'operator',
    operator: 'person',
    eventId: 'message-1',
    quote: 'Yes, this film',
    decision: 'approve',
    sha256,
  };
  assert.equal(validateDecision(record, hash('film')), record);
  assert.throws(() => validateDecision(record, hash('edited film')), /stale/);
  assert.throws(() => validateDecision({ ...record, quote: '' }, sha256), /quote/);
  assert.equal(validateDecision({ ...record, decision: 'revise' }, sha256).decision, 'revise');
});
test('adapter rejects traversal and implicit project selection', async () => {
  await assert.rejects(run('init', '../other'), /slug/);
  await assert.rejects(run('init', ''), /slug/);
});

import { assertFreshBuild } from '../scripts/archon/rules-story.mjs';
test('freeze rejects failed, partial and stale builds', () => {
  assert.throws(() => assertFreshBuild({ ok: false, scope: 'all', sourceHash: 'a' }, 'a'));
  assert.throws(() => assertFreshBuild({ ok: true, scope: 'scene', sourceHash: 'a' }, 'a'));
  assert.throws(() => assertFreshBuild({ ok: true, scope: 'all', sourceHash: 'a' }, 'b'));
  assert.doesNotThrow(() => assertFreshBuild({ ok: true, scope: 'all', sourceHash: 'a' }, 'a'));
});
test('actual attention decisions need no phantom operator file or claimed identity proof', () => {
  const record = {
    source: 'archon-attention',
    quote: 'Please revise the opening',
    decision: 'revise',
    sha256: 'a',
  };
  assert.equal(validateDecision(record, 'a').decision, 'revise');
  assert.throws(() => validateDecision(record, 'b'), /stale/);
  assert.throws(() => validateDecision({ ...record, decision: 'maybe' }, 'a'), /Invalid/);
});

import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  stageOperation,
  gate,
  checkpoint,
  scriptBinding,
  saveJSON,
  publicationCopy,
  passingThumbnails,
} from '../scripts/archon/stages.mjs';
async function fixture(t) {
  const root = await mkdtemp(path.resolve('.cache/archon-gates-'));
  const ctx = {
    root,
    dir: path.join(root, 'script'),
    job: path.join(root, 'job'),
    project: { slug: 'fixture', review: ['script'], archon: { version: 1 } },
  };
  await mkdir(ctx.dir, { recursive: true });
  await mkdir(ctx.job, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(ctx.dir, 'SCRIPT.md'), '# Fixture\n\nOriginal narration.');
  await writeFile(path.join(ctx.dir, 'VISUALS.md'), 'Original visual intent.');
  await writeFile(path.join(ctx.dir, 'production-profile.json'), '{}');
  return ctx;
}
test('script review and approval invalidate on edits; revision is a real incomplete route', async (t) => {
  const ctx = await fixture(t);
  assert.equal((await stageOperation('script-loop-result', ctx, {})).done, false);
  await writeFile(
    path.join(ctx.dir, 'review.md'),
    `Binding: ${await scriptBinding(ctx.dir)}\nDisposition: pass\nClaims checked against retained sources.`,
  );
  const expected = await scriptBinding(ctx.dir);
  await stageOperation('script-reviewed', ctx, { expected });
  assert.equal(
    (await stageOperation('script-loop-result', ctx, {})).done,
    false,
    'requested user approval still required',
  );
  await checkpoint(ctx, {
    kind: 'script',
    expected,
    answer: { decision: 'revise', text: 'Change the opening' },
  });
  assert.equal((await stageOperation('script-status', ctx, {})).needsWrite, true);
  assert.equal((await stageOperation('script-loop-result', ctx, {})).done, false);
  await checkpoint(ctx, {
    kind: 'script',
    expected,
    answer: { decision: 'approve', text: 'I approve this script' },
  });
  assert.equal((await stageOperation('script-loop-result', ctx, {})).done, true);
  await writeFile(path.join(ctx.dir, 'VISUALS.md'), 'Changed visual intent.');
  assert.equal((await gate('script', ctx)).approved, false);
  assert.equal((await stageOperation('script-ready', ctx, {})).done, false);
  await assert.rejects(
    checkpoint(ctx, { kind: 'script', expected, answer: { decision: 'approve', text: 'yes' } }),
    /changed while/,
  );
});
test('supplied script cannot be changed by writer without user revision', async (t) => {
  const ctx = await fixture(t);
  ctx.project.inputScript = 'supplied.md';
  ctx.project.suppliedScriptSha256 = hash('Supplied words.');
  await writeFile(path.join(ctx.root, 'supplied.md'), 'Supplied words.');
  await writeFile(path.join(ctx.dir, 'review.md'), `Binding: ${await scriptBinding(ctx.dir)}\nDisposition: pass`);
  await assert.rejects(
    stageOperation('script-reviewed', ctx, {
      expected: await scriptBinding(ctx.dir),
    }),
    /Supplied script changed/,
  );
});
test('optional checkpoints do not manufacture approvals; review report edits invalidate cache', async (t) => {
  const ctx = await fixture(t);
  ctx.project.review = [];
  await writeFile(path.join(ctx.dir, 'review.md'), `Binding: ${await scriptBinding(ctx.dir)}\nDisposition: pass`);
  await stageOperation('script-reviewed', ctx, {
    expected: await scriptBinding(ctx.dir),
  });
  assert.equal((await stageOperation('script-loop-result', ctx, {})).done, true);
  assert.equal((await gate('script', ctx)).approved, false);
  await writeFile(path.join(ctx.dir, 'review.md'), 'Disposition: incomplete');
  assert.equal((await stageOperation('script-ready', ctx, {})).done, false);
});
test('opt-out never calls uploader or requires credentials/copy', async (t) => {
  const ctx = await fixture(t);
  ctx.project.archon.optOut = true;
  assert.deepEqual(await stageOperation('publish', ctx, {}), { optOut: true });
  assert.equal((await stageOperation('publishing-loop-result', ctx, {})).done, true);
});
test('thumbnail ranking excludes stale, blocked and unresolved variants', () => {
  const variants = [
    { id: 'v1', made: true, review: { status: 'pass' }, openFeedback: [] },
    { id: 'v2', made: true, review: { status: 'blocked' }, openFeedback: [] },
    { id: 'v3', made: true, review: { status: 'pass' }, openFeedback: ['change'] },
    { id: 'v4', made: true, review: null, openFeedback: [] },
  ];
  assert.deepEqual(passingThumbnails({ ranking: ['v4', 'v3', 'v2', 'v1'], variants }), ['v1']);
});
test('publication rejects missing metadata, other privacy and missing exact channel', () => {
  assert.throws(
    () => publicationCopy({ title: 'Title', description: 'Copy', privacy: 'public' }),
    /unlisted/,
  );
  assert.throws(() => publicationCopy({ title: 'Title', description: 'Copy' }), /channelId/);
  assert.equal(
    publicationCopy({ title: 'Title', description: 'Copy', channelId: 'UC' + 'a'.repeat(22) }).title,
    'Title',
  );
});
import { assertFreshPixels } from '../scripts/archon/rules-story.mjs';
test('delivery pixels bind both current sources and encoded video', () => {
  const pixels = { ok: true, sourceHash: 'sources', videoSha256: 'video' };
  assert.doesNotThrow(() => assertFreshPixels(pixels, 'sources', 'video'));
  assert.throws(() => assertFreshPixels(pixels, 'changed', 'video'), /pixel evidence/);
  assert.throws(() => assertFreshPixels(pixels, 'sources', 'changed'), /pixel evidence/);
  assert.throws(() => assertFreshPixels({ ...pixels, ok: false }, 'sources', 'video'), /pixel evidence/);
});


test('missing or stale script review is incomplete without rewriting existing author outputs', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  assert.equal((await stageOperation('script-status',ctx,{})).needsWrite,false);
  const missing=await stageOperation('script-reviewed',ctx,{expected});
  assert.equal(missing.done,false);
  assert.equal(missing.disposition,'incomplete');
  assert.match(missing.findings,/did not create review.md/);
  assert.equal((await stageOperation('script-status',ctx,{})).needsWrite,false);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${'0'.repeat(64)}\nDisposition: pass`);
  assert.equal((await stageOperation('script-reviewed',ctx,{expected})).done,false);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${expected}\nConcrete requested edit.\nDisposition: revise`);
  assert.equal((await stageOperation('script-reviewed',ctx,{expected})).disposition,'revise');
  const revise=await stageOperation('script-status',ctx,{});
  // A revise verdict routes to the single fix round, not another write-and-review pass.
  assert.equal(revise.needsWrite,false);
  assert.equal(revise.needsReview,false);
  assert.equal(revise.needsFix,true);
  assert.equal(revise.ready,false);
});

test('one fix after a non-passing script review continues without another review', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${expected}\nConcrete requested edit.\nDisposition: revise`);
  await stageOperation('script-reviewed',ctx,{expected});
  assert.equal((await stageOperation('script-ready',ctx,{})).done,false);
  await writeFile(path.join(ctx.dir,'SCRIPT.md'),'Fixed narration after the review.');
  const continued=await stageOperation('script-continue',ctx,{});
  assert.equal(continued.mode,'revised-after-review');
  const ready=await stageOperation('script-ready',ctx,{});
  assert.equal(ready.done,true);
  assert.equal(ready.mode,'revised-after-review');
  assert.match(ready.revision.reason,/passes the review/);
  const status=await stageOperation('script-status',ctx,{});
  assert.equal(status.needsReview,false, 'the fixed script is not reviewed again');
  await writeFile(path.join(ctx.dir,'SCRIPT.md'),'An unrelated later edit.');
  assert.equal((await stageOperation('script-ready',ctx,{})).done,false, 'acceptance binds the fixed text');
});

test('script review cannot claim a pass after the script changed during inspection', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${expected}\nDisposition: pass`);
  await writeFile(path.join(ctx.dir,'SCRIPT.md'),'Changed after reviewer read it.');
  await assert.rejects(stageOperation('script-reviewed',ctx,{expected}),/changed during independent review/);
  assert.equal((await stageOperation('script-reviewed',ctx,{expected:await scriptBinding(ctx.dir)})).done,false);
});


test('a review cannot qualify missing author outputs', async t => {
  const ctx=await fixture(t);
  await writeFile(path.join(ctx.dir,'VISUALS.md'),'');
  const expected=await scriptBinding(ctx.dir);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${expected}\nDisposition: pass`);
  const result=await stageOperation('script-reviewed',ctx,{expected});
  assert.equal(result.done,false);
  assert.match(result.findings,/VISUALS.md is missing or empty/);
  assert.equal((await stageOperation('script-status',ctx,{})).needsWrite,true);
});


test('bare approval records the actual selected decision without inventing operator text', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  const result=await checkpoint(ctx,{kind:'script',expected,answer:{decision:'approve'}});
  assert.equal(result.done,true);
  const receipt=JSON.parse(await readFile(path.join(ctx.dir,'archon/script-decision.json')));
  assert.equal(receipt.quote,'approve');
  assert.equal(receipt.quoteKind,'decision');
  assert.equal(receipt.answerText,'');
  assert.equal((await gate('script',ctx)).approved,true);
});

test('approval still needs an explicit valid decision and revisions need feedback', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  await assert.rejects(checkpoint(ctx,{kind:'script',expected,answer:{}}),/Invalid attention decision/);
  await assert.rejects(checkpoint(ctx,{kind:'script',expected,answer:{decision:'revise',text:''}}),/actual operator feedback/);
  await checkpoint(ctx,{kind:'script',expected,answer:{decision:'approve',text:'Yes, I approve this exact script.'}});
  const receipt=JSON.parse(await readFile(path.join(ctx.dir,'archon/script-decision.json')));
  assert.equal(receipt.quoteKind,'text');
  assert.equal(receipt.answerText,'Yes, I approve this exact script.');
});

test('editing the brief or packaging invalidates script review', async t => {
  const ctx=await fixture(t), expected=await scriptBinding(ctx.dir);
  await writeFile(path.join(ctx.dir,'review.md'),`Binding: ${expected}\nDisposition: pass`);
  await stageOperation('script-reviewed',ctx,{expected});
  assert.equal((await stageOperation('script-status',ctx,{})).ready,true);
  await writeFile(path.join(ctx.dir,'PACKAGE.md'),'Changed publishing promise.');
  assert.equal((await stageOperation('script-status',ctx,{})).ready,false);
  assert.equal((await stageOperation('script-status',ctx,{})).needsWrite,false);
});
test('a loop pass records the previous answer once and reports a rejection', async (t) => {
  const ctx = await fixture(t);
  assert.deepEqual(await stageOperation('answer', ctx, { kind: 'script', answer: null }), {
    recorded: false,
    rejected: false,
  });
  await writeFile(path.join(ctx.dir, 'review.md'), `Binding: ${await scriptBinding(ctx.dir)}\nDisposition: pass`);
  const expected = await scriptBinding(ctx.dir);
  await stageOperation('script-reviewed', ctx, { expected });
  const revise = await stageOperation('answer', ctx, {
    kind: 'script',
    expected,
    answer: { decision: 'revise', text: 'Tighten the opening' },
  });
  assert.equal(revise.recorded, true);
  assert.equal(revise.rejected, false);
  const decision = JSON.parse(await readFile(path.join(ctx.dir, 'archon/script-decision.json'), 'utf8'));
  assert.equal(decision.answerText, 'Tighten the opening');
  const stop = await stageOperation('answer', ctx, { kind: 'script', expected, answer: { decision: 'reject' } });
  assert.equal(stop.rejected, true);
  const approve = await stageOperation('answer', ctx, { kind: 'script', expected, answer: { decision: 'approve' } });
  assert.equal(approve.rejected, false);
  assert.equal((await stageOperation('script-loop-result', ctx, {})).done, true);
  // A repeated answer after approval is not re-recorded over the approval.
  const repeat = await stageOperation('answer', ctx, { kind: 'script', expected, answer: { decision: 'reject' } });
  assert.equal(repeat.rejected, false);
});
