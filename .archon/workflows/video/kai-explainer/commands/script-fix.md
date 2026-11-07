Apply the independent review of the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`.

Read `review.md` and fix every concrete finding in `SCRIPT.md`, `research.md` and
`VISUALS.md`. There is no second review, so fix substantively. Keep the script an argued take
in the conversational voice of section 3 of `references/kai-take.md` in the script-writing skill:
when a fix changes the thesis, stance or verdict, update `## Take` in `research.md` to match. Then
read `.agents/skills/unslop/SKILL.md` and apply it to the narration you changed. Kai narration uses explainroo scene headings: every spoken line, including the opening hook, sits under a `## scene-id` heading, using the narration and marker syntax in `engines/explainroo/AGENTS.md`.

Finish when `node scripts/archon/kai-explainer.mjs script-status $INPUTS.project` reports no errors. Append what you changed,
and any finding you could not resolve, to `research.md` under `## Review fix`.
