Independently review the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`, following `references/review.md` and
section 4 of `references/kai-take.md` of the script-writing skill. You did not write it and you must not change any author file.

Read `BRIEF.md`, `SCRIPT.md`, `VISUALS.md`, `research.md` (including its `## Take`), `SOURCES.md`,
the take dossier `sources/ANALYSIS.md` and the evidence in `sources/`, including the retained
community threads and similar-video transcripts. This review is text-only and happens before
narration: audio, timing, scenes, thumbnails and renders do not exist yet and are not missing
evidence. Estimate duration from the word count. `PACKAGE.md` is optional; without it, judge the
promise against `BRIEF.md`. A source needed for a material claim that is missing or unreadable
makes the review incomplete; name the claim and the source.

Judge the take as hard as the facts: a neutral or unearned stance, a straw-man steelman, quotes
that are altered, unretained or used as proof, an angle the similar videos already covered, and
writing that does not sound like the reference channel are all findings. A script that explains
clearly but argues nothing is `revise`, not `pass`.

This is the only review. A `revise` or `incomplete` result gets one author fix and no
re-review, so include every material finding.

1. Write `jobs/scripts/$INPUTS.project/review-draft.md`: concrete findings from the files you read, ending with the
   line `Disposition: pass`, `Disposition: revise` or `Disposition: incomplete`.
2. Run `node scripts/archon/script-review-report.mjs $INPUTS.project`. It binds the draft to the
   reviewed files (binding `$script-binding.output.artifacts.binding`) and writes `review.md`.
