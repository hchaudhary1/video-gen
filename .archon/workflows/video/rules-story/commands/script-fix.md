Apply the independent review of the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`.

Read `review.md` and fix every concrete finding in `SCRIPT.md`, `research.md` and
`VISUALS.md`. There is no second review, so fix substantively. Rules-story narration is plain spoken prose.

Finish when `node scripts/archon/rules-story.mjs script-status $INPUTS.project` reports no errors. Append what you changed,
and any finding you could not resolve, to `research.md` under `## Review fix`.
