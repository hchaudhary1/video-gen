# Vendored explainroo

This folder is a plain copy of [explainroo](https://github.com/vincentsch/explainroo) (MIT, see `LICENSE`),
kept inside video-gen with no submodule or second remote. It is the engine for the `kai-explainer` profile.

- Upstream: https://github.com/vincentsch/explainroo
- Base revision: `e95232c8d535ed2aa390e7b1caee0d1326dd9e83` (0.4.1, 2026-10-20)
- Copied: 2026-11-01

## Local changes on top of the base revision

- Text: `tracking` and `under` options, quotes around starred words (`engine/text.js`)
- Kai explainer kit, available to scenes as `s.kai` (`engine/kai.js`, wired in `engine/stage.js`/`engine/runtime.js`, checked by `src/qa.js`)
- `init --template <name>` and the Kai template (`templates/kai/`: look, narration rules in `TEMPLATE.md`, defaults, starter files)
- `verify` judges black frames against the look's background, so dark looks do not fail (`src/export.js`)
- Templates section in `AGENTS.md`; tests in `test/kai-kit.test.js`, `test/verify-black.test.js`, `test/cli.test.js`

Changed files relative to the base: AGENTS.md, engine/kai.js, engine/runtime.js, engine/stage.js, engine/text.js,
src/cli.js, src/export.js, src/qa.js, templates/kai/*, test/cli.test.js, test/kai-kit.test.js, test/verify-black.test.js.

## Upgrading

Fetch the new upstream files into a scratch directory, diff them against the base revision above, and port the
upstream changes here while keeping the local changes listed. Then run `npm test` in this folder, update the base
revision in this file, and render a short Kai test project before relying on it.

`npm install` here installs explainroo's own dependencies. Generated files stay ignored: `node_modules/`, `videos/`,
`build/`, `out/`. Run commands through `npm run video -- explainroo ...` so caches stay under the repository `.cache/`.
