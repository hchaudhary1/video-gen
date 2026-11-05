# explainroo media engine

This vendored MIT engine supplies narration, word timing, Canvas drawing, frame capture,
encoding, subtitles, chapters and verification to the Archon `kai-explainer` workflow.
Production is defined in `.archon/workflows/video/kai-explainer/` at the repository root.
Read the root `docs/archon-kai-explainer.md` runbook and `AGENTS.md` for the Scene API.

Provision dependencies here with `npm ci`. Models and tool assets are downloaded by the
media library into repository `.cache/explainroo` when the narration node first needs
them. The library's `src/` and `engine/` APIs are imported directly by Archon adapters.
Run media library tests with `npm test`. See `VENDORED.md` for provenance and local changes.
