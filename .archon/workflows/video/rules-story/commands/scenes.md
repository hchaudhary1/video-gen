Author the scenes of the rules-story film `$INPUTS.project` (job `jobs/$INPUTS.project`).

Inputs: `jobs/$INPUTS.project/film.json` and `jobs/$INPUTS.project/series.json` (the director's beat plan, scene order and
cue phrases), `jobs/scripts/$INPUTS.project/VISUALS.md` and the measured phrase timing.

1. Run `node scripts/archon/rules-story.mjs build $INPUTS.project`. If every scene file exists and the build reports no errors,
   stop without rewriting anything.
2. Otherwise write each scene owned by `"builder"` in `film.json` that is missing, empty or
   reported by the build: one seekable native HTML composition per scene under
   `jobs/$INPUTS.project/compositions/`, following the beat plan and the measured timing, with a new picture
   about every sentence. Leave passing scenes intact.
3. Use the installed `rules-series-kit` components for the HUD, captions, rule card, exhibit
   card, marks, glitch and finish instead of redrawing the series frame, the identity's
   palette and the local heavy fonts.
4. The EXHIBIT card uses a genuinely public-domain archival image, with provenance and licence
   in `jobs/$INPUTS.project/assets/SOURCES.json`, or `SOURCES.json` says none was used.
5. Run `node scripts/archon/rules-story.mjs build $INPUTS.project` again and fix the errors it reports in your scenes.

Do not change narration, measured timing, the scene order or cue phrases in `film.json`,
`series.json` or the sound kit.
