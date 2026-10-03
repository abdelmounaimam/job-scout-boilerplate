# Applications dashboard

A read-only view of `applications/applications.csv`. **It changes no
application**: the CSV stays the source of truth, the dashboard is only its
mirror. React, Tailwind, shadcn/ui components (Radix), TanStack Table and
TanStack Query, Recharts, lucide icons, served by Bun behind HTTP Basic auth.
A sidebar holds two sections: **Job search** (Overview, Applications,
Insights) and **Evaluations** (Summary, Review queue, Checks, Stories,
Rubric). On a phone the sidebar becomes a drawer.

👉 **The page by page guide, with screenshots and the scoring workflow, is
[`../docs/DASHBOARD.md`](../docs/DASHBOARD.md).** This file is about building,
running and deploying it.

⚠️ **One exception: the Evaluations pages write SCORES.** They show the free
texts of `../evals/records.jsonl` and the story catalogue of
`../profile/stories.md` (both baked at build time like the CSV) and store the
candidate's scores in a SQLite database served by `server.ts` (`/api/scores`,
same Basic auth). Spec and rubric in [`../evals/README.md`](../evals/README.md).

Title, locale, currency, salary floor, chaser policy and login come from
`profile/profile.mjs` (`DASHBOARD`, `TARGET`, `RULES.followUps`). No candidate
fact is hardcoded here.

```bash
cd dashboard
bun install     # once
bun run demo    # fictional data, scoring included: see "Demo mode" below
bun dev         # your data, http://127.0.0.1:5180
```

`bun dev` regenerates the data at startup **and watches the CSV** (and the
profile, the records and the catalogue): as soon as a scan or an application
changes them, the page reloads by itself. To regenerate by hand without a
server: `bun run data`.

## Demo mode (`bun run demo`)

A fictional dataset lives in `demo/`: a tracker of 37 applications at invented
companies, 15 free texts (some passing their checks, some failing, some edited
before sending), a copy of the example story catalogue, a demo profile and 11
scores. It feeds the screenshots of `../docs/screenshots/` and lets a new user
see every page before onboarding.

- `bun run demo` builds with `DASHBOARD_DEMO=1` (only `demo/` is read, never
  the real tracker, records, catalogue or profile), seeds a **temporary**
  SQLite database from `demo/scores.jsonl`, forces `SCORES_DB` to it, and starts
  `server.ts`. The database is deleted when the server stops. Login `demo`, a
  random password printed at startup (or `DASHBOARD_USER` /
  `DASHBOARD_PASSWORD`), `PORT` 8080 by default. `--skip-build` reuses the last
  demo build.
- Demo dates are shifted so the newest row is yesterday.
- `bun run dev:demo` runs `vite` on the demo data, read only.
- The sidebar shows a "Demo data" badge.
- ⚠️ The demo overwrites the generated `src/data/*.json` and `dist/`: run
  `bun run build` before serving your own data again. The deploy is not
  affected (`demo/` is not shipped, and the container builds from the real
  files).
- After editing `demo/records.jsonl`, refresh its checks from the repo root:
  `node evals/check.mjs --file dashboard/demo/records.jsonl --write` (with the
  example profile still in place, since the checks read `profile/`).

## Scores of the free texts (Evaluations pages, `#/evaluations`)

| Piece | Role |
|---|---|
| `scripts/build-data.mjs` | bakes `evals/records.jsonl` into `src/data/records.json` (an unreadable line stops the build) and the rows of `profile/stories.md` into `src/data/stories.json` |
| `server.ts`, `/api/scores` | `GET` every score, `POST` one (six axes from 1 to 5, a comment, a rewrite). Append-only table: scoring again keeps the history |
| `SCORES_DB` | the SQLite path. ⚠️⚠️ **Deployed, it must be on a volume** (Railway: a volume mounted at `/data`, `SCORES_DB=/data/scores.sqlite`): without one, every redeploy (one per tracker write) starts on an empty database. With a volume attached and no variable, the server uses the volume's mount path; on Railway without either, it prints a warning at startup |
| `../tools/pull-scores.sh` | mirrors the scores into `evals/scores.jsonl` for git and for the judge; the password is read from the host's variables, never written |

The review queue joins each text to its application by company name (whole
leading words, never a substring) to show the outcome next to it, without
copying it into the record. A claim is "unsourced" when its source is not an id
of the catalogue. Locally, `bun dev` serves the page only (the review queue
says so and disables scoring). To score:

```bash
# against a local server and a throwaway database
bun run build && DASHBOARD_PASSWORD=<12+ characters> SCORES_DB=/tmp/scores.sqlite bun server.ts
# or from bun dev, relaying /api to a running server (your deployed one), so
# every score lands in ONE database and pull-scores.sh sees them all
DASHBOARD_URL=https://<your-dashboard> DASHBOARD_PASSWORD=<its password> bun dev
```

Set `DASHBOARD_USER` too when your login is not `candidate`. The relay is never
active in demo mode.

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
| `WAITING FOR MY REPLY` | a company answered and waits for you (slots, a form, a question); remove it once you replied | the "Waiting on you" lines of "Needs your action" (Overview) |
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

| Page | Answers |
|---|---|
| **Overview** (`#/overview`) | Five tiles (sent, waiting, interviews, response rate, to finish), the Sankey funnel (the only block that shows the **conversion rate to interview**), weekly activity, the breakdown by status, "Needs your action" (waiting on you, to finish, and chasers ONLY when `RULES.followUps` is a number of days), latest sent |
| **Applications** (`#/applications`) | Every row in a sortable, filterable, paginated table; a side panel with the notes, the posting link and the free texts written for that company |
| **Insights** (`#/insights`) | Applications and interviews per source family, the daily rhythm, the salary bands shown against `TARGET.salaryFloor` |
| **Summary** (`#/evaluations`) | Texts scored, average score, failing checks, unsourced claims, average per axis, what the checks catch, progress by channel, score vs outcome, lowest scored |
| **Review queue** (`#/evaluations/review/<id>`) | The queue with its filters, then one text: question, failing checks, Text / Draft vs sent / Evidence tabs, previous scores, the six-axis form with Save & next, `j` / `k` to move |
| **Checks** (`#/evaluations/checks`) | Every text with its failure families, and every unsourced claim |
| **Stories** (`#/evaluations/stories`) | The catalogue with uses, truth and story-choice scores, last use |
| **Rubric** (`#/evaluations/guide`) | The axes, the three layers, the loop |

Routing is a hash (`#/…`): deep links work behind Basic auth without any
server rewrite, and the phone's back button walks the history. The old
`#evaluations` link still lands on the Summary.

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
surface, under the `.dark` class. The theme button offers light, dark and
system (the default); the choice is remembered in `localStorage` when the
browser allows it.

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

**Rule held everywhere: the page NEVER scrolls sideways.** What is too wide
scrolls inside its own block. Checked at 390 px on every page by measuring
`scrollWidth` against the viewport, not by eye.

- **Sidebar**: an inset sidebar on a laptop (collapsible to icons, `Ctrl+B` /
  `Cmd+B`), a drawer on a phone, closed by any navigation.
- **Tables** (TanStack Table): secondary columns hide below `md` / `lg` / `xl`
  (the role goes under the company name), 20 rows per page, the table container
  scrolls rather than the page.
- **Funnel**: the SVG keeps `min-w-[880px]` and scrolls inside its card; the
  sentence under it reads without the chart.
- **Tiles**: `grid-cols-2 lg:grid-cols-5`, the fifth tile takes the full width
  on two columns instead of sitting alone.
- **Review queue**: the queue and the text are side by side from `xl`, two views
  below (a "Queue" button goes back). The score form sits next to the text from
  `2xl`, under it before; on a phone each axis's 1 to 5 buttons take the full
  width.
- **Salary bands**: side columns tighten below `sm`, so the bar keeps room.

## Structure

```
scripts/build-data.mjs    CSV + profile + records + catalogue → src/data/*.json (source families, salary parsing, markers, demo switch)
scripts/check-funnel.ts   the Sankey geometry, checked by computation
scripts/demo.ts           bun run demo: demo build, temporary seeded scores database, server
demo/                     the fictional dataset (tracker, records, catalogue copy, profile, scores)
src/App.tsx               sidebar layout, breadcrumb, theme toggle, page switch
src/lib/router.ts         hash routes
src/lib/metrics.ts        statuses, response rate, aggregates, the funnel tree
src/lib/funnel-layout.ts  the Sankey layout, pure geometry
src/lib/evals.ts          record and score types, axes, check families, scores API (TanStack Query), word diff
src/pages/                overview, applications, insights, eval-overview, eval-review, eval-checks, eval-stories, eval-guide
src/components/           app-sidebar, data-table, funnel, kpi, status, theme
src/components/ui/        shadcn/ui components (components.json), generated then kept in place
server.ts                 Bun static server + /api/scores, HTTP Basic, refuses to start without a password
```

`src/data/*.json` is **generated**, hence gitignored.

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
   rebuilds a minimal tree in a temporary directory: the dashboard sources
   (without `demo/`), the tracker, the profile, the story catalogue, the traced
   free texts and the Dockerfile.

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
