import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  reviewAudio,
  audioEvidence,
  saveAudioReview,
  assertAudioReview,
} from "../scripts/archon/audio-review.mjs";
import { fileHash } from "../lib/review.mjs";
import { validateEngineChecks } from "../scripts/archon/kai-explainer.mjs";
// Synthetic ASR/file fixtures test contracts, not actual speech or listening.
async function fixture(t, matchRate = 0.961) {
  const base = await mkdtemp(path.resolve(".cache/audio-review-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const ctx = { job: path.join(base, "job"), dir: path.join(base, "script") };
  for (const d of [
    ctx.dir,
    path.join(ctx.job, "review"),
    path.join(ctx.job, "build/voice"),
  ])
    await mkdir(d, { recursive: true });
  await writeFile(path.join(ctx.dir, "SCRIPT.md"), "Synthetic script");
  await writeFile(
    path.join(ctx.job, "job.json"),
    JSON.stringify({ engine: "explainroo" }),
  );
  await writeFile(
    path.join(ctx.job, "build/voice/scene.wav"),
    "Synthetic WAV fixture",
  );
  await writeFile(
    path.join(ctx.job, "build/voice/scene.json"),
    JSON.stringify({
      id: "scene",
      duration: 20,
      matchRate,
      unmatched: ["does", "cache"],
    }),
  );
  const outputs = await Promise.all(
    ["build/voice/scene.wav", "build/voice/scene.json"].map(async (f) => [
      f,
      await fileHash(path.join(ctx.job, f)),
    ]),
  );
  await writeFile(
    path.join(ctx.job, "review/kai-narration.json"),
    JSON.stringify({ outputs }),
  );
  return ctx;
}
const report = {
  pass: true,
  findings: "Synthetic fixture: acceptable coverage; uncertainty retained.",
  limitations: ["ASR only, no listening."],
};
test("96.1% speech with two unconfirmed words is reviewable and cannot be rejected again by visual build", async (t) => {
  const ctx = await fixture(t),
    evidence = await audioEvidence(ctx);
  assert.equal(evidence.ok, true);
  assert.deepEqual(evidence.measurements[0].unconfirmed, ["does", "cache"]);
  const measured = await reviewAudio(ctx);
  assert.equal(measured.mode, "measured");
  assert.match(measured.report.limitations.join(" "), /not listened/);
  assert.equal((await assertAudioReview(ctx)).report.pass, true);
  const warning = {
    level: "warn",
    message: 'the voice check could not confirm "does", "cache".',
  };
  assert.equal(
    validateEngineChecks({ issues: [warning] }, { audioReviewed: true }),
    true,
  );
  assert.equal(validateEngineChecks({ issues: [warning] }), false);
  assert.equal(
    validateEngineChecks(
      { issues: [warning, { level: "error", message: "Missing scene" }] },
      { audioReviewed: true },
    ),
    false,
  );
});
test("audio review routes weak coverage to one fix, then accepts above the floor or fails below it", async (t) => {
  const weak = await fixture(t, 0.89),
    weakEvidence = await audioEvidence(weak);
  const first = await saveAudioReview(weak, { expected: weakEvidence.binding, report });
  assert.equal(first.status, "repair");
  await assert.rejects(assertAudioReview(weak), /Current passing or accepted audio review required/);
  const accepted = await saveAudioReview(weak, { expected: weakEvidence.binding, report, final: true });
  assert.equal(accepted.status, "complete");
  assert.equal(accepted.accepted, true);
  assert.match(accepted.acceptedLimitations.join(" "), /after the one fix round/);
  assert.equal((await assertAudioReview(weak)).accepted, true);
  const missing = await fixture(t, 0.3),
    missingEvidence = await audioEvidence(missing);
  assert.equal((await saveAudioReview(missing, { expected: missingEvidence.binding, report })).status, "repair");
  await assert.rejects(
    saveAudioReview(missing, { expected: missingEvidence.binding, report, final: true }),
    /below the 50% speech floor/,
  );
  const ctx = await fixture(t),
    evidence = await audioEvidence(ctx);
  assert.equal((await saveAudioReview(ctx, {
    expected: evidence.binding,
    report: { ...report, pass: false },
  })).status, "repair");
  await assert.rejects(
    saveAudioReview(ctx, { expected: "stale", report }),
    /changed during review/,
  );
  await saveAudioReview(ctx, { expected: evidence.binding, report });
  await writeFile(path.join(ctx.dir, "SCRIPT.md"), "Changed narration text");
  await assert.rejects(
    assertAudioReview(ctx),
    /Current passing or accepted audio review required/,
  );
  await writeFile(path.join(ctx.job, "build/voice/scene.wav"), "Changed take");
  await assert.rejects(audioEvidence(ctx), /Narration changed/);
});
