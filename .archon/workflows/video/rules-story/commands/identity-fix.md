The series identity in `jobs/scripts/$INPUTS.project/identity.json` could not be continued for `$INPUTS.project`.
`jobs/scripts/$INPUTS.project/archon/identity-repair.json` has the error.

Fix exactly that error. Either name an existing identity from
`personalities/rules-story/identities/` in `identity.json` (set `parent` only for a Short
whose parent already has a file number), or, only if a new identity is genuinely needed,
register it with `createIdentity` from `lib/identities.mjs` so it passes `validateIdentity`.
Never edit or renumber another project's issues.
