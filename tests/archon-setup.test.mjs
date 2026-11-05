import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
test('Parakeet setup mode is discoverable without loading models; invalid transcription arguments fail early', async () => {
  const help = await exec('python3.12', ['scripts/parakeet.py', '--help']);
  assert.match(help.stdout, /--setup/);
  await assert.rejects(
    exec('python3.12', ['scripts/parakeet.py']),
    (e) => e.code === 2 && /audio and output are required/.test(e.stderr),
  );
});
