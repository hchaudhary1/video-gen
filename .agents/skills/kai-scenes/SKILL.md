---
name: kai-scenes
description: Author or repair kai-explainer scenes (jobs/<slug>/scenes.js) with the explainroo Scene API and the Kai template, timed to measured narration.
---

# Kai scenes

A Kai job lives in `jobs/<slug>/`. You own `scenes.js` and the project's visual settings.
Never change `script.md`, the narration audio, the voice configuration or measured timing.

- `build/timeline.json` is the measured timeline. Export one scene function from `scenes.js`
  for every scene ID in it, and time elements to its cue words and markers.
- `engines/explainroo/AGENTS.md` is the Scene API: every `s.*` method, its options, and
  "Things that break". Read the sections for the methods you use, and always read
  "Things that break" before finishing.
- `engines/explainroo/templates/kai/TEMPLATE.md` is the look and the `s.kai` kit: palette,
  heavy type (Space Grotesk 700, JetBrains Mono) and the visual-storytelling guidance.
- The creative direction is `files["PROFILE.md"]` in `jobs/scripts/<slug>/production-profile.json`.

What the treatment needs: a continuously moving visual story, not slides. Drawn subjects
act out the explanation; each change shows a cause, mechanism or consequence; meaningful
objects carry across scene boundaries. A repeated title-at-top with content below fails
the treatment even if the titles change. Show intermediate states, not only end frames.

Scene functions are pure functions of time: call every element on every frame and use
`at`/`out` for timing; use only `s.rand()`, `s.noise()` or `Math.random()` for randomness.
Load the actual heavy fonts at their natural proportions; never substitute a system font.
