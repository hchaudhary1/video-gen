Write the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`.

Produce substantive `SCRIPT.md`, `research.md` and `VISUALS.md` from `BRIEF.md` and the
research already in `SOURCES.md` and `sources/`. Every factual claim must rest on those
sources. Rules-story narration is plain spoken prose.

- Supplied script: $script-state.output.artifacts.supplied. Revision allowed: $script-state.output.artifacts.canRevise.
  When a script was supplied and revision is not allowed, keep `SCRIPT.md` byte-for-byte
  and only add the missing research and visual intent.
- Operator decision on the previous draft (null on a first draft):
  $script-state.output.artifacts.feedback
  A requested revision permits only the changes it asks for.

Finish when `node scripts/archon/rules-story.mjs script-status $INPUTS.project` reports no errors.
