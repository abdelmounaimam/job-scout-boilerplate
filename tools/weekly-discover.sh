#!/usr/bin/env bash
# Discovery pass: widens the watchlist. RUN BY HAND, see
# .claude/skills/job-scout/SKILL.md. Do not schedule it unless asked.
#
# It NEVER applies to anything. It probes, promotes, summarises.
# Cumulative effect: every run widens what the poller covers.
#
# ⚠️⚠️ SLOW AND SILENT: a full pass can take hours and prints nothing before the
# end. Launch it in the background with the output redirected, never under a
# short timeout (a pass killed midway loses everything, .tried.json included):
#   nohup tools/weekly-discover.sh > digests/.$(date +%F)-discover-run.log 2>&1 &

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH="$ROOT/tools/ats-watch"
DIGESTS="$ROOT/digests"
TODAY="$(date +%F)"
OUT="$DIGESTS/.$TODAY-discover.txt"

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# node through nvm is NOT on the PATH of a non-interactive shell (see daily-scan.sh).
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" --no-use >/dev/null 2>&1 || true
  nvm use default >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN=$(find "$HOME/.nvm/versions/node" -maxdepth 2 -name node -type f 2>/dev/null | sort -V | tail -1)
  [ -n "$NODE_BIN" ] && export PATH="$(dirname "$NODE_BIN"):$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  printf '[%s] FATAL: node not found. PATH=%s\n' "$(date +%FT%H:%M)" "$PATH"
  exit 127
fi
mkdir -p "$DIGESTS"
log() { printf '[%s] %s\n' "$(date +%FT%H:%M)" "$*"; }
pget() { node "$ROOT/tools/setup/profile-get.mjs" "$1"; }

cd "$WATCH" || { log "FATAL: $WATCH not found"; exit 1; }

# --promote writes the boards found straight into the watchlist: that is what
# makes discovery cumulative instead of repetitive. The 4 h ceiling is a
# safety net, not a budget: raise it if the pool is large.
if ! timeout 14400 node discover.mjs --promote > "$OUT" 2>&1; then
  log "discovery failed or hit the 4 h ceiling, see $OUT"
  exit 3
fi

# Same trap as in daily-scan.sh: grep -c prints 0 and exits non-zero.
NEW=$(grep -c '^★' "$OUT" 2>/dev/null | head -1)
NEW=${NEW:-0}
log "discovery: $NEW new board(s)"

# Record the baseline of the freshly added boards, so the next poll does not
# report their whole catalogue as new.
timeout 900 node watch.mjs --quiet >/dev/null 2>&1 || true

if [ "$NEW" -le 0 ]; then
  log "no new board"
  exit 0
fi

{
  echo "================================================================"
  echo "  DISCOVERY — $TODAY — $NEW new board(s)"
  echo "================================================================"
  echo
  grep '^★' "$OUT" 2>/dev/null | sed 's/^/  /'
  echo
  echo "  Already added to watchlist.json, so the poller covers them."
  echo
  echo "-- NEXT, in session --"
  echo "  Re-read these companies: real product, or agency / marketplace / internal IT?"
  echo "  Headquarters and hiring in the home country, or remote employable from it?"
  echo "  Remove the intermediaries from watchlist.json."
  echo "  -> full detail in $OUT"
  echo
} 2>&1

# Same delegate policy as daily-scan.sh, data on STDIN.
DELEGATE="$(pget AUTOMATION.llmDelegate 2>/dev/null || echo none)"
PROMPT="Discovery of $TODAY: $NEW new ATS boards found and already added to the watchlist.
The results are in the stdin block: read no file, call no tool.
For each company: say whether it deserves the watchlist (real product versus service
company, ceiling, presence in the home market or remote employable from it); NAME the
intermediaries that should be removed, remove nothing yourself; flag the 3 most
interesting at most, one reason each. AT MOST 10 lines. Modify nothing, commit nothing."
REPORT="$DIGESTS/.$TODAY-discover-report.md"
case "$DELEGATE" in
  codex)
    command -v codex >/dev/null 2>&1 && { cat "$OUT" | timeout 1800 codex exec -c 'mcp_servers={}' -s read-only --color never \
      -o "$REPORT" "$PROMPT" >/dev/null 2>&1 \
      && { echo; echo "-- READ BY CODEX --"; sed 's/^/  /' "$REPORT"; echo "  -> $REPORT"; } \
      || log "Codex unavailable or failed: $OUT stays usable"; }
    ;;
  claude)
    # ⚠️⚠️ Never on an employer-owned Claude seat (see daily-scan.sh).
    log "⚠ llmDelegate=claude: make sure this is NOT an employer-owned Claude seat."
    command -v claude >/dev/null 2>&1 && { cat "$OUT" | timeout 1800 claude -p "$PROMPT" > "$REPORT" 2>/dev/null \
      && { echo; echo "-- READ BY CLAUDE --"; sed 's/^/  /' "$REPORT"; echo "  -> $REPORT"; } \
      || log "claude -p failed: $OUT stays usable"; }
    ;;
  *) ;;
esac

log "done"
