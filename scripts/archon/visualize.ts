// Development-only: interactive graph viewer for the Archon workflow YAML.
// The YAML is the source of truth; the viewer only reads it.
// Usage:
//   bun scripts/archon/visualize.ts                 write .cache/archon/visualizer.html
//   bun scripts/archon/visualize.ts --out file.html write elsewhere
//   bun scripts/archon/visualize.ts --serve [port]  serve live (re-reads the YAML on every reload)
import { glob } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '../..');
const TEMPLATE = path.join(import.meta.dir, 'visualizer.html');
const args = process.argv.slice(2);
const flag = (name: string) => args.indexOf(name);

const read = (file: string) => Bun.file(file).text().catch(() => null);

// Claude resolves `@path` lines in CLAUDE.md as imports; show the text the node actually gets.
async function expandImports(file: string, seen = new Set<string>()): Promise<{ text: string; files: string[] }> {
  if (seen.has(file)) return { text: '', files: [] };
  seen.add(file);
  const text = (await read(file)) ?? '';
  const files = [path.relative(ROOT, file)];
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^@(\S+)\s*$/);
    if (!m) { out.push(line); continue; }
    const inner = await expandImports(path.resolve(path.dirname(file), m[1]), seen);
    files.push(...inner.files);
    out.push(inner.text);
  }
  return { text: out.join('\n'), files };
}

// Ambient guidance every Claude node loads through settingSources ['project', 'user'].
async function guidance() {
  const layers = [];
  for (const [label, file] of [
    ['Project instructions (CLAUDE.md)', path.join(ROOT, 'CLAUDE.md')],
    ['User instructions (~/.claude/CLAUDE.md)', path.join(process.env.HOME ?? '', '.claude/CLAUDE.md')],
  ]) {
    if ((await read(file)) === null) continue;
    const { text, files } = await expandImports(file);
    layers.push({ label, files, text });
  }
  return layers;
}

// Declared skills: SKILL.md is injected; files beside it are read only on demand.
async function skills() {
  const out: Record<string, unknown> = {};
  const dir = path.join(ROOT, '.claude/skills');
  for await (const file of glob('*/SKILL.md', { cwd: dir })) {
    const name = path.dirname(file);
    const extras = [];
    for await (const extra of glob(`${name}/**/*`, { cwd: dir })) {
      if (extra.endsWith('SKILL.md')) continue;
      const stat = await Bun.file(path.join(dir, extra)).stat().catch(() => null);
      if (stat?.isFile()) extras.push({ path: path.relative(name, extra), bytes: stat.size });
    }
    out[name] = { file: path.join('.claude/skills', file), text: await read(path.join(dir, file)), extras };
  }
  return out;
}

async function collect() {
  const workflows: Record<string, unknown> = {};
  for await (const file of glob('.archon/workflows/**/*.yaml', { cwd: ROOT })) {
    const doc = Bun.YAML.parse(await Bun.file(path.join(ROOT, file)).text()) as any;
    if (!doc?.name || !Array.isArray(doc.nodes)) continue;
    // A packaged workflow's `command:` resolves only from its own commands/ folder.
    const commands: Record<string, string | null> = {};
    const scan = async (nodes: any[]) => {
      for (const n of nodes) {
        if (n.command) commands[n.command] = await read(path.join(ROOT, path.dirname(file), 'commands', `${n.command}.md`));
        if (n.loop_group) await scan(n.loop_group.nodes);
      }
    };
    await scan(doc.nodes);
    workflows[doc.name] = { ...doc, file, commands };
  }
  const config = Bun.YAML.parse((await read(path.join(ROOT, '.archon/config.yaml'))) ?? '{}');
  return { generatedAt: new Date().toISOString(), workflows, config, guidance: await guidance(), skills: await skills() };
}

async function render() {
  const data = JSON.stringify(await collect()).replace(/</g, '\\u003c');
  return (await Bun.file(TEMPLATE).text()).replace('/*__ARCHON_DATA__*/null', () => data);
}

if (flag('--serve') >= 0) {
  const port = Number(args[flag('--serve') + 1]) || 4377;
  Bun.serve({
    port,
    async fetch() {
      return new Response(await render(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  console.log(`Archon workflow visualizer: http://localhost:${port}`);
} else {
  const out = path.resolve(flag('--out') >= 0 ? args[flag('--out') + 1] : path.join(ROOT, '.cache/archon/visualizer.html'));
  await Bun.write(out, await render());
  console.log(`Wrote ${out}`);
}
