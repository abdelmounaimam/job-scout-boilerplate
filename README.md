# Job scout — a job search pipeline boilerplate

A complete, candidate-independent job search pipeline: it finds openings on the public ATS boards, searches the open web with parallel agents, filters them against one profile file, helps fill the application forms, and tracks what happens next.

Everything candidate-specific lives in **one file**, `profile/profile.mjs`. Point it at a different person and the whole pipeline follows.

No LinkedIn client, by design. Every collection path here runs on **public JSON endpoints**: no browser, no cookie, no account that can be tied back to the candidate.

---

## Set it up

```
Skill({skill: "job-scout-init"})
```

That skill asks for the candidate's inputs, rewrites `profile.mjs`, seeds the experience canon, and runs the bootstrap workflow that builds the ATS watchlist from zero. It is a one-time step, and it is the step that turns this template into someone's actual search.

## Use it

```
"read the job-scout skill"                        # start of any session
Workflow({name: "job-scout-web"})                 # weekly open-web sweep
Workflow({name: "job-scout-bootstrap"})           # every 2-3 months, wide re-sweep
node tools/ats-watch/watch.mjs                    # what is new since last run
node tools/ats-watch/probe.mjs "Company Name"     # verify a slug before adding it
```

---

## How it is put together

```
COLLECT ─┬─ daily poller     watch.mjs over the verified watchlist        cron, free
         ├─ weekly discovery discover.mjs over the name pool              cron, cumulative
         └─ agent search     job-scout-web / job-scout-bootstrap          on demand
    ↓
TRIAGE      hard exclusions from profile.mjs, no LLM, no score
    ↓
JUDGE       bodies read one by one, verdict quotes the line it rests on   human decides
    ↓
APPLY       ats-playbook.md recipes, verify, then send                    human triggers
    ↓
FOLLOW UP   applications.csv, chasers, replies
```

| Path | What it is | What it costs | What it cannot do |
|---|---|---|---|
| Daily poller | polls boards already on the watchlist | free, no auth | see a company not on the list |
| Weekly discovery | probes slugs derived from a pool of names | free, no auth | invent a name |
| Agent web search | reads the open web along blind angles | tokens | run unattended |

Each one covers the previous one's blind spot. **That is the whole architecture**, and it is why none of the three is optional.

---

## Layout

```
profile/
  profile.mjs          ← THE single tuning surface. Filters, geography, floor, rules.
  experiences.md       ← the experience canon; resume and public profiles derive from it
  cv/                  ← resume per language, plus tailored/ per posting
tools/
  ats-watch/
    adapters.mjs       ← 8 ATS, one place to add a ninth
    geo.mjs            ← "is this location reachable" logic, built from the profile
    watch.mjs          ← daily poller
    discover.mjs       ← weekly discovery, cumulative
    probe.mjs          ← verify a slug before trusting it
    watchlist.json     ← verified boards, polled daily
    candidates.json    ← names not probed yet
  daily-scan.sh        ← cron entry point
  weekly-discover.sh   ← cron entry point
applications/
  applications.csv     ← one row per application
  ats-playbook.md      ← form-filling recipes and traps, per platform
  answers-bank.md      ← the answers every ATS asks for
  cover-letters.md     ← what was actually sent, per posting
digests/               ← one CSV plus one analysis per scan
.claude/
  skills/job-scout/       ← the orchestrator, read at the start of a session
  skills/job-scout-init/  ← the setup interview
  workflows/job-scout-bootstrap.js
  workflows/job-scout-web.js
```

---

## The rules that make it work

These came out of a real search, and each one cost something to learn.

1. **Never guess an ATS slug.** Verify it against the API. A wrong slug looks exactly like a company with no openings.
2. **A mass probe returning zero is re-measured slowly before it is written down as a fact.** A swallowed 429 is indistinguishable from an absent board.
3. **The title overrules the body on stack**, and the body overrules every structured field on location, remote and seniority.
4. **No numeric score.** Scores measure keyword density, not fit. Hard exclusions plus a human reading bodies beats a number, and the number was wrong six days running.
5. **Nothing disappears silently.** Every filter prints why it dropped things.
6. **One application per company.**
7. **The mailbox is the oracle.** The page is not, and an empty network log proves nothing.
8. **Sober form filling.** One action per call, two attempts maximum on a widget, one send click. Aggressive retries got one application flagged as spam and it never went out.
9. **Never invent anything about the candidate**, and never give the current salary.
10. **A lesson left in a digest gets paid for twice.** Push it up into `CLAUDE.md` or `ats-playbook.md`.

## Requirements

Node 20+, no dependencies at all. A browser the agent can attach to for phase 4, launched by the human. `git`.
