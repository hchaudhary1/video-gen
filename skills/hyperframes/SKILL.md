---
name: hyperframes
description: Author or edit native HTML video compositions in video-gen, with horror-first visual guidance and this repository's measured narration and rendering pipeline.
---

# HyperFrames in video-gen

Own the scene HTML, CSS, JavaScript and local assets. The pipeline supplies the root composition,
fixed narration, measured timing, inspection evidence and delivery. Read
[docs/composition.md](../../docs/composition.md) before authoring; it is the integration contract.
Use `npm run video -- ...` with an explicit project/job. Keep the installed renderer version;
standalone setup, plugin installation, registry searches and desktop-app handoffs are not part of this workflow.

For stages and approvals, follow [video-production](../video-production/SKILL.md) and
[docs/orchestrator.md](../../docs/orchestrator.md). On resuming, recover the saved profile with
`npm run video -- status --project <slug> --json`. Read the saved profile and project decisions;
the user's explicit direction takes precedence. Do not introduce another script, approval or review lifecycle.

## Horror first

For rules-story, preserve the series identity and frame described by the saved profile
([current profile](../../personalities/rules-story/PROFILE.md)). Use `rules-series-kit@1.0.0` for the
HUD, measured sentence captions, rule cards, exhibits and finish. Mount it on each scene's timeline
as described in the composition contract. Keep approved narration intact; pictures follow its measured words.
Use [docs/audio.md](../../docs/audio.md) for the pipeline soundtrack and identity sound kit.

Before visual planning, read [Motion Explainer](../../docs/motion-explainer.md) and both linked
technique catalogs; inspect relevant example code when adopting a technique. Consider the full camera,
editing and motion graphics vocabulary across long films and Shorts. Adapt it to the narrative beat,
without requiring a technique quota or preset layout. DOM, SVG and Canvas are all available.

Black grounds, glow, grain, persistent HUDs and sentence-boundary hard cuts belong to this series.
Judge whether they make the picture clear and tense; do not import launch-film bans against them.
Other profiles can reuse the technical and visual references without adopting the horror identity.

## Author, build and inspect

Author `film.json`, scene files under `compositions/` and assets inside the job. Read duration, canvas
and fps from `job.json`, and word timing from `alignment.json`. Leave generated `index.html`,
`timing.json`, `assets/cues.js` and generated series data to their pipeline commands.

Build paused, seekable timelines: a timestamp produces the same frame regardless of seek order.
Register each timeline after construction under its scene's composition ID. The framework controls
media time and timed-host visibility; animate children. Keep fonts, scripts and media local.

```bash
npm run video -- plan-check --job jobs/<slug>
npm run video -- build --job jobs/<slug>
npm run video -- snapshot --job jobs/<slug> --at 0.5,3,5.9
```

Choose snapshot times from the actual film. Build checks runtime/assets, sampled text bounds,
backward-seek consistency and HyperFrames lint. Inspect frames and transitions; use playback to judge
motion. These are different kinds of evidence. Clear technical failures and make creative choices for
the story. Builder self-checks do not replace independent review; the host advances review, render and
delivery through the pipeline. Disclose unavailable inspection capabilities.

## References to load when needed

| Task | Reference |
| --- | --- |
| Scene structure, timing, media and fonts | [format](references/format.md) |
| Seekable GSAP or Canvas implementation | [runtimes](references/runtimes.md) |
| Camera, easing, cuts, holds and readable motion | [motion](references/motion.md) |
| Developing pictures against approved narration | [visual planning](references/visual-planning.md) |
| Builder inspection and concrete repair notes | [self-check](references/review.md) |
| Character acting and continuity | [characters](references/types/character.md) |
| Reframing a Short for a vertical canvas | [vertical](references/types/vertical.md) |

Adapted from the downloaded [official HyperFrames skill](https://github.com/heygen-com/hyperframes).
These references are maintained for this repo's pipeline; upstream updates need a compatibility review.
