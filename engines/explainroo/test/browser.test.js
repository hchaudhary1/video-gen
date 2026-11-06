import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { findChrome } from '../src/browser.js';

test('finds the headless shell that Playwright installs on Windows', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-pw-'));
  const exe = path.join(base, 'chromium_headless_shell-1300', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.writeFileSync(exe, '');
  const saved = { pw: process.env.PLAYWRIGHT_BROWSERS_PATH, ex: process.env.EXPLAINROO_CHROME, cp: process.env.CHROME_PATH };
  try {
    process.env.PLAYWRIGHT_BROWSERS_PATH = base;
    delete process.env.EXPLAINROO_CHROME;
    delete process.env.CHROME_PATH;
    assert.equal(findChrome(), exe);
  } finally {
    for (const [k, v] of [['PLAYWRIGHT_BROWSERS_PATH', saved.pw], ['EXPLAINROO_CHROME', saved.ex], ['CHROME_PATH', saved.cp]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('a browser cache directory in CHROME_PATH falls back to the HyperFrames binary inside it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-home-'));
  const pw = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-pw-empty-'));
  const dir = path.join(home, '.cache', 'hyperframes', 'chrome', 'chrome-headless-shell');
  const older = path.join(dir, 'linux-9.0.0.1', 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  const newer = path.join(dir, 'linux-152.0.7977.30', 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  for (const exe of [older, newer]) {
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.writeFileSync(exe, '');
  }
  const saved = { home: process.env.HOME, pw: process.env.PLAYWRIGHT_BROWSERS_PATH, ex: process.env.EXPLAINROO_CHROME, cp: process.env.CHROME_PATH };
  const warn = console.warn;
  try {
    console.warn = () => {};
    process.env.HOME = home;
    process.env.PLAYWRIGHT_BROWSERS_PATH = pw;
    delete process.env.EXPLAINROO_CHROME;
    process.env.CHROME_PATH = dir; // the directory a setup step once recorded instead of the binary
    const found = findChrome();
    // A system Chrome may legitimately win on some machines; it must never be the directory.
    assert.notEqual(found, dir);
    assert.ok(fs.statSync(found).isFile());
    if (found.startsWith(home)) assert.equal(found, newer);
  } finally {
    console.warn = warn;
    for (const [k, v] of [['HOME', saved.home], ['PLAYWRIGHT_BROWSERS_PATH', saved.pw], ['EXPLAINROO_CHROME', saved.ex], ['CHROME_PATH', saved.cp]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(pw, { recursive: true, force: true });
  }
});

let chrome;
try { chrome = findChrome(); } catch {}

test('a page load that hangs is tried once more with a fresh page', { skip: !chrome }, async () => {
  const { launch, openEngine } = await import('../src/browser.js');
  let requests = 0;
  const hung = [];
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith('/frame.html')) return res.writeHead(404).end();
    // The first load never answers, like a stalled page on a busy machine.
    if (++requests === 1) return hung.push(res);
    res.writeHead(200, { 'content-type': 'text/html' }).end('<script>window.explainrooReady = Promise.resolve();</script>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await launch();
  try {
    // Long enough for the second page to load on a busy CI machine.
    const page = await openEngine(browser, `http://127.0.0.1:${server.address().port}`, { timeout: 5000 });
    assert.equal(requests, 2);
    assert.equal(browser.contexts().flatMap((c) => c.pages()).length, 1);
    assert.equal(await page.evaluate(() => typeof window.explainrooReady), 'object');
    requests = 0;
    server.removeAllListeners('request');
    server.on('request', (req, res) => hung.push(res));
    await assert.rejects(openEngine(browser, `http://127.0.0.1:${server.address().port}`, { timeout: 500 }), { name: 'TimeoutError' });
  } finally {
    await browser.close();
    for (const res of hung) res.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a page that loads without its scripts is tried once more', { skip: !chrome }, async () => {
  const { launch, openEngine } = await import('../src/browser.js');
  let pages = 0;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/missing.js')) return res.writeHead(404).end();
    if (!req.url.startsWith('/frame.html')) return res.writeHead(404).end();
    // The first page's module script cannot load, so the engine never starts.
    const script = ++pages === 1 ? "import '/missing.js'; window.explainrooReady = Promise.resolve();" : 'window.explainrooReady = Promise.resolve();';
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<script type="module">${script}</script>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await launch();
  try {
    const page = await openEngine(browser, `http://127.0.0.1:${server.address().port}`, { timeout: 5000 });
    assert.equal(pages, 2);
    assert.equal(browser.contexts().flatMap((c) => c.pages()).length, 1);
    assert.equal(await page.evaluate(() => typeof window.explainrooReady), 'object');
    // When it never starts, the error says so.
    pages = 0;
    server.removeAllListeners('request');
    server.on('request', (req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<p>no engine</p>'));
    await assert.rejects(openEngine(browser, `http://127.0.0.1:${server.address().port}`, { timeout: 5000 }), /scripts did not/);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
