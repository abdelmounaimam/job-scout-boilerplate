#!/usr/bin/env bash
# Starts a Chrome the agent can attach to over CDP, on a DEDICATED profile whose
# logins persist (LinkedIn, Glassdoor, ATS candidate accounts). Idempotent: if
# the CDP port already answers, it does nothing.
#
# The agent drives it with:  agent-browser --cdp 9222 <command>
# The LinkedIn client needs it only for `node linkedin.mjs auth` (cookie export);
# the Glassdoor client falls back on it when Cloudflare blocks direct requests.
#
# ⚠️ WHY systemd-run: a Chrome started with `nohup ... &` from the agent's shell
# DIES when the agent's command ends, because it stays in that command's process
# group. Started as a transient systemd user unit, it lives outside it. On
# systems without systemd (macOS), `setsid` or `open -na` detaches it instead.
#
# ⚠️ Log into sites BY HAND in this window the first time, and inside a logged
# in site navigate by clicking, not by opening deep URLs: a deep-link full
# reload breaks the session of fragile single-page apps.
#
# Env overrides:
#   CDP_PORT        default 9222
#   CHROME_PROFILE  default ~/.job-scout-chrome-profile
#   CHROME_BIN      default: first Chrome or Chromium found
#   CHROME_LOG      default ${TMPDIR:-/tmp}/job-scout-chrome.log

set -uo pipefail

PORT="${CDP_PORT:-9222}"
PROFILE="${CHROME_PROFILE:-$HOME/.job-scout-chrome-profile}"
LOG="${CHROME_LOG:-${TMPDIR:-/tmp}/job-scout-chrome.log}"
UNIT="job-scout-chrome-$PORT"

cdp_up() { curl -s --max-time 2 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; }

if cdp_up; then
  echo "Chrome CDP already listening on port $PORT"
  exit 0
fi

find_chrome() {
  if [ -n "${CHROME_BIN:-}" ]; then echo "$CHROME_BIN"; return; fi
  local c
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    /opt/google/chrome/chrome; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return; }
  done
}

CHROME="$(find_chrome)"
if [ -z "$CHROME" ]; then
  echo "No Chrome or Chromium found. Install one, or set CHROME_BIN." >&2
  exit 1
fi

mkdir -p "$PROFILE"
ARGS=(--remote-debugging-port="$PORT" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check)

if command -v systemd-run >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  systemctl --user reset-failed "$UNIT.service" >/dev/null 2>&1
  systemd-run --user --unit="$UNIT" --collect "$CHROME" "${ARGS[@]}" > "$LOG" 2>&1
  how="systemd user unit $UNIT (status: systemctl --user status $UNIT)"
elif command -v setsid >/dev/null 2>&1; then
  setsid "$CHROME" "${ARGS[@]}" > "$LOG" 2>&1 < /dev/null &
  how="setsid"
else
  # macOS without setsid: nohup plus disown is the best available detachment.
  nohup "$CHROME" "${ARGS[@]}" > "$LOG" 2>&1 < /dev/null &
  disown 2>/dev/null || true
  how="nohup (may die with the calling command: run this script from your own terminal if so)"
fi

# Wait for the CDP endpoint (about 10 s at most).
for _ in $(seq 1 20); do
  if cdp_up; then
    echo "Chrome started: profile $PROFILE, CDP port $PORT, via $how"
    exit 0
  fi
  sleep 0.5
done

echo "Chrome started but CDP does not answer on port $PORT. Read $LOG" >&2
exit 1
