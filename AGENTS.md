# video-gen

This repository turns a brief or supplied recording into a narration-synchronised video
and thumbnail. Agents own writing, visual design and implementation; media libraries
handle measured timing, rendering, evidence and delivery. For software work, inspect and
change the code normally.

Archon exclusively schedules both `rules-story` and `kai-explainer`; YAML lives under
`.archon/workflows/video/`, with each node's prompt in its `commands/` folder. When you are
running inside a workflow node, the node prompt and the skills it loads are your whole
assignment: do the work it names and stop. Archon advances stages, starts independent
reviewers and asks the operator for decisions. No other production controller exists.

Skills live in `.agents/skills/` (`.claude/skills` links there). Operators starting or
resuming production read `.agents/skills/video-production/SKILL.md` and `docs/production.md`.
Each project keeps script-side files in `jobs/scripts/<slug>/` (brief, sources, script,
`production-profile.json` with the frozen treatment profile) and the media job in `jobs/<slug>/`.

Work within the requested project. Keep assets and caches inside the repository. Preserve
supplied recordings and approved narration. Claims and reused media need evidence and
provenance. Do not edit dependencies or `video.config.json` unless requested. Never
manufacture review evidence, user approval or successful delivery.

Reviewers do not approve their own production. A tool limitation is a limitation, not
grounds to claim an image was viewed or audio was heard. Only the operator answers human
attention waits. Retain the person's exact response and bind it to the inspected artifact.

Resume with `archon workflow get <run-id>` and `archon workflow resume <run-id>`.
Deterministic nodes recover the saved profile and validate current artifacts. For new
work choose the treatment from `personalities/README.md`; explicit user direction wins.

Video and thumbnail dimensions match the saved canvas. After qualified delivery,
thumbnail selection and approved copy, upload unlisted to abdupdates unless opted out;
`docs/publishing.md` owns the publication contract. Send Discord notifications only when
requested, through `scripts/discord-notify.mjs` with one stable request ID per pending
checkpoint. A ping is not approval.

Typography: use thick fonts such as Inter/Poppins ExtraBold or Black, Fira Code Bold,
or JetBrains Mono Bold/ExtraBold, or similarly heavy faces. Never author video/thumbnail
text in thin, light or regular weights. Load the actual font, preserve its natural
proportions and never silently substitute a system font or stretch text.
