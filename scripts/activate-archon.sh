# Source this file from Bash to use this checkout's Archon and Bun commands.
_video_gen_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
export PATH="$_video_gen_root/bin:$_video_gen_root/.cache/archon/bun/bin:$PATH"
export ARCHON_HOME="$_video_gen_root/.cache/archon/home"
export ARCHON_SOURCE="$_video_gen_root/.cache/archon/source"
unset _video_gen_root
