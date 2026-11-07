#!/usr/bin/env node
// Deterministic stages of the `shorts` Archon workflow: measure the long-form video, check the
// agent's selection, place each clip on a 1080×1920 canvas, check, deliver and upload.
// The agent only chooses; this file measures, cuts, renders, records and uploads.
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir, copyFile, stat, readdir, rm, rename} from 'node:fs/promises';
import {saveJSON, readJSON, digest} from './stages.mjs';
import {recognizeSpeech, hashFile, ASR_MODEL} from '../../lib/speech.mjs';
import {youtubeUpload} from '../../lib/youtube-upload.mjs';
import {normalizeWords} from '../../lib/timing.mjs';
import {SHORT, CTA, LAYOUT_VERSION, unitsFromKai, unitsFromScenes, unitsFromWords, checkPlan, repairPlan, ends, edgeBackground, overlayHtml} from '../../lib/shorts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const optional = async f => readJSON(f).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
const exists = f => stat(f).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
const clock = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;

function run(cmd, args, {binary = false} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    const out = [];
    let err = '';
    child.stdout.on('data', d => out.push(d));
    child.stderr.on('data', d => { err = (err + d).slice(-4000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(binary ? Buffer.concat(out) : Buffer.concat(out).toString().trim())
      : reject(new Error(`${cmd} failed (${code}): ${err.trim().split('\n').slice(-3).join(' ')}`)));
  });
}
async function probe(file) {
  const info = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
  const v = info.streams.find(s => s.codec_type === 'video'), a = info.streams.find(s => s.codec_type === 'audio');
  const [n, d] = String(v?.avg_frame_rate || '30/1').split('/').map(Number);
  return {width: v?.width, height: v?.height, fps: d ? n / d : 30, audio: !!a, duration: Number(info.format.duration)};
}

function paths(slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('project must be a lowercase slug');
  const dir = path.join(ROOT, 'jobs', slug, 'shorts');
  const p = f => path.join(dir, f);
  return {dir, p, slug, request: p('request.json'), transcript: p('units.json'), plan: p('plan.json'),
    receipt: p('plan-receipt.json'), delivery: p('delivery.json'), published: p('published.json')};
}

// ---------------------------------------------------------------- prepare
async function freezeRequest(P, options) {
  const saved = await optional(P.request);
  if (saved) return saved;
  const inRepo = f => !path.relative(ROOT, f).startsWith('..');
  let video = options.video ? path.resolve(ROOT, options.video) : path.join(ROOT, 'jobs', P.slug, 'renders/video.mp4');
  if (!await exists(video)) throw new Error(`Source video not found: ${video}. Pass options.video.`);
  if (!inRepo(video)) { // Keep media inside the repository; the original file is left untouched.
    const copy = P.p(`source/${path.basename(video)}`);
    await mkdir(path.dirname(copy), {recursive: true});
    await copyFile(video, copy);
    video = copy;
  }
  const publishing = await optional(path.join(ROOT, 'jobs/scripts', P.slug, 'publishing.json'));
  const title = String(options.title || publishing?.title || '').trim();
  if (!title) throw new Error('No title: pass options.title (the full video\'s title).');
  const count = Number(options.count);
  if (!Number.isInteger(count) || count < 1) throw new Error('options.count must be a whole number of shorts (1 or more).');
  const request = {version: 1, video: path.relative(ROOT, video), title, accent: options.accent || null,
    count, cta: {...CTA, ...(options.cta || {})}, notes: options.notes || null,
    upload: options.upload !== false, channelId: options.channelId || publishing?.channelId || null,
    fullVideoUrl: options.fullVideoUrl || null, createdAt: new Date().toISOString()};
  if (request.upload && !/^UC[\w-]{22}$/.test(request.channelId || ''))
    throw new Error('Upload needs the exact channel ID: pass options.channelId, or "upload": false to keep the shorts local.');
  await saveJSON(P.request, request);
  return request;
}

// Speech units the agent selects from. A production's own measured timeline is used when the
// source is its render and the lengths agree; only an outside video is transcribed.
async function speechUnits(P, request, media) {
  const job = path.join(ROOT, 'jobs', P.slug), own = request.video === path.relative(ROOT, path.join(job, 'renders/video.mp4'));
  const agrees = d => Math.abs(d - media.duration) <= 0.5;
  if (own) {
    const kai = await optional(path.join(job, 'build/timeline.json'));
    if (kai?.scenes && agrees(kai.duration)) return {origin: 'jobs/' + P.slug + '/build/timeline.json (measured scenes)', units: unitsFromKai(kai)};
    const timing = await optional(path.join(job, 'timing.json')), words = await optional(path.join(job, 'transcript.json'));
    if (timing?.scenes && Array.isArray(words) && agrees(timing.duration))
      return {origin: 'jobs/' + P.slug + '/timing.json + transcript.json (measured scenes)', units: unitsFromScenes(timing.scenes, words)};
  }
  const raw = await recognizeSpeech(path.join(ROOT, request.video), P.p('work/asr.json'));
  return {origin: `${ASR_MODEL} (automated speech recognition)`, units: unitsFromWords(normalizeWords(raw, media.duration))};
}

async function measure(P, request) {
  const video = path.join(ROOT, request.video);
  const media = await probe(video);
  if (!media.width || !media.audio) throw new Error('Source needs a video and an audio stream.');
  if (media.width <= media.height) throw new Error(`Source is ${media.width}×${media.height}; shorts need a landscape (horizontal) video.`);
  const most = Math.floor(media.duration / SHORT.min);
  if (request.count > most)
    throw new Error(`${request.count} non-overlapping shorts of at least ${SHORT.min} s do not fit in ${media.duration.toFixed(0)} s (at most ${most}).`);
  const sourceSha256 = await hashFile(video);
  let t = await optional(P.transcript);
  if (t?.sourceSha256 !== sourceSha256) {
    const {origin, units} = await speechUnits(P, request, media);
    if (!units.length) throw new Error('No narrated speech found to select from.');
    t = {version: 2, origin, sourceSha256, duration: media.duration, units};
    await saveJSON(P.transcript, t);
  }
  // The selector's whole input: one compact text file, no images.
  const lines = [`# Shorts from: ${request.title}`, '',
    `Pick exactly ${request.count} shorts. Each runs ${SHORT.min}–${SHORT.max} s (aim 70–150) from the start of its first row to the end of its last; no two share a row.`,
    'Give each short its own specific title drawn from what it says (no clickbait, no claim it does not make). Open on a line that hooks a new viewer (a question, a surprising claim, a concrete problem), never on "so"/"and" or a callback. End on a finished thought. Prefer the most specific, surprising moments; skip intros, recaps and outros.',
    ...(request.notes ? ['', `Operator notes: ${request.notes}`] : []), '',
    'Write plan.json in source order:', '',
    '```json', '{"shorts": [{"from": "<first id>", "to": "<last id>", "title": "YouTube title for this short, under 90 characters", "why": "what it is about and why it stands alone"}]}', '```', '',
    `Rows (${t.origin}; times in seconds, "s" = speech length):`, '',
    'id | start | end | s | narration', '--- | --- | --- | --- | ---',
    ...t.units.map(u => `${u.id} | ${u.start.toFixed(1)} | ${u.end.toFixed(1)} | ${(u.end - u.start).toFixed(0)} | ${u.text}`)];
  await writeFile(P.p('SELECT.md'), lines.join('\n') + '\n');
  return {media, transcript: t};
}

async function planCurrent(P) {
  const [plan, receipt, t] = await Promise.all([optional(P.plan), optional(P.receipt), optional(P.transcript)]);
  return !!(plan && receipt?.valid && receipt.planSha256 === digest(plan) && receipt.sourceSha256 === t?.sourceSha256);
}

// ---------------------------------------------------------------- plan check
async function planCheck(P, {final = false} = {}) {
  const [request, t] = [await readJSON(P.request), await readJSON(P.transcript)];
  const opts = {count: request.count, duration: t.duration};
  let plan = await optional(P.plan);
  let result = checkPlan(plan, t.units, opts);
  let actions = [];
  if (final && result.errors.length) {
    await saveJSON(P.p('plan.agent.json'), plan ?? {});
    ({plan, actions} = repairPlan(plan, t.units, opts));
    await saveJSON(P.plan, plan);
    result = checkPlan(plan, t.units, {...opts, count: plan.shorts.length});
    if (!plan.shorts.length || result.errors.length)
      throw new Error(`No usable selection after the fix: ${[...actions, ...result.errors].join(' ')}`);
  }
  const valid = !result.errors.length;
  await saveJSON(P.p('plan-errors.json'), {errors: result.errors, repairs: actions});
  if (valid) await saveJSON(P.receipt, {valid, planSha256: digest(plan), sourceSha256: t.sourceSha256, repairs: actions,
    shorts: result.shorts.map(({ia, ib, ...s}) => s)});
  return {valid, errors: result.errors, repairs: actions, count: result.shorts.length};
}

// ---------------------------------------------------------------- render
async function sampleEdges(video, start, end, media) {
  const w = 192, h = Math.round(192 * media.height / media.width), samples = [];
  for (let i = 0; i < 9; i++) {
    const t = start + (end - start) * (i + 0.5) / 9;
    const px = await run('ffmpeg', ['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1',
      '-vf', `scale=${w}:${h}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], {binary: true});
    for (const row of [0, 1, h - 2, h - 1])
      for (let x = 0; x < w; x++) { const o = (row * w + x) * 3; samples.push([px[o], px[o + 1], px[o + 2]]); }
  }
  return edgeBackground(samples);
}

async function renderOverlay(browser, html, file) {
  const page = await browser.newPage();
  try {
    await page.setViewport({width: SHORT.width, height: SHORT.height, deviceScaleFactor: 1});
    const doc = file.replace(/\.png$/, '.html');
    await writeFile(doc, html);
    await page.goto(pathToFileURL(doc).href, {waitUntil: 'load'});
    await page.waitForFunction(() => document.body.dataset.ready, {timeout: 15000});
    const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.family === 'ShortInter').map(f => f.status));
    if (!fonts.length || fonts.some(s => s !== 'loaded')) throw new Error('Inter 800/900 did not load for the overlay; not substituting a system font.');
    await page.screenshot({path: file, omitBackground: true});
    return JSON.parse(await page.evaluate(() => document.body.dataset.fit));
  } finally { await page.close(); }
}

async function render(P) {
  const [request, receipt] = [await readJSON(P.request), await readJSON(P.receipt)];
  if (!await planCurrent(P)) throw new Error('plan.json changed since it was checked; run plan-check first.');
  const video = path.join(ROOT, request.video), media = await probe(video);
  const sourceSha256 = (await readJSON(P.transcript)).sourceSha256;
  const vh = Math.round(SHORT.width * media.height / media.width / 2) * 2, y = Math.round((SHORT.height - vh) / 4) * 2;
  const out = P.p('out');
  await mkdir(out, {recursive: true});
  const {chromePath} = await import('../../lib/native.mjs');
  const {createRequire} = await import('node:module');
  const puppeteer = createRequire(path.join(ROOT, 'package.json'))('puppeteer-core');
  let browser = null;
  const results = [];
  try {
    for (const s of receipt.shorts) {
      const key = digest({LAYOUT_VERSION, sourceSha256, start: s.start, end: s.end, title: request.title, accent: request.accent, cta: request.cta});
      const mp4 = path.join(out, `${s.id}.mp4`), meta = path.join(out, `${s.id}.json`);
      const prev = await optional(meta);
      if (prev?.key === key && await exists(mp4)) { results.push({...prev, reused: true}); continue; }
      const background = await sampleEdges(video, s.start, s.end, media);
      browser ??= await puppeteer.launch({executablePath: await chromePath(), headless: true, args: ['--allow-file-access-from-files', '--no-sandbox', '--hide-scrollbars']});
      const overlay = path.join(out, `${s.id}-overlay.png`);
      const fit = await renderOverlay(browser, overlayHtml({title: request.title, accent: request.accent, cta: request.cta, background, videoHeight: vh}), overlay);
      const d = s.duration, fps = Math.min(60, Math.round(media.fps * 1000) / 1000);
      const fg = `[0:v]scale=${SHORT.width}:${vh}:flags=lanczos,setsar=1[fg]`;
      const bg = background.mode === 'solid'
        ? `color=c=${background.color}:s=${SHORT.width}x${SHORT.height}:r=${fps}:d=${d}[bg]`
        : `[0:v]scale=${SHORT.width}:${SHORT.height}:force_original_aspect_ratio=increase,crop=${SHORT.width}:${SHORT.height},gblur=sigma=40,eq=brightness=-0.12,setsar=1[bg]`;
      const filter = background.mode === 'solid'
        ? `${fg};${bg};[bg][fg]overlay=0:${y}:shortest=1[v1];[v1][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`
        : `[0:v]split[s0][s1];${fg.replace('[0:v]', '[s0]')};${bg.replace('[0:v]', '[s1]')};[bg][fg]overlay=0:${y}[v1];[v1][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
      const tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', s.start.toFixed(3), '-t', d.toFixed(3), '-i', video,
        '-loop', '1', '-framerate', String(fps), '-i', overlay,
        '-filter_complex', filter, '-map', '[v]', '-map', '0:a:0',
        '-af', `afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, d - 0.3).toFixed(3)}:d=0.3`,
        '-t', d.toFixed(3), '-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
      await rename(tmp, mp4);
      const record = {id: s.id, key, file: path.relative(ROOT, mp4), sourceStart: s.start, sourceEnd: s.end,
        from: s.from, to: s.to, hook: s.hook || null, why: s.why,
        background, fit, picture: {width: SHORT.width, height: vh, y}};
      await saveJSON(meta, record);
      results.push(record);
    }
  } finally { await browser?.close(); }
  // Remove renders from an earlier, larger selection.
  const keep = new Set(receipt.shorts.map(s => s.id));
  for (const f of await readdir(out)) if (/^short-\d+/.test(f) && !keep.has(f.match(/^short-\d+/)[0])) await rm(path.join(out, f), {force: true});
  return {rendered: results.filter(r => !r.reused).length, reused: results.filter(r => r.reused).length};
}

// ---------------------------------------------------------------- deliver
// Checked in code: canvas, length, audio, title/CTA fit, and that the background meets the
// picture without a visible seam.
async function seam(mp4, at, picture) {
  const px = await run('ffmpeg', ['-v', 'error', '-ss', at.toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', 'format=rgb24', '-f', 'rawvideo', '-'], {binary: true});
  const row = y => { const o = y * SHORT.width * 3; return [0, 1, 2].map(c => { let t = 0; for (let x = 0; x < SHORT.width; x++) t += px[o + x * 3 + c]; return t / SHORT.width; }); };
  const diff = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
  const top = picture.y, bottom = picture.y + picture.height;
  return Math.max(diff(row(top - 3), row(top + 2)), diff(row(bottom + 2), row(bottom - 3)));
}

async function deliver(P) {
  const [request, receipt, t] = [await readJSON(P.request), await readJSON(P.receipt), await readJSON(P.transcript)];
  const shorts = [], problems = [];
  for (const s of receipt.shorts) {
    const mp4 = P.p(`out/${s.id}.mp4`);
    if (!await exists(mp4)) throw new Error(`${s.id}.mp4 was not rendered.`);
    const meta = await readJSON(P.p(`out/${s.id}.json`)), m = await probe(mp4), found = [];
    if (m.width !== SHORT.width || m.height !== SHORT.height) found.push(`canvas ${m.width}×${m.height}`);
    if (!m.audio) found.push('no audio stream');
    if (m.duration < SHORT.min - 0.05 || m.duration > SHORT.max + 0.05) found.push(`duration ${m.duration.toFixed(2)} s outside ${SHORT.min}–${SHORT.max} s`);
    if (meta.fit?.titleOverflow) found.push('title does not fit above the picture');
    if (meta.fit?.ctaOverflow) found.push('call to action does not fit');
    if (meta.background.mode === 'solid') {
      const edge = await seam(mp4, m.duration / 2, meta.picture);
      if (edge > 10) found.push(`visible seam between background and picture (edge difference ${edge.toFixed(0)}/255)`);
    }
    shorts.push({...meta, title: s.title, sha256: await hashFile(mp4), duration: m.duration, problems: found});
    problems.push(...found.map(f => `${s.id}: ${f}`));
  }
  const limitations = [`Clip boundaries come from ${t.origin}; nobody watched or listened to the cuts.`, ...(receipt.repairs || [])];
  if (shorts.length < request.count) limitations.push(`Delivered ${shorts.length} of ${request.count} requested shorts.`);
  await saveJSON(P.delivery, {version: 1, status: 'complete', source: request.video, title: request.title,
    requested: request.count, shorts, problems, limitations, deliveredAt: new Date().toISOString()});
  return {done: true, shorts: shorts.map(s => s.file), problems, limitations};
}

// ---------------------------------------------------------------- publish
// Unlisted upload of every delivered short to the configured channel, one resumable journal per
// short so a resumed run never creates duplicates. Shorts with a technical problem are held back.
async function publish(P) {
  const [request, delivery] = [await readJSON(P.request), await readJSON(P.delivery)];
  if (!request.upload) return {optOut: true};
  const own = await optional(path.join(ROOT, 'jobs/scripts', P.slug, 'archon/published.json'));
  const full = request.fullVideoUrl || own?.url || null;
  const done = (await optional(P.published)) || {version: 1, shorts: {}};
  const held = [];
  for (const s of delivery.shorts) {
    if (s.problems.length) { held.push(`${s.id}: ${s.problems.join('; ')}`); continue; }
    if (done.shorts[s.id]?.sha256 === s.sha256) continue;
    const description = [full ? `Watch the full video: ${full}` : `From the full video "${request.title}".`, '', s.why, '', '#Shorts'].join('\n');
    const id = await youtubeUpload(ROOT, {
      file: path.join(ROOT, s.file), title: s.title.slice(0, 100), description, privacy: 'unlisted',
      expectedChannelId: request.channelId, expectedChannelHandle: 'abdupdatesyt',
      journal: P.p(`upload/${s.id}.json`)});
    done.shorts[s.id] = {id, url: `https://youtube.com/shorts/${id}`, sha256: s.sha256, title: s.title};
    await saveJSON(P.published, done);
  }
  const limitations = ['The on-screen "Tap the link below" points at the description link; YouTube\'s related-video link for Shorts cannot be set through the API.'];
  if (!full) limitations.push('No full-video URL was known, so descriptions name the video instead of linking it.');
  await saveJSON(P.published, {...done, held, limitations});
  return {uploaded: Object.values(done.shorts).map(s => s.url), held, limitations};
}

// ---------------------------------------------------------------- entry
async function stage(name, slug, options = {}) {
  const P = paths(slug);
  if (name === 'prepare') {
    const request = await freezeRequest(P, options);
    const {media, transcript} = await measure(P, request);
    return {needsWrite: !await planCurrent(P), count: request.count, duration: media.duration, units: transcript.units.length, origin: transcript.origin};
  }
  if (name === 'plan-check') return planCheck(P, options);
  if (name === 'render') return render(P);
  if (name === 'deliver') return deliver(P);
  if (name === 'publish') return publish(P);
  throw new Error(`Unknown shorts stage: ${name}`);
}

export async function emit(name, options = {}) {
  console.log = (...a) => console.error(...a);
  try {
    const artifacts = await stage(name, process.env.INPUTS_PROJECT, options);
    process.stdout.write(JSON.stringify({version: 1, status: 'complete', stage: name, artifacts}) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({version: 1, status: 'error', stage: name, error: error.message}) + '\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, slug, arg] = process.argv.slice(2);
  process.env.INPUTS_PROJECT = slug;
  await emit(name, arg ? JSON.parse(arg) : {});
}
