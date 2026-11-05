#!/usr/bin/env node
// Setup and read-only inspection utilities. Production is scheduled by Archon.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { youtubeAuth } from '../lib/youtube-upload.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, slug] = process.argv.slice(2);
if (command === 'youtube-auth') await youtubeAuth(root);
else if (command === 'watch') {
  const { serveWatch } = await import('../lib/watch.mjs');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error('Explicit project slug required');
  const { url } = await serveWatch(root, slug);
  console.log(url);
} else
  throw new Error(
    'Setup utilities: youtube-auth; read-only inspection: watch <project>. Start production with Archon.',
  );
