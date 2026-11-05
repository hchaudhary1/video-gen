#!/usr/bin/env node
// Provision/load media prerequisites without creating a production, audio take, or approval.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  cache = path.join(root, '.cache/video-gen');
const env = {
  ...process.env,
  UV_CACHE_DIR: path.join(cache, 'uv'),
  HF_HOME: path.join(cache, 'huggingface'),
  NEMO_CACHE_DIR: path.join(cache, 'nemo'),
  TORCH_HOME: path.join(cache, 'torch'),
  XDG_CACHE_HOME: cache,
  TMPDIR: path.join(cache, 'tmp'),
  EXPLAINROO_CACHE: path.join(root, '.cache/explainroo'),
};
await mkdir(env.TMPDIR, { recursive: true });
const run = (cmd, args, extra = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...env, ...extra },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
const resultJSON = (output) => {
  for (const line of output.split('\n').reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  throw new Error('Model loader did not return structured readiness');
};
const checks = {};
for (const [cmd, args] of [
  ['ffmpeg', ['-version']],
  ['ffprobe', ['-version']],
  ['uv', ['--version']],
  ['python3.12', ['--version']],
])
  checks[cmd] = (await run(cmd, args)).split('\n')[0];
const { chromePath } = await import('../lib/native.mjs');
checks.chrome = await chromePath();
if (process.argv.includes('--load-models')) {
  console.error('Loading Ming model (no audio generation)…');
  checks.ming = resultJSON(
    await run(
      path.join(cache, 'ming/env/bin/python'),
      ['scripts/ming-readiness.py', path.join(cache, 'ming')],
      { HF_HUB_OFFLINE: '1' },
    ),
  );
  console.error('Loading Parakeet v2 model and locked Python environment (no transcription)…');
  checks.parakeet = resultJSON(
    await run('uv', ['run', '--locked', '--script', 'scripts/parakeet.py', '--setup']),
  );
  console.error('Loading Kokoro and Whisper models (no audio generation)…');
  checks.kai = resultJSON(
    await run(process.execPath, [
      '--input-type=module',
      '-e',
      `const {loadTTS,loadASR}=await import('./engines/explainroo/src/models.js');const tts=await loadTTS({log:console.error});const asr=await loadASR({log:console.error});console.log(JSON.stringify({kokoro:true,whisper:true}));if(asr.dispose)await asr.dispose();if(tts.model?.dispose)await tts.model.dispose();`,
    ]),
  );
}
const report = {
  checkedAt: new Date().toISOString(),
  modelLoadsRequested: process.argv.includes('--load-models'),
  checks,
};
await mkdir(path.join(root, '.cache/archon'), { recursive: true });
await writeFile(
  path.join(root, `.cache/archon/media-readiness-${report.modelLoadsRequested ? 'models' : 'basic'}.json`),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
