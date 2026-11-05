# Optional asset reuse

The library holds reusable local media or code bundles. Use an existing asset when it fits; agents can
create their own files freely. Library publication is optional and does not gate film review or delivery.

Within an assigned Archon node, use `lib/assets.mjs`: `searchLibrary` reads metadata,
`inspectBundle` validates a bundle, `useBundle` copies a pinned version, and `saveToLibrary`
or `publishBundle` retains reusable assets with provenance. These are library calls;
Archon owns production progression.

Search reads metadata. Use copies a specific version into `assets/library/` and records file hashes.
It does not insert scenes or execute scripts. Reference copied assets from the native composition or
pipeline soundtrack. Keep frozen copies intact; make a separately named derivative when adapting them.

## Bundles

`library/<id>/<major.minor.patch>/artifact.json` declares schemaVersion 1, id, version, kind, title,
description, tags, entry, files and usage. Optional parameters and cueSlots document a reusable API.
All declared files stay inside the bundle. `publishBundle(root, source)` validates and
publishes a version; existing versions cannot be overwritten. Sources/licences should travel with media.

Finished thumbnail sets are archived by the thumbnail-selection node under `library/thumbnails/<slug>/`, preserving
the video's dimensions, variants and recorded selection. The renderer's own generated files are not
reusable creative assets and should not be published as such.

## Motion Explainer

`motion-explainer@1.0.0` bundles pinned MIT camera/motion examples, prompts and a native Canvas
timeline bridge. See [usage and profile guidance](../docs/motion-explainer.md).

## Rules-series kit

`rules-series-kit@1.0.0` is the locked frame of series horror films (case-file HUD, sentence captions, rule
card, exhibit card, marks, glitch and film finish). the rules-story series node installs it and writes the series
data; see its README.md and `personalities/rules-story/PROFILE.md`.
