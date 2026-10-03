#!/usr/bin/env bash
# Deploys the dashboard to Railway with the smallest possible upload surface.
#
# ⚠️ WHY A TEMPORARY DIRECTORY
# `railway up` uploads the current directory. Run from the repo root, it would
# ship everything to the build servers: the resume sources, the tracker's
# notes, interview prep, salary targets, whatever personal documents live in
# this repo. The build needs four things only: the dashboard sources, the
# tracker that build-data.mjs reads through ../applications/, the profile it
# reads for title, locale and currency, and the traced free texts of the
# Evaluations tab (evals/records.jsonl). This script rebuilds just that tree.
#
# ⚠️ The SCORES are not shipped from here: they live in the server's SQLite
# database, on a volume mounted at /data (SCORES_DB=/data/scores.sqlite). A
# deploy without that volume starts on an empty database. tools/pull-scores.sh
# mirrors them back into the repo.
#
# ⚠️ The temporary directory is linked to NO Railway project. Without explicit
# identifiers, `railway up` offers to create a new project, and you end up with
# one project per deployment. Hence the ids, read from .env.
#
# ⚠️ No railway.json is shipped: it is deprecated and stops working on
# 2026-12-01. The root Dockerfile is detected on its own.
#
# ⚠️ THE VERIFICATION THAT COUNTS is not "the script ran": it is the deployment
# in SUCCESS on Railway, THEN the URL answering 401 (serving, behind auth).
# A 404 means the service is dead: an expired trial plan once took it down
# while the script printed a clear error that a --detach run never showed.
#
# Usage : tools/deploy-dashboard.sh [--detach]   (extra args go to `railway up`)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

missing=()
[ -n "${RAILWAY_PROJECT_ID:-}" ] || missing+=(RAILWAY_PROJECT_ID)
[ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] || missing+=(RAILWAY_ENVIRONMENT_ID)
[ -n "${RAILWAY_SERVICE_NAME:-}" ] || missing+=(RAILWAY_SERVICE_NAME)
if [ "${#missing[@]}" -gt 0 ]; then
  echo "✗ Missing Railway identifier(s): ${missing[*]}" >&2
  echo "  Copy .env.example to .env at the repo root and fill them in." >&2
  echo "  Without them, 'railway up' from a temporary directory creates a NEW project." >&2
  exit 1
fi

command -v railway >/dev/null 2>&1 || export PATH="$(npm prefix -g 2>/dev/null)/bin:$PATH"
command -v railway >/dev/null 2>&1 || { echo "✗ railway CLI not found (npm i -g @railway/cli)" >&2; exit 1; }

for f in applications/applications.csv profile/profile.mjs dashboard/package.json dashboard/bun.lock Dockerfile; do
  [ -f "$ROOT/$f" ] || { echo "✗ $f not found: the build needs it" >&2; exit 1; }
done

UPLOAD="$(mktemp -d)"
trap 'rm -rf "$UPLOAD"' EXIT

mkdir -p "$UPLOAD/applications" "$UPLOAD/profile" "$UPLOAD/dashboard" "$UPLOAD/evals"
cp "$ROOT/applications/applications.csv" "$UPLOAD/applications/"
cp "$ROOT/profile/profile.mjs" "$UPLOAD/profile/"
# Free texts to score, baked at build like the CSV. Only this file of evals/
# ships (not the catalogue, not the scores mirror). Empty when none exists yet,
# because the Dockerfile copies it unconditionally.
if [ -f "$ROOT/evals/records.jsonl" ]; then cp "$ROOT/evals/records.jsonl" "$UPLOAD/evals/"; else : > "$UPLOAD/evals/records.jsonl"; fi
cp "$ROOT/Dockerfile" "$UPLOAD/"

# Dashboard sources, without build artefacts, dependencies, or generated data.
( cd "$ROOT/dashboard" && tar -cf - \
    --exclude=node_modules --exclude=dist --exclude=.git \
    --exclude='*.tsbuildinfo' --exclude=src/data/applications.json \
    --exclude=src/data/records.json --exclude='scores.sqlite*' \
    . ) | ( cd "$UPLOAD/dashboard" && tar -xf - )

echo "Upload surface: $(du -sh "$UPLOAD" | cut -f1), $(find "$UPLOAD" -type f | wc -l | tr -d ' ') files"
echo "Files shipped outside dashboard/:"
find "$UPLOAD" -type f -not -path '*/dashboard/*' | sed "s|$UPLOAD/|  |"

cd "$UPLOAD"
railway up \
  --project "$RAILWAY_PROJECT_ID" \
  --environment "$RAILWAY_ENVIRONMENT_ID" \
  --service "$RAILWAY_SERVICE_NAME" \
  "$@"

echo
echo "Now verify, the script running is not proof:"
echo "  1. the latest deployment of $RAILWAY_SERVICE_NAME is SUCCESS (railway status, or the Railway UI)"
echo "  2. curl -s -o /dev/null -w '%{http_code}' <dashboard URL>     → 401 = serving behind auth, 404 = dead"
echo "  3. the deploy log says « scores in /data/scores.sqlite » (a volume), never ./scores.sqlite"
