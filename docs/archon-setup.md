# Worktree-local setup

The video checkout owns its Archon source, runtime and state. The tracked launcher and
bootstrap use Archon revision `0d8de493fb016ca7a63529f3abc1ab08ac3e7a16` (0.13.2)
and Bun 1.4.2. The current bootstrap provisions Linux x64.

```sh
node scripts/setup-archon.mjs --media
source scripts/activate-archon.sh
archon version
archon doctor
archon workflow list
```

Use `./bin/archon` when shell activation is inconvenient. Activation adds this checkout's
`bin` and Bun directories to PATH; it does not alter your shell startup files. The launcher
sets `ARCHON_HOME` to `.cache/archon/home`, with SQLite, run transcripts, caches and artifacts
in this checkout. It disables telemetry and resolves the already installed Codex binary.
The project config selects Codex, its configured model and live research search.

Archon source is a dependency clone under `.cache/archon/source`, not vendored application
code. The bootstrap checks the source commit and runtime version and installs source
packages from the pinned lockfile. It verifies the Bun archive against registry integrity
metadata. Application dependency versions and `video.config.json` are unchanged.

## Authentication

The Codex CLI must already be installed and logged in on the host. Check `codex login status`.
Archon reuses that native login without copying account secrets or writing to Codex's home.
Archon's doctor can report no multi-user keys connected while the native Codex login is usable;
this single-user installation uses the native login.

For YouTube, put the supplied Desktop OAuth client in the private ignored cache location
from [publishing](publishing.md), then run `node scripts/tools.mjs youtube-auth`. The account
owner must complete Google consent for upload and read-only channel access. A remote browser
requires forwarding the printed loopback callback port to this host. Missing authorization
blocks publishing explicitly; it does not block local production or trigger an upload.

## Media readiness

`--media` installs the root and explainroo lockfiles, provisions the installed Chrome browser,
installs Ming if its runtime/model/source is absent, and loads the pinned models. Loading
models can download several GB and takes time on the first run.

```sh
node scripts/media-readiness.mjs
node scripts/media-readiness.mjs --load-models
```

The latter actually loads Ming, Parakeet v2, Kokoro and Whisper without synthesizing speech,
transcribing recordings, creating a production or generating approval/review evidence.
Parakeet's `--setup` mode provisions the same locked Python environment used in production.
Ming's readiness helper loads the same CPU model and source used by its narration worker.
The ignored `.cache/archon/media-readiness-models.json` records observed results, not listening.

## CLI verification

```sh
archon validate workflows rules-story
archon validate workflows kai-explainer
ARCHON_SOURCE="$PWD/.cache/archon/source" bun scripts/archon/validate-upstream.ts
```

Setup diagnostics can create clearly named non-production workflows in the local Archon
home. Real provider, inherited-child/input-binding and durable-timer checks are separate
from stub graph simulations. None establish that an actual production or publication passed.

On this host Docker's executable is installed but its daemon socket is unavailable to the
current user. The pinned upstream CLI attempts Docker verification-image inventory even
for host-only runs, producing a nonfatal cleanup warning. The diagnostics completed and
created no containers/images. These video workflows run in the host checkout; Docker is
not a production prerequisite, and this setup does not change Docker access permissions.
