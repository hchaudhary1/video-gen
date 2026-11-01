/* Rules-series kit: the locked frame of a series horror film (case-file HUD, sentence captions, rule cards,
 * exhibit cards, red X / check / YOU marks, glitch and film finish). Project-owned; see README.md.
 * Everything is a pure function of the scene timeline time, so any seek order gives the same frame. */
(() => {
  if (window.RulesSeries) return;
  const KIT = 'assets/library/rules-series-kit/1.0.0';
  const NS = 'http://www.w3.org/2000/svg';
  const data = () => window.RulesSeriesData || {identity: {overlay: 'FILE 000', danger: '#e5322d'}, rules: [], captions: [], canvas: {width: 1920, height: 1080, fps: 30}};

  // ---------------------------------------------------------------- styles (injected once, fonts from the job root)
  function injectStyles() {
    if (document.getElementById('rs-kit-style')) return;
    const danger = data().identity.danger || '#e5322d';
    const css = `
@font-face{font-family:'RS Inter';src:url('${KIT}/fonts/inter-800.woff2') format('woff2');font-weight:800;font-display:block}
@font-face{font-family:'RS Inter';src:url('${KIT}/fonts/inter-600.woff2') format('woff2');font-weight:600;font-display:block}
.rs-root{--rs-u:1px;--rs-danger:${danger};--rs-you:#ffd23f;--rs-ok:#35d07f;background:#000;color:#f4f4f2;font-family:'RS Inter',sans-serif;overflow:hidden}
.rs-stage{position:absolute;inset:0;transform-origin:50% 50%;filter:drop-shadow(0 0 calc(var(--rs-u)*9) rgba(255,255,255,.28))}
.rs-layer{position:absolute;inset:0;pointer-events:none}
.rs-hud{z-index:40;font-weight:600;letter-spacing:.16em;color:rgba(240,240,236,.86);font-size:calc(var(--rs-u)*23);font-variant-numeric:tabular-nums}
.rs-hud-label{position:absolute;left:calc(var(--rs-u)*64);top:calc(var(--rs-u)*58);white-space:nowrap}
.rs-hud-label b{color:rgba(246,246,242,.95);font-weight:800}
.rs-hud-time{position:absolute;right:calc(var(--rs-u)*64);top:calc(var(--rs-u)*58);white-space:nowrap}
.rs-hud-time i{display:inline-block;width:calc(var(--rs-u)*10);height:calc(var(--rs-u)*10);border-radius:50%;background:var(--rs-danger);margin-right:calc(var(--rs-u)*12);vertical-align:middle;box-shadow:0 0 calc(var(--rs-u)*8) var(--rs-danger)}
.rs-progress{position:absolute;left:50%;top:calc(var(--rs-u)*52);transform:translateX(-50%);display:flex;gap:calc(var(--rs-u)*7)}
.rs-box{box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:0;border:calc(var(--rs-u)*2) solid rgba(240,240,236,.5);color:rgba(240,240,236,.5);border-radius:calc(var(--rs-u)*5)}
.rs-progress .rs-box{width:calc(var(--rs-u)*28);height:calc(var(--rs-u)*28);font-size:calc(var(--rs-u)*15)}
.rs-box.rs-past{border-color:rgba(240,240,236,.7);color:rgba(240,240,236,.7)}
.rs-box.rs-now{background:#f4f4f2;border-color:#f4f4f2;color:#0b0b0b;box-shadow:0 0 calc(var(--rs-u)*12) rgba(255,255,255,.55)}
.rs-box.rs-hot{border-color:var(--rs-you);color:var(--rs-you);box-shadow:0 0 calc(var(--rs-u)*14) rgba(255,210,63,.5)}
.rs-caption{z-index:45;position:absolute;left:12%;right:12%;bottom:calc(var(--rs-u)*84);text-align:center;font-weight:800;text-transform:uppercase;letter-spacing:.045em;line-height:1.18;font-size:calc(var(--rs-u)*46);color:#f6f6f3;text-shadow:0 0 calc(var(--rs-u)*14) rgba(255,255,255,.45),0 calc(var(--rs-u)*3) calc(var(--rs-u)*6) #000}
.rs-finish{z-index:50}
.rs-vignette{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 48%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 85%,rgba(0,0,0,.85) 100%)}
.rs-grain{position:absolute;inset:0;width:100%;height:100%;opacity:.085;mix-blend-mode:screen;image-rendering:pixelated}
.rs-flash{position:absolute;inset:0;background:#fff;opacity:0}
.rs-tear{position:absolute;left:0;right:0;background:rgba(255,255,255,.16);mix-blend-mode:screen;opacity:0}
.rs-card{z-index:30;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0}
.rs-card-title{display:flex;align-items:center;gap:calc(var(--rs-u)*28);font-weight:800;font-size:calc(var(--rs-u)*150);letter-spacing:.02em;line-height:1;text-shadow:0 0 calc(var(--rs-u)*22) rgba(255,255,255,.45)}
.rs-card-num{display:flex;align-items:center;justify-content:center;min-width:calc(var(--rs-u)*170);height:calc(var(--rs-u)*170);padding:0 calc(var(--rs-u)*20);box-sizing:border-box;background:#f6f6f3;color:#0b0b0b;border-radius:calc(var(--rs-u)*22);text-shadow:none;box-shadow:0 0 calc(var(--rs-u)*28) rgba(255,255,255,.45)}
.rs-card-line{width:calc(var(--rs-u)*640);height:calc(var(--rs-u)*7);background:var(--rs-danger);margin:calc(var(--rs-u)*44) 0 calc(var(--rs-u)*30);transform-origin:50% 50%;box-shadow:0 0 calc(var(--rs-u)*14) var(--rs-danger)}
.rs-card-text{font-weight:800;font-size:calc(var(--rs-u)*62);letter-spacing:.06em;text-transform:uppercase;text-align:center;max-width:78%;line-height:1.12}
.rs-card-row{display:flex;gap:calc(var(--rs-u)*14);margin-top:calc(var(--rs-u)*46)}
.rs-card-row .rs-box{width:calc(var(--rs-u)*56);height:calc(var(--rs-u)*56);font-size:calc(var(--rs-u)*28);border-radius:calc(var(--rs-u)*9)}
.rs-exhibit{z-index:25;position:absolute;inset:0;opacity:0}
.rs-photo{position:absolute;box-sizing:border-box;background:#e9e7e1;padding:calc(var(--rs-u)*14);box-shadow:0 0 calc(var(--rs-u)*40) rgba(255,255,255,.25)}
.rs-photo-in{position:relative;width:100%;height:100%;overflow:hidden;background:#111}
.rs-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.25) brightness(.95)}
.rs-bracket{position:absolute;width:calc(var(--rs-u)*30);height:calc(var(--rs-u)*30);border-color:rgba(240,240,236,.75);border-style:solid;border-width:0}
.rs-tag{position:absolute;border-left:calc(var(--rs-u)*9) solid var(--rs-danger);padding-left:calc(var(--rs-u)*26)}
.rs-tag h3{margin:0 0 calc(var(--rs-u)*18);font-weight:800;font-size:calc(var(--rs-u)*50);letter-spacing:.08em;text-transform:uppercase}
.rs-tag p{margin:0 0 calc(var(--rs-u)*10);font-weight:600;font-size:calc(var(--rs-u)*32);letter-spacing:.1em;color:rgba(240,240,236,.85);text-transform:uppercase}
.rs-mark{position:absolute;overflow:visible;pointer-events:none}
.rs-you{position:absolute;font-weight:800;color:var(--rs-you);letter-spacing:.08em;text-align:center;text-shadow:0 0 calc(var(--rs-u)*12) rgba(255,210,63,.55)}
.rs-boxes{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:calc(var(--rs-u)*20)}
.rs-boxes .rs-box{width:calc(var(--rs-u)*96);height:calc(var(--rs-u)*96);font-size:calc(var(--rs-u)*48);border-radius:calc(var(--rs-u)*14);color:#f4f4f2;border-color:#f4f4f2;border-width:calc(var(--rs-u)*4);text-shadow:0 0 calc(var(--rs-u)*10) rgba(255,255,255,.5)}
.rs-vertical .rs-hud{font-size:calc(var(--rs-u)*28)}
.rs-vertical .rs-hud-label{left:calc(var(--rs-u)*56);top:calc(var(--rs-u)*92)}
.rs-vertical .rs-hud-time{right:calc(var(--rs-u)*56);top:calc(var(--rs-u)*92)}
.rs-vertical .rs-progress{top:calc(var(--rs-u)*150)}
.rs-vertical .rs-progress .rs-box{width:calc(var(--rs-u)*30);height:calc(var(--rs-u)*30);font-size:calc(var(--rs-u)*16)}
.rs-vertical .rs-caption{left:7%;right:7%;bottom:auto;top:calc(var(--rs-u)*1430);font-size:calc(var(--rs-u)*58)}
.rs-vertical .rs-card-title{font-size:calc(var(--rs-u)*160)}
.rs-vertical .rs-card-text{font-size:calc(var(--rs-u)*66);max-width:88%}
.rs-vertical .rs-card-line{width:calc(var(--rs-u)*700)}
.rs-vertical .rs-boxes .rs-box{width:calc(var(--rs-u)*104);height:calc(var(--rs-u)*104);font-size:calc(var(--rs-u)*52)}
.rs-vertical .rs-boxes{gap:calc(var(--rs-u)*16)}
`;
    const style = document.createElement('style');
    style.id = 'rs-kit-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------- helpers
  const el = (tag, cls, parent, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
  function hash(...parts) { // FNV-1a, for frame-seeded jitter
    let h = 2166136261 >>> 0;
    for (const p of parts) { const s = String(p); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x2f; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const rand = seed => () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function canvasOf(root) {
    const w = Number(root.dataset.width) || data().canvas.width, h = Number(root.dataset.height) || data().canvas.height;
    return {w, h, u: Math.min(w, h) / 1080, vertical: h > w};
  }
  function sceneInfo(scene) {
    const s = window.VideoCues?.scenes?.[scene];
    if (!s) throw new Error(`RulesSeries: scene "${scene}" is not in assets/cues.js (check the scene id).`);
    return s;
  }
  function timecode(t, fps) {
    const f = Math.floor(t * fps + 1e-6), ff = f % fps, s = Math.floor(f / fps), m = Math.floor(s / 60);
    const two = n => String(n).padStart(2, '0');
    return `${two(m)}:${two(s % 60)}:${two(ff)}`;
  }

  /** Prepare a scene root: the series background and canvas units. */
  function setup(root) {
    injectStyles();
    const c = canvasOf(root);
    root.classList.add('rs-root');
    if (c.vertical) root.classList.add('rs-vertical');
    root.style.setProperty('--rs-u', `${c.u}px`);
    return c;
  }

  /** Captions (global seconds) that start inside a scene, with local times: [{i, start, end, text, local}]. */
  function captionsIn(scene) {
    const s = sceneInfo(scene);
    return data().captions.map((c, i) => ({...c, i, local: +(c.start - s.start).toFixed(3)})).filter(c => c.start >= s.start - 0.05 && c.start < s.start + s.duration);
  }
  /** Local time of caption i (its index in the generated captions table) inside a scene. */
  function cue(scene, i, offset = 0) {
    const c = data().captions[i];
    if (!c) throw new Error(`RulesSeries: no caption ${i}`);
    return Math.max(0, +(c.start - sceneInfo(scene).start + offset).toFixed(3));
  }

  // ---------------------------------------------------------------- the persistent frame
  /** Mount the HUD, captions and film finish on a scene and drive them from its timeline.
   * opts: {scene, timeline, duration?, hud=true, captions=true, finish=true, glitches=[{at, dur=0.35, strength=1}], flashes=[{at, dur=0.25, color}]} */
  function mount(root, opts) {
    const c = setup(root), d = data(), info = sceneInfo(opts.scene);
    const duration = opts.duration ?? info.duration, fps = d.canvas.fps || 30, tl = opts.timeline;
    const stage = root.querySelector('.rs-stage');
    let hud = null, caption = null, grain = null, flash = null, tears = [];
    if (opts.hud !== false) {
      hud = el('div', 'rs-layer rs-hud', root);
      const label = el('div', 'rs-hud-label', hud);
      const [main, ...rest] = d.identity.overlay.split(' · ');
      label.textContent = main + (rest.length ? ' · ' : '');
      if (rest.length) el('b', '', label, rest.join(' · '));
      const prog = el('div', 'rs-progress', hud);
      hud.boxes = (d.rules || []).map(r => el('div', 'rs-box', prog, String(r.n)));
      const time = el('div', 'rs-hud-time', hud);
      el('i', '', time); hud.time = el('span', '', time);
    }
    if (opts.captions !== false) caption = el('div', 'rs-caption', root);
    if (opts.finish !== false) {
      const finish = el('div', 'rs-layer rs-finish', root);
      el('div', 'rs-vignette', finish);
      grain = el('canvas', 'rs-grain', finish);
      grain.width = Math.round(c.w / 3); grain.height = Math.round(c.h / 3);
      flash = el('div', 'rs-flash', finish);
      for (let k = 0; k < 6; k++) tears.push(el('div', 'rs-tear', finish));
    }
    const glitches = (opts.glitches || []).map(g => ({dur: 0.35, strength: 1, ...g}));
    const flashes = (opts.flashes || []).map(f => ({dur: 0.25, color: '#fff', ...f}));
    let lastCaption = null, lastFrame = -1, lastRule = null;
    const image = grain ? grain.getContext('2d').createImageData(grain.width, grain.height) : null;

    function render(t) {
      const frame = Math.floor(t * fps + 1e-6), g = info.start + t;
      if (hud) {
        hud.time.textContent = timecode(g, fps);
        let now = 0;
        for (const r of d.rules || []) if (r.start != null && g >= r.start - 0.05) now = r.n;
        if (now !== lastRule) {
          hud.boxes.forEach((b, k) => { const n = d.rules[k].n; b.className = 'rs-box' + (n === now ? ' rs-now' : n < now ? ' rs-past' : ''); });
          lastRule = now;
        }
      }
      if (caption) {
        let text = '';
        for (const cap of d.captions || []) if (g >= cap.start - 0.04 && g < cap.hold) text = cap.text;
        if (text !== lastCaption) { caption.textContent = text; lastCaption = text; }
      }
      if (grain && frame !== lastFrame) {
        const r = rand(hash('grain', opts.scene, frame) || 1), px = image.data;
        for (let i = 0; i < px.length; i += 4) { const v = r() * 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
        grain.getContext('2d').putImageData(image, 0, 0);
      }
      lastFrame = frame;
      // glitch: chromatic split, jitter and tears, deterministic per frame
      let amount = 0;
      for (const q of glitches) if (t >= q.at && t < q.at + q.dur) amount = Math.max(amount, q.strength * (1 - (t - q.at) / q.dur * 0.6));
      const r = rand(hash('glitch', opts.scene, frame) || 7);
      if (stage) {
        if (amount > 0) {
          const dx = (r() - 0.5) * 26 * amount * c.u, split = (6 + r() * 10) * amount * c.u;
          stage.style.transform = `translate(${dx.toFixed(1)}px, ${((r() - 0.5) * 6 * amount * c.u).toFixed(1)}px) skewX(${((r() - 0.5) * 4 * amount).toFixed(2)}deg)`;
          stage.style.filter = `drop-shadow(${split.toFixed(1)}px 0 0 rgba(255,40,50,.8)) drop-shadow(${(-split).toFixed(1)}px 0 0 rgba(40,220,255,.75)) drop-shadow(0 0 ${(9 * c.u).toFixed(1)}px rgba(255,255,255,.28))`;
        } else { stage.style.transform = ''; stage.style.filter = ''; }
      }
      tears.forEach(bar => {
        if (amount > 0 && r() < 0.75) {
          bar.style.opacity = (0.4 + r() * 0.6).toFixed(2);
          bar.style.top = `${(r() * 100).toFixed(1)}%`;
          bar.style.height = `${(2 + r() * 40 * amount) * c.u}px`;
          bar.style.transform = `translateX(${((r() - 0.5) * 120 * amount * c.u).toFixed(0)}px)`;
        } else bar.style.opacity = '0';
      });
      if (flash) {
        let a = 0, color = '#fff';
        for (const f of flashes) if (t >= f.at && t < f.at + f.dur) { a = Math.max(a, 1 - (t - f.at) / f.dur); color = f.color; }
        flash.style.opacity = (a * 0.85).toFixed(3); flash.style.background = color;
      }
    }
    const clock = {value: 0};
    Object.defineProperty(clock, 'seconds', {get() { return clock.value; }, set(v) { clock.value = clamp(v, 0, duration); render(clock.value); }});
    clock.seconds = 0;
    tl.fromTo(clock, {seconds: 0}, {seconds: duration, duration, ease: 'none'}, 0);
    return {render, canvas: c, duration};
  }

  // ---------------------------------------------------------------- series cards and marks
  /** RULE N card. opts: {n, text, at, until?=at+3.6, total?=rules.length} */
  function ruleCard(root, tl, {n, text, at, until, total}) {
    setup(root);
    const rules = data().rules || [], count = total ?? rules.length, end = until ?? at + 3.6;
    const card = el('div', 'rs-card', root);
    const title = el('div', 'rs-card-title', card);
    el('span', '', title, 'RULE');
    const num = el('span', 'rs-card-num', title, String(n));
    const line = el('div', 'rs-card-line', card);
    const words = el('div', 'rs-card-text', card, text);
    const row = el('div', 'rs-card-row', card);
    const boxes = Array.from({length: count}, (_, k) => el('div', 'rs-box' + (k + 1 === n ? ' rs-now' : k + 1 < n ? ' rs-past' : ''), row, String(k + 1)));
    tl.set(card, {opacity: 0}, 0);
    tl.fromTo(card, {opacity: 0, scale: 1.12}, {opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out'}, at);
    tl.fromTo(num, {scale: 1.6, rotate: -8}, {scale: 1, rotate: 0, duration: 0.42, ease: 'back.out(2.2)'}, at + 0.08);
    tl.fromTo(line, {scaleX: 0}, {scaleX: 1, duration: 0.45, ease: 'power2.out'}, at + 0.22);
    tl.fromTo(words, {opacity: 0, y: 18}, {opacity: 1, y: 0, duration: 0.35, ease: 'power2.out'}, at + 0.34);
    tl.fromTo(boxes, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.2, stagger: 0.04}, at + 0.45);
    tl.to(card, {opacity: 0, scale: 0.96, duration: 0.3, ease: 'power2.in'}, Math.max(at + 0.8, end - 0.3));
    return card;
  }

  /** EXHIBIT card: a framed archival photograph with a red tag and deadpan metadata.
   * opts: {src, label:'EXHIBIT A', lines:[...], at, until?, side:'left'|'right', aspect: w/h of the photo} */
  function exhibit(root, tl, {src, label = 'EXHIBIT A', lines = [], at, until, side = 'left', aspect = 0.8}) {
    const c = setup(root), end = until ?? at + 5;
    const box = el('div', 'rs-exhibit', root);
    const photo = el('div', 'rs-photo', box), inner = el('div', 'rs-photo-in', photo), img = el('img', '', inner);
    img.src = src; img.alt = label;
    const H = c.vertical ? 760 * c.u : 640 * c.u, W = H * aspect;
    const left = c.vertical ? (c.w - W) / 2 : side === 'left' ? c.w * 0.2 : c.w * 0.8 - W;
    const top = c.vertical ? 330 * c.u : (c.h - H) / 2 - 40 * c.u;
    Object.assign(photo.style, {left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px`});
    const pad = 22 * c.u;
    [['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].forEach(([x, y]) => {
      const b = el('div', 'rs-bracket', box);
      b.style[x] = `${x === 'left' ? left - pad : c.w - left - W - pad}px`;
      b.style[y] = `${y === 'top' ? top - pad : c.h - top - H - pad}px`;
      b.style[`border${x[0].toUpperCase() + x.slice(1)}Width`] = `${3 * c.u}px`;
      b.style[`border${y[0].toUpperCase() + y.slice(1)}Width`] = `${3 * c.u}px`;
    });
    const tag = el('div', 'rs-tag', box);
    el('h3', '', tag, label);
    for (const l of lines) el('p', '', tag, l);
    if (c.vertical) Object.assign(tag.style, {left: `${left}px`, top: `${top + H + 70 * c.u}px`, width: `${W}px`});
    else if (side === 'left') Object.assign(tag.style, {left: `${left + W + 70 * c.u}px`, top: `${top + 20 * c.u}px`, maxWidth: `${c.w - left - W - 160 * c.u}px`});
    else Object.assign(tag.style, {left: `${c.w * 0.12}px`, top: `${top + 20 * c.u}px`, maxWidth: `${left - c.w * 0.12 - 80 * c.u}px`});
    tl.set(box, {opacity: 0}, 0);
    tl.fromTo(box, {opacity: 0}, {opacity: 1, duration: 0.25}, at);
    tl.fromTo(photo, {y: 30 * c.u, rotate: side === 'left' ? -2.5 : 2.5}, {y: 0, rotate: side === 'left' ? -0.8 : 0.8, duration: 0.6, ease: 'power3.out'}, at);
    tl.fromTo(img, {scale: 1.04}, {scale: 1.16, duration: Math.max(0.5, end - at), ease: 'none'}, at);
    tl.fromTo(tag.children, {opacity: 0, x: -14}, {opacity: 1, x: 0, duration: 0.25, stagger: 0.14}, at + 0.3);
    tl.to(box, {opacity: 0, duration: 0.25}, Math.max(at + 0.6, end - 0.25));
    return {box, photo, img, tag};
  }

  /** A red X drawn over an area (two strokes). opts: {at, x, y, size, width?} in canvas px. */
  function redX(root, tl, {at, x, y, size, width, until}) {
    const c = setup(root);
    width ??= 14 * c.u;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'rs-mark'); svg.setAttribute('viewBox', '0 0 100 100');
    Object.assign(svg.style, {left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, zIndex: 35, filter: `drop-shadow(0 0 ${8 * c.u}px rgba(229,50,45,.7))`});
    const lines = [[8, 8, 92, 92], [92, 8, 8, 92]].map(([x1, y1, x2, y2]) => {
      const l = document.createElementNS(NS, 'line');
      Object.entries({x1, y1, x2, y2, stroke: 'var(--rs-danger)', 'stroke-width': width * 100 / size, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1}).forEach(([k, v]) => l.setAttribute(k, v));
      svg.appendChild(l); return l;
    });
    root.appendChild(svg);
    tl.set(lines, {attr: {'stroke-dashoffset': 1}}, 0);
    tl.to(lines[0], {attr: {'stroke-dashoffset': 0}, duration: 0.14, ease: 'power2.out'}, at);
    tl.to(lines[1], {attr: {'stroke-dashoffset': 0}, duration: 0.14, ease: 'power2.out'}, at + 0.12);
    if (until != null) tl.to(svg, {opacity: 0, duration: 0.15}, until);
    return svg;
  }

  /** Green check in a circle. opts: {at, x, y, size} */
  function check(root, tl, {at, x, y, size = 70, until}) {
    setup(root);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'rs-mark'); svg.setAttribute('viewBox', '0 0 100 100');
    Object.assign(svg.style, {left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, zIndex: 35});
    svg.innerHTML = '<circle cx="50" cy="50" r="46" fill="var(--rs-ok)"/><path d="M28 52 L44 67 L73 36" fill="none" stroke="#06140c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>';
    root.appendChild(svg);
    tl.fromTo(svg, {scale: 0, opacity: 0}, {scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)'}, at);
    if (until != null) tl.to(svg, {opacity: 0, duration: 0.15}, until);
    return svg;
  }

  /** Yellow "YOU" marker with a pointer, above (x, y). */
  function you(root, tl, {at, x, y, size = 46, label = 'YOU', until}) {
    const c = setup(root);
    const m = el('div', 'rs-you', root, label);
    Object.assign(m.style, {left: `${x - 120 * c.u}px`, width: `${240 * c.u}px`, top: `${y - size * 1.9}px`, fontSize: `${size}px`, zIndex: 35});
    const tri = el('div', '', m);
    Object.assign(tri.style, {width: 0, height: 0, margin: `${6 * c.u}px auto 0`, borderLeft: `${size * 0.32}px solid transparent`, borderRight: `${size * 0.32}px solid transparent`, borderTop: `${size * 0.36}px solid var(--rs-you)`});
    tl.fromTo(m, {opacity: 0, y: -12 * c.u}, {opacity: 1, y: 0, duration: 0.3, ease: 'power2.out'}, at);
    if (until != null) tl.to(m, {opacity: 0, duration: 0.2}, until);
    return m;
  }

  /** Numbered rule boxes popping in ("There are N rules."). opts: {total, at, y?, stagger?, hot?: n, cross?: n, crossAt?} */
  function boxes(root, tl, {total, at, y, stagger = 0.09, hot = null, hotAt = null, cross = null, crossAt = null, until}) {
    const c = setup(root);
    const row = el('div', 'rs-boxes', root);
    row.style.top = `${y ?? c.h * 0.4}px`; row.style.zIndex = 30;
    const items = Array.from({length: total}, (_, k) => el('div', 'rs-box', row, String(k + 1)));
    tl.set(items, {opacity: 0}, 0);
    tl.fromTo(items, {opacity: 0, scale: 0.4}, {opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(2)', stagger}, at);
    if (hot != null) {
      const b = items[hot - 1];
      tl.set(b, {attr: {class: 'rs-box rs-hot'}}, hotAt ?? at + total * stagger + 0.3);
      tl.fromTo(b, {scale: 1.25}, {scale: 1, duration: 0.35, ease: 'power2.out'}, hotAt ?? at + total * stagger + 0.3);
    }
    if (cross != null) {
      const size = 96 * c.u * 1.25;
      // Boxes are flex-centred; compute the box centre arithmetically so layout timing does not matter.
      const w = (c.vertical ? 104 : 96) * c.u, gap = (c.vertical ? 16 : 20) * c.u, total_w = total * w + (total - 1) * gap;
      const cx = (c.w - total_w) / 2 + (cross - 1) * (w + gap) + w / 2, cy = (y ?? c.h * 0.4) + w / 2;
      redX(root, tl, {at: crossAt ?? at + total * stagger + 0.3, x: cx, y: cy, size, width: 10 * c.u, until});
    }
    if (until != null) tl.to(row, {opacity: 0, duration: 0.2}, until);
    return {row, items};
  }

  /** Show one picture per beat: [{el, at, out?}] local times; each holds until the next starts.
   * enter: 'cut' (default) | 'fade' | 'push' (slow push-in while held). */
  function sequence(tl, shots, {duration, enter = 'cut'} = {}) {
    shots.forEach((s, k) => {
      const next = shots[k + 1], end = s.out ?? (next ? next.at : duration);
      const mode = s.enter || enter;
      tl.set(s.el, {autoAlpha: 0}, 0);
      if (mode === 'fade') tl.fromTo(s.el, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.25}, s.at);
      else tl.set(s.el, {autoAlpha: 1}, s.at);
      if (mode === 'push' || s.push) tl.fromTo(s.el, {scale: 1}, {scale: s.push || 1.06, duration: Math.max(0.1, end - s.at), ease: 'none'}, s.at);
      if (end != null) tl.set(s.el, {autoAlpha: 0}, end);
    });
  }

  window.RulesSeries = Object.freeze({mount, setup, ruleCard, exhibit, redX, check, you, boxes, sequence, captionsIn, cue, timecode, version: '1.0.0'});
})();
