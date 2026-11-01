# The Kai template

A calm, dark explainer in the style of long-form tech explainer channels:
one locked frame, a scene that starts almost empty and builds up piece by
piece on the narration, then a hard cut to the next near-empty scene. Thin
outlined cards, small uppercase mono labels, big bold numerals, quotes from
real sources on white cards, a chapter bar. Tuned for AI and tech topics
(models, local AI hardware, costs, papers), and usable for any explainer.

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

This section replaces "How to write the narration" in AGENTS.md for this
template. The general rules about sources still apply: never make up a
number, a quote or a claim.

**Voice.** First person, talking to one viewer. "I" is for the research
journey only: what you read, what surprised you, how you reasoned. Never
invent personal experiences: no hardware you own, nothing you ran or tested,
no stories that happened to you. A scenario that is not real must be
clearly hypothetical ("picture this", "say you have..."). "You" is the
viewer, often 60 to 90 times in a ten minute video.

**Structure.**

1. Open with "Okay, so" and a relatable, clearly hypothetical situation in
   the second person ("Okay, so picture this. You have...").
2. The trigger: the release, paper, post or claim that started it, with a
   date.
3. The reaction journey, true to your research: "I read the model card, the
   blog and the report, and went from skeptical to impressed to careful."
   Show it with `s.kai.gauge`.
4. An explicit roadmap of 3 to 5 chapters ("Here's the plan. First...
   Then... Finally..."), mirrored by `s.kai.progress`. Put `chapter="..."`
   on the first scene of each chapter and show the bar at the top of those
   scenes.
5. Layer by layer explanation. Each scene answers one small question and
   ends on one composed picture. Quote the real source on screen with
   `s.kai.evidence` when a claim matters.
6. Callbacks: bring back an earlier number or picture ("Remember the six
   times gap?").
7. A fine print or reality check chapter: what the claim does not say, who
   measured it, what was left out.
8. A grounded ending about what it means for the viewer, and one plain
   sentence that sums up the point.

**Sentences.** Conversational and spoken. Short sentences, one idea each.
Rhetorical questions are welcome ("So why do it?"). Contractions are fine.
No hype words, no "smash that like button", no slogans. Plain words; explain
a technical word the first time.

**Numbers.** Write digits ("24 gigabytes", "2.0625 bits"): Kokoro reads them
and the speech check expects them. Use `{shown|spoken}` for names and
acronyms (`{KV|K V}`, `{GGUF|G G U F}`, `{Qwen|Kwen}`). Words that sound like
other words ("picks"/"pix", "write"/"right", "tight"/"tied") fail the speech
check; reword them.

**Length and pace.** About 155 to 175 words a minute. A 10 minute video is
about 1,600 words in 40 to 50 scenes. Scene length: median 12 to 16 seconds,
most under 20, none over about 30. One scene is 2 to 4 sentences.

**Markers.** Put a `[#marker]` wherever something new appears. Aim for a new
element every 2 to 4 seconds; long holds are fine when the narration talks
about what is already on screen.

## Visual grammar

- **Locked frame.** No camera moves. Never use `s.camera`.
- **Build up, then cut.** A scene starts empty or with one element and adds
  the rest on its cues. Nothing leaves (`out`) unless it is replaced. The last
  frame is one composed picture. Then a hard cut.
- **Start top left.** The first element sits near the top left or the left
  third; later ones fill the space to the right and below. Leave room for
  what arrives.
- **Density.** Three to seven elements at the end of a scene. Lots of dark
  space is fine. Keep content inside about x 140 to 1780, y 90 to 990.
- **Color meaning.** Blue for the main quantity, yellow for the thing that
  matters most or the new thing, red for problems, costs and warnings, grey
  (`muted`, `gray`) for context and comparisons, white outlines for
  neutral containers, cream (`paper`) for documents.
- **Type.** Small uppercase mono labels (`s.kai.label`, 24 to 28 px) name
  things. Words and numerals use the display font. Big numerals are 110 to
  170 px. Body text is rare: quotes go on evidence cards.
- **Evidence.** Every important claim from a source gets an evidence card
  with the exact quote, the key phrase marked in yellow, and a source chip.
  Keep quotes short (one or two sentences).
- **Stamps** (`s.kai.stamp`) are the narrator's verdict: one per scene at
  most, at the end.
- **Recurring scenes.** The chapter bar at chapter starts; the same numbers
  in the same colors whenever they come back.

## The kit: `s.kai`

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

## Checklist

1. Research and keep `sources/SOURCES.md` with URLs and the exact quotes.
2. Write `script.md` with the rules above; `voice`; fix unconfirmed words.
3. `scenes.js`; `check` until there are no errors.
4. `still` and `sheet --scene <id>` to see the build up; compare with the
   look you want.
5. `render --draft`, look, `render`, `verify`.
6. Thumbnail: dark background, one big claim in display type, one yellow or
   blue numeral, one object drawing. No faces, no watermark.
