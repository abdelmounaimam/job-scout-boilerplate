---
name: job-scout-init
description: Turn this boilerplate into a pipeline customised for one specific candidate. Use once, at setup, when the repo still holds the example profile. It collects the candidate inputs, rewrites profile.mjs, seeds the experience canon and the answer bank, then bootstraps the ATS watchlist.
---

# Init — from boilerplate to one candidate's pipeline

Run once. At the end, the repo is no longer a template: it is that candidate's search.

⚠️ **Ask for everything BEFORE writing anything.** A half-filled profile produces a watchlist built on the wrong filters, and the whole bootstrap has to be thrown away.

⚠️ **Never invent a fact about the candidate.** Not a year of experience, not a salary figure, not a work authorisation. Everything in `profile.mjs` gets quoted to search agents as ground truth, and an invented fact turns into an invented claim on an application. Where an answer is missing, ask; where the candidate says "I don't know", write the uncertainty into the file rather than a guess.

---

## Step 1 — collect the inputs

Ask in these five blocks. Batch the questions, do not drip them one at a time.

### Block A — identity and materials

- Full name, city and country of residence, email to use for applications (⚠️ **never the current employer's address**), phone with country code.
- LinkedIn, GitHub, portfolio or personal site.
- **The resume.** Ask for the file. Read it in full: it is the raw material for the experience canon.
- Anything else written already: an existing LinkedIn export, a portfolio, past cover letters.

### Block B — what they are looking for

- Target job titles, in their words.
- Level: years of professional experience, and what they consider in and out of band.
- Stack: what they want to work in, and what they refuse. **Be specific about the refusals**, because that list does most of the filtering work.
- Adjacent functions to exclude (QA, data, devops, security, support, product…) or to keep.
- Company types, ranked. Labs, big tech, scale-ups, agencies, public sector, whatever fits.
- Anything ruled out on principle, and why. That goes straight into `RULED_OUT`.

### Block C — geography and the right to work

This block decides which postings are reachable at all, so it is worth being precise.

- Where they live, and which cities and countries they will work in.
- **Work authorisation**, country by country: where they can start tomorrow, where a formality is needed, where sponsorship is needed. Ask them to state it plainly rather than inferring it from nationality.
- Is relocation acceptable, and inside which perimeter?
- Is remote acceptable, and does it need an employer of record or a local entity?

### Block D — money

- Current compensation, **for calibration only**: it never goes to a recruiter and never appears in an application.
- The **floor**: the number below which they walk away.
- The **target**: what they will ask for. The floor is not the ask.
- Does the floor rise abroad, and by how much (relocation, deposit, months without pay)?
- Notice period, **verified in the contract**, not the one people assume. This one is regularly wrong by months in either direction.

### Block E — how they want the pipeline to behave

- Who presses Submit: the candidate, or the agent once a platform has proven calm? (`RULES.submittedBy`)
- Language of the repo documents.
- Are there companies to avoid entirely, for example the current employer's clients or partners?
- ⚠️ **Is the current employer to be kept unaware?** If yes, that constrains everything downstream: no employer email, no employer LLM account, no employer browser profile, and care about what goes on a public profile.

---

## Step 2 — write the profile

Rewrite `profile/profile.mjs` **in full** from the answers. Every block: `CANDIDATE`, `TARGET`, `STACK`, `TITLE`, `GEO`, `INTERMEDIARY`, `JUNIOR_OPEN`, `MANAGEMENT_SCOPE`, `RULED_OUT`, `SOURCING`, `RULES`.

Adapt, do not translate blindly:

- **`GEO.home`** takes the country plus the cities that appear in postings without the country next to them. `tools/ats-watch/geo.mjs` subtracts these from the world list to build the "abroad" detector, so a missing home city means real postings get dropped as foreign.
- **`INTERMEDIARY`** is market-specific. Agency names differ per country, and so do the giveaway phrases. Keep the singular-versus-plural rule for "our client": it is the detector that actually works.
- **`TITLE.wrongFunction`** and **`STACK.negativeInTitle`** must include the local-language variants of every term, or the filters miss half the market.
- **`SOURCING`** lists the aggregators, remote boards, VC portfolios and funding-news sources **of this market**. The example values are for a different one.

Then delete the "EXAMPLE VALUES" warning at the top of the file, and smoke test:

```bash
node -e "import('./profile/profile.mjs').then(p => console.log(Object.keys(p)))"
node tools/ats-watch/probe.mjs "<a company the candidate names>"
```

## Step 3 — seed the canon and the answer bank

- Fill `profile/experiences.md` from the resume: headline, about, one section per role with achievement bullets, education, projects, skills. **Do not embellish.** If a bullet has no number, leave it without one rather than inventing a percentage.
- Put the resume file into `profile/cv/`, one per language, and map them in `RULES.resumeByLanguage`.
- Fill `applications/answers-bank.md`: identity, links, work authorisation answers, expectation, notice period, and a first draft of each recurring free-text answer.

## Step 4 — bootstrap the watchlist

```
Workflow({name: "job-scout-bootstrap"})
```

Parallel agents sweep the open web per market segment, every slug is verified against the live API, and the result is written into `watchlist.json`, `candidates.json` and a report in `digests/`.

⚠️ **This is the step that makes the pipeline the candidate's rather than a template's**, and it costs a real amount of tokens. Run it once the profile is right, not before.

Then baseline the poller so the first real run reports news rather than everything at once:

```bash
node tools/ats-watch/watch.mjs --reset
node tools/ats-watch/watch.mjs --all | head -50    # eyeball what the filters keep
```

⚠️ **Read that output with the candidate.** It is the only cheap moment to catch a filter that is too tight. A `wrongFunction` entry that swallows their actual job title is invisible until someone looks.

## Step 5 — schedule and hand over

- Install the crontab lines from the job-scout skill.
- Symlink `AGENTS.md` to `CLAUDE.md`.
- `git init`, first commit.
- Tell the candidate the three commands they will actually use: read the skill, run the web workflow, apply to a posting.

---

## What "done" looks like

- [ ] `profile.mjs` has no example value left, and no invented fact
- [ ] `experiences.md` matches the resume, with nothing embellished
- [ ] `watchlist.json` holds only slugs that returned real reqs
- [ ] `candidates.json` holds every company found, board or no board
- [ ] `watch.mjs --all` output has been read by a human and the filters adjusted
- [ ] crons installed, first digest written
