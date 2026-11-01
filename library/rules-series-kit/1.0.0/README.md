# rules-series-kit 1.0.0

The locked frame of a series horror film (rules-story profile), as reusable HyperFrames pieces. Scene content
inside the frame is free; this kit only supplies what every film in a series shares.

Project-owned code (`kit.js`). Fonts: Inter 600/800 latin subsets from `@fontsource/inter` 5.3.0
(SIL Open Font License 1.1, `fonts/OFL.txt`). No third-party artwork.

## Install

```bash
npm run video -- identity-continue --id <identity> --project <slug>     # file number (once per project)
npm run video -- series-kit --job jobs/<slug>                            # needs series.json, see below
```

`series.json` in the job folder:

```json
{"identity": "night-office", "rules": [{"n": 1, "title": "Count the knocks", "at": {"phrase": "Rule one"}}]}
```

`series-kit` copies this bundle to `assets/library/rules-series-kit/1.0.0/` and writes
`assets/series/series-data.js` (identity overlay, rule starts, sentence captions from `alignment.json`) plus
`review/series-captions.md`, the caption index table. Re-run it whenever alignment or series.json change.

## Use in a scene template

```html
<script src="assets/library/rules-series-kit/1.0.0/kit.js"></script>
<script src="assets/series/series-data.js"></script>
<div id="r1-root" data-composition-id="r1" data-width="1920" data-height="1080" data-duration="40">
  <div class="rs-stage"> <!-- your pictures: transparent background, white-on-black art --> </div>
</div>
<script>
{
  const root = document.getElementById('r1-root'), tl = gsap.timeline({paused: true});
  RulesSeries.ruleCard(root, tl, {n: 1, text: 'Count the knocks', at: 0, until: 3.4});
  RulesSeries.sequence(tl, [{el: shotA, at: RulesSeries.cue('r1', 12)}, {el: shotB, at: RulesSeries.cue('r1', 13), push: 1.05}], {duration: 40});
  RulesSeries.redX(root, tl, {at: 5.2, x: 960, y: 420, size: 260});
  RulesSeries.exhibit(root, tl, {src: 'assets/exhibit-a.jpg', label: 'Exhibit A', lines: ['Year: 1936', 'Door: closed'], at: 8, until: 14});
  RulesSeries.mount(root, {scene: 'r1', timeline: tl, glitches: [{at: 21.4, dur: 0.4}], flashes: [{at: 30, color: '#e5322d'}]});
  window.__timelines['r1'] = tl;
}
</script>
```

- `mount` adds the HUD (identity label + file number, rule progress, running timecode), the sentence caption,
  grain/vignette/bloom finish, glitch windows (chromatic split, jitter, tears) and flashes, all driven by the
  scene timeline so seeking is deterministic. Call it last so the HUD sits above your cards.
- `ruleCard`, `exhibit`, `redX`, `check`, `you`, `boxes` (numbered rule boxes, optional `hot`/`cross`) and
  `sequence` (one picture per beat) add elements and tweens to the given timeline at local times.
- `RulesSeries.cue(sceneId, captionIndex)` is the local start of a caption; `captionsIn(sceneId)` lists them.
- Landscape and vertical canvases are both supported (`rs-vertical` layout; captions sit above the Shorts UI).
- Keep one danger colour (the identity's `overlay.danger`); `--rs-you` (yellow) and `--rs-ok` (green) are sparse markers.
