// Development-only: regenerate the cc-wf-studio views in .vscode/workflows from the Archon YAML.
// The YAML is the source of truth; these JSON files are visualizations and never run.
// Usage: bun scripts/archon/export-cc-wf-studio.ts
import { glob, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const OUT = '.vscode/workflows';
const COL = 340; // horizontal step between node layers
const ROW = 168; // vertical step between nodes sharing a layer
const PAD = { x: 24, y: 52 };
const GAP = 70; // vertical gap between stage groups
const STAGES: [RegExp, string][] = [
  [/^(recover|research|identity)/, 'Research'],
  [/^script/, 'Script'],
  [/^(narration|prepare|timing|audio|sound)/, 'Narration & audio'],
  [/^(production|register-director|direction|series|register-scenes|delivery)/, 'Production'],
  [/^thumbnail/, 'Thumbnails'],
  [/^publish/, 'Publishing'],
  [/^(register-repair|result)$/, 'Build'],
  [/^(build|preview|freeze|visual-evidence)$/, 'Build & evidence'],
  [/^(visual-review|review-join)/, 'Independent visual review'],
  [/^(register-revision|revision|revised-preview)/, 'Revision'],
  [/^(creative-review|film)/, 'Creative review & film decision'],
  [/^(render|verify|production-result)/, 'Render & verify'],
];

type Node = any;
const stageOf = (id: string) => STAGES.find(([re]) => re.test(id))?.[1] ?? 'Steps';
const clip = (s: string, n = 400) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const condition = (when?: string) =>
  when
    ? ' · if ' +
      when
        .replace(/\$LOOP_PREV\.([\w-]+)\.output(\.artifacts)?/g, 'previous $1')
        .replace(/\$([\w-]+)\.output(\.artifacts)?/g, '$1')
        .replace(/'/g, '')
    : '';

function loopLabel(n: Node) {
  const loop = n.loop_group ?? n.loop;
  const until = String(loop.until_bash ?? loop.until ?? '').match(/ ([\w-]+-check) /)?.[1] ?? 'until_bash passes';
  return `loop ≤${loop.max_iterations} passes until ${until}`;
}

function card(n: Node, workflow: string) {
  const id = `n-${n.id}`;
  const base = { id, name: n.id };
  if (n.wait) {
    const options = Array.isArray(n.wait.options)
      ? n.wait.options.map((o: any, i: number) => ({ id: `opt-${i}`, label: o.label, description: o.id }))
      : [{ id: 'opt-0', label: 'decision', description: `Options resolved at run time from ${n.wait.options}` }];
    return {
      ...base,
      type: 'askUserQuestion',
      data: {
        questionText: clip(`${n.id} · operator decision${condition(n.when)}: ${n.wait.attention}`, 200),
        options,
        outputPorts: options.length,
      },
    };
  }
  if (n.prompt || n.loop) {
    const prompt = n.prompt ?? n.loop.prompt;
    const loop = n.loop ? ` · ${loopLabel(n)}` : '';
    return {
      ...base,
      type: 'subAgent',
      data: {
        description: `${n.id}${loop}${condition(n.when)}`,
        agentDefinition: `Archon node \`${n.id}\` in ${workflow}. Completes only its assigned work.`,
        prompt: clip(prompt),
        agentType: 'other',
        outputPorts: 1,
      },
    };
  }
  const kind = n.cancel ? ' · stop run' : n.workflow ? ` ▸ ${n.workflow}` : '';
  return {
    ...base,
    type: 'prompt',
    data: {
      label: `${n.id}${kind}${condition(n.when)}`,
      prompt: clip(n.cancel ?? n.bash ?? n.script ?? `Run Archon sub-workflow \`${n.workflow}\``),
    },
  };
}

// Longest-path layer of each node among its siblings.
function layers(nodes: Node[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const layer = new Map<string, number>();
  const visit = (n: Node): number => {
    if (layer.has(n.id)) return layer.get(n.id)!;
    const deps = (n.depends_on ?? []).filter((d: string) => ids.has(d));
    const l = deps.length ? 1 + Math.max(...deps.map((d: string) => visit(nodes.find((x) => x.id === d)))) : 0;
    layer.set(n.id, l);
    return l;
  };
  nodes.forEach(visit);
  return layer;
}

function convert(w: Node) {
  // Stage groups: each loop_group is its own group; other nodes merge by stage label.
  const groups: { label: string; nodes: Node[]; loop?: Node }[] = [];
  for (const n of w.nodes) {
    if (n.loop_group) {
      groups.push({ label: `${n.id} · ${loopLabel(n)}${condition(n.when)}`, nodes: n.loop_group.nodes, loop: n });
      continue;
    }
    const label = stageOf(n.id);
    const last = groups.at(-1);
    if (last && !last.loop && last.label === label) last.nodes.push(n);
    else groups.push({ label, nodes: [n] });
  }
  // A loop_group stands for its body: edges enter its sources and leave its sinks.
  const entry = new Map<string, string[]>();
  const exit = new Map<string, string[]>();
  for (const n of w.nodes) {
    if (!n.loop_group) continue;
    const body = n.loop_group.nodes;
    const used = new Set(body.flatMap((b: Node) => b.depends_on ?? []));
    entry.set(n.id, body.filter((b: Node) => !(b.depends_on ?? []).length).map((b: Node) => b.id));
    exit.set(n.id, body.filter((b: Node) => !used.has(b.id)).map((b: Node) => b.id));
  }
  const nodes: Node[] = [];
  const connections: Node[] = [];
  const connect = (from: string, to: string) => {
    const id = `c-${from}-${to}`;
    if (!connections.some((c) => c.id === id))
      connections.push({ id, from, to, fromPort: 'output', toPort: 'input' });
  };
  let y = 0;
  groups.forEach((g, i) => {
    const layer = layers(g.nodes);
    const rows = new Map<number, number>();
    const placed = g.nodes.map((n) => {
      const l = layer.get(n.id)!;
      const r = rows.get(l) ?? 0;
      rows.set(l, r + 1);
      return { n, x: PAD.x + l * COL, y: PAD.y + r * ROW };
    });
    const width = PAD.x * 2 + (Math.max(...layer.values()) + 1) * COL - 40;
    const height = PAD.y + Math.max(...rows.values()) * ROW + 20;
    const gid = `group-${i + 1}`;
    const label = `${i + 1} · ${g.label}`;
    nodes.push({ id: gid, type: 'group', name: label, position: { x: 190, y }, style: { width, height }, data: { label } });
    for (const p of placed)
      nodes.push({ ...card(p.n, w.name), parentId: gid, position: { x: p.x, y: p.y } });
    y += height + GAP;
  });
  const top = new Set(w.nodes.map((n: Node) => n.id));
  const all = [...w.nodes, ...w.nodes.flatMap((n: Node) => n.loop_group?.nodes ?? [])];
  for (const n of all) {
    if (n.loop_group) continue;
    for (const d of n.depends_on ?? []) {
      for (const from of exit.get(d) ?? [d]) connect(`n-${from}`, `n-${n.id}`);
    }
  }
  for (const n of w.nodes) {
    if (!n.loop_group) continue;
    for (const d of n.depends_on ?? [])
      for (const from of exit.get(d) ?? [d])
        for (const to of entry.get(n.id)!) connect(`n-${from}`, `n-${to}`);
  }
  const sources = w.nodes.filter((n: Node) => !(n.depends_on ?? []).length).flatMap((n: Node) => entry.get(n.id) ?? [n.id]);
  const depended = new Set(w.nodes.flatMap((n: Node) => n.depends_on ?? []));
  const sinks = w.nodes.filter((n: Node) => top.has(n.id) && !depended.has(n.id)).flatMap((n: Node) => exit.get(n.id) ?? [n.id]);
  nodes.unshift({ id: 'start', type: 'start', name: 'start', position: { x: 0, y: 92 }, data: { label: 'start' } });
  nodes.push({ id: 'end_1', type: 'end', name: 'end', position: { x: 190, y }, data: { label: 'end' } });
  for (const s of sources) connect('start', `n-${s}`);
  for (const s of sinks) connect(`n-${s}`, 'end_1');
  return {
    id: w.name,
    name: w.name,
    description: w.description,
    version: '1.0.0',
    nodes,
    connections,
    createdAt: '2026-11-06T00:00:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
  };
}

const written = new Set<string>();
for await (const file of glob('.archon/workflows/video/**/*.yaml')) {
  const w = Bun.YAML.parse(await Bun.file(file).text()) as Node;
  // A `command:` node's prompt is its commands/<name>.md file in the workflow folder.
  const inline = async (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.command) n.prompt = await Bun.file(path.join(path.dirname(file), 'commands', `${n.command}.md`)).text();
      if (n.loop_group) await inline(n.loop_group.nodes);
    }
  };
  await inline(w.nodes);
  await Bun.write(path.join(OUT, `${w.name}.json`), JSON.stringify(convert(w), null, 2) + '\n');
  written.add(`${w.name}.json`);
}
// Remove views of workflows that no longer exist.
for (const f of await readdir(OUT)) if (f.endsWith('.json') && !written.has(f)) await rm(path.join(OUT, f));
console.log(`Wrote ${written.size} cc-wf-studio views to ${OUT}`);
