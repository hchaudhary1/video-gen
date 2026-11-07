#!/usr/bin/env node
import { assertAudioReview } from './audio-review.mjs';
// Direct explainroo operations. Archon YAML exclusively owns the production lifecycle.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile, readdir, stat, cp, rm } from 'node:fs/promises';
import { createProject, loadProject } from '../../lib/project.mjs';
import { freezePersonality, readPersonality } from '../../lib/personalities.mjs';
import { fileHash, sourceFingerprint, loadReviewPack, reviewStatus, deliveryReviewFields } from '../../lib/review.mjs';
import { stageOperation, saveJSON, readJSON, digest, gate, scriptBinding, scriptFixAllowed, recordScriptRevision, scriptPassedAfterRevision } from './stages.mjs';
import { acceptBuild, buildUsable, recordContinuation, listContinuations, continuationLimitations } from '../../lib/acceptance.mjs';
import { getTheme } from '../../engines/explainroo/engine/themes.js';
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
export function validateEngineChecks(report, { audioReviewed = false, layoutAdvisory = false } = {}) {
  if (!Array.isArray(report?.issues)) throw new Error('Engine check report missing issues');
  return !report.issues.some((i) => {
    if (audioReviewed && /^the voice check could not confirm /.test(i.message || '')) return false;
    if (layoutAdvisory && i.level === 'warn') return false;
    return ['error', 'warn'].includes(i.level);
  });
}
export async function kaiFontIssues(p) {
  const builtin = await readJSON(path.join(ENGINE, 'fonts/fonts.json'));
  const faces = [...builtin, ...(p.config.fonts || [])];
  const theme = getTheme(p.config.theme, p.config.look);
  const supports = (face, weight) => {
    const range = String(face.weight ?? 400).split(/\s+/).map(Number);
    return range.length === 1 ? range[0] === weight : weight >= range[0] && weight <= range[1];
  };
  const issues = [];
  for (const face of p.config.fonts || []) {
    if (!await exists(path.join(p.dir, face.src)))
      issues.push({ level: 'error', message: `Missing local font ${face.src}; restore the actual font asset.` });
  }
  for (const [role, font] of Object.entries(theme.fonts)) {
    if (font.weight < 700 || ![700, font.weight].every(weight =>
      faces.some(face => face.family === font.family && supports(face, weight))))
      issues.push({ level: 'error', message:
        `Font ${role}: ${font.family} ${font.weight} needs actual loaded heavy faces (700 and the selected weight); use the provisioned Production Inter 700/800.` });
  }
  return issues;
}
// `fatal` problems make the file unusable as this film (no streams, wrong canvas, a
// truncated render or essentially missing speech) and stop production. `issues` route to
// the one technical fix round and are disclosed when they remain afterwards.
export function verificationProblems(report, manifest) {
  const fatal = [], issues = [];
  if (!report?.video || !report.audio) return { fatal: ['Final video and audio streams required'], issues };
  if (!Number.isFinite(report.duration) || report.duration <= 0)
    return { fatal: ['Finite measured duration required'], issues };
  if (report.video.width !== manifest.width || report.video.height !== manifest.height)
    fatal.push('Final canvas or duration differs from measured Kai timeline');
  else if (Math.abs(report.duration - manifest.duration) > 1)
    fatal.push('Final canvas or duration differs from measured Kai timeline');
  else if (Math.abs(report.duration - manifest.duration) > 0.12)
    issues.push('Final canvas or duration differs from measured Kai timeline');
  const rate = String(report.video.fps || '').split('/').map(Number);
  if (!Number.isFinite(rate[0] / (rate[1] || 1)) || Math.abs(rate[0] / (rate[1] || 1) - manifest.fps) > 0.01)
    fatal.push('Final frame rate differs from saved canvas');
  if (!Number.isFinite(report.speech?.matchRate) || report.speech.matchRate < 0.5)
    fatal.push('Final-mix speech verification failed');
  else if (
    report.speech.matchRate < 0.85 ||
    !Array.isArray(report.speech.scenes) ||
    !report.speech.scenes.length ||
    report.speech.scenes.some((s) => !Number.isFinite(s.matchRate) || s.matchRate < 0.8) ||
    (manifest.speechScenes &&
      JSON.stringify([...manifest.speechScenes].sort()) !==
        JSON.stringify(report.speech.scenes.map((s) => s.id).sort()))
  )
    issues.push('Final-mix speech verification failed');
  if (!validateEngineChecks(report)) issues.push('Encoded media checks have unresolved warnings/errors');
  return { fatal, issues };
}
export function validateEngineVerification(report, manifest) {
  const { fatal, issues } = verificationProblems(report, manifest);
  if (fatal.length || issues.length) throw new Error([...fatal, ...issues][0]);
  return true;
}
async function wordCount(p) {
  return p.script.scenes.reduce((n, sc) => n + sc.units.filter((u) => u.type === 'word').length, 0);
}
// Earlier takes are retained, never deleted, when an accepted script fix replaces them
// before production starts.
async function archiveNarration(job) {
  const target = path.join(job, 'review/narration-attempts', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(target, { recursive: true });
  for (const rel of ['build/voice', 'build/timeline.json', 'script.md', 'review/kai-narration.json',
    'review/kai-narration-inputs.json', 'review/audio-review.json'])
    if (await exists(path.join(job, rel))) await cp(path.join(job, rel), path.join(target, rel), { recursive: true });
  for (const rel of ['review/kai-narration.json', 'review/kai-narration-inputs.json', 'review/audio-review.json'])
    await rm(path.join(job, rel), { force: true });
  return target;
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
export async function initializeEngine(ctx, e) {
  const { job, dir, project } = ctx;
  // job.json is committed last. A video.json alone is a partial initialization,
  // not a usable project. Never repair it by replacing an existing take.
  if (await exists(path.join(job, 'job.json'))) return e.loadProject(job);
  if (await exists(path.join(job, 'build/timeline.json')) ||
      await exists(path.join(job, 'review/kai-narration.json')) ||
      (await readdir(path.join(job, 'build/voice')).catch(error => {
        if (error.code === 'ENOENT') return [];
        throw error;
      })).length)
    throw new Error('Incomplete Kai initialization contains narration; preserve takes before recovery.');
  // Parse before writing any engine files, including on crash recovery.
  const { parseScript } = await import(`${ENGINE}/src/script.js`);
  parseScript(await readFile(path.join(dir, 'SCRIPT.md'), 'utf8'));
  await mkdir(path.join(job, 'assets'), { recursive: true });
  await mkdir(path.join(job, 'review'), { recursive: true });
  const tpl = path.join(ENGINE, 'templates/kai');
  for (const f of await readdir(tpl))
    if ((f.endsWith('.json') || f === 'scenes.js') && !await exists(path.join(job, f)))
      await copyFile(path.join(tpl, f), path.join(job, f));
  const defaults = await readJSON(path.join(job, 'video.json'));
  const config = {
    ...defaults,
    title: project.slug,
    size: { landscape: '16:9', vertical: '9:16', square: '1:1' }[project.format || 'landscape'],
    captions: true,
  };
  // Pinned local dependency, no runtime font search/download or synthetic bold.
  const fontDir = path.join(job, 'assets/fonts');
  await mkdir(fontDir, { recursive: true });
  const fonts = [];
  for (const weight of [700, 800]) {
    const name = `inter-latin-${weight}-normal.woff2`;
    await copyFile(path.join(ROOT, 'node_modules/@fontsource/inter/files', name), path.join(fontDir, name));
    fonts.push({ family: 'Production Inter', src: `assets/fonts/${name}`, weight });
  }
  await copyFile(path.join(ROOT, 'node_modules/@fontsource/inter/LICENSE'), path.join(fontDir, 'Inter-LICENSE.txt'));
  await writeFile(path.join(fontDir, 'PROVENANCE.md'),
    'Inter 700/800 from pinned @fontsource/inter 5.3.0, SIL OFL. Loaded locally at natural proportions.\n');
  config.fonts = [...(config.fonts || []).filter(f => f.family !== 'Production Inter'), ...fonts];
  const look = await readJSON(path.join(job, 'kai.json'));
  look.fonts = Object.fromEntries(['display', 'body', 'hand', 'mono'].map(role =>
    [role, { family: 'Production Inter', weight: 800 }]));
  await saveJSON(path.join(job, 'kai.json'), look);
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
  if ((!technical.ok && !technical.accepted) || technical.sha256 !== videoSha256 || technical.sourceHash !== receipt.sourceHash)
    throw new Error('Current final verification required');
  if (technical.ok) validateEngineVerification(technical.report, manifest);
  else if (verificationProblems(technical.report, manifest).fatal.length)
    throw new Error(verificationProblems(technical.report, manifest).fatal[0]);
  const continuations = await listContinuations(job);
  const scriptRevision = await optional(path.join(ctx.dir, 'archon/script-revision.json'));
  const scriptAccepted = scriptRevision?.binding === (await scriptBinding(ctx.dir)) ? scriptRevision : null;
  return {
    version: 1,
    ok: true,
    engine: 'explainroo',
    sourceHash: receipt.sourceHash,
    videoSha256,
    packSha256: reviews.packSha256,
    reviewedSourceHash: reviews.reviewedSourceHash,
    revisionNotes: "review/revision-notes.md",
    ...deliveryReviewFields(reviews),
    reviewerIds: reviews.reports.map((r) => r.reviewer.agentId),
    limitations: [
      ...reviews.reports.flatMap((r) => r.inspection.limitations),
      ...(reviews.limitations || []),
      ...(technical.limitations || []),
      ...continuationLimitations(continuations),
      ...(scriptAccepted && !scriptPassedAfterRevision(scriptAccepted) ? [`Script continued without a passing review (${scriptAccepted.mode}): ${scriptAccepted.reason}`] : []),
      'Engine speech checks are ASR measurements; no listening or naturalness judgment is established.',
    ],
    continuations,
    scriptAcceptance: !scriptAccepted ? { mode: 'passed', passed: true }
      : { mode: scriptPassedAfterRevision(scriptAccepted) ? 'passed-after-revision' : scriptAccepted.mode,
          passed: scriptPassedAfterRevision(scriptAccepted), reason: scriptAccepted.reason },
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
    // `final` is the attempt after the one fix round: it keeps whatever duration it measures.
    const final = options.final === true;
    const e = media || (await engine());
    const engineScript = path.join(job, 'script.md');
    const scriptHash = await fileHash(path.join(dir, 'SCRIPT.md'));
    const repair = await optional(path.join(job, 'review/narration-repair.json'));
    // The fix node edited SCRIPT.md in response to a narration or audio repair; bind that
    // revision so the changed text continues without another script review.
    if (repair && !repair.recorded && (await exists(engineScript)) &&
        repair.scriptSha256 === (await fileHash(engineScript)) && scriptHash !== repair.scriptSha256) {
      await recordScriptRevision(ctx, { mode: `${repair.reason}-fix`, reason: repair.detail, priorBinding: repair.binding });
      await saveJSON(path.join(job, 'review/narration-repair.json'), { ...repair, recorded: true });
    }
    const ready = await stageOperation('script-ready', ctx, {}),
      approval = await gate('script', ctx);
    if (!ready.done || (approval.required && !approval.approved))
      throw new Error('Current independently reviewed and requested approved script required');
    let p = await initializeEngine(ctx, e);
    if (scriptHash !== (await fileHash(engineScript))) {
      // Only before production: once a director is registered the take is approved input.
      const manifest = await readJSON(path.join(job, 'job.json'));
      if (manifest.review?.producerAgentIds?.length) throw new Error('Engine script differs from approved script');
      await archiveNarration(job);
      await copyFile(path.join(dir, 'SCRIPT.md'), engineScript);
      p = e.loadProject(job);
    }
    const prior = await optional(path.join(job, 'review/kai-narration.json'));
    if (prior) await assertNarration(ctx, p, e);
    else {
      const inputs = await narrationKey(ctx, p);
      const pendingFile = path.join(job, 'review/kai-narration-inputs.json');
      const pending = await optional(pendingFile);
      if (pending && pending.inputs !== inputs)
        throw new Error('Narration inputs changed after generation started; preserve existing takes.');
      await saveJSON(pendingFile, { version: 1, inputs });
      const { timeline } = await e.prepare(p);
      const spoken = p.script.scenes.filter((sc) => sc.units.some((u) => u.type === 'word'));
      if (!spoken.length) throw new Error('Kai requires narrated scenes');
      const manifest = await readJSON(path.join(job, 'job.json'));
      manifest.duration = timeline.duration;
      manifest.speechScenes = spoken.map((sc) => sc.id);
      manifest.status = 'prepared';
      await saveJSON(path.join(job, 'job.json'), manifest);
      const target = project.duration, tolerance = Math.max(2, (target || 0) * 0.2);
      const miss = Boolean(target) && Math.abs(timeline.duration - target) > tolerance;
      const detail = miss
        ? `Measured narration is ${timeline.duration.toFixed(1)} s against the ${target} s target (accepted ${(target - tolerance).toFixed(0)}–${(target + tolerance).toFixed(0)} s).`
        : null;
      if (miss && !final && !project.audio && scriptFixAllowed(project)) {
        const words = await wordCount(p);
        const artifacts = { reason: 'duration', detail, measured: timeline.duration, target, tolerance, words,
          targetWords: Math.round((words * target) / timeline.duration),
          scriptSha256: await fileHash(engineScript), binding: await scriptBinding(dir) };
        await saveJSON(path.join(job, 'review/narration-repair.json'), { version: 1, ...artifacts });
        return { version: 1, status: 'repair', stage, artifacts };
      }
      if (miss) await recordContinuation(job, { stage: 'narration-duration', binding: inputs, reason: detail });
      await saveJSON(path.join(job, 'review/kai-narration.json'), {
        version: 1,
        inputs,
        outputs: await voiceFiles(p, e),
        timing: await timingBinding(job),
        duration: timeline.duration,
        ...(miss ? { durationMiss: detail } : {}),
      });
    }
    artifacts = { duration: (await readJSON(path.join(job, 'job.json'))).duration };
  } else if (stage === 'audio-review') {
    // A low-coverage take gets one script fix (respelling for the speech engine) and one
    // regeneration. Supplied recordings and protected scripts go straight to the final check.
    const fixable = !project.audio && scriptFixAllowed(project);
    const result = await stageOperation('audio-review', ctx, { final: options.final === true || !fixable });
    if (result.status === 'repair') {
      const weak = result.measurements.filter((m) => m.matchRate < result.threshold).map((m) => m.scene);
      const artifacts = { reason: 'audio', detail: `Speech coverage below ${result.threshold * 100}% in: ${weak.join(', ')}.`,
        scenes: weak, scriptSha256: await fileHash(path.join(job, 'script.md')), binding: await scriptBinding(dir) };
      await saveJSON(path.join(job, 'review/narration-repair.json'), { version: 1, ...artifacts });
      return { version: 1, status: 'repair', stage, artifacts };
    }
    artifacts = result;
  } else if (['build', 'preview', 'freeze', 'render', 'verify', 'deliver'].includes(stage)) {
    const e = media || (await engine()),
      p = e.loadProject(job);
    await assertNarration(ctx, p, e);
    await assertAudioReview(ctx);
    if (stage === 'build') {
      const sourceHash = await sourceFingerprint(job);
      const cached = await optional(path.join(job, 'review/build.json'));
      const fontIssues = await kaiFontIssues(p);
      if (!fontIssues.length && cached?.scope === 'all' && (await buildUsable(job, cached, sourceHash)))
        return { version: 1, stage, status: 'complete', artifacts: cached };
      // `final` is the build after the one technical repair round: remaining check issues
      // are accepted and disclosed, but a film the engine cannot load still stops here.
      const final = options.final === true;
      let report;
      try {
        report = fontIssues.length ? { issues: fontIssues } : await e.check(p, { viewWidth: 854 });
      } catch (error) {
        // A missing scene export is a repairable production-authorship defect.
        // Return it through the build adapter so the Archon scene-author node
        // can repair the module instead of failing the enclosing workflow.
        if (/scenes\.js has no function for scene/.test(String(error?.message || error)) ||
            /^engine (failed to start|page error):/.test(String(error?.message || error)) ||
            ['SyntaxError', 'ReferenceError', 'TypeError'].includes(error.name)) {
          const sourceHash = await sourceFingerprint(job);
          artifacts = { ok: false, scope: 'all', sourceHash, report: null, error: String(error.message || error) };
          await saveJSON(path.join(job, 'review/build.json'), artifacts);
          if (final) throw new Error(`Build is unusable after its technical repair round: ${artifacts.error}`);
          return { version: 1, stage, status: 'repair', artifacts };
        }
        throw error;
      }
      const ok = validateEngineChecks(report, { audioReviewed: true, layoutAdvisory: true });
      artifacts = { ok, scope: 'all', sourceHash: await sourceFingerprint(job), report };
      await saveJSON(path.join(job, 'review/build.json'), artifacts);
      if (!ok && final) {
        if (fontIssues.length) throw new Error(`Heavy fonts are still unavailable after the repair round: ${fontIssues.map((i) => i.message).join('; ')}`);
        const issues = report.issues.filter((i) => ['error', 'warn'].includes(i.level)).map((i) => i.message || String(i));
        artifacts.acceptance = await acceptBuild(job, { sourceHash: artifacts.sourceHash, issues });
        return { version: 1, stage, status: 'complete', artifacts };
      }
      return { version: 1, stage, status: ok ? 'complete' : 'repair', artifacts };
    }
    if (stage === 'preview') {
      const build = await readJSON(path.join(job, 'review/build.json')),
        sourceHash = await sourceFingerprint(job);
      if (!(await buildUsable(job, build, sourceHash)))
        throw new Error('Current usable build required before preview');
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
      if (!(await buildUsable(job, build, await sourceFingerprint(job))))
        throw new Error('Current usable build required');
      try {
        artifacts = (await loadReviewPack(job, 'final')).pack;
      } catch {
        const timeline = await readJSON(path.join(job, 'build/timeline.json'));
        const frames = await e.stills(p, []);
        // One temporal sheet per scene, about twelve tiles each, so a reviewer can
        // inspect and record every scene's full span rather than one unreadable film-wide sheet.
        const sheets = [];
        for (const sc of timeline.scenes)
          sheets.push({
            scene: sc,
            file: (await e.sheet(p, { scene: sc.id, every: Math.max(1, Math.ceil(sc.dur / 12)) })).file,
          });
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
        for (const { scene, file } of sheets)
          await add(
            file,
            'contact-sheet',
            scene.start,
            Math.min(scene.start + scene.dur, timeline.duration),
          );
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
      // `final` is verification after the one technical fix round: remaining issues are
      // accepted and disclosed; fatal problems (no streams, wrong canvas, truncated render,
      // missing speech) still stop production.
      const final = options.final === true;
      const sourceHash = await sourceFingerprint(job),
        sha256 = await fileHash(path.join(job, 'renders/video.mp4')),
        prior = await optional(path.join(job, 'review/render-verification.json')),
        manifest = await readJSON(path.join(job, 'job.json'));
      if ((prior?.ok || prior?.accepted) && prior.sourceHash === sourceHash && prior.sha256 === sha256) {
        if (prior.ok) validateEngineVerification(prior.report, manifest);
      } else {
        const report = await e.verify(p, { file: path.join(job, 'renders/video.mp4') });
        const { fatal, issues } = verificationProblems(report, manifest);
        if (fatal.length) throw new Error(fatal[0]);
        if (issues.length && !final) {
          await saveJSON(path.join(job, 'review/archon-technical.json'), {
            status: 'repair',
            sourceHash,
            videoSha256: sha256,
            issues,
            report,
          });
          // Operator-approved film sources are not changed by an automated fix.
          const fixable = !(await gate('film', ctx)).required;
          return { version: 1, status: 'repair', stage, artifacts: { issues, fixable, report } };
        }
        if (issues.length)
          await recordContinuation(job, { stage: 'verify', binding: sha256,
            reason: `Final verification issues remained after the technical fix round: ${issues.join('; ')}.` });
        await saveJSON(path.join(job, 'review/render-verification.json'), {
          ok: !issues.length,
          ...(issues.length ? { accepted: true, issues,
            limitations: issues.map((i) => `Final verification after the fix round: ${i}`) } : {}),
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
      // `fixable` is always present: YAML `when:` field references fail on a missing key.
      artifacts = { ...(await qualifyKai(job)), fixable: false };
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
  return { version: 1, status: artifacts?.status === 'repair' ? 'repair' : 'complete', stage, artifacts };
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
