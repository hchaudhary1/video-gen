Research the rules-story film `$INPUTS.project`. Its files are in `jobs/scripts/$INPUTS.project/`.

Start from `BRIEF.md`, or from `SCRIPT.md` when a script was supplied. Produce:

- `SOURCES.md` (the source index) and retained evidence in `sources/` for every real-world
  claim. Keep invented lore separate from real claims.
- `identity.json`: `{"identity": "<id>", "parent": null}` naming a series identity from
  `personalities/rules-story/identities/`. A Short sets `parent` to its parent project.
  Register a new identity with `createIdentity` from `lib/identities.mjs` only when none fits.

Keep evidence that is already there. Finish when
`node scripts/archon/rules-story.mjs research-status $INPUTS.project` reports no errors.
