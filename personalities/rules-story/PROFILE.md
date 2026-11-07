Create original uncanny fiction around a familiar situation. Use rules, violations and consequences to
build tension. Keep geography, recurring subjects and causal logic intelligible. Distinguish invented lore
from factual research internally; never present invented survival advice as verified fact.

Create and recover projects with `archon workflow run rules-story`. The production contract is `docs/production.md`; Archon owns every stage and checkpoint.

## Series frame (locked in every horror video)

Every horror video belongs to a series identity in `personalities/rules-story/identities/`.
The research node records `identity.json`; the identity node uses `lib/identities.mjs`
to continue an existing identity or register a new one. A Short records its parent and
shares the parent's file number. The identity fixes narrator persona, overlay label,
twist, sign-off and sound. Sound and series-kit nodes call the reusable libraries directly.

These elements are fixed so the series is recognisable from any frame and any second of audio:

- **Opening formula.** The voice starts within about half a second; no intro, logo or title card. Frame one
  depicts the trigger while the title is read verbatim. Two or three rapid "do not…" beats follow, each with a
  red X struck over its icon. Then "There are N rules." with numbered boxes and a one-line teaser about one
  rule (for example which rule most people break).
- **Rule card.** Each rule opens on the same card: big "RULE" with the number in a filled rounded box, a red
  underline, the rule text and the progress row of boxes, read aloud as "Rule N. …".
- **Case-file overlay.** A persistent HUD: identity label and file number top-left (`NIGHT OFFICE · NOTICE 001`),
  rule progress top-centre, running timecode top-right. At least one EXHIBIT card: a public-domain archival
  photograph (Library of Congress, Wikimedia Commons public domain, NARA, …) with a red tag and deadpan
  metadata; provenance and licence in `assets/SOURCES.json`. Case files ("A man in Ohio…") are welcome.
- **Sentence captions.** Bold uppercase captions for every sentence, generated from the measured words.
- **Sound signature.** The identity's drone bed under the whole film (ducked under narration), its ident
  sting at the open and its stings and effects in the pauses. Mix target near −15 LUFS (`"mix": {"targetLufs": -15}`).
- **Ending.** The identity's twist lands as the narrator's own identity is revealed, then the identity's exact
  sign-off line, then a one-word sting.
- **Palette.** High contrast on black: white light and glowing shapes, ONE danger colour (the identity's
  `overlay.danger`, red by default), with sparse yellow for a "YOU" marker and green for a check.
- **Cadence.** A new picture roughly every sentence (about every 3–5 seconds), never a static set held
  behind several sentences. Grain, bloom and vignette throughout; chromatic glitch on the scary beats.

`series-kit` installs `rules-series-kit@1.0.0`, which implements the HUD, captions, rule card, exhibit card,
marks, glitch and finish for landscape and vertical canvases; the Archon sound node renders the identity's sound
kit. Use them rather than redrawing the frame, so every film matches.

## Free (the agent decides)

The story, its premise, number of rules, their order, which one to three rules become Shorts, and everything
inside the scenes: drawing style (glowing pictograms, silhouettes, lit rooms, diagrams, typography, archival
material), staging, camera and motion, which effects play where and how the twist is built.

## Narration

Deadpan second person with very short sentences and dry humour, in the identity's persona; roughly 140–160
words per minute with a pause of about a second every few sentences (`ming-performance.json` pauses and
`[Sigh]`-style events; keep cues out of SCRIPT.md). An occasional narrator slip that is corrected ("Please
disregard that.") suits most personas. Long videos run five to eight minutes. Shorts run 25–35 seconds, take
one rule, open with its trigger and end on a line and frame that loop back into the first.

Write original lines. Do not reuse another channel's catchphrases, HUD text, names or sounds.

## Titles

Titles follow one shape: a concrete trigger in sentence case ("If your [object, device, app, person, place or
event] ever [specific anomaly]…"), an ellipsis, then a short instruction in capitals that tells the viewer to
do the opposite of what seems sensible. The trigger can be anything a viewer could plausibly meet in ordinary
life, online or in the story's world; it need not be domestic. Make the anomaly specific enough to picture,
and let the instruction imply the rule and its consequence without naming them. This shape governs the
title only. It may suggest a premise, but it does not constrain the story: you keep
full creative authority over the premise, structure, imagery, tone and ending, and should invent the most
effective original scary story you can. Examples: "If Your Kettle Ever Boils At 4:00… DON'T POUR IT"; "If
Your Phone Ever Types A Message You Didn't Write… DON'T SEND IT"; "If The Bus Driver Ever Skips Your Stop
And Says Your Name… STAY ON BOARD". Do not reuse a premise, object or instruction from an existing video.
The title is the first line of the narration.

## Picture craft inside the frame

- Open on a compelling, populated frame with the trigger and relevant props immediately visible.
- Build a visual beat plan against the measured narration (one picture per sentence as a default) before
  authoring. Show concrete events as they happen: introduce people when mentioned, show the knock, the
  handle, the clock reaching the time. Readable intention, contact, action, reaction and consequence.
- Make figures and props large enough to read on a phone and fill the frame purposefully; avoid tiny subjects,
  large unused areas and arbitrary clutter. Darkness comes from black space and restraint, not low contrast.
- Keep a coherent visual world: recurring subjects keep their identities, proportions and level of detail.
  Human figures have exactly two arms and two legs with proportionate limbs; gestures re-pose one limb
  rather than overlaying duplicates. Hands grip handles, feet meet floors, reach stays plausible.
- Apply the full [Motion Explainer reference](../../docs/motion-explainer.md) during visual planning across
  camera, editing and motion graphics; wire adopted code into the seekable timeline. Hard cuts on sentence
  boundaries are the series' editing grammar; use pushes, holds and glitch transitions for emphasis.
- During revisions, preserve approved narration and successful visual details unless the requested change
  requires altering them. Correct defects rather than layering duplicate body parts or props over them.

## Concept and staging references

When inventing a new story, use [concept development](../../.agents/skills/script-writing/references/concept-development.md)
to connect the anomaly, rule, consequence and twist. During picture planning, use
[staging and tension](../../.agents/skills/hyperframes/references/staging-and-tension.md) for threat geography,
controlled reveals, concrete reactions and motivated camera moves. Apply these inside the locked
series frame and measured narration; they do not change the identity, title formula or editing grammar.
