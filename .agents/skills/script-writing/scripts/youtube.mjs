#!/usr/bin/env node
// Find YouTube videos on a topic and retain their transcripts and top comments as Markdown.
//   node youtube.mjs search "<query>" [--limit 8]
//   node youtube.mjs channel <channel-url> [--limit 15]          (recent uploads)
//   node youtube.mjs transcript <video-url-or-id> <out.md> [--comments 40]
// Runs yt-dlp through `uvx` (override with YTDLP="<command>") and keeps its caches in .cache/.
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CACHE = path.join(ROOT, '.cache/youtube');
const [mode, target, maybeOut, ...rest] = process.argv.slice(2);
const args = [maybeOut, ...rest].filter((a) => a !== undefined);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!['search', 'channel', 'transcript'].includes(mode) || !target || (mode === 'transcript' && !maybeOut)) {
  console.error('Usage: node youtube.mjs search "<query>" [--limit n] | channel <url> [--limit n] | transcript <url|id> <out.md> [--comments n]');
  process.exit(2);
}

function ytdlp(argv) {
  const [cmd, ...pre] = (process.env.YTDLP || 'uvx yt-dlp').split(/\s+/);
  const env = { ...process.env, UV_CACHE_DIR: path.join(ROOT, '.cache/uv'), UV_TOOL_DIR: path.join(ROOT, '.cache/uv-tools'),
    XDG_CACHE_HOME: path.join(ROOT, '.cache/xdg') };
  const res = spawnSync(cmd, [...pre, '--no-warnings', '--cache-dir', path.join(CACHE, 'yt-dlp'), ...argv],
    { env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000 });
  if (res.status !== 0) throw new Error(`yt-dlp failed: ${(res.stderr || res.error?.message || '').trim().split('\n').slice(-3).join(' ')}`);
  return res.stdout;
}

const fmtDate = (d) => (d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d || 'unknown date');
const fmtDur = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '?');

function listing(source, limit) {
  const data = JSON.parse(ytdlp(['--flat-playlist', '--playlist-end', String(limit), '-J', source]));
  for (const e of data.entries || [])
    console.log([e.id, e.title, e.channel || e.uploader || data.channel || '', fmtDur(e.duration),
      e.view_count != null ? `${e.view_count} views` : '', `https://www.youtube.com/watch?v=${e.id}`].join(' | '));
}

// Auto captions repeat each line as it scrolls; keep each new phrase once.
function vttToText(vtt) {
  const out = [];
  for (const line of vtt.split('\n')) {
    if (!line.trim() || line.includes('-->') || /^(WEBVTT|Kind:|Language:|NOTE)/.test(line) || /^\d+$/.test(line.trim())) continue;
    const t = line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim();
    if (!t || out[out.length - 1] === t || out[out.length - 1]?.endsWith(t)) continue;
    out.push(t);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

async function transcript(input, out) {
  const id = input.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] || (/^[\w-]{11}$/.test(input) ? input : null);
  if (!id) throw new Error('Pass a YouTube video URL or 11-character id');
  const work = path.join(CACHE, id);
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const comments = Number(flag('comments', 40));
  ytdlp(['--skip-download', '--write-info-json', '--write-subs', '--write-auto-subs', '--sub-langs', 'en,en-orig,en-US,en-GB',
    '--sub-format', 'vtt', ...(comments > 0 ? ['--write-comments', '--extractor-args', `youtube:max_comments=${comments * 3},${comments},0;comment_sort=top`] : []),
    '-o', path.join(work, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${id}`]);
  const files = await readdir(work);
  const info = JSON.parse(await readFile(path.join(work, files.find((f) => f.endsWith('.info.json'))), 'utf8'));
  // Prefer creator-uploaded English subtitles over automatic captions.
  const manual = Object.keys(info.subtitles || {}).some((l) => l.startsWith('en'));
  const vtt = files.filter((f) => f.endsWith('.vtt')).sort((a, b) => (a.includes('orig') ? -1 : 0) - (b.includes('orig') ? -1 : 0))[0];
  const text = vtt ? vttToText(await readFile(path.join(work, vtt), 'utf8')) : '';
  const top = (info.comments || []).filter((c) => c.parent === 'root' || !c.parent)
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0)).slice(0, comments);
  const md = [
    `Source: https://www.youtube.com/watch?v=${id}`, `Fetched: ${new Date().toISOString()}`, '',
    `# ${info.title}`, '',
    `${info.channel || info.uploader} · ${fmtDate(info.upload_date)} · ${fmtDur(info.duration)} · ${info.view_count ?? '?'} views · ${info.like_count ?? '?'} likes · ${info.comment_count ?? '?'} comments`, '',
    '## Description', '', (info.description || '').slice(0, 1500), '',
    `## Transcript (${vtt ? (manual ? 'creator subtitles' : 'automatic captions; names and numbers may be misheard') : 'unavailable'})`, '',
    text || 'No English transcript was available.', '',
    '## Top comments', '',
    ...(top.length ? top.map((c) => `- ${c.author} (${c.like_count || 0} likes): ${c.text.replace(/\s+/g, ' ').slice(0, 800)}`) : ['No comments retrieved.']),
  ].join('\n');
  await mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await writeFile(out, md + '\n');
  await rm(work, { recursive: true, force: true });
  console.log(`${out}: ${text.split(/\s+/).filter(Boolean).length} transcript words, ${top.length} comments`);
}

if (mode === 'search') listing(`ytsearch${Number(flag('limit', 8))}:${target}`, Number(flag('limit', 8)));
else if (mode === 'channel') listing(target.replace(/\/?$/, '').replace(/\/(videos|featured)$/, '') + '/videos', Number(flag('limit', 15)));
else await transcript(target, maybeOut);
