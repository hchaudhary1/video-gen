// Development-only validator: uses the actual pinned upstream parser and dry-run engine.
import { glob } from 'node:fs/promises';
const upstream = process.env.ARCHON_SOURCE;
if (!upstream)
  throw new Error(
    'Set ARCHON_SOURCE to the pinned upstream checkout with its validation dependencies installed',
  );
const { parseWorkflow } = await import(`${upstream}/packages/workflows/src/loader.ts`);
const { planGraph } = await import(`${upstream}/packages/workflows/src/graph-plan.ts`);
const { dryRunWorkflow } = await import(`${upstream}/packages/workflows/src/dry-run.ts`);
const { qualifyWorkflowResources } = await import(`${upstream}/packages/workflows/src/packaged-workflow.ts`);
let count = 0;
// Loop bodies are stubbed by their own node ids, so collect them at every depth.
const allNodes = (nodes: any[]): any[] =>
  nodes.flatMap((n: any) => [n, ...(n.loop_group ? allNodes(n.loop_group.nodes) : [])]);
// Archon's dry run assumes an `until_bash` loop completes after its first pass, so these
// routes check one pass. Later passes (repairs, retries, answers recorded by the next pass)
// are exercised against the real engine, not here.
for await (const file of glob('.archon/workflows/video/**/*.yaml')) {
  const parsed = parseWorkflow(await Bun.file(file).text(), file, {
    get: () => ({}),
    has: () => true,
    list: () => [],
  } as any);
  if (parsed.error || parsed.warnings?.length)
    throw new Error(JSON.stringify({ file, error: parsed.error, warnings: parsed.warnings }));
  // Discovery qualifies `command:` names to the workflow's own commands/ folder; do the same.
  const [, pack, folder] = file.match(/\.archon\/workflows\/([^/]+)\/([^/]+)\//)!;
  qualifyWorkflowResources(parsed.workflow, { source: 'project', pack, workflow: folder });
  const w = { ...parsed.workflow, plan: planGraph(parsed.workflow!.nodes) } as any;
  const nodes = allNodes(w.nodes);
  const has = (id: string) => nodes.some((n: any) => n.id === id);
  // rules-story deterministic nodes with a `<id>-fix` / `<id>-final` round (adapter ROUTED_STAGES).
  const ROUTED = ['identity', 'prepare', 'timing', 'sound'];
  for (const route of ['approve', 'revise', 'reject', 'cached', 'repair', 'missing-review', 'bad-script', 'missing-research']) {
    const stubs: any = {};
    for (const n of nodes) {
      if (n.loop_group) continue;
      const artifacts = {
        done: true,
        ready: false,
        valid: true,
        needsWrite: true,
        binding: 'fixture-hash',
        needsAnswer: !['cached', 'repair'].includes(route),
        required: true,
        approved: route === 'cached',
        // A reject is recorded by the pass after the question; stub that recording.
        rejected: route === 'reject',
        recorded: route === 'reject',
        options: [
          { id: 'v1', label: 'v1' },
          { id: 'revise', label: 'Revise' },
          { id: 'reject', label: 'Stop' },
        ],
        artifact: 'fixture-only',
        view: 'fixture-preview.mp4',
        // The adapters always emit these route keys; a `when:` reference fails on a missing key.
        fixable: false,
        needsScriptFix: false,
        needsReview: !['cached', 'bad-script'].includes(route),
        needsFix: false,
        needsContinuation: false,
        needsGenerate: route !== 'cached',
        selectable: true,
        // Values the author commands inject from script-status and research-status.
        supplied: false,
        canRevise: true,
        feedback: null,
        errors: [],
      };
      stubs[n.id] = n.id.endsWith('-attention')
        ? {
            decision:
              n.id === 'thumbnail-attention' && !['revise', 'reject'].includes(route)
                ? 'v1'
                : ['revise', 'reject'].includes(route) ? route : 'approve',
            text: 'Fixture operator text',
          }
        : n.id === 'audio-review'
          ? { pass: true, findings: 'Synthetic audio fixture', limitations: ['No listening in simulation'] }
        : n.id === 'script-review'
          ? { pass: true, findings: '' }
          : { version: 1, status: 'complete', stage: 'fixture', artifacts };
    }
    if (has('script-reviewed-state')) {
      stubs['script-reviewed-state'].artifacts.ready = route !== 'repair';
      if (route === 'cached') {
        stubs['script-binding'].artifacts.ready = true;
        stubs['script-state'].artifacts.needsWrite = false;
      }
      if (route === 'bad-script') {
        stubs['script-binding'].artifacts.valid = false;
        stubs['script-reviewed-state'].artifacts.ready = false;
      }
    }
    for (const id of ['thumbnail-state', 'publishing-state'])
      if (stubs[id]) stubs[id].artifacts.done = route === 'cached';
    if (route === 'repair') {
      if (w.name.endsWith('-creative-review-round'))
        stubs.build = { version: 1, status: 'repair', artifacts: { errors: ['Fixture scene defect'] } };
      if (stubs['script-report']) stubs['script-report'].artifacts.done = false;
      if (stubs['thumbnail-join']) stubs['thumbnail-join'].artifacts.done = false;
      // Routed deterministic stages report a repair; their one fix and final attempt follow.
      for (const id of ROUTED)
        if (stubs[id]) stubs[id] = { version: 1, status: 'repair', stage: id, artifacts: { ...stubs[id].artifacts, error: 'Fixture stage error' } };
    }
    if (stubs['visual-review-state'])
      stubs['visual-review-state'].artifacts.done = route === 'cached';
    if (stubs['production-state']) stubs['production-state'].artifacts.done = route === 'cached';
    if (stubs['research-state']) stubs['research-state'].artifacts.done = route !== 'missing-research';
    const result = await dryRunWorkflow({
      workflow: w,
      cwd: process.cwd(),
      userMessage: 'FIXTURE ONLY: never execute media or uploads',
      inputs: { project: 'fixture', options: '{}' },
      defaultStubs: true,
      stubs,
    });
    const ran = (id: string) =>
      result.trace.filter((t: any) => t.nodeId === id && ['stubbed', 'executed'].includes(t.state)).length;
    const fail = async (message: string) => {
      await Bun.write('.cache/archon-validation/failure.json', JSON.stringify(result, null, 2));
      throw new Error(`${file}: ${route}: ${message}; inspect .cache/archon-validation/failure.json`);
    };
    // Every recorded rejection must actually cancel.
    const hasWait = nodes.some((n: any) => n.id.endsWith('-attention'));
    const expected = route === 'reject' && hasWait ? 'cancelled' : 'completed';
    if (result.outcome !== expected) await fail(`expected ${expected}, got ${result.outcome}`);
    for (const id of ROUTED.filter(has)) {
      const runs = route === 'repair' ? 1 : 0;
      for (const branch of [`${id}-fix`, `${id}-final`])
        if (ran(branch) !== runs) await fail(`expected ${runs} ${branch} after a ${route === 'repair' ? 'repair' : 'complete'} ${id}`);
    }
    if (route === 'repair' && has('production-state') && ran('production-state') !== 1)
      await fail('routed fix rounds must continue to production');
    if (route !== 'reject') {
      for (const n of nodes.filter((n: any) => n.id.endsWith('-stop')))
        if (ran(n.id)) await fail(`${n.id} cancelled without a recorded rejection`);
    }
    if (route === 'cached' && has('script-reviewed-state')) {
      for (const id of ['write', 'script-review', 'script-report'])
        if (ran(id)) await fail(`unchanged reviewed script re-executed ${id}`);
    }
    if (route === 'cached') {
      for (const id of ['thumbnail-generate', 'thumbnail-review', 'publishing-copy'])
        if (ran(id)) await fail(`completed cycle re-executed ${id}`);
    }
    if (['approve', 'revise'].includes(route)) {
      for (const id of ['thumbnail-generate', 'thumbnail-review', 'publishing-copy'])
        if (has(id) && ran(id) !== 1) await fail(`expected one ${id} in the first pass`);
    }
    if (route === 'approve' && w.name.endsWith('-creative-review-round')) {
      for (const id of ['visual-review', 'revision'])
        if (ran(id) !== 1) await fail(`expected exactly one ${id}`);
    }
    if (w.name.endsWith('-build-cycle')) {
      // The first pass has no previous build to repair.
      if (ran('repair')) await fail('repair ran before any build');
      if (ran('build') !== 1) await fail('expected one build in the first pass');
    }
    if (w.name.endsWith('-creative-review-round') && ['cached', 'missing-review'].includes(route)) {
      if (ran('visual-review') !== (route === 'cached' ? 0 : 1))
        await fail('a complete inspection must be reused; only incomplete attempts may retry');
    }
    if (has('script-reviewed-state') && route === 'bad-script') {
      for (const id of ['script-review', 'script-report', 'script-attention'])
        if (ran(id)) await fail(`invalid script unexpectedly reached ${id}`);
    }
    if (stubs['production-state'] && route === 'cached') {
      for (const id of ['register-director', 'direction', 'production', 'series', 'register-scenes', 'scenes'])
        if (ran(id)) await fail(`verified film unexpectedly reran ${id}`);
      if (ran('delivery') !== 1) await fail('cached production must still revalidate delivery');
    }
    if (stubs['research-state']) {
      const researched = ran('research');
      if (researched !== (route === 'missing-research' ? 1 : 0))
        await fail('research must run only while the research check fails');
    }
    if (route === 'repair' && w.name.endsWith('-creative-review-round')) {
      for (const id of [
        'freeze',
        'visual-review',
        'revision',
        ...(w.name.startsWith('kai-') ? ['preview'] : []),
      ])
        if (ran(id)) await fail(`failed build reached ${id}`);
    }
    if (route === 'cached' && hasWait && result.trace.some((t: any) => t.nodeId.endsWith('-attention') && t.state !== 'skipped'))
      await fail('cached approval unexpectedly asked again');
    await Bun.write(`.cache/archon-validation/${w.name}-${route}.json`, JSON.stringify(result, null, 2));
    count++;
  }
  console.log(`${w.name}: schema/planner valid without warnings; 8 stub routes passed`);
}
console.log(
  `${count} graph simulations passed. Stub simulations do not execute adapters, media, provider sessions or uploads.`,
);
