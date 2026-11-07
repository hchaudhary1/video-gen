The build of `$INPUTS.project` (job `jobs/$INPUTS.project`, phase `$INPUTS.phase`) reported errors, listed in
`jobs/$INPUTS.project/review/build.json`.

Fix the reported syntax errors, missing exports, font and layout errors in the scene sources.
This is a technical correction, not a creative pass. Keep the script, recordings, voice
configuration, measured timing and review evidence. Append a section for this pass to
`jobs/$INPUTS.project/review/technical-repair-$WORKFLOW_ID-$INPUTS.phase.md` with what you fixed and what
remains. The build runs once more and any issue it still reports is disclosed, so fix every
error now; a scene module that cannot load still stops production.
