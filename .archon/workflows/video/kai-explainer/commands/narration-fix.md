The measured Kai narration for `$INPUTS.project` missed its duration target by more than 20%.
`jobs/$INPUTS.project/review/narration-repair.json` gives the measured length, the target, the current word
count and `targetWords`.

Edit `jobs/scripts/$INPUTS.project/SCRIPT.md` so the spoken text is close to `targetWords` words, cutting or adding
proportionally across scenes. Keep every scene heading and marker, every sourced claim with
its attribution, and the hook. Add no unsourced claims. Edit no other project file.

Finish when `node scripts/archon/kai-explainer.mjs script-status $INPUTS.project` reports no errors. Append what you cut or added
to `jobs/scripts/$INPUTS.project/research.md` under `## Duration fix`. The narration is regenerated once and
production continues at whatever length it measures.
