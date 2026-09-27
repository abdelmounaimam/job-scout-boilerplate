# ats-watch, the public ATS boards

Zero dependencies, Node 20+, **no authentication**: these endpoints are public JSON (Personio: XML). No browser, no cookie, nothing tied to an account. This is the source of the **high end** of the market: the companies with the highest ceiling recruit on their own ATS, while LinkedIn indexes whoever pays to post. The two sources are complementary, never one instead of the other.

| File | What it does |
|---|---|
| `adapters.mjs` | one adapter per ATS, normalised to `{ id, title, location, url, publishedAt, remote, pay, body? }`, plus `fetchBoard()` (pagination, per-ATS throttle, 429 retry). **Adding an ATS is a change in this file only.** |
| `filters.mjs` | title verdict, intermediary names, RULED_OUT lookup, tracker cross-check, slug variants. All rules come from `profile/profile.mjs`. |
| `watch.mjs` | the poller: new plausible reqs on the watchlist since last run |
| `discover.mjs` | cumulative discovery: probes slugs derived from `candidates.json`, promotes live boards |
| `probe.mjs` | verify one company before adding it (API, hosted page, newest req date), or read the ATS off a careers page |
| `probe-workday.mjs` | Workday tenants × site names, since the site cannot be derived from a name |
| `watchlist.json` | verified boards, polled by `watch.mjs` |
| `candidates.json` | names not probed yet, the discovery pool |
| `.seen.json`, `.tried.json` | gitignored state: ids already reported, slugs already probed |

```bash
node watch.mjs                 # only what is new since last run
node watch.mjs --all           # ignore state, show every match
node watch.mjs --reset         # mark everything as seen, report nothing
node watch.mjs --csv=../../digests/$(date +%F)-ats.csv
node discover.mjs              # read only: what it would add
node discover.mjs --promote    # add to the watchlist (and memoise the probes)
node discover.mjs --retry-all  # re-probe slugs already tried
node probe.mjs "Company Name"  # before adding anything by hand
node probe.mjs --careers https://company.com/careers
node probe.mjs workday <tenant> <site> [host]
```

## What the poller does and does not do

- **Title and location only.** It never reads a body, so it never replaces the triage. It answers one question: *has a new, plausible req appeared?* The body is read before investing, and the body can close what the title opened.
- **Senior titles are dropped here**, where the LinkedIn triage only flags them: LinkedIn has the body to nuance, the poller has nothing but the title.
- **Capped at 3 reqs shown per company**, since the rule is one application per company (one employer produced 14 near-identical reqs on day one).
- **"Already applied" is read from `applications/applications.csv` at every run**, with the word-prefix company match. A flag written once in the watchlist went stale: a board promoted the week an interview was running there came back ★ ACTIONABLE on that very req.
- **Board errors are printed FIRST, as an incident.** A board that moved to another ATS does not break the poller, it makes it silently one-eyed. Read the incident block at every run and fix the entry.

## Endpoints

| ATS | Endpoint | Traps |
|---|---|---|
| Ashby | `api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true` | `isRemote` is wrong **in both directions**; the body decides. Bodies come for free (`descriptionPlain`). A slug can carry the domain (`<name>.ai`). |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<slug>/jobs` | a company that leaves for another ATS turns this into a 404. The **location facet of the req** is authoritative over the company's prose ("full remote from Europe" over a facet listing four countries, without the home one). |
| Lever | `api.lever.co/v0/postings/<slug>?mode=json` | `createdAt` is **not** a publication date (evergreen reqs show years-old dates). The API can **outlive the board**: `jobs.lever.co/<slug>` returning 404 while the API serves reqs means a dead board. Some companies file engineering reqs under a non-engineering `team`: never filter on `team`. |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/<Slug>/postings?limit=100&offset=N` | identifier **case sensitive** (wrong case = empty list, not an error), paginated, capped at 300. An unknown slug answers `totalFound: 0`. |
| Teamtailor | `https://<slug>.teamtailor.com/jobs.json` or a custom `domain` | no location field in the feed (it is in `_jobposting.jobLocation`), **the only feed that carries the body** (`content_html`). A custom careers domain breaks the default host: set `domain`. |
| Workable | `apply.workable.com/api/v1/widget/accounts/<slug>?details=true` | **rate limits hard**: 351 of 416 probes returned 429 at three concurrent requests, and a `continue` on `!r.ok` made that read as "no board". Throttled to one call per 900 ms, 429 retried. Location is **flat** (`city`, `state`, `country`). |
| Recruitee | `https://<slug>.recruitee.com/api/offers/` | `/api/offers/<offer>` returns the **form questions** for free (`open_questions`): the employment vehicle (employee vs contractor, residents only) hides there. |
| Personio | `https://<slug>.jobs.personio.de/xml` | XML, parsed by hand. |
| Workday | `POST https://<tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` | needs tenant **and** site (read both off the careers URL), POST with a JSON body, `limit` capped at 20, `total` sent **on the first page only**, `externalPath` is the only unique id, some tenants put the location in `bulletFields`. Not in discovery: use `probe-workday.mjs`. Never filter server-side with `searchText`: a text filter that misses a posting misses it silently. |

No public API (stay manual, with a cadence and an observable trigger): Avature (HTML only, paginated by `jobOffset`, 12 per page whatever you ask), SuccessFactors, Taleo, iCIMS, Jibe/Phenom (pagination parameters may be **ignored** and return the same 10 results, which fabricates duplicates: read the total and the location facet instead), bespoke sites. Welcome to the Jungle sits behind Cloudflare, but its search runs on a public Algolia index (see `docs/`).

## The rules of the watchlist

1. **Never guess a slug.** Verify it with `probe.mjs`. A wrong slug looks exactly like a company with no openings.
2. **A slug that answers is not proof it is the right company.** Eyeball the titles. Known collisions go into `_collisions_do_not_add`.
3. **The hosted page is the test, not the API**, and the newest req date tells a live board from a dead one.
4. **A mass probe that returns zero is re-measured slowly before it is written down as a fact.** A swallowed 429 is indistinguishable from an absent board. The same family: an HTTP 200 with a 40-byte body for a company that does not exist, `totalFound: 0` for a wrong slug. A 200 empty answer is not an absence, and an absence is not a 200 empty answer.
5. **When a known company answers on no ATS, read the careers link on its own site** before writing "no public board" (`probe.mjs --careers`). Discovery derives slugs from the name and cannot find a slug that carries the domain.
6. **`name` is the real company name, spelled as in the tracker**, so the one-application-per-company cross-check can match it.
7. **Discovery is slow and silent**: hours for a few thousand probes, nothing printed before the end. Background it with the output redirected, never under a short timeout: a killed pass loses everything, `.tried.json` included. `.tried.json` is written only with `--promote`, otherwise a read-only run burns the slugs the next `--promote` needs.
8. **After a `--promote`, run `watch.mjs --quiet` once** to record the baseline, then read the new names: product company, or agency, marketplace, internal IT? A recruiting marketplace can run an Ashby board with hundreds of other companies' offers on it: if a board lists other companies' jobs, it is an intermediary.
