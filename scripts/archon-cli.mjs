#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache/archon');
const bun = path.join(cache, 'bun/bin/bun');
const cli = path.join(cache, 'source/packages/cli/src/cli.ts');
if (!existsSync(bun) || !existsSync(cli))
  throw new Error('Run node scripts/setup-archon.mjs in this worktree first.');
const env = {
  ...process.env,
  ARCHON_HOME: path.join(cache, 'home'),
  ARCHON_TELEMETRY_DISABLED: '1',
  BUN_INSTALL_CACHE_DIR: path.join(cache, 'bun-cache'),
  PATH: [path.dirname(bun), path.join(root, 'bin'), process.env.PATH].join(path.delimiter),
};
// Every run (detached and resumed included) gets one verified browser binary for all engines.
// The saved setup value is used only when it is a regular file; otherwise resolve the installed binary.
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
let chrome = [env.EXPLAINROO_CHROME, env.CHROME_PATH].find((p) => p && isFile(p));
if (!chrome && existsSync(path.join(cache, 'environment.json'))) {
  const local = JSON.parse(readFileSync(path.join(cache, 'environment.json'), 'utf8'));
  if (local.chrome && isFile(local.chrome)) chrome = local.chrome;
}
if (!chrome) {
  const { chromePath } = await import('../lib/native.mjs');
  chrome = await chromePath().catch(() => undefined);
}
if (chrome) {
  for (const key of ['CHROME_PATH', 'EXPLAINROO_CHROME', 'HYPERFRAMES_BROWSER_PATH'])
    if (!env[key] || !isFile(env[key])) env[key] = chrome;
}
if (!env.CODEX_BIN_PATH) {
  const located = spawnSync('sh', ['-c', 'command -v codex'], { encoding: 'utf8' });
  if (located.status === 0) env.CODEX_BIN_PATH = located.stdout.trim();
}
const child = spawn(bun, [cli, ...process.argv.slice(2)], { cwd: process.cwd(), env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
