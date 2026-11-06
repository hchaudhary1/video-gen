// Thumbnail media, review records and selection. Archon owns production routing.
import {readFile, writeFile, readdir, mkdir, copyFile, rm, rename, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './media.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = process.env.VG_LIBRARY || path.join(ROOT, 'library');
export const MAX_THUMBNAILS = 6;
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const exists = file => access(file).then(() => true, () => false);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rel = (job, file) => path.relative(ROOT, path.join(job, file)).split(path.sep).join('/');
const V = (job, id, file = '') => path.join(job, 'thumbnail/variants', id, file);
const ids = n => Array.from({length: n}, (_, i) => `v${i + 1}`);

// Each variant starts from a different angle, so the person has a real choice.


/** How many variants a job makes: job.json `thumbnails`, else video.config.json `thumbnails`, else 3. */
export async function thumbnailCount(job) {
  const manifest = await json(path.join(job, 'job.json')).catch(() => ({}));
  const config = await loadConfig(ROOT).catch(() => ({}));
  const n = Number(manifest.thumbnails ?? config.thumbnails ?? 3);
  return Number.isInteger(n) && n >= 1 && n <= MAX_THUMBNAILS ? n : 3;
}

/** Saved video dimensions are required for every production. */
export async function thumbnailDimensions(job) {
  const manifest = await json(path.join(job, 'job.json'));
  let {width, height} = manifest;
  if (![width, height].every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid video dimensions in job.json.');
  const scale = 320 / Math.max(width, height);
  const previewWidth = Math.max(1, Math.round(width * scale)), previewHeight = Math.max(1, Math.round(height * scale));
  return {width, height, previewWidth, previewHeight, previewFile: `preview-${previewWidth}x${previewHeight}.png`,
    orientation: height > width ? 'vertical' : height === width ? 'square' : 'landscape'};
}

function pngSize(bytes) {
  return bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47 ? {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)} : null;
}

async function variantInfo(job, id) {
  const {width, height, previewWidth, previewHeight, previewFile} = await thumbnailDimensions(job);
  const files = await readdir(V(job, id)).catch(() => []);
  const png = files.includes('thumbnail.png') ? await readFile(V(job, id, 'thumbnail.png')) : null;
  const size = png && pngSize(png);
  const preview = files.includes(previewFile) ? pngSize(await readFile(V(job, id, previewFile))) : null;
  const validSize = size?.width === width && size?.height === height;
  const validPreview = preview?.width === previewWidth && preview?.height === previewHeight;
  const brief = files.includes('BRIEF.md') ? await readFile(V(job, id, 'BRIEF.md'), 'utf8') : '';
  const feedback = await json(V(job, id, 'feedback.json')).catch(() => []);
  const pngSha256 = png ? sha(png) : null;
  return {id, previewFile, dir: rel(job, `thumbnail/variants/${id}`), files,
    made: Boolean(png && validSize && validPreview && brief && files.some(f => f.endsWith('.svg'))),
    pngError: png && !validSize ? `thumbnail.png is ${size ? `${size.width}×${size.height}` : 'not a PNG'}, expected ${width}×${height}` : !validPreview ? `Missing or invalid ${previewFile}; expected ${previewWidth}×${previewHeight}.` : '',
    headline: /^\s*[-*]?\s*\**headline\**\s*:\s*(.+)$/im.exec(brief)?.[1].replace(/[*"“”]/g, '').trim() || '',
    pngSha256, feedback: Array.isArray(feedback) ? feedback : []};
}

/** Everything about a job's thumbnails, read from its files (no writes). Used by `thumbnails --json` and the UI. */
export async function thumbnailStatus(job) {
  const n = await thumbnailCount(job), manifest = await json(path.join(job, 'job.json')).catch(() => ({}));
  const review = await json(path.join(job, 'thumbnail/variants/REVIEW.json')).catch(() => ({variants: {}, ranking: []}));
  const chosen = await json(path.join(job, 'thumbnail/CHOSEN.json')).catch(() => null);
  const variants = [];
  for (const id of ids(n)) {
    const v = await variantInfo(job, id), entry = review.variants?.[id];
    const current = Boolean(v.made && entry && v.pngSha256 && entry.pngSha256 === v.pngSha256);
    const open = v.feedback.filter(f => v.pngSha256 && f.forPng === v.pngSha256);
    const reviewerRounds = v.feedback.filter(f => f.by === 'reviewer').length;
    variants.push({...v, review: current ? {status: entry.status, findings: entry.findings || [], reviewerAgentId: entry.reviewerAgentId} : null,
      openFeedback: open, needsWork: !v.made || open.length > 0,
      failed: current && entry.status === 'blocked' && reviewerRounds >= 3 && !open.some(f => f.by === 'you')});
  }
  const byId = Object.fromEntries(variants.map(v => [v.id, v]));
  // A variant accepted after its one fix round (see acceptThumbnail) stays chosen while unchanged.
  const chosenCurrent = chosen && byId[chosen.variant]?.pngSha256 === chosen.pngSha256 &&
    (byId[chosen.variant]?.review?.status === 'pass' || chosen.accepted === true);
  return {count: n, pick: manifest.pickThumbnail === true, variants, ranking: (review.ranking || []).filter(id => byId[id]),
    chosen: chosenCurrent ? chosen : null};
}

export async function recordVerdict(job, {variant, status, findings = [], inspected = [], reviewer}) {
  if (!['pass', 'blocked'].includes(status)) throw new Error('--status is pass or blocked.');
  if (!reviewer) throw new Error('No reviewer id: the runner sets VIDEO_AGENT_ID; elsewhere pass --reviewer <your agent id>.');
  const v = await variantInfo(job, variant);
  if (!v.made) throw new Error(`${variant} is not finished (BRIEF.md, an SVG, a thumbnail.png matching the video dimensions and its feed preview). ${v.pngError}`);
  if (status === 'blocked' && !findings.length) throw new Error('A blocked variant needs at least one --finding saying what is wrong.');
  if (!inspected.some(f => f.endsWith('.png'))) throw new Error('--inspected must list the PNGs you opened.');
  const file = path.join(job, 'thumbnail/variants/REVIEW.json');
  const review = await json(file).catch(() => ({version: 1, variants: {}, ranking: []}));
  review.variants[variant] = {status, findings, inspectedFiles: inspected, pngSha256: v.pngSha256, reviewerAgentId: reviewer, at: new Date().toISOString()};
  await save(file, review);
  return review.variants[variant];
}

export async function recordRanking(job, ranking) {
  const file = path.join(job, 'thumbnail/variants/REVIEW.json');
  const review = await json(file).catch(() => null);
  if (!review) throw new Error('Record a verdict for each variant before ranking them.');
  const unknown = ranking.filter(id => !review.variants[id]);
  if (unknown.length) throw new Error(`No verdict recorded for ${unknown.join(', ')}.`);
  review.ranking = ranking; await save(file, review);
}

/** Feedback on one variant (the person's words, kept verbatim). Picking that variant is undone until it is remade. */
export async function addThumbnailFeedback(job, {variant, text, by = 'you'}) {
  text = String(text || '').trim();
  if (!text) throw new Error('Say what should change.');
  const status = await thumbnailStatus(job), v = status.variants.find(x => x.id === variant);
  if (!v) throw new Error(`No variant ${variant}; this job makes ${status.count}.`);
  if (!v.made) throw new Error(`${variant} is not made yet.`);
  await save(V(job, variant, 'feedback.json'), [...v.feedback, {by, text: text.slice(0, 4000), forPng: v.pngSha256, at: new Date().toISOString()}]);
  if (status.chosen?.variant === variant) await rm(path.join(job, 'thumbnail/CHOSEN.json'), {force: true});
  return {variant, feedback: v.feedback.length + 1};
}

const ROOT_FILES = new Set(['variants', 'CHOSEN.json']);
/** Make a passing variant the film's thumbnail, and archive the thumbnail folder to library/thumbnails/<slug>/. */
export async function chooseThumbnail(job, {variant, by = 'reviewer'}) {
  const status = await thumbnailStatus(job), v = status.variants.find(x => x.id === variant);
  if (!v) throw new Error(`No variant ${variant}; this job makes ${status.count}.`);
  if (!v.made || v.review?.status !== 'pass') throw new Error(`${variant} has not passed the independent review of its current version.`);
  if (v.openFeedback.length) throw new Error(`${variant} has feedback that has not been applied yet.`);
  const dir = path.join(job, 'thumbnail');
  for (const name of await readdir(dir)) if (!ROOT_FILES.has(name)) await rm(path.join(dir, name), {recursive: true, force: true});
  for (const name of v.files) if (name !== 'feedback.json') await copyFile(V(job, variant, name), path.join(dir, name));
  const entry = (await json(path.join(dir, 'variants/REVIEW.json'))).variants[variant];
  await save(path.join(dir, 'REVIEW.json'), {status: 'pass', variant, reviewerAgentId: entry.reviewerAgentId, inspectedFiles: entry.inspectedFiles,
    findings: entry.findings, limitations: ['Thumbnail reviewed as still images at full and feed size; click-through is not measured.']});
  await save(path.join(dir, 'CHOSEN.json'), {version: 1, variant, by, pngSha256: v.pngSha256, headline: v.headline, at: new Date().toISOString()});
  await archiveThumbnail(job);
  return {variant, headline: v.headline};
}

// Continuation after the one thumbnail fix round: the chosen variant did not pass a current
// review. The selection says so; it never records a pass.
export async function acceptThumbnail(job, {variant, reason, by = 'archon'}) {
  if (!reason) throw new Error('Accepting a thumbnail without a passing review needs a reason.');
  const status = await thumbnailStatus(job), v = status.variants.find(x => x.id === variant);
  if (!v) throw new Error(`No variant ${variant}; this job makes ${status.count}.`);
  if (!v.made) throw new Error(`${variant} is not finished. ${v.pngError || ''}`.trim());
  if (v.review?.status === 'pass' && !v.openFeedback.length) return chooseThumbnail(job, {variant, by});
  const dir = path.join(job, 'thumbnail');
  for (const name of await readdir(dir)) if (!ROOT_FILES.has(name)) await rm(path.join(dir, name), {recursive: true, force: true});
  for (const name of v.files) if (name !== 'feedback.json') await copyFile(V(job, variant, name), path.join(dir, name));
  await save(path.join(dir, 'REVIEW.json'), {status: 'accepted-without-pass', variant, reason,
    findings: v.review?.findings || [], openFeedback: v.openFeedback,
    limitations: ['This thumbnail did not pass a current independent review; it was chosen after one fix round.']});
  await save(path.join(dir, 'CHOSEN.json'), {version: 1, variant, by, accepted: true, reason, pngSha256: v.pngSha256, headline: v.headline, at: new Date().toISOString()});
  await archiveThumbnail(job);
  return {variant, headline: v.headline, accepted: true};
}

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true}).catch(() => [])) {
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`));
    else if (entry.isFile()) out.push(`${prefix}${entry.name}`);
  }
  return out;
}
// Earlier archives are kept under history/<time>/, never overwritten.
async function archiveThumbnail(job) {
  const source = path.join(job, 'thumbnail'), target = path.join(LIBRARY, 'thumbnails', path.basename(job));
  if (await exists(target) && !await archiveMatches(job)) {
    const old = (await readdir(target)).filter(n => n !== 'history');
    if (old.length) {
      const keep = path.join(target, 'history', new Date().toISOString().replace(/[:.]/g, '-'));
      await mkdir(keep, {recursive: true});
      for (const name of old) await rename(path.join(target, name), path.join(keep, name));
    }
  }
  for (const file of await listFiles(source)) {
    await mkdir(path.dirname(path.join(target, file)), {recursive: true});
    await copyFile(path.join(source, file), path.join(target, file));
  }
}
async function archiveMatches(job) {
  const source = path.join(job, 'thumbnail'), target = path.join(LIBRARY, 'thumbnails', path.basename(job));
  for (const file of await listFiles(source)) {
    const [a, b] = await Promise.all([readFile(path.join(source, file)), readFile(path.join(target, file)).catch(() => null)]);
    if (!b || !a.equals(b)) return false;
  }
  return true;
}

/** Render a variant's SVG to thumbnail.png at video dimensions and an aspect-matched feed preview with the repository's Chrome. */
export async function exportThumbnail(job, variant) {
  const {width, height, previewWidth, previewHeight, previewFile} = await thumbnailDimensions(job);
  const files = await readdir(V(job, variant)).catch(() => []);
  const svg = files.includes('thumbnail.svg') ? 'thumbnail.svg' : files.find(f => f.endsWith('.svg'));
  if (!svg) throw new Error(`Write ${rel(job, `thumbnail/variants/${variant}`)}/thumbnail.svg first.`);
  const {chromePath} = await import('./native.mjs');
  const {default: puppeteer} = await import('puppeteer-core');
  const {pathToFileURL} = await import('node:url');
  const browser = await puppeteer.launch({executablePath: await chromePath(), headless: true, args: ['--allow-file-access-from-files', '--no-sandbox', '--hide-scrollbars']});
  try {
    const page = await browser.newPage();
    await page.setViewport({width, height, deviceScaleFactor: 1});
    // Opened as a document (not an <img>), so fonts and images next to the SVG load too.
    await page.goto(pathToFileURL(V(job, variant, svg)).href, {waitUntil: 'load'});
    const ratio = await page.evaluate(() => {
      const svg = document.documentElement;
      const box = svg.viewBox?.baseVal;
      return box?.width > 0 && box?.height > 0 ? box.width / box.height : svg.width?.baseVal?.value / svg.height?.baseVal?.value;
    });
    if (!Number.isFinite(ratio) || Math.abs(ratio - width / height) > 0.001)
      throw new Error(`SVG aspect ratio must match the video's ${width}×${height} frame. Recompose the thumbnail for this orientation.`);
    await page.evaluate(({width, height}) => {
      Object.assign(document.documentElement.style, {width: `${width}px`, height: `${height}px`, display: 'block'});
    }, {width, height});
    await page.evaluate(() => document.fonts?.ready);
    await page.screenshot({path: V(job, variant, 'thumbnail.png'), clip: {x: 0, y: 0, width, height}});
    await page.setViewport({width: previewWidth, height: previewHeight, deviceScaleFactor: 1});
    // Leave the SVG document before replacing it with an HTML feed preview.
    await page.goto('about:blank');
    await page.setContent(`<!doctype html><style>html,body{margin:0}img{display:block;width:${previewWidth}px;height:${previewHeight}px}</style><img src="data:image/png;base64,${(await readFile(V(job, variant, 'thumbnail.png'))).toString('base64')}">`, {waitUntil: 'load'});
    await page.screenshot({path: V(job, variant, previewFile), clip: {x: 0, y: 0, width: previewWidth, height: previewHeight}});
    for (const file of files.filter(name => /^preview-\d+x\d+\.png$/.test(name) && name !== previewFile))
      await rm(V(job, variant, file));
  } finally { await browser.close(); }
  const size = pngSize(await readFile(V(job, variant, 'thumbnail.png')));
  return {png: rel(job, `thumbnail/variants/${variant}/thumbnail.png`), preview: rel(job, `thumbnail/variants/${variant}/${previewFile}`), size};
}
