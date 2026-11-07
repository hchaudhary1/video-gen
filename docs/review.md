# Evidence-bound independent review

Archon runs an audio review after generation, then one independent visual review and one
revision for each film. Register producing identities before media edits. Producers never
write reviewer verdicts. Missing inspection is disclosed and cannot be labelled a pass.

## Audio review

The audio-evidence node records script/recording hashes, per-scene match rates and unconfirmed
words. The audio-review node applies a deterministic measured check, requiring unchanged files
and at least 90% speech coverage for every narrated scene. The audio-reviewed node validates
that receipt before visual work. Listening capability is not required. It writes `review/audio-review.json`. Unconfirmed individual
words above that threshold remain disclosed ASR uncertainty; they do not become a new visual
build failure. A first measurement below 90% routes to one fix before visual work: Kai respells
the weak scenes in the script and regenerates them; rules-story takes one new Ming narration and
re-times it, retaining the earlier take. The final measurement then accepts every scene at 50%
coverage or more with `accepted: true` and the gap disclosed; below 50% is treated as missing
speech and stops. Supplied recordings skip the fix and go straight to the final measurement.
The visual author never edits audio.

The report records findings, `mode: "measured"`, and the explicit limitation that audio was
not listened to. ASR is not listening, naturalness or proof of pronunciation. Encoded final-mix
integrity and speech checks remain separate technical requirements.

## One visual review, one revision

The workflow builds a draft and freezes a copy of its evidence. One fresh `visual-review`
agent inspects mechanism, continuity and legibility across the whole interval, then submits
one report. An author gets one revision using that report and the build findings. It writes
`review/revision-notes.md`, rebuilds, and records `review/visual-revision.json`. The workflow
then proceeds to rendering and delivery without another creative review.

The original evidence and verdict remain immutable. The revision receipt binds that report
to the new source hash and revision notes. The revision passes the review: delivery states
`reviewPassed: true` and `passed-after-revision`, lists the original blocking findings as
`addressedFindings` and keeps the reviewer's verdict as `reviewerVerdict`. The revised film is not
reviewed again. Source edits
after the recorded revision invalidate delivery. Technical build/render/media failures still
stop the run; creative warnings are reported rather than opening another review cycle.

## Report contract

The author reads the single visual report. Reviewers submit JSON directly with
`submitReview(job, report)` from `lib/review.mjs`; the library validates identity,
source/pack/video hashes, coverage, evidence paths and prior-finding responses.

A report includes `version: 1`, `stage: "final"`, `role: "visual-review"`, `sourceHash`,
`videoSha256` (null for a built-timeline pack), `packSha256`, `reviewer: {agentId,
independent: true}`, `inspection`, `coverage`, `initialObservation`, `verdict` and `findings`.
Use actual declared execution identities and actual inspection; no placeholder identities
or invented viewing/listening. `inspection` names mode, visual availability, inspected
frozen evidence paths and limitations. Coverage lists the intervals actually inspected.
The visual role records its initial observations before reading intended narrative.

Verdicts are `pass`, `revise` or `incomplete`. Every finding contains a stable `id`,
severity (`blocking` or `advisory`), numeric start/end seconds, subject, requirement,
observed defect, repair outcome and current evidence paths. Category is readability,
truth, mechanism, style or evidence; scope is scene, plan or evidence. `sceneIds` may
identify ownership. A pass requires full coverage and no blocking findings. Unavailable
visual inspection requires `incomplete`, never pass. When no complete report exists after one
retry, `review/visual-review-unavailable.json` records that and the single revision proceeds;
delivery discloses the missing inspection and reports `reviewPassed: false` (`revised-without-review`).

Read review history. Respond to prior blockers with `priorFindingResponses`: sourceHash,
findingId, resolved/unresolved/disputed disposition and an evidence-based reason. Retain
IDs for unresolved defects. Repair describes an outcome, not a forced implementation.

Human checkpoints are optional and separate from independent review. They bind to the
current revised source and retain the operator's actual response. A rejection stops the run.
A new requested creative pass requires a new run; there is no automatic second review loop.

## Editorial judgment

Judge the finished experience against the user's purpose and intended audience. The agent chooses the
structure, media, visual language and pacing. There is no mandatory opening, number of concepts, continuous
world, visual primitive, camera move, hold length or sound-effect quota.

A useful picture helps the viewer understand, feel or evaluate what the narration means. Depending on the
material, that can be a demonstration, real footage, a diagram, typography, a comparison or a deliberate hold.
An unusual choice needs evidence of a problem before it becomes a blocking finding.

Concrete defects include a misleading claim or illustration, unreadable presented text, missing relevant
source context, a broken transition, missing media, or a picture that materially contradicts the spoken
meaning or requested treatment. Explain the timestamp, observed defect and effect on the viewer.
Suggestions based on taste are advisory. Coherence matters; a prescribed palette or library does not.

For the kai-explainer treatment, apply the saved template's action-led scene guidance. Check whether
scenes develop toward meaningful final images or outcomes, with compositions and moving subjects that
express the script. Inspect intermediate states and scene boundaries, not just readable end frames.
A repeated heading/card layout with only entrance effects can be a demonstrated treatment mismatch,
not merely a preference for more motion. A recurring top title with information beneath it fails this
treatment even if the titles change and dots move between boxes. Sample unrelated timestamps and
inspect temporal sequences: look for drawn subjects performing the explanation and a causal story
carried across shots. Identify the specific passages and what action or relationship
is missing from the picture. Do not require a camera move, a custom primitive, a fixed number of
reveals or continuous motion in every shot; deliberate holds and stationary shots can serve the scene.

Inspect actual images or playback. Automated measurements and written plans are diagnostics, not proof of
quality. Disclose inspection limits. Still images do not establish motion quality; signal checks do not
establish that audio was heard.
