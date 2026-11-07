// Vertical Shorts cut from an existing landscape video. Pure helpers: the speech "units" a
// selection is made of (a production's measured scenes, or ASR passages for an outside video),
// plan validation and deterministic repair, background measurement and the 1080×1920 overlay.
// The source picture is never re-made, only placed.
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHORT = {width: 1080, height: 1920, min: 60, max: 180};
export const CTA = {line1: 'WATCH THE FULL VIDEO', line2: 'Tap the link below ↓'};
// Phone chrome (top bar, caption, action rail) leaves this band clear; see lib/media.mjs safeArea.
export const SAFE = {top: 211, bottom: 1536};
// Bump when the overlay or encode changes so existing renders are rebuilt.
export const LAYOUT_VERSION = 2;
const LEAD = 0.25, TAIL = 0.45;

const join = words => words.map(w => w.text).join(' ').replace(/\s+([,.?!;:])/g, '$1');

/** Kai explainer: build/timeline.json scenes, word times relative to each scene. */
export function unitsFromKai(timeline) {
  return timeline.scenes.filter(s => s.words?.length).map(s => ({
    id: s.id, start: +(s.start + s.words[0].start).toFixed(3), end: +(s.start + s.words.at(-1).end).toFixed(3),
    text: s.text || join(s.words)}));
}

/** Rules story: timing.json scenes with the measured transcript.json words falling inside each. */
export function unitsFromScenes(scenes, words) {
  return scenes.map(s => {
    const inside = words.filter(w => w.start >= s.start - 0.05 && w.start < s.end);
    return inside.length ? {id: s.id, start: inside[0].start, end: inside.at(-1).end, text: join(inside)} : null;
  }).filter(Boolean);
}

/** Outside video: ASR words → sentences → passages of about `target` seconds, split only between sentences. */
export function unitsFromWords(words, target = 20) {
  const units = [];
  let cur = [], sent = [];
  const push = () => {
    if (!cur.length) return;
    units.push({id: `P${String(units.length + 1).padStart(2, '0')}`, start: cur[0].start, end: cur.at(-1).end, text: join(cur)});
    cur = [];
  };
  words.forEach((w, i) => {
    sent.push(w);
    const next = words[i + 1], pause = next && next.start - w.end > 0.9;
    if (/[.?!]["')\]]*$/.test(w.text) || pause || !next) {
      cur.push(...sent);
      sent = [];
      if (cur.at(-1).end - cur[0].start >= target || (pause && next.start - w.end > 2)) push();
    }
  });
  push();
  return units;
}

/** Clip times for units a..b inclusive: a small lead/tail that never reaches a neighbour's speech. */
export function clipBounds(list, a, b, duration) {
  const ia = list.findIndex(s => s.id === a), ib = list.findIndex(s => s.id === b);
  if (ia < 0 || ib < 0) throw new Error(`Unknown id ${ia < 0 ? a : b}`);
  if (ib < ia) throw new Error(`${a}..${b} runs backwards`);
  const prev = list[ia - 1], next = list[ib + 1];
  const start = Math.max(0, prev ? Math.max(list[ia].start - LEAD, (prev.end + list[ia].start) / 2) : list[ia].start - LEAD);
  const end = Math.min(duration, next ? Math.min(list[ib].end + TAIL, (list[ib].end + next.start) / 2) : list[ib].end + TAIL);
  return {start: +start.toFixed(3), end: +end.toFixed(3), duration: +(end - start).toFixed(3), ia, ib};
}

/** Check an agent's plan: count, 60–180 s, real ids, no overlap. Returns resolved shorts and errors. */
export function checkPlan(plan, list, {count, duration, min = SHORT.min, max = SHORT.max}) {
  const errors = [], shorts = [];
  const items = Array.isArray(plan?.shorts) ? plan.shorts : null;
  if (!items) return {errors: ['plan.json needs a "shorts" array.'], shorts};
  if (items.length !== count) errors.push(`Expected ${count} shorts, found ${items.length}.`);
  items.forEach((s, i) => {
    const id = `short-${String(i + 1).padStart(2, '0')}`;
    try {
      const b = clipBounds(list, s.from, s.to, duration);
      if (b.duration < min) errors.push(`${id} (${s.from}..${s.to}) is ${b.duration.toFixed(1)} s; it must be at least ${min} s.`);
      if (b.duration > max) errors.push(`${id} (${s.from}..${s.to}) is ${b.duration.toFixed(1)} s; it must be at most ${max} s.`);
      if (!String(s.why || '').trim()) errors.push(`${id} needs a "why".`);
      if (!String(s.title || '').trim()) errors.push(`${id} needs a "title".`);
      else if (s.title.trim().length > 90) errors.push(`${id} title is ${s.title.trim().length} characters; keep it under 90.`);
      shorts.push({id, ...s, ...b});
    } catch (e) {
      errors.push(`${id}: ${e.message}`);
    }
  });
  const sorted = [...shorts].sort((x, y) => x.start - y.start);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].ia <= sorted[i - 1].ib) errors.push(`${sorted[i - 1].id} and ${sorted[i].id} overlap.`);
  return {errors, shorts};
}

/** Cut text at a word boundary to at most n characters. */
export const clip = (text, n) => text.length <= n ? text : text.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';

/**
 * Final, deterministic repair after the one agent fix: move clear of earlier shorts, trim long
 * clips from the end, stretch short ones unit by unit, and drop what still cannot fit.
 * Never invents a new selection; every change is recorded.
 */
export function repairPlan(plan, list, {count, duration, min = SHORT.min, max = SHORT.max}) {
  const actions = [], taken = [], kept = [];
  const items = (Array.isArray(plan?.shorts) ? plan.shorts : []).slice(0, count);
  const free = (ia, ib) => taken.every(t => ib < t.ia || ia > t.ib);
  items.forEach((s, i) => {
    let ia = list.findIndex(x => x.id === s.from), ib = list.findIndex(x => x.id === s.to);
    if (ia < 0 || ib < 0 || ib < ia) return actions.push(`Dropped entry ${i + 1}: invalid range.`);
    for (let c; (c = taken.find(t => !(ib < t.ia || ia > t.ib)));) {
      if (c.ia <= ia) ia = c.ib + 1; else ib = c.ia - 1;
      if (ia >= list.length || ib < ia) return actions.push(`Dropped entry ${i + 1}: overlaps an earlier short.`);
    }
    const len = () => clipBounds(list, list[ia].id, list[ib].id, duration).duration;
    while (len() > max && ib > ia) ib--;
    while (len() < min) {
      if (ib + 1 < list.length && free(ia, ib + 1)) ib++;
      else if (ia > 0 && free(ia - 1, ib)) ia--;
      else break;
    }
    if (len() < min || len() > max || !free(ia, ib))
      return actions.push(`Dropped entry ${i + 1}: no ${min}–${max} s range fits without overlap.`);
    if (list[ia].id !== s.from || list[ib].id !== s.to)
      actions.push(`Entry ${i + 1}: ${s.from}..${s.to} adjusted to ${list[ia].id}..${list[ib].id}.`);
    taken.push({ia, ib});
    let title = String(s.title || '').trim();
    if (!title || title.length > 90) {
      actions.push(`Entry ${i + 1}: title ${title ? 'shortened' : 'taken from its opening line'}.`);
      title = clip(title || list[ia].text, 90);
    }
    kept.push({...s, title, why: s.why || title, from: list[ia].id, to: list[ib].id});
  });
  if (kept.length < count) actions.push(`Delivering ${kept.length} of ${count} requested shorts.`);
  return {plan: {...plan, shorts: kept}, actions};
}

/** First and last `n` sentences of a passage, for the text-only review. */
export function ends(text, n = 2) {
  const s = text.match(/[^.?!]+[.?!]+["')\]]*|[^.?!]+$/g)?.map(x => x.trim()).filter(Boolean) || [text];
  return {opening: s.slice(0, n).join(' '), closing: s.slice(-n).join(' ')};
}

/** Most-common edge colour of the picture, and whether the edges are flat enough to extend with it. */
export function edgeBackground(samples, tolerance = 14) {
  if (!samples.length) throw new Error('No edge pixels sampled.');
  const key = ([r, g, b]) => `${r >> 3},${g >> 3},${b >> 3}`;
  const counts = new Map();
  for (const p of samples) counts.set(key(p), (counts.get(key(p)) || 0) + 1);
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const bucket = samples.filter(p => key(p) === mode);
  const color = [0, 1, 2].map(c => Math.round(bucket.reduce((s, p) => s + p[c], 0) / bucket.length));
  const near = samples.filter(p => Math.max(...p.map((v, c) => Math.abs(v - color[c]))) <= tolerance).length;
  const share = near / samples.length;
  return {mode: share >= 0.97 ? 'solid' : 'blur', color: '#' + color.map(v => v.toString(16).padStart(2, '0')).join(''), share: +share.toFixed(4)};
}

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Word index to colour as the accent: the requested word, else the first ALL-CAPS word of 3+ letters. */
export function accentIndex(title, accent) {
  const words = title.split(/\s+/);
  const bare = w => w.replace(/[^\p{L}\p{N}]/gu, '');
  if (accent) return words.findIndex(w => bare(w).toLowerCase() === String(accent).toLowerCase());
  return words.findIndex(w => /^\p{Lu}{3,}$/u.test(bare(w)));
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/** Transparent 1080×1920 overlay: title above the picture, call to action below it. */
export function overlayHtml({title, accent, cta = CTA, background, videoHeight}) {
  const font = f => pathToFileURL(path.join(ROOT, 'node_modules/@fontsource/inter/files', f)).href;
  const dark = background.mode === 'blur' || luminance(background.color) < 0.35;
  const ink = dark ? '#f4f4f2' : '#141414', hot = dark ? '#ffc933' : '#b36b00';
  const shadow = background.mode === 'blur' ? 'text-shadow:0 4px 18px rgba(0,0,0,.75),0 2px 4px rgba(0,0,0,.6);' : '';
  const top = Math.round((SHORT.height - videoHeight) / 2), bottom = top + videoHeight;
  const ai = accentIndex(title, accent);
  const words = title.split(/\s+/).map((w, i) => i === ai ? `<span class="hot">${esc(w)}</span>` : esc(w)).join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:ShortInter;font-weight:800;src:url(${font('inter-latin-800-normal.woff2')})}
@font-face{font-family:ShortInter;font-weight:900;src:url(${font('inter-latin-900-normal.woff2')})}
html,body{margin:0;width:${SHORT.width}px;height:${SHORT.height}px;background:transparent;overflow:hidden;font-family:ShortInter}
.box{position:absolute;left:70px;right:70px;display:flex;flex-direction:column;align-items:center;text-align:center;color:${ink};${shadow}}
#title{top:${SAFE.top + 30}px;height:${top - SAFE.top - 80}px;justify-content:center}
#title div{font-weight:900;line-height:1.08;letter-spacing:-1px;font-size:84px}
#cta{top:${bottom + 76}px;height:${SAFE.bottom - bottom - 76}px}
.hot{color:${hot}}
.a{color:${hot};font-weight:900;font-size:58px;letter-spacing:1px;white-space:nowrap}
.b{margin-top:18px;font-weight:800;font-size:44px;white-space:nowrap}
</style></head><body>
<div class="box" id="title"><div>${words}</div></div>
<div class="box" id="cta"><div class="a">${esc(cta.line1)}</div><div class="b">${esc(cta.line2)}</div></div>
<script>
// Shrink the title to two lines where it can (down to 60px), then until it fits its band; never stretch it.
const box=document.getElementById('title'),t=box.firstElementChild;let s=84;
const lines=()=>Math.round(t.scrollHeight/(s*1.08));
const over=()=>t.scrollHeight>box.clientHeight||t.scrollWidth>box.clientWidth;
const cta=()=>[...document.querySelectorAll('#cta div')].some(d=>d.scrollWidth>d.parentElement.clientWidth);
const fit=()=>{while(s>60&&lines()>2){s-=2;t.style.fontSize=s+'px'}
while(s>40&&over()){s-=2;t.style.fontSize=s+'px'}};
document.fonts.ready.then(()=>{fit();document.body.dataset.fit=JSON.stringify({titleSize:s,titleLines:lines(),titleOverflow:over(),ctaOverflow:cta()});document.body.dataset.ready=1});
</script></body></html>`;
}
