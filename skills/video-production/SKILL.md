---
name: video-production
description: Produce or continue a video in this repository, including its review, thumbnail and delivery.
---

Use the user's brief as the creative authority. Choose an approach that serves the audience and material;
there is no required visual metaphor, scene count, cut rate, motion vocabulary or sound-effect quota.

For technical/AI explainers, read `docs/kai-hooks-and-thumbnails.md` when choosing the title,
thumbnail wording, hook and narration. This writing brief does not change the profile's visual style.

The CLI tracks production state: `npm run video -- help`, `status`, and `next --project <slug>`
(or `next --job jobs/<slug>` after preparation). Use explicit project/job names. Completed artifacts
and user decisions determine what remains; avoid regenerating completed work without a reason.
`docs/orchestrator.md` describes the command and handoff contract.

Choose an explicit project slug and pass `--name <slug>`. Select the treatment yourself and pass
`--profile <id>` for new productions; the CLI does not infer treatment or rename collisions.
Choose the appropriate profile from `personalities/README.md`; load only that profile.
A profile describes editorial intent, not an implementation recipe. Agents may improve the visual approach
as they build. Preserve the requested treatment, factual meaning, recording and measured timing.

Keep research, narration and production in the project folders. `skills/script-writing/SKILL.md` covers
script outputs. Use `docs/audio.md` only when generating narration; supplied recordings remain intact.
Ming narration uses one invocation and a shared acoustic reference through `scripts/ming_continuity.py`.

The rules-story personality uses the full Motion Explainer reference during visual planning, following
`docs/motion-explainer.md`; apply its camera, editing and motion graphics vocabulary across the film
while preserving the profile's purpose. kai-explainer is produced by the vendored engine instead
(`npm run video -- explainroo ...`); follow its PROFILE.md.

Author the picture directly in HyperFrames using `skills/hyperframes/SKILL.md`. Bring in local assets
with recorded sources. Reuse library assets when they fit; creating a better asset is equally valid.
Music and effects are optional. `docs/audio.md` covers the pipeline mix when needed.

Use build and image/playback inspection to improve the actual film. Automated checks establish technical
facts, not audience engagement. Review should identify concrete problems and their effects on the viewer;
it should not reward compliance with a design template. Keep independent reviews and requested human
checkpoints truthful. Report unresolved findings and unavailable inspection capabilities at delivery.

Missing media or rights require a specific blocker rather than invented footage. Finish the thumbnail and publishing steps in the runbook.

The CLI returns assignment facts inline; the host writes any delegation prompt itself. Include the
job/project folder, saved profile, relevant contract, scope, inputs, expected outputs and findings.
For review, include the role, frozen pack path and hash, prior decisions, and independence requirement.
Research video ideas directly with evidence; retain any idea ledger in the project folder.
