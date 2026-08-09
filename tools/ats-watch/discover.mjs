#!/usr/bin/env node
// WEEKLY DISCOVERY: find companies that are NOT on the watchlist yet.
// Zero dependencies, Node 20+, no authentication.
//
// Principle: derive plausible slugs from company names (candidates.json), probe
// the public ATS APIs, and promote into watchlist.json any live board with at
// least one plausible req.
//
// The effect is meant to be CUMULATIVE: every run permanently widens what the
// daily poller covers, and a slug already tried without success is not probed
// again, so runs get shorter over time rather than repeating themselves.
//
// ⚠️ It only finds companies whose NAME is already in the pool. Finding names
// nobody thought of is what the bootstrap and web-search workflows are for.
//
//   node discover.mjs              read-only: shows what it would add
//   node discover.mjs --promote    writes the findings into watchlist.json
//   node discover.mjs --retry-all  re-probes slugs already tried

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TITLE, STACK, INTERMEDIARY, GEO } from '../../profile/profile.mjs';
import { makeGeo } from './geo.mjs';
import { DISCOVERABLE, fetchBoard } from './adapters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WATCHLIST = join(HERE, 'watchlist.json');
const CANDIDATES = join(HERE, 'candidates.json');
const TRIED = join(HERE, '.tried.json');
const geo = makeGeo(GEO);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A company name → the slugs worth probing. */
function slugVariants(name) {
  const base = name.toLowerCase().trim();
  const noAmp = base.replace(/\s*&\s*/g, ' and ');
  const out = new Set([
    base.replace(/[^a-z0-9.]+/g, ''),          // "Weights & Biases" -> "weightsbiases"
    base.replace(/[^a-z0-9]+/g, ''),           // drops dots too
    base.replace(/[^a-z0-9]+/g, '-'),          // "Cal.com" -> "cal-com"
    noAmp.replace(/[^a-z0-9]+/g, ''),
    base.split(/[\s.]+/)[0].replace(/[^a-z0-9]+/g, ''),  // first word only
  ]);
  return [...out].filter((s) => s.length >= 2 && s.length <= 40);
}

/** ⚠️ SmartRecruiters is the one ATS whose identifier is CASE SENSITIVE:
 *  `Acme` answers, `acme` returns an empty list rather than an error. Feeding
 *  it lowercase variants makes every company look like it has no open roles. */
function slugsFor(ats, name) {
  if (ats !== 'smartrecruiters') return slugVariants(name);
  const raw = name.replace(/[^A-Za-z0-9]+/g, '');
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
  return [...new Set([cap, raw])].filter((s) => s.length >= 2 && s.length <= 40);
}

const hasWord = (haystack, needle) =>
  new RegExp(`(^|[^a-z0-9+#.])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9+#]|$)`, 'i')
    .test(haystack);

/** Is this req plausible, on title and location alone? */
function plausible(job) {
  const t = job.title.toLowerCase();
  if (!/engineer|developer|développeur|entwickler|swe|software|programmer/.test(t)) return false;
  if (TITLE.tooJunior.some((x) => t.includes(x))) return false;
  if (TITLE.wrongFunction.some((x) => t.includes(x))) return false;
  if (TITLE.tooSenior.some((x) => t.includes(x))) return false;
  if (STACK.negativeInTitle.some((x) => hasWord(t, x))) return false;
  return geo.ok(job);
}

/** Does the name betray an agency, a consultancy or a body shop? */
const isBodyShop = (name) => {
  const n = name.toLowerCase();
  return INTERMEDIARY.names.some((s) => n.includes(s.trim()));
};

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
const collisions = new Set(Object.keys(wl._known_collisions ?? {}));

const found = [];
let probes = 0;

for (const name of cand.names) {
  if (isBodyShop(name)) continue;

  // A company may exist on one ATS only. Each ATS has its own slug variants and
  // its own loop. ATS are probed in parallel for one name, variants in series:
  // fully serial, a weekly pass went from 3 to 20 minutes in the source pipeline.
  const hits = (await Promise.all(DISCOVERABLE.map(async (ats) => {
    for (const slug of slugsFor(ats, name)) {
      if (known.has(`${ats}:${slug}`) || collisions.has(slug)) continue;
      if (!RETRY_ALL && tried.has(`${ats}:${slug}`)) continue;

      const hit = await probe(ats, slug);
      probes += 1;
      tried.add(`${ats}:${slug}`);
      if (hit) return hit;   // this name answers on this ATS, stop trying variants
    }
    return null;
  }))).filter(Boolean);

  for (const h of hits) if (h.matches.length) found.push({ name, ...h });
  if (hits.length || probes % 25 === 0) await sleep(120);
}

// ⚠️ The probe memory is written ONLY in --promote mode. Otherwise a read-only
// run burns the very slugs it just found, and the `--promote` run documented
// right after it sees nothing at all. That happened, and cost a full discovery
// pass in the source pipeline.
if (PROMOTE) writeFileSync(TRIED, JSON.stringify([...tried], null, 0));

// --- output -------------------------------------------------------------------

if (!found.length) {
  console.log(`Discovery: no new usable board. ${probes} probes, ${tried.size} slugs tried in total.`);
  console.log('The pool is exhausted for the names on file. Add names to candidates.json,');
  console.log('or run the bootstrap workflow, which finds names nobody wrote down yet.');
  process.exit(0);
}

found.sort((a, b) => b.matches.length - a.matches.length);

console.log(`\n${found.length} NEW usable board(s) discovered (${probes} probes):\n`);
for (const f of found) {
  console.log(`★ ${f.name}  [${f.ats}/${f.slug}]  ${f.matches.length} plausible req(s) of ${f.total}`);
  for (const m of f.matches.slice(0, 4)) {
    console.log(`    ${m.title.slice(0, 62)}  ·  ${(m.location || '?').slice(0, 44)}`);
  }
  if (f.matches.length > 4) console.log(`    … and ${f.matches.length - 4} more`);
}

if (PROMOTE) {
  const today = process.env.TODAY ?? new Date().toISOString().slice(0, 10);
  for (const f of found) {
    wl.companies.push({
      name: f.name, ats: f.ats, slug: f.slug, applied: false,
      note: `auto-discovered ${today}`,
    });
  }
  writeFileSync(WATCHLIST, `${JSON.stringify(wl, null, 2)}\n`);
  console.log(`\n✓ ${found.length} board(s) added to watchlist.json. The daily poller now covers them.`);
  console.log('  Run `node watch.mjs` next to record their baseline instead of reporting them all at once.');
} else {
  console.log('\n(read-only — re-run with --promote to add them to the watchlist)');
}

console.log('\n⚠ Title and location only. Read the BODY before investing.');
