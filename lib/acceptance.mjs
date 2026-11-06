// Continuation receipts for the one-fix-then-continue production policy.
//
// A check that fails gets exactly one fix round. When the fix does not clear the check,
// production continues instead of stopping the workflow, and the remaining problem is
// recorded here. These receipts never claim a pass: delivery reports them as limitations,
// and `independentReviewPassed` stays false wherever a review did not pass.
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {writeReviewFile} from './review.mjs';

const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const optional = file => readJSON(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const CONTINUATIONS = 'review/continuations.json';

export async function listContinuations(job) {
  return (await optional(path.join(job, CONTINUATIONS)))?.entries || [];
}

// One entry per stage and binding: re-running a node after a crash replaces its entry
// rather than duplicating it.
export async function recordContinuation(job, {stage, binding = null, reason, details = null}) {
  if (!stage || !reason) throw new Error('A continuation needs a stage and a reason.');
  const entries = (await listContinuations(job)).filter(e => !(e.stage === stage && e.binding === binding));
  const entry = {stage, binding, reason, details, at: new Date().toISOString()};
  await writeReviewFile(job, CONTINUATIONS, JSON.stringify({version: 1, entries: [...entries, entry]}, null, 2) + '\n');
  return entry;
}

export const continuationLimitations = entries =>
  entries.map(e => `Continued after one fix round (${e.stage}): ${e.reason}`);

// Builds with remaining errors after their one technical repair stay usable when the
// engine still loaded every scene. The acceptance is bound to the exact sources.
const BUILD_ACCEPTANCE = 'review/build-acceptance.json';
export async function acceptBuild(job, {sourceHash, issues}) {
  const receipt = {version: 1, sourceHash, issues, acceptedAt: new Date().toISOString()};
  await writeReviewFile(job, BUILD_ACCEPTANCE, JSON.stringify(receipt, null, 2) + '\n');
  await recordContinuation(job, {stage: 'build', binding: sourceHash,
    reason: `${issues.length} build issue(s) remained after the technical repair round.`, details: issues});
  return receipt;
}

export async function buildUsable(job, build, sourceHash) {
  if (!build || build.sourceHash !== sourceHash || (build.scope && build.scope !== 'all')) return false;
  if (build.ok) return true;
  return (await optional(path.join(job, BUILD_ACCEPTANCE)))?.sourceHash === sourceHash;
}
