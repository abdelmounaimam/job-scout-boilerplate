#!/usr/bin/env node
// Workday prober. It lives apart from discover.mjs for one reason: Workday
// needs TWO identifiers, the tenant and the site, and the site cannot be
// derived from the company name. discover.mjs, which only derives slugs, can
// therefore never find it. This crosses a list of tenants with a list of
// plausible site names.
//
// It matters for industrial profiles above all: aerospace, automotive, defence
// and rail groups are massively on Workday, and those employers appear on NONE
// of the startup-oriented boards.
//
//   node probe-workday.mjs                     probe the built-in list
//   node probe-workday.mjs --promote           add the findings to watchlist.json
//   node probe-workday.mjs acme globex         probe these tenants only
//
// ⚠️ Rate deliberately low. A mass probe that returns zero must be re-measured
// slowly before it is written down as a fact: swallowed throttling looks
// exactly like an absent board.
// ⚠️ The fastest route is still reading the careers URL itself:
//   node probe.mjs --careers <careers page>   gives tenant, host and site at once.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBoard } from './adapters.mjs';
import { appliedChecker } from './filters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WATCHLIST = join(HERE, 'watchlist.json');

// Plausible tenants: the part before `.wdN.myworkdayjobs.com` in the employer's
// careers URL. ⚠️ FILL for the candidate's market. Empty by default, because a
// tenant list is sector specific.
const TENANTS = [
  // 'acme', 'globex',
];

// Site names met in practice. Case matters.
const SITES = [
  'Careers', 'External', 'careers', 'External_Careers', 'ExternalCareers',
  'ExternalCareerSite', 'Global_Careers', 'GlobalCareers', 'Jobs', 'jobs',
  'Recrutement', 'Carrieres', 'CareerSite', 'Externe',
];

const HOSTS = ['wd3', 'wd1', 'wd5'];

const args = process.argv.slice(2);
const PROMOTE = args.includes('--promote');
const only = args.filter((a) => !a.startsWith('--'));
const tenants = only.length ? only : TENANTS;

if (!tenants.length) {
  console.log('No tenant to probe. Fill TENANTS in this file, or pass tenants as arguments.');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const found = [];
let probes = 0;

for (const slug of tenants) {
  let hit = null;
  for (const host of HOSTS) {
    for (const site of SITES) {
      probes += 1;
      const res = await fetchBoard({ ats: 'workday', slug, site, host }, { timeout: 10000 });
      if (!res.error && res.jobs?.length) { hit = { slug, site, host, jobs: res.jobs }; break; }
      await sleep(60);
    }
    if (hit) break;
  }
  if (hit) {
    found.push(hit);
    console.log(`★ ${hit.slug} / ${hit.site} [${hit.host}] — ${hit.jobs.length} req(s)`);
    for (const j of hit.jobs.slice(0, 3)) {
      console.log(`    ${j.title.slice(0, 62)}  ·  ${(j.location || '?').slice(0, 40)}`);
    }
    console.log('    ⚠ check these titles belong to this company');
  }
}

console.log(`\n${found.length} Workday board(s) found across ${tenants.length} tenants (${probes} probes).`);

if (PROMOTE && found.length) {
  const wl = JSON.parse(readFileSync(WATCHLIST, 'utf8'));
  const known = new Set(wl.companies.map((c) => `${c.ats}:${c.slug}:${c.site ?? ''}`));
  const isApplied = appliedChecker();
  let added = 0;
  const today = process.env.TODAY ?? new Date().toISOString().slice(0, 10);
  for (const t of found) {
    if (known.has(`workday:${t.slug}:${t.site}`)) continue;
    const applied = isApplied({ name: t.slug });
    wl.companies.push({
      name: t.slug, ats: 'workday', slug: t.slug, site: t.site,
      ...(t.host !== 'wd3' ? { host: t.host } : {}),
      ...(applied ? { applied: true } : {}),
      note: `Workday found ${today}, ${t.jobs.length} reqs at probe time`,
    });
    added += 1;
  }
  writeFileSync(WATCHLIST, `${JSON.stringify(wl, null, 2)}\n`);
  console.log(`✓ ${added} board(s) added to watchlist.json.`);
  console.log('  ⚠ The `name` field holds the tenant: replace it with the real company name,');
  console.log('    otherwise the tracker cross-check (one application per company) cannot match it.');
} else if (found.length) {
  console.log('(read-only — re-run with --promote to add them)');
}
