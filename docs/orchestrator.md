# Archon production

Archon exclusively schedules both production treatments. Agents complete individual
nodes; YAML dependencies, conditional rounds and attention waits control progression.

- [Rules-story](archon-rules-story.md): HyperFrames scenes, Ming narration, series identity and sound.
- [Kai explainer](archon-kai-explainer.md): explainroo scenes, Kokoro or supplied recordings, measured timing.

Use explicit project slugs and the corresponding workflow. Production metadata and
frozen profiles live in `jobs/scripts/<slug>/`; media and evidence live in `jobs/<slug>/`.
Provider/model settings belong in Archon configuration or individual YAML nodes.
Use `archon workflow get`, `logs` and `resume` with the saved run ID for recovery.

Every author and reviewer runs in a distinct fresh context. Reviewers inspect actual
frozen evidence, cite the pack hash and respond to prior demonstrated findings.
Incomplete inspection never counts as a creative pass. Requested human decisions use
Archon's attention queue and retain the person's verbatim answer plus artifact binding.
Only the operator answers human checkpoints. A notification is not approval.

Current narration, timing, review, render and publishing receipts are validated on disk
before expensive work is reused. Changed source or evidence invalidates dependent
approval. A qualified delivery names unresolved findings and inspection limitations.

Both workflows produce video-sized, independently reviewed thumbnails, record selection
when requested, obtain approved publishing copy and upload unlisted to abdupdates unless
opted out. Publication verifies the authenticated channel and uses a durable session
journal to reconcile interrupted uploads. Never discard a journal to retry an uncertain
remote operation. See [publishing](publishing.md).

Node adapters expose individual domain operations through direct library calls. They
neither choose the next stage nor start agent tasks. There is no second stage controller.
