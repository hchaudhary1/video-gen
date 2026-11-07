Research the Kai explainer `$INPUTS.project`. Its files are in `jobs/scripts/$INPUTS.project/`.

This video will argue a take, not just explain. Research the question in `BRIEF.md` deeply
enough to judge it, following section 1 of `references/kai-take.md` in the script-writing skill
and `references/sourcing.md`:

- Primary sources: the paper, release or idea itself, including method, evaluation and limits.
- Independent research: replications, critiques, prior and competing work, and your own
  arithmetic or checks, saved with their working.
- Community reactions from Reddit, Hacker News and X, retained under `sources/community/`
  (`node .agents/skills/script-writing/scripts/social.mjs`; web search for X).

Do not retrieve YouTube or other video transcripts.

Write `SOURCES.md` (the source index, primary sources marked apart from reporting, community
posts) and the take dossier `sources/ANALYSIS.md` with the four sections that
reference names. Keep retained evidence for every factual claim, including any first-person
research claim. Never invent personal experience. A platform you cannot reach is recorded
under an `Unavailable:` line, not paraphrased from memory.

Keep evidence that is already there. Finish when
`node scripts/archon/kai-script.mjs research-status $INPUTS.project` reports no errors.
