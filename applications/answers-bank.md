# Answer bank: the questions every ATS asks

Reusable answers, written once during setup (the `job-scout-init` interview fills the placeholders), so that a form takes minutes and not an hour. **Re-read and reuse at every application** instead of rebuilding the answers each time. Free-text answers specific to one posting are traced in [`../evals/records.jsonl`](../evals/records.jsonl), built only from [`../profile/stories.md`](../profile/stories.md), and checked before they are shown. A lesson drawn from a low score in the dashboard's Evaluations tab becomes a rule here, or in `CLAUDE.md`.

⚠️ **Rewrite, never paste blindly.** An answer that mentions the wrong company, or reuses a phrase written for another posting, is worse than a generic one.

---

## Identity and links

Copied from `CANDIDATE` in `profile/profile.mjs`. Keep both in sync.

| Field | Value |
|---|---|
| Full name | `<first name> <last name>` |
| Email | `<personal address>` ⚠️ never the current employer's address |
| Phone | `<with country code>` |
| Current location | `<city, country>` (as autocompletes expect it) |
| LinkedIn | `https://www.linkedin.com/in/<handle>` (⚠️ some forms require the `www`) |
| GitHub | `<url>` |
| Portfolio / website | `<url>` |
| Resume to upload | the path printed by `tools/cv-to-send.sh <lang>` |

⚠️ **Open source contributions**: answer what is true. Merged PRs on private work repos are not open source contributions; say no, then move to the real material (code review in a team, products shipped on the company's technology).

## Work authorisation and logistics

Answer from `CANDIDATE.workAuthorization`. Never guess.

| Question | Answer | Note |
|---|---|---|
| Authorised to work in `<home country>`? | `<yes / no, and on what basis>` | |
| Sponsorship needed in `<home country>`? | `<no>` | |
| Sponsorship needed in `<other countries>`? | `<yes: full national procedure, N months>` | a residence permit in one country usually grants nothing elsewhere |
| **Notice period / availability** | `<CANDIDATE.noticePeriod>` | ⚠️ the real one, verified in the contract, recomputed when tenure crosses a threshold. Say it early and correctly |
| Earliest start date | `<today + notice>` | |
| Relocation | `<anywhere in the home country / cities / no>` | |
| Office presence | `<up to N days a week on site>` | |
| Remote | `<accepted; check the company can employ in the home country (entity or EOR) before investing>` | |

## Compensation

⚠️⚠️ **Never give the current salary** (`RULES.neverDiscloseCurrentSalary`). If asked, answer with the expectation, not the history. The current figure anchors every later step of the negotiation and cannot be taken back.

| Question | Answer |
|---|---|
| Salary expectation, `<expensive city>` | `<target, upper part>` |
| Salary expectation, elsewhere / remote | `<target>` |
| Salary expectation, abroad | `<GEO.salaryFloorAbroad and above>`: a legal sponsorship threshold is a floor of the law, never a target |
| Walk-away floor | `<TARGET.salaryFloor>` (never announced as such) |
| Current salary | **not given.** « My expectation for this role is `<target>`. » |

Phrasing for a free-text salary field: « Based on the scope of the role and the market for `<role>` in `<city>`, I am targeting `<range>` gross per year, open to discussing the full package. »

⚠️ A salary slider or a dropdown: pick the expectation, not the floor. An optional salary field can be left empty rather than anchoring below the band the posting shows.

## Scheduling an interview: send a link, not a list

`<booking page URL, if any>`

- Sending a booking link rather than a list of slots puts the candidate in the same position as the recruiter.
- ⚠️ **Never connect the current employer's calendar** to the booking tool: it would leave a trace employer side. The tool then cannot see work meetings: watch for conflicts by hand.
- Change availability through the tool's API or MCP, not through its web UI (dropdowns that do not reach the form state, re-renders that erase unsaved rows).
- Tone of a reply to an invitation: **the link alone is enough** (say it is kept up to date over the next two weeks rather than listing slots); the interview is granted, nothing left to sell; no apology for a delay of a few working days; no phone number in the body (it is on the resume).

## Frequent multiple-choice questions

- **« How did you hear about this role? »** → `Job board` (most postings come from boards). If absent: `Other` → « Found the role on your careers page while researching companies in this space. » ⚠️ The same question is worded differently per tenant; it can be a mandatory checkbox group.
- **« Select all that apply » about a technology or AI experience**: tick everything true, **never tick « None »** next to other ticks, never tick « I have used your product » unless true, **count the ticks** afterwards.
- **« Do you require any accommodations? »** → `<no / yes>`.
- **Gender, ethnicity, disability, veteran status (EEO / diversity)**: optional by law in most jurisdictions. Default: « I don't wish to answer ». Decide once, be consistent.
- **« Do you have N years of experience? »**: answer the truth as the resume shows it. Counting internships to reach a threshold contradicts the years shown everywhere else, and one company rejected exactly on that gap. Name the gap and argue it in a free answer instead.

## Short pitch (2 to 3 sentences, for « introduce yourself » fields)

> `<role> with <N> years building <kind of products> in <stack>. <One concrete achievement with a number>. <What the candidate does today, one clause>.`

## Recurring free-text questions

Write each once, 4 to 8 lines, then tailor per posting.

- **Why this company?** ⚠️ Genuinely rewritten every time. A generic answer reads as a mass application, which it is.
- **Why are you leaving your current role?** Forward looking, never a complaint.
- **Tell us about a project you are proud of.** One project, one problem, one decision, one outcome, ideally a number.
- **What are you looking for in your next role?** Consistent with `TARGET.shape`.
- **A hard problem you solved.** Show alignment before execution and how feedback was integrated, not the solo exploit.

## Content rules

- **Never invent a story**, a project, a metric, a team or a skill. It survives exactly until the interview that asks a follow-up question.
- Keep the strongest reference project first; short projects are mentioned in one general clause.
- Keep the best stories for interviews rather than spending them in a form field.
- One main idea plus one proof, then stop.
- **Never sign an attestation on the candidate's behalf.**
