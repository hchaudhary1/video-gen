The narration for `$INPUTS.project` needs a script change. `jobs/scripts/$INPUTS.project/archon/narration-repair.json` says why.

- `reason: "duration"`: the measured narration missed the duration target by more than 20%.
  Edit the spoken prose in `jobs/scripts/$INPUTS.project/SCRIPT.md` to fit the target, cutting or adding
  proportionally while keeping the story, the rules and the cue phrases.
- `reason: "text"`: the spoken text breaks the Ming contract in `detail` (see
  `docs/audio.md`). Edit only the offending text: remove angle brackets, bracketed cues
  and other unsupported characters. Drop `ming-performance.json` unless it still matches
  the edited text exactly.

Edit no other project file. The narration is regenerated once and production continues at
whatever length it measures. Append what you changed to `jobs/scripts/$INPUTS.project/research.md` under
`## Narration fix`.
