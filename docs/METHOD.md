# Method: a market sweep by parallel agents

> The reusable playbook for a **wide** sweep, the one the `job-scout-bootstrap` workflow automates. Validated on a first real pass (~50 companies, 8 agents, 28 live postings kept). Run it at setup, then every 2 to 3 months. For the routine watch, see [`PIPELINE.md`](../PIPELINE.md).

## Why this method

The natural reflex is to look for postings on an aggregator. It does not work: aggregators serve closed postings as if live, search-engine snippets lie about location and seniority, and nothing says whether the role is actually funded.

So the principle is the reverse: **start from companies, not from postings.** List the companies worth an application, then read their ATS board live. The reading volume this requires is exactly what justifies parallel agents.

## Step 1: the target list (the candidate, not the agent)

This step is not delegated: it is a judgment about what the candidate wants, not a search.

1. List companies from memory, by tier (`TARGET.preferredTiers` in the profile).
2. **Write down what you believe about each one before verifying.** It works as a control: on the first pass, three starting convictions were wrong (a lab thought to be a priority had 7 roles, all senior; a company thought to be off stack had the best matching role of the lot; three graduate programmes cited from memory no longer existed). Without the written trace, the error goes unnoticed.
3. Do not filter too early. A company that is « probably senior only » still deserves a check: the cost is one agent, the information holds for six months.

## Step 2: cut into clusters

**Group 5 to 10 companies per agent, not one company per agent.** Each agent needs the budget to go down into individual postings and read the years required, the stack, the real location and the salary. One agent per company wastes context on start-up; one agent for 30 companies skims.

Cut by **market coherence**, not alphabetically, because structural conclusions appear at cluster level (« 8 devtools out of 10 hire from senior only » is visible only if the 10 devtools are in the same agent).

Typical clusters (adapt to `SOURCING.segments`):

| Cluster | Content | What such a cluster tends to reveal |
|---|---|---|
| AI-native products, home market | | often the only cluster with several real matches |
| Frontier labs | | early career engineering pipelines are rare to absent |
| Big tech, home market | | the home city may be a research or sales site, not product engineering |
| Fintech / SaaS scale-ups | | often the best cluster to actually apply to |
| Scale-ups + **discovery in a second city** | | a second city can outperform the capital |
| Remote-first devtools | | junior bands often closed |
| Products abroad in the target stack | | geography eliminates more than seniority |
| Graduate programmes + calendar + aggregators | | the visa maths, which decide everything |

Plan **at least one « discovery » cluster** where the agent must find companies itself instead of checking a list. On the first pass it brought the three most likely applications.

## Step 3: the agent brief

Every agent gets the same skeleton. What changes: the list of companies and one cluster-specific instruction. The profile block is built from `profile/profile.mjs`.

```
You are scouting LIVE postings for one specific candidate. Today: <DATE>.

FIRST: load the web tools (ToolSearch "select:WebSearch,WebFetch").

## Profile
- <headline>, <years> years of professional experience.
- Stack: <STACK.positive>. Hard exclusions: <STACK.negativeInTitle / negativeInBody>.
- Location: <baseCity>. <remote / relocation policy from GEO>.
- Work authorisation: <CANDIDATE.workAuthorization>. Outside it, you MUST check and
  report the visa reality. A "remote" role needs a local entity or an EOR: check per company.
- Salary floor: <TARGET.salaryFloor> <currency>. Do NOT surface a posting under it when shown.
- HARD EXCLUSIONS: <stacks>, agencies and body shops, senior/staff reqs at <drop>+ years, <others>.
- Target seniority: <band>. Both "new grad" and "1 to 3 years" reqs count.

## Assigned companies
<list>

## Method
For EACH company: find the real ATS board (Ashby, Greenhouse, Lever, Workable,
Teamtailor, SmartRecruiters, Workday...). Read the board live, NOT aggregators nor
snippets. Then open the plausible individual postings to check years of experience,
stack, location, remote policy, displayed salary.

## Deliver
1. Table of MATCHING offers: company | title | years required | location + remote |
   salary shown | stack | posting date | url | fit note in one line.
2. "No match": every assigned company with no offer, WITH the reason (nothing open /
   all senior / wrong stack / wrong location).
3. "Notes per company": do they hire juniors, do they sponsor, do they employ in the
   home country, is the stack really the assumed one, shape of the process, warm
   channel that beats a cold application.

Be rigorous about truth. If you cannot verify that an offer exists today, say so
explicitly instead of guessing. Do not pad the list with roles that fail the filters.
Your final message is the deliverable, and it is read as data.
```

**The four sentences that make the quality of the result**, never to be cut:
- « Read the board live, NOT aggregators nor snippets. »
- « Open the individual postings » (otherwise the agent believes the title and the location field, which lie).
- « No match, WITH the reason » (the motivated negative is worth as much as the positive: it produces the list of companies to strike for good).
- « If you cannot verify, say so » (without it, agents invent plausible URLs).

Also ask for **notes per company**: on the first pass, half of the value came from there (public seniority ladders, compensation formulas, entry channels, hiring freezes).

## Step 4: aggregate

1. Merge every match into `digests/YYYY-MM-DD.csv` (same columns as the other digests, `verdict` and `pourquoi` filled with a quoted line).
2. Write `digests/YYYY-MM-DD-analyse.md` for what does not fit a table: structural conclusions, a watch list with a **trigger** per entry, companies to strike for good (→ `profile/ruled-out.mjs`), visa constraints, collection traps.
3. Move **every reusable rule** into [`CLAUDE.md`](../CLAUDE.md) or the playbook. A lesson left in a digest gets paid for again at the next sweep.
4. Propose the new names for `tools/ats-watch/candidates.json`, and the verified slugs for `watchlist.json` (cross-checked against the tracker).
5. Update `progress.md`.

### The judging grid (no number)

There used to be a score out of 100 on five axes. **It was removed**: it measured keyword density, not fit, and it was wrong at the top of the ranking several days running (the best target of a week scored low on one mention of the stack; a CTO-level role scored high on three stack words; an already-applied company ranked first). Every real decision was taken by reading the body.

The five axes remain, as **questions to answer in the `pourquoi`**, each backed by a quoted line:

- **Stack**: is the target stack really the job, in the title and in the minimum qualifications?
- **Level**: is the band reachable (years floor, junior-open wording, management scope)?
- **Pay**: displayed band against the floor. « Not shown » is not neutral, it is a risk.
- **Company ceiling**: lab or strong product > solid SaaS > the rest.
- **Process realism**: explicit seniority gate, artefact-based filtering (a merged PR, a demo, a workflow screenshot), no ladder.

⚠️ **Never score « no relocation » as a bonus.** On the first pass it over-ranked two local postings and under-ranked the two best ones. Price the expensive city into the band.

## Step 5: triage, then apply

- **One application per company**, even when several reqs match. Several at the same employer read as spam.
- Check each link against the underlying ATS **before** investing in a tailored resume.
- Treat explicit entry gates as mandatory: a workflow screenshot, an artefact or demo, a merged PR, a slot to book.
- A parallel cap on applications is a choice of the candidate (`RULES.maxParallelApplications`). What never relaxes: reading the body first, and tailoring.

## Collection traps, verified (costly to rediscover)

- **Ashby's `remote` field is wrong in both directions.** Roles flagged `isRemote: true` required five days on site; roles labelled with one country were worldwide. **Only the body counts.**
- **Big job boards behind bot protection** (403 on any fetch), city indexes capped (~120 results, so nothing older than ~2 months), and search engines serving their **closed** URLs as live. Always go down to the ATS. Some of them carry a full `JobPosting` JSON-LD readable with a browser User-Agent: the reliable way to date a posting. After ~30 requests some answer `202` with an empty body and a WAF header: read the headers before concluding the page is dead.
- **Lever's `createdAt` is not a publication date**: evergreen reqs show years-old dates. When a company runs Lever and Ashby side by side, Ashby's `publishedAt` wins.
- **A req id like `PIPELINING-ONLY` is a talent pool**, not a funded role. Sister signals: a posting over a year old « refreshed », or a board where every IC role is evergreen and only leadership roles have normal ids.
- **Name collisions**: a `prisma` board can be a foreign fintech, a `neon` board a payments platform for game publishers. Read the titles.
- **Non-obvious slugs**: some carry the domain (`<name>.tech`, `<name>.ai`), some a short form. Some companies run **two** boards duplicating the same reqs.
- **Check the nationality required**: some home-market roles demand EU citizenship or national citizenship. Invisible from the title.
- **Remote-first board APIs may ignore every filter parameter** and return the same global sample. Most of their « remote » roles are US only.
- **Several boards render their list in JavaScript only.** « Page opened, zero jobs » means nothing there.
- **A graduate programme's calendar is published** (« we post in September »): read the FAQ, the full-time cohort may be mostly converted interns.

## Endpoints

```
Lever            api.lever.co/v0/postings/<co>?mode=json
Greenhouse       boards-api.greenhouse.io/v1/boards/<co>/jobs     (EU host: job-boards.eu.greenhouse.io)
Ashby            api.ashbyhq.com/posting-api/job-board/<co>?includeCompensation=true
Workable         apply.workable.com/api/v1/widget/accounts/<co>?details=true   ⚠ aggressive 429, flat location
SmartRecruiters  api.smartrecruiters.com/v1/companies/<Co>/postings?limit=100&offset=N   ⚠ case sensitive, paged
Teamtailor       https://<slug>.teamtailor.com/jobs.json          ⚠ or a custom domain; carries the body
Recruitee        <slug>.recruitee.com/api/offers/<offer>          (open_questions, options_cv, options_cover_letter)
Workday          <tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs   (POST, paged; see probe-workday.mjs)
Avature          <co>.avature.net/careers/SearchJobs/?jobOffset=N   (HTML only, 12 per page)
Jibe / Phenom    jobs.<co>.com/api/jobs?domain=<co>.com             ⚠ some ignore num/start: read totalCount and facets
Amazon           amazon.jobs/search.json
Apple            jobs.apple.com/api/v1/search
Eightfold        <co>.eightfold.ai/api/pcsx/search
Google           the SSR payload (AF_initDataCallback); JSON APIs 404, the results HTML is readable
```

A good cross-check for new grad roles: public GitHub lists of new grad postings with an « age » column, then verify each on its ATS.

## What the first pass taught

**What worked.** Coherent clusters (structural conclusions emerge at cluster level). Demanding motivated negatives (half of the value). The discovery cluster. Notes per company. Having a dedicated agent check the visa maths instead of assuming them.

**What did not.** Convictions from memory, wrong three times on the companies believed to be priorities. The initial score, biased by a « no relocation » bonus that had nothing to do there. A frontier-lab cluster returned zero clean matches, which remains useful but could have been anticipated.

**Observed cost**: 8 agents, ~1 million sub-agent tokens, ~20 minutes wall clock. Every 2 to 3 months, not more often: boards move, but structural conclusions (stack, where engineering actually sits, hiring freezes) hold for months. **The value came from the agents' judgment, not from the data fetching**: that is why it is a workflow and not a script.

## Why LinkedIn is read only (and form filling is assisted, not automated)

- LinkedIn widens and sorts; **the ATS validates before investing**. The two are complementary: the ATS gives the known companies, LinkedIn gives discovery, the dead-posting state (`jobState`), the competition (`applies`, `views`) and the target ATS (`applyMethod`).
- **Easy Apply auto-submit was derived, then dropped**: the submit is the most watched write endpoint of the site, the risk lands on the account itself (the surface recruiters open after every application), and a much less protected ATS had already flagged an agent-driven submission as spam. The bottleneck was never the number of clicks.
- The remaining bottleneck is **form filling**. A CLI per ATS (`inspect <url>` → the form's schema in JSON, `fill <url> answers.json`) would remove more friction than any extension on the collection side.
