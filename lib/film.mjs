
// Native compositions, measured narration and frozen review evidence → verified delivery.
// Media operations are called by Archon nodes.
import {readFile, writeFile, mkdir, access, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeWords, browserCues} from './timing.mjs';
import {compileFilm, validateFilm, SpecError, storyboardMarkdown} from './composition.mjs';
import {writeRoot, installRuntime} from './composition.mjs';
import {mixdown} from './audio.mjs';
import {soundCheck} from './audio.mjs';
import {inspectFilm, writeInspection, openInspector} from './native.mjs';
import {pixelChecks} from './pixels.mjs';
import {lintJob, removeRenderTempFiles} from './native.mjs';
import {sourceFingerprint, fileHash, reviewProgress} from './review.mjs';
import {verifyLibraryCopies} from './assets.mjs';
import {readPersonality, assertRenderReady} from './personalities.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = process.env.VG_LIBRARY || path.join(ROOT, 'library');
const json = async f => JSON.parse(await readFile(f, 'utf8'));
const save = (f, v) => writeFile(f, JSON.stringify(v, null, 2) + '\n');
const exists = async f => { try { await access(f); return true; } catch { return false; } };
const jr = job => path.relative(ROOT, job);

export async function context(job) {
  assertRenderReady(readPersonality(job));
  const manifest = await json(path.join(job, 'job.json')), alignment = await json(path.join(job, 'alignment.json'));
  normalizeWords(alignment.words, manifest.duration);
  if (manifest.audio?.sha256 && await fileHash(path.join(job, 'assets/narration.wav')) !== manifest.audio.sha256)
    throw new Error('Narration changed since preparation. Create a new job instead of reusing stale timings.');
  if (alignment.matchRatio < 0.85 && !(alignment.review?.approved && alignment.review.note?.trim()))
    throw new Error(`Script match is only ${(alignment.matchRatio * 100).toFixed(0)}%. Inspect alignment.json discrepancies, retain an evidence-based alignment.review decision in alignment.json before continuing`);
  return {manifest, alignment};
}
// One independent visual review followed by one recorded author revision.

export function printSpecError(error) {
  console.error(`\n${error.errors.length} error(s):`);
  for (const e of error.errors) console.error(`  ✗ ${e}`);
  if (error.warnings?.length) { console.error(`\n${error.warnings.length} warning(s):`); for (const w of error.warnings) console.error(`  ! ${w}`); }
}

export async function planCheck(job) {
  const {manifest, alignment} = await context(job);
  const film = await json(path.join(job, 'film.json')).catch(e => { throw new SpecError([`film.json: ${e.code === 'ENOENT' ? 'missing' : 'invalid JSON: ' + e.message}`]); });
  const {scenes, warnings} = validateFilm(film, alignment, manifest.duration);

  const timing = {scenes: scenes.map(s => ({...s, kind: film.scenes.find(x => x.id === s.id).kind || 'shots'}))};
  // Same storyboard as build writes (including builder notes): it is a source file, so the two must agree
  // or every plan-check would make the last build look stale.
  for (const s of timing.scenes) {
    const shot = await json(path.join(job, `shots/${s.id}.json`)).catch(() => null);
    if (typeof shot?.notes === 'string' && shot.notes.trim()) s.notes = shot.notes;
  }
  await writeFile(path.join(job, 'STORYBOARD.md'), storyboardMarkdown(film, timing));
  console.log(`Plan valid: ${scenes.length} scenes.`);
  for (const s of scenes) console.log(`  ${s.id.padEnd(22)} ${s.start.toFixed(2).padStart(7)}–${s.end.toFixed(2).padEnd(7)} (${s.duration.toFixed(1)}s) ${sceneOwner(film, s.id)}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  return {film, scenes};
}

/** Compile + assemble + inspect. Returns {ok, errors, warnings, timing}. */
export async function buildFilm(job, {scene = null, allowMissing = null, inspect = true, print = true} = {}) {
  const {manifest, alignment} = await context(job);
  const film = await json(path.join(job, 'film.json'));
  if (allowMissing == null) allowMissing = false;
  await installRuntime(job);
  let compiled;
  try { compiled = await compileFilm(job, film, alignment, manifest, {allowMissing}); }
  catch (error) {
    if (!(error instanceof SpecError)) throw error;
    const errs = scene ? error.errors.filter(e => e.includes(`shots/${scene}.`) || e.includes(`components/`) || !/shots\//.test(e)) : error.errors;
    await save(path.join(job, 'review/build.json'), {ok: false, sourceHash: null, errors: error.errors, warnings: error.warnings});
    if (print) printSpecError({errors: errs.length ? errs : error.errors, warnings: error.warnings.filter(w => !scene || w.includes(scene))});
    return {ok: false, errors: error.errors, warnings: error.warnings};
  }
  const {world, timing, warnings} = compiled;
  await save(path.join(job, 'timing.json'), timing);
  await writeFile(path.join(job, 'assets/cues.js'), `/* Generated from measured words and film.json/shots; do not hand-edit. */\nwindow.VideoCues = ${JSON.stringify(browserCues(timing), null, 2)};\n`);
  await save(path.join(job, 'assets/media-plan.json'), world);
  await writeRoot(job, manifest, timing, film);
  await writeFile(path.join(job, 'STORYBOARD.md'), storyboardMarkdown(film, timing));
  await mkdir(path.join(job, 'review'), {recursive: true});
  await writeFile(path.join(job, 'review/sounds.md'), soundTranscript(world));
  let result = {errors: [], warnings: [], report: null, transcript: ''};
  if (inspect) {
    try { result = await inspectFilm(job, manifest, timing, {scope: scene ? [scene] : null}); }
    catch (error) { if (!error.browser) throw error; result.errors = [error.message]; }
    await writeInspection(job, result);
  }
  const allErrors = [...result.errors], allWarnings = [...warnings, ...result.warnings];
  // HyperFrames lint runs here, not only at render, so its errors go to the scene's owner like any other check.
  let pipelineErrors = [];
  if (inspect && !scene) {
    const lint = await lintJob(job, film);
    allErrors.push(...lint.errors); allWarnings.push(...lint.warnings); pipelineErrors = lint.pipeline;
  }
  const sourceHash = await sourceFingerprint(job);
  const ok = !allErrors.length && !pipelineErrors.length;
  await save(path.join(job, 'review/build.json'), {ok, scope: scene || 'all', missing: timing.missing, sourceHash, errors: allErrors, pipelineErrors, warnings: allWarnings, report: result.report});
  if (print) {
    if (result.transcript) {
      const t = scene ? sliceTranscript(result.transcript, scene) : result.transcript;
      console.log(t.length > 12000 ? t.slice(0, 12000) + `\n… (full transcript: ${jr(job)}/review/motion.md)` : t);
    }
    const sounds = world.sounds.filter(x => !scene || x.scene === scene);
    if (sounds.length) console.log(`\nSound effects: ${sounds.length} placed${scene ? ` in ${scene}` : ''} (${jr(job)}/review/sounds.md).`);
    for (const w of allWarnings.filter(w => !scene || w.includes(scene) || !/\[|shots\//.test(w))) console.log(`  ! ${w}`);
    for (const e of allErrors) console.log(`  ✗ ${e}`);
    for (const e of pipelineErrors) console.log(`  ✗ PIPELINE BUG (generated code, not an agent's file): ${e}`);
    console.log(`\nBuild ${ok ? 'OK' : 'FAILED'}: ${allErrors.length + pipelineErrors.length} error(s), ${allWarnings.length} warning(s)${timing.missing.length ? `; scenes not built yet: ${timing.missing.join(', ')}` : ''}.`);
  }
  return {ok, errors: allErrors, pipelineErrors, warnings: allWarnings, timing, sourceHash};
}
/** Plain-text sound plan: every sound effect, the music and how the big moves sit on its beat (reviewers cannot hear). */
export function soundTranscript(world = {}) {
  const sounds = world.sounds || [], moves = world.moves || [], music = world.music;
  const out = ['# Sound', ''];
  if (!sounds.length && !music) return out.concat(['None. The soundtrack is the narration alone.', '']).join('\n');
  out.push(`Narration: unprocessed, always the loudest. ${sounds.length} sound effect(s). Music: ${music ? `${music.src} (${music.tempo} BPM, from ${music.trackStart}s of the track at film ${music.filmStart}s), ducked under the voice` : 'none'}.`, '');
  if (sounds.length) out.push('## Sound effects', '', '| lands at (s) | plays (s) | scene | sound | align | volume | vs voice | why |', '|---|---|---|---|---|---|---|---|',
    ...sounds.slice().sort((a, b) => a.at - b.at).map(s => `| ${s.at.toFixed(2)} | ${s.start.toFixed(2)}–${(s.start + (s.playDuration ?? s.duration)).toFixed(2)} | ${s.scene} | ${s.src.replace(/^assets\//, '')} | ${s.align} | ${s.volume} | ${s.masking ? `may mask voice at ${s.masking.at}s` : 'clear'} | ${(s.why || '—').replace(/\|/g, '/')} |`), '');
  const rows = music?.moves || moves;
  if (rows.length) out.push('## Cuts and big moves', '', `| at (s) | scene | move | sound wanted | has a sound | ${music ? 'nearest beat |' : ''}`, `|---|---|---|---|---|${music ? '---|' : ''}`,
    ...rows.map(m => `| ${m.t.toFixed(2)} | ${m.scene} | ${m.what} | ${m.sound} | ${moves.find(x => x.t === m.t && x.what === m.what)?.sounded ? 'yes' : 'no'} | ${music ? `${m.beatDelta >= 0 ? '+' : ''}${(m.beatDelta * 1000).toFixed(0)} ms${Math.abs(m.beatDelta) <= 0.05 ? ' ✓' : ''} |` : ''}`), '');
  return out.join('\n');
}
function sliceTranscript(t, scene) { const parts = t.split(/\n(?=## )/); return [parts[0], ...parts.filter(p => p.startsWith(`## ${scene} `))].join('\n'); }

export async function snapshot(job, {scene, at}) {
  const {manifest} = await context(job), timing = await json(path.join(job, 'timing.json'));
  const s = scene ? timing.scenes.find(x => x.id === scene) : null;
  if (scene && !s) throw new Error(`Unknown scene ${scene}`);
  let times = at ? String(at).split(',').map(Number) : [];
  if (!times.length) { const a = s ? s.start : 0, b = s ? s.end : manifest.duration, n = Math.max(4, Math.min(10, Math.round((b - a) / 1.5))); for (let i = 0; i < n; i++) times.push(Number((a + (b - a) * (i + 0.5) / n).toFixed(2))); }
  const ins = await openInspector(job, manifest), files = [];
  try { for (const t of times) { const f = path.join(job, 'review/snapshots', `${scene || 'film'}-${t.toFixed(2)}s.png`); await ins.screenshot(t, f); files.push(f); } }
  finally { await ins.close(); }
  console.log(files.join('\n'));
  return files;
}

export async function filmAudit(job, {allowBuildErrors = false} = {}) {
  assertRenderReady(readPersonality(job));
  const errors = [...await verifyLibraryCopies(job)], warnings = [];
  const root = await readFile(path.join(job, 'index.html'), 'utf8').catch(() => '');
  if (!root.includes('assets/narration.wav')) errors.push('index.html missing narration; run build');
  const build = await json(path.join(job, 'review/build.json')).catch(() => null);
  if (!build) errors.push('No build record; run build.');
  else { if (!build.ok && !allowBuildErrors) errors.push(`Last build has ${build.errors.length} error(s); fix them and rebuild.`); if (build.sourceHash !== await sourceFingerprint(job)) errors.push('Sources changed since the last build; run build again.'); }
  const report = {ok: !errors.length, errors, warnings};
  await save(path.join(job, 'review/audit.json'), report);
  if (errors.length) { for (const e of errors) console.error(`  ✗ ${e}`); throw new Error('Pipeline audit failed.'); }
  return report;
}

// Two capture workers, out of HyperFrames' low-memory mode (it pins machines with 8 GB or less to one). If that
// render fails, it is retried once with the renderer's own safe defaults.
const DEFAULT_WORKERS = '2';
async function captureFrames(job, hf, {quality, fps, workers, composition}) {
  const base = ['render', '--quality', quality, '--fps', String(fps), '--output', 'renders/picture.mp4', ...(composition ? ['--composition', composition] : []), '--quiet'];
  const chosen = workers ?? process.env.VIDEO_RENDER_WORKERS ?? DEFAULT_WORKERS;
  const many = chosen !== 'auto' && Number(chosen) > 1;
  try { await hf([...base, '--workers', String(chosen), ...(many ? ['--no-low-memory-mode'] : [])], {cwd: job}); }
  catch (error) {
    if (!many) throw error;
    console.log(`Render with ${chosen} workers failed (${error.message}); retrying with the renderer's low-memory defaults.`);
    await hf(base, {cwd: job});
  }
}

export async function renderFilm(job, {hf, verify, quality = 'delivery', force = false, reuseBuild = false, workers}) {
  if (workers != null && workers !== 'auto' && (!Number.isInteger(Number(workers)) || Number(workers) < 1))
    throw new Error('Render workers must be a positive integer or auto.');
  assertRenderReady(readPersonality(job));
  let manifest = await json(path.join(job, 'job.json'));
  let built;
  if (reuseBuild) {
    built = await json(path.join(job, 'review/build.json')).catch(() => null);
    const timing = await json(path.join(job, 'timing.json')).catch(() => null);
    if (!built?.ok || built.scope !== 'all' || !Array.isArray(built.missing) || built.missing.length ||
        !Array.isArray(built.errors) || built.errors.length || !timing?.scenes?.length ||
        timing.missing?.length || !timing.scenes.every(s => built.report?.scenes?.[s.id]) ||
        built.sourceHash !== await sourceFingerprint(job))
      throw new Error('--reuse-build requires a current successful browser build of every scene. Run build first.');
    console.log(`Reusing current successful build: ${timing.scenes.length} scenes, 0 errors.`);
  } else built = await buildFilm(job, {print: true});
  manifest = await json(path.join(job, 'job.json'));
  if (!built.ok && !force) throw new Error('Build has errors; fix them before rendering (see above).');
  await filmAudit(job, {allowBuildErrors: force});
  const sourceHash = await sourceFingerprint(job);
  manifest.status = 'rendering'; delete manifest.completedAt; delete manifest.delivery; await save(path.join(job, 'job.json'), manifest);
  await removeRenderTempFiles(job);
  await hf(['lint'], {cwd: job}).catch(() => { throw new Error('HyperFrames lint failed (see above).'); });
  await captureFrames(job, hf, {quality, fps: manifest.fps, workers});
  // The soundtrack is mixed and mastered here (narration + sound effects + ducked music), then muxed and measured.
  const mixed = await mixdown(job, {world: await json(path.join(job, 'assets/media-plan.json')), film: await json(path.join(job, 'film.json')), manifest});
  await finishSound(job, mixed, verify);
  if (sourceHash !== await sourceFingerprint(job)) throw new Error('Sources changed during rendering. Render again.');
  const timing = await json(path.join(job, 'timing.json'));
  const scoped = {...timing, scenes: timing.scenes.filter(s => !(timing.missing || []).includes(s.id))};
  const pixels = await pixelChecks(path.join(job, 'renders/video.mp4'), scoped);
  const videoSha256 = await fileHash(path.join(job, 'renders/video.mp4'));
  const verifiedPixels = {...pixels, videoSha256, sourceHash};
  await save(path.join(job, 'review/pixels.json'), verifiedPixels);
  await save(path.join(job, 'review/render-source.json'), {version: 1, sourceHash, videoSha256});
  manifest.status = 'draft-rendered'; await save(path.join(job, 'job.json'), manifest);
  for (const e of verifiedPixels.errors) console.log(`  ✗ ${e}`);
  console.log(`Rendered ${jr(job)}/renders/video.mp4 (${verifiedPixels.errors.length} playback verification error(s)).`);
  return {pixels: verifiedPixels};
}

const mixLine = m => `Mix: ${m.integratedLufs} LUFS, peaks ${Math.max(m.truePeakDb, m.samplePeakDb, m.mono.truePeak, m.mono.samplePeak).toFixed(1)} dB (target ${m.target.integratedLufs} LUFS, peaks ≤ ${m.target.peakDb}; limited by the ${m.limitedBy}); ${m.soundEffects} sound effect(s)${m.music ? ', music' : ''}.`;
async function finishSound(job, mixed, verify) {
  console.log(mixLine(mixed));
  await verify(job);
  const listening = await soundCheck(job);
  if (listening.cues) console.log(`Sound evidence: ${listening.sheets.length} sheet(s), headphone checks in ${jr(job)}/review/sound/listen.md.`);
}

/** Re-mix the soundtrack onto the existing picture (after a pipeline update), when the sources have not changed. */
export async function remixFilm(job, {verify}) {
  assertRenderReady(readPersonality(job));
  const receipt = await json(path.join(job, 'review/render-source.json')).catch(() => null), sourceHash = await sourceFingerprint(job);
  if (!receipt || receipt.sourceHash !== sourceHash || !await exists(path.join(job, 'renders/picture.mp4')))
    throw new Error('mix needs an up-to-date render (renders/picture.mp4 from the current sources). Run render.');
  const manifest = await json(path.join(job, 'job.json'));
  const mixed = await mixdown(job, {world: await json(path.join(job, 'assets/media-plan.json')), film: await json(path.join(job, 'film.json')), manifest});
  await finishSound(job, mixed, verify);
  await save(path.join(job, 'review/render-source.json'), {version: 1, sourceHash, videoSha256: await fileHash(path.join(job, 'renders/video.mp4'))});
  return mixed;
}

export async function writeProductionReport(job) {
  const manifest = await json(path.join(job, 'job.json')), film = await json(path.join(job, 'film.json'));
  const build = await json(path.join(job, 'review/build.json')).catch(() => ({})), pixels = await json(path.join(job, 'review/pixels.json')).catch(() => ({}));
  const verification = await json(path.join(job, 'review/render-verification.json')).catch(() => ({}));
  const alignment = await json(path.join(job, 'alignment.json'));
  const review = await reviewProgress(job, 'final');
  const lines = [`# Production report — ${film.title}`, '', `- Recording: ${manifest.audio.source} from ${manifest.audio.sourceStart}s, ${manifest.duration.toFixed(2)}s recording; ${manifest.width}×${manifest.height} @ ${manifest.fps} fps`,
    `- Alignment: ASR word timestamps reconciled with the script (${(alignment.matchRatio * 100).toFixed(1)}% exact matches); not forced alignment. ${alignment.review?.note ? 'Review: ' + alignment.review.note : ''}`,
    `- Concept: ${film.concept}`, `- Scenes: ${film.scenes.map(s => s.id).join(', ')}`, '', '## Automated checks',
    `- Build/DOM inspection: ${build.ok ? 'pass' : 'FAIL'} (${(build.errors || []).length} errors, ${(build.warnings || []).length} warnings)`,
    ...Object.entries(build.report?.scenes || {}).map(([id, r]) => `  - ${id}: frame use ${Math.round(r.frameUse * 100)}%, longest still ${r.longestStill}s, developing elements per 3 s: ${(r.windows || []).join(' ')}`),
    `- Pixel checks on the render: ${pixels.ok ? 'pass' : 'FAIL'}`, ...Object.entries(pixels.scenes || {}).map(([id, r]) => `  - ${id}: content box ${Math.round(r.contentBox * 100)}%, longest frozen ${r.longestFrozen}s`),
    `- Automatic speech: review/speech-narration.json and review/speech-final-mix.json (recognition only; no listening or naturalness judgment).`,
    `- Media verification: ${verification.ok ? 'pass' : 'missing'} (${verification.width}×${verification.height}, ${verification.fps}, ${verification.duration?.toFixed?.(2)}s, narration correlation ${verification.narrationIntegrity?.correlation?.toFixed?.(4)})`,
    '', '## Independent review',
    `- Disposition: ${review.disposition || 'pending'} (one review, one revision; no second inspection)`,
    ...(review.reports || []).flatMap(r => r.findings.filter(f => f.severity === 'blocking').map(f => `- Unresolved [${r.role} ${f.start}–${f.end}s]: ${f.subject}: ${f.observed}`)),
    '', '## Warnings', ...(build.warnings || []).map(w => `- ${w}`), '', '## Limitations',
    '- Still frames and the motion transcript do not prove motion quality; reviewers report their own inspection limits.', '- Cue times come from ASR estimates.', ''];
  await writeFile(path.join(job, 'review/REPORT.md'), lines.join('\n'));
}

// Not every failed build is a film defect. Missing tools, broken modules, browser launches and full disks need an
// environment fix; sending them to the director wastes a creative agent and can push it to edit the film around a bug.
const INFRASTRUCTURE = [
  /Cannot find module/i,
  /MODULE_NOT_FOUND/,
  /spawn (?:ffmpeg|ffprobe|chrome|chromium|google-chrome|uv|python3?)(?:\.exe)? ENOENT/i,
  /(?:ffmpeg|ffprobe|chrome|chromium)[^\n]{0,40}(?:not found|ENOENT|executable)/i,
  /failed to launch (?:the )?(?:browser|chrom)/i,
  /browserType\.launch/i,
  /Target page, context or browser has been closed/i,
  /node_modules[\\/]hyperframes/i,
  /(?:EACCES|EPERM|ENOSPC)/,
  /(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND)/,
  /ModuleNotFoundError|ImportError[^\n]*(?:librosa|cv2|numpy)/i,
  /(?:uv|python3?|ffmpeg): (?:command )?not found/i,
];

export function classifyFailure(errors) {
  const all = (errors || []).map(String).filter(Boolean);
  const infrastructure = all.filter(error => INFRASTRUCTURE.some(pattern => pattern.test(error)));
  const film = all.filter(error => !infrastructure.includes(error));
  return {isInfrastructure: infrastructure.length > 0, infrastructure, film, errors: all};
}
