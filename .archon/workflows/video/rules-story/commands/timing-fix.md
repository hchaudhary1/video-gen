Measuring word timing (ASR and forced alignment) for `jobs/$INPUTS.project` failed.
`jobs/scripts/$INPUTS.project/archon/asr-timing-repair.json` has the error.

Fix only its cause. You may delete stale or partial outputs (`jobs/$INPUTS.project/transcript.json`,
`alignment.json`, `review/archon-timing.json`) so they are measured again. If the error
points at the speech models, check them with `node scripts/media-readiness.mjs`. Never edit
the narration audio, `SCRIPT.md` or measured outputs by hand, and never invent timing. Note
what you did in `jobs/scripts/$INPUTS.project/archon/asr-timing-fix.md`.
