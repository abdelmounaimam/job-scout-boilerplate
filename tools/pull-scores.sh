#!/usr/bin/env bash
# Copies the scores of the dashboard's Evaluations review queue (SQLite on the host's
# volume) into evals/scores.jsonl, so git keeps their history and the LLM judge
# can calibrate from the repo (evals/README.md, layer 3).
#
# ⚠️ The dashboard password is NEVER written in the repo. It is read at every run
# from the service's variables on Railway (ids from .env, like the deploy), or
# taken from an exported DASHBOARD_PASSWORD (a local server, another host).
#
# Usage: tools/pull-scores.sh                 (DASHBOARD_URL in .env or exported)
#        DASHBOARD_URL=http://127.0.0.1:8080 DASHBOARD_PASSWORD=… tools/pull-scores.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/evals/scores.jsonl"

# Exported values win over .env.
_url="${DASHBOARD_URL:-}"; _pw="${DASHBOARD_PASSWORD:-}"; _user="${DASHBOARD_USER:-}"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
URL="${_url:-${DASHBOARD_URL:-}}"
PASSWORD="${_pw:-${DASHBOARD_PASSWORD:-}}"
USER_="${_user:-${DASHBOARD_USER:-}}"
[ -n "$URL" ] || { echo "✗ DASHBOARD_URL missing: set it in .env (the dashboard's public URL) or export it" >&2; exit 1; }

json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)[process.argv[1]];console.log(v??"")})' "$1"; }

if [ -z "$PASSWORD" ]; then
  for v in RAILWAY_PROJECT_ID RAILWAY_ENVIRONMENT_ID RAILWAY_SERVICE_NAME; do
    [ -n "${!v:-}" ] || { echo "✗ $v missing in .env, and no DASHBOARD_PASSWORD exported" >&2; exit 1; }
  done
  command -v railway >/dev/null 2>&1 || export PATH="$(npm prefix -g 2>/dev/null)/bin:$PATH"
  command -v railway >/dev/null 2>&1 || { echo "✗ railway CLI not found (npm i -g @railway/cli)" >&2; exit 1; }
  VARS="$(railway variables --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" \
    --service "$RAILWAY_SERVICE_NAME" --json)"
  PASSWORD="$(printf '%s' "$VARS" | json_get DASHBOARD_PASSWORD)"
  [ -n "$USER_" ] || USER_="$(printf '%s' "$VARS" | json_get DASHBOARD_USER)"
  [ -n "$PASSWORD" ] || { echo "✗ DASHBOARD_PASSWORD not found in the service's variables" >&2; exit 1; }
fi
# Same login resolution as server.ts: DASHBOARD_USER, else the profile's.
[ -n "$USER_" ] || USER_="$(node "$ROOT/tools/setup/profile-get.mjs" DASHBOARD.basicAuthUser 2>/dev/null || echo candidate)"

# Written to a temporary file, then moved: an API answering garbage must not
# empty the existing mirror silently.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
curl -sf -u "$USER_:$PASSWORD" "${URL%/}/api/scores" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=JSON.parse(s);if(!Array.isArray(l))process.exit(1);process.stdout.write(l.map(x=>JSON.stringify(x)).join("\n")+(l.length?"\n":""))})' \
  > "$TMP"
mkdir -p "$(dirname "$OUT")"
mv "$TMP" "$OUT"
trap - EXIT
echo "$(grep -c . "$OUT" || true) score(s) → evals/scores.jsonl"
