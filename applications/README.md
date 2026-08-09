# Applications — the tracker

See also: [`ats-playbook.md`](./ats-playbook.md) (form-filling recipes per platform), [`answers-bank.md`](./answers-bank.md) (reusable answers to the questions every ATS asks) and [`cover-letters.md`](./cover-letters.md) (the texts actually sent, per posting).

`applications.csv`: one row per application.

| Column | Meaning |
|---|---|
| `applied_on` | date the application actually went out, not the date it was prepared |
| `company` | the deduplication key. One application per company. |
| `role` | the exact title on the posting |
| `source` | which part of the pipeline surfaced it (poller, discovery, web workflow, by hand) |
| `url` | the posting page, so a follow-up can check it is still open |
| `remote` | what the BODY said, not the badge |
| `salary_shown` | the displayed band, or `not shown` |
| `cv_version` | the exact resume file sent, so a later interview can be prepared on the right claims |
| `status` | `applied` · `screening` · `interview` · `offer` · `rejected` · `closed` · `unfinished` |
| `follow_up_on` | applied date plus the follow-up delay in `RULES` |
| `notes` | what was filled, what the confirmation said, and every step of the process afterwards |

**Fill the row while filling the form**, not after. If a submission jams halfway, the row is the only record of what was already sent.

**On a rejection, write down the real reason** when it can be found. A rejection that produces a reusable rule is worth more than the application was.

**On an interview**, open a folder under `interview-prep/<company>/`, read the process the company publishes, and check that nothing claimed in the application is indefensible.
