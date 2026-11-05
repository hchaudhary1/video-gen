#!/usr/bin/env node
// Install a pinned source CLI without global installs or changes to application dependencies.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache/archon'),
  source = path.join(cache, 'source');
const revision = '0d8de493fb016ca7a63529f3abc1ab08ac3e7a16',
  bunVersion = '1.4.2';
const exists = (f) =>
  access(f).then(
    () => true,
    () => false,
  );
const env = {
  ...process.env,
  BUN_INSTALL_CACHE_DIR: path.join(cache, 'bun-cache'),
  npm_config_cache: path.join(root, '.cache/npm'),
};
const run = (cmd, args, cwd = root, capture = false) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = '';
    if (capture) child.stdout.on('data', (c) => (output += c));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
await mkdir(cache, { recursive: true });
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('This bootstrap currently provisions the verified Linux x64 runtime.');
const bun = path.join(cache, 'bun/bin/bun');
if (!(await exists(bun))) {
  const response = await fetch(`https://registry.npmjs.org/@oven%2fbun-linux-x64/${bunVersion}`);
  if (!response.ok) throw new Error(`Bun registry metadata failed: ${response.status}`);
  const metadata = await response.json(),
    download = await fetch(metadata.dist.tarball);
  if (!download.ok) throw new Error(`Bun download failed: ${download.status}`);
  const bytes = Buffer.from(await download.arrayBuffer());
  if (metadata.dist.integrity !== `sha512-${createHash('sha512').update(bytes).digest('base64')}`)
    throw new Error('Bun archive integrity mismatch');
  const archive = path.join(cache, `bun-${bunVersion}.tgz`);
  await writeFile(archive, bytes);
  await mkdir(path.dirname(path.dirname(bun)), { recursive: true });
  await run('tar', ['-xzf', archive, '-C', path.dirname(path.dirname(bun)), '--strip-components=1']);
}
if ((await run(bun, ['--version'], root, true)) !== bunVersion)
  throw new Error('Unexpected local Bun version; retain the pinned runtime');
if (!(await exists(path.join(source, '.git')))) {
  await run('git', ['clone', 'https://github.com/coleam00/Archon.git', source]);
  await run('git', ['checkout', '--detach', revision], source);
}
if ((await run('git', ['rev-parse', 'HEAD'], source, true)) !== revision)
  throw new Error('Archon source differs from the pinned revision');
await run(bun, ['install', '--frozen-lockfile'], source);
await mkdir(path.join(cache, 'home'), { recursive: true });
if (!(await exists(path.join(cache, 'home/config.yaml'))))
  await writeFile(path.join(cache, 'home/config.yaml'), 'store: database\n');
if (process.argv.includes('--media')) {
  await run('npm', ['ci']);
  await run('npm', ['ci'], path.join(root, 'engines/explainroo'));
  const { chromePath } = await import('../lib/native.mjs');
  const chrome = await chromePath();
  env.CHROME_PATH = chrome;
  env.HYPERFRAMES_BROWSER_PATH = chrome;
  await writeFile(path.join(cache, 'environment.json'), JSON.stringify({ chrome }, null, 2) + '\n');
  if (
    !(
      await Promise.all(
        ['env/bin/python', 'model/config.json', 'source/ming_tts.py'].map((f) =>
          exists(path.join(root, '.cache/video-gen/ming', f)),
        ),
      )
    ).every(Boolean)
  )
    await run(process.execPath, ['scripts/setup-ming.mjs']);
  await run(process.execPath, ['scripts/media-readiness.mjs', '--load-models']);
}
await writeFile(
  path.join(cache, 'setup-receipt.json'),
  JSON.stringify(
    {
      sourceRevision: revision,
      bunVersion,
      archonVersion: JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).version,
      mediaRequested: process.argv.includes('--media'),
      completedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log('Archon is ready at ./bin/archon. Add this worktree/bin to PATH for bare archon commands.');
