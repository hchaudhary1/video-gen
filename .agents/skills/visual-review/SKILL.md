---
name: visual-review
description: Perform the one independent visual review of a built film from its frozen evidence pack and submit the report with lib/review.mjs submitReview.
---

# Independent visual review

You review; you never edit production files. The film's author gets exactly one revision
from your report and there is no second review, so record every material finding now.

## Evidence

The frozen pack is `jobs/<slug>/review/final/pack.json`. It lists the evidence paths
(frames, contact sheets, clips), the `interval` and the hashes your report must echo.
Open the PNG/JPEG evidence with your image-viewing tool. Listing filenames or reading
them in a shell is not viewing. Inspect the temporal sheets for every scene and the
scene-end frames. Record only the intervals you actually inspected; still frames do not
establish motion quality, so disclose that limitation. If a viewing tool fails, keep the
error and try another local image tool before declaring inspection unavailable.

Write `initialObservation` (what the pictures explain on their own) before you read the
script or intended narrative. Then judge mechanism, continuity and legibility against
the treatment in `files["PROFILE.md"]` of `jobs/scripts/<slug>/production-profile.json`
and the editorial judgment section of `docs/review.md`.

## Report

Submit once, from the repository root:

```js
import {submitReview} from './lib/review.mjs';
await submitReview('jobs/<slug>', report);
```

`submitReview` validates the report and throws a list of every problem; fix them all
and submit again. Shape:

```js
{
  version: 1, stage: 'final', role: 'visual-review',
  sourceHash, videoSha256, packSha256,          // copy from pack.json (videoSha256 may be null)
  reviewer: {agentId: '<id given in your assignment>', independent: true},
  inspection: {mode: 'frame-sequence' | 'playback' | 'mixed', visual: 'viewed' | 'unavailable',
               evidence: ['<pack paths you opened>'], limitations: ['<non-empty strings>']},
  coverage: [{start, end}],                     // seconds within pack.interval
  initialObservation: '...',
  verdict: 'pass' | 'revise' | 'incomplete',
  findings: [{id, severity: 'blocking' | 'advisory', start, end, subject, requirement,
              observed, repair, evidence: ['<pack paths>'],
              category: 'readability' | 'truth' | 'mechanism' | 'style' | 'evidence',
              scope: 'scene' | 'plan' | 'evidence', sceneIds: ['<scene-id>']}],
  priorFindingResponses: [{sourceHash, findingId, disposition, reason}]   // only for prior blockers
}
```

A pass needs viewed evidence, full coverage of the interval and no blocking finding.
Unavailable inspection is `incomplete`, never `pass`. Taste is advisory; a blocking
finding names the timestamp, the observed defect and its effect on the viewer.
