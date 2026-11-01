# kai-explainer

A long-form (default 8–12 minute) first-person explainer in the style of tech explainer channels: one locked
frame per scene that starts almost empty and builds to a single composed picture on the narration, then a hard
cut. Tuned for AI and tech (models, local AI hardware, costs, papers); usable for any explainer topic.

This profile is produced with the vendored explainroo engine in `engines/explainroo`, not with `project-new`
and HyperFrames. Read `engines/explainroo/AGENTS.md` (steps, checks, Scene API) and
`engines/explainroo/templates/kai/TEMPLATE.md`, whose narration rules replace explainroo's default ones.
`engines/explainroo/VENDORED.md` records the upstream revision and local changes.

## Production

Run every engine command through `npm run video -- explainroo <command> ...`; it keeps caches in `.cache/explainroo`.
Paths are relative to `engines/explainroo`. First use: `(cd engines/explainroo && npm ci)` then
`npm run video -- explainroo doctor --fetch`.

1. Research and keep evidence in the project: `sources/` with local copies and `sources/SOURCES.md` (URLs, quotes used).
2. `explainroo init videos/<slug> --template kai --title "..."` (defaults: camera still, cut transitions, Kokoro
   `am_michael`, quiet `calm` music, no watermark, 1920×1080).
3. Write `script.md` under the template's rules: first person for the true research journey only, never invented
   personal experience; hypotheticals clearly marked; every number and on-screen quote from a retained source.
4. `explainroo voice`, then plan and write `scenes.js` with `s.kai` and the Scene API; scenes of roughly 10–20 s.
5. `explainroo check` (fix all errors and warnings), `still`/`sheet` and inspect the images, `render --draft`,
   `render`, `verify`.
6. Independent review: the host commissions a script reviewer (claims against sources, first-person honesty) and a
   film reviewer who can view images (stills, sheets, layout, build-up behaviour). Producers do not review their work.
7. Thumbnail at 1920×1080 (PNG/JPEG under 2 MB) and publishing copy (title, description with sources and chapters
   from `out/video.chapters.txt`, tags).
8. Deliver with `npm run video -- youtube-upload --file engines/explainroo/videos/<slug>/out/video.mp4 --title ...
   --description ... --thumbnail <file> --privacy unlisted`, following `docs/publishing.md`.

`--profile kai-explainer` on `project-new` stops with a pointer to this file. The output is
`engines/explainroo/videos/<slug>/out/video.mp4` with `.srt`, `.vtt`, `.chapters.txt` and a cover image.
Disclose what was not checked, for example that the narration was not listened to.
