# Source this file from Bash to use this checkout's Archon and Bun commands.
_video_gen_root=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
export PATH="$_video_gen_root/bin:$_video_gen_root/.cache/archon/bun/bin:$PATH"
export ARCHON_HOME="$_video_gen_root/.cache/archon/home"
export ARCHON_SOURCE="$_video_gen_root/.cache/archon/source"
# explainroo's default Chrome lookup resolves to a directory on this host; point it at the binary.
_video_gen_chrome="$HOME/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/chrome-headless-shell-linux64/chrome-headless-shell"
if [ -x "$_video_gen_chrome" ]; then export EXPLAINROO_CHROME="$_video_gen_chrome"; fi
unset _video_gen_chrome
unset _video_gen_root
