# cnbc-commentary

A 8–14 minute finance commentary video modelled on the Finance Deep Dive channel
(youtube.com/@Financedeepdive-x1n): chaptered CNBC clips of a famous market voice first, then our own
explainroo commentary on what was said. **More than 50% of the runtime must be our own content**; this
is measured and enforced by `npm run video -- cnbc assemble`/`cnbc ratio` (ffprobe on every part and the
final file), never estimated.

Like kai-explainer, this is produced with the vendored explainroo engine, not `project-new`. Read
`engines/explainroo/AGENTS.md` and `engines/explainroo/templates/kai/TEMPLATE.md` for the commentary.
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
2. `npm run video -- explainroo init videos/<slug> --template kai --title "..."`.
3. `npm run video -- cnbc transcribe --project <slug> [--recording <file>]` writes `cnbc/source.json`,
   measured `cnbc/transcript-words.json` and readable `cnbc/transcript.txt`.
4. Pick the story: one famous person (Jim Cramer, Tom Lee, Dan Ives, Jensen Huang, a CEO guest...) or
   company/market moment. Write `cnbc/clips.json`:
   `{"person": "Jim Cramer", "clips": [{"id": "ai-risk", "chapter": "Cramer's biggest AI risk", "in": 812.4, "out": 861.0, "speaker": "Jim Cramer"}]}`.
   3–6 clips, each ≥ 10 s (a YouTube chapter), cut on word gaps (the tool rejects mid-word cuts), with
   chapter titles phrased as the reference does ("Is AI investment generating returns?"). Keep the
   clips together under roughly 40% of the planned runtime. Check every quotation against the audio
   rather than trusting ASR.
5. `npm run video -- cnbc cut --project <slug>` → `cnbc/clips/<id>.mp4` (1920×1080, 30 fps, 48 kHz,
   "Source: CNBC <show>, <date>" credit burned in).
6. Commentary with explainroo (kai template, `script.md` + `scenes.js`): react to each clip in order, add
   context with dated, sourced facts (`sources/SOURCES.md`), separate what was said from our opinion,
   and end with what it means for investors plus a not-financial-advice line. Name chapters in scenes so
   explainroo writes `out/video.chapters.txt`. Its duration must exceed the clips' total. Then
   `explainroo voice`, `check`, `still`/`sheet`, `render`, `verify` as in the kai-explainer profile.
7. `npm run video -- cnbc assemble --project <slug>` → `cnbc/final.mp4` (clips first, then commentary),
   `cnbc/chapters.txt` (one chapter per clip, then the commentary chapters) and `cnbc/ratio.json`. It exits
   non-zero when own content is not > 50%; lengthen the commentary or trim clips, never pad with silence.
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
10. Independent review as in kai-explainer (script against sources and the clip quotes; film review of
    stills, thumbnail and the clip/commentary transitions). Producers do not review their own work.
11. Deliver: `npm run video -- youtube-upload --file engines/explainroo/videos/<slug>/cnbc/final.mp4 --title ...
    --description ... --thumbnail engines/explainroo/videos/<slug>/cnbc/thumbs/thumbnail.jpg --privacy unlisted`,
    following `docs/publishing.md`.

Disclose what was not checked, for example that the narration or clip audio was not listened to.
