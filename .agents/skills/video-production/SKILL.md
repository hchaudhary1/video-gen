---
name: video-production
description: Start, watch, answer, resume or publish a video production run (rules-story or kai-explainer) as the operator's agent.
---

# Running a production

You operate Archon runs for the person; you do not do the nodes' work yourself.
`docs/production.md` is the full runbook (options, failure policy, recovery).

## Start

Choose the treatment from `personalities/README.md`; the person's explicit direction wins.
Use a fresh lowercase slug per film and launch through the detached helper, which keeps the
run alive if this agent's host restarts:

```sh
./bin/archon-detached workflow run rules-story --detach \
  --input project=<slug> --input 'options={"brief":"...","duration":300}'
```

Save the returned run ID. Options are saved with the project on its first run and are not
changed by later launches.

## Watch and answer

`./bin/archon workflow get <run-id>` and `workflow logs <run-id> --format text` show progress.
A paused run waits for the person (script, film, thumbnail or publishing decision). Only the
person answers: relay the question and the artifact it names, then pass their exact words
with `archon workflow respond`. Never answer for them. A Discord ping, when asked for, goes
through `scripts/discord-notify.mjs` with one stable request ID per pending question; a ping
is not approval.

## Resume

`./bin/archon workflow resume <run-id>`. Deterministic nodes recover the saved profile and
skip work whose outputs are still current. A killed parent can leave child runs marked
running: confirm no live process, then `archon workflow abandon <id>` before relaunching.

## Finish

A completed production leaves `jobs/<slug>/renders/video.mp4`,
`jobs/<slug>/thumbnail/thumbnail.png` and `jobs/<slug>/review/delivery.json`. Unless the
project opted out, the run then uploads the film unlisted to abdupdates after the person
approves the copy (`docs/publishing.md`). A running, paused or failed run is not a delivery;
report its actual state.
