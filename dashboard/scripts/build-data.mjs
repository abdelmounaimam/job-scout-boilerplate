// Turns applications/applications.csv into JSON the app can consume.
//
// Why a build step rather than parsing in the browser: the tracker carries very
// long `notes` fields, with commas, escaped quotes and line breaks. A homemade
// client-side parser would break on the first chatty comment. Here we parse
// once, properly, and the app only ever sees objects.
//
// Run by `predev` and `prebuild`, and on the fly by the watcher plugin of
// vite.config.ts whenever the CSV changes.
//
// Columns are read BY NAME, never by position: a hardcoded index silently
// shows the neighbouring column the day a column moves.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/* DEMO MODE (DASHBOARD_DEMO=1, set by `bun run demo` and `bun run dev:demo`).
 * Every input is read from dashboard/demo/ instead of the real files: a
 * fictional tracker, fictional free texts, a copy of the example story
 * catalogue and a demo profile. The real tracker, records, catalogue and
 * profile are never opened in this mode, so a screenshot or a first look can
 * never leak them. The outputs are the same generated files as a normal build
 * (src/data/*.json, gitignored): the next `bun run data` or `bun run build`
 * without the variable brings your own data back. */
const DEMO = /^(1|true|yes)$/i.test(process.env.DASHBOARD_DEMO ?? "");
const DEMO_DIR = resolve(HERE, "../demo");
const CSV = DEMO ? resolve(DEMO_DIR, "applications.csv") : resolve(HERE, "../../applications/applications.csv");
const PROFILE = DEMO ? resolve(DEMO_DIR, "profile.mjs") : resolve(HERE, "../../profile/profile.mjs");
const RECORDS = DEMO ? resolve(DEMO_DIR, "records.jsonl") : resolve(HERE, "../../evals/records.jsonl");
const STORIES = DEMO ? resolve(DEMO_DIR, "stories.md") : resolve(HERE, "../../profile/stories.md");
const OUT = resolve(HERE, "../src/data/applications.json");
if (DEMO) console.log("DEMO MODE: reading dashboard/demo/, your own data is not read");

// --- settings from the profile ------------------------------------------------
// The dashboard hardcodes no candidate fact: title, locale, currency, floor and
// the chaser policy all come from profile/profile.mjs. A missing profile is not
// fatal (the defaults below keep the page buildable), but it is said out loud.
let profile = {};
if (existsSync(PROFILE)) {
  profile = await import(pathToFileURL(PROFILE).href);
} else {
  console.warn(`⚠ ${PROFILE} not found: building with default settings.`);
}
const config = {
  title: profile.DASHBOARD?.title ?? "Applications",
  locale: profile.DASHBOARD?.locale ?? "en-GB",
  currency: profile.TARGET?.currency ?? "EUR",
  salaryFloor: profile.TARGET?.salaryFloor ?? null,
  // 'never' (the default) = no chaser block anywhere on the page. Only a number
  // of days turns the "chasers due" block on.
  followUps: typeof profile.RULES?.followUps === "number" ? profile.RULES.followUps : null,
  // Shown in the sidebar, so a demo build is never mistaken for real data.
  demo: DEMO,
  demoShiftDays: 0,
};

/** Full CSV parser: quotes, doubled quotes, line breaks inside a field. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((l) => l.some((v) => v.trim() !== ""));
}

/** Groups the many free-text `source` labels into readable families. */
function sourceFamily(source) {
  const s = source.toLowerCase();
  if (s.includes("easy apply")) return "LinkedIn Easy Apply";
  if (s.includes("linkedin")) return "LinkedIn";
  if (s.includes("job-scout-web") || s.includes("workflow") || s.includes("web search")) return "Web workflow";
  if (s.includes("welcome to the jungle") || s.includes("wttj") || s.includes("welcome kit")) return "Welcome to the Jungle";
  if (/referral|referred|cooptation|intro/.test(s)) return "Referral";
  if (/ashby|lever|greenhouse|teamtailor|smartrecruiters|recruitee|workable|workday|personio|poller|watchlist|discover/.test(s)) return "ATS board, direct";
  if (/e-?mail|direct|careers page/.test(s)) return "Direct";
  return "Other";
}

/** Extracts a yearly range from the free text of the salary field.
 *
 * ⚠️ The "k" suffix of a range applies to BOTH bounds: "60-150 k€" means 60 000
 * to 150 000, not 60 to 150 000. A first version required three digits per
 * number, which returned 150 000 alone for one posting and nothing at all for
 * "50-80K EUR" on another. */
function parseSalary(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase().replace(/[  ]/g, " ");
  if (/not shown|not displayed|none shown|unspecified|competitive|non affich|non sp[ée]cifi/.test(t)) return null;
  const currency = /usd|\$/.test(t) ? "USD"
    : /gbp|£/.test(t) ? "GBP"
    : /chf/.test(t) ? "CHF"
    : /eur|€/.test(t) ? "EUR"
    : config.currency;

  const numbers = [];
  const nb = (s) => Number(s.replace(/[\s.,](?=\d{3}\b)/g, "").replace(/[\s,]/g, ""));

  // 1) Ranges: "50-80k", "52 000 to 64 000", "82 592 € – 91 286 €", "$120,000 - $150,000"
  const rangeRe = /(?:[$£€]\s*)?(\d[\d\s.,]*?)\s*(?:k)?\s*(?:€|eur|usd|gbp|chf|\$|£)?\s*(?:[-–—]|à|a|to)\s*(?:[$£€]\s*)?(\d[\d\s.,]*?)\s*(k)?\s*(?:€|eur|usd|gbp|chf|\$|£|\b)/g;
  let m, seen = false;
  while ((m = rangeRe.exec(t))) {
    const k = !!m[3] || /\dk/.test(m[0]);
    let a = nb(m[1]), b = nb(m[2]);
    if (k) { a *= 1000; b *= 1000; }
    if (a >= 20000 && b >= 20000) { numbers.push(a, b); seen = true; }
  }

  // 2) Otherwise, isolated numbers
  if (!seen) {
    for (const s of t.matchAll(/(\d[\d\s.,]*)\s*(k)?/g)) {
      let n = nb(s[1]);
      if (s[2]) n *= 1000;
      if (n >= 20000 && n <= 900000) numbers.push(n);
    }
  }
  if (!numbers.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers), currency };
}

/** Was it really sent?
 *
 * ⚠️ The status alone is not enough, and this is the trap of this file.
 * `closed` covers two opposite cases: one application really went out and the
 * req closed behind it, another posting was NEVER applicable ("this offer is no
 * longer available" at the moment of applying). Counting them the same inflates
 * the denominator of every rate. Only the note separates them.
 *
 * Convention in the CSV: write "NEVER SENT" in the note of a row that did not go
 * out although its status is not `to_finish` or `withdrawn`. */
const NEVER_SENT = /NEVER SENT|NOT SENT|NEVER APPLICABLE/i;
function wasSent(r) {
  return r.status !== "to_finish" && r.status !== "withdrawn" && !NEVER_SENT.test(r.notes);
}

/** Did it get an interview, even if rejected afterwards?
 *
 * ⚠️ The status cannot say it: a status carries one state only, the last one,
 * so an application rejected after two interviews sits in `rejected` exactly
 * like one rejected on paper. Counting interviews by `status === "interview"`
 * erased half of the real conversions the first time. The note marker is the
 * only source, and it is checked at every build: the console lists the
 * interviews it recognised.
 *
 * Convention in the CSV: write "INTERVIEW OBTAINED" in full in the note as soon
 * as an invitation arrives. */
const INTERVIEW_MARKER = /INTERVIEW OBTAINED/i;

/** Is the ball in MY court?
 *
 * ⚠️⚠️ Born of a real hole: a company invited the candidate to a hiring-manager
 * interview and asked for five time slots, and the request stayed two days
 * unanswered because NOTHING carried it. The dashboard kept saying "Nothing to
 * do today" the whole time. It was the most advanced process of the search.
 *
 * ⚠️ This is NOT a chaser. A chaser pushes a company that has not answered.
 * Here the company HAS answered and is waiting: answering is explicitly outside
 * any no-chaser rule, like moving an engaged process forward.
 *
 * Convention in the CSV: write "WAITING FOR MY REPLY" in full in the note, and
 * remove it once the reply has gone out. */
const MY_COURT_MARKER = /WAITING FOR MY REPLY/i;

/** Statuses the UI knows how to show. Must stay aligned with `Status` and
 *  `STATUSES` in src/lib/metrics.ts. */
const KNOWN_STATUSES = ["offer", "applied", "interview", "rejected", "closed", "to_finish", "withdrawn"];
const REQUIRED_COLUMNS = ["date_applied", "company", "role", "source", "link", "remote", "salary_shown", "cv_version", "status", "notes"];

if (!existsSync(CSV)) {
  console.error(`✗ ${CSV} not found. The tracker is the source of truth: create it with its header row.`);
  console.error(`  ${REQUIRED_COLUMNS.join(",")}`);
  process.exit(1);
}

const rows = parseCsv(readFileSync(CSV, "utf8"));
const header = (rows[0] ?? []).map((h) => h.trim());

const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
if (missing.length) {
  console.error(`✗ applications.csv: missing column(s) ${missing.join(", ")}.`);
  console.error(`  Found: ${header.join(", ") || "(empty file)"}`);
  console.error(`  Expected: ${REQUIRED_COLUMNS.join(",")}`);
  process.exit(1);
}

/** ⚠️⚠️ GUARDRAIL, born of the costliest failure this dashboard ever had.
 *
 *  A botched edit of one row left a FRAGMENT of a note detached from its line in
 *  the CSV. The parser did its job: it made a phantom application out of it,
 *  whose `date` was a sentence, `company` a piece of a free answer, and
 *  `status` the end of a paragraph.
 *
 *  Visible result: `STATUSES[c.status]` was `undefined` in the table, reading
 *  `.color` threw a TypeError, and the WHOLE PAGE stayed blank. The build, for
 *  its part, calmly announced one more application and exited 0.
 *
 *  The lesson, once again: a pipeline that fails silently is worse than one that
 *  breaks. A malformed row therefore stops the build, naming the row and what
 *  is wrong with it. */
const problems = [];
rows.slice(1).forEach((l, i) => {
  const line = i + 2; // +1 for the header, +1 to count from 1
  if (l.length !== header.length) {
    problems.push(`line ${line}: ${l.length} fields instead of ${header.length}, starts with « ${(l[0] ?? "").slice(0, 60)} »`);
    return;
  }
  const status = (l[header.indexOf("status")] ?? "").trim();
  if (!KNOWN_STATUSES.includes(status)) {
    problems.push(`line ${line} (${l[header.indexOf("company")]}): unknown status « ${status.slice(0, 60)} », expected one of ${KNOWN_STATUSES.join(", ")}`);
  }
});
if (problems.length) {
  console.error(`✗ applications.csv: ${problems.length} malformed row(s), build stopped.`);
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  console.error("Fix the CSV: a broken row produces a phantom application that blanks the page.");
  process.exit(1);
}

const raw = rows.slice(1).map((l) => Object.fromEntries(header.map((c, i) => [c, (l[i] ?? "").trim()])));

/* In demo mode the dates are shifted so the newest row is yesterday: the demo
 * reads the same whenever it is run (waiting applications stay "waiting"
 * instead of all turning into silences older than SILENCE_DAYS). The same
 * shift is applied to the records' dates below, and scripts/demo.ts applies
 * it to the seeded scores. */
const DAY = 86_400_000;
const isoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
if (DEMO) {
  const newest = raw.map((r) => r.date_applied).filter(isoDate).sort().at(-1);
  if (newest) {
    const yesterday = Date.parse(new Date(Date.now() - DAY).toISOString().slice(0, 10));
    config.demoShiftDays = Math.round((yesterday - Date.parse(newest)) / DAY);
  }
}
const shift = (s) =>
  DEMO && isoDate(s) ? new Date(Date.parse(s) + config.demoShiftDays * DAY).toISOString().slice(0, 10) : s;
for (const r of raw) r.date_applied = shift(r.date_applied);

const applications = raw.map((r, i) => ({
  id: i,
  date: r.date_applied,
  company: r.company,
  role: r.role,
  source: r.source,
  sourceFamily: sourceFamily(r.source),
  link: r.link,
  remote: r.remote,
  salaryRaw: r.salary_shown,
  salary: parseSalary(r.salary_shown),
  cv: r.cv_version,
  status: r.status,
  notes: r.notes,
  sent: wasSent(r),
  interviewObtained: INTERVIEW_MARKER.test(r.notes),
  myCourt: MY_COURT_MARKER.test(r.notes),
}));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), config, applications }, null, 1) + "\n",
);
const sent = applications.filter((c) => c.sent);
const withInterview = applications.filter((c) => c.interviewObtained);
console.log(`${applications.length} applications → src/data/applications.json`);
console.log(`  ${sent.length} really sent, ${applications.length - sent.length} never went out`);
// Printed at every build: this is the guardrail of the note marker. If an
// interview obtained does not show up here, "INTERVIEW OBTAINED" is missing
// from its note.
console.log(`  ${withInterview.length} interview(s) obtained: ${withInterview.map((c) => c.company).join(", ") || "none"}`);
const offers = applications.filter((c) => c.status === "offer");
console.log(`  ${offers.length} offer(s) received: ${offers.map((c) => c.company).join(", ") || "none"}`);
// Same guardrail: if a ball in my court does not show up here, "WAITING FOR MY
// REPLY" is missing from its note.
const myCourt = applications.filter((c) => c.myCourt);
console.log(`  ${myCourt.length} waiting for MY reply: ${myCourt.map((c) => c.company).join(", ") || "none"}`);

/* Free-text outputs to score (evals/records.jsonl), baked at build time like
 * the CSV. The file is written by the agent only; the SCORES live in the
 * server's SQLite database (server.ts), never here. An unreadable line stops
 * the build, for the same reason as the CSV guardrail above: a broken datum
 * must break the build, not the page. A missing file is fine (no text yet). */
const RECORDS_OUT = resolve(HERE, "../src/data/records.json");
let records = [];
if (existsSync(RECORDS)) {
  const bad = [];
  records = readFileSync(RECORDS, "utf8").split("\n").filter((l) => l.trim()).flatMap((l, i) => {
    try { return [JSON.parse(l)]; } catch { bad.push(i + 1); return []; }
  });
  if (bad.length) {
    console.error(`✗ evals/records.jsonl: unreadable line(s) ${bad.join(", ")}, build stopped.`);
    process.exit(1);
  }
}
for (const r of records) r.date = shift(r.date);
writeFileSync(RECORDS_OUT, JSON.stringify(records) + "\n");
const failing = records.filter((r) => r.checks && !r.checks.ok);
console.log(`${records.length} free-text record(s) → src/data/records.json${failing.length ? `, ${failing.length} failing their checks` : ""}`);

/* The story catalogue (profile/stories.md), for the Stories page and for the
 * evidence of each text: every story and fact is crossed with the texts that
 * use it and their scores. Read from the table rows « | [ID] | ... | »: a
 * story row has four columns after the id (story, what it proves, citable
 * facts, source), a fact row two (fact, source). A missing file is fine: the
 * page then says the catalogue is empty. */
const STORIES_OUT = resolve(HERE, "../src/data/stories.json");
const stories = [];
if (existsSync(STORIES)) {
  for (const line of readFileSync(STORIES, "utf8").split("\n")) {
    const m = line.match(/^\|\s*\[((?:ST|FACT)-[A-Z0-9-]+)\]\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const cols = m[2].split("|").map((c) => c.trim().replace(/\*\*|`/g, ""));
    stories.push(
      m[1].startsWith("ST-")
        ? { id: m[1], type: "story", title: cols[0] ?? "", proves: cols[1] ?? "", facts: cols[2] ?? "", source: cols[3] ?? "" }
        : { id: m[1], type: "fact", title: cols[0] ?? "", proves: "", facts: "", source: cols[1] ?? "" },
    );
  }
}
writeFileSync(STORIES_OUT, JSON.stringify(stories) + "\n");
console.log(`${stories.length} stories and facts → src/data/stories.json`);
