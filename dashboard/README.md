# Applications dashboard

A read-only view of `applications/applications.csv`. **It changes no
application**: the CSV stays the source of truth, the dashboard is only its
mirror. React, Tailwind, shadcn-style components written in place, Recharts,
served by Bun behind HTTP Basic auth.

⚠️ **One exception: the Evaluations tab writes SCORES.** It shows the free texts
of `../evals/records.jsonl` (baked at build time like the CSV) and stores the
candidate's scores in a SQLite database served by `server.ts` (`/api/scores`,
same Basic auth). Spec and rubric in [`../evals/README.md`](../evals/README.md).

Title, locale, currency, salary floor and chaser policy come from
`profile/profile.mjs` (`DASHBOARD`, `TARGET`, `RULES.followUps`). No candidate
fact is hardcoded here.

```bash
cd dashboard
bun install     # once
bun dev         # http://127.0.0.1:5180
```

`bun dev` regenerates the data at startup **and watches the CSV** (and the
profile): as soon as a scan or an application changes it, the page reloads by
itself. To regenerate by hand without a server: `bun run data`.

## Scores of the free texts (Evaluations tab, `#evaluations`)

| Piece | Role |
|---|---|
| `scripts/build-data.mjs` | bakes `evals/records.jsonl` into `src/data/records.json`; an unreadable line stops the build |
| `server.ts`, `/api/scores` | `GET` every score, `POST` one (six axes from 1 to 5, a comment, a rewrite). Append-only table: scoring again keeps the history |
| `SCORES_DB` | the SQLite path. ⚠️⚠️ **Deployed, it must be on a volume** (Railway: a volume mounted at `/data`, `SCORES_DB=/data/scores.sqlite`): without one, every redeploy (one per tracker write) starts on an empty database. With a volume attached and no variable, the server uses the volume's mount path; on Railway without either, it prints a warning at startup |
| `../tools/pull-scores.sh` | mirrors the scores into `evals/scores.jsonl` for git and for the judge; the password is read from the host's variables, never written |

The tab joins each text to its application by company name (whole leading
words, never a substring) to show the outcome next to it, without copying it
into the record. Locally, `bun dev` serves the page only (the tab says so and
disables scoring). To try scoring:

```bash
bun run build && DASHBOARD_PASSWORD=<12+ characters> SCORES_DB=/tmp/scores.sqlite bun server.ts
```

## ⚠️⚠️ The rule: every write to the tracker ends with a rebuild and a deploy

A sent application, a rejection logged, a status moved to `interview` or
`withdrawn`, a record added or completed in `evals/records.jsonl`: each one is followed, in the same stride as the commit, by

```bash
node dashboard/scripts/build-data.mjs     # or: cd dashboard && bun run data
tools/deploy-dashboard.sh --detach
```

**Why it is not automatic, and why it gets forgotten:** `src/data/applications.json`
is **gitignored** and rebuilt inside the container at build time. So a commit of
the CSV changes NOTHING online, and nothing breaks to signal it: the dashboard
simply shows stale numbers with no error. It once stayed **five days** behind
before anyone noticed.

**The verification that counts** is not "the script ran". It is the deployment
in `SUCCESS` on the host, **then** the URL answering:

- **401** without credentials is the GOOD state: the page is served, behind auth.
- **404** means the service is dead. A trial plan expiring once took the
  dashboard down: the host moved the last good deployment to `REMOVED` and the
  URL answered 404. The deploy script printed a clear error, but a `--detach`
  run whose end nobody reads would have passed for a deployment.

## Note markers, the conventions the build relies on

A status carries ONE state, the last one. Two facts it cannot say are carried by
markers written in full in the `notes` column. Both are deterministic, and the
build prints what it recognised at every run: that printout is the guardrail.

| Marker | Write it when | What it feeds |
|---|---|---|
| `INTERVIEW OBTAINED` | an invitation arrives, whatever comes next | the funnel's "Interview obtained" branch, which a rejection afterwards does not erase |
| `WAITING FOR MY REPLY` | a company answered and waits for you (slots, a form, a question); remove it once you replied | the "They are waiting for your reply" block |
| `NEVER SENT` | a row whose status is not `to_finish` / `withdrawn` but that never went out (posting gone at the moment of applying) | keeps it out of every rate's denominator |

⚠️ `WAITING FOR MY REPLY` is **not a chaser**. It exists because an interview
invitation asking for time slots once stayed two days unanswered while the
dashboard said "Nothing to do today". Answering a company that answered is
outside any no-chaser rule.

## Statuses

`applied` · `interview` · `rejected` · `closed` · `to_finish` · `withdrawn`.
Anything else **stops the build** and names the line: a malformed row (once a
fragment of a note detached from its line by a botched edit) became a phantom
application whose status was a sentence, and it blanked the whole page while the
build calmly exited 0. The UI also falls back to an "Unknown status" badge, so a
doubtful datum shows as doubtful and never switches the page off.

## What it shows

| Block | Answers |
|---|---|
| Tiles | How many sent, how many waiting, response rate, how many to handle |
| **What becomes of the applications** | The Sankey diagram of the funnel, from prepared to last known state. The only block that shows the **conversion rate to interview**. |
| **To handle** | "They are waiting for your reply", then applications prepared but never sent. A "chasers due" block exists ONLY when `RULES.followUps` is a number of days; with the default `'never'` it does not render at all. |
| Where the applications stand | Breakdown by status |
| Sending pace | One bar per day, to see the bursts and the gaps |
| Where the postings come from | Which source really feeds the pipeline |
| Ranges shown | The announced bands, placed against the salary floor |
| All applications | Filterable, searchable table, with a link to every posting |
| **Evaluations tab** (`#evaluations`) | Every free text with its question, the posting lines it rests on, the angle, the stories and sourced facts, the failing checks, the agent's draft against what was sent, and the scoring form |

## Visualisation decisions, and why

The `dataviz` skill provides a validated palette and a validator. Two choices
follow from it, not to be "fixed" by accident:

- **No pie chart for the statuses.** Run through the validator as a categorical
  palette, the status colours fail: ΔE 4.1 in deuteranopia between the green
  "interview" and the red "rejected", and 13.6 in normal vision between "posting
  closed" and "to finish". A pie would put the meaning on colour alone, which is
  exactly what fails. Hence **labelled bars**, where every row carries an icon, a
  label and a number; colour only reinforces. The full table is the second
  fallback, the one that reads with no colour at all.
- **Sources are a magnitude, not identities**: one blue hue dosed by rank, never
  one colour per source.

## The Sankey funnel, and the three traps it had to get around

It answers a question no other block asked: **out of a hundred applications
sent, how many get an interview?**

- ⚠️ **The status cannot tell the stage reached, only the last one.** Two
  applications rejected after interviews sit in `rejected`. Counting interviews
  by `status === "interview"` **erased half the conversions**. The funnel goes
  through `interviewObtained`, derived at build time from the `INTERVIEW OBTAINED`
  marker.
- ⚠️ **`closed` covers two opposite cases.** One application really went out and
  the req closed behind it; another posting was never applicable at all. The
  status does not separate them, the note does. Hence the derived `sent`. On the
  way, the "response rate" tile counted the never-applicable one in its
  denominator and announced one send too many: both blocks now read the same
  source.
- ⚠️ **A silence is not an indefinite wait.** Beyond `SILENCE_DAYS` (21 days) it
  is counted as a rejection nobody wrote. The threshold came out of the data of
  the search this was built for: three interview invitations out of four came
  within 24 hours, the fourth on day 10, and rejections on paper within 48 hours
  to 5 days. 21 days leaves twice the margin of the slowest case. Re-read it
  against your own data.

**Hand-written, not Recharts' `Sankey`** although it is installed: it places no
label and requires custom `node` and `link` renderers, so the whole drawing has
to be written anyway while losing control of the placement. Here the meaning
rests entirely on the labels. And the graph is a **tree** of eleven nodes, so
the layout is computed exactly, with no relaxation iterations and no ribbon
crossing by construction.

**The geometry is checked by computation, not by eye**: `bun run check-funnel`
replays the layout on the real data and fails if two nodes overlap, two labels
collide, the sum of the branches no longer equals the parent, or anything leaves
the frame. This matters because **the counts change at every scan**: a layout
right today can overlap tomorrow. The check is wired into `predev` but
**deliberately not into `prebuild`**: a cosmetic overlap must never break a
deployment. On an empty tracker it exits early, since the page shows an empty
state instead of a diagram.

Dark mode is **chosen**, not an inversion: the same hues re-dosed for the dark
surface, declared under `@media (prefers-color-scheme: dark)` and under
`[data-theme="dark"]` so the toggle wins both ways.

## Traps met while building it

- ⚠️ **Recharts: animation switched off.** `ResponsiveContainer` restarts the
  bars' growth at every re-measure, and they stayed stuck at a fraction of their
  height: a peak of 21 applications was drawn as a 4. `isAnimationActive={false}`.
  Nothing to animate on a static dashboard.
- ⚠️ **No negative left margin on the `BarChart`.** It clipped the first digit of
  the ticks: "20" displayed as "0".
- ⚠️ **The "k" suffix of a range applies to both bounds.** "60-150 k€" is 60 000
  to 150 000. A first version of the parser returned 150 000 alone.
- ⚠️ **`Intl.NumberFormat` throws on an invalid locale or currency code**, and a
  throw during render blanks the page: `money()` falls back to a plain number.
- The CSV carries very long `notes`, with commas, quotes and line breaks: parsing
  happens **once**, in `scripts/build-data.mjs`, never in the browser.

## Responsive and scrolling

Measured at 390, 768, 1024, 1280 and 1536 px, counting overflows in the DOM
rather than by eye.

**Rule held everywhere: the page NEVER scrolls sideways.** What is too wide
scrolls inside its own block.

- **Table**: `max-h-[32rem] overflow-auto`, `sticky` header. It scrolls both ways
  inside its card. Before, dozens of rows lengthened the page until the footer
  was out of reach, and the column names were lost after ten rows.
- **Tiles**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. Five tiles on two
  columns left the last one orphaned: it takes the full width until there are
  five columns, which makes it read as an alert banner.
- **"To handle" lists**: the role goes **under** the company name below `sm`.
  Side by side, a long title crushed the name one reads first.
- **Salary ranges**: side columns tightened below `sm` (`4.5rem_1fr_4rem` instead
  of `7.5rem_1fr_5.5rem`), otherwise 208 px out of 350 went to the name and the
  amount, leaving almost nothing for the bar.

⚠️ The table keeps `min-w-[720px]`: its columns do not compress below that width
without becoming unreadable. Its container scrolls, not the page.

## Structure

```
scripts/build-data.mjs    CSV + profile → src/data/applications.json (source families, salary parsing, markers)
scripts/check-funnel.ts   the Sankey geometry, checked by computation
src/lib/metrics.ts        statuses, response rate, aggregates, the funnel tree
src/lib/funnel-layout.ts  the Sankey layout, pure geometry
src/components/           Tiles, Funnel, Actions, Breakdown, Timeline, Salaries, Table
src/components/ui/        shadcn-style components (card, badge, input), written in place
server.ts                 Bun static server, HTTP Basic, refuses to start without a password
```

`src/data/applications.json` is **generated**, hence gitignored.

## Deployment (Railway)

```bash
cp .env.example .env            # at the repo root, then fill in the Railway ids
railway variables --set DASHBOARD_PASSWORD=<a-long-password>   # on the host, once
tools/deploy-dashboard.sh --detach
```

### The constraint that governs this deployment

This dashboard shows the whole job search: every company, every rejection, the
salary expectation, the notice period, and a `notes` field nobody else has to
read. Keep the git repository **private** for that reason. A Railway URL is not
private: it is public and guessable, and the rule of a search run while employed
is not to be spotted before signing, with a current employer who could stumble
on it.

Two guardrails follow, not to be removed:

1. **`server.ts` refuses to start without `DASHBOARD_PASSWORD`** of at least 12
   characters. No default, no "open while testing" mode: a configuration error
   must break the deployment, never publish the data silently. Constant-time
   comparison, `noindex` and `no-store` headers, and **the JS bundle is behind the
   auth too** (it is the bundle that carries the data). The login is
   `DASHBOARD_USER`, else `DASHBOARD.basicAuthUser` from the profile.
2. **`deploy-dashboard.sh` does not upload the repo.** `railway up` ships the
   current directory: run from the root, it would send the resume sources,
   interview prep and every personal note to the build servers. The script
   rebuilds a minimal tree in a temporary directory: the dashboard sources, the
   tracker, the profile and the Dockerfile (about 28 files, 250 KB).

Verify online after deploying: 401 without credentials, 401 with a wrong
password, **401 on the JS bundle too**, 200 with the right credentials.

### Build failures already crossed, so as not to cross them again

- **Nixpacks does not detect the project**: the `package.json` is nested in
  `dashboard/`, so there is nothing at the root of the upload and the build dies
  on `bun: command not found`. Hence the **Dockerfile**, which guesses nothing.
- **The `oven/bun` image has no node**: `predev`, `prebuild` and `data` call
  `bun scripts/build-data.mjs`, never `node`.
- **`@types/node` was missing** while `tsconfig.json` declares it and
  `vite.config.ts` uses `__dirname`: `tsc -b` failed with `TS2688`.
- ⚠️ `railway up` from a temporary directory is linked to no project and offers
  to create a new one every time. The script passes `--project`, `--environment`
  and `--service` from `.env`; Railway demands `--environment` as soon as
  `--project` is given.
- ⏳ **No `railway.json`**: Railway deprecated it and it stops working on
  2026-12-01. The root Dockerfile is detected without it, so there is nothing to
  migrate.
