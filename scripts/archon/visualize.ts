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

async function collect() {
  const workflows: Record<string, unknown> = {};
  for await (const file of glob('.archon/workflows/**/*.yaml', { cwd: ROOT })) {
    const doc = Bun.YAML.parse(await Bun.file(path.join(ROOT, file)).text()) as any;
    if (!doc?.name || !Array.isArray(doc.nodes)) continue;
    workflows[doc.name] = { ...doc, file };
  }
  return { generatedAt: new Date().toISOString(), workflows };
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
