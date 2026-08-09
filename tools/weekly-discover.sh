#!/usr/bin/env bash
# Weekly discovery pass. Probes the ATS APIs for company names in the pool and
# permanently widens the watchlist. Called by the system crontab, once a week.
#
# It NEVER applies to anything.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH="$ROOT/tools/ats-watch"
DIGESTS="$ROOT/digests"
TODAY="$(date +%F)"
STAMP="$(date +%FT%H:%M)"

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
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
  printf '[%s] FATAL: node not found. PATH=%s\n' "$STAMP" "$PATH"
  exit 127
fi
mkdir -p "$DIGESTS"

OUT="$DIGESTS/.$TODAY-discover.txt"

cd "$WATCH" || { printf '[%s] FATAL: %s not found\n' "$STAMP" "$WATCH"; exit 1; }

# ⚠️ --promote in one single run, on purpose. A read-only run BURNS the slugs it
# just probed into .tried.json only when promoting, but running read-only first
# and promoting second still costs a full second pass over the whole pool for no
# gain. One promoting run, then read the diff in git.
TODAY="$TODAY" timeout 3600 node discover.mjs --promote > "$OUT" 2>&1
STATUS=$?

{
  printf '[%s] weekly discovery, exit %s\n' "$STAMP" "$STATUS"
  sed 's/^/  /' "$OUT"
  echo
  echo "  New boards land in tools/ats-watch/watchlist.json (check the git diff)."
  echo "  Run 'node watch.mjs' once to record their baseline, or the next daily"
  echo "  scan will report every one of their reqs as new."
} 2>&1

find "$DIGESTS" -name '.*-discover.txt' -mtime +60 -delete 2>/dev/null
