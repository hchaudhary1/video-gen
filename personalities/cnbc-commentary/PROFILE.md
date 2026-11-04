# cnbc-commentary

A 8–14 minute finance commentary video modelled on the Finance Deep Dive channel
(youtube.com/@Financedeepdive-x1n): chaptered CNBC clips of a famous market voice first, then our own
explainroo commentary on what was said. **CNBC excerpts must occupy 30–40% of the measured runtime, aiming near 40%, with 60–70% original commentary**; this
is measured and enforced by `npm run video -- cnbc assemble`/`cnbc ratio` (ffprobe on every part and the
final file), never estimated.

This is produced with the vendored ExplainRoo engine, not `project-new`. Use its built-in
**Midnight** look adapted to a consistent white background; do not use Kai or the kai-explainer template.
Read `engines/explainroo/AGENTS.md` for the commentary API.
Read [MOTION-DESIGN.md](MOTION-DESIGN.md) before visual planning and include it in film-review briefs.
Paths below are relative to the repository; `<slug>` is the project under `engines/explainroo/videos/`.

## Source footage

The CNBC recorder runs on this machine as the Docker container `cnbc-recorder`
(`~/cnbc-daily-recorder`, HTTPS UI on port 5000, compose file in `ops/`). It records 30 minutes at
12:00 (Halftime Report), 15:00 (Closing Bell), 16:00 (Closing Bell Overtime), 17:00 (Fast Money) and
18:00 (Mad Money) ET on weekdays into `~/cnbc-daily-recorder/recordings/` and keeps the newest 20.
Recordings are read in place and never modified; the tools record each file's SHA-256.

The user authorised clipping these recordings for commentary videos. That is an editorial-policy
basis (short excerpts, attributed, outweighed by original commentary), not a legal determination of
fair use; say so when reporting, and never claim a licence or permission from CNBC.

## Production

1. `npm run video -- cnbc latest` and choose the recording (default: newest; Mad Money and Closing Bell
   tend to carry the most quotable personalities). Weekend runs use Friday's shows.
2. Create `engines/explainroo/videos/<slug>/video.json` with
   `{"title":"...","theme":"midnight","voice":"am_michael","size":"16:9","fps":30}`.
   Run `npm run video -- cnbc style --project <slug>` to install the news look, motion primitives
   and actual Inter 800/900 fonts. Author `script.md` and `scenes.js` for this story in step 6;
   no engine template is required.
3. `npm run video -- cnbc transcribe --project <slug> [--recording <file>]` writes `cnbc/source.json`,
   measured `cnbc/transcript-words.json` and readable `cnbc/transcript.txt`.
4. Pick the story: one famous person (Jim Cramer, Tom Lee, Dan Ives, Jensen Huang, a CEO guest...) or
   company/market moment. Write `cnbc/clips.json`:
   `{"person": "Jim Cramer", "clips": [{"id": "ai-risk", "chapter": "Cramer's biggest AI risk", "in": 812.4, "out": 861.0, "speaker": "Jim Cramer"}]}`.
   3–6 clips, each ≥ 10 s (a YouTube chapter), cut on word gaps (the tool rejects mid-word cuts), with
   chapter titles phrased as the reference does ("Is AI investment generating returns?"). Plan the excerpts for 30–40% of the finished runtime, aiming near 40%; budget the commentary for the remaining 60–70%. Check every quotation against the audio
   rather than trusting ASR.
5. `npm run video -- cnbc cut --project <slug>` → `cnbc/clips/<id>.mp4` (1920×1080, 30 fps, 48 kHz,
   "Source: CNBC <show>, <date>" credit burned in).
6. Commentary with ExplainRoo (Midnight-derived news look, `script.md` + `scenes.js`): Follow the finance narration rules below. React to each clip in order, add
   context with dated, sourced facts (`sources/SOURCES.md`), separate what was said from our opinion,
   and end with what it means for investors plus a not-financial-advice line. Name chapters in scenes so
   explainroo writes `out/video.chapters.txt`. Its duration must exceed the clips' total. Then
   `explainroo voice`, `check`, representative temporal `still`/`sheet` sequences and rendered excerpts,
   then `render` and `verify` using the engine commands.
7. `npm run video -- cnbc assemble --project <slug>` → `cnbc/final.mp4` (clips first, then commentary),
   `cnbc/chapters.txt` (one chapter per clip, then the commentary chapters) and `cnbc/ratio.json`. It exits
   non-zero unless CNBC occupies 30–40% of measured runtime. Adjust substantive excerpts or commentary to meet that range; never pad with silence. Run `cnbc verify --project <slug>` after the commentary engine’s `verify`; it checks final-file signal, format and the saved commentary speech report.
8. Thumbnail (1920×1080 JPEG < 2 MB), copied from the reference: black field, **2–3 words** in huge
   uppercase heavy type (last line accented yellow or red), the famous person's head-and-shoulders on the
   other side. Get the person from the recording (`cnbc frame --project <slug> --at <sec>`) or a
   Wikimedia Commons photo with its licence noted in `sources/SOURCES.md`; isolate them onto pure black
   (image edit), never generate a likeness from scratch. Then
   `npm run video -- cnbc thumb --project <slug> --words "SOUNDS THE|ALARM" --person <image> --accent yellow`
   (`|` breaks lines; the word count is enforced). Words come from the story, e.g. "BUY THE DIP",
   "BIG TSUNAMI COMING", "CRAMER SOUNDS ALARM". Inspect the result.
9. Title: name-drop the person, company or "Stock Market" up front, reference-style:
   "Jim Cramer Sounds the Alarm on NVIDIA's AI Boom!", "Tom Lee Says This Sell-Off Looks Like 1997".
   Punchy, ≤ 70 characters, and true to what was actually said. Description: 2–3 sentence summary
   naming the person, `cnbc/chapters.txt`, sources, 4–6 hashtags, the CNBC credit and a not-financial-advice
   disclaimer. Then `npm run video -- cnbc publish-check --project <slug> --title "..." --person "Jim Cramer"`.
10. Independent script and film review (script against sources and the clip quotes; film review of
    temporal sequences, rendered excerpts, thumbnail and the clip/commentary transitions). Include
    `MOTION-DESIGN.md` in the brief; evaluate its visual direction as a requirement of the brief.
    Producers do not review their own work.
11. Deliver: `npm run video -- youtube-upload --file engines/explainroo/videos/<slug>/cnbc/final.mp4 --title ...
    --description ... --thumbnail engines/explainroo/videos/<slug>/cnbc/thumbs/thumbnail.jpg --privacy unlisted`,
    following `docs/publishing.md`.

Disclose what was not checked, for example that the narration or clip audio was not listened to.

## Finance narration

Open directly with the market issue and our opinion. Explain what the viewer needs to know, why it matters, and what evidence supports the view. Start with the actual story rather than a hypothetical scenario.

Avoid invented scenarios, assumed portfolios and made-up company or cash-flow examples, so narration needs no “this is hypothetical” or “we are assuming” disclaimers. Use sourced real examples and direct analysis instead. State opinions as opinions, retain material uncertainty, and never present invented figures or assumptions as reported facts. Keep production and research-process commentary out of the narration.

## Original-content evidence

Before assembly run `cnbc narration-evidence --project <slug>` after the final commentary render.
It binds the current script, timeline, narration files and commentary render by SHA-256, measures
non-silent narration using ffmpeg. Keep reused-media provenance in the source ledger.
The ratio gate also requires this measured narration to exceed half the final runtime. This
establishes duration and file identity, not semantic originality: independently review the script
against source quotations and retain a media ledger. Reused footage does not count as original imagery.
