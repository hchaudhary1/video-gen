// Deterministic measured audio review; no listening or human approval is claimed.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { speechHash } from "../../lib/speech.mjs";
import { extractNarration } from "../../lib/timing.mjs";
import { fileHash, localFile, writeReviewFile } from "../../lib/review.mjs";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function audioEvidence({ job, dir }) {
  const manifest = await json(path.join(job, "job.json"));
  let measurements, files;
  if (manifest.engine === "explainroo") {
    const narration = await json(path.join(job, "review/kai-narration.json"));
    files = [];
    measurements = [];
    for (const [relative, expected] of narration.outputs) {
      const file = await localFile(job, relative),
        hash = await fileHash(file);
      if (hash !== expected)
        throw new Error(`Narration changed before audio review: ${relative}`);
      files.push([relative, hash]);
      if (relative.endsWith(".json")) {
        if (
          !narration.outputs.some(
            ([f]) => f === relative.replace(/\.json$/, ".wav"),
          )
        )
          throw new Error(`Missing recording for ${relative}`);
        const v = await json(file);
        measurements.push({
          scene: v.id,
          duration: v.duration,
          matchRate: v.matchRate,
          unconfirmed: v.unmatched || [],
          transcript: v.transcript,
        });
      }
    }
  } else {
    const speech = await json(path.join(job, "review/speech-narration.json"));
    if (
      speech.scriptSha256 !==
      speechHash(
        extractNarration(await readFile(path.join(dir, "SCRIPT.md"), "utf8")),
      )
    )
      throw new Error("Narration speech evidence refers to another script");
    const relative = manifest.audio.path;
    files = [[relative, await fileHash(await localFile(job, relative))]];
    if (speech.audioSha256 !== files[0][1])
      throw new Error("Narration speech evidence is stale");
    measurements = [
      {
        duration: speech.duration,
        matchRate: speech.matchRate,
        unconfirmed: speech.unconfirmed,
        warnings: speech.warnings,
        ok: speech.ok,
      },
    ];
  }
  const ok =
    measurements.length > 0 &&
    measurements.every(
      (v) =>
        Number.isFinite(v.matchRate) &&
        v.matchRate >= 0.9 &&
        v.duration > 0 &&
        v.ok !== false,
    );
  const scriptSha256 = await fileHash(path.join(dir, "SCRIPT.md"));
  return {
    binding: digest([scriptSha256, files, measurements]),
    ok,
    threshold: 0.9,
    files,
    measurements,
    limitations: [
      "ASR evidence does not establish listening, naturalness or pronunciation. Unconfirmed words above the acceptance threshold are disclosed uncertainties, not automatic rejection.",
    ],
  };
}
export async function saveAudioReview(ctx, { expected, report }) {
  const evidence = await audioEvidence(ctx);
  if (expected !== evidence.binding)
    throw new Error("Audio changed during review");
  if (
    !report ||
    typeof report.pass !== "boolean" ||
    !report.findings?.trim() ||
    !Array.isArray(report.limitations)
  )
    throw new Error("Audio review requires pass, findings and limitations");
  const receipt = {
    version: 1,
    ...evidence,
    report,
    mode: "measured",
    reviewer: "measured-audio-check",
    reviewedAt: new Date().toISOString(),
  };
  await writeReviewFile(
    ctx.job,
    "review/audio-review.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  if (!evidence.ok || !report.pass)
    throw new Error(`Audio review failed: ${report.findings}`);
  return receipt;
}
export async function assertAudioReview(ctx) {
  const evidence = await audioEvidence(ctx),
    receipt = await json(path.join(ctx.job, "review/audio-review.json"));
  if (
    !evidence.ok ||
    receipt.version !== 1 ||
    receipt.binding !== evidence.binding ||
    receipt.report?.pass !== true
  )
    throw new Error("Current passing audio review required");
  return receipt;
}

export async function reviewAudio(ctx) {
  const evidence = await audioEvidence(ctx);
  const findings = evidence.measurements.map(v =>
    `${v.scene || 'narration'}: ${(v.matchRate * 100).toFixed(1)}% speech coverage; ${(v.unconfirmed || []).length} unconfirmed words retained.`
  ).join(' ');
  return saveAudioReview(ctx, {expected:evidence.binding, report:{
    pass:evidence.ok, findings:findings || 'No valid speech measurements available.',
    limitations:[...evidence.limitations, 'Measured review only; audio was not listened to.']
  }});
}
