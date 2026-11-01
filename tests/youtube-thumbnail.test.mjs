import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {videoIdFrom, checkThumbnail} from '../lib/youtube-upload.mjs';

test('videoIdFrom accepts IDs and common YouTube URLs', () => {
  for (const value of ['V9F6FlkinHs', 'https://youtu.be/V9F6FlkinHs', 'https://www.youtube.com/watch?v=V9F6FlkinHs&t=3',
    'https://www.youtube.com/shorts/V9F6FlkinHs', 'https://www.youtube.com/embed/V9F6FlkinHs'])
    assert.equal(videoIdFrom(value), 'V9F6FlkinHs');
  assert.throws(() => videoIdFrom('not a video'), /Not a YouTube video ID/);
});

test('checkThumbnail validates type, presence and the 2 MB limit', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'thumb-'));
  assert.equal(await checkThumbnail(dir, undefined), null);
  await writeFile(path.join(dir, 'ok.png'), Buffer.alloc(1024, 1));
  const ok = await checkThumbnail(dir, 'ok.png');
  assert.equal(ok.type, 'image/png');
  assert.equal(ok.size, 1024);
  await writeFile(path.join(dir, 'a.gif'), Buffer.alloc(10, 1));
  await assert.rejects(checkThumbnail(dir, 'a.gif'), /PNG or JPEG/);
  await assert.rejects(checkThumbnail(dir, 'missing.jpg'), /missing or empty/);
  await writeFile(path.join(dir, 'big.jpg'), Buffer.alloc(2 * 1024 * 1024 + 1, 1));
  await assert.rejects(checkThumbnail(dir, 'big.jpg'), /YouTube allows 2 MB/);
});
