import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { youtubeUpload } from '../lib/youtube-upload.mjs';
const root = path.resolve(import.meta.dirname, '..');
test('durable uploader reuses completed remote video, rejects changed copy, reconciles crash', async () => {
  const dir = await mkdtemp(path.join(root, '.cache/upload-test-'));
  const oldCache = process.env.VG_CACHE,
    oldFetch = globalThis.fetch;
  process.env.VG_CACHE = dir;
  try {
    const auth = path.join(dir, 'youtube-oauth');
    await mkdir(auth);
    await writeFile(
      path.join(auth, 'credentials.json'),
      JSON.stringify({ installed: { client_id: 'fixture', client_secret: 'fixture' } }),
    );
    await writeFile(
      path.join(auth, 'token.json'),
      JSON.stringify({ access_token: 'fixture', expiry_date: Date.now() + 3600000 }),
    );
    const file = path.join(dir, 'video.mp4'),
      journal = path.join(dir, 'upload.json');
    await writeFile(file, 'fixture, not real media');
    let initiations = 0,
      chunks = 0,
      probes = 0;
    globalThis.fetch = async (url, opts) => {
      if (opts.method === 'POST') {
        initiations++;
        return new Response('', { headers: { location: 'https://fixture.invalid/session' } });
      }
      if (opts.headers['content-range'].startsWith('bytes */')) probes++;
      else {
        chunks++;
        for await (const _ of opts.body) {
        }
      }
      return Response.json({ id: 'fixture1234', status: { privacyStatus: 'unlisted' } });
    };
    const opts = { file, journal, title: 'Approved fixture', privacy: 'unlisted' };
    assert.equal(await youtubeUpload(root, opts), 'fixture1234');
    assert.equal(await youtubeUpload(root, opts), 'fixture1234');
    assert.equal(initiations, 1);
    assert.equal(chunks, 1);
    await assert.rejects(
      youtubeUpload(root, { ...opts, title: 'Changed' }),
      /different video or publishing copy/,
    );
    const session = JSON.parse(await readFile(journal));
    delete session.video;
    session.state = 'uploading';
    await writeFile(journal, JSON.stringify(session));
    assert.equal(await youtubeUpload(root, opts), 'fixture1234');
    assert.equal(probes, 1);
    assert.equal(initiations, 1);
    session.state = 'initiating';
    delete session.location;
    await writeFile(journal, JSON.stringify(session));
    await assert.rejects(youtubeUpload(root, opts), /outcome uncertain/);
    assert.equal(initiations, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCache === undefined) delete process.env.VG_CACHE;
    else process.env.VG_CACHE = oldCache;
    await rm(dir, { recursive: true, force: true });
  }
});
test('channel ownership and handle are checked before upload mutation', async () => {
  const dir = await mkdtemp(path.join(root, '.cache/channel-test-'));
  const oldCache = process.env.VG_CACHE,
    oldFetch = globalThis.fetch;
  process.env.VG_CACHE = dir;
  try {
    await mkdir(path.join(dir, 'youtube-oauth'));
    await writeFile(
      path.join(dir, 'youtube-oauth/credentials.json'),
      JSON.stringify({ installed: { client_id: 'fixture', client_secret: 'fixture' } }),
    );
    await writeFile(
      path.join(dir, 'youtube-oauth/token.json'),
      JSON.stringify({ access_token: 'fixture', expiry_date: Date.now() + 3600000 }),
    );
    const file = path.join(dir, 'video.mp4');
    await writeFile(file, 'fixture');
    let mutations = 0;
    globalThis.fetch = async (url, opts) => {
      if (opts.method && opts.method !== 'GET') mutations++;
      return Response.json({
        items: [{ id: 'UC' + 'x'.repeat(22), snippet: { customUrl: '@another-channel' } }],
      });
    };
    const opts = {
      file,
      title: 'Fixture',
      expectedChannelId: 'UC' + 'x'.repeat(22),
      expectedChannelHandle: 'abdupdates',
      journal: path.join(dir, 'session.json'),
    };
    await assert.rejects(youtubeUpload(root, opts), /channel handle/);
    await assert.rejects(
      youtubeUpload(root, { ...opts, expectedChannelId: 'UC' + 'y'.repeat(22) }),
      /channelId/,
    );
    assert.equal(mutations, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCache === undefined) delete process.env.VG_CACHE;
    else process.env.VG_CACHE = oldCache;
    await rm(dir, { recursive: true, force: true });
  }
});
