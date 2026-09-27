#!/usr/bin/env bash
# One scan pass over the automatic sources, then a report. RUN BY HAND.
# See .claude/skills/job-scout/SKILL.md. Do not schedule it (cron, CronCreate,
# systemd timer) unless the candidate asks: the search starts when they decide.
#
# It NEVER applies to anything. It collects, filters, writes and summarises.
# Every application spends the only cartridge available at that company, so
# applying is a separate, deliberate act.
#
# Source A — public ATS boards: no auth, always runs.
# Source B — LinkedIn (if LINKEDIN.enabled): needs the cached cookie, and is
#            SKIPPED cleanly when the client is unhealthy.
# Source C — the LinkedIn "recommended" feed: a different angle, non-blocking.
#
# Output goes to STDOUT. Redirect it yourself to keep it:
#   tools/daily-scan.sh | tee digests/.$(date +%F)-scan-report.txt

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT="$ROOT/tools/linkedin"
WATCH="$ROOT/tools/ats-watch"
DIGESTS="$ROOT/digests"
TODAY="$(date +%F)"
STAMP="$(date +%FT%H:%M)"

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# node installed through nvm has no stable path: a NON-INTERACTIVE shell does
# NOT have it on PATH. Found by running the script by hand; a non-interactive
# run would have failed silently. Resolve the current version through nvm.sh,
# with a fallback on the newest installed version. Keep this block: it matters
# the moment the script is started any other way than from a login terminal.
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
pget() { node "$ROOT/tools/setup/profile-get.mjs" "$1"; }

LINKEDIN_ON="$(pget LINKEDIN.enabled 2>/dev/null || echo false)"
RECO_ON="$(pget LINKEDIN.recommended 2>/dev/null || echo false)"
DELEGATE="$(pget AUTOMATION.llmDelegate 2>/dev/null || echo none)"

ATS_OUT="$DIGESTS/.$TODAY-ats.txt"
ATS_CSV="$DIGESTS/$TODAY-ats.csv"
LI_CSV="$DIGESTS/$TODAY.csv"
LI_DUMP="$DIGESTS/.$TODAY-dump.json"
RECO_CSV="$DIGESTS/$TODAY-reco.csv"
RECO_DUMP="$DIGESTS/.$TODAY-reco-dump.json"
ATS_NEW=0
LI_KEPT=0
RECO_KEPT=0
LI_STATUS="not run"

# Rows of a CSV minus its header, never negative.
rows() { [ -f "$1" ] || { echo 0; return; }; local n; n=$(( $(wc -l < "$1" | tr -d ' ') - 1 )); [ "$n" -lt 0 ] && n=0; echo "$n"; }

# --- Source A: public ATS boards ------------------------------------------------
if cd "$WATCH" 2>/dev/null; then
  if timeout 900 node watch.mjs --quiet --csv="$ATS_CSV" > "$ATS_OUT" 2>&1; then
    # ⚠️ `grep -c` prints 0 AND exits non-zero when it finds nothing: a
    # `|| echo 0` appended a SECOND 0, the variable became "0\n0", and the
    # numeric test below broke. Take the first line and default it instead.
    ATS_NEW=$(grep -c 'ACTIONABLE\|FYI only' "$ATS_OUT" 2>/dev/null | head -1)
    ATS_NEW=${ATS_NEW:-0}
    log "ATS: $ATS_NEW new req(s) kept"
    # A board that fails is a company no longer watched: say it here too.
    grep -q '^⚠⚠ INCIDENT' "$ATS_OUT" && log "ATS: ⚠ board incident(s), read the top of $ATS_OUT"
  else
    log "ATS: poller failed, see $ATS_OUT"
  fi
  [ "$(rows "$ATS_CSV")" -eq 0 ] && rm -f "$ATS_CSV"
else
  log "ATS: $WATCH not found"
fi

# --- Source B: LinkedIn ------------------------------------------------------------
if [ "$LINKEDIN_ON" != "true" ]; then
  LI_STATUS="disabled in profile (LINKEDIN.enabled)"
  log "LinkedIn: $LI_STATUS"
elif cd "$CLIENT" 2>/dev/null; then
  # ⚠️⚠️ THE GATE IS `doctor`, NOT `whoami`. `whoami` only tests the session:
  # a retired Voyager decoration leaves the session valid and returns an EMPTY
  # scan, which this script used to report as "nothing new". That is
  # indistinguishable from a quiet week. `doctor` tests the endpoints and exits
  # 1 if one is dead; its first check is the session, so it covers whoami.
  # ⚠️ `--require` limits the verdict to the checks THE SCAN depends on.
  # `filters` and `preferences` only serve the commands of the same name:
  # requiring them here would skip a scan that would have run perfectly.
  DOCTOR_OUT="$DIGESTS/.$TODAY-doctor.txt"
  if timeout 300 node linkedin.mjs doctor --require session,search,detail > "$DOCTOR_OUT" 2>&1; then
    # ⚠️⚠️ TWO-STEP WRITE. `> "$LI_DUMP"` TRUNCATES the file the instant the
    # shell opens the redirection, BEFORE the scan has produced a single line.
    # A re-run that died midway once left a 0-byte dump and destroyed the 655
    # postings of the previous pass: `retriage` had nothing left to replay.
    # Write to a temporary file, replace the dump only on success.
    LI_TMP="$LI_DUMP.partiel"
    if timeout 5400 node linkedin.mjs scan --json > "$LI_TMP" 2>"$DIGESTS/.$TODAY-scan.log" && [ -s "$LI_TMP" ]; then
      mv -f "$LI_TMP" "$LI_DUMP"
      # No --top: the digest holds ALL survivors. Without a score, cutting at N
      # hides at random (a cut at 10 once hid 36 of 46 survivors).
      timeout 900 node linkedin.mjs retriage "$LI_DUMP" --csv "$TODAY.csv" >/dev/null 2>&1
      LI_KEPT=$(rows "$LI_CSV")
      LI_STATUS="OK, $LI_KEPT kept"
      log "LinkedIn: $LI_STATUS"

      # --- Source C: the recommended feed ----------------------------------------
      # A different angle from the keyword axes: the postings LinkedIn pushes
      # itself, built from the account's declared preferences. Its failure is
      # NOT blocking: the axis scan stays the main source.
      # ⚠️ Its quality depends on invisible account settings (a remote-location
      # block once held a second country and let foreign postings in):
      # `node linkedin.mjs preferences` shows them.
      if [ "$RECO_ON" = "true" ]; then
        RECO_TMP="$RECO_DUMP.partiel"
        if timeout 3600 node linkedin.mjs recommended --json > "$RECO_TMP" 2>"$DIGESTS/.$TODAY-reco.log" && [ -s "$RECO_TMP" ]; then
          mv -f "$RECO_TMP" "$RECO_DUMP"
          timeout 900 node linkedin.mjs retriage "$RECO_DUMP" --csv "$TODAY-reco.csv" >/dev/null 2>&1
          RECO_KEPT=$(rows "$RECO_CSV")
          log "Recommended: $RECO_KEPT kept"
        else
          rm -f "$RECO_TMP"
          log "Recommended: failed, see $DIGESTS/.$TODAY-reco.log (non-blocking)"
        fi
      fi
    else
      rm -f "$LI_TMP"
      LI_STATUS="scan failed"
      log "LinkedIn: failed, see $DIGESTS/.$TODAY-scan.log"
    fi
  else
    # The scan is SKIPPED rather than run anyway: a scan on a broken client
    # produces an empty, misleading digest, which is worse than no digest.
    LI_STATUS="CLIENT KO, scan skipped"
    log "LinkedIn: doctor failed, scan SKIPPED (an empty digest would be misleading)."
    sed 's/^/    /' "$DOCTOR_OUT" 2>/dev/null
    log "  If the session is the cause: start Chrome (tools/browser/launch-chrome.sh),"
    log "  log into LinkedIn in it, then: cd $CLIENT && node linkedin.mjs auth"
    log "  If a decoration is dead: re-derive it, method in tools/linkedin/README.md"
  fi
else
  LI_STATUS="client not found"
  log "LinkedIn: $CLIENT not found"
fi

# --- Nothing new anywhere: stop here -------------------------------------------------
if [ "$ATS_NEW" -le 0 ] && [ "$LI_KEPT" -le 0 ] && [ "$RECO_KEPT" -le 0 ]; then
  log "nothing new on any source"
  exit 0
fi

# --- Report ------------------------------------------------------------------------
{
  echo "================================================================"
  echo "  SCAN — $TODAY"
  echo "================================================================"

  if [ "$LI_KEPT" -gt 0 ]; then
    echo
    # ⚠️ Columns chosen BY NAME through csv-table.mjs, never by awk index.
    echo "-- LinkedIn: $LI_KEPT posting(s) kept --"
    node "$ROOT/tools/csv-table.mjs" "$LI_CSV" posted_on title company location_remote --limit 12 2>&1
    echo "  -> $LI_CSV"
  else
    echo
    echo "-- LinkedIn: $LI_STATUS --"
  fi

  if [ "$RECO_KEPT" -gt 0 ]; then
    echo
    echo "-- Recommended by LinkedIn: $RECO_KEPT posting(s) --"
    node "$ROOT/tools/csv-table.mjs" "$RECO_CSV" posted_on title company location_remote --limit 12 2>&1
    echo "  -> $RECO_CSV"
  fi

  if [ "$ATS_NEW" -gt 0 ]; then
    echo
    echo "-- ATS boards: $ATS_NEW new req(s) --"
    grep -A2 'ACTIONABLE' "$ATS_OUT" 2>/dev/null | sed 's/^/  /' | head -40
    echo "  -> $ATS_OUT"
  fi

  echo
  echo "-- NEXT --"
  echo "  Open a session in this repo and say: \"read the job-scout skill\"."
  echo "  These rows are NOT judged: read each body for minimum qualifications,"
  echo "  real stack, salary band, and check the posting is still live on its"
  echo "  own ATS before investing in an application."
  echo
} 2>&1

# --- Optional interpretation by an LLM CLI (AUTOMATION.llmDelegate) ----------------
# 'none' is the default: run by hand, the session reads the digests just as well.
#
# ⚠️ The data is PASSED ON STDIN, never read by the CLI. Given file paths, one
# CLI in read-only mode fetched the file from the REMOTE git host through an
# MCP server, so it read the pushed version and not the local disk, and the
# ATS reports are gitignored: it would never have seen them. Cost on top:
# 32 600 tokens against 7 100 on stdin. `-c 'mcp_servers={}'` turns MCP off,
# which also keeps an interactive MCP auth from hanging the run.
build_context() {
  echo "### PROFILE (profile/profile.mjs)"
  for k in CANDIDATE.headline CANDIDATE.yearsExperience CANDIDATE.baseCity CANDIDATE.baseCountry \
           TARGET.shape TARGET.titles TARGET.salaryFloor TARGET.currency GEO.salaryFloorAbroad \
           STACK.positive STACK.negativeInTitle RULES.followUps; do
    echo "$k = $(pget "$k" 2>/dev/null)"
  done
  echo
  echo "### APPLICATIONS ALREADY SENT (one application per company)"
  node "$ROOT/tools/csv-table.mjs" "$ROOT/applications/applications.csv" company role status --limit 100000 --width 60 2>/dev/null
  [ -f "$LI_CSV" ] && { echo; echo "### LINKEDIN DIGEST $TODAY"; cat "$LI_CSV"; }
  [ -f "$RECO_CSV" ] && [ "$RECO_KEPT" -gt 0 ] && { echo; echo "### LINKEDIN RECOMMENDED $TODAY"; cat "$RECO_CSV"; }
  [ -f "$ATS_OUT" ] && [ "$ATS_NEW" -gt 0 ] && { echo; echo "### NEW ON ATS BOARDS"; cat "$ATS_OUT"; }
}

PROMPT="Job scan of $TODAY. The data is in the stdin block: read no file, call no tool.
1. Drop anything from a company already in the applications list.
2. Drop what falls under a hard exclusion of the profile or under the salary floor.
3. Rank the rest by real interest, weighing the company's ceiling (strong product
   versus agency or service) and how realistic the process is.
4. Return AT MOST 10 lines: what deserves an application and why, what you drop and
   why, and the number of applications in flight. Never propose a follow-up unless
   RULES.followUps is a number of days.
5. If nothing is worth it, say so in one sentence.
Remind in one line that these rows are NOT judged on the posting body, so minimum
qualifications, real stack and salary band remain to be checked.
Fill no form, modify nothing, commit nothing."

REPORT="$DIGESTS/.$TODAY-report.md"
case "$DELEGATE" in
  codex)
    if command -v codex >/dev/null 2>&1; then
      build_context | timeout 1800 codex exec -c 'mcp_servers={}' -s read-only --color never \
          -o "$REPORT" "$PROMPT" >/dev/null 2>&1 \
        && { echo; echo "-- READ BY CODEX --"; sed 's/^/  /' "$REPORT"; echo "  -> $REPORT"; } \
        || log "Codex unavailable or failed: the text report above stays usable"
    else
      log "AUTOMATION.llmDelegate is codex but codex is not on PATH"
    fi
    ;;
  claude)
    # ⚠️⚠️ If this Claude account is a seat of the CURRENT EMPLOYER's team, a job
    # search running on it leaves a trace on the employer's account. That
    # contradicts "do not get spotted before signing". It also draws on the same
    # quota as the interactive sessions. The init interview asks about this;
    # switch to 'none' or 'codex' if in doubt.
    log "⚠ llmDelegate=claude: make sure this is NOT an employer-owned Claude seat."
    if command -v claude >/dev/null 2>&1; then
      build_context | timeout 1800 claude -p "$PROMPT" > "$REPORT" 2>/dev/null \
        && { echo; echo "-- READ BY CLAUDE --"; sed 's/^/  /' "$REPORT"; echo "  -> $REPORT"; } \
        || log "claude -p failed: the text report above stays usable"
    else
      log "AUTOMATION.llmDelegate is claude but claude is not on PATH"
    fi
    ;;
  *) ;; # none: the session interprets
esac

find "$DIGESTS" -name '.*-dump.json' -mtime +7 -delete 2>/dev/null
find "$DIGESTS" -name '.*-report.md' -mtime +30 -delete 2>/dev/null
find "$DIGESTS" -name '.*-ats.txt' -mtime +30 -delete 2>/dev/null
log "done"
