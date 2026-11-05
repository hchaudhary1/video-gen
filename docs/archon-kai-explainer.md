# Kai explainer with Archon

Archon exclusively schedules Kai production. The YAML pack is in
`.archon/workflows/video/kai-explainer/`; its direct adapter imports explainroo's
project, narration/timeline, QA and renderer libraries. There is no stage CLI or host
handoff loop. All projects use the same artifact layout: `jobs/scripts/<slug>/` for
brief, frozen profile, sources and approved script; `jobs/<slug>/` for media and evidence.

## Run

Provision the repository with `npm ci`, then `(cd engines/explainroo && npm ci)`.
FFmpeg and Chrome must be installed. Kokoro/Whisper models are loaded on demand into
repository `.cache/explainroo`. Configure your provider and model in Archon.

```sh
archon validate workflows kai-explainer
archon workflow run kai-explainer \
  --input project=streaming-explained \
  --input 'options={"brief-file":"briefs/streaming.md","format":"landscape","review":"script,final,thumbnail"}'
```

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

## Nodes and gates

Research and script review follow source and first-person honesty requirements. Narration
calls the engine's preparation function directly and verifies per-scene speech coverage.
The director authors moving explanations using `build/timeline.json`. Full and feed-sized
layout checks gate a cached review-draft render before evidence capture. The read-only
viewer plays that draft for the requested film checkpoint; it is never delivered or uploaded.
The frozen pack binds the draft clip and includes actual scene-end stills,
one-second temporal sheets, per-scene narration files and measured timeline hashes.
Two independent fresh reviewers inspect visual mechanism and continuity/legibility;
both reports must be valid before the deterministic join routes repairs or qualification.

Requested script, film and thumbnail decisions use the shared attention/receipt contract
in [the orchestrator documentation](orchestrator.md). Revisions create a new author/review
round; a stop cancels the run without deleting artifacts. Four attempts are explicit in
YAML. Missing inspection, invalid evidence and mandatory technical failures remain blockers.
Creative-review budget exhaustion retains its disclosed disposition rather than claiming
an independent pass.

Rendering calls the engine with a full-size MP4 output at `renders/video.mp4`. Sidecars
(subtitles, chapters and cover) share that basename. Encoded verification checks exact
canvas/frame rate and measured duration, audio/video streams, speech coverage, loudness
and black frames. These measurements do not establish listening or naturalness.
Technical success and current independent/user decisions are required for delivery.

Thumbnail nodes use the shared video-sized exporter, independent reviewer and selection
logic. Publishing copy includes title, description, sources, tags and the actual abdupdates
channel ID. Approved unchanged copy, a current selected image and qualified video gate the
unlisted upload. `optOut: true` keeps the production local and never calls the uploader.
The durable journal reconciles interrupted uploads; do not discard it to retry an
uncertain remote operation. Authentication setup is `node scripts/tools.mjs youtube-auth`.

## Recovery and workspace

Use `archon workflow get <run-id>`, `logs` and `resume`. Creation options do not overwrite
saved projects. Re-run nodes validate script/voice/timeline hashes, build evidence,
review-pack hashes, source/render bindings and verification receipts. Valid expensive
outputs are reused; an edited evidence file invalidates its review.

Use a dedicated retained production checkout with `worktree.enabled: false`. Archon
inherits it for governed child runs. Keep ignored jobs, dependencies, models and caches
in place throughout paused or resumable runs. Run progress is owned by Archon; the
optional `node scripts/tools.mjs watch <slug>` viewer only displays artifacts.

## Validation

```sh
npm test
(cd engines/explainroo && npm test)
ARCHON_SOURCE=/absolute/path/to/pinned/Archon \
  ARCHON_HOME="$PWD/.cache/archon-validation/home" bun scripts/archon/validate-upstream.ts
```

Both packs target upstream revision `0d8de493fb016ca7a63529f3abc1ab08ac3e7a16`.
Schema/graph tests use Archon's real loader/planner. Stub simulations do not execute
providers, speech models or uploads. Synthetic fixture reports in tests are labelled and
never establish actual creative review, listening or successful publication.
