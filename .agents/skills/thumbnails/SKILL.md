---
name: thumbnails
description: Make, independently review or fix a job's thumbnail variants with lib/thumbnails.mjs (editable SVG, PNG at video size, feed preview, BRIEF.md).
---

# Thumbnails

A job's variants live in `jobs/<slug>/thumbnail/variants/<v1..vN>/`. Call the library from
the repository root, with `job = 'jobs/<slug>'`:

```js
import * as t from './lib/thumbnails.mjs';
await t.thumbnailStatus(job)   // count, each variant's files, made, pngError, review, openFeedback
await t.thumbnailDimensions(job)  // {width, height, previewFile, orientation}
await t.exportThumbnail(job, 'v1')  // thumbnail.svg -> thumbnail.png + feed preview
await t.recordVerdict(job, {variant, status: 'pass' | 'blocked', findings: ['...'], inspected: ['<png paths>'], reviewer})
await t.recordRanking(job, ['v2', 'v1'])   // after a verdict exists for each ranked variant
await t.addThumbnailFeedback(job, {variant, text, by: 'reviewer'})
```

## Making or fixing variants

Each variant folder holds `thumbnail.svg` (original, editable, the actual font embedded),
`BRIEF.md` (lines `Title:`, `Headline:`, `Description:`) and the exported PNG and preview.
Compose for the video's own canvas from `thumbnailDimensions`; the SVG aspect ratio must
match it. Give each variant a different angle so the choice is real. Use heavy type from
`node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2` embedded in the SVG;
do not search the web for fonts. Claims must be supported by the film and
its sources. Keep each PNG under 2 MB. Preserve unchanged variants that passed; remake
only those with open feedback or findings. Do not review your own variants.

Kai packaging guidance: `engines/explainroo/templates/kai/TEMPLATE.md` ("Thumbnails") and
`docs/kai-hooks-and-thumbnails.md`. Rules-story: the title shape and palette in the profile
(`files["PROFILE.md"]` of `jobs/scripts/<slug>/production-profile.json`).


## Reviewing variants

Open every made `thumbnail.png` and its feed preview with your image-viewing tool. Record a
verdict per variant with the PNGs you opened as `inspected`; a blocked verdict needs findings,
and each actionable finding also goes in as `addThumbnailFeedback(..., by: 'reviewer')`.
Rank only the variants that currently pass. Claim no CTR or audience measurements. If you
cannot view images, record `blocked` with that limitation; never invent a pass.
