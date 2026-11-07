# Video production through Archon

Archon is the sole production controller for both treatments. YAML schedules authors,
independent reviewers, media operations, repair rounds and human decisions. Node adapters
call media libraries directly. Each agent completes only its assigned node.

## Choose a workflow

- `rules-story`: original uncanny fiction using HyperFrames, Ming and a saved series identity.
- `kai-explainer`: technical explanations using explainroo scenes, Kokoro or supplied recordings. Its
  research retains independent checks and community reactions (Reddit, Hacker News, X) in a take
  dossier, and its writer argues a position rather than summarising
  ([kai-take](../.agents/skills/script-writing/references/kai-take.md)).

Choose editorial intent from [the profile index](../personalities/README.md). The
[production skill](../.agents/skills/video-production/SKILL.md) is the operator's short guide.

## Run unattended

After the one-time setup below, run from the repository root:

```sh
./bin/archon-detached workflow run kai-explainer --detach \
  --input project=cache-explained \
  --input 'options={"brief":"Explain what a cache does using a clear visual analogy.","format":"landscape","duration":60,"review":"none","thumbnails":1,"optOut":true}'
```

Choose a fresh project slug for each new film. Use `rules-story` instead for an original
uncanny-fiction brief. `--detach` lets the command return while Archon keeps executing;
save the returned run ID. The server must remain running. No host agent or manual stage
advancement is required.

`bin/archon-detached` runs `bin/archon` in its own `systemd --user` scope. A plain `--detach`
child stays in its launcher's cgroup, so stopping that scope (an agent host restarting, a
closed terminal session) also stops the run. With user lingering enabled
(`loginctl enable-linger`), the separate scope keeps the workflow running until it
finishes. Without a systemd user manager the launcher falls back to plain `bin/archon`.

`review: "none"` disables optional human checkpoints, while independent script, film and
thumbnail reviews still run, along with measured audio review. `optOut: true` produces local deliverables without publishing
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

A running, paused or failed run is not a completed delivery. Every automated check gets one
fix round and production then continues (see [Failure policy](#failure-policy-one-fix-then-continue)),
so a run stops only for the unusable states listed there. Inspect the failing node, fix the
cause and use recovery below. Graph simulations alone do not establish full-video acceptance.

### Failure policy: one fix, then continue

Archon marks the whole run failed when any single node fails, so recoverable problems are
never thrown as node failures. Each stage follows the same shape: **do it, check or review it
once, and if that does not pass, run one fix round and continue without checking or reviewing
again.** What the fix did not resolve is recorded in `jobs/<slug>/review/continuations.json`
(script continuations in `jobs/scripts/<slug>/archon/script-revision.json`) and listed under
`limitations` in `review/delivery.json`. A continuation is never reported as a pass:
`independentReviewPassed` stays false wherever a review did not pass.

| Stage | Check | Fix round | After the fix |
|---|---|---|---|
| Research | `research-status` | `research-fix` produces what is missing | Continues; the script review sees any gap |
| Script | one independent review | `script-fix` addresses every finding | `script-continue` accepts the fixed text, no second review |
| Kai narration | measured length within ±20% of `duration` (min ±2 s) | `narration-fix` resizes the script toward `targetWords` | `narration-final` regenerates once and keeps any length, disclosed |
| Ming narration | length, text contract, generation and speech verification | `narration-fix` for a length or text defect (`reason` in `narration-repair.json`), then one new take | `narration-final` keeps the take; the audio review measures it |
| Audio | ≥90% speech coverage per scene | Kai: `audio-fix` respells the weak scenes; Ming: `audio-redo` takes a new narration | `audio-review-final` accepts down to 50% coverage, disclosed |
| Build | engine checks | `repair` fixes the reported errors | `build-final` accepts remaining issues for those exact sources |
| Visual review | one complete independent inspection | one retry if no complete report was submitted, then the single revision | No second review; a missing inspection is recorded, not invented |
| Series kit (rules-story) | `series` | `direction-fix` | `series-final` |
| Identity (rules-story) | `identity` continues or registers the series identity | `identity-fix` repairs `identity.json` / registration | `identity-final` |
| Preparation (rules-story) | `prepare` builds the job folder | `prepare-fix` clears the reported cause | `prepare-final` |
| Timing (rules-story) | `timing` measures ASR word timing | `timing-fix` clears stale measured outputs | `timing-final` |
| Sound kit (rules-story) | `sound` renders the identity's sound | `sound-fix` clears partial sound files | `sound-final` |
| Final verification | encoded-media checks | `technical-fix`, rebuild and re-render | `technical-verify` accepts remaining issues, disclosed |
| Thumbnails | one independent review | `thumbnail-fix` remakes blocked variants | Best finished variant is selected and marked `accepted-without-pass` |
| Publishing copy | copy contract | the copy author fixes `archon/publishing-errors.json` | Operator approval is still required before any upload |

Routed rules-story stages write `jobs/scripts/<slug>/archon/<stage>-repair.json` for their fix
round. Integrity guards are never routed: a changed approved script, narration or recording,
and a missing approval or review stop the run explicitly; a missing tool or model fails the final attempt.

Crashed deterministic media nodes (narration, build, preview, render, verify, delivery,
publish) are redone once, and agent nodes retry transient provider errors.

A run still stops when continuing would produce something wrong rather than imperfect:
invalid options or slug, an operator stop, a changed supplied recording or approved take,
a script the narration parser cannot read after its fix, a scene module the engine cannot
load after its repair, missing heavy fonts, a render without video or audio streams, at the
wrong canvas or frame rate, or truncated by more than 1 s, speech coverage below 50% after the
fix, missing tools or provider access, and publication without operator approval,
credentials or the exact channel ID. Automated fixes never rewrite a supplied script or one
the operator must approve (`review` includes `script`), and never change film sources the
operator must approve (`review` includes `final`); those continue with the finding disclosed.

### Unattended recovery contracts

`review: "none"` with `optOut: true` requires no operator approval. It does not disable
independent inspection or turn a failed check into a passing delivery. Infrastructure,
provider access and actual image-viewing capability remain prerequisites; no workflow can
guarantee success when they are unavailable.

The workflow checks research files before writing. Missing research gets one research pass
and, if `research-status` still reports gaps, one fix pass. Script syntax and required author outputs are checked before
independent script review or an approval wait. Kai uses the actual narration parser, including
the first scene heading. Syntax defects return to the script writer while supplied scripts
remain protected. Script reviewers write `review-draft.md` and run
`node scripts/archon/script-review-report.mjs <slug>`; the helper uses the deterministic
`archon/script-review-request.json` assignment to bind their report without copying a hash.

Kai initialization commits `job.json` last. Interrupted initialization without narration can
finish missing files and refresh the approved script copy without replacing authored scenes.
An incomplete initialization containing takes stops rather than overwriting them. A pending
narration-input receipt also prevents changed voice/script settings from replacing a take
after an interrupted generation. New jobs receive actual local Inter 700/800 fonts from the
pinned dependency; theme weights and face availability are checked by the build.

Both treatments schedule a `*-build-cycle` before visual inspection, after the single
creative revision and after a final-verification fix. Each cycle is one build, one technical
`repair` when that build reports `repair`, and one `build-final`. The final build accepts
remaining check issues in `review/build-acceptance.json`, bound to the exact sources; a scene
module the engine cannot load still stops. Repairs fix reported syntax, missing exports, fonts
and layout defects while preserving narration, timing and review evidence. They do not
commission more creative reviews. Current builds are reused.

The independent visual review runs once, with one retry only when no complete, valid report
was submitted. A `revise` report counts as complete. When inspection is still missing, the
`review-join` node records `review/visual-review-unavailable.json` and production continues to
the one author revision; missing inspection is disclosed, never treated as approval. A fresh root
run reuses an already verified current production rather than reauthoring it; changed source
hashes invalidate that reuse. Thumbnail cycles likewise require actual exported files, viewed
PNGs, current verdicts and rankings before selecting an image.

New workflow definitions apply to fresh runs. Resume retains its captured graph. Tests and
graph simulations verify routing and artifact contracts, not guaranteed model judgment,
external service availability or real production acceptance.

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

`duration` is a target in seconds, not an exact length. The narration node measures the
generated take and accepts it within ±20% of the target (minimum ±2 s): a 420 s target
accepts 336–504 s. Outside that band it returns `repair` and writes the measured length,
target and a `targetWords` estimate to `jobs/<slug>/review/narration-repair.json` (Ming:
`jobs/scripts/<slug>/archon/narration-repair.json`). `narration-fix` resizes the script once,
`narration-final` regenerates and keeps whatever it measures, and a remaining miss is
disclosed in delivery. The earlier take is retained under `review/narration-attempts/`.
Supplied recordings and supplied or operator-approved scripts are not resized; their
measured length continues with the miss disclosed.

Frozen editorial intent and script files live in `jobs/scripts/<slug>/`; media and evidence
live in `jobs/<slug>/`. The YAML packs under `.archon/workflows/video/` expose individual
stages; bounded rounds are Archon loops (see [Cycles as loops](#cycles-as-loops)). Model/provider settings belong in
`.archon/config.yaml` or explicit Archon run bindings; confirm the model in real node
execution when a particular model is required.

Each AI node is a `command:` whose prompt is `commands/<node>.md` in its workflow folder,
plus a `skills:` list. A node receives only `CLAUDE.md`/`AGENTS.md`, the skills it declares
and its command; it gets no other skills. Role knowledge (script writing, HyperFrames or Kai
scenes, visual review, thumbnails, publishing copy) lives in `.agents/skills/`, so commands
state only the node's task, its inputs and when it is done. Each node's `description:` says why it
exists. To see a node's purpose and exactly what it is given, run `.cache/archon/bun/bin/bun scripts/archon/visualize.ts --serve` and select the node.

### Script review and resume

The script reviewer is a tool-using agent without a structured-output constraint. It writes
`jobs/scripts/<slug>/review.md` with `Binding: <current hash>`, concrete findings and a
`Disposition: pass`, `revise` or `incomplete`. The following script node reads that file;
it derives machine output from the report instead of trusting an agent's completion reply.
A missing or mismatched report is an incomplete review. It is never a passing review: like a
`revise` report it routes to the one `script-fix` round, after which `script-continue`
records the continuation and the script proceeds without another review.

On resume the reviewer runs again only when the current binding lacks a passing review.
Approving an unchanged reviewed script skips the author and reviewer. Existing substantive script
and visual intent are preserved unless a current review or operator decision requests a
revision. New research evidence may require a new review without rewriting the narration.

Archon captures workflow source for each run. After updating a workflow definition, start
a fresh run of the same workflow/project to use the new graph; resuming a run captured
before the change can retain its old node configuration. The saved project files remain
available to the fresh run.

## Decisions and revisions

Use the Archon console/CLI attention queue. Each checkpoint displays the artifact path
and its binding hash. Select approve, revise, or stop. A bare `./bin/archon workflow approve <run-id>` is a real
operator decision and needs no comment; its selected decision is recorded explicitly, without
inventing a sentence. A revise decision requires your actual feedback as answer text. Thumbnail attention offers the current passing variants plus revise
and stop; when none passed after the fix round it offers the finished variants, labelled as
not passed. Publishing offers approve, revise, keep local, or stop. A requested revision
is retained as operator feedback. Script and thumbnail cycles can return to their authors;
the film itself has one independent visual review and one revision per run.

Publishing copy and channel verification follow [publishing](publishing.md).

### Cycles as loops

The script, thumbnail and publishing cycles are each one `loop_group` node (`script-cycle`,
`thumbnail-cycle`, `publishing-cycle`) in the main workflow. A pass ends at the cycle's
attention wait, the only place a loop body may pause. The next pass opens with
`<kind>-answer`, which records the answer the previous pass received (via
`$LOOP_PREV.<kind>-attention.output` and the previous gate's binding) and cancels on stop.
Its state node then skips work that is already current, so an approval is recorded by a pass
that only re-checks the gate. `<kind>-loop-check` is the loop's `until_bash`.

Without an operator answer every cycle finishes in its first pass, because each pass
contains its own review and single fix. `max_iterations` (Kai script 2,
rules-story script 4, thumbnails 4, publishing 4) only bounds
operator-driven passes and the publishing-copy fixes; each accepted operator answer permits
one more pass, so requested revisions are never cut off by the budget. Research, narration,
audio, build, visual review and verification are straight-line nodes, not loops.

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

Measured audio review follows narration generation and timing; it requires no listening
capability. Its hash-bound result is the
single speech-acceptance decision before visual work. Individual unconfirmed ASR words above
the 90% coverage threshold remain disclosed uncertainty, not a contradictory build rejection.
See [review contracts](review.md) for the audio and visual receipt fields.

Visual production runs once: technical build/repair → draft → one independent visual review
→ one author revision → technical build/repair → render and encoded verification → at most one
technical fix, rebuild, re-render and final verification. There is no second creative review.
Delivery retains the original findings, revision notes, inspection limitations and
continuations without claiming a review of the revised output. Changed narration and the
unusable states in the [failure policy](#failure-policy-one-fix-then-continue) stop explicitly.

Script, thumbnail and optional operator cycles remain bounded separately in YAML. Review
depth controls evidence sampling density, not the number of visual reviewers or revisions.

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
One independent reviewer inspects visual mechanism, continuity and legibility, followed by
one author revision. The original evidence is archived before that revision.

Rendering outputs `jobs/<slug>/renders/video.mp4`, with subtitles, chapters and cover
sharing its basename. Encoded verification checks canvas/frame rate, duration, audio/video
streams, speech coverage, loudness and black frames. Measurements do not establish listening
or naturalness. Delivery requires current technical evidence and independent/user decisions.

## Adapter and validation

`node scripts/archon/<treatment>.mjs <operation> <slug> [options-json]` is an internal node
bridge, not another scheduler. It returns one JSON document on stdout; diagnostics use
stderr. Technical errors exit 1. Repair results exit 2 unless the YAML node explicitly
uses `--route`. Loop-check operations exit 2 when their deterministic completion gate is
false; they serve as the `until_bash` of each cycle. Each script/agent node performs only its declared assignment.

For development validation (Bun and an upstream checkout with its own dependencies):

```sh
node --test tests/archon*.test.mjs
npm test
ARCHON_SOURCE="$PWD/.cache/archon/source" bun scripts/archon/validate-upstream.ts
```

The validator uses the actual upstream loader, graph planner and side-effect-free dry-run
engine for every YAML file. The dry run assumes an `until_bash` loop completes after its first
pass, so these routes check one pass of each loop; a stubbed recorded rejection stands in for the
next pass's stop. Stubs exercise approval/revision/rejection/cache branching;
they do not prove provider execution, visual inspection, human identity, real TTS/rendering,
or YouTube delivery. Adapter tests separately exercise actual file/hash gates and mocked
upload recovery. A real end-to-end film and authenticated upload remain operational
acceptance checks, not claims established by these fixtures.
