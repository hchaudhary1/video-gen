Rendering the series sound kit for `jobs/$INPUTS.project` failed. `jobs/scripts/$INPUTS.project/archon/sound-repair.json` has the
error; the renderer is `lib/sound-design.mjs`.

Fix only its cause inside `jobs/$INPUTS.project`, for example delete partial sound files under `jobs/$INPUTS.project/assets`
and a stale `review/archon-sound.json` so the kit renders again. Do not change any identity's
sound signature. Note what you did in `jobs/scripts/$INPUTS.project/archon/sound-fix.md`.
