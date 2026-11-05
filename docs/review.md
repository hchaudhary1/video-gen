# Evidence-bound independent review

Archon schedules author and independent reviewer nodes. Register each producing execution
identity before media edits. The `visual-mechanism` and `continuity-legibility` roles
run in distinct fresh contexts and inspect the entire frozen interval, including
intermediate states, handoffs and ending. Producers never edit reviewer verdicts.

Rules-story freezes the built native composition. Kai freezes actual stills, temporal
sheets, measured timeline, narration files and a playable review draft. Pack hashes bind
sources and every evidence file. Changed evidence or source requires a new review.
Missing inspection is an explicit blocker. Speech verification is measured separately
by each media engine and cannot establish listening or naturalness.

## Report contract

Authors read findings from both roles together. Reviewers submit JSON directly with
`submitReview(job, report)` from `lib/review.mjs`; the library validates identity,
source/pack/video hashes, coverage, evidence paths and prior-finding responses.

A report includes `version: 1`, `stage: "final"`, the assigned `role`, `sourceHash`,
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
visual inspection requires `incomplete`, never pass.

Read review history. Respond to prior blockers with `priorFindingResponses`: sourceHash,
findingId, resolved/unresolved/disputed disposition and an evidence-based reason. Retain
IDs for unresolved defects. Repair describes an outcome, not a forced implementation.

Creative-review budget exhaustion can retain disclosed non-readability findings only
after both complete independent inspections. Missing/invalid evidence, readability and
mandatory technical checks cannot be bypassed by budget exhaustion or a waiver file.
User decisions are separate artifact-bound Archon attention records. Rejection stops;
revision returns through authorship and independent review before another checkpoint.

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
