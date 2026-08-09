---
name: job-scout
description: End-to-end job search pipeline, from collecting postings to applying and following up. Use for any watch ("find me postings", "scan"), any application ("apply to", "fill this form"), any follow-up (chasers, replies received, interviews), and to pick the context back up at the start of a session. Covers the public ATS sources, triage, agent-driven form filling and the application tracker.
---

# Job scout — the whole pipeline

Single entry point. This file **orchestrates** and points at the detail documents; it does not duplicate them. Where a rule appears here **and** elsewhere, this one is the summary and the other is authoritative.

## The five phases

```
1. COLLECT   → public ATS boards + open-web search by agents
2. TRIAGE    → hard filters (deterministic), dedup against history
3. JUDGE     → read the bodies, one verdict per posting, the human decides
4. APPLY     → agent fills, VERIFY, then send
5. FOLLOW UP → applications.csv, chasers, replies by email
```

## Document map

| Need | File |
|---|---|
| **Agent rules for this repo** (loaded automatically) | [`CLAUDE.md`](../../../CLAUDE.md) |
| **The single tuning surface**: filters, stack, geography, floor, sourcing | [`profile/profile.mjs`](../../../profile/profile.mjs) |
| Experience canon (source of truth) | [`profile/experiences.md`](../../../profile/experiences.md) |
| **Form-filling recipes per ATS** | [`applications/ats-playbook.md`](../../../applications/ats-playbook.md) |
| Reusable answers to recurring ATS questions | [`applications/answers-bank.md`](../../../applications/answers-bank.md) |
| Letters and free-text answers already written, per posting | [`applications/cover-letters.md`](../../../applications/cover-letters.md) |
| Application tracker | [`applications/applications.csv`](../../../applications/applications.csv) |
| Watchlist (verified slugs) | [`tools/ats-watch/watchlist.json`](../../../tools/ats-watch/watchlist.json) |
| Discovery pool (names not yet probed) | [`tools/ats-watch/candidates.json`](../../../tools/ats-watch/candidates.json) |

---

## Phase 1 — COLLECT

Three sources, **complementary, never interchangeable**. None of them needs authentication: these endpoints are public JSON, so no browser, no cookie, nothing traceable to an account.

### a) Daily poller over the watchlist — automated, in cron

```bash
cd tools/ats-watch
node watch.mjs            # only reqs that are NEW since last run
node watch.mjs --all      # ignore state, show every match
node watch.mjs --reset    # baseline everything without reporting
```

⚠️ **Scope: TITLE and LOCATION only.** It does not download descriptions, so it does not replace triage. It answers one question: "has a new plausible req appeared?" **Reading the body stays mandatory before investing.**
⚠️ It **drops** senior titles where a body-reading triage would only flag them. Deliberate: it has nothing but the title.
⚠️ Capped at 3 reqs shown per company, because the rule is one application per company.

Adding a company to the watchlist means **verifying its slug first, never guessing**:

```bash
node probe.mjs "Company Name"        # tries every ATS and every slug variant
node probe.mjs ashby acme --jobs     # checks one exact pair
```

### b) Weekly discovery — automated, cumulative

```bash
cd tools/ats-watch
node discover.mjs              # read-only: shows what it would add
node discover.mjs --promote    # adds the findings to watchlist.json
node discover.mjs --retry-all  # re-probes slugs already tried
```

It derives slugs from the names in `candidates.json`, probes every ATS, and **promotes** any live board with a plausible req. **This is what makes weekly discovery useful rather than repetitive: it accumulates.** Every pass permanently widens what the daily poller covers, and a slug already tried without success is not re-probed, so passes get shorter over time.

⚠️ **`.tried.json` is written only with `--promote`.** Otherwise a read-only pass burns the slugs it just found and the `--promote` run right after sees nothing. That cost a full discovery pass once.
⚠️ It only finds companies whose **name is already in the pool**. Adding names is nearly free: a name that answers on no API costs a handful of failed requests.

### c) Open-web search by agents — the two workflows

```
Workflow({name: "job-scout-bootstrap"})                      # ONCE at setup, then every 2-3 months
Workflow({name: "job-scout-web"})                            # weekly, default profile
Workflow({name: "job-scout-web", args: "backend TS, Berlin"}) # targeted
```

- **`job-scout-bootstrap`** builds the watchlist from zero: parallel agents sweep the open web per market segment, then **every slug is verified against the live API** before it is written. Its real output is not a list of jobs, it is a verified watchlist plus a pool of names that keeps the weekly discovery productive for months.
- **`job-scout-web`** searches for postings along six blind angles, deduplicates, **opens and verifies each posting one by one**, and writes `digests/<date>-web.csv` plus an analysis. It **never applies** and writes only into `digests/`. It proposes names for `candidates.json`, it does not add them.

**What these do that the poller cannot: the poller only sees boards on its list, and discovery only probes names already written down.** These start from the open web.

### Public ATS endpoints

```
Lever            api.lever.co/v0/postings/<co>?mode=json
Greenhouse       boards-api.greenhouse.io/v1/boards/<co>/jobs      (+ .eu. for the EU domain)
Ashby            api.ashbyhq.com/posting-api/job-board/<co>?includeCompensation=true
SmartRecruiters  api.smartrecruiters.com/v1/companies/<Co>/postings?limit=100&offset=N   ⚠ case + pagination
Teamtailor       https://<slug>.teamtailor.com/jobs.json   ⚠ or a custom domain; carries the body
Workable         apply.workable.com/api/v1/widget/accounts/<co>?details=true   ⚠ aggressive 429, flat location
Recruitee        https://<slug>.recruitee.com/api/offers/
Personio         https://<slug>.jobs.personio.de/xml       ⚠ XML, not JSON
```

⚠️ **A mass probe that returns zero must be re-measured slowly before it is written down as a fact.** A 429 swallowed by a `continue` is indistinguishable from a board that does not exist. One such measurement declared an ATS entirely dead across 416 slugs; three real boards had been there the whole time.

### d) Dated targets, outside the automated poller

Boards with no queryable API stay manual. Keep them in a table with a **cadence and a trigger**, in `tools/ats-watch/watchlist.json` under `_no_public_api`, and check them on that cadence rather than on impulse.

---

## Phase 2 — TRIAGE

Filters live in [`profile/profile.mjs`](../../../profile/profile.mjs). Nothing else encodes a preference.

**Hard exclusions, in the order that removes the most:**

1. **Adjacent function** (QA, Data, DevOps, security, support, PO) — surfaces on the same keywords without being the job
2. **Intermediary / agency / consultancy** — a name list **plus** a phrase detector. ⚠️ "our client" **singular** is the signal; "our clients" plural is ordinary SaaS vocabulary
3. **Closed stack in the title** — a foreign language in the title closes the role whatever the body says
4. **Dead posting** — closed, or a `PIPELINING-ONLY` style req id, which is a talent pool and not a funded role
5. **Level** — internship, apprenticeship, working student
6. **Salary** — a displayed band whose **top** falls under the floor

**Signals, not exclusions** (the posting comes through with a ⚠): a senior or lead title, no displayed band, a very high application count, a location outside the home country.

⚠️ **There is no numeric pre-score, on purpose.** The source pipeline had one and removed it: it measured keyword density, not fit. Its best target of the week scored 25/60, a technical-director role scored 41/60, and no decision all week was actually taken on the number. **What stays deterministic is what works: the hard exclusions.** They take a hundred postings down to a handful, for free, with no LLM, which is why they can run in cron.

**Triage produces FACTS, not an opinion**: years required (or "no floor stated"), the junior-friendly wording verbatim, management scope, salary band, level, stack found and stack missing. The digest carries `verdict` and `why` columns that the scripts leave **empty**.

**The judgement happens in session, posting by posting, and `why` must quote the line of the body it rests on.** Verdicts: `apply`, `read`, `drop`. Any verdict that closes a company for a structural reason goes into `RULED_OUT` in `profile.mjs`, which makes every later pass cheaper.

⚠️ **Never score "no relocation needed" as a bonus.** It over-ranks weak local postings and under-ranks the best ones. Price an expensive city into the salary band instead.

---

## Phase 3 — PROPOSE

- One CSV per scan in `digests/YYYY-MM-DD.csv`, **every survivor**, most recent first. No truncation: with no score, cutting hides at random.
- What does not fit a table goes into `digests/YYYY-MM-DD-analysis.md`: structural conclusions, companies to close, traps met.
- **Nothing disappears silently**: always print the count of drop reasons.
- **Read the minimum qualifications BEFORE proposing.** One posting named 21 technologies, half of them absent from the candidate's CV; another required a language the candidate does not write. Neither was visible from the digest line.
- **Always revalidate against the ATS right before investing.** Postings close in under 24 hours, and it has happened twice.

---

## Phase 4 — APPLY

**Triggered by the candidate, never spontaneously.** Detailed recipes per platform in [`ats-playbook.md`](../../../applications/ats-playbook.md).

### Non negotiable

1. **The resume language follows the language of the posting.** Never the reverse.
2. **One application per company**, even when several reqs match. Three applications at the same employer read as spam.
3. **Re-read every field after filling it, and the whole form before sending.** The focus bug reproduces on every ATS: a fill on a field that is not visible writes into the previously focused field.
4. **The mailbox is the oracle, not the page.** Several ATS close the panel on a **successful** send without displaying anything. Check for the confirmation email before concluding a failure, and never re-click in a loop.
5. **Who presses Submit** is set in `RULES.submittedBy`. `human` is the safe default and the one to keep on any priority target: one ATS flagged an agent-driven submission as possible spam and it never went out. Where the agent is allowed to submit, the filling must stay sober: one action per call, pauses, never two attempts on the same widget, one single send click.
6. **Never invent a story.** Not a project, not a metric, not a team.
7. **Never give the current salary.** Answer with the expectation.
8. **Write a letter wherever there is a field for one.** One application was rejected in seven hours with an empty letter.
9. **Never tick an attestation on the candidate's behalf** ("I personally completed this application").

### Generic recipe

1. Check the posting is still live against its ATS.
2. Map the fields (snapshot, then the labels via `label[for=...]`).
3. Handle cookie and consent banners **first**: they silently disable buttons.
4. Fill: checkboxes and dropdowns **first**, uploads next, **text fields LAST** (re-renders wipe text).
5. **Full re-read.**
6. Send, then confirm by email.
7. **Log it in `applications.csv`** with what was filled, and push any new recipe up into `ats-playbook.md`.

---

## Phase 5 — FOLLOW UP

- One row per application in `applications.csv`. Statuses: `applied`, `screening`, `interview`, `offer`, `rejected`, `closed`, `unfinished`.
- **Chase after the delay in `RULES.followUpAfterDays`.**
- On a rejection: find the real reason and write it down. One seven-hour rejection produced two reusable rules.
- On an interview: open `interview-prep/<company>/`, read the process the company publishes, and check that nothing claimed in the application is indefensible.
- **Update the progress log after every session.**

---

## Scheduled execution

Two scripts: [`tools/daily-scan.sh`](../../../tools/daily-scan.sh) (ATS boards, twice a day on weekdays) and [`tools/weekly-discover.sh`](../../../tools/weekly-discover.sh) (discovery, weekly).

```bash
crontab -l 2>/dev/null | { cat; echo "47 7 * * 1-5 $PWD/tools/daily-scan.sh >> $PWD/digests/cron.log 2>&1"; } | crontab -
crontab -l 2>/dev/null | { cat; echo "23 18 * * 1-5 $PWD/tools/daily-scan.sh >> $PWD/digests/cron.log 2>&1"; } | crontab -
crontab -l 2>/dev/null | { cat; echo "17 9 * * 6 $PWD/tools/weekly-discover.sh >> $PWD/digests/cron.log 2>&1"; } | crontab -
```

⚠️ **`node` installed through nvm is absent from cron's default PATH.** The scripts resolve it and fail loudly if they cannot. Without that, crons fail silently and everything looks fine.
⚠️ **What scheduling cannot do: apply.** Phase 4 stays manual, because each application spends the single shot available at that company.
⚠️ Think before wiring an LLM CLI into the cron: not on a quota shared with the candidate's interactive sessions, and **never on an account belonging to the current employer**.

---

## At the start of a session

Say "read the job-scout skill". Then, in order:

1. `applications/applications.csv` — where the pipeline stands, what to chase
2. the latest `digests/*.csv` and its analysis — what has already been seen and dropped
3. `CLAUDE.md` — loaded automatically, carries the current rules
