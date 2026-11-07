The speech check could not confirm enough of the Kai narration for `$INPUTS.project` in some scenes.
`jobs/$INPUTS.project/review/audio-review.json` lists them; `jobs/$INPUTS.project/review/narration-repair.json` has the details.

In `jobs/scripts/$INPUTS.project/SCRIPT.md`, change only those scenes so the voice says them clearly: spell out
numbers, symbols, acronyms and unusual names with the pronunciation syntax in
`engines/explainroo/AGENTS.md` (for example `{API|A, P, I}`), and reword homophones.
Keep the meaning, claims and attribution.

Finish when `node scripts/archon/kai-explainer.mjs script-status $INPUTS.project` reports no errors. Append your changes to
`jobs/scripts/$INPUTS.project/research.md` under `## Audio fix`. The changed scenes are regenerated once.
