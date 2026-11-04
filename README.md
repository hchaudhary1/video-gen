# Video generation from a harness

Use this repository from T3 Code or another agent harness. Agents research, write and author the picture;
the CLI handles measured timing, media operations, review evidence and delivery. There is no supported
application UI. Start with [AGENTS.md](AGENTS.md), the skills in `skills/` and the
[profile index](personalities/README.md).

## Production routes

| Profile | Makes | Engine and lifecycle |
|---|---|---|
| [rules-story](personalities/rules-story/PROFILE.md) | Series horror: a 5–8 minute video plus 1–3 vertical Shorts | HyperFrames scenes, Ming narration, synthesized sound; tracked by `project-new` → `next` → `status` |
| [kai-explainer](personalities/kai-explainer/PROFILE.md) | Long-form (8–12 minute) first-person tech/AI explainers | The vendored [explainroo](engines/explainroo/VENDORED.md) engine, Kokoro narration; follows its own profile checklist |
| [cnbc-commentary](personalities/cnbc-commentary/PROFILE.md) | Chaptered CNBC excerpts plus original finance commentary | ExplainRoo Midnight, authored motion design and selective B-roll |

All routes finish the same way: a thumbnail at the video's dimensions, then an unlisted upload to abdupdates with
`youtube-upload --thumbnail` (see [publishing](docs/publishing.md)).

### Horror (rules-story)

Every film belongs to a series identity (`personalities/rules-story/identities/`: Night Office, Lost & Found,
Household Safety Bureau, Quiet Line, or a new one). The identity fixes the narrator, overlay label and file
number, twist, sign-off and sound signature. The profile locks the series frame (opening formula, rule cards,
case-file overlay, sentence captions, sound signature, ending, high contrast on black, a new picture about
every sentence); the story and everything inside the scenes are the agent's.

```bash
# Save the agreed brief to jobs/scripts/<slug>/BRIEF.md first
npm run video -- project-new --name <slug> --profile rules-story --tts ming
npm run video -- identity-continue --id <identity> --project <slug>     # a Short adds --parent <long slug>
npm run video -- next --project <slug>                                  # repeat; it prints each step
npm run video -- synth --job jobs/<slug> --identity <identity>          # bed, ident sting and effects as WAVs
npm run video -- series-kit --job jobs/<slug>                           # overlay, captions, rule/exhibit cards
```

`next` covers research, script and independent script review, Ming narration, scene authoring, independent
film review, render, delivery and thumbnails. Use `status --project <slug> --json` for saved state and
`watch --project <slug>` for a read-only review page; share only the URL it prints. Films set
`"mix": {"targetLufs": -15}` in film.json.

### Kai explainers (kai-explainer)

Projects live in `engines/explainroo/videos/<slug>/` and are run through `npm run video -- explainroo ...`,
which keeps the engine's caches under `.cache/explainroo`. `project-new --profile kai-explainer` stops with a
pointer to the profile, which lists the steps:

```bash
npm run video -- explainroo init videos/<slug> --template kai --title "..."
npm run video -- explainroo voice videos/<slug>
npm run video -- explainroo check videos/<slug>      # then still / sheet, and inspect the images
npm run video -- explainroo render videos/<slug>
npm run video -- explainroo verify videos/<slug>
```

The agent writes `script.md` (first person for the true research journey only, every claim sourced) and
`scenes.js` with the Kai drawing kit (`s.kai`). Independent script and film review are commissioned by the
host. Output: `out/video.mp4` with subtitles, chapters and a cover image.

### CNBC commentary (cnbc-commentary)

Follow the [CNBC profile](personalities/cnbc-commentary/PROFILE.md) for sourcing, measured
content ratios, ExplainRoo Midnight motion design, thumbnails and publishing.

## Setup

Use Node.js 22+, npm, FFmpeg/FFprobe, Python 3.12 with venv support, git, uv and Chrome. Sign in to the
agent provider through your harness. Keep generated assets and tool environments inside this checkout.

```bash
npm ci
# Setup-time exception: install the browser pinned by HyperFrames.
npx --no-install hyperframes browser ensure
npm run video -- tts --setup-ming
# Optional music analysis environment:
npm run video -- setup-audio
# Kai explainers: the engine's own dependencies and speech models (~400 MB, once)
(cd engines/explainroo && npm ci)
npm run video -- explainroo doctor --fetch
npm test
npm run video -- help
```

The pinned transcription environment is installed by uv on first use. Ming downloads its model at setup
and then generates locally. No narration API key is needed for either pipeline. Optional existing library
assets can be copied into `library/`; they are not required. [Library reuse](library/README.md) describes
versioned assets.

## References

Read the relevant contract, not the whole folder.

| Document | Needed for |
|---|---|
| [orchestrator](docs/orchestrator.md) | Harness handoffs, checkpoints, completion and the pipeline flowchart |
| [pipeline](docs/pipeline.html) | Standalone visual map of the horror production pipeline |
| [composition](docs/composition.md) | Native HyperFrames integration, the series kit and build failures |
| [Motion Explainer](docs/motion-explainer.md) | Camera/motion references and Canvas animation for rules-story scenes |
| [audio](docs/audio.md) | Ming generation, synthesized beds/effects and identity sound, mixing and loudness |
| [review](docs/review.md) | Evidence-bound independent/user review and concrete findings |
| [publishing](docs/publishing.md) | Thumbnail contract and authorised unlisted YouTube upload with thumbnails |
| [explainroo engine](engines/explainroo/VENDORED.md) | The vendored explainroo copy: base revision, local changes, upgrading |

Editorial intent lives in one [PROFILE.md per treatment](personalities/README.md). Assignments contain paths
and task data; there is no prompt-file catalog or injected role-coaching package.

## Code responsibilities

The modules own concrete operational contracts; their source is not required agent context.

| Modules | Responsibility |
|---|---|
| `project`, `film` | Project state, production lifecycle and data-only assignments |
| `personalities` | Treatment selection and retained project intent |
| `identities`, `series` | Series identities and file numbers; installing the series kit and its data |
| `composition`, `timing` | Small scene manifest and measured narration cues |
| `native` | Actual HyperFrames assembly, browser inspection and lint attribution |
| `media`, `assets` | Media settings/probing, local caches, provenance and optional reuse |
| `narration`, `audio`, `sound-design` | Ming worker safeguards, synthesized sound, soundtrack mixing and encoded audio verification |
| `pixels` | Encoded frame checks and frame-use statistics |
| `review`, `review-pack` | Independent/user decisions and frozen inspection evidence |
| `watch` | Read-only review overview, playback and media serving |
| `thumbnails`, `youtube-upload` | Packaging/selection and resumable authorised upload with custom thumbnails |
| `engines/explainroo` | The explainer/commentary engine (MIT, vendored as plain files); its audio core also drives horror sound |

## Local configuration and artifacts

`video.config.json` sets canvas/frame-rate defaults; `chat.config.json` holds harness/provider model choices.
Explicit user settings win. Horror jobs live in `jobs/<slug>/`, their scripts/sources in `jobs/scripts/<slug>/`;
ExplainRoo projects in `engines/explainroo/videos/<slug>/`; local tools and models in `.cache/`. These artifacts are
ignored by Git. Never put credentials in briefs.

`VG_CACHE` may choose a cache under repository `.cache/`. `CHROME_PATH` selects an installed browser.
`VG_ALLOW_WEB_IMAGES=1` permits raster downloads. `VG_RENDER_READY_MS` gives slow machines longer to load a
scene. YouTube uses OAuth credentials under `.cache/`, described in publishing.md. Horror narration is Ming
only; a supplied recording always takes priority.

Tests exercise actual native rendering, media integrity, sound design, review and harness state
(`npm test`; the engine has its own suite in `engines/explainroo`). They do not establish the creative quality
of a finished film. Judge that through actual viewer evidence.
