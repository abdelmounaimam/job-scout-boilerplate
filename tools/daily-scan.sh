#!/usr/bin/env bash
# Daily watch over the public ATS boards. Called by the system crontab.
#
# It NEVER applies to anything. It collects, filters, writes and summarises.
# Interpretation happens in a session, with a human present.
#
# Everything here works with no authentication, so it is genuinely unattended.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH="$ROOT/tools/ats-watch"
DIGESTS="$ROOT/digests"
TODAY="$(date +%F)"
STAMP="$(date +%FT%H:%M)"

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

# ⚠️ node installed via nvm is NOT on cron's default PATH, and the failure is
# silent: the job "runs" and produces an empty log. Resolve it explicitly.
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

# Fail loudly rather than produce an empty, reassuring log.
if ! command -v node >/dev/null 2>&1; then
  printf '[%s] FATAL: node not found. PATH=%s\n' "$STAMP" "$PATH"
  exit 127
fi
mkdir -p "$DIGESTS"

log() { printf '[%s] %s\n' "$STAMP" "$*"; }

ATS_OUT="$DIGESTS/.$TODAY-ats.txt"
ATS_NEW=0

if cd "$WATCH" 2>/dev/null; then
  if timeout 900 node watch.mjs --quiet > "$ATS_OUT" 2>&1; then
    # ⚠️ `grep -c` prints 0 AND exits non-zero when it finds nothing, so a
    # `|| echo 0` appends a SECOND zero and the variable becomes "0\n0", which
    # breaks the numeric test below. Take the first line and default it instead.
    ATS_NEW=$(grep -c 'ACTIONABLE\|FYI only' "$ATS_OUT" 2>/dev/null | head -1)
    ATS_NEW=${ATS_NEW:-0}
    log "ATS: $ATS_NEW new req(s) kept"
  else
    log "ATS: poller failed, see $ATS_OUT"
  fi
else
  log "ATS: $WATCH not found"
fi

if [ "$ATS_NEW" -le 0 ]; then
  log "nothing new"
  exit 0
fi

{
  echo "================================================================"
  echo "  WATCH — $TODAY"
  echo "================================================================"
  echo
  echo "-- ATS boards: $ATS_NEW new req(s) --"
  grep -A3 'ACTIONABLE' "$ATS_OUT" 2>/dev/null | sed 's/^/  /' | head -40
  echo "  -> $ATS_OUT"
  echo
  echo "-- NEXT --"
  echo "  Open a session in this repo and say: \"read the job-scout skill\"."
  echo "  These lines are NOT filtered on the posting body: check minimum"
  echo "  qualifications, real stack, salary band, and that the role is still"
  echo "  open, before investing in an application."
  echo
} 2>&1

# --- optional: let a local LLM CLI read the digest -----------------------------
# Left OFF by default and deliberately.
#
# ⚠️ If you wire one in, mind two things learned the hard way:
#   1. Do not spend the same quota the candidate's interactive sessions use: a
#      morning cron can lock them out before they start working.
#   2. Do not run a job search on an account that belongs to the current
#      employer. That contradicts the whole "do not get spotted before signing"
#      constraint, and it is invisible until it is not.
#   3. Pipe the data on STDIN. Given file paths, some CLIs fetch the file from
#      the remote git host through an MCP server, reading the pushed version
#      instead of the local disk, which for gitignored digests means reading
#      nothing at all, at four times the token cost.
#
# Example, with the CLI of your choice:
#   cat "$ATS_OUT" | your-llm-cli --read-only "Rank these against the profile in
#   profile/profile.mjs. Drop anything from a company already in
#   applications/applications.csv. Return at most 10 lines."

find "$DIGESTS" -name '.*-ats.txt' -mtime +30 -delete 2>/dev/null
log "done"
