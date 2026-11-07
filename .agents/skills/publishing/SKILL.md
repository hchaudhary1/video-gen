---
name: publishing
description: Write or revise a project's YouTube publishing copy (publishing.json) for the unlisted abdupdates upload.
---

# Publishing copy

Write `jobs/scripts/<slug>/publishing.json`:

```json
{"title": "...", "description": "...", "tags": ["..."], "privacy": "unlisted", "channelId": "UC..."}
```

- `channelId` is the exact abdupdates channel ID. Take it from configuration or the operator,
  never invent it. The `channelId` in an earlier project's `publishing.json` whose
  `archon/published.json` exists was confirmed by an authenticated upload and may be reused.
- The title, description and tags must be supported by the film and its retained sources;
  list the main sources in the description.
- Apply the operator's requested revisions in `archon/publishing-decision.json` and fix every
  error in `archon/publishing-errors.json` when those files exist. Preserve approved wording.
- You author copy only. Approval and upload belong to later steps.
