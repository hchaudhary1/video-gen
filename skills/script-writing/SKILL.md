---
name: script-writing
description: Research, write or review narration scripts and concise visual intent for this video pipeline.
---

For both Archon treatments, follow `docs/production.md` and the saved editorial profile.
Complete only your assigned author or independent reviewer node. Archon owns production
progression and human attention checkpoints. Use direct domain adapters and libraries.

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
Read only the reference relevant to your role. The writer can request missing evidence in
`research.md` under `## Evidence requests` and reply `NEEDS SOURCES` for the host to resolve.

`node skills/script-writing/scripts/fetch.mjs <url> <output.md>` can retain source text. Estimate
speaking duration from word count when useful, then measure the actual generated recording.

The host commissions independent script review. Report what you produced, word count, duration estimate,
review status and any unresolved evidence. A self-check is not independent review.

## Developing a concept

When inventing a premise, hook or treatment, or improving a predictable idea, use
[concept development](references/concept-development.md). Apply the selected personality's guidance
and retain useful decisions in existing project artifacts. This is optional ideation support, not a
new deliverable or approval gate; do not reopen approved narration without a rewrite request.
