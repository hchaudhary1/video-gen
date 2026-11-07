Write the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`.

This is an argued Kai take, not a neutral explainer. Read sections 2 and 3 of
`references/kai-take.md` in the script-writing skill, then `BRIEF.md`, `SOURCES.md`, the take
dossier `sources/ANALYSIS.md` and the evidence in `sources/`. Before any narration, commit to one
take and record it in `research.md` under `## Take` (thesis, stance, why, steelman, what would
change my mind, gap). Then write the script that argues it in the house voice: claim questioned
in the opening, the plan, real community voices quoted from retained files and judged, receipts,
what the headline leaves out, a fair steelman, an explicit verdict with who should act, and a
closing line that compresses the take.

Produce substantive `SCRIPT.md`, `research.md` and `VISUALS.md`. Every factual claim must rest on
those sources; opinions are judgments of that evidence, never invented experience. Kai narration
uses explainroo scene headings: every spoken line, including the opening hook, sits under a
`## scene-id` heading, using the narration and marker syntax in `engines/explainroo/AGENTS.md`.
Size the script to the brief's duration at about 140 words per minute.

- Supplied script: $script-state.output.artifacts.supplied. Revision allowed: $script-state.output.artifacts.canRevise.
  When a script was supplied and revision is not allowed, keep `SCRIPT.md` byte-for-byte
  and only add the missing research, take and visual intent.
- Operator decision on the previous draft (null on a first draft):
  $script-state.output.artifacts.feedback
  A requested revision permits only the changes it asks for.

Finish when `node scripts/archon/kai-script.mjs script-status $INPUTS.project` reports no errors.
