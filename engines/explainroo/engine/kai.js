// The explainer kit behind s.kai: the parts of a calm, dark explainer that
// builds each scene up piece by piece on the narration. Thin outlined cards,
// small uppercase labels, big numerals, tags on a stem, rubber stamps,
// grids that fill cell by cell, evidence cards with highlighted quotes, a
// chapter bar, a typing search bar, answer windows, gauges, meters, a
// memory budget bar, token conveyors and simple line drawings of hardware.
//
// Every part is a function of the scene time only. Text goes through s.text,
// so `check` sees it (size, overlap, edges and contrast against the shape
// under it). Shapes are drawn with s.draw. Positions are the center of the
// part unless the method says otherwise, in the frame's design pixels.

import { SceneError } from './stage.js';
import { layoutText, lineStartX } from './text.js';
import { fontString } from './themes.js';
import { withAlpha } from './util.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const outCubic = (p) => 1 - Math.pow(1 - p, 3);
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// Colors the kit adds to the look's ten. Looks keep their own red, yellow,
// blue and so on; these are the neutrals of the dark explainer style.
export const KAI_COLORS = {
  line: '#e9e9e4', // white outlines
  dim: '#3b4040', // outlines of things not yet active
  cell: '#1b1e1e', // empty grid cells and tiles
  cellLine: '#2c3131',
  paper: '#ece8d9', // cream cards
  paperInk: '#151616', // text on cream and white cards
  white: '#f4f4f0',
  card: '#121414', // fill inside outlined cards
};

export class Kai {
  constructor(s) {
    this.s = s;
    this.colors = { ...KAI_COLORS };
  }

  // A color name from the kit (line, dim, cell, paper...) or from the look.
  color(name, fallback = 'line') {
    const n = name ?? fallback;
    if (this.colors[n]) return this.colors[n];
    return this.s.color(n);
  }

  _time(v, fallback = 0) {
    return v === undefined || v === null ? fallback : this.s.time(v);
  }

  // Plays a light sound at `at` unless sfx is false. Negative times mean
  // "already on screen", so they stay silent.
  _sound(o, name, gain) {
    if (o.sfx === false || !name) return;
    const at = this._time(o.at);
    if (at < 0) return;
    this.s.sfx(typeof o.sfx === 'string' ? o.sfx : name, at, { gain: o.sfxGain ?? gain });
  }

  // A part that enters and leaves as one piece around (x, y). `fn` draws in
  // local coordinates, with (0, 0) at the part's center.
  _unit(o, box, fn, { enter = 'fade', dur = 0.4, sfx = 'pop', gain = 0.22 } = {}) {
    const s = this.s;
    if (o.id !== undefined) s._register(o.id, o.x ?? 0, o.y ?? 0, box.w, box.h);
    s.group({ x: o.x ?? 0, y: o.y ?? 0, at: o.at ?? 0, out: o.out, enter: o.enter ?? enter, exit: o.exit, dur: o.dur ?? dur, outDur: o.outDur, rotate: o.rotate, scale: o.scale, sfx: null }, () => fn());
    this._sound(o, sfx, gain);
    return box;
  }

  // Text inside a unit: no entrance of its own, same time as the unit.
  _text(str, o) {
    return this.s.text(str, { enter: 'none', sfx: false, ...o });
  }

  _geom(x, y, w, h) {
    return { x, y, w, h, left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
  }

  _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  }

  // ---------- text ----------

  // A small uppercase label in the mono font, letter spaced and muted, like
  // MEMORY or READ PER WORD. align: center (default), left or right.
  label(text, o = {}) {
    return this.s.text(String(text).toUpperCase(), {
      font: 'mono', size: o.size ?? 26, color: o.color ?? 'muted', tracking: o.tracking ?? 0.14,
      enter: o.enter ?? 'fade', dur: o.dur ?? 0.35, ...o, maxWidth: o.maxWidth ?? 1400,
    });
  }

  // A bold headline word or short phrase in the display font.
  word(text, o = {}) {
    return this.s.text(text, { font: 'display', size: o.size ?? 72, color: o.color ?? 'ink', enter: o.enter ?? 'fade', dur: o.dur ?? 0.35, ...o });
  }

  // A big numeral with a small caps label under it, like "6B / READ PER
  // WORD". Counts up from `from` when given, otherwise appears as written.
  // value: a number (counts) or a string (shown as is).
  counter(value, o = {}) {
    const s = this.s;
    const size = o.size ?? 150;
    const x = o.x ?? s.cx;
    const y = o.y ?? s.cy;
    const color = o.color ?? 'blue';
    let g;
    if (typeof value === 'number' && o.from !== undefined) {
      g = s.number(value, { x, y, size, color, from: o.from, dur: o.countDur ?? 1.2, decimals: o.decimals, prefix: o.prefix, suffix: o.suffix, separator: o.separator, at: o.at, out: o.out, enter: 'fade', id: o.id, align: o.align, tracking: -0.02 });
    } else {
      g = s.text(`${o.prefix ?? ''}${value}${o.suffix ?? ''}`, { font: 'display', size, color, x, y, at: o.at, out: o.out, enter: o.enter ?? 'pop', dur: 0.45, id: o.id, align: o.align, tracking: -0.02, sfx: false });
    }
    if (o.label) {
      const lx = o.align === 'left' ? g.left : o.align === 'right' ? g.right : g.x;
      this.label(o.label, { x: lx, y: g.bottom + (o.labelGap ?? size * 0.08) + 14, align: o.align, size: o.labelSize ?? 28, color: o.labelColor ?? 'muted', at: o.labelAt ?? o.at, out: o.out });
    }
    this._sound(o, typeof value === 'number' && o.from !== undefined ? 'tick' : 'pop', 0.2);
    return g;
  }

  // ---------- cards, tags and stamps ----------

  // An outlined card. Options: w, h, label (small caps, top left), title
  // (bold display text), value (a big numeral), sub (muted line under the
  // title), color (outline), dashed, paper (a cream card with dark text),
  // fill, check or cross (a mark in the top right corner, with its own
  // time: check: true or check: 'word'), align ('left' or 'center').
  card(o = {}) {
    const s = this.s;
    const w = o.w ?? 360;
    const h = o.h ?? 200;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const paper = Boolean(o.paper);
    const fill = paper ? this.colors.paper : o.fill ? this.color(o.fill) : this.colors.card;
    const stroke = paper ? 'none' : this.color(o.color ?? 'line');
    const ink = paper ? this.colors.paperInk : 'ink';
    const left = o.align === 'center' ? 0 : -w / 2 + (o.pad ?? 28);
    const align = o.align === 'center' ? 'center' : 'left';
    const at = o.at ?? 0;
    this._unit(o, box, () => {
      s.draw({ at, enter: 'none' }, (ctx) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 8;
        ctx.shadowBlur = 0;
        ctx.fillStyle = fill;
        this._rrect(ctx, -w / 2, -h / 2, w, h, o.radius ?? 6);
        ctx.fill();
        ctx.restore();
        if (stroke !== 'none') {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = o.width ?? 3;
          if (o.dashed) ctx.setLineDash([10, 7]);
          this._rrect(ctx, -w / 2, -h / 2, w, h, o.radius ?? 6);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      const top = -h / 2;
      const markRoom = o.check || o.cross ? 76 : 0;
      if (o.label) this._text(String(o.label).toUpperCase(), { font: 'mono', size: o.labelSize ?? 24, tracking: 0.14, color: paper ? '#5b5a52' : 'muted', under: fill, x: left, y: top + 30, align, valign: 'top', at, maxWidth: w - 56 - markRoom });
      // Title, value and sub stack in the middle of the card, under the label.
      const parts = [];
      if (o.title) parts.push(['title', (o.titleSize ?? 50) * 1.05]);
      if (o.value !== undefined) parts.push(['value', (o.valueSize ?? 72) * 0.95]);
      if (o.sub) parts.push(['sub', (o.subSize ?? 24) * 1.3]);
      const gapY = 10;
      const stackH = parts.reduce((a, [, ph]) => a + ph, 0) + gapY * Math.max(0, parts.length - 1);
      let py = (o.label ? 22 : 0) - stackH / 2;
      const yOf = {};
      for (const [name, ph] of parts) {
        yOf[name] = py + ph / 2;
        py += ph + gapY;
      }
      if (o.title) this._text(o.title, { font: 'display', size: o.titleSize ?? 50, color: o.titleColor ?? ink, under: fill, x: left, y: yOf.title, align, at: o.titleAt ?? at, enter: o.titleAt !== undefined ? 'fade' : 'none', maxWidth: w - 56, lineHeight: 1.05 });
      if (o.value !== undefined) this._text(String(o.value), { font: 'display', size: o.valueSize ?? 72, color: o.valueColor ?? (paper ? ink : 'yellow'), under: fill, x: left, y: yOf.value, align, at: o.valueAt ?? at, enter: o.valueAt !== undefined ? 'pop' : 'none', maxWidth: w - 56 });
      if (o.sub) this._text(o.sub, { font: 'mono', size: o.subSize ?? 24, color: paper ? '#5b5a52' : 'muted', under: fill, x: left, y: yOf.sub, align, at: o.subAt ?? at, enter: o.subAt !== undefined ? 'fade' : 'none', maxWidth: w - 56 });
      for (const kind of ['check', 'cross']) {
        if (!o[kind]) continue;
        const mAt = o[kind] === true ? at : o[kind];
        const mColor = this.color(o.markColor ?? (kind === 'check' ? (o.color && o.color !== 'line' ? o.color : 'green') : 'red'));
        s.draw({ at: mAt, enter: 'none', x: w / 2 - 50, y: -h / 2 + 46 }, (ctx) => {
          const p = outCubic(clamp((s.t - s.time(mAt)) / (0.35 / s.pace)));
          ctx.strokeStyle = mColor;
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          if (kind === 'check') {
            const pts = [[-20, 0], [-6, 14], [22, -16]];
            const L1 = Math.hypot(14, 14);
            const L2 = Math.hypot(28, 30);
            const d = p * (L1 + L2);
            ctx.moveTo(...pts[0]);
            if (d <= L1) ctx.lineTo(lerp(-20, -6, d / L1), lerp(0, 14, d / L1));
            else { ctx.lineTo(...pts[1]); ctx.lineTo(lerp(-6, 22, (d - L1) / L2), lerp(14, -16, (d - L1) / L2)); }
          } else {
            const q = p * 2;
            ctx.moveTo(-16, -16); ctx.lineTo(lerp(-16, 16, clamp(q)), lerp(-16, 16, clamp(q)));
            if (q > 1) { ctx.moveTo(16, -16); ctx.lineTo(lerp(16, -16, q - 1), lerp(-16, 16, q - 1)); }
          }
          ctx.stroke();
        });
        if (o[kind] !== true) this._sound({ at: mAt, sfx: o.sfx }, 'click', 0.3);
      }
    }, { enter: o.enter ?? 'fade', sfx: 'pop', gain: 0.2 });
    return box;
  }

  // A small tag hanging from a pin on a short stem, like SPEED CLAIM or
  // ANSWER?. color: yellow (filled, dark text, default), red, blue, or line
  // (dark tag with a white outline). (x, y) is the tag's center; the stem
  // goes up from it by `stem` pixels (0 for none).
  tag(text, o = {}) {
    const s = this.s;
    const size = o.size ?? 34;
    const str = String(text).toUpperCase();
    const font = fontString(s.theme, 'display', size);
    s.ctx.save();
    s.ctx.font = font;
    const tw = s.ctx.measureText(str).width;
    s.ctx.restore();
    const pad = size * 0.5;
    const w = tw + pad * 2;
    const stem = o.stem ?? 54;
    const h = size * (stem ? 1.9 : 1.55);
    const tone = o.color ?? 'yellow';
    const outline = tone === 'line';
    const fill = outline ? this.colors.card : this.color(tone);
    const ink = outline ? 'ink' : tone === 'yellow' ? this.colors.paperInk : '#ffffff';
    const box = this._geom(o.x ?? s.cx, (o.y ?? s.cy) - stem / 2, w, h + stem);
    this._unit({ ...o, id: undefined }, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 2.5;
        if (stem) {
          ctx.beginPath();
          ctx.moveTo(0, -h / 2 - stem);
          ctx.lineTo(0, -h / 2 + 8);
          ctx.stroke();
          ctx.fillStyle = this.colors.line;
          ctx.beginPath();
          ctx.arc(0, -h / 2 - stem, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = fill;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 3);
        ctx.fill();
        ctx.restore();
        if (outline) {
          ctx.strokeStyle = this.colors.line;
          ctx.lineWidth = 2.5;
          this._rrect(ctx, -w / 2, -h / 2, w, h, 3);
          ctx.stroke();
        }
        if (stem) {
          ctx.fillStyle = outline ? this.colors.line : this.colors.paperInk;
          ctx.beginPath();
          ctx.arc(0, -h / 2 + 8, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      this._text(str, { font: 'display', size, color: ink, under: fill, x: 0, y: size * (stem ? 0.3 : 0.08), at: o.at ?? 0 });
    }, { enter: o.enter ?? 'drop', dur: 0.5, sfx: 'blip', gain: 0.22 });
    if (o.id !== undefined) s._ids.set(String(o.id), { x: box.x, y: o.y ?? s.cy, w, h, shape: 'rect' });
    return this._geom(box.x, o.y ?? s.cy, w, h);
  }

  // A capsule with a word in it, like HYPE. filled: true fills it.
  pill(text, o = {}) {
    const s = this.s;
    const size = o.size ?? 32;
    const str = o.caps === false ? String(text) : String(text).toUpperCase();
    s.ctx.save();
    s.ctx.font = fontString(s.theme, 'display', size);
    const tw = s.ctx.measureText(str).width;
    s.ctx.restore();
    const w = o.w ?? tw + size * 1.6;
    const h = size * 1.7;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const color = this.color(o.color ?? 'line');
    const fill = o.filled ? color : this.colors.card;
    const ink = o.filled ? (o.color === 'yellow' || !o.color || o.color === 'line' ? this.colors.paperInk : '#ffffff') : 'ink';
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.fillStyle = fill;
        this._rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        if (o.dashed) ctx.setLineDash([8, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      this._text(str, { font: o.mono ? 'mono' : 'display', size, color: o.textColor ?? ink, under: fill, x: 0, y: size * 0.05, at: o.at ?? 0, tracking: o.mono ? 0.08 : 0 });
    }, { enter: 'pop', dur: 0.45, sfx: 'pop', gain: 0.2 });
    return box;
  }

  // A rotated rubber stamp, like NOT MY SETUP or VENDOR NUMBERS. It slams
  // in with a thud. color: red (default), yellow, blue or line.
  stamp(text, o = {}) {
    const s = this.s;
    const size = o.size ?? 54;
    const str = String(text).toUpperCase();
    s.ctx.save();
    s.ctx.font = fontString(s.theme, 'mono', size, 800);
    s.ctx.letterSpacing = `${size * 0.04}px`;
    const tw = s.ctx.measureText(str).width;
    s.ctx.restore();
    const w = tw + size * 1.1;
    const h = size * 1.75;
    const color = this.color(o.color ?? 'red');
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    this._unit({ rotate: -9, ...o }, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.fillStyle = 'rgba(14,16,16,0.82)';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.lineWidth = 2;
        ctx.strokeRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
      });
      this._text(str, { font: 'mono', weight: 800, size, color, under: '#0e1010', x: 0, y: size * 0.04, tracking: 0.04, at: o.at ?? 0 });
    }, { enter: 'zoom', dur: 0.32, sfx: 'thud', gain: 0.45 });
    return box;
  }

  // ---------- grids, tiles and bars ----------

  // A grid of small cells that fill one by one. (x, y) is the center.
  // Options: cols, rows, cell (size), gap, frame (white outline around it),
  // label (under it), color (filled cells), fills: [{ at, dur, count,
  // color, from }] (cells from..from+count fill in order over dur), dots:
  // [{ i, at, color }] single cells that light up, sweep: { at, dur, color,
  // width } a band of light that runs across the columns.
  grid(o = {}) {
    const s = this.s;
    const cols = o.cols ?? 24;
    const rows = o.rows ?? 8;
    const cell = o.cell ?? 22;
    const gap = o.gap ?? 6;
    const pad = o.frame === false ? 0 : o.pad ?? 14;
    const gw = cols * cell + (cols - 1) * gap;
    const gh = rows * cell + (rows - 1) * gap;
    const w = gw + pad * 2;
    const h = gh + pad * 2;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const fills = (o.fills ?? []).map((f) => ({ from: 0, dur: 1.5, color: o.color ?? 'blue', ...f, at: s.time(f.at ?? o.at ?? 0) }));
    const dots = (o.dots ?? []).map((d) => ({ color: o.color ?? 'blue', ...d, at: s.time(d.at ?? o.at ?? 0) }));
    const sweep = o.sweep ? { dur: 2, width: 4, color: 'yellow', ...o.sweep, at: s.time(o.sweep.at ?? o.at ?? 0) } : null;
    const total = cols * rows;
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        if (o.frame !== false) {
          ctx.fillStyle = this.colors.card;
          this._rrect(ctx, -w / 2, -h / 2, w, h, 8);
          ctx.fill();
          ctx.strokeStyle = this.color(o.frameColor ?? 'line');
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        const colorAt = new Array(total).fill(null);
        for (const f of fills) {
          const n = Math.floor((f.count ?? total) * clamp((s.t - f.at) / Math.max(0.01, f.dur / s.pace)) + 1e-6);
          for (let k = 0; k < n && f.from + k < total; k++) colorAt[f.from + k] = this.color(f.color);
        }
        for (const d of dots) if (s.t >= d.at && d.i < total) colorAt[d.i] = this.color(d.color);
        let band = null;
        if (sweep && s.t >= sweep.at && s.t < sweep.at + sweep.dur / s.pace) band = lerp(-sweep.width, cols + sweep.width, (s.t - sweep.at) / (sweep.dur / s.pace));
        const x0 = -gw / 2;
        const y0 = -gh / 2;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const cx = x0 + c * (cell + gap);
            const cy = y0 + r * (cell + gap);
            let fillC = colorAt[i];
            if (band !== null && Math.abs(c - band) < sweep.width / 2) fillC = this.color(sweep.color);
            ctx.fillStyle = fillC ?? this.colors.cell;
            this._rrect(ctx, cx, cy, cell, cell, Math.min(4, cell / 5));
            ctx.fill();
            if (!fillC) {
              ctx.strokeStyle = this.colors.cellLine;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }
      });
    }, { enter: 'fade', sfx: 'pop', gain: 0.15 });
    if (o.label) this.label(o.label, { x: box.x, y: box.bottom + 32, at: o.labelAt ?? o.at, out: o.out, color: o.labelColor ?? 'muted', size: o.labelSize ?? 26 });
    for (const f of o.fills ?? []) if (f.sfx !== false) this._sound({ at: f.at ?? o.at, sfx: o.sfx }, 'rise', 0.12);
    return box;
  }

  // A row of word tiles, like the words of a prompt: white tiles with dark
  // mono text. (x, y) is the left edge and vertical center. Each word can be
  // a string or { text, at, color }; without their own times they appear
  // one after another from `at`, `stagger` seconds apart.
  tokens(words, o = {}) {
    const s = this.s;
    const size = o.size ?? 34;
    const gap = o.gap ?? 12;
    const h = size * 1.6;
    let x = o.x ?? s.safe.x;
    const y = o.y ?? s.cy;
    const at0 = s.time(o.at ?? 0);
    const out = [];
    s.ctx.save();
    s.ctx.font = fontString(s.theme, 'mono', size, 700);
    words.forEach((wd, i) => {
      const item = typeof wd === 'string' ? { text: wd } : wd;
      const tw = s.ctx.measureText(item.text).width;
      const w = tw + size * 0.9;
      const at = item.at !== undefined ? item.at : at0 + i * (o.stagger ?? 0.25);
      const fill = this.color(item.color ?? 'white');
      const ink = item.color && !['white', 'yellow', 'paper'].includes(item.color) ? '#ffffff' : this.colors.paperInk;
      const cx = x + w / 2;
      this._unit({ x: cx, y, at, out: item.out ?? o.out, sfx: o.sfx }, this._geom(cx, y, w, h), () => {
        s.draw({ at, enter: 'none' }, (ctx) => {
          ctx.fillStyle = fill;
          this._rrect(ctx, -w / 2, -h / 2, w, h, 5);
          ctx.fill();
          if (item.dashed) {
            ctx.strokeStyle = this.color('yellow');
            ctx.setLineDash([6, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        this._text(item.text, { font: 'mono', weight: 700, size, color: ink, under: fill, x: 0, y: size * 0.04, at });
      }, { enter: 'pop', dur: 0.35, sfx: 'blip', gain: 0.12 });
      out.push(this._geom(cx, y, w, h));
      x += w + gap;
    });
    s.ctx.restore();
    return out;
  }

  // Flat vertical bars on a baseline, values above them. data: [{ label,
  // value, color, at, text }]. (x, y) is the center of the chart area; w, h
  // its size. Bars grow when they appear.
  bars(data, o = {}) {
    const s = this.s;
    const w = o.w ?? 720;
    const h = o.h ?? 360;
    const cx = o.x ?? s.cx;
    const cy = o.y ?? s.cy;
    const max = o.max ?? Math.max(...data.map((d) => d.value));
    const n = data.length;
    const slot = w / n;
    const bw = o.barWidth ?? Math.min(slot * 0.62, 150);
    const base = cy + h / 2;
    const at0 = s.time(o.at ?? 0);
    s.draw({ at: at0, out: o.out, enter: 'none' }, (ctx) => {
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 3;
      const p = outCubic(clamp((s.t - at0) / (0.5 / s.pace)));
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 - 10, base);
      ctx.lineTo(cx - w / 2 - 10 + (w + 20) * p, base);
      ctx.stroke();
    });
    data.forEach((d, i) => {
      const at = d.at !== undefined ? s.time(d.at) : at0 + i * (o.stagger ?? 0.3);
      const bx = cx - w / 2 + slot * (i + 0.5);
      const bh = (d.value / max) * (h - (o.valueSize ?? 44) * 1.4);
      const color = this.color(d.color ?? o.color ?? 'blue');
      s.draw({ at, out: o.out, enter: 'none' }, (ctx) => {
        const p = outCubic(clamp((s.t - at) / ((o.growDur ?? 0.7) / s.pace)));
        ctx.fillStyle = color;
        ctx.fillRect(bx - bw / 2, base - bh * p, bw, bh * p);
      });
      this._sound({ at, sfx: o.sfx }, 'pop', 0.14);
      s.text(d.text ?? String(d.value), { font: 'display', size: o.valueSize ?? 44, color: d.valueColor ?? (d.color ?? o.color ?? 'blue'), x: bx, y: base - bh - (o.valueSize ?? 44) * 0.65, at: at + 0.35, out: o.out, enter: 'fade', dur: 0.3, sfx: false });
      if (d.label) this.label(d.label, { x: bx, y: base + 34, at, out: o.out, size: o.labelSize ?? 24, color: d.labelColor ?? 'muted', maxWidth: slot - 8 });
    });
    return this._geom(cx, cy, w, h);
  }

  // A horizontal bar split into parts that add up, like a memory budget.
  // segments: [{ label, value, color, at, row }]; total: the full length
  // (default: the sum). limit: { value, label, at } draws a dashed line
  // where the budget ends. Labels sit under their part; give small parts
  // row: 1 to put the label one row lower. unit: text after the values.
  stack(segments, o = {}) {
    const s = this.s;
    const w = o.w ?? 1300;
    const h = o.h ?? 74;
    const cx = o.x ?? s.cx;
    const cy = o.y ?? s.cy;
    const sum = segments.reduce((a, b) => a + b.value, 0);
    const total = o.total ?? Math.max(sum, o.limit?.value ?? 0);
    const x0 = cx - w / 2;
    const at0 = s.time(o.at ?? 0);
    const unit = o.unit ?? '';
    const dec = o.decimals ?? 2;
    s.draw({ at: at0, out: o.out, enter: 'none' }, (ctx) => {
      ctx.fillStyle = this.colors.cell;
      ctx.fillRect(x0, cy - h / 2, w, h);
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, cy - h / 2, w, h);
    });
    this._sound({ at: at0, sfx: o.sfx }, 'pop', 0.16);
    let acc = 0;
    segments.forEach((seg, i) => {
      const at = seg.at !== undefined ? s.time(seg.at) : at0 + i * 0.5;
      const sx = x0 + (acc / total) * w;
      const sw = (seg.value / total) * w;
      acc += seg.value;
      const color = this.color(seg.color ?? 'blue');
      s.draw({ at, out: o.out, enter: 'none' }, (ctx) => {
        const p = outCubic(clamp((s.t - at) / (0.6 / s.pace)));
        ctx.fillStyle = color;
        ctx.fillRect(sx + 1.5, cy - h / 2 + 1.5, Math.max(0, sw * p - 3), h - 3);
      });
      this._sound({ at, sfx: o.sfx }, 'blip', 0.14);
      if (seg.label !== false) {
        const row = seg.row ?? 0;
        const ly = cy + h / 2 + 40 + row * 74;
        const lx = seg.anchor === 'right' ? sx + sw : seg.anchor === 'left' ? sx : sx + sw / 2;
        const align = seg.anchor === 'right' ? 'right' : seg.anchor === 'left' ? 'left' : 'center';
        if (row > 0) {
          s.draw({ at, out: o.out, enter: 'none' }, (ctx) => {
            ctx.strokeStyle = this.colors.dim;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx + sw / 2, cy + h / 2 + 6);
            ctx.lineTo(sx + sw / 2, ly - 22);
            ctx.stroke();
          });
        }
        this.label(seg.label ?? '', { x: lx, y: ly, align, at, out: o.out, size: 24, color: 'muted' });
        s.text(seg.text ?? `${seg.value.toFixed(dec)}${unit}`, { font: 'display', size: 34, color: seg.valueColor ?? seg.color ?? 'ink', x: lx, y: ly + 36, align, at: at + 0.2, out: o.out, enter: 'fade', dur: 0.3, sfx: false });
      }
    });
    if (o.limit) {
      const at = s.time(o.limit.at ?? at0);
      const lx = x0 + (o.limit.value / total) * w;
      s.draw({ at, out: o.out, enter: 'none' }, (ctx) => {
        ctx.strokeStyle = this.color(o.limit.color ?? 'red');
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.moveTo(lx, cy - h / 2 - 70);
        ctx.lineTo(lx, cy + h / 2 + 14);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      if (o.limit.label) this.label(o.limit.label, { x: lx, y: cy - h / 2 - 92, at, out: o.out, color: o.limit.color ?? 'red', size: 26, align: o.limit.align ?? 'center' });
    }
    return this._geom(cx, cy, w, h);
  }

  // A vertical capsule that fills up, like TIME or MONEY. value: a number
  // from 0 to 1, or keys [{ at, v }] it moves between.
  meter(o = {}) {
    const s = this.s;
    const w = o.w ?? 56;
    const h = o.h ?? 220;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const keys = Array.isArray(o.value) ? o.value.map((k) => ({ ...k, at: s.time(k.at) })) : [{ at: s.time(o.at ?? 0), v: o.value ?? 1 }];
    const color = this.color(o.color ?? 'blue');
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        let v = 0;
        let prev = 0;
        for (const k of keys) {
          if (s.t < k.at) break;
          v = lerp(prev, k.v, inOut(clamp((s.t - k.at) / (0.9 / s.pace))));
          prev = k.v;
        }
        ctx.fillStyle = this.colors.cell;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, h / 2 - h * v, w, h * v);
        ctx.restore();
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 3;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.stroke();
      });
    }, { sfx: 'pop', gain: 0.15 });
    if (o.label) this.label(o.label, { x: box.x, y: box.bottom + 30, at: o.at, out: o.out, size: 24 });
    return box;
  }

  // ---------- evidence ----------

  // A quote from a real source on a white card, with *starred* words marked
  // in yellow on `markAt`, and a source chip under the card. Options: w,
  // size, source (the chip text), kind (a small caps line above the quote,
  // like TECHNICAL REPORT), markAt.
  evidence(o = {}) {
    const s = this.s;
    const w = o.w ?? 780;
    const size = o.size ?? 36;
    const pad = 36;
    const quote = o.quote ?? '';
    const font = fontString(s.theme, 'body', size, 500);
    const lay = layoutText(s.ctx, { str: `“${quote}”`, font, size, maxWidth: w - pad * 2, lineHeight: 1.3 });
    const head = o.kind ? 52 : 0;
    const h = lay.height + pad * 2 + head;
    const x = o.x ?? s.cx;
    const y = o.y ?? s.cy;
    const box = this._geom(x, y, w, h);
    const at = o.at ?? 0;
    const markAt = o.markAt ?? s.time(at) + 1.1;
    const white = this.colors.white;
    const ink = this.colors.paperInk;
    const yellow = this.color('yellow');
    const textTop = -h / 2 + pad + head;
    this._unit({ rotate: o.tilt ?? -1, ...o }, box, () => {
      s.draw({ at, enter: 'none' }, (ctx) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = 7;
        ctx.shadowOffsetY = 9;
        ctx.fillStyle = white;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 6);
        ctx.fill();
        ctx.restore();
        // Marker strokes behind the starred words, swept left to right.
        const p = clamp((s.t - s.time(markAt)) / (0.7 / s.pace));
        if (p <= 0) return;
        const spans = [];
        for (const line of lay.lines) {
          const lx0 = -w / 2 + pad + lineStartX(line, lay.width, 'left');
          let run = null;
          for (const wd of line.words) {
            if (wd.accent) {
              if (run) run.x1 = lx0 + wd.x + wd.w;
              else run = { x0: lx0 + wd.x, x1: lx0 + wd.x + wd.w, y: textTop + line.y };
            } else if (run) {
              spans.push(run);
              run = null;
            }
          }
          if (run) spans.push(run);
        }
        const totalW = spans.reduce((a, b) => a + (b.x1 - b.x0), 0) || 1;
        let left = outCubic(p) * totalW;
        ctx.fillStyle = withAlpha(yellow, 0.72);
        for (const sp of spans) {
          const sw = Math.min(sp.x1 - sp.x0 + 12, left + 6);
          left -= sp.x1 - sp.x0;
          if (sw <= 0) break;
          ctx.fillRect(sp.x0 - 6, sp.y - size * 0.86, sw, size * 1.12);
        }
      });
      if (o.kind) this._text(String(o.kind).toUpperCase(), { font: 'mono', size: 24, tracking: 0.14, color: '#5f625e', under: white, x: -w / 2 + pad, y: -h / 2 + pad + 6, align: 'left', valign: 'top', at, maxWidth: w - pad * 2 });
      this._text(`“${quote}”`, { font: 'body', weight: 500, size, color: ink, mark: ink, under: white, x: -w / 2 + pad, y: textTop, align: 'left', valign: 'top', maxWidth: w - pad * 2, lineHeight: 1.3, at });
    }, { enter: 'rise', dur: 0.45, sfx: 'pop', gain: 0.2 });
    if (o.source) {
      this.chip(o.source, { x: o.sourceAlign === 'left' ? box.left : x, align: o.sourceAlign === 'left' ? 'left' : 'center', y: box.bottom + 48, rotate: (o.tilt ?? -1) * 1.5, at: o.sourceAt ?? at, out: o.out });
    }
    if (o.quote && /\*/.test(o.quote)) this._sound({ at: markAt, sfx: o.sfx }, 'scribble', 0.12);
    return box;
  }

  // A small source chip: dark capsule, white outline, mono text.
  chip(text, o = {}) {
    const s = this.s;
    const size = o.size ?? 24;
    const str = String(text).toUpperCase();
    s.ctx.save();
    s.ctx.font = fontString(s.theme, 'mono', size);
    s.ctx.letterSpacing = `${size * 0.1}px`;
    const tw = s.ctx.measureText(str).width;
    s.ctx.restore();
    const w = tw + size * 1.6;
    const h = size * 1.9;
    const cx = o.align === 'left' ? (o.x ?? s.cx) + w / 2 : o.x ?? s.cx;
    const box = this._geom(cx, o.y ?? s.cy, w, h);
    const color = this.color(o.color ?? 'line');
    this._unit({ ...o, x: cx }, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.fillStyle = this.colors.card;
        this._rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      this._text(str, { font: 'mono', size, color: o.textColor ?? 'ink', under: this.colors.card, x: 0, y: 1, tracking: 0.1, at: o.at ?? 0 });
    }, { enter: 'fade', dur: 0.3, sfx: false });
    return box;
  }

  // A document page: a cream sheet with a title and grey text lines, like a
  // model card or a paper. Options: w, h, title, kind (small caps above the
  // title), lines (count), pin (a yellow number tab on top).
  doc(o = {}) {
    const s = this.s;
    const w = o.w ?? 240;
    const h = o.h ?? 310;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const paper = this.colors.paper;
    const lines = o.lines ?? 7;
    const titleTop = -h / 2 + (o.kind ? 76 : 34);
    const titleH = o.title ? layoutText(s.ctx, { str: o.title, font: fontString(s.theme, 'display', o.titleSize ?? 32), size: o.titleSize ?? 32, maxWidth: w - 48, lineHeight: 1.05 }).height : 0;
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = paper;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
        ctx.fillStyle = '#b9b6aa';
        const top = o.title ? titleTop + titleH + 26 : -h / 2 + (o.kind ? 76 : 40);
        const step = (h / 2 - 30 - top) / Math.max(1, lines);
        for (let i = 0; i < lines; i++) {
          const lw = (w - 48) * (i === lines - 1 ? 0.55 : 0.8 + 0.2 * ((i * 37) % 5) / 5);
          ctx.fillRect(-w / 2 + 24, top + i * step, lw, 5);
        }
        if (o.pin !== undefined) {
          ctx.fillStyle = this.color('yellow');
          ctx.fillRect(-14, -h / 2 - 22, 28, 34);
        }
      });
      if (o.kind) this._text(String(o.kind).toUpperCase(), { font: 'mono', size: 24, tracking: 0.12, color: '#5f625e', under: paper, x: -w / 2 + 24, y: -h / 2 + 30, align: 'left', valign: 'top', at: o.at ?? 0, maxWidth: w - 48 });
      if (o.title) this._text(o.title, { font: 'display', size: o.titleSize ?? 32, color: this.colors.paperInk, under: paper, x: -w / 2 + 24, y: titleTop, align: 'left', valign: 'top', at: o.at ?? 0, maxWidth: w - 48, lineHeight: 1.05 });
      if (o.pin !== undefined) this._text(String(o.pin), { font: 'display', size: 24, color: this.colors.paperInk, under: this.color('yellow'), x: 0, y: -h / 2 - 5, at: o.at ?? 0 });
    }, { enter: 'rise', dur: 0.45, sfx: 'pop', gain: 0.2 });
    return box;
  }

  // ---------- interface pieces ----------

  // The chapter bar: nodes on a line with small caps names above them.
  // steps: names; times: when each node becomes the current one (the
  // current node is yellow, earlier ones blue, later ones grey). (x, y) is
  // the center of the line; w its length. grow: the line and nodes appear
  // with their times instead of all at once.
  progress(steps, o = {}) {
    const s = this.s;
    const w = o.w ?? s.safe.w * 0.9;
    const cx = o.x ?? s.cx;
    const y = o.y ?? s.cy;
    const at0 = s.time(o.at ?? 0);
    const times = (o.times ?? []).map((t) => s.time(t));
    const n = steps.length;
    const xs = steps.map((_, i) => cx - w / 2 + (n === 1 ? w / 2 : (w * i) / (n - 1)));
    const node = o.node ?? 48;
    const shown = (i) => (o.grow ? (i === 0 ? at0 : times[i] ?? Infinity) : at0);
    const state = (i) => {
      const cur = times.reduce((k, t, j) => (s.t >= t ? j : k), -1);
      if (cur === -1) return 'idle';
      if (i < cur) return 'done';
      if (i === cur) return 'current';
      return 'idle';
    };
    s.draw({ at: at0, out: o.out, enter: 'none' }, (ctx) => {
      const lastShown = steps.reduce((k, _, i) => (s.t >= shown(i) ? i : k), 0);
      const p = outCubic(clamp((s.t - at0) / (0.6 / s.pace)));
      const xEnd = o.grow ? xs[lastShown] + (lastShown < n - 1 ? 60 : 0) : lerp(xs[0], xs[n - 1], p);
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xs[0] - 30, y);
      ctx.lineTo(xEnd + (o.grow ? 0 : 30), y);
      ctx.stroke();
    });
    steps.forEach((name, i) => {
      const at = shown(i);
      if (at === Infinity) return;
      s.draw({ at, out: o.out, enter: 'none', x: xs[i], y }, (ctx) => {
        const st = state(i);
        const since = times[i] !== undefined ? s.t - times[i] : -1;
        const flash = st === 'current' && since >= 0 ? 1 + 0.2 * Math.max(0, 1 - since / 0.4) : 1;
        const sz = node * flash;
        const fill = st === 'done' ? this.color('blue') : st === 'current' ? this.color('yellow') : '#1d2020';
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = fill;
        this._rrect(ctx, -sz / 2, -sz / 2, sz, sz, 5);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = st === 'idle' ? '#4a5050' : fill;
        ctx.lineWidth = 2.5;
        this._rrect(ctx, -sz / 2, -sz / 2, sz, sz, 5);
        ctx.stroke();
        // A small bar inside each node, dark on color and grey on idle ones.
        ctx.fillStyle = st === 'idle' ? '#6a7070' : this.colors.paperInk;
        ctx.fillRect(-2.5, -sz * 0.24, 5, sz * 0.48);
      });
      this.label(name, { x: xs[i], y: y - node / 2 - 34, at, out: o.out, size: o.labelSize ?? 24, color: 'muted', maxWidth: (w / Math.max(1, n - 1)) * 0.95 });
      if (times[i] !== undefined) this._sound({ at: times[i], sfx: o.sfx }, 'blip', 0.2);
    });
    return { xs, y };
  }

  // A search bar that types a query. (x, y) is the center. Options: w, h,
  // text, typeAt (when typing starts, default at + 0.4), cps.
  search(o = {}) {
    const s = this.s;
    const w = o.w ?? 900;
    const h = o.h ?? 78;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const typeAt = o.typeAt ?? s.time(o.at ?? 0) + 0.4;
    const cps = o.cps ?? 20;
    const size = o.size ?? 32;
    const text = o.text ?? '';
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.fillStyle = this.colors.cell;
        this._rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = this.color('dim');
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = this.color('muted');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(-w / 2 + 44, -3, 12, 0, Math.PI * 2);
        ctx.moveTo(-w / 2 + 53, 6);
        ctx.lineTo(-w / 2 + 63, 16);
        ctx.stroke();
        // The caret follows the typed text and blinks while idle.
        const tAt = s.time(typeAt);
        const n = clamp(Math.floor((s.t - tAt) * cps * s.pace), 0, text.length);
        ctx.font = fontString(s.theme, 'mono', size);
        const cx = -w / 2 + 84 + ctx.measureText(text.slice(0, s.t >= tAt ? n : 0)).width + 4;
        const typing = s.t >= tAt && n < text.length;
        if (typing || Math.floor(s.t * 2) % 2 === 0) {
          ctx.fillStyle = this.color('yellow');
          ctx.fillRect(cx, -size * 0.55, 3, size * 1.1);
        }
      });
      if (text) this._text(text, { font: 'mono', size, color: 'ink', under: this.colors.cell, x: -w / 2 + 84, y: 0, align: 'left', at: typeAt, enter: 'type', cps: cps, maxWidth: w });
    }, { sfx: 'pop', gain: 0.15 });
    if (text && o.sfx !== false) s.sfx('type', s.time(typeAt), { dur: text.length / cps / s.pace, gain: 0.18 });
    return box;
  }

  // An answer window: an outlined panel with a small caps title and a
  // square status dot, and text that streams in word by word from
  // `streamAt` at `wps` words a second. Without text it shows grey lines.
  chat(o = {}) {
    const s = this.s;
    const w = o.w ?? 640;
    const h = o.h ?? 260;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const at = o.at ?? 0;
    const streamAt = o.streamAt ?? s.time(at) + 0.5;
    const words = (o.text ?? '').split(/\s+/).filter(Boolean).length;
    this._unit(o, box, () => {
      s.draw({ at, enter: 'none' }, (ctx) => {
        ctx.fillStyle = this.colors.card;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = this.color(o.dot ?? 'blue');
        ctx.fillRect(-w / 2 + 24, -h / 2 + 26, 12, 12);
        if (!o.text) {
          ctx.fillStyle = this.colors.dim;
          const n = o.lines ?? 3;
          for (let i = 0; i < n; i++) ctx.fillRect(-w / 2 + 24, -h / 2 + 76 + i * 34, (w - 48) * (i === n - 1 ? 0.5 : 0.9), 10);
        }
      });
      this._text(String(o.title ?? 'AI answer').toUpperCase(), { font: 'mono', size: 24, tracking: 0.14, color: 'muted', under: this.colors.card, x: -w / 2 + 48, y: -h / 2 + 32, align: 'left', at });
      if (o.text) this._text(o.text, { font: 'mono', size: o.size ?? 28, color: 'ink', under: this.colors.card, x: -w / 2 + 24, y: -h / 2 + 70, align: 'left', valign: 'top', maxWidth: w - 48, lineHeight: 1.35, at: streamAt, enter: 'words', dur: words / (o.wps ?? 4) });
    }, { sfx: 'pop', gain: 0.18 });
    return box;
  }

  // A half-circle gauge with three labels and a needle. keys: [{ at, v }],
  // v from 0 (left) to 1 (right); labels: [left, top, right].
  gauge(o = {}) {
    const s = this.s;
    const r = o.r ?? 150;
    const box = this._geom(o.x ?? s.cx, (o.y ?? s.cy) - r / 2, r * 2 + 40, r + 40);
    const keys = (o.keys ?? [{ at: o.at ?? 0, v: 0 }]).map((k) => ({ ...k, at: s.time(k.at) }));
    const labels = o.labels ?? [];
    const cx = o.x ?? s.cx;
    const cy = o.y ?? s.cy;
    this._unit({ ...o, x: cx, y: cy, id: undefined }, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.stroke();
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI + (Math.PI * i) / 8;
          const inner = i % 4 === 0 ? r - 26 : r - 14;
          ctx.lineWidth = i % 4 === 0 ? 4 : 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
        let v = keys[0]?.v ?? 0;
        let prev = v;
        for (const k of keys) {
          if (s.t < k.at) break;
          v = lerp(prev, k.v, inOut(clamp((s.t - k.at) / (0.8 / s.pace))));
          prev = k.v;
        }
        const a = Math.PI + Math.PI * v;
        ctx.strokeStyle = this.color(o.color ?? 'yellow');
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (r - 34), Math.sin(a) * (r - 34));
        ctx.stroke();
        ctx.fillStyle = this.colors.line;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      });
    }, { sfx: 'pop', gain: 0.18 });
    const spots = [[cx - r - 24, cy - 10, 'right'], [cx, cy - r - 36, 'center'], [cx + r + 24, cy - 10, 'left']];
    labels.forEach((l, i) => {
      if (!l) return;
      const k = keys.findIndex((kk) => Math.abs(kk.v - [0.08, 0.5, 0.92][i]) < 0.2);
      const active = k >= 0 ? keys[k].at : Infinity;
      this.label(l, { x: spots[i][0], y: spots[i][1], align: spots[i][2], at: o.at, out: o.out, size: 24, color: s.t >= active ? (o.color ?? 'yellow') : 'muted' });
    });
    for (const k of keys.slice(1)) this._sound({ at: k.at, sfx: o.sfx }, 'whoosh', 0.1);
    return box;
  }

  // Memory on the left, compute on the right, and a belt between them that
  // carries yellow tokens (weights) from one to the other. (x, y) is the
  // center; w the full width. flowAt: when tokens start moving. rate:
  // tokens per second. labels: [left, right]. tag: text over the belt.
  conveyor(o = {}) {
    const s = this.s;
    const w = o.w ?? 760;
    const cx = o.x ?? s.cx;
    const cy = o.y ?? s.cy;
    const at = o.at ?? 0;
    const flowAt = o.flowAt ?? s.time(at) + 0.6;
    const memW = 130;
    const memH = 160;
    const comp = 3 * 34 + 2 * 8;
    const beltX0 = -w / 2 + memW;
    const beltX1 = w / 2 - comp - 16;
    const color = this.color(o.color ?? 'yellow');
    const box = this._geom(cx, cy, w, memH + 60);
    this._unit({ ...o, x: cx, y: cy }, box, () => {
      s.draw({ at, enter: 'none' }, (ctx) => {
        // memory block
        ctx.fillStyle = this.colors.card;
        this._rrect(ctx, -w / 2, -memH / 2, memW, memH, 6);
        ctx.fill();
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#262a2a';
        for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 18, -memH / 2 + 22 + i * 25, memW - 36, 13);
        // belt
        ctx.strokeStyle = this.colors.line;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(beltX0, -26);
        ctx.lineTo(beltX1, -26);
        ctx.moveTo(beltX0, 26);
        ctx.lineTo(beltX1, 26);
        ctx.stroke();
        ctx.fillStyle = '#151818';
        ctx.fillRect(beltX0, -22, beltX1 - beltX0, 44);
        // tokens
        const tf = s.time(flowAt);
        if (s.t >= tf) {
          const spacing = o.spacing ?? 78;
          const speed = (o.speed ?? 120) * s.pace;
          const travel = (s.t - tf) * speed;
          ctx.save();
          ctx.beginPath();
          ctx.rect(beltX0, -24, beltX1 - beltX0, 48);
          ctx.clip();
          ctx.fillStyle = color;
          for (let k = 0; ; k++) {
            const px = beltX0 + 14 + travel - k * spacing;
            if (px < beltX0 - 40) break;
            if (px > beltX1 + 40) continue;
            this._rrect(ctx, px, -15, 30, 30, 3);
            ctx.fill();
          }
          ctx.restore();
        }
        // compute grid
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            ctx.fillStyle = '#202424';
            this._rrect(ctx, w / 2 - comp + c * 42, -comp / 2 + r * 42, 34, 34, 4);
            ctx.fill();
            ctx.strokeStyle = this.colors.cellLine;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });
    }, { sfx: 'pop', gain: 0.18 });
    const [l1, l2] = o.labels ?? ['memory', 'compute'];
    if (l1) this.label(l1, { x: cx - w / 2 + memW / 2, y: cy + memH / 2 + 34, at, out: o.out, size: 24 });
    if (l2) this.label(l2, { x: cx + w / 2 - comp / 2, y: cy + comp / 2 + 34, at, out: o.out, size: 24 });
    if (o.tag) this.tag(o.tag, { x: cx + (beltX0 + beltX1) / 2, y: cy - 84, stem: 0, color: 'line', size: 24, at: o.tagAt ?? flowAt, out: o.out });
    return box;
  }

  // ---------- line drawings ----------

  // A calendar tile: a red band with the month and a big day number.
  calendar(o = {}) {
    const s = this.s;
    const size = o.size ?? 150;
    const w = size;
    const h = size * 1.1;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, w, h);
    const band = h * 0.26;
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.fillStyle = this.colors.white;
        this._rrect(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.fillStyle = this.color('red');
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, band, [8, 8, 0, 0]);
        ctx.fill();
      });
      this._text(String(o.month ?? '').toUpperCase(), { font: 'mono', weight: 700, size: band * 0.55, tracking: 0.1, color: '#ffffff', under: this.color('red'), x: 0, y: -h / 2 + band / 2 + 2, at: o.at ?? 0 });
      this._text(String(o.day ?? ''), { font: 'display', size: h * 0.5, color: this.colors.paperInk, under: this.colors.white, x: 0, y: band / 2 + 4, at: o.at ?? 0 });
    }, { enter: 'drop', dur: 0.45, sfx: 'pop', gain: 0.2 });
    return box;
  }

  // A simple person: a round head over shoulders, drawn as an outline.
  person(o = {}) {
    const s = this.s;
    const h = o.h ?? 140;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, h * 0.7, h);
    const color = this.color(o.color ?? 'line');
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = o.width ?? 4;
        ctx.beginPath();
        ctx.arc(0, -h * 0.24, h * 0.17, 0, Math.PI * 2);
        ctx.moveTo(-h * 0.33, h / 2);
        ctx.lineTo(-h * 0.33, h * 0.22);
        ctx.quadraticCurveTo(-h * 0.33, -h * 0.01, 0, -h * 0.01);
        ctx.quadraticCurveTo(h * 0.33, -h * 0.01, h * 0.33, h * 0.22);
        ctx.lineTo(h * 0.33, h / 2);
        ctx.stroke();
      });
    }, { sfx: 'pop', gain: 0.15 });
    if (o.label) this.label(o.label, { x: box.x, y: box.bottom + 30, at: o.at, out: o.out, size: 24 });
    return box;
  }

  // A line drawing of hardware. kind: 'gpu' (a graphics card), 'laptop',
  // 'server' (a rack) or 'chip'. Options: w, label (under it), mem (a small
  // tag on it, like "24 GB"), color.
  device(kind, o = {}) {
    const s = this.s;
    const w = o.w ?? 320;
    const dims = { gpu: [w, w * 0.42], laptop: [w, w * 0.68], server: [w * 0.62, w], chip: [w * 0.6, w * 0.6] }[kind];
    if (!dims) throw new SceneError(`kai.device: kind "${kind}" is not one of gpu, laptop, server, chip`);
    const [dw, dh] = dims;
    const box = this._geom(o.x ?? s.cx, o.y ?? s.cy, dw, dh);
    const color = this.color(o.color ?? 'line');
    this._unit(o, box, () => {
      s.draw({ at: o.at ?? 0, enter: 'none' }, (ctx) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = this.colors.card;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        if (kind === 'gpu') {
          const bh = dh * 0.82;
          this._rrect(ctx, -dw / 2 + 18, -dh / 2, dw - 18, bh, 8);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-dw / 2 + 18, -dh / 2 + 6);
          ctx.lineTo(-dw / 2, -dh / 2 + 6);
          ctx.lineTo(-dw / 2, -dh / 2 + bh + 16);
          ctx.stroke();
          const fr = bh * 0.32;
          for (const fx of [-dw * 0.18, dw * 0.22]) {
            ctx.beginPath();
            ctx.arc(fx + 9, -dh / 2 + bh / 2, fr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(fx + 9, -dh / 2 + bh / 2, fr * 0.28, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = this.color('yellow');
          ctx.fillRect(-dw * 0.2, -dh / 2 + bh, dw * 0.5, dh * 0.1);
        } else if (kind === 'laptop') {
          const sh = dh * 0.78;
          this._rrect(ctx, -dw * 0.4, -dh / 2, dw * 0.8, sh, 8);
          ctx.fill();
          ctx.stroke();
          ctx.strokeRect(-dw * 0.4 + 14, -dh / 2 + 14, dw * 0.8 - 28, sh - 28);
          ctx.beginPath();
          ctx.moveTo(-dw * 0.46, -dh / 2 + sh + 4);
          ctx.lineTo(dw * 0.46, -dh / 2 + sh + 4);
          ctx.lineTo(dw / 2, dh / 2);
          ctx.lineTo(-dw / 2, dh / 2);
          ctx.closePath();
          ctx.stroke();
        } else if (kind === 'server') {
          const n = 5;
          const gap = 10;
          const uh = (dh - gap * (n - 1)) / n;
          for (let i = 0; i < n; i++) {
            const y = -dh / 2 + i * (uh + gap);
            this._rrect(ctx, -dw / 2, y, dw, uh, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = i % 2 ? this.color('green') : this.color('blue');
            ctx.fillRect(dw / 2 - 30, y + uh / 2 - 5, 10, 10);
            ctx.fillStyle = this.colors.card;
            ctx.fillStyle = '#2a2f2f';
            ctx.fillRect(-dw / 2 + 18, y + uh / 2 - 4, dw * 0.5, 8);
            ctx.fillStyle = this.colors.card;
          }
        } else {
          this._rrect(ctx, -dw / 2, -dh / 2, dw, dh, 10);
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 3;
          for (let i = 0; i < 5; i++) {
            const p = -dw / 2 + (dw * (i + 1)) / 6;
            for (const [a, b, c, d] of [[p, -dh / 2, p, -dh / 2 - 16], [p, dh / 2, p, dh / 2 + 16], [-dw / 2, p, -dw / 2 - 16, p], [dw / 2, p, dw / 2 + 16, p]]) {
              ctx.beginPath();
              ctx.moveTo(a, b);
              ctx.lineTo(c, d);
              ctx.stroke();
            }
          }
        }
      });
    }, { sfx: 'pop', gain: 0.2 });
    if (o.mem) this.chip(o.mem, { x: box.x + (kind === 'gpu' ? 9 : 0), y: kind === 'laptop' ? box.top + dh * 0.39 : kind === 'gpu' ? box.top : box.y, at: o.memAt ?? o.at, out: o.out, color: o.memColor ?? 'yellow', size: o.memSize ?? 24 });
    if (o.label) this.label(o.label, { x: box.x, y: box.bottom + 36, at: o.at, out: o.out, size: o.labelSize ?? 26 });
    return box;
  }
}
