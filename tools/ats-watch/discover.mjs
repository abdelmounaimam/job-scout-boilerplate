#!/usr/bin/env node
// DISCOVERY: find companies that are NOT on the watchlist yet.
// Zero dependencies, Node 20+, no authentication. Run by hand (or by
// tools/weekly-discover.sh).
//
// Principle: derive plausible slugs from company names (candidates.json), probe
// the public ATS APIs, and promote into watchlist.json any live board with at
// least one plausible req.
//
// The effect is meant to be CUMULATIVE: every run permanently widens what the
// poller covers, and a slug already tried without success is not probed again,
// so runs get shorter over time rather than repeating themselves.
//
// ⚠️ It only finds companies whose NAME is already in the pool. Finding names
// nobody thought of is what the bootstrap and web-search workflows are for.
// Adding names is cheap: a name that answers nowhere costs a few failed requests.
//
// ⚠️⚠️ SLOW AND SILENT. A full pass over a pool of a few hundred names is
// thousands of probes and can take HOURS (about 2 h 20 for 2 879 probes), and
// nothing is printed before the end. An empty output mid-run does not mean it
// is broken. Run it in the BACKGROUND with the output redirected to a file,
// NEVER under a short `timeout`: a pass killed midway loses everything,
// including the .tried.json memo (one --promote pass died that way, wrote
// nothing, printed nothing, and still exited 0).
//
//   node discover.mjs              read-only: shows what it would add
//   node discover.mjs --promote    writes the findings into watchlist.json
//   node discover.mjs --retry-all  re-probes slugs already tried

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCOVERABLE, fetchBoard } from './adapters.mjs';
import { geo, titleVerdict, intermediaryName, ruledOut, appliedChecker, slugsFor } from './filters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WATCHLIST = join(HERE, 'watchlist.json');
const CANDIDATES = join(HERE, 'candidates.json');
const TRIED = join(HERE, '.tried.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Is this req plausible, on title and location alone? */
const plausible = (job) => !titleVerdict(job.title) && geo.ok(job);

async function probe(ats, slug) {
  const res = await fetchBoard({ ats, slug }, { timeout: 12000 });
  if (res.error || !res.jobs?.length) return null;
  return { ats, slug, total: res.jobs.length, matches: res.jobs.filter(plausible) };
}

// --- program ------------------------------------------------------------------

const args = process.argv.slice(2);
const PROMOTE = args.includes('--promote');
const RETRY_ALL = args.includes('--retry-all');

const wl = JSON.parse(readFileSync(WATCHLIST, 'utf8'));
const cand = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
const tried = existsSync(TRIED) ? new Set(JSON.parse(readFileSync(TRIED, 'utf8'))) : new Set();

const known = new Set(wl.companies.map((c) => `${c.ats}:${c.slug}`));
const collisions = new Set(
  Object.keys(wl._collisions_do_not_add ?? {}).filter((k) => !k.startsWith('_')).map((k) => k.split('/').pop()),
);

const found = [];
let probes = 0;
let skippedIntermediaries = 0;
let skippedRuledOut = 0;

for (const name of cand.names ?? []) {
  // Agencies and consultancies have no place on the watchlist.
  if (intermediaryName(name)) { skippedIntermediaries += 1; continue; }
  if (ruledOut(name)) { skippedRuledOut += 1; continue; }

  // A company may exist on one ATS only. Each ATS has its own slug variants and
  // its own loop. ATS are probed in parallel for one name, variants in series:
  // fully serial, a weekly pass went from 3 to 20 minutes.
  const hits = (await Promise.all(DISCOVERABLE.map(async (ats) => {
    for (const slug of slugsFor(ats, name)) {
      if (known.has(`${ats}:${slug}`) || collisions.has(slug)) continue;
      if (!RETRY_ALL && tried.has(`${ats}:${slug}`)) continue;

      const hit = await probe(ats, slug);
      probes += 1;
      tried.add(`${ats}:${slug}`);
      if (hit) return hit; // this name answers on this ATS, stop trying variants
    }
    return null;
  }))).filter(Boolean);

  for (const h of hits) if (h.matches.length) found.push({ name, ...h });
  if (hits.length || probes % 25 === 0) await sleep(120);
}

// ⚠️ The probe memory is written ONLY in --promote mode. Otherwise a read-only
// run burns the very slugs it just found, and the `--promote` run documented
// right after it sees nothing at all. That happened, and cost a full discovery
// pass (eight boards lost the first time).
if (PROMOTE) writeFileSync(TRIED, JSON.stringify([...tried], null, 0));

// --- output -------------------------------------------------------------------

const skipped = `${skippedIntermediaries} intermediary name(s) and ${skippedRuledOut} ruled-out name(s) skipped`;

if (!found.length) {
  console.log(`Discovery: no new usable board. ${probes} probes, ${tried.size} slugs tried in total, ${skipped}.`);
  console.log('The pool is exhausted for the names on file. Add names to candidates.json,');
  console.log('or run the bootstrap / web-search workflows, which find names nobody wrote down yet.');
  console.log('⚠ A mass probe that returns ZERO is re-measured slowly (probe.mjs on a few names)');
  console.log('  before it is written down as a fact: a swallowed 429 looks exactly like no board.');
  process.exit(0);
}

found.sort((a, b) => b.matches.length - a.matches.length);

// ⚠️⚠️ Cross-check the TRACKER before promoting, with the word-prefix company
// match (never a substring: "nova" is inside "casanova"). A board promoted
// without it once came back ★ ACTIONABLE on the req of an interview already
// running there. The poller re-checks at runtime too; this makes it visible.
const isApplied = appliedChecker();

console.log(`\n${found.length} NEW usable board(s) discovered (${probes} probes, ${skipped}):\n`);
for (const f of found) {
  f.applied = isApplied({ name: f.name });
  console.log(`★ ${f.name}  [${f.ats}/${f.slug}]  ${f.matches.length} plausible req(s) of ${f.total}`
    + `${f.applied ? '  · ALREADY APPLIED HERE (one application per company)' : ''}`);
  for (const m of f.matches.slice(0, 4)) {
    console.log(`    ${m.title.slice(0, 62)}  ·  ${(m.location || '?').slice(0, 44)}`);
  }
  if (f.matches.length > 4) console.log(`    … and ${f.matches.length - 4} more`);
}

if (PROMOTE) {
  const today = process.env.TODAY ?? new Date().toISOString().slice(0, 10);
  for (const f of found) {
    wl.companies.push({
      name: f.name, ats: f.ats, slug: f.slug,
      ...(f.applied ? { applied: true } : {}),
      note: `auto-discovered ${today}${f.applied ? ', already applied at promotion time' : ''}`,
    });
  }
  writeFileSync(WATCHLIST, `${JSON.stringify(wl, null, 2)}\n`);
  console.log(`\n✓ ${found.length} board(s) added to watchlist.json. The poller now covers them.`);
  console.log('  Run `node watch.mjs --quiet` next to record their baseline instead of reporting them all at once.');
  console.log('  Then READ the new names: real product, or agency / marketplace / internal IT? Remove the latter.');
} else {
  console.log('\n(read-only — re-run with --promote to add them to the watchlist)');
}

console.log(`
⚠ Title and location only. Read the BODY before investing.
⚠ A slug that answers is not proof it is the right company: eyeball the titles
  (name collisions are listed in watchlist.json → _collisions_do_not_add).
⚠ Discovery derives slugs from the NAME, so it cannot find a slug that carries
  the domain (a real one was "<name>.ai", with the dot). When a known company
  answers nowhere, read the careers link on ITS OWN site before writing
  "no public board": a regex on ashbyhq.com|greenhouse.io|lever.co|workable.com|
  teamtailor.com|smartrecruiters.com|myworkdayjobs.com in that HTML gives the
  slug in one request.`);
