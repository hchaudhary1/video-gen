---
name: script-writing
description: Research, write or review narration scripts and concise visual intent for this video pipeline.
---

The treatment's editorial direction is `files["PROFILE.md"]` in
`jobs/scripts/<slug>/production-profile.json`, frozen when the run started.

Write for the audience, purpose and duration in the brief. Choose the structure and voice that serve the
material; openings, narrative arcs, sentence patterns and revision passes have no prescribed template.
A duration estimated from words is not a measured recording duration.

Project outputs live in `jobs/scripts/<slug>/`:
- `SCRIPT.md`: approved narration; rules-story uses spoken prose, while Kai uses explainroo scene headings and its documented narration/marker syntax.
- `SOURCES.md` and `sources/`: source index and retained evidence for factual claims.
- `research.md`: material evidence, uncertainty and decisions worth handing off.
- `VISUALS.md`: concise visual intent and any assets or moments important to meaning. Free-form notes
  are sufficient; the director can develop or improve them during production.

Preserve user-supplied wording unless asked to rewrite it. Separate reported facts, interpretation,
fiction and creator experience. Sources do not become the narrator's personal experiences. Prefer primary
evidence for material claims; disclose what could not be verified.

Research assignments: `references/sourcing.md`. Independent review assignments: `references/review.md`.
A node that asks for an argued Kai take also names its section of `references/kai-take.md`
(research dossier, stance, house voice, review of the take). Read only the reference relevant to your role. The writer can request missing evidence in
`research.md` under `## Evidence requests` and reply `NEEDS SOURCES` for the host to resolve.

`node .agents/skills/script-writing/scripts/fetch.mjs <url> <output.md>` can retain source text.
`scripts/social.mjs` retains Reddit and Hacker News discussion; run it without arguments for usage. Estimate
speaking duration from word count when useful, then measure the actual generated recording.
When the measured take misses the brief's target by more than 20% (minimum 2 s), the
narration goes back for one resize and then continues at whatever length it measures, so
size the script to the target, not to the brief's outer range. The default
Kokoro voice is slower than conversational speech: the RIDAR film measured about 1,228
spoken words at 522 s (about 141 words per minute), while reviewers had estimated 150–165.
Plan on roughly 140 words per minute, about 2.35 words per second of target, and leave margin.

Script review is done by a separate, independent reviewer. A self-check is not independent review.

## Developing a concept

When inventing a premise, hook or treatment, or improving a predictable idea, use
[concept development](references/concept-development.md). Apply the selected personality's guidance
and retain useful decisions in existing project artifacts. This is optional ideation support, not a
new deliverable or approval gate; do not reopen approved narration without a rewrite request.
