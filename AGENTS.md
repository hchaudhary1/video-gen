# video-gen

Turns a brief or supplied recording into a narration-synchronised video and thumbnail.
Agents write, design and implement; the libraries in `lib/` and `engines/` measure timing,
render, collect evidence and deliver. For software work, inspect and change the code normally.

Production runs only through the Archon workflows `rules-story` and `kai-explainer`
(`.archon/workflows/video/`). Inside a workflow node, the node prompt and the skills it
loads are your whole assignment: do that work and stop. `kai-script` is a script-only lab that
runs kai-explainer's nodes through the independent script review and stops. To start, resume or answer a
production, use the `video-production` skill (`.agents/skills/`, linked from `.claude/skills`).

A project keeps its brief, sources, script and frozen `production-profile.json` in
`jobs/scripts/<slug>/`, and its media job in `jobs/<slug>/`.

- Preserve supplied recordings, approved narration and measured timing.
- Back factual claims and reused media with retained evidence and provenance.
- Never manufacture review evidence, operator approval or successful delivery. Reviewers
  never approve their own work, and a missing capability (viewing, listening) is reported
  as a limitation, never as a pass.
- Keep assets and caches inside the repository. Do not edit dependencies or
  `video.config.json` unless asked.
