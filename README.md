# Video production with Archon

Archon YAML exclusively schedules both video treatments. Agents research, write, author
and independently review; direct media libraries perform measured narration timing,
rendering, verification and delivery. There is no separate stage CLI or host handoff loop.

| Workflow | Treatment | Media library |
|---|---|---|
| `rules-story` | Original series horror, long film and vertical Shorts | HyperFrames, Ming, synthesized identity sound |
| `kai-explainer` | First-person technical/AI visual explanations | explainroo Canvas, Kokoro or supplied recording |

Read [AGENTS.md](AGENTS.md), [the profile index](personalities/README.md) and the applicable
[production skill](skills/video-production/SKILL.md). Editorial profiles define intent;
Archon configuration defines provider/model choices. Each author/reviewer is a fresh node.

## Run

```sh
archon workflow run rules-story \
  --input project=night-office-001 \
  --input 'options={"brief-file":"briefs/night-office.md","review":"script,final,thumbnail"}'

archon workflow run kai-explainer \
  --input project=streaming-explained \
  --input 'options={"brief-file":"briefs/streaming.md","review":"script,final,thumbnail"}'
```

The runbooks describe supplied scripts/recordings, requested checkpoints, repair rounds,
resume validation and publishing:

- [Rules-story](docs/archon-rules-story.md)
- [Kai explainer](docs/archon-kai-explainer.md)
- [Shared orchestration](docs/orchestrator.md)
- [Publishing and authentication](docs/publishing.md)

Projects and frozen editorial intent live in `jobs/scripts/<slug>/`; media and evidence
live in `jobs/<slug>/`. Keep the dedicated production checkout throughout paused/resumable
runs. Models and tools stay under repository `.cache/`. Never put credentials in a brief.

## Setup and validation

Use Node.js 22+, npm, git, tar, FFmpeg/FFprobe, Python 3.12, uv and Chrome.
Bootstrap the pinned local Archon runtime and media environments:

```sh
node scripts/setup-archon.mjs --media
source scripts/activate-archon.sh
archon doctor
archon validate workflows rules-story
archon validate workflows kai-explainer
npm test
(cd engines/explainroo && npm test)
```

The bootstrap installs Archon source at the pinned revision and Bun 1.4.2 under
`.cache/archon/`; no global Archon/Bun installation is required. `./bin/archon` works
without activation. Its SQLite state, logs and run artifacts stay in this worktree.
The project config selects Codex and reuses its existing login (`codex login status`).
Authenticate Codex first on a new machine; no account tokens are committed or copied by
the bootstrap. `--media` provisions application dependencies, the installed Chrome browser,
Ming when absent, and loads all four speech models. Models remain under repository cache.
See [local setup](docs/archon-setup.md) for diagnostics and YouTube authentication.

The workflow validator uses the actual pinned upstream Archon loader/planner and stub
simulations; see the runbooks.
Tests exercise media integrity, actual browser rendering, source/evidence bindings,
operator revision routing, cached output reuse and mocked upload recovery. They do not
establish creative quality, actual listening or successful publication.

## Code responsibilities

`.archon/workflows/video/` defines every stage, conditional round and attention boundary.
`scripts/archon/` exposes individual operations through strict JSON adapters. `lib/project`
retains metadata, not a scheduler. `lib/film`, timing, narration, media and sound modules
provide rules-story operations. `engines/explainroo/src` and `engine` provide Kai's media
APIs and the sound synthesis used by horror. Shared review/thumbnail/upload libraries
validate actual evidence, independent identities, selections and durable remote sessions.

`node scripts/tools.mjs youtube-auth` provisions publishing authentication.
`node scripts/tools.mjs watch <slug>` serves a read-only artifact viewer; all decisions
and progress remain in Archon. Default publication is unlisted to abdupdates after
qualified delivery, thumbnail selection and approved copy, unless the user opts out.
