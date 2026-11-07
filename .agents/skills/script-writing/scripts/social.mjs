#!/usr/bin/env node
// Retain public community discussion as Markdown evidence. No dependencies.
//   node social.mjs reddit-search "<query>" <out.md> [--sub LocalLLaMA] [--limit 10]
//   node social.mjs reddit-thread <post-url> <out.md>
//   node social.mjs hn-search "<query>" <out.md> [--limit 5]   (top stories + their top comments)
// Reddit's JSON API is often blocked for servers, so threads fall back to the public RSS feed.
// X (Twitter) has no public read API: use your harness's web search and record what it returns.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const [mode, target, out, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
if (!['reddit-search', 'reddit-thread', 'hn-search'].includes(mode) || !target || !out) {
  console.error('Usage: node social.mjs reddit-search|reddit-thread|hn-search <query-or-url> <out.md> [--sub name] [--limit n]');
  process.exit(2);
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, accept = '*/*') {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
      .catch((e) => ({ ok: false, status: 0, error: e }));
    if (res.ok) return res.text();
    last = new Error(`HTTP ${res.status} for ${url}`);
    if (res.status === 403 || res.status === 401 || res.status === 404) break;
    // 429 and transient failures: honour Retry-After, otherwise back off (Reddit allows few anonymous reads).
    const wait = Number(res.headers?.get?.('retry-after'));
    await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 90) * 1000 : 15000 * (attempt + 1));
  }
  throw last;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#32': ' ' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z#0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const strip = (html) => decode(decode(html || ''))
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(br|p|div|li)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/submitted by\s+\/u\/\S+\s+\[link\]\s+\[comments\]/gi, '')
  .replace(/\n\s*\n+/g, '\n')
  .trim();
const oneLine = (s, max = 1200) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
};

function atomEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    title: decode(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
    author: decode(e.match(/<author><name>([\s\S]*?)<\/name>/)?.[1] || ''),
    link: decode(e.match(/<link href="([^"]+)"/)?.[1] || ''),
    updated: e.match(/<updated>([^<]+)<\/updated>/)?.[1]?.slice(0, 10) || '',
    content: strip(e.match(/<content type="html">([\s\S]*?)<\/content>/)?.[1] || ''),
  }));
}

async function redditSearch(query) {
  const sub = flag('sub');
  const limit = Number(flag('limit', 10));
  const base = sub ? `https://www.reddit.com/r/${sub}/search.rss` : 'https://www.reddit.com/search.rss';
  const params = new URLSearchParams({ q: query, sort: 'relevance', t: 'all', limit: String(limit) });
  if (sub) params.set('restrict_sr', 'on');
  const entries = atomEntries(await get(`${base}?${params}`, 'application/atom+xml'))
    .filter((e) => e.link.includes('/comments/')).slice(0, limit);
  const lines = [`# Reddit search: ${query}${sub ? ` (r/${sub})` : ''}`, '',
    'Search results only. Retain the threads you cite with `reddit-thread`.', ''];
  for (const e of entries)
    lines.push(`- [${e.title}](${e.link}) · ${e.author} · ${e.updated}`, `  ${oneLine(e.content, 300)}`);
  if (!entries.length) lines.push('No threads returned.');
  return lines.join('\n');
}

async function redditThread(url) {
  const u = new URL(url);
  if (!/(^|\.)reddit\.com$/.test(u.hostname) || !u.pathname.includes('/comments/'))
    throw new Error('reddit-thread needs a reddit.com/r/<sub>/comments/<id>/ URL');
  const postPath = u.pathname.replace(/\/$/, '').replace(/\.(json|rss)$/i, '');
  // RSS answers anonymous servers more often than JSON; JSON adds scores when it is allowed.
  let rss = null;
  try {
    rss = atomEntries(await get(`https://www.reddit.com${postPath}/.rss?sort=top&limit=60`, 'application/atom+xml'));
  } catch (error) {
    rss = error;
  }
  if (Array.isArray(rss) && rss.length) {
    // The first entry is the post, the rest are comments (top-sorted, no scores).
    const [post, ...comments] = rss;
    const lines = [`# ${post.title}`, '', `${post.author} · ${post.updated} · via RSS (scores unavailable)`, '',
      post.content, '', '## Comments (top-sorted, flattened)', ''];
    for (const c of comments.slice(0, 40)) lines.push(`- ${c.author}: ${oneLine(c.content)}`);
    return lines.join('\n');
  }
  const json = JSON.parse(await get(`https://www.reddit.com${postPath}.json?limit=60&sort=top`, 'application/json'));
  const post = json[0].data.children[0].data;
  const lines = [`# ${post.title}`, '',
    `r/${post.subreddit} · u/${post.author} · score ${post.score} · ${new Date(post.created_utc * 1000).toISOString().slice(0, 10)}`,
    '', post.selftext || post.url, '', '## Top comments (sorted by score)', ''];
  const walk = (children, depth) => {
    for (const c of children || []) {
      if (c.kind !== 't1') continue;
      const d = c.data;
      lines.push(`${'  '.repeat(depth)}- u/${d.author} (score ${d.score}): ${oneLine(d.body)}`);
      if (depth < 2 && d.replies?.data?.children) walk(d.replies.data.children.slice(0, 3), depth + 1);
    }
  };
  walk(json[1].data.children.slice(0, 30), 0);
  return lines.join('\n');
}

async function hnSearch(query) {
  const limit = Number(flag('limit', 5));
  const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: String(limit) });
  const { hits } = JSON.parse(await get(`https://hn.algolia.com/api/v1/search?${params}`, 'application/json'));
  const lines = [`# Hacker News: ${query}`, ''];
  if (!hits.length) lines.push('No stories returned.');
  for (const h of hits) {
    lines.push(`## ${h.title}`, '',
      `https://news.ycombinator.com/item?id=${h.objectID} · ${h.points} points · ${h.num_comments} comments · ${h.created_at?.slice(0, 10)}${h.url ? ` · links ${h.url}` : ''}`, '');
    if (!h.num_comments) continue;
    const item = JSON.parse(await get(`https://hn.algolia.com/api/v1/items/${h.objectID}`, 'application/json'));
    // Algolia returns children in HN rank order.
    for (const c of (item.children || []).filter((c) => c.text).slice(0, 12)) {
      lines.push(`- ${c.author}: ${oneLine(strip(c.text))}`);
      for (const r of (c.children || []).filter((r) => r.text).slice(0, 2))
        lines.push(`  - ${r.author}: ${oneLine(strip(r.text), 600)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const text = mode === 'reddit-search' ? await redditSearch(target)
  : mode === 'reddit-thread' ? await redditThread(target)
  : await hnSearch(target);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `Source: ${mode} ${target}\nFetched: ${new Date().toISOString()}\n\n${text}\n`);
console.log(`${out}: ${text.split(/\s+/).filter(Boolean).length} words`);
