# Video production through Archon

Archon is the sole production controller for both treatments. YAML schedules authors,
independent reviewers, media operations, repair rounds and human decisions. Node adapters
call media libraries directly. Each agent completes only its assigned node.

## Choose a workflow

- `rules-story`: original uncanny fiction using HyperFrames, Ming and a saved series identity.
- `kai-explainer`: technical explanations using explainroo scenes, Kokoro or supplied recordings.

Choose editorial intent from [the profile index](../personalities/README.md). Follow the
[production skill](../skills/video-production/SKILL.md) for node responsibilities and load
only the technical references needed for the assignment.

## Run unattended

After the one-time setup below, run from the repository root:

```sh
./bin/archon workflow run kai-explainer --detach \
  --input project=cache-explained \
  --input 'options={"brief":"Explain what a cache does using a clear visual analogy.","format":"landscape","duration":60,"review":"none","thumbnails":1,"optOut":true}'
```

Choose a fresh project slug for each new film. Use `rules-story` instead for an original
uncanny-fiction brief. `--detach` lets the command return while Archon keeps executing;
save the returned run ID. The server must remain running. No host agent or manual stage
advancement is required.

`review: "none"` disables optional human checkpoints, while independent script, film and
thumbnail reviews still run. `optOut: true` produces local deliverables without publishing
copy approval, channel credentials or an upload. Omitting these settings uses the project's
normal approval/publication policy and may pause for a person. Existing projects keep
their saved settings; command options do not retroactively change them.

When you return, inspect the run:

```sh
./bin/archon workflow get <run-id>
./bin/archon workflow logs <run-id> --format text
```

A completed local production leaves:

- `jobs/<slug>/renders/video.mp4`: final video (Kai also writes subtitles, chapters and cover).
- `jobs/<slug>/thumbnail/thumbnail.png`: selected reviewed thumbnail.
- `jobs/<slug>/review/delivery.json`: qualified delivery record with artifact hashes.

A running, paused or failed run is not a completed delivery. Automated repair rounds are
bounded; missing tools, unavailable inspection or unresolved mandatory defects can fail
the run. Inspect the failing node, fix the cause and use recovery below. Graph simulations alone do not establish full-video acceptance.

## Setup

The video checkout owns its Archon source, runtime and state. The tracked launcher and
bootstrap use Archon revision `0d8de493fb016ca7a63529f3abc1ab08ac3e7a16` (0.13.2)
and Bun 1.4.2. The current bootstrap provisions Linux x64.

```sh
node scripts/setup-archon.mjs --media
source scripts/activate-archon.sh
archon version
archon doctor
archon workflow list
```

Use `./bin/archon` when shell activation is inconvenient. Activation adds this checkout's
`bin` and Bun directories to PATH; it does not alter your shell startup files. The launcher
sets `ARCHON_HOME` to `.cache/archon/home`, with SQLite, run transcripts, caches and artifacts
in this checkout. It disables telemetry and resolves the already installed Codex binary.
The project config selects Codex, its configured model and live research search.

Archon source is a dependency clone under `.cache/archon/source`, not vendored application
code. The bootstrap checks the source commit and runtime version and installs source
packages from the pinned lockfile. It verifies the Bun archive against registry integrity
metadata. Application dependency versions and `video.config.json` are unchanged.

### Provider authentication

The Codex CLI must already be installed and logged in on the host. Check `codex login status`.
Archon reuses that native login without copying account secrets or writing to Codex's home.
Archon's doctor can report no multi-user keys connected while the native Codex login is usable;
this single-user installation uses the native login.

YouTube credentials and consent are described once in [publishing](publishing.md).
Local production with `optOut: true` requires no publishing authorization.

### Media readiness

`--media` installs the root and explainroo lockfiles, provisions the installed Chrome browser,
installs Ming if its runtime/model/source is absent, and loads the pinned models. Loading
models can download several GB and takes time on the first run.

```sh
node scripts/media-readiness.mjs
node scripts/media-readiness.mjs --load-models
```

The latter actually loads Ming, Parakeet v2, Kokoro and Whisper without synthesizing speech,
transcribing recordings, creating a production or generating approval/review evidence.
Parakeet's `--setup` mode provisions the same locked Python environment used in production.
Ming's readiness helper loads the same CPU model and source used by its narration worker.
The ignored `.cache/archon/media-readiness-models.json` records observed results, not listening.

### Setup diagnostics

```sh
archon validate workflows rules-story
archon validate workflows kai-explainer
ARCHON_SOURCE="$PWD/.cache/archon/source" bun scripts/archon/validate-upstream.ts
```

Setup diagnostics can create clearly named non-production workflows in the local Archon
home. Real provider, inherited-child/input-binding and durable-timer checks are separate
from stub graph simulations. None establish that an actual production or publication passed.

On this host Docker's executable is installed but its daemon socket is unavailable to the
current user. The pinned upstream CLI attempts Docker verification-image inventory even
for host-only runs, producing a nonfatal cleanup warning. The diagnostics completed and
created no containers/images. These video workflows run in the host checkout; Docker is
not a production prerequisite, and this setup does not change Docker access permissions.

## Request human checkpoints

For productions where you want script, film and thumbnail approval, request those
checkpoints explicitly:

```sh
archon workflow run rules-story \
  --input project=night-office-001 \
  --input 'options={"brief-file":"briefs/night-office.md","format":"landscape","duration":420,"review":"script,final,thumbnail","thumbnails":3}'

archon workflow run kai-explainer \
  --input project=streaming-explained \
  --input 'options={"brief-file":"briefs/streaming.md","format":"landscape","review":"script,final,thumbnail","optOut":true}'
```

The workflow input `project` is a video slug, not an Archon repository registration ID
or workflow name. A new slug requires a brief or supplied script. Existing slugs recover
their saved inputs, treatment, canvas and decisions; creation options do not overwrite them.
There is no implicit latest project.

`options` accepts `brief` / `brief-file`, `script`, `audio`, `format`, `duration`,
`thumbnails`, `review`, `review-depth` and `optOut`. A supplied recording requires its
corresponding script. Keep credentials out of these inputs. Independent review and media
checks remain mandatory; `review` requests optional human script, final and thumbnail
checkpoints. `optOut: true` keeps the entire production local.

Frozen editorial intent and script files live in `jobs/scripts/<slug>/`; media and evidence
live in `jobs/<slug>/`. The YAML packs under `.archon/workflows/video/` expose individual
stages and bounded rounds as governed child runs. Model/provider settings belong in
`.archon/config.yaml` or explicit Archon run bindings; confirm the model in real node
execution when a particular model is required.

## Decisions and revisions

Use the Archon console/CLI attention queue. Each checkpoint displays the artifact path
and its binding hash. Select approve, revise, or stop, and provide your actual message
as the answer text. Thumbnail attention offers the current passing variants plus revise
and stop. Publishing offers approve, revise, keep local, or stop. A requested revision
returns to the appropriate author and independent reviewer before another checkpoint.

Publishing copy and channel verification follow [publishing](publishing.md).

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

Rounds are explicitly bounded in YAML (four script/film/thumbnail/user-revision
opportunities). After exhaustion the run fails with retained evidence; a fresh run can continue from validated artifacts. Archon currently restricts attention
waits and governed child runs inside `loop_group`, so these cycles use explicit conditional
round nodes rather than invalid nested loops. This makes each attempt inspectable.

`worktree.enabled: false` keeps ignored recordings, jobs, dependencies and models in the
provisioned checkout. Do not run unrelated mutable productions concurrently in it. Archon
serializes checkout writers; inherited child runs share the parent's retained workspace.
Keep caches and generated artifacts inside the repository. Never clean this workspace
while any run is paused, failed/resumable, or producing media.

The read-only `node scripts/tools.mjs watch <slug>` viewer displays artifacts; decisions
and progression remain in Archon. Keep the saved run ID. If an interrupted process leaves
a run marked active, inspect the run and its owner before using Archon cancellation/recovery;
do not remove live workspace claims or start a competing production.

## Kai media contract

For supplied narration, provide `script` and `audio` in options. The source file is
copied unchanged into assets; the engine derives scene takes and measures their timing.
Supplied script syntax must name scenes (`## scene-id`) with the words actually spoken.
The canonical approved script is `SCRIPT.md` in the script folder; `script.md` in the
media folder is its exact copy. Generating narration or revising the script requires the
current independent script review and any requested script approval.

The saved Kai profile fixes treatment, not layouts or animation recipes. Authors use
`scenes.js`, `video.json` visual settings, assets and the full Scene API. Voice settings,
approved script, measured timing and scene takes are immutable during visual repairs.
Changed narration inputs/outputs fail explicitly instead of silently regenerating a take.

### Kai evidence

Research and script review follow source and first-person honesty requirements. Narration
calls the engine's preparation function directly and verifies per-scene speech coverage.
The director authors moving explanations using `build/timeline.json`. Full and feed-sized
layout checks gate a cached review-draft render before evidence capture. The read-only
viewer plays that draft for the requested film checkpoint; it is never delivered or uploaded.
The frozen pack binds the draft clip and includes actual scene-end stills,
one-second temporal sheets, per-scene narration files and measured timeline hashes.
Two independent fresh reviewers inspect visual mechanism and continuity/legibility;
both reports must be valid before the deterministic join routes repairs or qualification.

Rendering outputs `jobs/<slug>/renders/video.mp4`, with subtitles, chapters and cover
sharing its basename. Encoded verification checks canvas/frame rate, duration, audio/video
streams, speech coverage, loudness and black frames. Measurements do not establish listening
or naturalness. Delivery requires current technical evidence and independent/user decisions.

## Adapter and validation

`node scripts/archon/<treatment>.mjs <operation> <slug> [options-json]` is an internal node
bridge, not another scheduler. It returns one JSON document on stdout; diagnostics use
stderr. Technical errors exit 1. Repair results exit 2 unless the YAML node explicitly
uses `--route`. Loop-check operations exit 2 when their deterministic completion gate is
false. Each script/agent node performs only its declared assignment.

For development validation (Bun and an upstream checkout with its own dependencies):

```sh
node --test tests/archon*.test.mjs
npm test
ARCHON_SOURCE="$PWD/.cache/archon/source" bun scripts/archon/validate-upstream.ts
```

The validator uses the actual upstream loader, graph planner and side-effect-free dry-run
engine for every YAML file. Stubs exercise approval/revision/rejection/cache branching;
they do not prove provider execution, visual inspection, human identity, real TTS/rendering,
or YouTube delivery. Adapter tests separately exercise actual file/hash gates and mocked
upload recovery. A real end-to-end film and authenticated upload remain operational
acceptance checks, not claims established by these fixtures.
