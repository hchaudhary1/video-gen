Preparing the job folder `jobs/$INPUTS.project` from the reviewed script and the generated narration failed.
`jobs/scripts/$INPUTS.project/archon/prepare-repair.json` has the error.

Fix only its cause, for example remove an incomplete `jobs/$INPUTS.project` folder (one without `job.json`)
left by an interrupted preparation. Never touch `jobs/scripts/$INPUTS.project/narration.wav`, `SCRIPT.md`, any review,
approval or narration receipt, and do not regenerate narration. Note what you did in
`jobs/scripts/$INPUTS.project/archon/prepare-fix.md`.
