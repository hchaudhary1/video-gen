# Narration and soundtrack contracts

Archon schedules narration, measured timing, sound and encoded verification. The
rules-story adapter calls `lib/narration.mjs`, `scripts/archon/media.mjs`, `lib/series.mjs`
and `lib/audio.mjs` directly. Kai uses explainroo's voice/timeline/QA libraries through
its adapter. Both keep source recordings and approved takes unchanged.

## Rules-story narration

Provision Ming with `node scripts/setup-ming.mjs`. The pinned model, worker, Python
environment, acoustic reference and queue live in repository `.cache/`. The continuity
adapter in `scripts/ming_continuity.py` uses a shared reference for a complete narration
invocation. Generate the full script once with the requested target duration. The
allowed duration deviation is ±20% or 2 seconds, whichever is larger; duration acceptance
and full-script speech coverage are separate mandatory checks.

`generateSpeech()` uses provider `ming`, `narration: true`, `output` WAV and optional
`targetSeconds`. It retains rejected takes and returns measured generation status.
Never stretch a partial recording to reach the target. An approved take can only change
through explicit archival/new production, with timing and dependent reviews rebuilt.

Preparation preserves supplied source files and writes separate normalized 48 kHz mono
PCM narration. Generated narration requires full-script coverage; a supplied recording
may be an explicitly requested excerpt. Parakeet v2 checks actual speech against the
script and supplies measured words for alignment. Missing, stale or failed receipts
block qualification. ASR is not listening, naturalness or pronunciation judgment.

## Identity sound

`lib/identities.mjs` records series identity and file number. The sound node calls
`renderSoundKit(job, identityId)` from `lib/series.mjs`; `renderSingle()` supports a named
effect or bed when the director needs a specific sound. `lib/sound-design.mjs` provides
the deterministic synthesis implementation backed by vendored explainroo audio modules.
Retain generator, engine, seed and parameters in `assets/SOURCES.json`. A shared series
signature must remain consistent across films.

A film references generated or licensed sound through `film.json`:

```json
{"music":{"src":"assets/music/identity-bed.wav","source":"retained source or generator","license":"retained licence","level":-12,"duck":-10},"mix":{"targetLufs":-15}}
```

Use actual paths returned by the sound node. Sound effect cues refer to measured words
or explicit timeline positions, with declared intent. Imported audio needs licence and
source provenance through `lib/assets.mjs`. `lib/audio.mjs` mixes narration, effects and
ducked music, measures integrated loudness/true peaks, and verifies encoded correlation
against the generated mix. Narration must remain intelligible and cannot be silently
replaced to accommodate music. `soundCheck()` writes cue sheets and listening notes when
the optional analysis environment is provisioned; missing sheets remain a disclosed
limitation, not a claimed listening pass.

## Kai narration

The direct explainroo preparation function generates Kokoro scene takes or derives takes
from a preserved supplied recording, runs Whisper speech alignment and saves the measured
timeline. The Kai adapter binds approved script, source recording, voice settings,
per-scene WAV/metadata and measured timing. Visual repairs may change drawings and
transitions while preserving the recording and timing. Models remain in `.cache/explainroo`.

Final verification transcribes scene intervals in the encoded mix, checks global and
per-scene coverage, stream/canvas/duration/frame-rate integrity, loudness and black frames.
Do not treat a measured speech match as listening or a naturalness judgment. Both
workflows disclose actual inspection limits in their delivery records.

## Ming delivery sidecar

Place `ming-performance.json` beside the approved script for controlled pacing. Supported
cues stay in the sidecar, outside `SCRIPT.md`; removing cues from segment text must recover
the exact approved narration in order, including punctuation. Segments are at most 150
words, with speed 0.9–1.15, global speed 0.9–1.25 and pauseAfter 0–2 seconds. Arbitrary
instruction/voiceInstruction fields and unsupported emotion tags are rejected.

Supported inline vocal events, with exact spelling:
`[Breathing]`, `[Cough]`, `[Sigh]`, `[Laughter]`, `[Uhm]`, `[Surprise-ah]`, `[Surprise-oh]`,
`[Dissatisfaction-hnn]`, `[Confirmation-en]`, `[Question-ei]`, `[Question-ah]`, `[Question-en]`,
`[Question-oh]`, `[Question-huh]`. Choose cues for meaning; there is no cue quota.

Generation status records queued, loading, generating, complete, failed or cancelled
state. Ming invocations share a FIFO queue and one acoustic reference per invocation.
A queued invocation is healthy; do not launch duplicate takes or change voices to bypass it.
