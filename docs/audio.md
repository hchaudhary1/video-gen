# Ming narration

Use only when the user has not supplied a recording. Keep the reviewed `SCRIPT.md` unchanged.
Ming runs locally with `US_James`.

Install once in this checkout:

```bash
npm run video -- tts --setup-ming
```

Setup needs git, ffmpeg and Python 3.12 with venv support. It downloads the pinned model/runtime into
`.cache/video-gen/ming/`. Generation then runs offline. `MING_SETUP_PYTHON` selects the setup
interpreter. All caches stay under the repository `.cache/`.

Generate the entire recording in one invocation:

```bash
npm run video -- tts jobs/scripts/<slug>/SCRIPT.md --narration --target-seconds 60 -s 1.0 -o jobs/scripts/<slug>/narration.wav
```

The adapter holds one neutral acoustic reference across every internal fragment and performance segment
through `scripts/ming_continuity.py`. Separate invocations would lose that shared reference. Output is
24 kHz mono WAV with 1.5 seconds of trailing silence. Measure the resulting duration before preparation.
Use the brief's target for `--target-seconds`, or omit it when length is open. The command measures the WAV
before replacing the prior take; the approved tolerance is 20% of the requested duration or 2 seconds, whichever
is larger, so a take at 48–72 seconds satisfies a 60-second request. An out-of-range take is kept as
`narration.rejected.wav` for diagnosis and marked failed in the status file.
`--duration-tolerance <seconds>` sets the accepted range explicitly. Generation completion establishes
neither speech fidelity nor natural delivery. A short take may have missing words; check that before
adjusting speed, pauses or script length. Do not stretch incomplete speech to meet a target.

Prepare generated speech with `start --full-script true` (the project handoff supplies this flag).
That compares the entire approved narration, including its opening and ending. The default excerpt
alignment is for supplied recordings: a 100% excerpt match can still omit most of a script.
ASR differences require checking the disputed passage against the audio or a second transcription;
they do not establish that Ming spoke different words. Keep the original script as the authority.

The adapter selects US_James for the reference, then uses that recording to condition ordinary TTS
fragments. Reapplying the IP instruction alongside the acoustic prompt can produce silent fragments;
the adapter avoids that combination and rejects effectively silent output.
Its bounded English fragments preserve punctuation; quotation marks stay with the spoken words rather
than becoming separate synthesis requests.

## Delivery sidecar

For controlled pacing, place `ming-performance.json` beside the script; it is loaded automatically.
`--performance <file>` selects an explicit file. Without a sidecar, a short script uses neutral delivery.

```json
{"segments":[
  {"text":"[Breathing] The exact reviewed words of the first thought group.","speed":1.0,"pauseAfter":0.3},
  {"text":"The exact remaining reviewed words.","speed":0.97,"pauseAfter":0}
]}
```

After supported cues are removed, segment text must match the reviewed narration in order, including
punctuation. Keep cues out of SCRIPT.md. Segments have a maximum of 150 words; split long narration into
natural thought groups. Segment speed is 0.9–1.15, combined with CLI speed 0.9–1.25; pauseAfter is 0–2 seconds.
`instruction` and `voiceInstruction` are unsupported. Choose pacing and cues for the meaning; no cue quota.

Supported inline vocal events, with exact spelling:
`[Breathing]`, `[Cough]`, `[Sigh]`, `[Laughter]`, `[Uhm]`, `[Surprise-ah]`, `[Surprise-oh]`,
`[Dissatisfaction-hnn]`, `[Confirmation-en]`, `[Question-ei]`, `[Question-ah]`, `[Question-en]`,
`[Question-oh]`, `[Question-huh]`. Arbitrary emotion tags are rejected.

## Status and recovery

`tts-status.json` reports queued, loading, generating, complete, failed or cancelled state. Jobs in this
checkout share a FIFO queue; a queued command is healthy. Wait for that invocation rather than launching
retries or changing voices. Stopping it cancels the worker; OS locks recover automatically after a crash.
The output file is replaced only after complete successful generation.

On failure, retain the script, sidecar, status and error for diagnosis. The adapter saves any available
partial audio as `narration.rejected.wav`; it is not an accepted take. On regeneration, rebuild alignment
and the film from the new WAV. Check pronunciation and joins by listening when available; measurements
alone do not establish that a voice sounds natural. Never regenerate a supplied recording.

## Pipeline soundtrack

Narration is fixed. Music and effects are optional creative choices; silence does not require justification.
The pipeline mixes the soundtrack and verifies the encoded MP4 against it. Audio tags in native scene HTML
are not imported into this mix.

## Effects

Place effects in film.json `sounds`:

```json
{"sounds":[{"src":"assets/effects/click.wav","at":{"phrase":"the exact spoken words"},"volume":0.1,"why":"The switch closes"}]}
```

`at` resolves against the measured narration. It can use `wordId`, `occurrence`, `edge` and `offset`.
`align` is `start` (default), `peak` or `end`. `volume` is a linear gain from 0 to 1. Keep the file local
under assets/ and record source/licence in `assets/SOURCES.json`. Use `asset` or the library tools to bring
in cleared files. Build measures effects against speech; fix masking rather than trusting a chosen gain.

## Music

`music --job <job> --src <url|file> --name music/<name>.mp3 --source <page> --license <licence>` imports
and analyses a track. `setup-audio` installs the local analysis environment when needed.

```json
{"music":{"src":"assets/music/track.mp3","source":"source page","license":"licence","trackStart":0,"filmStart":0}}
```

Optional fields: `level` and `duck` (dB), `fadeIn`/`fadeOut` (seconds). Beat analysis is available for
edits where it helps; narrated action does not have to hit every beat.

## Synthesized sound and series signatures

`lib/sound-design.mjs` renders beds and effects locally, deterministically from a seed, on the dependency-free
synth core of the vendored explainroo engine (MIT, `engines/explainroo/engine/audio/`). A test pins the hashes of
the five synth files the sound design uses, so an explainroo upgrade that changes them fails until someone checks that
the identity sound signatures still sound the same and updates the pinned hashes. It adds minor, phrygian, harmonic-minor and locrian harmony; drone beds (`dread`, `pulse`,
`music-box`, with an optional `hum`, `hiss` or `tick` texture); and effects: impact, boom, sub-drop,
reverse-swell, riser, heartbeat, creak, knock (count/interval), glitch, static, hum, tinnitus, stinger, tick
(count/interval) and the identity `ident` sting. `npm run video -- synth --list true` prints them.

```bash
npm run video -- synth --job jobs/<slug> --identity night-office          # the identity's whole kit
npm run video -- synth --job jobs/<slug> --effect knock --count 3 --interval 0.7 --name sfx/three-knocks.wav
npm run video -- synth --job jobs/<slug> --bed dread --duration 30 --key E --scale phrygian --name music/bed.wav
```

The files land under `assets/music/` and `assets/sfx/` with `assets/SOURCES.json` entries (generator, engine,
seed and parameters), so film.json `music` and `sounds` use them like any other cleared file and the masking
and loudness checks apply unchanged. A bed's first seconds do not depend on its length: every film of an
identity opens on the same samples. Series horror (rules-story) uses its identity's kit; see that profile.

## Mix loudness target

Without a `mix` block the master is one gain toward −16 LUFS, limited by the −4 dB peak ceiling. Narration
has a high crest factor, so a louder delivery needs peak control: `"mix": {"targetLufs": -15}` enables a
look-ahead limiter on the whole mix (at most `maxLimitDb`, default 6 dB) and raises the master toward the
target. `review/mix.json` records the limiter's ceiling, largest reduction and share of limited samples; the
narration bus itself is not processed separately. `"limiter": false` keeps a single gain.

Build writes `review/sounds.md`. Render writes `review/mix.json`, encoded verification and sound evidence.
The mix applies ducking and a master gain; loudness/peak targets are measured on the exported file. Inspect
masking findings and report measurement limits. Only claim listening when someone actually listened.

## Automatic speech verification (Parakeet v2)

Ming remains the only TTS generator. Generated candidates are verified before replacing the output;
failed candidates and a failed status are retained. Preparation independently recognizes the prepared
recording, including when supplied word timings exist. Final verification recognizes the encoded MP4
mix again. Supplied recordings and approved scripts are never rewritten to make a check pass.

All new ASR uses NVIDIA [Parakeet TDT 0.6B v2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2),
English only, locally through NeMo. Attribution: NVIDIA, model licensed CC-BY-4.0; the model is unmodified.
There is no Whisper or v3 fallback. Legacy jobs must rerun `transcribe` then `verify` to obtain current
receipts. Remeasured timing and changed sources invalidate earlier builds/reviews: rebuild,
review and render again when needed before verifying/delivering. Old non-English jobs cannot be
verified with this English model. Supplied word files are kept in inputs/supplied-words.json for
provenance; alignment uses newly measured Parakeet words.

Runtime setup: install ffmpeg and uv, then run from the repository:

```bash
UV_CACHE_DIR="$PWD/.cache/video-gen/uv" uv sync --script scripts/parakeet.py --locked
npm run video -- transcribe --job jobs/<slug>
npm run video -- verify --job jobs/<slug>
```

The pinned isolated runtime lock is scripts/parakeet.py.lock. The CLI keeps uv, Hugging Face,
NeMo, Torch and temporary files under .cache/video-gen (or repository-local VG_CACHE).
The first recognition downloads the model. NVIDIA GPU/CUDA is preferred; CPU inference is selected
when CUDA is unavailable and can be slow. Setup needs network access and substantial disk/RAM.
Validation on this CPU-only host: the isolated runtime installed and real local v2 inference on
NVIDIA's linked LibriSpeech sample produced a transcript with word timestamps (23 words).
An initial PyArrow/NumPy import incompatibility was fixed by pinning PyArrow 19.0.1 alongside
NeMo 2.5.3. GPU execution and production-film speech accuracy were not tested. The sample source is
https://dldata-public.s3.us-east-2.amazonaws.com/2086-149220-0033.wav (linked from the model card).
Keep downloaded test samples and model outputs in .cache; they are diagnostics, not delivery evidence.

Audio is decoded to mono 16 kHz PCM and recognized in chunks of at most 30 seconds. Reports expose
raw word timestamps/transcripts, localized expected text, match rates, unconfirmed words and estimated
intervals. Vendored Explainroo spoken/display and number normalization is used for comparison.
Generated narration always checks the full script, including omitted opening/endings; supplied recordings
may match an excerpt. Preparation also retains its script reconciliation for visual cue timing.

Reports: `<output>.speech.json`, review/speech-narration.json and review/speech-final-mix.json.
Inserted/repeated speech reduces the score even when all expected words were recognized.
Narration requires >=90% overall; final mix >=85%; every chunk requires >=80%. Below-threshold,
missing, failed or stale checks block delivery, irrespective of visual waivers or review-round budgets.
Unconfirmed words longer than three characters, unexpected spoken tokens and chunks below 90% are explicit warnings even above blocking thresholds. Inspect and
resolve material ambiguities before delivery; warnings do not constitute acoustic confirmation.
Chunk cuts can split words and fuzzy normalization can accept similar words. ASR is neither listening
nor proof of naturalness, pronunciation or intelligibility. Unconfirmed timestamps are estimates.
Receipts bind audio and script hashes; frozen review packs include available speech reports. Existing
waveform export integrity, duration, silence, masking and loudness measurements remain in place.
