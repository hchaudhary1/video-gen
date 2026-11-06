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
// Below this coverage the take is treated as missing speech, not an ASR uncertainty, and
// production stops even after the fix round.
export const AUDIO_FLOOR = 0.5;
export async function saveAudioReview(ctx, { expected, report, final = false }) {
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
  const passed = evidence.ok && report.pass;
  // After the one fix round a take above the floor continues with its gaps disclosed.
  const usable = evidence.measurements.length > 0 && evidence.measurements.every(
    (v) => Number.isFinite(v.matchRate) && v.matchRate >= AUDIO_FLOOR && v.duration > 0,
  );
  const accepted = !passed && final && usable;
  const receipt = {
    version: 1,
    ...evidence,
    report,
    accepted,
    ...(accepted ? { acceptedLimitations: [
      `Speech coverage stayed below ${evidence.threshold * 100}% in some scenes after the one fix round; production continued with those words unconfirmed.`,
    ] } : {}),
    mode: "measured",
    reviewer: "measured-audio-check",
    reviewedAt: new Date().toISOString(),
  };
  await writeReviewFile(
    ctx.job,
    "review/audio-review.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  if (final && !passed && !accepted)
    throw new Error(`Audio review failed below the ${AUDIO_FLOOR * 100}% speech floor: ${report.findings}`);
  return { ...receipt, status: passed || accepted ? "complete" : "repair" };
}
export async function assertAudioReview(ctx) {
  const evidence = await audioEvidence(ctx),
    receipt = await json(path.join(ctx.job, "review/audio-review.json"));
  if (
    receipt.version !== 1 ||
    receipt.binding !== evidence.binding ||
    !((evidence.ok && receipt.report?.pass === true) || receipt.accepted === true)
  )
    throw new Error("Current passing or accepted audio review required");
  return receipt;
}

// The first pass routes a low-coverage take to its one fix; `final` accepts what the fix produced.
export async function reviewAudio(ctx, { final = false } = {}) {
  const evidence = await audioEvidence(ctx);
  const findings = evidence.measurements.map(v =>
    `${v.scene || 'narration'}: ${(v.matchRate * 100).toFixed(1)}% speech coverage; ${(v.unconfirmed || []).length} unconfirmed words retained.`
  ).join(' ');
  return saveAudioReview(ctx, {expected:evidence.binding, final, report:{
    pass:evidence.ok, findings:findings || 'No valid speech measurements available.',
    limitations:[...evidence.limitations, 'Measured review only; audio was not listened to.']
  }});
}
