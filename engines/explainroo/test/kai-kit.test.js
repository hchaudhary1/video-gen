import test from 'node:test';
import assert from 'node:assert/strict';
import { Stage } from '../engine/stage.js';
import { Kai, KAI_COLORS } from '../engine/kai.js';
import { getTheme } from '../engine/themes.js';
import { parseRich } from '../engine/text.js';

Stage.Kai = Kai;

// Just enough of the browser's DOMMatrix and DOMPoint for the stage's text log.
globalThis.DOMPoint ??= class {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
};
globalThis.DOMMatrix ??= class {
  constructor([a, b, c, d, e, f]) {
    Object.assign(this, { a, b, c, d, e, f });
  }
  transformPoint(p) {
    return new DOMPoint(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f);
  }
};

// A canvas that records what gets drawn, with the fill color at that moment.
function fakeCanvas() {
  const drawn = [];
  const state = { font: '', fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, letterSpacing: '0px' };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'drawn') return drawn;
      if (key === 'measureText') return (t) => ({ width: String(t).length * 10 });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (['fill', 'stroke', 'fillText', 'fillRect', 'strokeRect'].includes(key)) return (...args) => drawn.push([key, target.fillStyle, ...args]);
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return ctx;
}

const LOOK = { extends: 'midnight', name: 'kai', bg: '#0e1010', colors: { blue: '#1e8fe1', yellow: '#ffd23f', red: '#e0313b' } };

function stageAt(t, { texts = [], sounds = null, marks = {} } = {}) {
  const theme = getTheme('kai', LOOK);
  const engine = {
    theme,
    pen: { draw() {} },
    W: 1920,
    H: 1080,
    safeArea: { x: 134, y: 76, w: 1652, h: 928, bottom: 1004 },
    config: {},
    timeline: { pace: 1, duration: 20, frames: 600, fps: 30, width: 1920, height: 1080, scenes: [] },
    fps: 30,
    scale: 1,
    recorder: sounds ? { push: (e) => sounds.push(e) } : null,
    textLog: texts,
    sfxNames: ['pop', 'blip', 'thud', 'tick', 'type', 'rise', 'click', 'scribble', 'whoosh'],
  };
  const scene = { start: 0, dur: 20, id: 'demo', index: 0, words: [], marks, voice: null, lead: 0 };
  return new Stage(engine, fakeCanvas(), scene, t);
}

test('s.kai cards hide until their time, then log every text with the fill under it', () => {
  const draw = (t) => {
    const texts = [];
    const s = stageAt(t, { texts });
    s.kai.card({ x: 600, y: 400, w: 400, h: 200, label: 'problem', title: 'REAL', sub: 'checked', at: 2 });
    return { texts, drawn: s.ctx.drawn.length };
  };
  assert.deepEqual(draw(1), { texts: [], drawn: 0 });
  const { texts, drawn } = draw(3);
  assert.ok(drawn > 0);
  assert.deepEqual(texts.map((x) => x.text), ['PROBLEM', 'REAL', 'checked']);
  // The contrast check measures against the card's fill, not the page.
  for (const x of texts) assert.equal(x.bg, KAI_COLORS.card);
  // Labels are small caps but never below the readable minimum.
  assert.ok(texts[0].size >= 24);
});

test('text on cream and white parts is checked against that color', () => {
  const texts = [];
  const s = stageAt(5, { texts });
  s.kai.evidence({ x: 900, y: 500, quote: 'It is *very aggressive and lossy by design.*', source: 'report', kind: 'technical report', at: 1 });
  s.kai.doc({ x: 300, y: 500, title: 'Model card', at: 1 });
  const quote = texts.find((x) => x.text.startsWith('“It is'));
  assert.ok(quote, 'the quote is logged');
  assert.equal(quote.bg, KAI_COLORS.white);
  assert.equal(quote.fg, KAI_COLORS.paperInk);
  assert.ok(!quote.text.includes('*'), 'stars are markup, not text');
  assert.equal(texts.find((x) => x.text === 'Model card').bg, KAI_COLORS.paper);
  assert.ok(texts.some((x) => x.text === 'REPORT'), 'the source chip is shown');
});

test('a grid fills cell by cell as a function of time only', () => {
  const blue = '#1e8fe1';
  const filled = (t) => {
    const s = stageAt(t);
    s.kai.grid({ x: 900, y: 500, cols: 10, rows: 4, at: 1, fills: [{ at: 2, dur: 4, count: 40, color: 'blue' }] });
    return s.ctx.drawn.filter(([kind, color]) => kind === 'fill' && color === blue).length;
  };
  assert.equal(filled(1.5), 0);
  assert.equal(filled(2), 0);
  assert.equal(filled(4), 20);
  assert.equal(filled(4), filled(4));
  assert.equal(filled(9), 40);
});

test('stamps, tags and counters make one light sound each at their time', () => {
  const sounds = [];
  const s = stageAt(0, { sounds });
  s.kai.stamp('not listed', { x: 900, y: 500, at: 3 });
  s.kai.tag('claim', { x: 400, y: 300, at: 1 });
  s.kai.counter('74B', { x: 600, y: 600, label: 'parameters', at: 2 });
  s.kai.pill('quiet', { x: 600, y: 800, at: 4, sfx: false });
  s.kai.card({ x: 600, y: 400, at: -1 });
  const explicit = sounds.filter((e) => e.explicit).map((e) => [e.sfx, e.at]);
  assert.deepEqual(explicit, [['thud', 3], ['blip', 1], ['pop', 2]]);
});

test('the chapter bar marks earlier chapters done and the current one yellow', () => {
  const colors = (t) => {
    const s = stageAt(t);
    s.kai.progress(['a', 'b', 'c'], { y: 500, w: 1000, at: 0, times: [1, 3, 5] });
    return s.ctx.drawn.filter(([kind]) => kind === 'fill').map(([, c]) => c);
  };
  const at4 = colors(4);
  assert.ok(at4.includes('#1e8fe1'), 'a finished chapter is blue');
  assert.ok(at4.includes('#ffd23f'), 'the current chapter is yellow');
});

test('s.text takes letter spacing and the color under it', () => {
  const texts = [];
  const s = stageAt(1, { texts });
  s.text('MEMORY', { font: 'mono', size: 26, tracking: 0.14, under: '#ece8d9', at: 0 });
  assert.equal(texts[0].bg, '#ece8d9');
});

test('starred words keep their quotes around them', () => {
  const words = parseRich('“*below 24GB* at batch size 1 and *128K context.*”');
  assert.deepEqual(words.filter((w) => w.accent).map((w) => w.text), ['“below', '24GB', '128K', 'context.”']);
  assert.ok(words.every((w) => !w.text.includes('*')));
});

test('kai.device names the kinds it can draw', () => {
  const s = stageAt(1);
  assert.throws(() => s.kai.device('toaster', { at: 0 }), /gpu, laptop, server, chip/);
});
