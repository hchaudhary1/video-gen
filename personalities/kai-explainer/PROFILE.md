# kai-explainer

A long-form (default 8–12 minute) first-person tech/AI explainer told as a continuously moving
visual story. Be fully creative and visualize the narration through original drawings, acting
subjects and evolving mechanisms. Follow subjects and causal relationships across shots; scene
outcomes are moments in the story, not slides. A repeated title-at-top/content-below arrangement
or text-box explanation does not satisfy this treatment. Camera, composition and transitions are
free to follow the action. Keep the shared palette and heavy typography. Invent visual storytelling for the subject: follow actions into mechanisms, show their consequences,
and carry meaningful motion and causal relationships across shots.

The template's creative guidance is a starting steer. Adapt the narrative,
layouts, component choices and pacing to the subject while keeping the palette
and typography consistent. Write an original, human hook without a fixed opening
phrase. Retain the sourcing and honesty requirements.

This profile is scheduled exclusively by `archon workflow run kai-explainer`.
Read `docs/production.md`. Archon nodes directly import the vendored explainroo
media library; `engines/explainroo/VENDORED.md` records its provenance and local changes.

## Production contract

Research retains sources and evidence. The script node authors `jobs/scripts/<slug>/SCRIPT.md`
in explainroo scene syntax and `VISUALS.md` with concise visual intent. An independent
script reviewer checks sources and first-person honesty before requested script approval.
Narration uses Kokoro or the supplied recording, verifies scene speech and saves measured
timing. Preserve approved takes and supplied source bytes.

The director and scene author write `jobs/<slug>/scenes.js` against `build/timeline.json`.
Use the full Scene API in `engines/explainroo/AGENTS.md` and `templates/kai/TEMPLATE.md`.
Build checks, temporal sheets and actual stills feed independent full-film reviewers.
Demonstrated defects return through bounded repair rounds; requested user decisions are
artifact-bound Archon attention waits. Producers do not approve their own work.

Rendering produces the final MP4, subtitles, chapters and cover under `renders/`.
Final verification checks encoded dimensions, duration, speech, loudness and black frames.
Delivery preserves unresolved findings and inspection limitations. Create video-sized
thumbnails, independently review them, record selection when requested and obtain approved
publishing copy before unlisted upload to abdupdates unless opted out.

## Visual direction

Establish a focal subject and make each visual change explain a cause, mechanism or consequence.
Carry a meaningful object or action across scene boundaries when it helps the viewer follow the
explanation. Motivate camera movement by the information it reveals; a hold can give a mechanism
time to become clear. Plan within measured narration cues and the existing Scene API, keeping the
palette and actual loaded heavy fonts. These choices support original drawings, not a required
character-drama structure or AI-video prompt format.

Use [concept development](../../skills/script-writing/references/concept-development.md) when choosing
the question, hook or visual analogy. Check where each analogy breaks down so its staging and motion
do not imply a false technical relationship. Concept notes and self-checks do not replace independent
review. Visual-direction guidance is adapted from Serge Shima's Visual Skills;
[attribution and pinned sources](../../docs/creative-reference-sources.md).
