import test from 'node:test';
import assert from 'node:assert/strict';
import {unitsFromKai, unitsFromScenes, unitsFromWords, ends, clipBounds, checkPlan, repairPlan, edgeBackground, accentIndex, overlayHtml} from '../lib/shorts.mjs';

// 40 sentences of 5 s each (4.6 s speech + 0.4 s gap), 200 s total.
const words = Array.from({length: 40}, (_, i) => [
  {text: `Sentence`, start: i * 5, end: i * 5 + 2},
  {text: `${i}.`, start: i * 5 + 2.1, end: i * 5 + 4.6},
]).flat();
const list = unitsFromWords(words, 0).map((u, i) => ({...u, id: `S${String(i + 1).padStart(3, '0')}`}));
const opts = {count: 2, duration: 200};

test('units come from a Kai timeline, scene timing plus words, or ASR passages', () => {
  assert.equal(list.length, 40);
  assert.equal(list[3].text, 'Sentence 3.');
  const kai = unitsFromKai({scenes: [{id: 'hook', start: 10, text: 'Hi there.', words: [{text: 'Hi', start: 0.3, end: 0.5}, {text: 'there.', start: 0.6, end: 1}]}]});
  assert.deepEqual(kai, [{id: 'hook', start: 10.3, end: 11, text: 'Hi there.'}]);
  const scenes = unitsFromScenes([{id: 'a', start: 0, end: 10}, {id: 'b', start: 10, end: 12}, {id: 'c', start: 12, end: 20}], words);
  assert.deepEqual(scenes.map(s => s.id), ['a', 'b', 'c']);
  assert.equal(scenes[0].text, 'Sentence 0. Sentence 1.');
  const passages = unitsFromWords(words, 20);
  assert.equal(passages.length, 8);
  assert.ok(passages.every(p => /\.$/.test(p.text)));
  assert.deepEqual(ends('One. Two? Three. Four.'), {opening: 'One. Two?', closing: 'Three. Four.'});
});

test('clip bounds add lead and tail without reaching neighbouring speech', () => {
  const b = clipBounds(list, 'S002', 'S013', 200);
  assert.ok(b.start >= list[0].end && b.start < list[1].start);
  assert.ok(b.end > list[12].end && b.end <= list[13].start);
});

test('checkPlan enforces count, 60–180 s, ids and no overlap', () => {
  const ok = checkPlan({shorts: [
    {from: 'S001', to: 'S013', why: 'a', title: 'A'},
    {from: 'S020', to: 'S033', why: 'b', title: 'B'},
  ]}, list, opts);
  assert.deepEqual(ok.errors, []);
  const bad = checkPlan({shorts: [
    {from: 'S001', to: 'S005', why: 'a', title: 'A'},
    {from: 'S004', to: 'S040', why: ''},
  ]}, list, opts);
  assert.ok(bad.errors.some(e => /at least 60/.test(e)));
  assert.ok(bad.errors.some(e => /at most 180/.test(e)));
  assert.ok(bad.errors.some(e => /overlap/.test(e)));
  assert.ok(bad.errors.some(e => /why/.test(e)));
  assert.ok(bad.errors.some(e => /title/.test(e)));
  assert.ok(checkPlan({shorts: [{from: 'S999', to: 'S1000', why: 'x', title: 'X'}]}, list, {...opts, count: 1}).errors.length);
});

test('repairPlan stretches, trims and drops by whole sentences, recording each change', () => {
  const {plan, actions} = repairPlan({shorts: [
    {from: 'S001', to: 'S005', why: 'short'},
    {from: 'S003', to: 'S040', why: 'long and overlapping'},
  ]}, list, opts);
  assert.equal(plan.shorts.length, 2);
  const checked = checkPlan(plan, list, opts);
  assert.deepEqual(checked.errors, []);
  assert.ok(actions.length >= 2);
  assert.ok(plan.shorts.every(s => s.title && s.title.length <= 90));
  const none = repairPlan({shorts: [{from: 'S010', to: 'S001', why: 'x'}]}, list, {...opts, count: 1});
  assert.equal(none.plan.shorts.length, 0);
});

test('edgeBackground picks the edge colour and falls back to blur on busy edges', () => {
  const flat = Array.from({length: 500}, () => [12, 15, 14]);
  assert.deepEqual(edgeBackground(flat), {mode: 'solid', color: '#0c0f0e', share: 1});
  const busy = Array.from({length: 500}, (_, i) => i % 3 ? [200, 30, 30] : [10, 10, 200]);
  assert.equal(edgeBackground(busy).mode, 'blur');
});

test('accent word and overlay text', () => {
  assert.equal(accentIndex('How SLEEP Helps LLMs Keep What They Learn'), 1);
  assert.equal(accentIndex('No caps here'), -1);
  assert.equal(accentIndex('Why Rust wins', 'rust'), 1);
  const html = overlayHtml({title: 'How SLEEP Helps', background: {mode: 'solid', color: '#0c0f0e'}, videoHeight: 608});
  assert.match(html, /<span class="hot">SLEEP<\/span>/);
  assert.match(html, /WATCH THE FULL VIDEO/);
  assert.match(html, /Tap the link below ↓/);
});
