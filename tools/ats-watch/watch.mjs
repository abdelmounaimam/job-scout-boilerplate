#!/usr/bin/env node
// Daily poller over the public ATS boards on the watchlist.
// Zero dependencies, Node 20+. No authentication: these endpoints are public,
// so this runs with no browser, no cookie and no account to be traced to.
//
// ⚠️ SCOPE: it filters on TITLE and LOCATION only. It does not download
// descriptions (thousands of reqs, absurd) and therefore does NOT replace
// reading the posting. It answers exactly one question: "has a new, plausible
// req appeared since last time?" Reading the body stays mandatory.
//
//   node watch.mjs           only reqs that are NEW since the last run
//   node watch.mjs --all     ignore state, show every match
//   node watch.mjs --reset   mark everything as seen, report nothing
//   node watch.mjs --quiet   print nothing when there is nothing new

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE, STACK, RULED_OUT, GEO } from '../../profile/profile.mjs';
import { makeGeo } from './geo.mjs';
import { fetchBoard } from './adapters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEN_FILE = join(HERE, '.seen.json');
const geo = makeGeo(GEO);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- filters -----------------------------------------------------------------

const ROLE_WORDS = /engineer|developer|développeur|entwickler|swe|software|programmer/i;

/** Word-boundary test. ⚠️ A plain `includes` on 'java' fires on 'javascript'
 *  and silently kills every good posting. This bug is easy to reintroduce. */
const hasWord = (haystack, needle) =>
  new RegExp(`(^|[^a-z0-9+#.])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9+#]|$)`, 'i')
    .test(haystack);

/** Does the title plausibly describe the role? Cheap filter, never final. */
function titleLooksRight(title) {
  const t = title.toLowerCase();
  if (!ROLE_WORDS.test(t)) return 'not an engineering role';
  const junior = TITLE.tooJunior.find((x) => t.includes(x));
  if (junior) return `level (${junior.trim()})`;
  const fn = TITLE.wrongFunction.find((x) => t.includes(x));
  if (fn) return `adjacent function (${fn.trim()})`;
  // Senior titles are DROPPED here, where a body-reading triage would only flag
  // them. Deliberate: this poller has nothing but the title to go on.
  const senior = TITLE.tooSenior.find((x) => t.includes(x));
  if (senior) return `out of band (${senior.trim()})`;
  const veto = STACK.negativeInTitle.find((x) => hasWord(t, x));
  if (veto) return `stack in title (${veto.trim()})`;
  return null;
}

const ruledOut = (company) => {
  const n = company.toLowerCase().trim();
  const hit = Object.keys(RULED_OUT).find((k) => n.includes(k));
  return hit ? RULED_OUT[hit] : null;
};

// --- program ------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const RESET = flag('reset');
const ALL = flag('all');
const QUIET = flag('quiet');

const list = JSON.parse(readFileSync(join(HERE, 'watchlist.json'), 'utf8'));
const seen = existsSync(SEEN_FILE) ? JSON.parse(readFileSync(SEEN_FILE, 'utf8')) : {};
const firstRun = Object.keys(seen).length === 0;

const fresh = [];
const errors = [];
let scanned = 0;
const dropTally = new Map();
const drop = (why) => dropTally.set(why, (dropTally.get(why) ?? 0) + 1);

for (const co of list.companies) {
  const res = await fetchBoard(co);
  if (res.error) { errors.push(`${co.name} (${co.ats}/${co.slug}): ${res.error}`); continue; }

  // Composite key: two ATS can serve the same slug for different companies.
  const key = `${co.ats}:${co.slug}`;
  const before = new Set(seen[key] ?? []);
  const ids = [];
  const closed = ruledOut(co.name);

  for (const job of res.jobs) {
    scanned += 1;
    ids.push(job.id);
    if (!ALL && before.has(job.id)) continue;      // already seen
    if (closed) { drop('company ruled out'); continue; }

    const why = titleLooksRight(job.title);
    if (why) { drop(why.split(' (')[0]); continue; }
    const place = geo.verdict(job);
    if (!place.keep) { drop('abroad'); continue; }

    fresh.push({ ...job, company: co.name, ats: co.ats, applied: co.applied, note: co.note, tag: place.tag });
  }
  seen[key] = ids;
  await sleep(150);
}

mkdirSync(dirname(SEEN_FILE), { recursive: true });
writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 1));

// --- output -------------------------------------------------------------------

if (RESET) {
  console.log(`State initialised: ${scanned} reqs marked as seen across ${list.companies.length} boards.`);
  process.exit(0);
}

if (firstRun && !ALL) {
  console.log(`First run: ${scanned} reqs recorded as the baseline across ${list.companies.length} boards.`);
  console.log('Later runs report only what is new. Use `--all` to see everything now.');
  if (errors.length) console.log(`\n⚠ ${errors.length} board(s) failed:\n  ${errors.join('\n  ')}`);
  process.exit(0);
}

if (!fresh.length) {
  if (!QUIET) {
    console.log(`Nothing new. ${scanned} reqs seen across ${list.companies.length} boards.`);
    // ⚠️ Nothing ever disappears silently: always print why things were dropped.
    if (dropTally.size) {
      const t = [...dropTally].sort((a, b) => b[1] - a[1]).slice(0, 6);
      console.log(`  dropped: ${t.map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    }
    if (errors.length) console.log(`⚠ ${errors.length} board(s) failed: ${errors.join(' | ')}`);
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

console.log(`\n${fresh.length} NEW plausible req(s), out of ${scanned} reqs across ${list.companies.length} boards.`);
if (collapsed) {
  const over = [...perCo].filter(([, n]) => n >= PER_CO).map(([c]) => c);
  console.log(`Capped at ${PER_CO} per company: ${collapsed} req(s) hidden for ${over.join(', ')}.`);
}
if (dropTally.size) {
  const t = [...dropTally].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`Dropped this run: ${t.map(([k, n]) => `${k} ${n}`).join(' · ')}`);
}
console.log('');
for (const j of shown) {
  const mark = j.applied ? '· (already applied here, FYI only)' : '★ ACTIONABLE';
  console.log(`${mark}  ${j.company} — ${j.title}`);
  // Truncated: some boards list thirty countries in one location string, which
  // pushes everything else off the screen.
  const where = (j.location || '?').length > 90 ? `${j.location.slice(0, 90)}…` : (j.location || '?');
  console.log(`    ${j.tag} · ${where}${j.pay ? ` · ${j.pay}` : ''}`);
  if (j.note) console.log(`    note: ${j.note}`);
  console.log(`    ${j.url}`);
}
console.log('\n⚠ Title and location only. Read the BODY of every posting before investing:');
console.log('  minimum qualifications, real stack, salary band. Remote flags are wrong in both directions.');
if (errors.length) console.log(`\n⚠ ${errors.length} board(s) failed: ${errors.join(' | ')}`);
