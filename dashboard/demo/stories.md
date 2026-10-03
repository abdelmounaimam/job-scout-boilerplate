<!-- Demo copy of the example catalogue of profile/stories.md, read by the
     dashboard ONLY in demo mode (DASHBOARD_DEMO=1). It keeps the demo records
     valid after the onboarding rewrites profile/stories.md for the real
     candidate. Everything below is fictional. -->

# Story and fact catalogue

The only place a free-text output (an ATS field, a cover letter, an application mail, a reply to a recruiter, a LinkedIn message) may take its material from. Every row has a **stable id in square brackets**; the traced records in `evals/records.jsonl` cite those ids (`stories`, `claims[].source`), and `evals/check.mjs` reads them from this file. A record citing an id that is not here fails.

⚠️ **EXAMPLE ROWS until the onboarding replaces them.** The rows below describe the fictional candidate of `profile/profile.mjs` so the checks run out of the box. The `job-scout-init` interview rewrites this file from `profile/experiences.md` (its step « The story catalogue ») and the candidate validates every row.

## The rules of this file

- **This file creates no fact.** Every row points at its source: a section of `profile/experiences.md` (the canon), a field of `profile/profile.mjs`, or `applications/answers-bank.md`. A row whose source does not hold the fact is deleted, not kept « because it reads well ».
- **A story or a fact absent from here is not used** until it has been added, with its source, and validated by the candidate. That is the whole point: the agent cannot invent a story on the fly to fit a question, and the candidate sees every story before a recruiter does.
- **Ids are stable.** Never renumber or rename one: old records cite it. Retire a row by moving it to « Known don'ts » with the reason, never by deleting its id silently.
- **Ids are uppercase**, `ST-` for a story, `FACT-` for a single citable fact, then letters, digits and hyphens (`ST-BILLING-MIGRATION`, `FACT-NOTICE`).
- The « Citable facts » column lists the exact figures, names and technologies a text may quote for that story. Every number that appears in a free text must be carried by a claim sourced to a row here (the check enforces it).
- ⚠️ **Figures shared privately with recruiters may stay off the public mirrors** (see `profile/experiences.md`): mark them here too, so a public post never quotes them.

## Stories

| Id | Story | What it proves | Citable facts | Source |
|---|---|---|---|---|
| [ST-BILLING-MIGRATION] | Moved the billing service from a nightly batch to an event-driven pipeline | back end, reliability, owning a migration end to end | 2 engineers ; Node.js, PostgreSQL, a message queue ; invoices out in minutes instead of the next morning | experiences.md « ExampleCorp » |
| [ST-DESIGN-SYSTEM] | Built the shared React component library two product teams now use | front end depth, working across teams | React, TypeScript, Storybook ; 2 product teams | experiences.md « ExampleCorp » |
| [ST-SIDE-PROJECT] | A personal tool that turns meeting notes into tickets with an LLM | AI product sense, shipping alone | Next.js, an LLM API ; open source | experiences.md « Projects » |

## Facts

| Id | Fact | Source |
|---|---|---|
| [FACT-NOTICE] | notice period: the value of `CANDIDATE.noticePeriod`, as it stands today | profile.mjs `CANDIDATE.noticePeriod` |
| [FACT-LOCATION] | based in the city of `CANDIDATE.baseCity`, the work authorisation of `CANDIDATE.workAuthorization` | profile.mjs `CANDIDATE` |
| [FACT-EXPERIENCE] | years of professional experience: `CANDIDATE.yearsExperience` | profile.mjs `CANDIDATE` |
| [FACT-EDUCATION] | the degree, the school, the years | experiences.md « Education » |
| [FACT-STACK] | the technologies of the « Skills » section, nothing aspirational | experiences.md « Skills » |
| [FACT-EXPECTATION] | the salary expectation for THIS posting, inside `TARGET.salaryTarget`, never the current salary | profile.mjs `TARGET` |

## Known don'ts

Things that were written once and must never be written again, each with the reason and the date. Read this section before writing.

- <!-- e.g. 2026-10-03: never describe the design system as « adopted company-wide »: two teams use it, not the company. -->
