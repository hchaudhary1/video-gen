Write the script for `$INPUTS.project` in `jobs/scripts/$INPUTS.project/`.

This is an argued Kai take, not a neutral explainer. Read sections 2 and 3 of
`references/kai-take.md` in the script-writing skill and the voice references in
`.agents/skills/script-writing/references/kai-voice/` (style only, never sources), then `BRIEF.md`, `SOURCES.md`, the take
dossier `sources/ANALYSIS.md` and the evidence in `sources/`. Before any narration, commit to one
take and record it in `research.md` under `## Take` (thesis, stance, why, steelman, what would
change my mind, gap). Then write the script that argues it as a conversation with the viewer, not a lecture:

1. Read the voice references aloud in your head and notice how they walk in from the viewer's
   world, tell facts as "X says Y" followed by a reaction, and flow in paragraphs.
2. Choose the one mechanism the evidence can carry on a single basis (section 3, "Choose one
   mechanism"), and the two or three cases you will tell as small stories.
3. Draft the whole narration as continuous spoken prose, with no headings or markers: an
   opening from the viewer's world, the question people asked online and their guesses, the
   short answer (thesis) within 30–45 seconds, the mechanism walked step by step while answering
   those voices, a fair steelman answered with evidence, the opening questions answered in
   order, the verdict with who should act, and a closing line that compresses the take.
4. Revise the draft against the robotic patterns in section 3 until no passage sounds like a
   briefing. Compare one paragraph of yours with one from a voice reference; if yours is colder,
   choppier or stiffer, rewrite it.
5. Divide the prose into about 10–16 scenes at natural turns and add a few markers at real
   visual beats, without changing or splitting sentences.
6. Read `.agents/skills/unslop/SKILL.md` and apply it to the narration as a final edit pass.

Produce substantive `SCRIPT.md`, `research.md` and `VISUALS.md`. Every factual claim must rest on
those sources; opinions are judgments of that evidence, never invented experience. Kai narration
uses explainroo scene headings: every spoken line, including the opening hook, sits under a
`## scene-id` heading, using the narration and marker syntax in `engines/explainroo/AGENTS.md`.
Size the script to the brief's duration at about 170 words per minute.

- Supplied script: $script-state.output.artifacts.supplied. Revision allowed: $script-state.output.artifacts.canRevise.
  When a script was supplied and revision is not allowed, keep `SCRIPT.md` byte-for-byte
  and only add the missing research, take and visual intent.
- Operator decision on the previous draft (null on a first draft):
  $script-state.output.artifacts.feedback
  A requested revision permits only the changes it asks for.

Finish when `node scripts/archon/kai-explainer.mjs script-status $INPUTS.project` reports no errors.
