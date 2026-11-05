#!/usr/bin/env node
import { assertAudioReview } from './audio-review.mjs';
import path from 'node:path';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createProject, loadProject } from '../../lib/project.mjs';
import { stageOperation, saveJSON } from './stages.mjs';
import { prepare, finishPreparation, verify, hf } from './media.mjs';
import { assertSpeechEvidence } from '../../lib/speech.mjs';
import { extractNarration } from '../../lib/timing.mjs';
import { generateSpeech } from '../../lib/narration.mjs';
import { buildFilm, renderFilm, filmAudit, writeProductionReport, classifyFailure } from '../../lib/film.mjs';
import { createReviewPack } from '../../lib/review-pack.mjs';
import {
  reviewStatus,
  qualifyDelivery,
  fileHash,
  sourceFingerprint,
  loadReviewPack,
} from '../../lib/review.mjs';
import { prepareSeries } from '../../lib/series.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const save = async (f, v) => {
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(v, null, 2) + '\n');
};
const exists = async (f) => {
  try {
    await access(f);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validateDecision(record, binding) {
  // Archon attention is the existing operator boundary, not an identity proof.
  if (!['operator', 'archon-attention'].includes(record?.source) || !record.quote?.trim())
    throw new Error('Operator provenance and verbatim quote required.');
  if (record.sha256 !== binding) throw new Error('Decision is stale for this artifact.');
  if (!['approve', 'reject', 'revise', 'select', 'opt-out'].includes(record.decision))
    throw new Error('Invalid decision');
  return record;
}
export function assertFreshBuild(build, sourceHash) {
  if (!build?.ok || build.scope !== 'all' || build.sourceHash !== sourceHash)
    throw new Error('Successful current full build required before freeze');
}
export function assertFreshPixels(pixels, sourceHash, videoSha256) {
  if (!pixels?.ok || pixels.sourceHash !== sourceHash || pixels.videoSha256 !== videoSha256)
    throw new Error('Current passing encoded pixel evidence required');
}
async function verifyCurrent(job) {
  const report = await json(path.join(job, 'review/render-verification.json')).catch(() => null);
  const manifest = await json(path.join(job, 'job.json'));
  if (
    report?.ok &&
    report.narrationIntegrity?.ok &&
    report.sha256 === (await fileHash(path.join(job, 'renders/video.mp4'))) &&
    report.width === manifest.width &&
    report.height === manifest.height
  ) {
    try {
      await assertSpeechEvidence(job);
      return;
    } catch {}
  }
  await verify(job);
}
export async function run(stage, slug, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('Explicit project slug required');
  const dir = path.join(root, 'jobs/scripts', slug),
    job = path.join(root, 'jobs', slug);
  const project =
    stage === 'init' && !(await exists(path.join(dir, 'project.json')))
      ? await createProject(root, { ...options, name: slug, profile: 'rules-story', tts: 'ming' })
      : await loadProject(root, slug);
  if (project.productionProfile?.id !== 'rules-story')
    throw new Error('This adapter only accepts saved rules-story projects');
  let value = {};
  const ctx = { root, dir, job, project };
  if (['build','freeze','render','verify','deliver'].includes(stage)) await assertAudioReview(ctx);
  const routed = await stageOperation(stage, ctx, options);
  if (routed !== undefined) return { version: 1, status: 'complete', stage, artifacts: routed };
  const script = path.join(dir, 'SCRIPT.md'),
    audio = project.audio ? path.resolve(root, project.audio) : path.join(dir, 'narration.wav');
  if (stage === 'init') {
    if (!project.archon) {
      project.archon = { version: 1, optOut: options.optOut === true };
      await saveJSON(path.join(dir, 'project.json'), project);
    }
    value = { project, scriptSupplied: Boolean(project.inputScript), audioSupplied: Boolean(project.audio) };
  } else if (stage === 'narration') {
    const ready = await stageOperation('script-ready', ctx, {});
    if (!ready.done) throw new Error('Current independent script review required');
    const approval = await stageOperation('gate', ctx, { kind: 'script' });
    if (approval.required && !approval.approved) throw new Error('Current user script approval required');
    if (!project.audio) {
      const text = extractNarration(await readFile(script, 'utf8')),
        key = hash(text);
      const receipt = path.join(dir, 'archon/narration.json');
      const prior = (await exists(receipt)) ? await json(receipt) : null;
      if (!prior || prior.script !== key || prior.audio !== (await fileHash(audio).catch(() => null))) {
        if (prior)
          throw new Error(
            'Approved narration exists but inputs changed; operator must archive it before generating another take',
          );
        await generateSpeech({
          text,
          output: audio,
          provider: 'ming',
          narration: true,
          targetSeconds: project.duration || undefined,
        });
        await save(receipt, { script: key, audio: await fileHash(audio) });
      }
    }
    value = { audio, sha256: await fileHash(audio) };
  } else if (stage === 'prepare') {
    if (!(await exists(path.join(job, 'job.json'))))
      await prepare({
        name: slug,
        script,
        audio,
        profile: 'rules-story',
        format: project.format || 'landscape',
        'full-script': project.audio ? 'false' : 'true',
        'review-depth': project.reviewDepth,
      });
    const manifest = await json(path.join(job, 'job.json'));
    if (manifest.script.sha256 !== (await fileHash(script)))
      throw new Error('Prepared script changed; explicit timing migration required');
    if (manifest.audio.sourceSha256 !== (await fileHash(audio)))
      throw new Error('Source audio changed; explicit preparation migration required');
    if (manifest.audio.sha256 !== (await fileHash(path.join(job, manifest.audio.path))))
      throw new Error('Prepared narration changed');
    manifest.orchestrator = 'archon';
    manifest.humanReview = project.review.includes('final') ? ['final'] : [];
    manifest.pickThumbnail = project.review.includes('thumbnail');
    if (project.thumbnails) manifest.thumbnails = project.thumbnails;
    await saveJSON(path.join(job, 'job.json'), manifest);
    value = { job, manifest };
  } else if (stage === 'asr-timing') {
    const manifest = await json(path.join(job, 'job.json'));
    const receipt = path.join(job, 'review/archon-timing.json');
    const inputs = hash(
      JSON.stringify([
        await fileHash(script),
        await fileHash(path.join(job, manifest.audio.path)),
        manifest.transcription,
        manifest.script.fullScript,
      ]),
    );
    const outputs = ['transcript.json', 'alignment.json', 'SCRIPT.md', 'review/speech-narration.json'];
    const fingerprints = async () =>
      Promise.all(outputs.map((f) => fileHash(path.join(job, f)).catch(() => null)));
    const prior = await json(receipt).catch(() => null);
    if (
      !prior ||
      prior.inputs !== inputs ||
      JSON.stringify(prior.outputs) !== JSON.stringify(await fingerprints())
    ) {
      await finishPreparation(job, manifest, extractNarration(await readFile(script, 'utf8')));
      await save(receipt, { version: 1, inputs, outputs: await fingerprints() });
    }
    value = { job };
  } else if (stage === 'series') value = await prepareSeries(job);
  else if (stage === 'build') {
    value = await buildFilm(job, { print: false });
    if (value.pipelineErrors?.length) throw new Error(value.pipelineErrors.join('; '));
    if (!value.ok) {
      const failure = classifyFailure(value.errors || []);
      if (failure.isInfrastructure) throw new Error(failure.infrastructure.join('; '));
    }
    return { version: 1, status: value.ok ? 'complete' : 'repair', stage, artifacts: value };
  } else if (stage === 'freeze') {
    const build = await json(path.join(job, 'review/build.json'));
    assertFreshBuild(build, await sourceFingerprint(job));
    try {
      value = (await loadReviewPack(job, 'final')).pack;
    } catch {
      value = await createReviewPack(job, { stage: 'final', from: 'html' });
    }
  } else if (stage === 'reviews') {
    const build = await json(path.join(job, 'review/build.json'));
    if (!build.ok || build.sourceHash !== (await sourceFingerprint(job)))
      return { version: 1, status: 'repair', stage, artifacts: { reason: 'build requires repair' } };
    value = await reviewStatus(job, 'final');
    return { version: 1, status: value.ok ? 'complete' : 'repair', stage, artifacts: value };
  } else if (stage === 'render') {
    const approval = await stageOperation('gate', ctx, { kind: 'film' });
    if (approval.required && !approval.approved) throw new Error('Current user film approval required');
    const reviews = await reviewStatus(job, 'final');
    if (!reviews.ok) throw new Error('Current independent reviews required before rendering');
    const video = path.join(job, 'renders/video.mp4');
    const receipt = await json(path.join(job, 'review/render-source.json')).catch(() => null);
    if (
      !receipt ||
      receipt.sourceHash !== (await sourceFingerprint(job)) ||
      receipt.videoSha256 !== (await fileHash(video).catch(() => null))
    )
      await renderFilm(job, { hf, verify, quality: 'delivery', reuseBuild: true });
    value = { video };
  } else if (stage === 'verify') {
    await filmAudit(job);
    const pixels = await json(path.join(job, 'review/pixels.json'));
    if (!pixels.ok) {
      await saveJSON(path.join(job, 'review/archon-technical.json'), {
        status: 'repair',
        sourceHash: await sourceFingerprint(job),
        pixels,
      });
      return { version: 1, status: 'repair', stage, artifacts: pixels };
    }
    assertFreshPixels(
      pixels,
      await sourceFingerprint(job),
      await fileHash(path.join(job, 'renders/video.mp4')),
    );
    await verifyCurrent(job);
    await writeProductionReport(job);
    value = await qualifyDelivery(job);
    await saveJSON(path.join(job, 'review/archon-technical.json'), {
      status: 'complete',
      sourceHash: await sourceFingerprint(job),
      videoSha256: value.videoSha256,
    });
  } else if (stage === 'decision') {
    const artifact = path.resolve(root, options.artifact);
    if (!artifact.startsWith(root + path.sep)) throw new Error('Artifact outside repository');
    if (!/^[a-z-]+$/.test(options.kind || '')) throw new Error('Explicit checkpoint kind required');
    value = validateDecision(options.record, await fileHash(artifact));
    await save(path.join(dir, 'archon', options.kind + '-decision.json'), {
      ...value,
      recordedAt: new Date().toISOString(),
    });
    if (value.decision !== 'approve' && value.decision !== 'select' && value.decision !== 'opt-out')
      return { version: 1, status: 'repair', stage, artifacts: value };
  } else if (stage === 'deliver') {
    const pixels = await json(path.join(job, 'review/pixels.json'));
    assertFreshPixels(
      pixels,
      await sourceFingerprint(job),
      await fileHash(path.join(job, 'renders/video.mp4')),
    );
    value = await qualifyDelivery(job);
    const approval = await stageOperation('gate', ctx, { kind: 'film' });
    if (approval.required && !approval.approved) throw new Error('Current user film approval required');
    await saveJSON(path.join(job, 'review/delivery.json'), value);
    const manifest = await json(path.join(job, 'job.json'));
    manifest.status = 'complete';
    manifest.completedAt = new Date().toISOString();
    manifest.delivery = {
      videoSha256: value.videoSha256,
      sourceHash: value.sourceHash,
      packSha256: value.packSha256,
    };
    await saveJSON(path.join(job, 'job.json'), manifest);
  } else throw new Error(`Unknown adapter stage: ${stage}`);
  return { version: 1, status: 'complete', stage, artifacts: value };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Media diagnostics belong on stderr; stdout is exclusively the machine contract.
  console.log = (...args) => console.error(...args);
  try {
    const [stage, slug, opts] = process.argv.slice(2);
    const result = await run(stage, slug, opts && opts !== '--route' ? JSON.parse(opts) : {});
    process.stdout.write(JSON.stringify(result) + '\n');
    if (stage.endsWith('-check') && !result.artifacts?.done) process.exitCode = 2;
    if (result.status !== 'complete' && !(result.status === 'repair' && process.argv.includes('--route')))
      process.exitCode = 2;
  } catch (error) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'error', error: error.message }) + '\n');
    process.exitCode = 1;
  }
}

// Script-node bridge: keep large media diagnostics off the structured output channel.
export async function emit(stage, options = {}) {
  console.log = (...args) => console.error(...args);
  try {
    const result = await run(stage, process.env.INPUTS_PROJECT, options);
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status === 'error') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'error', stage, error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
