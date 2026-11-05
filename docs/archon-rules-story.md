# Rules-story with Archon

Archon owns rules-story production: stage dependencies, independent agent sessions,
bounded repair rounds, human attention, and recovery. Media nodes import the existing
libraries directly; Archon is the only stage controller.
Kai uses its own Archon workflow; see `docs/archon-kai-explainer.md`.

## Run

Install/configure Archon with your chosen agent provider and provision this checkout
with the repository's existing setup requirements (`npm ci`, FFmpeg, HyperFrames browser,
Ming and Parakeet). Archon is external tooling; it is not a production npm dependency.
This pack targets the workflow language at upstream revision
`0d8de493fb016ca7a63529f3abc1ab08ac3e7a16` (0.13.2).

From a **dedicated retained production checkout**:

```sh
archon validate workflows rules-story
archon workflow run rules-story \
  --input project=night-office-001 \
  --input 'options={"brief-file":"briefs/night-office.md","format":"landscape","duration":420,"review":"script,final,thumbnail","thumbnails":3}'
```

`options` uses the existing project metadata fields: `brief` / `brief-file`, `script`,
`audio`, `format`, `duration`, `thumbnails`, `review`, `review-depth`, plus `optOut`.
A supplied recording requires its corresponding script. Do not place credentials in
these inputs. The project slug is required; there is no implicit latest project.
Existing projects recover their saved treatment, inputs, canvas and decisions; creation
options do not silently overwrite them.

The actual YAML pack is under `.archon/workflows/video/`. `rules-story.yaml` owns
initialization, identity, script rounds, narration, preparation, timing, sound, direction,
series-kit installation, production rounds, delivery, thumbnail rounds and publication.
The other YAML files expose each round's individual author, reviewer, evidence, command
and attention nodes as governed child runs. No stage controller is hidden in a prompt.

## Decisions and revisions

Use the Archon console/CLI attention queue. Each checkpoint displays the artifact path
and its binding hash. Select approve, revise, or stop, and provide your actual message
as the answer text. Thumbnail attention offers the current passing variants plus revise
and stop. Publishing offers approve, revise, keep local, or stop. A requested revision
returns to the appropriate author and independent reviewer before another checkpoint.

`review` controls optional script, final-film and thumbnail checkpoints. Independent
reviews and technical checks remain mandatory. Publishing copy always requires approval
unless `optOut: true` keeps the production local. `publishing.json` contains `title`,
`description`, optional `tags`, `privacy: "unlisted"` and the exact abdupdates `channelId`.
The operator must supply/confirm the actual channel ID; agents must not invent it.

Attention is the operator boundary under the repository's existing trust model. Archon
also exposes an agent-accessible answer API: agents must never answer for a person.
Receipts retain the actual answer text and exact artifact binding. They are audit records,
not cryptographic proof of human identity. There is no separate fabricated operator file.
Changing the script/visual intent, frozen film pack, thumbnail set, or publishing inputs
invalidates its corresponding approval. An edit while attention is pending fails closed;
resume/re-run against the current artifact rather than relabeling a stale answer.

## Repair and resume

```sh
archon workflow get <run-id>
archon workflow logs <run-id>
archon workflow resume <run-id>
```

Archon nodes recheck on-disk receipts on resume. Narration binds the spoken script and
recording hash; timing binds script, PCM audio, ASR settings and output hashes; sound
binds the identity and every generated sound file; rendering binds source and video
hashes. Current expensive outputs are reused. Supplied scripts cannot be rewritten
without a recorded requested revision. Supplied recordings and approved narration are
never silently replaced; a requested change after preparation needs an explicitly
archived take/new project, not reuse of old timing.

Build failures route to scene repair and cannot reach evidence freezing or reviewers.
The two fresh film reviewers both finish before findings are joined. Current full-build,
frozen-evidence and independent-review checks gate rendering. Depth policy controls
qualified creative-review exhaustion; delivery keeps unresolved findings and never labels
that disposition an independent pass. Missing inspection and non-waivable defects block.
Encoded pixel defects route back through scene repair/review. Narration/audio integrity,
missing infrastructure and invalid evidence fail the run for explicit recovery.

Rounds are explicitly bounded in YAML (four script/film/thumbnail/user-revision opportunities). After exhaustion the run fails with retained evidence; a
fresh run can continue from validated artifacts. Archon currently restricts attention
waits and governed child runs inside `loop_group`, so these cycles use explicit conditional
round nodes rather than invalid nested loops. This makes each attempt inspectable.

`worktree.enabled: false` keeps ignored recordings, jobs, dependencies and models in the
provisioned checkout. Do not run unrelated mutable productions concurrently in it. Archon
serializes checkout writers; inherited child runs share the parent's retained workspace.
Keep caches and generated artifacts inside the repository. Never clean this workspace
while any run is paused, failed/resumable, or producing media.

## Publication recovery

The direct uploader uses an exclusive journal at
`jobs/scripts/<slug>/archon/upload-session.json`. It saves the resumable session, probes
accepted ranges after interruption, and persists the remote ID before setting a thumbnail.
Changed video/copy/thumbnail bindings are rejected. An uncertain initiation or expired
unreconciled session fails closed; never discard the journal to retry an upload. A process
crash can leave its lock: establish that the owner is dead before manually removing only
the lock. A completed upload is reused, including after thumbnail failure.

Before mutation, publication verifies the authenticated channel ID **and** its handle
`abdupdates`, current qualified delivery, selected image and approved copy. Channel lookup
requires `youtube.readonly` alongside `youtube.upload`; existing upload-only authorization
must be refreshed using the shared `youtube-auth` setup utility. The workflow uploads only
unlisted. `optOut` never calls the uploader or requires upload credentials.

## Adapter and validation

`node scripts/archon/rules-story.mjs <operation> <slug> [options-json]` is an internal node
bridge, not another scheduler. It returns one JSON document on stdout; diagnostics use
stderr. Technical errors exit 1. Repair results exit 2 unless the YAML node explicitly
uses `--route`. Loop-check operations exit 2 when their deterministic completion gate is
false. Each script/agent node performs only its declared assignment.

For development validation (Bun and an upstream checkout with its own dependencies):

```sh
node --test tests/archon*.test.mjs
npm test
ARCHON_SOURCE=/absolute/path/to/Archon \
  ARCHON_HOME="$PWD/.cache/archon-validation/home" \
  bun scripts/archon/validate-upstream.ts
```

The validator uses the actual upstream loader, graph planner and side-effect-free dry-run
engine for every YAML file. Stubs exercise approval/revision/rejection/cache branching;
they do not prove provider execution, visual inspection, human identity, real TTS/rendering,
or YouTube delivery. Adapter tests separately exercise actual file/hash gates and mocked
upload recovery. A real end-to-end film and authenticated upload remain operational
acceptance checks, not claims established by these fixtures.
