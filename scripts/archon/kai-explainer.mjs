#!/usr/bin/env node
// Direct explainroo operations. Archon YAML exclusively owns the production lifecycle.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { createProject, loadProject } from '../../lib/project.mjs';
import { freezePersonality, readPersonality } from '../../lib/personalities.mjs';
import { fileHash, sourceFingerprint, loadReviewPack, reviewStatus } from '../../lib/review.mjs';
import { stageOperation, saveJSON, readJSON, digest, gate } from './stages.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(ROOT, 'engines/explainroo');
// Force all model/tool caches into this repository before importing engine modules.
process.env.EXPLAINROO_CACHE = path.join(ROOT, '.cache/explainroo');
const exists = async (f) => {
  try {
    await stat(f);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
const optional = async (f) => {
  try {
    return await readJSON(f);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
};
async function engine() {
  const [project, pipeline, qa, render, voice] = await Promise.all(
    ['project', 'pipeline', 'qa', 'render', 'voice'].map((n) => import(`${ENGINE}/src/${n}.js`)),
  );
  return { ...project, ...pipeline, ...qa, render: render.render, voicePaths: voice.voicePaths };
}
export function validateEngineChecks(report) {
  if (!Array.isArray(report?.issues)) throw new Error('Engine check report missing issues');
  return !report.issues.some((i) => ['error', 'warn'].includes(i.level));
}
export function validateEngineVerification(report, manifest) {
  if (!report?.video || !report.audio) throw new Error('Final video and audio streams required');
  if (!Number.isFinite(report.duration) || report.duration <= 0)
    throw new Error('Finite measured duration required');
  if (
    report.video.width !== manifest.width ||
    report.video.height !== manifest.height ||
    Math.abs(report.duration - manifest.duration) > 0.12
  )
    throw new Error('Final canvas or duration differs from measured Kai timeline');
  const rate = report.video.fps.split('/').map(Number);
  if (!Number.isFinite(rate[0] / (rate[1] || 1)) || Math.abs(rate[0] / (rate[1] || 1) - manifest.fps) > 0.01)
    throw new Error('Final frame rate differs from saved canvas');
  if (
    !Number.isFinite(report.speech?.matchRate) ||
    report.speech.matchRate < 0.85 ||
    !Array.isArray(report.speech.scenes) ||
    !report.speech.scenes.length ||
    report.speech.scenes.some((s) => !Number.isFinite(s.matchRate) || s.matchRate < 0.8) ||
    (manifest.speechScenes &&
      JSON.stringify([...manifest.speechScenes].sort()) !==
        JSON.stringify(report.speech.scenes.map((s) => s.id).sort()))
  )
    throw new Error('Final-mix speech verification failed');
  if (!validateEngineChecks(report)) throw new Error('Encoded media checks have unresolved warnings/errors');
  return true;
}
async function narrationKey(ctx, p) {
  const voiceSettings = Object.fromEntries(
    ['voice', 'language', 'speed', 'pace', 'sentenceGap', 'paragraphGap', 'lead', 'hold'].map((k) => [
      k,
      p.config[k],
    ]),
  );
  const source = ctx.project.audio ? await fileHash(path.resolve(ROOT, ctx.project.audio)) : null;
  const copied =
    p.config.voice.provider === 'recording' ? await fileHash(path.join(p.dir, p.config.voice.src)) : null;
  return digest([await fileHash(path.join(ctx.dir, 'SCRIPT.md')), voiceSettings, source, copied]);
}
async function voiceFiles(p, e) {
  const names = [];
  for (const sc of p.script.scenes) {
    const files = e.voicePaths(p, sc.id);
    for (const f of [files.json, files.wav]) if (await exists(f)) names.push(path.relative(p.dir, f));
  }
  return Promise.all(names.map(async (f) => [f, await fileHash(path.join(p.dir, f))]));
}
async function timingBinding(job) {
  const t = await readJSON(path.join(job, 'build/timeline.json'));
  return digest([
    t.width,
    t.height,
    t.fps,
    t.duration,
    t.frames,
    t.scenes.map((s) => ({
      id: s.id,
      start: s.start,
      dur: s.dur,
      lead: s.lead,
      voice: s.voice,
      words: s.words,
      marks: s.marks,
    })),
  ]);
}
async function assertNarration(ctx, p, e) {
  const receipt = await readJSON(path.join(ctx.job, 'review/kai-narration.json'));
  const manifest = await readJSON(path.join(ctx.job, 'job.json'));
  if (['width', 'height', 'fps'].some((k) => p.config[k] !== manifest[k]))
    throw new Error('Saved Kai canvas/frame rate changed');
  if (
    receipt.inputs !== (await narrationKey(ctx, p)) ||
    receipt.timing !== (await timingBinding(ctx.job)) ||
    JSON.stringify(receipt.outputs) !== JSON.stringify(await voiceFiles(p, e))
  )
    throw new Error(
      'Approved Kai narration/timing changed; preserve the take and create an explicitly authorized new production',
    );
  if ((await fileHash(path.join(ctx.dir, 'SCRIPT.md'))) !== (await fileHash(path.join(ctx.job, 'script.md'))))
    throw new Error('Engine script differs from approved script');
  return receipt;
}
async function initializeEngine(ctx, e) {
  const { job, dir, project } = ctx;
  if (await exists(path.join(job, 'video.json'))) return e.loadProject(job);
  await mkdir(path.join(job, 'assets'), { recursive: true });
  await mkdir(path.join(job, 'review'), { recursive: true });
  const tpl = path.join(ENGINE, 'templates/kai');
  for (const f of await readdir(tpl))
    if (f.endsWith('.json') || f === 'scenes.js') await copyFile(path.join(tpl, f), path.join(job, f));
  const defaults = await readJSON(path.join(job, 'video.json'));
  const config = {
    ...defaults,
    title: project.slug,
    size: { landscape: '16:9', vertical: '9:16', square: '1:1' }[project.format || 'landscape'],
    captions: true,
  };
  if (project.audio) {
    const source = path.resolve(ROOT, project.audio),
      dest = 'assets/recording' + path.extname(source).toLowerCase();
    await copyFile(source, path.join(job, dest));
    config.voice = { provider: 'recording', src: dest };
    // The recording is preserved; generated scene takes must keep the original pace.
    config.speed = 1;
    config.pace = 1;
  }
  await saveJSON(path.join(job, 'video.json'), config);
  await copyFile(path.join(dir, 'SCRIPT.md'), path.join(job, 'script.md'));
  await freezePersonality(job, readPersonality(dir));
  const p = e.loadProject(job);
  await saveJSON(path.join(job, 'job.json'), {
    version: 1,
    name: project.slug,
    orchestrator: 'archon',
    engine: 'explainroo',
    duration: 0,
    width: p.config.width,
    height: p.config.height,
    fps: p.config.fps,
    thumbnails: project.thumbnails || 3,
    pickThumbnail: project.review.includes('thumbnail'),
    reviewDepth: project.reviewDepth,
    productionProfile: project.productionProfile,
    status: 'awaiting-narration',
    review: { producerAgentIds: [], producerAgentRecords: [] },
  });
  return p;
}
export async function qualifyKai(job) {
  const manifest = await readJSON(path.join(job, 'job.json'));
  const project = await loadProject(ROOT, manifest.name),
    ctx = { root: ROOT, dir: path.join(ROOT, 'jobs/scripts', manifest.name), job, project };
  const e = await engine();
  await assertNarration(ctx, e.loadProject(job), e);
  const reviews = await reviewStatus(job, 'final');
  if (!reviews.ok) throw new Error('Current independent film reviews required');
  const videoSha256 = await fileHash(path.join(job, 'renders/video.mp4'));
  const receipt = await readJSON(path.join(job, 'review/render-source.json'));
  if (receipt.sourceHash !== (await sourceFingerprint(job)) || receipt.videoSha256 !== videoSha256)
    throw new Error('Kai render is stale');
  const technical = await readJSON(path.join(job, 'review/render-verification.json'));
  if (!technical.ok || technical.sha256 !== videoSha256 || technical.sourceHash !== receipt.sourceHash)
    throw new Error('Current final verification required');
  validateEngineVerification(technical.report, manifest);
  return {
    version: 1,
    ok: true,
    engine: 'explainroo',
    sourceHash: receipt.sourceHash,
    videoSha256,
    packSha256: reviews.packSha256,
    independentReviewPassed: reviews.independentPassed,
    reviewDisposition: reviews.disposition,
    reviewerIds: reviews.reports.map((r) => r.reviewer.agentId),
    unresolvedFindings: reviews.reports.flatMap((r) => r.findings.filter((f) => f.severity === 'blocking')),
    limitations: [
      ...reviews.reports.flatMap((r) => r.inspection.limitations),
      'Engine speech checks are ASR measurements; no listening or naturalness judgment is established.',
    ],
  };
}
export async function run(stage, slug, options = {}, { media } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('Explicit project slug required');
  const dir = path.join(ROOT, 'jobs/scripts', slug),
    job = path.join(ROOT, 'jobs', slug);
  const project =
    stage === 'init' && !(await exists(path.join(dir, 'project.json')))
      ? await createProject(ROOT, {
          ...options,
          name: slug,
          profile: 'kai-explainer',
          tts: options.audio ? 'recording' : 'kokoro',
        })
      : await loadProject(ROOT, slug);
  if (project.productionProfile.id !== 'kai-explainer')
    throw new Error('Saved project must use kai-explainer');
  const ctx = { root: ROOT, dir, job, project, qualify: () => qualifyKai(job), engine: 'explainroo' };
  let artifacts;
  if (stage === 'init') artifacts = { project };
  else if (stage === 'narration') {
    const ready = await stageOperation('script-ready', ctx, {}),
      approval = await gate('script', ctx);
    if (!ready.done || (approval.required && !approval.approved))
      throw new Error('Current independently reviewed and requested approved script required');
    const e = media || (await engine()),
      p = await initializeEngine(ctx, e),
      prior = await optional(path.join(job, 'review/kai-narration.json'));
    if ((await fileHash(path.join(dir, 'SCRIPT.md'))) !== (await fileHash(path.join(job, 'script.md'))))
      throw new Error('Engine script differs from approved script');
    if (prior) await assertNarration(ctx, p, e);
    else {
      const inputs = await narrationKey(ctx, p),
        { voices, timeline } = await e.prepare(p);
      const spoken = p.script.scenes.filter((sc) => sc.units.some((u) => u.type === 'word'));
      if (!spoken.length) throw new Error('Kai requires narrated scenes');
      for (const sc of spoken) {
        const v = voices[sc.id];
        if (!v || !Number.isFinite(v.matchRate) || v.matchRate < 0.9 || !(v.duration > 0))
          throw new Error(
            `Narration speech check failed for ${sc.id}; preserve take and inspect measured evidence`,
          );
      }
      const manifest = await readJSON(path.join(job, 'job.json'));
      manifest.duration = timeline.duration;
      manifest.speechScenes = spoken.map((sc) => sc.id);
      manifest.status = 'prepared';
      await saveJSON(path.join(job, 'job.json'), manifest);
      if (
        project.duration &&
        Math.abs(timeline.duration - project.duration) > Math.max(2, project.duration * 0.2)
      )
        throw new Error(
          'Measured narration duration differs from requested target; preserve take and inspect script coverage',
        );
      await saveJSON(path.join(job, 'review/kai-narration.json'), {
        version: 1,
        inputs,
        outputs: await voiceFiles(p, e),
        timing: await timingBinding(job),
        duration: timeline.duration,
      });
    }
    artifacts = { duration: (await readJSON(path.join(job, 'job.json'))).duration };
  } else if (['build', 'preview', 'freeze', 'render', 'verify', 'deliver'].includes(stage)) {
    const e = media || (await engine()),
      p = e.loadProject(job);
    await assertNarration(ctx, p, e);
    if (stage === 'build') {
      const report = await e.check(p, { viewWidth: 854 });
      const ok = validateEngineChecks(report);
      artifacts = { ok, scope: 'all', sourceHash: await sourceFingerprint(job), report };
      await saveJSON(path.join(job, 'review/build.json'), artifacts);
      return { version: 1, stage, status: ok ? 'complete' : 'repair', artifacts };
    }
    if (stage === 'preview') {
      const build = await readJSON(path.join(job, 'review/build.json')),
        sourceHash = await sourceFingerprint(job);
      if (!build.ok || build.sourceHash !== sourceHash)
        throw new Error('Current successful build required before preview');
      const file = path.join(job, 'review/preview/video.mp4'),
        prior = await optional(path.join(job, 'review/kai-preview.json'));
      if (
        prior?.sourceHash !== sourceHash ||
        prior.videoSha256 !== (await fileHash(file).catch(() => null))
      ) {
        await mkdir(path.dirname(file), { recursive: true });
        await e.render(p, { out: file, draft: true });
        await assertNarration(ctx, p, e);
        if (sourceHash !== (await sourceFingerprint(job))) throw new Error('Sources changed during preview');
        await saveJSON(path.join(job, 'review/kai-preview.json'), {
          sourceHash,
          videoSha256: await fileHash(file),
        });
      }
      artifacts = { file, label: 'Review draft; not qualified delivery' };
    }
    if (stage === 'freeze') {
      const build = await readJSON(path.join(job, 'review/build.json'));
      if (!build.ok || build.sourceHash !== (await sourceFingerprint(job)))
        throw new Error('Current successful build required');
      try {
        artifacts = (await loadReviewPack(job, 'final')).pack;
      } catch {
        const timeline = await readJSON(path.join(job, 'build/timeline.json'));
        const frames = await e.stills(p, []),
          sheet = await e.sheet(p, { every: 1 });
        const evidence = [];
        const add = async (file, kind, start, end) =>
          evidence.push({
            path: path.relative(job, file).split(path.sep).join('/'),
            kind,
            start,
            end,
            sha256: await fileHash(file),
          });
        for (const frame of frames)
          await add(
            frame.file,
            'frames',
            Math.min(frame.time, timeline.duration),
            Math.min(frame.time, timeline.duration),
          );
        await add(sheet.file, 'contact-sheet', 0, timeline.duration);
        const preview = await readJSON(path.join(job, 'review/kai-preview.json'));
        if (
          preview.sourceHash !== (await sourceFingerprint(job)) ||
          preview.videoSha256 !== (await fileHash(path.join(job, 'review/preview/video.mp4')))
        )
          throw new Error('Current review preview required before freezing evidence');
        await add(path.join(job, 'review/preview/video.mp4'), 'clip', 0, timeline.duration);
        for (const sc of timeline.scenes) {
          const wav = e.voicePaths(p, sc.id).wav;
          if (await exists(wav))
            await add(
              wav,
              'audio',
              sc.voice?.start ?? sc.start,
              Math.min((sc.voice?.start ?? sc.start) + (sc.voice?.dur ?? sc.dur), timeline.duration),
            );
        }
        await add(path.join(job, 'build/timeline.json'), 'checks', 0, timeline.duration);
        const pack = {
          version: 1,
          stage: 'final',
          source: 'html',
          engine: 'explainroo',
          sourceHash: await sourceFingerprint(job),
          videoSha256: null,
          duration: timeline.duration,
          interval: { start: 0, end: timeline.duration },
          scenes: timeline.scenes.map((sc) => ({
            id: sc.id,
            start: sc.start,
            end: Math.min(sc.start + sc.dur, timeline.duration),
          })),
          evidence,
        };
        await saveJSON(path.join(job, 'review/final/pack.json'), pack);
        artifacts = (await loadReviewPack(job, 'final')).pack;
      }
    }
    if (stage === 'render') {
      const approval = await gate('film', ctx);
      if (approval.required && !approval.approved) throw new Error('Current user film approval required');
      if (!(await reviewStatus(job, 'final')).ok)
        throw new Error('Current independent film reviews required');
      const sourceHash = await sourceFingerprint(job),
        receipt = await optional(path.join(job, 'review/render-source.json')),
        video = path.join(job, 'renders/video.mp4');
      if (
        receipt?.sourceHash !== sourceHash ||
        receipt.videoSha256 !== (await fileHash(video).catch(() => null))
      ) {
        await mkdir(path.dirname(video), { recursive: true });
        await e.render(p, { out: video });
        await assertNarration(ctx, p, e);
        if (sourceHash !== (await sourceFingerprint(job)))
          throw new Error('Sources changed during rendering');
        await saveJSON(path.join(job, 'review/render-source.json'), {
          version: 1,
          sourceHash,
          videoSha256: await fileHash(video),
        });
      }
      artifacts = { video };
    }
    if (stage === 'verify') {
      const sourceHash = await sourceFingerprint(job),
        sha256 = await fileHash(path.join(job, 'renders/video.mp4')),
        prior = await optional(path.join(job, 'review/render-verification.json'));
      if (prior?.ok && prior.sourceHash === sourceHash && prior.sha256 === sha256)
        validateEngineVerification(prior.report, await readJSON(path.join(job, 'job.json')));
      else {
        const report = await e.verify(p, { file: path.join(job, 'renders/video.mp4') });
        try {
          validateEngineVerification(report, await readJSON(path.join(job, 'job.json')));
        } catch (error) {
          if (error.message !== 'Encoded media checks have unresolved warnings/errors') throw error;
          await saveJSON(path.join(job, 'review/archon-technical.json'), {
            status: 'repair',
            sourceHash,
            videoSha256: sha256,
            report,
          });
          return { version: 1, status: 'repair', stage, artifacts: report };
        }
        await saveJSON(path.join(job, 'review/render-verification.json'), {
          ok: true,
          sourceHash,
          sha256,
          report,
        });
      }
      await saveJSON(path.join(job, 'review/archon-technical.json'), {
        status: 'complete',
        sourceHash,
        videoSha256: sha256,
      });
      artifacts = await qualifyKai(job);
    }
    if (stage === 'deliver') {
      const approval = await gate('film', ctx);
      if (approval.required && !approval.approved) throw new Error('Current user film approval required');
      artifacts = await qualifyKai(job);
      await saveJSON(path.join(job, 'review/delivery.json'), artifacts);
      const manifest = await readJSON(path.join(job, 'job.json'));
      manifest.status = 'complete';
      manifest.delivery = artifacts;
      await saveJSON(path.join(job, 'job.json'), manifest);
    }
  } else artifacts = await stageOperation(stage, ctx, options);
  if (artifacts === undefined) throw new Error(`Unknown Kai operation: ${stage}`);
  return { version: 1, status: 'complete', stage, artifacts };
}
export async function emit(stage, options = {}) {
  console.log = (...args) => console.error(...args);
  try {
    const result = await run(stage, process.env.INPUTS_PROJECT, options);
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status === 'repair' && !options.route) process.exitCode = 2;
  } catch (error) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'error', stage, error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log = (...args) => console.error(...args);
  try {
    const [stage, slug, arg] = process.argv.slice(2),
      result = await run(stage, slug, arg && arg !== '--route' ? JSON.parse(arg) : {});
    process.stdout.write(JSON.stringify(result) + '\n');
    if (
      (stage.endsWith('-check') && !result.artifacts.done) ||
      (result.status === 'repair' && !process.argv.includes('--route'))
    )
      process.exitCode = 2;
  } catch (error) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'error', error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
