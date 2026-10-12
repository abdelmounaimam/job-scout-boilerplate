# Applications: the tracker

See also: [`ats-playbook.md`](./ats-playbook.md) (form recipes per platform), [`answers-bank.md`](./answers-bank.md) (reusable answers to the questions every ATS asks), [`cover-letters.md`](./cover-letters.md) (per-posting notes for the interview) and [`ats-accounts.md`](./ats-accounts.md) (candidate accounts created, never passwords).

⚠️ **Every free text of an application (ATS field, letter, mail) is written in [`../evals/records.jsonl`](../evals/records.jsonl)**, with its stories, its sourced claims and the draft kept apart from what was sent, then passes `../evals/check.mjs` before the candidate sees it. It is scored in the dashboard's Evaluations review queue, which joins it to this tracker by company and date. See [`../evals/README.md`](../evals/README.md).

## `applications.csv`

One row per application. **The source of truth** for the dedup (one application per company), the dashboard, and every interview preparation. The dashboard only reads it.

```
date_applied,company,role,source,link,remote,salary_shown,cv_version,status,notes
```

| Column | Meaning |
|---|---|
| `date_applied` | `YYYY-MM-DD`, the day the application actually went out (or was attempted), not the day it was prepared |
| `company` | **the dedup key.** The real employer, never the agency or the re-aggregator that relayed the posting. Compared by normalised name (`sameCompany()` in `tools/lib/text.mjs`) |
| `role` | the exact title on the posting |
| `source` | which channel surfaced it: `ATS poller`, `discovery`, `LinkedIn scan`, `LinkedIn recommended`, `web workflow`, `bootstrap`, `inbound`, `by hand` (add the date of the scan) |
| `link` | the posting page on its ATS (a LinkedIn `jobs/view/<id>` link is also read by the dedup) |
| `remote` | what the BODY said about location and remote, not the badge |
| `salary_shown` | the displayed band, or `not shown` |
| `cv_version` | the exact working file sent (`cv.pdf (EN)`, `tailored/cv-<slug>-<lang>.pdf`), so an interview is prepared on the right claims. Never the upload name, which is the same for every application |
| `status` | see below |
| `notes` | what was filled, whether an account was needed, what each mail said, every later step, separated by ` \|\| ` |

## Statuses

| Status | Meaning | Set when |
|---|---|---|
| `applied` | the application went out | **only when a mail proves it** (nominative acknowledgment), or LinkedIn's own notification for Easy Apply |
| `to_finish` | not sent, or not provably sent | a « complete / verify your email » mail, a form left for a human click, a send whose outcome is unknown |
| `interview` | a process is engaged | a slot is proposed or confirmed (« thanks for applying » is not enough) |
| `offer` | a written offer arrived | the offer is in writing (letter, ATS offer page, mail). Keep `INTERVIEW OBTAINED` in the note |
| `rejected` | end of process | an explicit rejection (the verdict is in the body, not the subject) |
| `closed` | the posting closed before or after applying | the ATS says so |
| `withdrawn` | the candidate withdrew | decided by the candidate |

⚠️ **Never downgrade a status on silence.** Silence proves nothing.
⚠️ **Log a row even when you believe the send failed**, as `to_finish`. A company missing from the tracker is a company the one-application rule no longer protects.
⚠️ **Fill the row while filling the form**, not after. If a submission jams halfway, the row is the only record of what was already sent.
⚠️ **Applications made outside the pipeline** (by the candidate, Easy Apply on a phone, an inbound approach) **get a row too.**

## Markers in `notes`

Deterministic strings the dashboard reads. Put them in capitals, exactly as written.

| Marker | Meaning | Lifecycle |
|---|---|---|
| `INTERVIEW OBTAINED` | this application converted into an interview | set once, kept for the funnel |
| `WAITING FOR MY REPLY` | the company waits for something from the candidate (slots, a form, a document) | set as soon as the mail arrives, **removed when the answer is sent**. `build-data.mjs` prints the count at every build: that is the guard |
| `NEVER SENT` | the row was logged but the application never left (the ATS wanted a mail verification, the form failed): kept so one-application-per-company still protects the company, excluded from the funnel | set when a mail or a reopened form proves it |

## After every write

1. `node dashboard/scripts/build-data.mjs`
2. `./tools/deploy-dashboard.sh --detach`, then check `SUCCESS` on the host and a `401` on the URL (Basic auth: it serves). `404` means down.
3. Commit.

## On a rejection

Find the real reason when it can be found, and write it in `notes`. A rejection that produces a reusable rule (pushed into `CLAUDE.md` or the playbook) is worth more than the application was. If the rejection closes the company for good or for a period, add it to `profile/ruled-out.mjs` with the end date of the cooldown.

## On an interview

Open `interview-prep/<company>/` (see [`../interview-prep/README.md`](../interview-prep/README.md)), read the process the company publishes, and check that nothing claimed in the application (resume version in `cv_version`, texts in `cover-letters.md`) is indefensible.
