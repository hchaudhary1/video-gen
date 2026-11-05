# Publishing through Archon

Both treatments use explicit thumbnail, independent review, selection, publishing-copy,
attention and upload nodes. Use the [production runbook](production.md).

Thumbnails match the saved video's width and height. Compose for that canvas, load actual
heavy fonts and inspect both full-size images and feed-sized previews. Keep editable SVG,
PNG, preview and BRIEF.md per variant. `lib/thumbnails.mjs` exposes export, verdict,
ranking, feedback and archive functions to node agents. A changed image invalidates its
verdict and selection. PNG uploads must fit YouTube's 2 MB limit.

Titles, thumbnail claims and descriptions must be supported by the film and retained
sources. Preserve approved wording. Selection does not approve a changed title or copy.
The publishing attention node binds approval to the current copy, video and selected image.

## Authentication setup

Save the supplied Google Desktop OAuth client JSON privately under
`.cache/video-gen/youtube-oauth/credentials.json`, then run:

```sh
node scripts/tools.mjs youtube-auth
```

The operator signs in as the account that owns abdupdates. OAuth uses `youtube.upload`
and `youtube.readonly` so the publication node can verify the actual channel ID and handle
before any upload mutation. Obtain the exact channel ID from the operator/configuration;
never invent it. `publishing.json` contains title, description, optional tags, privacy
`unlisted` and that channel ID. Tokens remain ignored private cache files, never briefs or code.

## Durable delivery

The upload node calls `lib/youtube-upload.mjs` directly. It verifies qualified delivery,
current review/approval hashes, selected image and approved metadata; uploads are unlisted.
An opt-out never calls the uploader. The project-local session journal saves the resumable
URL and remote video ID before thumbnail submission. Its path is
`jobs/scripts/<slug>/archon/upload-session.json`. Changed video, copy or thumbnail bindings
are rejected. Uncertain initiation or an expired unreconciled session fails closed. Resume reconciles accepted ranges or
an already completed remote video instead of creating a duplicate.

Do not delete an uncertain journal. A crashed process can leave its exclusive lock; first
establish the owner is dead before removing only the lock. Report the actual video URL or
precise failure. Neither an agent reply nor an unverified draft is successful delivery.
