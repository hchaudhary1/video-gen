// Horror sound design on the explainroo synth core (engines/explainroo/engine/audio, MIT).
// Project-owned: dark harmony, drone beds, effects and series sound signatures. Everything is
// rendered sample by sample from a seed, so the same request always produces the same WAV bytes.
import {Synth, Voice, Env, WAVES, BLOCK} from '../engines/explainroo/engine/audio/synth.js';
import {mtof, dbToGain, limitInPlace, fadeEdges} from '../engines/explainroo/engine/audio/dsp.js';
import {makeRng, hashSeed} from '../engines/explainroo/engine/audio/rng.js';
import {parseKey} from '../engines/explainroo/engine/audio/theory.js';
import {encodeWav} from '../engines/explainroo/engine/audio/wav.js';

export const SAMPLE_RATE = 48000;
export const ENGINE = 'explainroo engine/audio @ e95232c (MIT), engines/explainroo/engine/audio';

// --- harmony ---------------------------------------------------------------------------------

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};
const mod = (n, m) => ((n % m) + m) % m;

export function parseScale(name = 'minor') {
  const key = String(name).trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (!SCALES[key]) throw new Error(`Unknown scale "${name}". Use one of: ${Object.keys(SCALES).join(', ')}`);
  return key;
}

/** MIDI note of a scale degree (0 = tonic; negative or above 6 change octave). */
export function modeNote(tonicMidi, degree, scale = 'minor') {
  const steps = SCALES[parseScale(scale)];
  return tonicMidi + Math.floor(degree / steps.length) * 12 + steps[mod(degree, steps.length)];
}

/** Tonal centre of a signature: the key's pitch class and a drone root between A1 and G#2 (55–104 Hz). */
export function tonalCentre(key = 'A', scale = 'minor') {
  const pc = parseKey(key) ?? 9;
  return {pc, scale: parseScale(scale), root: 33 + mod(pc - 9, 12)};
}

// --- rendering helpers ---------------------------------------------------------------------------

const perc = (t, peak, attack, tau) => new Env(0).set(0, t).lin(peak, t + attack).target(0, t + attack, tau);
const seedOf = rng => Math.floor(rng.next() * 4294967295) || 1;

function renderSynth(duration, build, {reverb = null, reverbLevel = 0, highpass = 22, sampleRate = SAMPLE_RATE} = {}) {
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const syn = new Synth(sampleRate, length, {reverb, reverbLevel, highpass});
  build(syn);
  const L = new Float32Array(length), R = new Float32Array(length);
  const bl = new Float32Array(BLOCK), br = new Float32Array(BLOCK);
  for (let i0 = 0; i0 < length; i0 += BLOCK) {
    const n = Math.min(BLOCK, length - i0);
    bl.fill(0); br.fill(0);
    syn.renderBlock(i0, n, bl, br);
    L.set(bl.subarray(0, n), i0); R.set(br.subarray(0, n), i0);
  }
  return {sampleRate, L, R};
}

function peakOf({L, R}) {
  let p = 0;
  for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > p) p = a; if (b > p) p = b; }
  return p;
}

function normalize(audio, peakDb) {
  const p = peakOf(audio);
  if (p > 0) { const g = dbToGain(peakDb) / p; for (const c of [audio.L, audio.R]) for (let i = 0; i < c.length; i++) c[i] *= g; }
  return audio;
}

function noise(syn, lane, t, peak, tau, rng, {type = 'lowpass', freq = 1200, q = 0.8, pink = false, attack = 0.001, pan = 0, freqEnv = null} = {}) {
  const v = new Voice(t, t + attack + tau * 7 + 0.02);
  v.layer({wave: pink ? WAVES.pink : WAVES.noise, seed: seedOf(rng), amp: perc(t, peak, attack, tau)});
  v.filter = {type, freq, q, ...(freqEnv ? {freqEnv} : {})};
  v.pan = pan;
  syn.add(lane, v);
  return v;
}

function sweepTone(syn, lane, t, wave, from, to, glide, peak, attack, tau, {pan = 0, detune = 0} = {}) {
  const v = new Voice(t, t + attack + tau * 7 + 0.02);
  v.layer({wave, detune, freqEnv: new Env(from).set(from, t).exp(to, t + glide), amp: perc(t, peak, attack, tau)});
  v.pan = pan;
  syn.add(lane, v);
  return v;
}

/** Wraps rendered channels so the vendored 16-bit encoder can write them. */
export function toWav(audio) {
  const chans = [audio.L, audio.R];
  return Buffer.from(encodeWav({sampleRate: audio.sampleRate, length: audio.L.length, numberOfChannels: 2, getChannelData: c => chans[c]}));
}

// --- drone beds ---------------------------------------------------------------------------------
// A bed's schedule depends only on its seed and time, never on the requested duration, so a longer
// render starts with exactly the same samples: every film in an identity opens on the same sound.

const BED_TRIM_DB = {dread: -6, pulse: -6, 'music-box': -6};
export const BED_STYLES = {
  dread: 'Low detuned drone on the tonic with a slow-breathing filter, a fifth above, dark scale-colour swells and air.',
  pulse: 'The dread drone with a slow, felt sub pulse like a resting heartbeat (about 52 bpm).',
  'music-box': 'A quieter dread drone under a sparse, slightly detuned music-box figure in the scale.',
};
export const TEXTURES = {
  hum: 'Fluorescent mains hum (60 Hz and harmonics) with a faint flicker buzz.',
  hiss: 'Telephone-line hiss: band-limited noise with slow fades.',
  tick: 'A distant clock tick every second.',
  none: 'No texture layer.',
};

function droneLayers(syn, {root, scale, seed, duration, level = 1}) {
  const sub = syn.lane({gain: level, filter: {type: 'lowpass', freq: 160, q: 0.6}});
  const body = syn.lane({gain: level, reverb: 0.25, filter: {type: 'lowpass', freq: 260, q: 0.9, lfo: {rate: 0.031, depth: 110}}});
  const colour = syn.lane({gain: level, reverb: 0.6, panLfo: {rate: 0.043, depth: 0.5}, filter: {type: 'lowpass', freq: 900, q: 0.7, lfo: {rate: 0.019, depth: 300}}});
  const air = syn.lane({gain: level, reverb: 0.4, panLfo: {rate: 0.071, depth: 0.7}, filter: {type: 'bandpass', freq: 520, q: 0.7, lfo: {rate: 0.027, depth: 180}}});
  const end = duration + 0.5;
  const f = mtof(root);
  // Sub and body: one long voice each, amplitude breathing on a seeded, time-ordered contour.
  // Each contour has its own generator, so a longer render never shifts another layer's randomness.
  let contour = 0;
  const breathe = (peak, depth, period) => {
    const breath = makeRng(hashSeed(seed, 'breath', contour++)), e = new Env(0).set(0, 0).lin(peak, 2);
    for (let t = 2, k = 0; t < end; k++) { t += period * (0.8 + 0.4 * breath.next()); e.lin(peak * (1 - depth * (k % 2 ? 0 : 1) * (0.5 + 0.5 * breath.next())), t); }
    return e;
  };
  const subV = new Voice(0, end);
  subV.layer({wave: WAVES.sine, freq: f, amp: breathe(0.34, 0.18, 5.5)});
  subV.layer({wave: WAVES.sine, freq: f * 2, amp: breathe(0.07, 0.3, 7)});
  syn.add(sub, subV);
  const bodyV = new Voice(0, end);
  for (const d of [-7, 6]) bodyV.layer({wave: WAVES.saw, freq: f, detune: d, amp: breathe(0.085, 0.25, 6.5)});
  bodyV.layer({wave: WAVES.tri, freq: mtof(root + 7), detune: 3, amp: breathe(0.05, 0.4, 9)});
  bodyV.layer({wave: WAVES.sine, freq: f * 3, amp: breathe(0.03, 0.5, 8)});
  bodyV.layer({wave: WAVES.sine, freq: f * 12, amp: breathe(0.0045, 0.6, 4.5)});
  syn.add(body, bodyV);
  // Scale-colour swells: the darkest degrees of the mode (b2, b6, b5) bloom and fade.
  const steps = SCALES[scale], dark = [steps[1], steps[5], steps[4] === 6 ? 6 : steps[6]].map(s => root + 12 + s);
  const swell = makeRng(hashSeed(seed, 'swell'));
  for (let t = 4 + swell.range(0, 4); t < end; t += swell.range(9, 16)) {
    const note = swell.pick(dark), len = swell.range(5, 8), peak = swell.range(0.018, 0.03);
    const v = new Voice(t, t + len + 6);
    for (const d of [-9, 8]) v.layer({wave: WAVES.saw, freq: mtof(note), detune: d, amp: new Env(0).set(0, t).lin(peak, t + len * 0.55).target(0, t + len * 0.55, len * 0.25)});
    syn.add(colour, v);
  }
  // Air: pink noise drifting in level.
  const airRng = makeRng(hashSeed(seed, 'air')), airEnv = new Env(0).set(0, 0);
  for (let t = 0; t < end; t += 2) airEnv.lin(airRng.range(0.03, 0.075), t + 2);
  const airV = new Voice(0, end);
  airV.layer({wave: WAVES.pink, seed: hashSeed(seed, 'air-noise'), amp: airEnv});
  syn.add(air, airV);
}

function textureLayer(syn, texture, {seed, duration}) {
  const end = duration + 0.5;
  if (texture === 'hum') {
    const lane = syn.lane({gain: 1, filter: {type: 'lowpass', freq: 900, q: 0.6}, pan: -0.15});
    const v = new Voice(0, end), flick = makeRng(hashSeed(seed, 'flicker')), amp = new Env(0).set(0, 0).lin(0.02, 1.5);
    for (let t = 1.5; t < end;) { t += flick.range(3, 9); amp.set(0.02, t).lin(0.034, t + 0.04).lin(0.012, t + 0.09).lin(0.02, t + 0.2); }
    for (const [h, a] of [[60, 1], [120, 0.7], [180, 0.45], [240, 0.2]]) v.layer({wave: WAVES.sine, freq: h, amp: a === 1 ? amp : new Env(0).set(0, 0).lin(0.02 * a, 1.5)});
    v.layer({wave: WAVES.square, freq: 120, amp: new Env(0).set(0, 0).lin(0.003, 1.5)});
    syn.add(lane, v);
  } else if (texture === 'hiss') {
    const lane = syn.lane({gain: 1, filter: {type: 'bandpass', freq: 2400, q: 0.5}, panLfo: {rate: 0.05, depth: 0.3}});
    const r = makeRng(hashSeed(seed, 'hiss')), amp = new Env(0).set(0, 0);
    for (let t = 0; t < end; t += 3) amp.lin(r.range(0.006, 0.016), t + 3);
    const v = new Voice(0, end); v.layer({wave: WAVES.noise, seed: hashSeed(seed, 'hiss-noise'), amp}); syn.add(lane, v);
  } else if (texture === 'tick') {
    const lane = syn.lane({stereo: true, reverb: 0.5});
    const r = makeRng(hashSeed(seed, 'tick'));
    for (let t = 1, k = 0; t < end; t += 1, k++) noise(syn, lane, t, 0.05 * (k % 2 ? 0.8 : 1), 0.004, r, {type: 'bandpass', freq: k % 2 ? 1900 : 2500, q: 3, pan: 0.35});
  } else if (texture && texture !== 'none') throw new Error(`Unknown texture "${texture}". Use one of: ${Object.keys(TEXTURES).join(', ')}`);
}

/** Render a drone bed: {style, key, scale, seed, texture, motif} for `duration` seconds. */
export function renderBed({style = 'dread', key = 'A', scale = 'minor', seed = 1, texture = 'none', motif = [0, 1, 4], duration, sampleRate = SAMPLE_RATE} = {}) {
  if (!BED_STYLES[style]) throw new Error(`Unknown bed style "${style}". Use one of: ${Object.keys(BED_STYLES).join(', ')}`);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) throw new Error('Bed duration must be between 0 and 3600 seconds.');
  const {root, scale: sc} = tonalCentre(key, scale);
  const audio = renderSynth(duration, syn => {
    droneLayers(syn, {root, scale: sc, seed, duration, level: style === 'music-box' ? 0.6 : 1});
    if (style === 'pulse') {
      const lane = syn.lane({gain: 1, filter: {type: 'lowpass', freq: 140, q: 0.7}});
      const r = makeRng(hashSeed(seed, 'pulse')), beat = 60 / 52;
      for (let t = 3; t < duration + 0.5; t += beat) {
        const vel = r.range(0.8, 1);
        sweepTone(syn, lane, t, WAVES.sine, 78, 44, 0.09, 0.32 * vel, 0.006, 0.075);
        sweepTone(syn, lane, t + 0.27, WAVES.sine, 70, 42, 0.08, 0.22 * vel, 0.006, 0.07);
      }
    }
    if (style === 'music-box') {
      const lane = syn.lane({stereo: true, reverb: 0.7});
      const r = makeRng(hashSeed(seed, 'music-box')), tonic = root + 48;
      let t = 2.5, step = 0;
      while (t < duration + 0.5) {
        const phrase = r.int(3, 5);
        for (let k = 0; k < phrase && t < duration + 0.5; k++) {
          const deg = motif[(step++) % motif.length] + (r.chance(0.25) ? r.pick([-1, 1, 2]) : 0);
          const fq = mtof(modeNote(tonic, deg, sc)) * Math.pow(2, r.jitter(14) / 1200), vel = r.range(0.55, 1);
          const v = new Voice(t, t + 3.2);
          for (const [ratio, amp, tau] of [[1, 1, 0.5], [2.01, 0.32, 0.26], [3.98, 0.18, 0.12], [6.3, 0.07, 0.06]])
            v.layer({wave: WAVES.sine, freq: fq * ratio, amp: perc(t, 0.05 * vel * amp, 0.002, tau)});
          v.pan = r.range(-0.4, 0.4);
          syn.add(lane, v);
          t += r.range(0.42, 0.8);
        }
        t += r.range(3.5, 7);
      }
    }
    textureLayer(syn, texture, {seed, duration});
  }, {reverb: {room: 0.9, damp: 0.45, preDelay: 0.03, lowCut: 120}, reverbLevel: 0.35, sampleRate});
  const g = dbToGain(BED_TRIM_DB[style]);
  for (const c of [audio.L, audio.R]) for (let i = 0; i < c.length; i++) c[i] *= g;
  limitInPlace([audio.L, audio.R], sampleRate, {ceilingDb: -3});
  fadeEdges([audio.L, audio.R], sampleRate, 0.01, 0.05);
  return {...audio, duration};
}

// --- effects --------------------------------------------------------------------------------------
// Each effect: {description, dur (default seconds), peakDb (normalized peak), play(syn, lane, p)}.
// p: {rng, dur, tonic (MIDI, octave 4), root (drone MIDI), scale, motif, count, interval, bpm}.

const ROOM = {room: 0.55, damp: 0.5, preDelay: 0.008, lowCut: 200};

export const EFFECTS = {
  impact: {
    description: 'Heavy hit: pitched-down thump, crack and low rumble (a reveal, a cut to black).', dur: 1.8, peakDb: -1,
    play(syn, lane, p) {
      sweepTone(syn, lane, 0, WAVES.sine, 150, 38, 0.28, 1, 0.002, 0.26);
      noise(syn, lane, 0, 0.55, 0.05, p.rng, {type: 'lowpass', freq: 1800});
      noise(syn, lane, 0, 0.6, 0.55, p.rng, {type: 'lowpass', freq: 260, pink: true});
    },
  },
  boom: {
    description: 'Long cinematic sub boom with rumble tail (rule cards, big turns).', dur: 4, peakDb: -1,
    play(syn, lane, p) {
      sweepTone(syn, lane, 0, WAVES.sine, 70, 27, 1.6, 1, 0.004, 0.85);
      sweepTone(syn, lane, 0, WAVES.saw, mtof(p.root - 12), mtof(p.root - 14), 2, 0.12, 0.01, 0.6).filter = {type: 'lowpass', freq: 160, q: 0.7};
      noise(syn, lane, 0, 0.5, 1.1, p.rng, {type: 'lowpass', freq: 140, pink: true, attack: 0.01});
      noise(syn, lane, 0, 0.3, 0.04, p.rng, {type: 'lowpass', freq: 900});
    },
  },
  'sub-drop': {
    description: 'Sine falling from 110 Hz to 26 Hz (the floor goes out; align "start").', dur: 1.8, peakDb: -1,
    play(syn, lane, p) {
      const v = new Voice(0, p.dur + 0.5);
      v.layer({wave: WAVES.sine, freqEnv: new Env(110).set(110, 0).exp(26, p.dur), amp: new Env(0).set(0, 0).lin(1, 0.02).target(0, 0.02, p.dur / 3)});
      v.layer({wave: WAVES.tri, freqEnv: new Env(220).set(220, 0).exp(52, p.dur), amp: new Env(0).set(0, 0).lin(0.12, 0.02).target(0, 0.02, p.dur / 5)});
      syn.add(lane, v);
    },
  },
  'reverse-swell': {
    description: 'Reversed cymbal and bell swelling into a hard stop at its end (align "end" on the hit).', dur: 2, peakDb: -2,
    play(syn, lane, p) {
      const end = p.dur;
      const n = new Voice(0, end + 0.05);
      n.layer({wave: WAVES.pink, seed: seedOf(p.rng), amp: new Env(0).set(0.0001, 0).exp(0.6, end).lin(0, end + 0.02)});
      n.filter = {type: 'bandpass', q: 0.8, freqEnv: new Env(400).set(400, 0).exp(5200, end)};
      syn.add(lane, n);
      const b = new Voice(0, end + 0.05);
      for (const [r, a] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) b.layer({wave: WAVES.sine, freq: mtof(p.tonic + 12) * r, amp: new Env(0).set(0.0001, 0).exp(0.35 * a, end).lin(0, end + 0.02)});
      syn.add(lane, b);
    },
  },
  riser: {
    description: 'Dissonant rising build (tonic and minor second gliding up an octave) ending on its last sample.', dur: 3, peakDb: -2,
    play(syn, lane, p) {
      const end = p.dur;
      const v = new Voice(0, end + 0.05);
      for (const [semi, d] of [[0, -8], [1, 9], [-12, 0]]) {
        const a = mtof(p.tonic - 12 + semi), b = mtof(p.tonic + semi);
        v.layer({wave: WAVES.saw, detune: d, freqEnv: new Env(a).set(a, 0).exp(b, end), amp: new Env(0).set(0.0001, 0).exp(0.16, end).lin(0, end + 0.03)});
      }
      v.filter = {type: 'lowpass', q: 1.2, freqEnv: new Env(300).set(300, 0).exp(5200, end)};
      syn.add(lane, v);
      const n = new Voice(0, end + 0.05);
      n.layer({wave: WAVES.pink, seed: seedOf(p.rng), amp: new Env(0).set(0.0001, 0).exp(0.4, end).lin(0, end + 0.03)});
      n.filter = {type: 'bandpass', q: 1.4, freqEnv: new Env(250).set(250, 0).exp(7000, end)};
      syn.add(lane, n);
    },
  },
  heartbeat: {
    description: 'Lub-dub heartbeat; count beats at bpm (default 4 at 58 bpm).', dur: null, peakDb: -1,
    duration: p => (p.count || 4) * 60 / (p.bpm || 58) + 0.6,
    play(syn, lane, p) {
      const beat = 60 / (p.bpm || 58);
      for (let k = 0; k < (p.count || 4); k++) {
        const t = k * beat, vel = p.rng.range(0.85, 1);
        sweepTone(syn, lane, t, WAVES.sine, 82, 42, 0.1, vel, 0.004, 0.07).filter = {type: 'lowpass', freq: 220, q: 0.7};
        sweepTone(syn, lane, t + 0.26, WAVES.sine, 74, 40, 0.09, 0.7 * vel, 0.004, 0.065).filter = {type: 'lowpass', freq: 200, q: 0.7};
        noise(syn, lane, t, 0.08 * vel, 0.02, p.rng, {type: 'lowpass', freq: 500});
      }
    },
  },
  creak: {
    description: 'Wooden creak: slow stick-slip through door-panel resonances (a floorboard, a door easing open).', dur: 1.6, peakDb: -2,
    play(syn, lane, p) {
      const r = p.rng, end = p.dur;
      const rate = new Env(30).set(r.range(22, 34), 0), band = new Env(700).set(r.range(600, 800), 0), amp = new Env(0).set(0, 0).lin(0.7, 0.12);
      for (let t = 0.08; t < end - 0.1; t += r.range(0.05, 0.12)) { rate.lin(r.range(18, 75), t); band.lin(r.range(520, 1500), t); amp.lin(r.range(0.35, 1), t); }
      amp.lin(0, end);
      for (const [mult, q, g] of [[1, 6, 1], [2.3, 9, 0.5]]) {
        const v = new Voice(0, end + 0.1);
        v.layer({wave: WAVES.saw, freqEnv: rate, amp: g === 1 ? amp : new Env(0).set(0, 0).lin(0.35, 0.2).lin(0.2, end * 0.7).lin(0, end)});
        v.filter = {type: 'bandpass', q, freqEnv: mult === 1 ? band : new Env(1700).set(1700, 0).lin(2300, end)};
        v.pan = mult === 1 ? -0.1 : 0.15;
        syn.add(lane, v);
      }
    },
  },
  knock: {
    description: 'Knuckles on a wooden door; count knocks interval seconds apart (default 3 at 0.62 s).', dur: null, peakDb: -1,
    duration: p => ((p.count || 3) - 1) * (p.interval || 0.62) + 0.9,
    play(syn, lane, p) {
      const r = p.rng;
      for (let k = 0; k < (p.count || 3); k++) {
        const t = k * (p.interval || 0.62) + (k ? r.jitter(0.025) : 0), vel = k ? r.range(0.82, 1) : 1;
        sweepTone(syn, lane, t, WAVES.sine, 230, 120, 0.03, 0.9 * vel, 0.001, 0.035);
        sweepTone(syn, lane, t, WAVES.sine, 95, 70, 0.05, 0.6 * vel, 0.001, 0.06);
        noise(syn, lane, t, 0.55 * vel, 0.016, r, {type: 'bandpass', freq: r.range(950, 1250), q: 1.8});
        noise(syn, lane, t, 0.3 * vel, 0.09, r, {type: 'bandpass', freq: 340, q: 4});
      }
    },
  },
  glitch: {
    description: 'Digital stutter: gated square and noise fragments (a frame tears, a picture lies).', dur: 0.55, peakDb: -4,
    play(syn, lane, p) {
      const r = p.rng;
      for (let t = 0; t < p.dur - 0.03;) {
        const len = r.range(0.015, 0.06), pk = r.range(0.4, 1), pan = r.range(-0.7, 0.7);
        if (r.chance(0.55)) {
          const v = new Voice(t, t + len + 0.01);
          v.layer({wave: WAVES.square, freq: r.range(180, 2800), amp: new Env(0).set(pk * 0.5, t).set(0, t + len)});
          v.pan = pan; syn.add(lane, v);
        } else {
          const v = new Voice(t, t + len + 0.01);
          v.layer({wave: WAVES.noise, seed: seedOf(r), amp: new Env(0).set(pk, t).set(0, t + len)});
          v.filter = {type: 'bandpass', freq: r.range(800, 6000), q: 1.5}; v.pan = pan; syn.add(lane, v);
        }
        t += len + (r.chance(0.3) ? r.range(0.01, 0.04) : 0);
      }
    },
  },
  static: {
    description: 'TV static burst with crackle and a mains buzz underneath.', dur: 0.9, peakDb: -6,
    play(syn, lane, p) {
      const r = p.rng, amp = new Env(0).set(0, 0);
      for (let t = 0; t < p.dur - 0.05; t += 0.012) amp.lin(r.range(0.25, 1), t + 0.012);
      amp.lin(0, p.dur);
      const v = new Voice(0, p.dur + 0.02);
      v.layer({wave: WAVES.noise, seed: seedOf(r), amp});
      v.filter = {type: 'highpass', freq: 1600, q: 0.7};
      syn.add(lane, v);
      const b = new Voice(0, p.dur + 0.02);
      b.layer({wave: WAVES.square, freq: 60, amp: new Env(0).set(0, 0).lin(0.08, 0.02).set(0.08, p.dur - 0.05).lin(0, p.dur)});
      b.filter = {type: 'lowpass', freq: 600, q: 0.7};
      syn.add(lane, b);
    },
  },
  hum: {
    description: 'Electrical hum swelling in and out (a fluorescent tube, a fridge, a phone line).', dur: 3, peakDb: -6,
    play(syn, lane, p) {
      const v = new Voice(0, p.dur + 0.02), shape = a => new Env(0).set(0, 0).lin(a, 0.4).set(a, p.dur - 0.5).lin(0, p.dur);
      for (const [h, a] of [[60, 1], [120, 0.8], [180, 0.5], [240, 0.3], [300, 0.15]]) v.layer({wave: WAVES.sine, freq: h, amp: shape(0.3 * a)});
      v.layer({wave: WAVES.square, freq: 120, amp: shape(0.03)});
      syn.add(lane, v);
    },
  },
  tinnitus: {
    description: 'High ringing tone with slow beating, fading in and out (shock, silence after a hit).', dur: 3, peakDb: -14,
    play(syn, lane, p) {
      const v = new Voice(0, p.dur + 0.02), f = 6200 + p.rng.range(-300, 300);
      for (const [df, a] of [[0, 1], [9, 0.6]]) v.layer({wave: WAVES.sine, freq: f + df, amp: new Env(0).set(0, 0).lin(0.4 * a, p.dur * 0.35).set(0.4 * a, p.dur * 0.6).lin(0, p.dur)});
      syn.add(lane, v);
    },
  },
  stinger: {
    description: 'Horror stab: tonic, minor second and tritone cluster with a hit and a closing filter.', dur: 3, peakDb: -1,
    play(syn, lane, p) {
      const v = new Voice(0, p.dur + 0.05);
      for (const [semi, d] of [[0, -10], [1, 8], [6, -4], [12, 12], [13, -7]]) v.layer({wave: WAVES.saw, freq: mtof(p.tonic - 12 + semi), detune: d, amp: perc(0, 0.13, 0.004, 0.75)});
      v.filter = {type: 'lowpass', q: 1.1, freqEnv: new Env(5000).set(5000, 0).target(500, 0.01, 0.35)};
      syn.add(lane, v);
      sweepTone(syn, lane, 0, WAVES.sine, 120, 36, 0.3, 0.9, 0.002, 0.3);
      noise(syn, lane, 0, 0.45, 0.06, p.rng, {type: 'highpass', freq: 1500});
    },
  },
  tick: {
    description: 'Clock tick-tock; count ticks interval seconds apart (default 1 tick).', dur: null, peakDb: -3,
    duration: p => ((p.count || 1) - 1) * (p.interval || 1) + 0.25,
    play(syn, lane, p) {
      for (let k = 0; k < (p.count || 1); k++) {
        const t = k * (p.interval || 1), tock = k % 2 === 1;
        noise(syn, lane, t, 0.8, 0.004, p.rng, {type: 'bandpass', freq: tock ? 1900 : 2600, q: 3});
        sweepTone(syn, lane, t, WAVES.sine, tock ? 1400 : 1850, tock ? 1350 : 1800, 0.01, 0.35, 0.0005, 0.006);
      }
    },
  },
  ident: {
    description: "The identity's signature sting: sub hit, crack and the motif as a detuned bell cluster.", dur: 3, peakDb: -1,
    play(syn, lane, p) {
      sweepTone(syn, lane, 0.04, WAVES.sine, 120, 34, 0.35, 0.9, 0.002, 0.35);
      noise(syn, lane, 0.04, 0.4, 0.035, p.rng, {type: 'highpass', freq: 1400});
      noise(syn, lane, 0.04, 0.35, 0.5, p.rng, {type: 'lowpass', freq: 220, pink: true});
      p.motif.forEach((deg, k) => {
        const f = mtof(modeNote(p.tonic + 12, deg, p.scale)) * Math.pow(2, (k - 1) * 9 / 1200), t = 0.04 + k * 0.035;
        const v = new Voice(t, t + 3);
        for (const [r, a, tau] of [[1, 1, 0.6], [2.76, 0.35, 0.3], [5.4, 0.12, 0.14]]) v.layer({wave: WAVES.sine, freq: f * r, amp: perc(t, 0.18 * a, 0.002, tau)});
        v.pan = (k - 1) * 0.35; syn.add(lane, v);
      });
      const s = new Voice(0.04, 3);
      s.layer({wave: WAVES.saw, freq: mtof(p.root), detune: 0, amp: perc(0.04, 0.12, 0.01, 0.7)});
      s.layer({wave: WAVES.saw, freq: mtof(p.root + 1), detune: 5, amp: perc(0.04, 0.08, 0.01, 0.6)});
      s.filter = {type: 'lowpass', freq: 420, q: 0.9};
      syn.add(lane, s);
    },
  },
};

export const EFFECT_NAMES = Object.keys(EFFECTS);

/** Render one named effect. Same name + params + seed = same samples. */
export function renderEffect(name, {seed = 1, key = 'A', scale = 'minor', motif = [0, 1, 4], dur, count, interval, bpm, sampleRate = SAMPLE_RATE} = {}) {
  const def = EFFECTS[name];
  if (!def) throw new Error(`Unknown effect "${name}". Use one of: ${EFFECT_NAMES.join(', ')}`);
  for (const [label, v, lo, hi] of [['dur', dur, 0.05, 30], ['count', count, 1, 24], ['interval', interval, 0.05, 5], ['bpm', bpm, 20, 200]])
    if (v != null && (!Number.isFinite(v) || v < lo || v > hi)) throw new Error(`${name}: ${label} must be between ${lo} and ${hi}.`);
  if (count != null && !Number.isInteger(count)) throw new Error(`${name}: count must be a whole number.`);
  const {root, scale: sc} = tonalCentre(key, scale);
  const p = {rng: makeRng(hashSeed('effect', name, seed, dur ?? '', count ?? '', interval ?? '', bpm ?? '')), dur: dur ?? def.dur, count, interval, bpm,
    tonic: 60 + mod(root - 60, 12), root, scale: sc, motif};
  const body = def.duration ? def.duration(p) : p.dur;
  p.dur = p.dur ?? body;
  const tail = name === 'boom' || name === 'stinger' || name === 'ident' ? 1.2 : 0.6;
  const audio = renderSynth(body + tail, syn => def.play(syn, syn.lane({stereo: true, reverb: 1}), p), {reverb: ROOM, reverbLevel: name === 'glitch' || name === 'static' ? 0.08 : 0.22, sampleRate});
  fadeEdges([audio.L, audio.R], sampleRate, 0.0005, 0.08);
  normalize(audio, def.peakDb);
  return {...audio, duration: audio.L.length / sampleRate};
}

// --- identity signatures ---------------------------------------------------------------------------

/** Validate a signature from the identity registry: {seed, key, scale, bed, texture, motif}. */
export function signature(sound = {}) {
  const out = {seed: sound.seed, key: sound.key ?? 'A', scale: parseScale(sound.scale ?? 'minor'), bed: sound.bed ?? 'dread', texture: sound.texture ?? 'none', motif: sound.motif ?? [0, 1, 4]};
  if (!Number.isInteger(out.seed) || out.seed < 0) throw new Error('A sound signature needs an integer seed.');
  parseKey(out.key);
  if (!BED_STYLES[out.bed]) throw new Error(`Unknown bed style "${out.bed}".`);
  if (!TEXTURES[out.texture]) throw new Error(`Unknown texture "${out.texture}".`);
  if (!Array.isArray(out.motif) || out.motif.length < 2 || out.motif.length > 6 || !out.motif.every(Number.isInteger)) throw new Error('motif must be 2–6 whole scale degrees.');
  return out;
}

/** Every file of an identity's sound kit: the bed, the ident and one take of each effect, all from the identity seed. */
export function identityKitPlan(id, sound, {duration}) {
  const sig = signature(sound), base = {key: sig.key, scale: sig.scale, motif: sig.motif};
  const files = [{name: `music/${id}-bed.wav`, kind: 'bed', params: {style: sig.bed, texture: sig.texture, seed: sig.seed, duration, ...base}}];
  for (const effect of EFFECT_NAMES) files.push({name: `sfx/${id}-${effect}.wav`, kind: 'effect', effect, params: {seed: sig.seed, ...base}});
  files.push({name: `sfx/${id}-knock-1.wav`, kind: 'effect', effect: 'knock', params: {seed: sig.seed, count: 1, ...base}});
  files.push({name: `sfx/${id}-knock-2.wav`, kind: 'effect', effect: 'knock', params: {seed: sig.seed, count: 2, ...base}});
  files.push({name: `sfx/${id}-heartbeat-slow.wav`, kind: 'effect', effect: 'heartbeat', params: {seed: sig.seed, count: 6, bpm: 48, ...base}});
  return files;
}

export function renderPlanned(file) {
  return file.kind === 'bed' ? renderBed(file.params) : renderEffect(file.effect, file.params);
}
