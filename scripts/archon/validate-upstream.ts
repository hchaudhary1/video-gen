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
let count = 0;
for await (const file of glob('.archon/workflows/video/**/*.yaml')) {
  const parsed = parseWorkflow(await Bun.file(file).text(), file, {
    get: () => ({}),
    has: () => true,
    list: () => [],
  } as any);
  if (parsed.error || parsed.warnings?.length)
    throw new Error(JSON.stringify({ file, error: parsed.error, warnings: parsed.warnings }));
  const w = { ...parsed.workflow, plan: planGraph(parsed.workflow!.nodes) } as any;
  for (const route of ['approve', 'revise', 'reject', 'cached', 'repair', 'missing-review', 'bad-script', 'exhausted-build', 'missing-research']) {
    const stubs: any = {};
    for (const n of w.nodes) {
      const artifacts = {
        done: true,
        ready: false,
        valid: true,
        needsWrite: true,
        binding: 'fixture-hash',
        needsAnswer: !['cached', 'repair'].includes(route),
        required: true,
        approved: route === 'cached',
        rejected: route === 'reject',
        options: [
          { id: 'v1', label: 'v1' },
          { id: 'revise', label: 'Revise' },
          { id: 'reject', label: 'Stop' },
        ],
        artifact: 'fixture-only',
        view: 'fixture-preview.mp4',
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
    if (w.name.endsWith('-script-cycle-round')) {
      stubs['script-reviewed-state'].artifacts.ready = route !== 'repair';
      if (route === 'cached') {
        stubs['script-binding'].artifacts.ready = true;
        stubs['script-state'].artifacts.needsWrite = false;
      }
    }
    if (route === 'repair') {
      if (stubs.build)
        stubs.build = { version: 1, status: 'repair', artifacts: { errors: ['Fixture scene defect'] } };
      if (stubs['script-report']) stubs['script-report'].artifacts.done = false;
      if (stubs['thumbnail-join']) stubs['thumbnail-join'].artifacts.done = false;
    }
    if (w.name.endsWith('-creative-review-round')) {
      stubs['visual-review-state'].artifacts.done = route === 'cached';
      if (route === 'missing-review') {
        stubs['visual-review-state-1'].artifacts.done = false;
        stubs['visual-review-state-2'].artifacts.done = false;
      }
    }
    if (w.name.endsWith('-build-cycle') && route === 'repair') {
      stubs['build-1'].status = 'repair';
    }
    if (w.name.endsWith('-build-cycle') && route === 'exhausted-build') {
      for (const id of ['build-1', 'build-2', 'build-3', 'build-4']) stubs[id].status = 'repair';
    }
    if (w.name.endsWith('-script-cycle-round') && route === 'bad-script') {
      stubs['script-binding'].artifacts.valid = false;
      stubs['script-reviewed-state'].artifacts.ready = false;
    }
    if (stubs['production-state']) stubs['production-state'].artifacts.done = route === 'cached';
    if (stubs['research-state'] && route === 'missing-research') {
      stubs['research-state'].artifacts.done = false;
      stubs['research-state-1'].artifacts.done = false;
    }
    const result = await dryRunWorkflow({
      workflow: w,
      cwd: process.cwd(),
      userMessage: 'FIXTURE ONLY: never execute media or uploads',
      inputs: { project: 'fixture', options: '{}' },
      defaultStubs: true,
      stubs,
    });
    // Every round's rejection node must actually cancel. Main graph has no waits.
    const hasWait = w.nodes.some((n: any) => n.id.endsWith('-attention'));
    const expected = route === 'reject' && hasWait ? 'cancelled' : 'completed';
    if (result.outcome !== expected) {
      await Bun.write('.cache/archon-validation/failure.json', JSON.stringify(result, null, 2));
      throw new Error(
        `${file}: ${route} expected ${expected}, got ${result.outcome}; inspect .cache/archon-validation/failure.json`,
      );
    }
    if (route === 'cached' && w.name.endsWith('-script-cycle-round')) {
      for (const id of ['write', 'script-review', 'script-report']) {
        if (result.trace.find((t: any) => t.nodeId === id)?.state !== 'skipped')
          throw new Error(`Unchanged reviewed script unexpectedly re-executed ${id}`);
      }
    }
    if (route === 'approve' && w.name.endsWith('-creative-review-round')) {
      for (const id of ['visual-review', 'revision']) {
        if (result.trace.filter((t: any) => t.nodeId === id && ['stubbed', 'executed'].includes(t.state)).length !== 1)
          throw new Error(`Expected exactly one ${id}`);
      }
    }
    if (w.name.endsWith('-build-cycle')) {
      const repaired = result.trace.filter((t: any) => t.nodeId.startsWith('repair-') &&
        ['stubbed', 'executed'].includes(t.state)).map((t: any) => t.nodeId);
      const expected = route === 'repair' ? ['repair-1'] : route === 'exhausted-build'
        ? ['repair-1', 'repair-2', 'repair-3'] : [];
      if (JSON.stringify(repaired) !== JSON.stringify(expected))
        throw new Error(`Unexpected technical repairs: ${repaired}`);
    }
    if (w.name.endsWith('-creative-review-round') && ['cached', 'missing-review'].includes(route)) {
      const reviewers = result.trace.filter((t: any) =>
        ['visual-review', 'visual-review-completion-2', 'visual-review-completion-3'].includes(t.nodeId) &&
        ['stubbed', 'executed'].includes(t.state));
      if (reviewers.length !== (route === 'cached' ? 0 : 3))
        throw new Error('A complete inspection must be reused; only incomplete attempts may retry.');
    }
    if (w.name.endsWith('-script-cycle-round') && route === 'bad-script') {
      for (const id of ['script-review', 'script-report', 'script-attention'])
        if (result.trace.find((t: any) => t.nodeId === id)?.state !== 'skipped')
          throw new Error(`Invalid script unexpectedly reached ${id}`);
    }
    if (stubs['production-state'] && route === 'cached') {
      for (const id of ['register-director', 'direction', 'production', 'series', 'register-scenes']) {
        const entry = result.trace.find((t: any) => t.nodeId === id);
        if (entry && entry.state !== 'skipped') throw new Error(`Verified film unexpectedly reran ${id}`);
      }
      if (result.trace.find((t: any) => t.nodeId === 'delivery')?.state !== 'stubbed')
        throw new Error('Cached production must still revalidate delivery.');
    }
    if (stubs['research-state'] && route === 'missing-research') {
      const executed = result.trace.filter((t: any) =>
        ['research', 'research-completion-1', 'research-completion-2'].includes(t.nodeId) && t.state === 'stubbed');
      if (executed.length !== 2) throw new Error('Missing research must reach scheduled completion and then stop retrying.');
    }
    if (route === 'repair' && w.name.endsWith('-creative-review-round')) {
      for (const id of [
        'freeze',
        'visual-review',
        'revision',
        ...(w.name.startsWith('kai-') ? ['preview'] : []),
      ]) {
        if (result.trace.find((t: any) => t.nodeId === id)?.state !== 'skipped')
          throw new Error(`Failed build reached ${id}`);
      }
    }
    if (
      route === 'cached' &&
      hasWait &&
      result.trace.some((t: any) => t.nodeId.endsWith('-attention') && t.state !== 'skipped')
    )
      throw new Error('Cached approval unexpectedly asked again');
    await Bun.write(`.cache/archon-validation/${w.name}-${route}.json`, JSON.stringify(result, null, 2));
    count++;
  }
  console.log(`${w.name}: schema/planner valid without warnings; 9 stub routes passed`);
}
console.log(
  `${count} graph simulations passed. Stub simulations do not execute adapters, media, provider sessions or uploads.`,
);
