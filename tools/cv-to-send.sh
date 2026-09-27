#!/usr/bin/env bash
# Prepares THE file to upload in an application form.
#
# ⚠️ ABSOLUTE RULE: the resume sent to a recruiter ALWAYS carries the name in
# RESUME.uploadFileName (profile/profile.mjs), whatever its language and
# whatever the version. It is the name the recruiter sees in their ATS and in
# their downloads folder: `cv.pdf` drowns among a hundred other `cv.pdf`, and
# `cv-acme-fr.pdf` tells them on top that the resume was tailored for another
# company than theirs.
#
# WHY A SEPARATE STEP, AND NOT A RENAME AT THE SOURCE
# The working files MUST keep distinct names: one base resume per language
# coexists, and profile/cv/tailored/ holds one version per posting, which the
# `cv_version` column of applications.csv references to know what was really
# sent. Renaming everything to one name would destroy both. Hence this script:
# it picks the source and produces only a COPY, under the imposed name, in a
# single place (profile/cv/send/, gitignored). THAT path is what goes to the
# upload, never the source.
#
# Usage:
#   tools/cv-to-send.sh en                              base resume for that language (RESUME.byLanguage)
#   tools/cv-to-send.sh profile/cv/tailored/cv-x.pdf    a tailored version
#
# Prints the absolute path of the file to upload, on stdout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEND="$ROOT/profile/cv/send"
NAME="$(node "$ROOT/tools/setup/profile-get.mjs" RESUME.uploadFileName)"
[ -n "$NAME" ] || { echo "RESUME.uploadFileName is empty in profile/profile.mjs" >&2; exit 1; }

mkdir -p "$SEND"
target="$SEND/$NAME"

# ⚠️ DELETE FIRST, before even validating the source. The file name being
# always the same, ANY exit path that leaves the old file in place is a trap:
# the next upload would go out with the previous company's resume, under the
# right name, without a word. The first version of this script deleted after
# checking the source, so a missing source left the resume tailored for the
# previous company exactly where the next upload would look for it. Better no
# file than a stale file carrying the right name. Anything else in the folder
# goes too: it holds one file, always.
rm -f "$SEND"/*.pdf

arg="${1:?missing source: a language key of RESUME.byLanguage (en, fr, ...) or a path to a PDF}"

if [[ "$arg" =~ ^[a-z]{2}$ ]]; then
  rel="$(node "$ROOT/tools/setup/profile-get.mjs" "RESUME.byLanguage.$arg" 2>/dev/null)" \
    || { echo "no resume for language \"$arg\" in RESUME.byLanguage" >&2; exit 1; }
  src="$ROOT/$rel"
else
  src="$arg"
  [ -f "$src" ] || src="$ROOT/$arg" # accept a path relative to the repo root
fi

[ -f "$src" ] || { echo "source not found: $arg" >&2; exit 1; }
case "$src" in *.pdf) ;; *) echo "the source is not a PDF: $src" >&2; exit 1 ;; esac

cp "$src" "$target"

# Checks: an empty or truncated PDF uploads without an error and only shows at
# the recruiter's end, that is to say never.
pages="$(pdfinfo "$target" 2>/dev/null | awk '/^Pages:/{print $2}')"
[ -n "$pages" ] && [ "$pages" -ge 1 ] 2>/dev/null \
  || { echo "the copied PDF is unreadable or empty: $target" >&2; rm -f "$target"; exit 1; }

{
  echo "source : $src"
  sum="$( (sha256sum "$target" 2>/dev/null || shasum -a 256 "$target") | cut -c1-12)"
  echo "pages  : $pages · $(du -h "$target" | cut -f1) · sha256 $sum"
} >&2
echo "$target"
