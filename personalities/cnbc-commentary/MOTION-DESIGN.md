# CNBC commentary motion design

Default for future CNBC videos; an explicit new brief takes precedence.
The user approved [this revised video](https://youtu.be/sZ3BYteNpJo?t=198)
(commentary begins at 3:18). Use its motion treatment, not the earlier slide version.

## Visual direction

- Explain the spoken mechanism with objects that move, split, transform or change relationships
  on narration cues. Follow the action with purposeful framing and close-ups. Text labels the
  picture rather than transcribing narration into panels.
- Examples: follow payments through operating cash into equipment; open a timing gap between
  bills and receipts; show equity creating ownership claims and debt creating repayment obligations.
  Vary visual forms and staging to fit each story; do not repeat one diagram layout throughout.
- No persistent branded header, top rule, chapter bar, B-roll tag or generic footer. Avoid repeated
  title/subtitle/bordered paragraph/verdict layouts. Fading labels into a frozen diagram or adding
  decorative loops does not make a passage motion design.
- Use financial B-roll selectively when it adds real context. Place graphics relevant to **our
  commentary** directly over it where useful. Every scene does not need footage. Mute it unless
  its sound serves the story.
- Keep footage provenance in the source ledger and description, CNBC attribution on CNBC excerpts,
  and concise credits beside material company figures. Never invent financial quantities, ownership
  proportions, stock histories or cash-flow projections; schematic tokens are not company data.
- Use Midnight with cyan/blue for facts, amber for interpretation and red for risk. Load actual heavy
  fonts at natural proportions. Check contrast and cropping throughout camera moves, including
  small details such as clock hands.

## Authoring and review

Create the project files and run `cnbc style` as described in [PROFILE.md](PROFILE.md).
The installed [motion-kit.js](assets/motion-kit.js) supplies drawing primitives, not scene layouts.
Author story-specific staging in `scenes.js` with measured narration cues, `s.draw`, `s.group`
and explicit `s.camera` moves. `camera: "still"` disables automatic moves, not authored keys.

Inspect representative temporal sheets (`sheet --scene <id> --every 2`) and rendered excerpts
before the full render. Check that movement develops the explanation; end-frame readability and
technical checks alone cannot establish this. Fix long settled passages that lose their purpose.
Include this guide and temporal evidence in independent film review; returning to the rejected
slide treatment is a brief mismatch. State whether inspection used playback, sampled frames or
signal/ASR checks; never claim viewing or listening beyond the evidence.

For picture-only revisions, preserve approved narration, excerpts and timing, and retain delivered
versions. Continue the profile's measured content-ratio and independent-review requirements.

## Reference sequences

[Cash flow](references/cash-flow-sequence.jpg) and [timing gap](references/timing-gap-sequence.jpg)
show authentic frames every two seconds, read left to right then top to bottom. Use them to study
visual development, not as layouts to duplicate. [Provenance](references/SOURCES.md) records the
source and extraction details. Research facts afresh for each story.
