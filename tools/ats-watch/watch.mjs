#!/usr/bin/env node
// Poller over the public ATS boards of the watchlist. Run by hand, or by
// tools/daily-scan.sh. Zero dependencies, Node 20+, no authentication: no
// browser, no cookie, no account to be traced to.
//
// ⚠️ SCOPE: it filters on TITLE and LOCATION only. It does not download
// descriptions (thousands of reqs, absurd) and therefore does NOT replace
// reading the posting. It answers exactly one question: "has a new, plausible
// req appeared since last time?" Reading the body stays mandatory before
// investing, and the body can close what the title opened (one company's
// three backend reqs all said "8+ years", and came back ★ ACTIONABLE at every
// run until the company went into profile/ruled-out.mjs).
//
//   node watch.mjs                only reqs that are NEW since the last run
//   node watch.mjs --all          ignore state, show every match
//   node watch.mjs --reset        mark everything as seen, report nothing
//   node watch.mjs --quiet        print nothing when there is nothing new
//   node watch.mjs --csv=<file>   also write the new reqs as a digest CSV

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBoard } from './adapters.mjs';
import { geo, titleVerdict, ruledOut, appliedChecker } from './filters.mjs';
import { toCsv } from '../lib/text.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEN_FILE = join(HERE, '.seen.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const RESET = flag('reset');
const ALL = flag('all');
const QUIET = flag('quiet');
// ⚠️ The digest is written FROM THE DATA, never by re-parsing the console
// output. A first attempt ran a regex over the printed text: 0 rows out of 151
// reqs, silently, and an empty file looks exactly like "nothing found".
const CSV = args.find((a) => a.startsWith('--csv='))?.slice(6);

const list = JSON.parse(readFileSync(join(HERE, 'watchlist.json'), 'utf8'));
const seen = existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, 'utf8')) : {};
const firstRun = Object.keys(seen).length === 0;
const isApplied = appliedChecker();

const fresh = [];
const errors = [];
let scanned = 0;
const dropTally = new Map();
const drop = (why) => dropTally.set(why, (dropTally.get(why) ?? 0) + 1);

for (const co of list.companies) {
  const res = await fetchBoard(co);
  if (res.error) {
    errors.push(`${co.name} (${co.ats}/${co.slug}${co.site ? `/${co.site}` : ''}): ${res.error}`);
    continue;
  }

  // Composite key: two ATS can serve the same slug for different companies.
  // Workday also needs the site, since one tenant can host several boards.
  const key = `${co.ats}:${co.slug}${co.site ? `:${co.site}` : ''}`;
  const before = new Set(seen[key] ?? []);
  const ids = [];
  const closed = ruledOut(co.name);
  const applied = isApplied(co);

  for (const job of res.jobs) {
    scanned += 1;
    ids.push(job.id);
    if (!ALL && before.has(job.id)) continue; // already seen
    if (closed) { drop('company ruled out'); continue; }

    const why = titleVerdict(job.title);
    if (why) { drop(why.split(' (')[0]); continue; }
    const place = geo.verdict(job);
    if (!place.keep) { drop('abroad'); continue; }

    fresh.push({ ...job, company: co.name, ats: co.ats, applied, note: co.note, tag: place.tag });
  }
  seen[key] = ids;
  await sleep(150);
}

mkdirSync(dirname(SEEN_FILE), { recursive: true });
writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 1));

// --- output -------------------------------------------------------------------

// ⚠️⚠️ BOARD ERRORS COME FIRST, as an incident block. A board that moved to
// another ATS does not break the poller, it makes it SILENTLY ONE-EYED on that
// company. The source pipeline printed the error on one line at the very
// bottom, after 73 reqs, exactly where nobody reads, and a company went
// unwatched for weeks. A 404 here means: find the new board (probe.mjs, or the
// careers link on the company's own site), then fix the watchlist entry.
if (errors.length) {
  console.log(`⚠⚠ INCIDENT: ${errors.length} board(s) failed. Each one is a company no longer watched.`);
  for (const e of errors) console.log(`   ✗ ${e}`);
  console.log('   → node tools/ats-watch/probe.mjs "<Company>" to find where it moved.\n');
}

if (RESET) {
  console.log(`State initialised: ${scanned} reqs marked as seen across ${list.companies.length} boards.`);
  process.exit(0);
}

if (firstRun && !ALL) {
  console.log(`First run: ${scanned} reqs recorded as the baseline across ${list.companies.length} boards.`);
  console.log('Later runs report only what is new. Use `--all` to see everything now.');
  process.exit(0);
}

const tally = () => [...dropTally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');

if (!fresh.length) {
  if (!QUIET || errors.length) {
    console.log(`Nothing new. ${scanned} reqs seen across ${list.companies.length} boards.`);
    // ⚠️ Nothing ever disappears silently: always print why things were dropped.
    if (dropTally.size) console.log(`  dropped: ${tally()}`);
  }
  process.exit(0);
}

// Companies not yet applied to first: those are the actionable ones.
fresh.sort((a, b) => Number(a.applied) - Number(b.applied) || a.company.localeCompare(b.company));

// One application per company makes it pointless to print 14 near-identical
// reqs from the same employer. One company produced exactly that on day one.
const PER_CO = 3;
const perCo = new Map();
const shown = [];
let collapsed = 0;
for (const j of fresh) {
  const n = perCo.get(j.company) ?? 0;
  if (n < PER_CO) { shown.push(j); perCo.set(j.company, n + 1); } else { collapsed += 1; }
}

if (CSV) {
  // Same columns as every other digest of the pipeline. `verdict` and `why`
  // are left EMPTY on purpose: the script produces facts, the judgement is made
  // in session while reading the body, and `why` quotes the line it rests on.
  const cols = ['date_scan', 'verdict', 'why', 'title', 'company', 'location_remote',
    'years_required', 'junior_open', 'mgmt_scope', 'salary_shown', 'stack',
    'stack_negative', 'level', 'applicants', 'easy_apply', 'posted_on', 'link'];
  // ⚠️ LOCAL date, not toISOString(), which is UTC: at 00:20 local time the
  // digest dated itself from the day before and would have overwritten it.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rows = fresh.filter((j) => !j.applied).map((j) => ({
    date_scan: today,
    title: j.title,
    company: j.company,
    location_remote: `${j.tag}${j.location ? ` · ${j.location}` : ''}`,
    salary_shown: j.pay ?? '',
    easy_apply: `no (${j.ats})`,
    posted_on: j.publishedAt ?? '',
    link: j.url,
  }));
  writeFileSync(CSV, `${toCsv(rows, cols)}\n`);
  console.log(`Digest written: ${CSV} (${rows.length} rows, verdict and why left empty)\n`);
}

console.log(`${fresh.length} NEW plausible req(s), out of ${scanned} reqs across ${list.companies.length} boards.`);
if (collapsed) {
  const over = [...perCo].filter(([, n]) => n >= PER_CO).map(([c]) => c);
  console.log(`Capped at ${PER_CO} per company: ${collapsed} req(s) hidden for ${over.join(', ')}.`);
}
if (dropTally.size) console.log(`Dropped this run: ${tally()}`);
console.log('');
for (const j of shown) {
  const mark = j.applied ? '· (already applied here, FYI only)' : '★ ACTIONABLE';
  console.log(`${mark}  ${j.company} — ${j.title}`);
  // Truncated: some boards list thirty countries in one location string.
  const where = (j.location || '?').length > 90 ? `${j.location.slice(0, 90)}…` : (j.location || '?');
  console.log(`    ${j.tag} · ${where}${j.pay ? ` · ${j.pay}` : ''}`);
  if (j.note) console.log(`    note: ${j.note}`);
  console.log(`    ${j.url}`);
}
console.log('\n⚠ Title and location only. Read the BODY of every posting before investing:');
console.log('  minimum qualifications, real stack, salary band. Remote flags are wrong in both directions.');
