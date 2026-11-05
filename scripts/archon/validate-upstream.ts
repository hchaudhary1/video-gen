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
  for (const route of ['approve', 'revise', 'reject', 'cached', 'repair']) {
    const stubs: any = {};
    for (const n of w.nodes) {
      const artifacts = {
        done: true,
        ready: false,
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
      };
      stubs[n.id] = n.id.endsWith('-attention')
        ? {
            decision:
              n.id === 'thumbnail-attention' && ['approve', 'cached'].includes(route)
                ? 'v1'
                : route === 'cached'
                  ? 'approve'
                  : route,
            text: 'Fixture operator text',
          }
        : n.id === 'script-review'
          ? { pass: true, findings: '' }
          : { version: 1, status: 'complete', stage: 'fixture', artifacts };
    }
    if (route === 'repair') {
      if (stubs.build)
        stubs.build = { version: 1, status: 'repair', artifacts: { errors: ['Fixture scene defect'] } };
      if (stubs['script-report']) stubs['script-report'].artifacts.done = false;
      if (stubs['thumbnail-join']) stubs['thumbnail-join'].artifacts.done = false;
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
    if (route === 'repair' && w.name === 'rules-story-creative-review-round') {
      for (const id of ['freeze', 'visual-mechanism', 'continuity-legibility']) {
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
  console.log(`${w.name}: schema/planner valid without warnings; 5 stub routes passed`);
}
console.log(
  `${count} graph simulations passed. Stub simulations do not execute adapters, media, provider sessions or uploads.`,
);
