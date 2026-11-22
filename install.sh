#!/usr/bin/env bash
# Install the Cinelume skill for Claude Code and/or Google Antigravity.
#   ./install.sh                  # both, user-level (all projects)
#   ./install.sh claude           # Claude Code only   -> ~/.claude/skills/cinelume
#   ./install.sh antigravity      # Antigravity only   -> ~/.gemini/config/skills/cinelume (+ ~/.gemini/antigravity/skills if present)
#   ./install.sh all --project /path/to/repo   # workspace-level: <repo>/.claude/skills + <repo>/.agents/skills
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/skills/cinelume"
TARGET="${1:-all}"; PROJECT=""
if [[ "${2:-}" == "--project" ]]; then PROJECT="$(cd "${3:?--project needs a path}" && pwd)"; fi
if [[ "$TARGET" == "--project" ]]; then TARGET=all; PROJECT="$(cd "${2:?--project needs a path}" && pwd)"; fi

say(){ printf '\033[1;33m[cinelume]\033[0m %s\n' "$*"; }
dests=()
if [[ -n "$PROJECT" ]]; then
  [[ "$TARGET" == claude || "$TARGET" == all ]] && dests+=("$PROJECT/.claude/skills/cinelume")
  [[ "$TARGET" == antigravity || "$TARGET" == all ]] && dests+=("$PROJECT/.agents/skills/cinelume")
else
  [[ "$TARGET" == claude || "$TARGET" == all ]] && dests+=("$HOME/.claude/skills/cinelume")
  if [[ "$TARGET" == antigravity || "$TARGET" == all ]]; then
    dests+=("$HOME/.gemini/config/skills/cinelume")
    [[ -d "$HOME/.gemini/antigravity" ]] && dests+=("$HOME/.gemini/antigravity/skills/cinelume")
    [[ -d "$HOME/.gemini/antigravity-cli" ]] && dests+=("$HOME/.gemini/antigravity-cli/skills/cinelume")
  fi
fi

command -v node >/dev/null || { say "Node.js 18+ is required: https://nodejs.org"; exit 1; }
command -v ffmpeg >/dev/null || say "WARNING: ffmpeg not found. Install it (macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg · Windows: winget install ffmpeg)"

for d in "${dests[@]}"; do
  say "installing -> $d"
  old="$(dirname "$d")/vox-video"; [[ -d "$old" ]] && { say "removing old vox-video install -> $old"; rm -rf "$old"; }
  mkdir -p "$(dirname "$d")"; rm -rf "$d"; cp -R "$SRC" "$d"; rm -rf "$d"/examples/*-stills "$d/engine/node_modules" "$d/examples/.cinelume-cache"
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
say "done. Ask your agent: \"Make a 60-second cinematic film about <topic>\""
say "voiceover is built in (voices: node <skill>/engine/tts.mjs --list) · optional: export PEXELS_API_KEY / UNSPLASH_ACCESS_KEY / PIXABAY_API_KEY for more real photos & footage"
