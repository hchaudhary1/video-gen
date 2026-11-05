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

## Production

Use the [unattended run command](docs/production.md#run-unattended) to start a local film
and leave Archon to execute its stages. The [production runbook](docs/production.md) covers setup, workflow selection,
launch commands, decisions, repair and recovery. Both treatments use that same Archon
operating flow. [Publishing](docs/publishing.md) covers credentials and durable uploads.

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
