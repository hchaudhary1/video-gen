# video-gen

This repository turns a brief or supplied recording into a narration-synchronised video and thumbnail.
Agents own the writing, visual design and implementation. The pipeline handles measured timing,
rendering, review evidence and delivery. For software work, inspect and change the code normally.

For production, read `skills/video-production/SKILL.md`. For script work, read
`skills/script-writing/SKILL.md`. For composition authoring, read `skills/hyperframes/SKILL.md`.
Load technical references only for the task at hand; there is no required reading of the whole docs tree.

Work within the requested project. Keep assets and caches inside the repository. Preserve supplied
recordings and approved narration. Claims and reused media need evidence and provenance.
Rules-story production is scheduled exclusively by `.archon/workflows/video/rules-story/rules-story.yaml`; read `docs/archon-rules-story.md`. Its nodes call direct adapters/libraries, never `npm run video`, `next` or T3 handoffs. Kai/explainroo and shared setup utilities retain `npm run video -- ...`. Do not edit dependencies or `video.config.json`
unless requested. Never manufacture review evidence, user approval or successful delivery.

A role given a brief completes that assignment itself; Archon advances rules-story dependencies and starts fresh independent review nodes; the host retains this responsibility for Kai. Reviewers do not approve their own production work. A tool limitation is a limitation,
not grounds to claim that an image was viewed or audio was heard.

On resuming rules-story, use `archon workflow get <run-id>` and `archon workflow resume <run-id>`; deterministic nodes recover the saved profile and revalidate artifacts. For historical jobs, `status --project <slug> --json` remains read-only.
For new work, choose the treatment that matches the user's intent; `personalities/README.md` is the index.
The user's explicit direction takes precedence over a default personality.

Video and thumbnail dimensions match the saved canvas. After delivery and thumbnail selection,
the orchestrator uploads to abdupdates as unlisted unless the user opts out; use approved publishing
copy and `docs/publishing.md`. Send Discord notifications only when requested, through
`scripts/discord-notify.mjs` with one stable request ID per pending checkpoint. A ping is not approval.

Typography: use thick fonts such as Inter/Poppins ExtraBold or Black, Fira Code Bold,
or JetBrains Mono Bold/ExtraBold, or similarly heavy faces. Never use thin, light or
regular weights in authored video/thumbnail text. Load the actual font and preserve
its natural proportions; do not stretch text or silently substitute a system font.
