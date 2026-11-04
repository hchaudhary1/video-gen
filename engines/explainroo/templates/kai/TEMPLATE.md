# The Kai template

A calm, dark explainer in the style of long-form tech explainer channels:
one locked frame, a scene that starts almost empty and builds up piece by
piece on the narration, then a hard cut to the next near-empty scene. Thin
outlined cards, small uppercase mono labels, big bold numerals, quotes from
real sources on white cards, a chapter bar. Tuned for AI and tech topics
(models, local AI hardware, costs, papers), and usable for any explainer.

Treat the creative guidance below as an initial steer, not hard and fast
instructions. Keep the consistent palette and typography, but use judgment
about the hook, narrative arc, scene layout, component choices and pacing.
Adapt, combine or skip suggestions when another approach explains the subject
better. The starter files are examples, not a sequence to reproduce in every
video. Factual accuracy, honest attribution and technical requirements still
apply.

It has its own identity: no watermark, no borrowed assets, no channel name.

```bash
node bin/explainroo.js init videos/<name> --template kai --title "..."
```

This copies `script.md`, `scenes.js` and the look file `kai.json` into the
project and writes `video.json` with these defaults:

| Setting | Value | Why |
|---|---|---|
| `theme` | `kai.json` (extends `midnight`) | near-black `#0e1010`, blue `#1e8fe1`, yellow `#ffd23f`, red `#e0313b`, Space Grotesk 700 for words and numerals, JetBrains Mono for labels |
| `camera` | `"still"` | the frame never moves; the picture builds up instead |
| `transition` | `"cut"` | hard cuts between scenes |
| `voice` | `am_michael`, `speed` 1.1 | a calm male narrator at about 160 words a minute |
| `music` | `{ "style": "calm", "volume": 0.3 }` | a quiet bed under the voice |
| `sfx` | `"minimal"` | only the kit's own light sounds (pops, blips, a thud for stamps) |
| `captions` | `false` | wide videos; upload the `.srt` instead |
| `watermark` | `false` | |
| `lead`, `hold` | 0.3, 0.8 | tight gaps between scenes |

## How to write the narration

Plan the title, thumbnail promise and opening together. Begin with a specific viewer
problem, develop an expectation mismatch, and make the explanation worth staying for.
Do not require a stock opener, a personal anecdote or a roadmap in the first 30 seconds.

This section replaces "How to write the narration" in AGENTS.md for this
template. The general rules about sources still apply: never make up a
number, a quote or a claim.

**Voice.** Aim for a personal, conversational voice, talking to one viewer.
"I" is for the research journey only: what you read, what surprised you, how you reasoned. Never
invent personal experiences: no hardware you own, nothing you ran or tested,
no stories that happened to you. A scenario that is not real must be
clearly hypothetical ("picture this", "say you have..."). "You" is the
viewer; use it naturally rather than aiming for a count.

**Structure.** Follow one central question. Establish the familiar approach and the surprising alternative
with a concrete task when useful, introduce the advertised evidence early, then explain mechanism,
conditions, limitations and implications. Choose the order for the promise. Do not defer the title's
subject behind an unrelated tour of every source. Avoid stock reaction journeys, repeated prerequisites
and mandatory roadmaps. Use truthful editorial judgment rather than fabricated personal experience.

**Sentences.** Conversational and spoken. Short sentences, one idea each.
Rhetorical questions are welcome ("So why do it?"). Contractions are fine.
No hype words, no "smash that like button", no slogans. Plain words; explain
a technical word the first time.

**Numbers.** Write digits ("24 gigabytes", "2.0625 bits"): Kokoro reads them
and the speech check expects them. Use `{shown|spoken}` for names and
acronyms (`{KV|K V}`, `{GGUF|G G U F}`, `{Qwen|Kwen}`). Words that sound like
other words ("picks"/"pix", "write"/"right", "tight"/"tied") fail the speech
check; reword them.

**Length and pace.** As a planning guide, about 155 to 175 words a minute.
A 10 minute video is about 1,600 words in 40 to 50 scenes. Scene length: median 12 to 16 seconds,
most under 20, rarely over about 30. A typical scene is 2 to 4 sentences.
Adjust these ranges to the brief and the time needed to understand the visual.

**Markers.** Put a `[#marker]` wherever something new appears. Aim for a new
element every 2 to 4 seconds; long holds are fine when the narration talks
about what is already on screen.

## Visual grammar

These are useful defaults for the Kai look. Keep the shared palette and type,
but choose compositions and components for the idea being explained. Reuse
parts when helpful; create custom visuals with the Scene API, including
`s.draw`, when they serve the scene better. Avoid repeating the same layouts
or set of components across every video.

- **Locked frame.** Prefer a still camera so the picture carries the explanation.
  Use `s.camera` when a move would make the subject clearer.
- **Build up, then cut.** A useful default is to start empty or with one element,
  add the rest on its cues, and end on one composed picture before a hard cut.
  Usually keep elements until replaced, but use `out`, transformations or other
  staging when they help the viewer follow the explanation.
- **Start top left.** One useful layout starts near the top left or left third,
  then fills to the right and below. Choose another arrangement when it better
  expresses the idea. Leave room for what arrives.
- **Density.** Three to seven elements is a useful starting range, not a quota.
  Lots of dark space is fine. Keep content inside about x 140 to 1780, y 90 to 990.
- **Color meaning.** Blue for the main quantity, yellow for the thing that
  matters most or the new thing, red for problems, costs and warnings, grey
  (`muted`, `gray`) for context and comparisons, white outlines for
  neutral containers, cream (`paper`) for documents.
- **Type.** Small uppercase mono labels (`s.kai.label`, 24 to 28 px) name
  things. Words and numerals use the display font. Big numerals are 110 to
  170 px. Body text is rare: quotes go on evidence cards.
- **Evidence.** An evidence card is a useful way to present an important sourced
  claim: an exact quote, the key phrase marked in yellow, and a source chip.
  A sourced chart, annotated document or another clear treatment can work too.
  Retain evidence for material claims regardless of how they appear on screen.
  Keep quotes short (one or two sentences).
- **Stamps** (`s.kai.stamp`) can convey the narrator's verdict; use sparingly,
  usually no more than one at the end of a scene.
- **Recurring scenes.** Consider a chapter bar at chapter starts. Keep returning
  numbers in the same colors so the viewer recognises them.

## The kit: `s.kai`

Choose from these reusable parts as needed; no component is required in every video.

All parts take `at` and `out` (seconds, a spoken word or `"#marker"`), and
`x`, `y` as the center unless noted. They make one light sound on entrance
(`sfx: false` silences it). Text goes through `s.text`, so `check` sees it.

| Call | What it draws |
|---|---|
| `k.label(text, { x, y, align, color, size })` | small uppercase letter-spaced mono label |
| `k.word(text, { x, y, size, color, align })` | a bold word or short phrase |
| `k.counter(value, { x, y, size, color, label, from, prefix, suffix })` | a big numeral with a label under it; a number with `from` counts up |
| `k.card({ x, y, w, h, label, title, value, sub, color, dashed, paper, check, cross, align })` | outlined card: small caps label top left, title or big value, sub line; `check`/`cross` take `true` or a time |
| `k.tag(text, { x, y, stem, color })` | a tag hanging from a pin on a stem; `color: 'line'` for a dark outlined tag |
| `k.pill(text, { x, y, color, filled, dashed, mono })` | a capsule word |
| `k.stamp(text, { x, y, color, rotate })` | a rotated rubber stamp that slams in |
| `k.chip(text, { x, y, align })` | a small source chip |
| `k.evidence({ x, y, w, kind, quote, source, markAt })` | a quote on a white card; `*starred*` words get a yellow marker at `markAt` |
| `k.doc({ x, y, w, h, kind, title, pin })` | a cream document page |
| `k.grid({ x, y, cols, rows, cell, gap, frame, label, fills, dots, sweep })` | cells that fill one by one: `fills: [{ at, dur, count, color, from }]`, `dots: [{ i, at, color }]` |
| `k.tokens(words, { x, y, size, at, stagger })` | word tiles, left edge at `x` |
| `k.bars(data, { x, y, w, h, max })` | flat bars with values above and labels below; items `{ label, value, text, color, at }` |
| `k.stack(segments, { x, y, w, total, unit, limit })` | a bar split into parts, like a memory budget; `limit: { value, label }` draws the budget line |
| `k.meter({ x, y, value, color, label })` | a vertical capsule that fills; `value` can be keys `[{ at, v }]` |
| `k.progress(steps, { x, y, w, times, grow })` | the chapter bar; node `i` becomes current at `times[i]` |
| `k.search({ x, y, w, text, typeAt })` | a search bar that types |
| `k.chat({ x, y, w, h, title, text, streamAt, wps })` | an answer window that streams text |
| `k.gauge({ x, y, r, labels, keys })` | a half-circle gauge; `keys: [{ at, v }]` from 0 to 1 |
| `k.conveyor({ x, y, w, flowAt, labels, tag })` | memory, a belt of moving tokens, compute |
| `k.calendar({ x, y, month, day })` | a calendar tile |
| `k.person({ x, y, h, label })` | a simple outlined person |
| `k.device(kind, { x, y, w, mem, label })` | line drawings: `gpu`, `laptop`, `server`, `chip` |

`s.arrow`, `s.annotate` (box, strike, circle) and `s.text` work as usual;
pass `color: s.kai.color('line')` or `'dim'` to match. Kit colors:
`s.kai.color('line' | 'dim' | 'cell' | 'paper' | 'white')`, plus the look's
ten colors.

A minimal scene:

```js
budget(s) {
  const k = s.kai;
  k.stack([
    { label: 'weights', value: 22.01, color: 'blue', at: '#weights' },
    { label: 'drafter', value: 0.96, color: 'yellow', row: 1, anchor: 'right', at: '#drafter' },
  ], { y: 300, w: 1560, total: 24, unit: ' GB', at: 0.3, limit: { value: 24, label: '24 GB' } });
  k.counter('0.17 GB', { x: 1200, y: 820, color: 'red', label: 'to spare', at: '#left' });
},
```

## Long videos

40 to 60 scenes work. `voice` caches each scene, so only changed scenes are
made again. `check` takes a few minutes for a ten minute video. Render the
draft first (`render --draft`), then the final; `render` uses up to 8
workers (`--workers n`).

## Thumbnails

Match [Kai's thumbnail style](https://www.youtube.com/@kaiexplainsYT/videos):
huge uppercase type, saturated flat colors, crisp offset shadows and one
immediately legible visual idea. Compose the thumbnail separately from the video scenes.

### Design

- **Canvas:** 1920×1080, PNG/JPEG under 2 MB. Use a flat near-black background
  (`#090909`). A pale background with black text also works for hardware lineups.
- **Colors:** white `#ffffff`, warm yellow `#ffce33`, bright red `#ff001a`,
  electric blue `#008fe5`. Use white for the setup and yellow for the payoff.
  Pair white lettering with blue or red offsets, and yellow lettering with red.
- **Type:** use Inter or Poppins ExtraBold/Black (800–900), Fira Code Bold,
  JetBrains Mono Bold/ExtraBold (at least 700), or a similarly thick licensed face.
  Never use thin, light or regular weights or silent system-font fallbacks. Load
  the actual font file and preserve natural glyph proportions; do not stretch text.
  Use ALL CAPS, tight tracking and readable line spacing. Start at 180–260 px for stacked headlines or 330–500 px for
  one dominant word, with 12–28 px visible gaps between lines. Adjust to fit
  the composition.
- **Shadows:** duplicate lettering behind itself, offset 12–22 px right and
  10–20 px down, and fill red or blue. Keep edges sharp, with no blur or glow.
- **Graphics:** one large cutout, bold flat cartoon, or simple chart. Use black
  internal lines, a white outer contour around 6–12 px, and an optional hard
  red/blue offset. Hardware photos need clean cutout edges. Illustrated faces,
  hands and characters can carry the metaphor.
- **Spacing:** use a few large elements and clean empty space. Keep important
  text 80–100 px from the edges and clear of the lower-right duration overlay.
  A hero graphic may deliberately crop at the frame edge.

### Layouts

Choose the layout that best communicates the topic. Coordinates are starting
points at 1920×1080; adjust to the headline and artwork.

| Layout | Composition |
|---|---|
| Headline + hero | 2–4 stacked lines on the left, approximately x 100–940, y 150–880; one large graphic on the right, approximately x 1000–1800, y 150–900. |
| Headline + comparison | Same left text block; two large bars or outcomes on the right, with minimal labels and prominent values. Keep quantitative bar heights accurate. |
| Huge verdict | White setup across the upper quarter; one enormous yellow word or acronym across the remaining width. |
| Top hook + hardware/character | One headline across the top; a large character/prop arrangement or hardware lineup fills the lower two thirds. |
| Before / after | Two panels separated by a thin white vertical line, with large numbers or labels above contrasting images. |
| Graphic only | One central object linked to a few recognizable symbols; omit the headline when the graphic communicates the hook. |

### Copy and delivery

- Write one short, direct hook, usually 2–7 words, with deliberate line breaks.
  Emphasize one word, phrase or number through scale and color. Use verdicts,
  warnings or comparisons only when supported by the film; put detail in the title.
- Numbers, objects and faces are optional. Text-only compositions are valid.
  Small tilted tags, arrows and model tiles can support the main idea; keep
  scene UI, chapter bars, evidence cards and decorative fine print out.
- Use original or appropriately sourced artwork; record reused asset provenance.
  Omit Kai's channel signature and watermark.
- Retain an editable source and thumbnail brief with the title, headline,
  description, chosen reference, font and asset sources.
- Export full size and a 320×180 preview. Inspect text weight, color offsets,
  object scale and readability at both sizes. Obtain independent image review
  and selection; follow repository-root `docs/publishing.md` for publishing.

## Checklist

1. Research and keep `sources/SOURCES.md` with URLs and the exact quotes.
2. Write `script.md` using the guidance above; `voice`; fix unconfirmed words.
3. `scenes.js`; `check` until there are no errors.
4. `still` and `sheet --scene <id>` to see the build up; compare with the
   look you want, checking readability and unnecessary repetition too.
5. `render --draft`, look, `render`, `verify`.
6. Create the thumbnail using the guidelines above; inspect the full-size export
   and feed preview, then obtain independent review and selection.
