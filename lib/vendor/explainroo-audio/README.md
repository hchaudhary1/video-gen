# Vendored explainroo audio engine

Dependency-free, deterministic JavaScript synthesis from
[explainroo](https://github.com/vincentsch/explainroo) (MIT, Copyright (c) 2026 Vincent Schmalbach),
pinned at the commit in `SOURCE.json`. Files in `upstream/` are byte-identical to `engine/audio/`
at that commit (hashes in `SOURCE.json`; `tests/sound-design.test.mjs` checks them). Do not edit them;
`upstream/LICENSE` preserves the attribution.

Project-owned code lives outside this folder: `lib/sound-design.mjs` builds the horror vocabulary
(minor/phrygian harmony, drone beds, effects, identity signatures) on top of the synth core.
