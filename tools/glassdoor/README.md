# Derived Glassdoor client (read only)

Derived with the same method as the [LinkedIn client](../linkedin/README.md):
capture the traffic from a normal session, then replay the pages directly. It
reads a company's employee reviews, interview reports and salary grids **before
an interview**, without browsing by hand.

**Scope: read only.** No write on Glassdoor. No review posted, no "helpful"
vote, nothing. The account is there to read, full stop.

## Install

Nothing to install. Node 20+ (native `fetch`), zero dependencies. The browser
fallback needs `agent-browser` and a Chrome listening on CDP 9222
(`tools/browser/launch-chrome.sh`).

## Use

```bash
cd tools/glassdoor

# 1. Chrome must run with a Glassdoor session open
#    ! tools/browser/launch-chrome.sh      (from the repo root)
node glassdoor.mjs auth                 # exports the cookies → .session.json (gitignored)
node glassdoor.mjs whoami               # checks it answers

# 2. Read
node glassdoor.mjs find "Acme"                       # → 1234567  Acme
node glassdoor.mjs salaries   "Acme"
node glassdoor.mjs interviews "Acme" --pages 3
node glassdoor.mjs reviews    "Acme" --pages 2 --limit 20

# 3. The pre-interview brief, all at once, in markdown
node glassdoor.mjs brief "Acme" --pages 3 \
  --out ../../interview-prep/acme/glassdoor-$(date +%F).md
```

Every command accepts an **id**, a **Glassdoor URL** or a **company name**.
⭐ **The URL is the most reliable path**: it already carries the slug and the id,
so it costs no resolution request.

Options: `--pages N` (5 entries per page), `--limit N` for display, `--json` for
full detail (every percentile, ratings per axis), `--out file.md` for `brief`,
`--cdp 9222` if Chrome listens elsewhere, `--site com|co.uk|fr` for the national
site (default `$GLASSDOOR_SITE`, else `com`).

The brief gives, in the order one wants them the day before: the salary grid
(base P25 to P75, median, P90, and total median), the interview reports with
**the questions actually asked** and the processes described, then the reviews.

## National sites

Glassdoor's URL paths differ between national sites, and it is **not** a
mechanical translation: on `.fr`, `/Reviews/` becomes `/Avis/`, `/Interview/`
becomes `/Entretien/` with an entirely different slug, and `/Salary/` becomes
`/salaire/` in lower case. The paths live in the `SITES` table of
`glassdoor.mjs`.

| Site | Status |
|---|---|
| `fr` | derived and verified end to end |
| `com`, `co.uk` | Glassdoor's public URL pattern for those sites; check once with `find` then `reviews --pages 1` before trusting a brief |
| anything else | add a row to `SITES`, reading the paths off a real page of that site |

## ⚠️⚠️ The hard point: why the browser stays in the loop

The brief was "never a browser again, just the token". **It works, then it
stops**, and one must know it before counting on it.

The direct mode served about fifteen pages, then **Cloudflare answered 403 to
everything**, including the page that worked twenty minutes earlier, and
including right after an `auth` that brought back a fresh `cf_clearance` cookie.
At the same moment, the real Chrome loaded the page without a blink.

**The cause is not the cookie, it is the TLS fingerprint.** Cloudflare
fingerprints the TLS handshake, Node's is not Chrome's, and `cf_clearance` is
tied to the fingerprint that obtained it. A cookie taken from Chrome and
replayed from Node is therefore valid for a while, then burnt.

**Assumed choice: we do not imitate Chrome's fingerprint.** The client tries the
direct mode, free and fast when it passes, and **falls back to the browser by
itself** as soon as it stops passing, saying so on `stderr`:

```
⚠️  Cloudflare refuses direct calls, switching to the browser.
```

So in practice: **Chrome must be running**. The direct mode is a bonus, not a
guarantee. And the useful work of this client was never the transport, it is
decoding the payload, in [`flight.mjs`](./flight.mjs).

## How it is derived

**Glassdoor has no readable JSON API.** The three paths tried, in order:

1. **The GraphQL endpoint `/graph` exists** and answers, but it is a dead end:
   introspection is **disabled** (`INTROSPECTION_DISABLED`) and validation errors
   are masked as `"Server error"`, so no argument signature can be guessed by
   trial and error. Probing the root fields only teaches that
   `employerReviewsRG` and `salariesByEmployer` exist, not how to call them.
2. **Capturing the page's traffic** yields nothing usable either: the only
   `/graph` calls of a review page are telemetry (`RecordPageView`). The data
   does not travel that way.
3. ✅ **The pages are rendered server side.** It is a Next.js App Router site:
   the data arrives IN the HTML, as a React Server Components payload pushed by
   `self.__next_f.push([1,"..."])`. Read the page, glue the chunks, get the JSON
   out. That is what `flight.mjs` does.

The JSON obtained is **richer than what the page shows**: nine salary
percentiles per role instead of one range, and ratings per axis to the tenth.

## Traps met while deriving (costly to rediscover)

- **The name in the URL is not decorative.** `xx-Avis-E<id>.htm` returns 404,
  `<Name>-Avis-E<id>.htm` returns 200. The canonical slug is needed, not only the
  id. `/Overview/-EI_IE<id>.htm` gives it by redirecting to a URL carrying the
  name **plus the character offsets**: `Working-at-Acme-EI_IE1234567.11,15.htm`,
  where `11,15` cuts "Acme" out. Glassdoor documents itself where to read its
  own name.
- ⚠️ **And that slug-less URL is the one Cloudflare flags fastest**, because no
  human types that shape. It goes through the browser fallback, otherwise id
  resolution breaks before anything else.
- **Glassdoor serves its 404s as 200.** And do NOT test for the "we looked
  everywhere" sentence in the HTML: it also lies in the bundle of valid pages,
  which gets perfectly good pages rejected. The only reliable marker is the
  `<title>`, generic (`Glassdoor | Glassdoor`) on a 404 and descriptive otherwise.
- ⚠️⚠️ **Two consecutive text blocks of the payload are NOT separated by a
  newline.** One reads `...candidate experience.4a:T774,Honestly, my
  experience...` in one piece. A regex anchored on `^` or `\n` misses one block
  out of two, **silently**: the field stays `"$4a"` and the interview account
  disappears with no error. This is the bug that cost the longest debugging pass.
- **Text block lengths are in UTF-8 BYTES, not characters.** Slicing on a
  character length truncates every accented text. Slicing happens on a `Buffer`.
- **Never `decodeURIComponent` a whole HTML page**: it throws "URI malformed" as
  soon as a stray `%` sits in the page, and there always is one. Match on the
  raw text, decode only the captured group.
- **Two plausible search URLs do not work**, and each one costs time:
  `/Avis/company-reviews.htm?sc.keyword=X` returns **404**, and
  `/Avis/index.htm?keyword=X` returns **200 but ignores the keyword** and lists
  the biggest employers. The right one is **`/Search/results.htm?keyword=X`**,
  whose links carry the offset format above.
- **`ratings.reviewCount` is not the number shown.** On one company: **180** in
  the payload, **116** on screen. Both are true, they do not count the same thing
  (all languages against one national site). The client returns both rather than
  choosing.
- **The range shown is a P25-P75 of TOTAL pay.** A "42k - 52k" hid: base median
  47k, base P90 53k, total median 49k, total P90 55k. The difference changes a
  negotiation, so `--json` returns every percentile, base and total apart.
- **Same trap as on LinkedIn**: `agent-browser cookies get` is carried by the
  **active tab**, not by the browser. From an ATS tab it returns nothing of
  Glassdoor. `auth` therefore switches to a glassdoor tab by itself.

## Lead not pursued

Salary pages exist **per department**:
`/salaire/<Name>-Engineering-Salaires-EI_IE<id>.0,4_DEPT1007.htm` (`DEPT1007` =
Engineering, `DEPT1013` = Marketing, `DEPT1021` = Sales…). That would give bands
filtered on engineering alone, without the sales roles that pull the medians.
Not wired, for lack of need.

## How to read what it outputs

⚠️ **Glassdoor is self-selected and leans negative**: people write when they
leave angry. The harshest reviews come from former employees, the positive ones
often from people in post. What counts is never one review, it is **what repeats
across several years and several roles**, and what both camps concede at once.

⚠️ **A company of fewer than ~50 people often has NO page at all.** That is not a
failure of the client, and it is not good news: it is **zero public counterweight
before signing**.

⛔ **Never mention Glassdoor in an interview.** This reading serves to ask better
questions, not to make accusations.

## Pace

1.8 to 3 s between two requests, and it is not negotiable: Cloudflare sits in
front of Glassdoor, a home or office IP is fixed, and burning the session costs a
manual intervention in the browser.

## Never commit

`.session.json` holds the session cookies in clear (written `0600`), and a `.har`
capture holds them too. Both are gitignored here and at the repo root.
