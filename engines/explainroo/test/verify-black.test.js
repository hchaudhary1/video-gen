import test from 'node:test';
import assert from 'node:assert/strict';
import { blackThreshold } from '../src/qa.js';

test('black frames are judged against the look background', () => {
  // Light and mid looks keep the usual threshold.
  assert.equal(blackThreshold({ theme: 'paper' }), 0.08);
  assert.equal(blackThreshold({ theme: 'midnight' }), Math.round(Math.min(0.08, (0.2126 * 11 + 0.7152 * 16 + 0.0722 * 32) / 255 / 2) * 1000) / 1000);
  // A near-black look's empty frame does not count as black.
  const t = blackThreshold({ theme: 'kai.json', look: { extends: 'midnight', bg: '#0e1010' } });
  assert.ok(t < 15 / 255 && t >= 0.01);
});
