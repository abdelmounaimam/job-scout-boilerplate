#!/usr/bin/env node
// One-off slug check. THE rule of the watchlist is: adding a company means
// verifying its slug first, never guessing it. This is the tool that verifies.
//
//   node probe.mjs "Company Name"        try every ATS, every slug variant
//   node probe.mjs ashby acme            check one exact pair
//   node probe.mjs ashby acme --jobs     also print the reqs it returns
//
// ⚠️ Two traps this exists to catch:
//   · name collisions. A slug that answers is not proof it is the right company:
//     one ATS slug that reads like a well-known database company is a payments
//     platform, another that reads like a well-known ORM is an unrelated fintech.
//     ALWAYS eyeball the returned titles before trusting a slug.
//   · SmartRecruiters is case sensitive and returns an EMPTY LIST, not an error,
//     for a wrongly-cased identifier.

import { ADAPTERS, DISCOVERABLE, fetchBoard } from './adapters.mjs';

const args = process.argv.slice(2);
const SHOW = args.includes('--jobs');
const positional = args.filter((a) => !a.startsWith('--'));

if (!positional.length) {
  console.log('usage: node probe.mjs "Company Name"  |  node probe.mjs <ats> <slug> [--jobs]');
  process.exit(1);
}

function variants(ats, name) {
  const base = name.toLowerCase().trim();
  if (ats === 'smartrecruiters') {
    const raw = name.replace(/[^A-Za-z0-9]+/g, '');
    return [...new Set([raw.charAt(0).toUpperCase() + raw.slice(1), raw])];
  }
  return [...new Set([
    base.replace(/[^a-z0-9.]+/g, ''),
    base.replace(/[^a-z0-9]+/g, ''),
    base.replace(/[^a-z0-9]+/g, '-'),
    base.split(/[\s.]+/)[0].replace(/[^a-z0-9]+/g, ''),
  ])].filter((s) => s.length >= 2);
}

const report = (ats, slug, res) => {
  if (res.error) return console.log(`  ✗ ${ats}/${slug}: ${res.error}`);
  if (!res.jobs.length) return console.log(`  · ${ats}/${slug}: answers, but 0 reqs (wrong slug, or genuinely empty)`);
  console.log(`  ✓ ${ats}/${slug}: ${res.jobs.length} req(s)`);
  const sample = SHOW ? res.jobs : res.jobs.slice(0, 5);
  for (const j of sample) console.log(`      ${j.title.slice(0, 70)}  ·  ${(j.location || '?').slice(0, 40)}`);
  if (!SHOW && res.jobs.length > 5) console.log(`      … ${res.jobs.length - 5} more (--jobs to see all)`);
  console.log('      ⚠ check these titles look like this company before adding the slug.');
};

if (positional.length >= 2 && ADAPTERS[positional[0]]) {
  const [ats, slug] = positional;
  report(ats, slug, await fetchBoard({ ats, slug }));
} else {
  const name = positional.join(' ');
  console.log(`Probing "${name}" across ${DISCOVERABLE.length} ATS…\n`);
  for (const ats of DISCOVERABLE) {
    for (const slug of variants(ats, name)) {
      const res = await fetchBoard({ ats, slug }, { timeout: 12000 });
      if (!res.error && res.jobs.length) { report(ats, slug, res); break; }
    }
  }
  console.log('\nNo output for an ATS means no variant answered there.');
}
