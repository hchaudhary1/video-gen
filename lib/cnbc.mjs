// cnbc-commentary profile tooling: CNBC recording → chaptered clips + explainroo commentary → final edit.
// Every gate here is deterministic (ffprobe-measured durations, fixed rules); nothing is estimated.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {access, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engines', 'explainroo');
export const RECORDINGS = process.env.CNBC_RECORDINGS || path.join(process.env.HOME || '/home/administrator', 'cnbc-daily-recorder', 'recordings');
// Finance treatment: substantial source excerpts followed by original analysis.
export function financeRatioPass(ownSeconds, cnbcSeconds) {
  const total = ownSeconds + cnbcSeconds;
  const share = cnbcSeconds / total;
  return Number.isFinite(total) && ownSeconds > 0 && cnbcSeconds > 0 && share >= 0.3 && share <= 0.4;
}
const W = 1920, H = 1080, FPS = 30, RATE = 48000;

const fail = message => {throw new Error(`cnbc: ${message}`);};
const exists = async file => {try {await access(file); return true;} catch {return false;}};
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const save = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');
const r3 = n => Math.round(n * 1000) / 1000;

function run(cmd, args, {capture = false, env} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: env || process.env});
    let out = '', err = '';
    child.stdout?.on('data', d => { out += d; });
    child.stderr?.on('data', d => { err += d; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}${err ? `: ${err.slice(-1500)}` : ''}`)));
  });
}
const hash = file => new Promise((resolve, reject) => {
  const h = createHash('sha256');
  createReadStream(file).on('data', d => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')));
});
export async function duration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {capture: true});
  const d = Number(out.trim());
  if (!(d > 0)) fail(`could not measure duration of ${file}`);
  return d;
}
const clock = s => {
  const t = Math.floor(s), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const parseClock = text => text.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);

function projectDir(slug) {
  if (!slug) fail('pass --project <slug> (the explainroo project under engines/explainroo/videos/).');
  const dir = path.join(ENGINE, 'videos', slug);
  return {dir, work: path.join(dir, 'cnbc')};
}

// Recorder file names: cnbc-YYYY-MM-DD_HH-MM-SS-<show>.mp4 (time stamped in ET).
function parseRecording(name) {
  const m = name.match(/^cnbc-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-(.+))?\.mp4$/);
  if (!m) return null;
  const show = (m[5] || 'cnbc').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  return {file: name, date: m[1], timeET: `${m[2]}:${m[3]}`, show, key: `${m[1]}T${m[2]}${m[3]}${m[4]}`};
}

export async function latest({dir = RECORDINGS, limit = 10, show} = {}) {
  if (!await exists(dir)) fail(`recordings folder not found: ${dir} (set CNBC_RECORDINGS).`);
  let items = (await readdir(dir)).map(parseRecording).filter(Boolean);
  if (show) items = items.filter(i => i.show.toLowerCase().includes(String(show).toLowerCase()));
  items.sort((a, b) => b.key.localeCompare(a.key));
  const out = [];
  for (const item of items.slice(0, Number(limit) || 10)) {
    const file = path.join(dir, item.file);
    out.push({...item, path: file, sizeMB: Math.round((await stat(file)).size / 1048576), duration: r3(await duration(file))});
  }
  return out;
}

async function resolveRecording(recording) {
  if (!recording) {
    const [newest] = await latest({limit: 1});
    if (!newest) fail(`no recordings in ${RECORDINGS}.`);
    return newest.path;
  }
  const file = path.isAbsolute(recording) ? recording : path.join(RECORDINGS, recording);
  if (!await exists(file)) fail(`recording not found: ${file}`);
  return file;
}

// Measured ASR word times on the original recording clock, plus a readable sentence view for picking clips.
export async function transcribe({project, recording, model = 'small.en'}) {
  const {dir, work} = projectDir(project);
  if (!await exists(dir)) fail(`create the explainroo project first: npm run video -- explainroo init videos/${project} --template kai --title "..."`);
  const file = await resolveRecording(recording);
  await mkdir(work, {recursive: true});
  const meta = parseRecording(path.basename(file)) || {};
  console.error(`Hashing and transcribing ${file} (a 30-minute show takes several minutes on CPU)...`);
  const source = {...meta, file, duration: r3(await duration(file)), sha256: await hash(file), holder: 'CNBC'};
  await save(path.join(work, 'source.json'), source);
  const cache = path.join(ROOT, '.cache', 'video-gen');
  const words = path.join(work, 'transcript-words.json');
  await run('uv', ['run', '--locked', '--script', path.join(ROOT, 'scripts/transcribe.py'), file, words, '--model', model, '--language', 'en'],
    {env: {...process.env, UV_CACHE_DIR: path.join(cache, 'uv'), HF_HOME: path.join(cache, 'huggingface'), XDG_CACHE_HOME: cache}});
  const list = await json(words), lines = [];
  let line = null;
  for (const w of list) {
    if (!line || w.start - line.end > 0.8 || /[.?!]$/.test(line.text)) { line && lines.push(line); line = {start: w.start, end: w.end, text: w.text}; }
    else { line.end = w.end; line.text += ` ${w.text}`; }
  }
  line && lines.push(line);
  await writeFile(path.join(work, 'transcript.txt'), lines.map(l => `[${l.start.toFixed(2)}-${l.end.toFixed(2)}] ${l.text}`).join('\n') + '\n');
  return {source: path.relative(ROOT, path.join(work, 'source.json')), words: list.length, transcript: path.relative(ROOT, path.join(work, 'transcript.txt')),
    next: `Pick clips in ${path.relative(ROOT, path.join(work, 'clips.json'))}, then npm run video -- cnbc cut --project ${project}`};
}

async function loadClips(work) {
  const file = path.join(work, 'clips.json');
  if (!await exists(file)) fail(`write ${path.relative(ROOT, file)}: {"clips":[{"id","chapter","in","out","speaker"}]}`);
  const plan = await json(file), source = await json(path.join(work, 'source.json'));
  if (!Array.isArray(plan.clips) || !plan.clips.length) fail('clips.json needs a non-empty "clips" array.');
  const words = await exists(path.join(work, 'transcript-words.json')) ? await json(path.join(work, 'transcript-words.json')) : [];
  const ids = new Set();
  for (const c of plan.clips) {
    if (!/^[a-z0-9-]+$/.test(c.id || '') || ids.has(c.id)) fail(`clip id "${c.id}" must be unique kebab-case.`);
    ids.add(c.id);
    if (!c.chapter?.trim()) fail(`${c.id}: needs a YouTube chapter title.`);
    if (!(c.in >= 0 && c.out > c.in && c.out <= source.duration)) fail(`${c.id}: invalid in/out for a ${source.duration}s recording.`);
    if (c.out - c.in < 10) fail(`${c.id}: YouTube chapters must be at least 10 s; this clip is ${r3(c.out - c.in)} s.`);
    const cut = words.find(w => (w.start < c.in - 0.02 && w.end > c.in + 0.02) || (w.start < c.out - 0.02 && w.end > c.out + 0.02));
    if (cut) fail(`${c.id}: in/out cuts through the word "${cut.text}" (${cut.start}-${cut.end}); move the cut to a word gap.`);
  }
  return {plan, source};
}

const normalize = [`scale=${W}:${H}:force_original_aspect_ratio=decrease`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`, `fps=${FPS}`, 'setsar=1', 'format=yuv420p'];
const encode = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-ar', String(RATE), '-ac', '2', '-movflags', '+faststart'];
const label = text => text.replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');

// Cuts each planned clip from the original recording with an on-screen source credit.
export async function cut({project}) {
  const {work} = projectDir(project);
  const {plan, source} = await loadClips(work);
  if (await hash(source.file) !== source.sha256) fail('the recording changed since transcription; transcribe again.');
  await mkdir(path.join(work, 'clips'), {recursive: true});
  const font = path.join(ROOT, 'node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2');
  const credit = label(`Source: CNBC ${source.show || ''}, ${source.date || ''}`.replace(/\s+,/, ','));
  const made = [];
  for (const c of plan.clips) {
    const out = path.join(work, 'clips', `${c.id}.mp4`);
    const vf = [...normalize, `drawtext=fontfile='${font}':text='${credit}':x=40:y=36:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12`].join(',');
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.in), '-to', String(c.out), '-i', source.file, '-vf', vf, '-af', `loudnorm=I=-16:TP=-1.5:LRA=7,aresample=${RATE}`, ...encode, out]);
    made.push({id: c.id, chapter: c.chapter, duration: r3(await duration(out))});
  }
  return {clips: made, cnbcSeconds: r3(made.reduce((s, c) => s + c.duration, 0)), next: `Write and render the commentary, then npm run video -- cnbc assemble --project ${project}`};
}

async function commentaryChapters(dir) {
  const file = path.join(dir, 'out', 'video.chapters.txt');
  if (!await exists(file)) return [];
  return (await readFile(file, 'utf8')).split('\n').map(l => l.match(/^(\d+(?::\d+)+)\s+(.+)$/)).filter(Boolean).map(m => ({at: parseClock(m[1]), title: m[2].trim()}));
}

// The deterministic 30–40% CNBC-content gate. Measures every part and the final file; never trusts declared numbers.
export async function ratio({project}) {
  const {dir, work} = projectDir(project);
  const manifestFile = path.join(work, 'assembly.json');
  if (!await exists(manifestFile)) fail(`run npm run video -- cnbc assemble --project ${project} first.`);
  const manifest = await json(manifestFile);
  const parts = [];
  for (const p of manifest.parts) {
    const file = path.join(work, p.file);
    if (await hash(file) !== p.sha256) fail(`${p.file} changed after assembly; assemble again.`);
    parts.push({...p, measured: await duration(file)});
  }
  const final = path.join(work, manifest.output);
  if (await hash(final) !== manifest.sha256) fail('final.mp4 changed after assembly; assemble again.');
  const total = await duration(final), sum = parts.reduce((s, p) => s + p.measured, 0);
  const cnbc = parts.filter(p => p.kind === 'cnbc').reduce((s, p) => s + p.measured, 0), own = sum - cnbc;
  const drift = Math.abs(total - sum);
  const result = {
    final: path.relative(ROOT, final), sha256: manifest.sha256, totalSeconds: r3(total), partsSeconds: r3(sum),
    cnbcSeconds: r3(cnbc), ownSeconds: r3(own), ownShare: r3(own / sum), cnbcShare: r3(cnbc / sum),
    rule: 'CNBC excerpts must be 30–40% of runtime; original commentary 60–70%', measuredAt: new Date().toISOString(),
    pass: financeRatioPass(own, cnbc) && drift < 1
  };
  if (drift >= 1) result.error = `final duration ${r3(total)} s differs from the sum of parts ${r3(sum)} s.`;
  else if (!result.pass) result.error = `CNBC content is ${(result.cnbcShare * 100).toFixed(1)}%; adjust substantive excerpts or commentary to reach 30–40% CNBC runtime.`;
  await save(path.join(work, 'ratio.json'), result);
  if (!result.pass) { console.log(JSON.stringify(result, null, 2)); fail(result.error); }
  return result;
}

// CNBC clips first (one YouTube chapter each), then the explainroo commentary with its own chapters.
export async function assemble({project, commentary}) {
  const {dir, work} = projectDir(project);
  const {plan} = await loadClips(work);
  const commentaryFile = commentary ? path.resolve(commentary) : path.join(dir, 'out', 'video.mp4');
  if (!await exists(commentaryFile)) fail(`commentary render not found: ${commentaryFile} (npm run video -- explainroo render videos/${project}).`);
  for (const c of plan.clips) if (!await exists(path.join(work, 'clips', `${c.id}.mp4`))) fail(`clip ${c.id} not cut; run cnbc cut.`);
  const own = path.join(work, 'commentary.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', commentaryFile, '-map', '0:v:0', '-map', '0:a:0', '-vf', normalize.join(','), '-af', `aresample=${RATE}`, ...encode, own]);
  const parts = [...plan.clips.map(c => ({kind: 'cnbc', id: c.id, chapter: c.chapter, file: `clips/${c.id}.mp4`})), {kind: 'own', id: 'commentary', file: 'commentary.mp4'}];
  const inputs = parts.flatMap(p => ['-i', path.join(work, p.file)]);
  const graph = parts.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('') + `concat=n=${parts.length}:v=1:a=1[v][a]`;
  const output = path.join(work, 'final.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', ...encode, output]);

  let at = 0;
  const chapters = [];
  for (const p of parts) {
    p.sha256 = await hash(path.join(work, p.file));
    p.duration = r3(await duration(path.join(work, p.file)));
    if (p.kind === 'cnbc') chapters.push({at, title: p.chapter});
    else {
      const inner = await commentaryChapters(dir);
      if (!inner.length || inner[0].at > 0) chapters.push({at, title: 'Our take'});
      for (const c of inner) chapters.push({at: at + c.at, title: c.title});
    }
    at += p.duration;
  }
  const kept = chapters.filter((c, i) => i === chapters.length - 1 ? at - c.at >= 10 : chapters[i + 1].at - c.at >= 10);
  if (kept.length < 3) fail('YouTube needs at least 3 chapters of 10 s or more.');
  await writeFile(path.join(work, 'chapters.txt'), kept.map(c => `${clock(c.at)} ${c.title}`).join('\n') + '\n');
  await save(path.join(work, 'assembly.json'), {output: 'final.mp4', sha256: await hash(output), parts});
  return {...await ratio({project}), chapters: path.relative(ROOT, path.join(work, 'chapters.txt'))};
}

// A full-resolution still from the recording, e.g. to source the thumbnail personality.
export async function frame({project, at, out}) {
  const {work} = projectDir(project);
  const source = await json(path.join(work, 'source.json'));
  if (!(Number(at) >= 0)) fail('pass --at <seconds on the recording clock>.');
  await mkdir(path.join(work, 'thumbs'), {recursive: true});
  const file = out ? path.resolve(out) : path.join(work, 'thumbs', `frame-${Number(at).toFixed(1)}.png`);
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', source.file, '-frames:v', '1', file]);
  return {frame: path.relative(ROOT, file)};
}

const ACCENTS = {red: '#ff1a1a', yellow: '#fff200', green: '#22e05a'};
export function thumbWords(words) {
  const lines = String(words || '').split('|').map(l => l.trim()).filter(Boolean);
  const count = lines.join(' ').split(/\s+/).filter(w => /[\p{L}\p{N}$]/u.test(w)).length;
  if (count < 2 || count > 3) fail(`thumbnail text must be 2-3 words (got ${count}): "${lines.join(' ')}".`);
  if (lines.length > 3) fail('use at most 3 lines (separate lines with |).');
  return lines;
}

// Reference style: black field, 2-3 huge uppercase words (last line accented), person cutout on one side.
export async function thumb({project, words, person, accent = 'yellow', side = 'right', out}) {
  const {work} = projectDir(project);
  const lines = thumbWords(words);
  if (!person || !await exists(path.resolve(person))) fail('pass --person <image of the personality, ideally a cutout on black or transparent>.');
  const color = ACCENTS[accent] || (/^#[0-9a-f]{6}$/i.test(accent) ? accent : fail('accent must be red, yellow, green or #rrggbb.'));
  const img = await readFile(path.resolve(person));
  const mime = /\.png$/i.test(person) ? 'image/png' : /\.webp$/i.test(person) ? 'image/webp' : 'image/jpeg';
  const font = (await readFile(path.join(ROOT, 'node_modules/@fontsource/inter/files/inter-latin-900-normal.woff2'))).toString('base64');
  const left = side === 'left';
  const html = `<!doctype html><html><head><style>
@font-face{font-family:T;src:url(data:font/woff2;base64,${font});font-weight:900}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#000;overflow:hidden;position:relative;font-family:T}
.p{position:absolute;bottom:0;${left ? 'left:0' : 'right:0'};height:100%;width:52%;
  background:url(data:${mime};base64,${img.toString('base64')}) ${left ? 'left' : 'right'} bottom/contain no-repeat;
  -webkit-mask-image:linear-gradient(${left ? 'to left' : 'to right'},transparent 0,#000 18%);filter:contrast(1.08) saturate(1.1)}
.t{position:absolute;top:0;bottom:0;${left ? 'right:50px' : 'left:50px'};width:50%;display:flex;flex-direction:column;justify-content:center;
  align-items:${left ? 'flex-end' : 'flex-start'};text-align:${left ? 'right' : 'left'};z-index:2}
.l{font-weight:900;text-transform:uppercase;line-height:.98;color:#fff;letter-spacing:-.01em;white-space:nowrap;
  text-shadow:0 6px 0 #000,0 0 24px rgba(0,0,0,.9)}
.l:last-child{color:${color}}
</style></head><body><div class="p"></div><div class="t">${lines.map(l => `<div class="l">${l.replace(/[<&>]/g, '')}</div>`).join('')}</div>
<script>for(const el of document.querySelectorAll('.l')){let s=260;el.style.fontSize=s+'px';while(el.scrollWidth>${Math.round(W * 0.48)}&&s>80){s-=4;el.style.fontSize=s+'px'}}</script>
</body></html>`;
  const {default: puppeteer} = await import('puppeteer-core');
  const chromeRoot = path.join(process.env.HOME, '.cache/hyperframes/chrome/chrome-headless-shell');
  const versions = await exists(chromeRoot) ? (await readdir(chromeRoot)).sort() : [];
  if (!versions.length) fail('HyperFrames headless Chrome not found under ~/.cache/hyperframes/chrome.');
  const browser = await puppeteer.launch({executablePath: path.join(chromeRoot, versions.at(-1), 'chrome-headless-shell-linux64', 'chrome-headless-shell'), args: ['--no-sandbox']});
  try {
    const page = await browser.newPage();
    await page.setViewport({width: W, height: H});
    await page.setContent(html, {waitUntil: 'load'});
    await page.evaluate(() => document.fonts.ready);
    await mkdir(path.join(work, 'thumbs'), {recursive: true});
    const file = out ? path.resolve(out) : path.join(work, 'thumbs', 'thumbnail.jpg');
    await page.screenshot({path: file, type: 'jpeg', quality: 90});
    if ((await stat(file)).size > 2 * 1024 * 1024) fail(`${file} exceeds YouTube's 2 MB limit.`);
    return {thumbnail: path.relative(ROOT, file), words: lines.join(' ')};
  } finally { await browser.close(); }
}

// Deterministic publishing gate for the reference title/thumbnail format.
export async function publishCheck({project, title, person}) {
  const {work} = projectDir(project);
  const problems = [];
  if (!title?.trim()) problems.push('pass --title.');
  if (!person?.trim()) problems.push('pass --person "<famous person, company or market named in the title>".');
  if (title && person && !title.toLowerCase().includes(person.toLowerCase())) problems.push(`title must name-drop "${person}".`);
  if (title && title.length > 100) problems.push('YouTube titles are limited to 100 characters.');
  const r = await exists(path.join(work, 'ratio.json')) ? await json(path.join(work, 'ratio.json')) : null;
  if (!r?.pass || !financeRatioPass(r.ownSeconds, r.cnbcSeconds)) problems.push('ratio.json is missing or outside the required 30–40% CNBC range; run cnbc ratio.');
  else if (r.sha256 !== await hash(path.join(work, 'final.mp4'))) problems.push('final.mp4 changed after the ratio check; run cnbc ratio.');
  if (!await exists(path.join(work, 'thumbs', 'thumbnail.jpg'))) problems.push('render the thumbnail with cnbc thumb.');
  if (!await exists(path.join(work, 'chapters.txt'))) problems.push('chapters.txt missing; run cnbc assemble.');
  if (problems.length) fail(problems.join(' '));
  return {ok: true, title, ownShare: r.ownShare, chapters: (await readFile(path.join(work, 'chapters.txt'), 'utf8')).trim().split('\n')};
}

export async function cnbcCommand(args) {
  const [sub, ...rest] = args, opts = {};
  for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? 'true' : rest[++i];
  const commands = {latest, transcribe, cut, assemble, ratio, frame, thumb, 'publish-check': publishCheck};
  if (!commands[sub]) {
    console.log(`cnbc latest [--limit 10 --show "mad money"]          newest recordings from ${RECORDINGS}
cnbc transcribe --project <slug> [--recording <file>]    measured transcript of the recording (default: newest)
cnbc cut --project <slug>                                cut clips.json clips with source credit
cnbc assemble --project <slug>                           clips + commentary render → cnbc/final.mp4, chapters, ratio gate
cnbc ratio --project <slug>                              re-run the measured 30–40% CNBC-content check
cnbc frame --project <slug> --at <sec>                   still from the recording (thumbnail personality)
cnbc thumb --project <slug> --words "BUY THE|DIP" --person <img> [--accent yellow|red --side right|left]
cnbc publish-check --project <slug> --title "..." --person "Jim Cramer"`);
    return;
  }
  console.log(JSON.stringify(await commands[sub](opts), null, 2));
}
