#!/usr/bin/env bash
# Install the vox-video skill for Claude Code and/or Google Antigravity.
#   ./install.sh                  # both, user-level (all projects)
#   ./install.sh claude           # Claude Code only   -> ~/.claude/skills/vox-video
#   ./install.sh antigravity      # Antigravity only   -> ~/.gemini/config/skills/vox-video (+ ~/.gemini/antigravity/skills if present)
#   ./install.sh all --project /path/to/repo   # workspace-level: <repo>/.claude/skills + <repo>/.agents/skills
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/skills/vox-video"
TARGET="${1:-all}"; PROJECT=""
if [[ "${2:-}" == "--project" ]]; then PROJECT="$(cd "${3:?--project needs a path}" && pwd)"; fi
if [[ "$TARGET" == "--project" ]]; then TARGET=all; PROJECT="$(cd "${2:?--project needs a path}" && pwd)"; fi

say(){ printf '\033[1;33m[vox]\033[0m %s\n' "$*"; }
dests=()
if [[ -n "$PROJECT" ]]; then
  [[ "$TARGET" == claude || "$TARGET" == all ]] && dests+=("$PROJECT/.claude/skills/vox-video")
  [[ "$TARGET" == antigravity || "$TARGET" == all ]] && dests+=("$PROJECT/.agents/skills/vox-video")
else
  [[ "$TARGET" == claude || "$TARGET" == all ]] && dests+=("$HOME/.claude/skills/vox-video")
  if [[ "$TARGET" == antigravity || "$TARGET" == all ]]; then
    dests+=("$HOME/.gemini/config/skills/vox-video")
    [[ -d "$HOME/.gemini/antigravity" ]] && dests+=("$HOME/.gemini/antigravity/skills/vox-video")
    [[ -d "$HOME/.gemini/antigravity-cli" ]] && dests+=("$HOME/.gemini/antigravity-cli/skills/vox-video")
  fi
fi

command -v node >/dev/null || { say "Node.js 18+ is required: https://nodejs.org"; exit 1; }
command -v ffmpeg >/dev/null || say "WARNING: ffmpeg not found. Install it (macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg · Windows: winget install ffmpeg)"

for d in "${dests[@]}"; do
  say "installing -> $d"
  mkdir -p "$(dirname "$d")"; rm -rf "$d"; cp -R "$SRC" "$d"; rm -rf "$d/engine/node_modules" "$d/examples/.vox-cache"
  (cd "$d/engine" && npm install --silent --no-audit --no-fund)
done

# Make sure a Chromium is available for rendering
have_chrome=""
for c in "/Applications/Google Chrome.app" "/Applications/Chromium.app" "/Applications/Microsoft Edge.app" /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium /usr/bin/chromium-browser /snap/bin/chromium; do
  [[ -e "$c" ]] && have_chrome="$c" && break
done
[[ -n "${CHROME_PATH:-}" && -e "${CHROME_PATH}" ]] && have_chrome="$CHROME_PATH"
if [[ -z "$have_chrome" ]]; then
  say "No system Chrome detected — downloading Playwright Chromium (one time)"
  (cd "${dests[0]}/engine" && npx --yes playwright install chromium) || say "Could not auto-install Chromium; install Google Chrome or run: npx playwright install chromium"
fi
say "done. Ask your agent: \"Make a 45-second Vox-style reel about <topic>\""
say "optional: pip install edge-tts  (free neural voiceover)   ·   export PEXELS_API_KEY=...  (real stock b-roll)"
