#!/usr/bin/env node
// One-off board check. THE rule of the watchlist is: adding a company means
// verifying its board first, never guessing the slug. This is the tool.
//
//   node probe.mjs "Company Name"             every ATS, every slug variant
//   node probe.mjs ashby acme                 one exact pair
//   node probe.mjs ashby acme --jobs          also print every req it returns
//   node probe.mjs workday <tenant> <site> [host]
//   node probe.mjs --careers https://acme.com/careers   read the ATS off a careers page
//
// For every board that answers it prints, besides the reqs:
//   · the HOSTED PAGE status. ⚠️⚠️ An ATS API can OUTLIVE its board: a Lever API
//     kept serving 23 reqs weeks after the hosted page returned 404 and the
//     company had moved to Workable. Adding it would have surfaced phantom
//     postings forever. The hosted page is the test, not the API.
//   · the NEWEST req date, when the ATS gives a real one. A dead board's newest
//     req is weeks old; the live board of the same company is days old.
//     (Lever's createdAt is not a publication date and is not used.)
//
// ⚠️ Other traps this exists to catch:
//   · name collisions. A slug that answers is not proof it is the right company:
//     one Ashby slug that reads like a well-known database is a games payments
//     platform. ALWAYS eyeball the returned titles before trusting a slug.
//   · SmartRecruiters is case sensitive and returns an EMPTY LIST, not an error,
//     for a wrongly cased identifier.
//   · a slug can carry the DOMAIN ("acme.ai", with the dot). No derivation from
//     the name finds it: use --careers on the company's own careers page.
//   · probe slowly when checking a "zero": a swallowed 429 looks like no board.

import { ADAPTERS, DISCOVERABLE, fetchBoard } from './adapters.mjs';
import { slugsFor, titleVerdict, geo } from './filters.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
const SHOW = args.includes('--jobs');
const careersAt = args.indexOf('--careers');
const positional = args.filter((a, i) => !a.startsWith('--') && (careersAt === -1 || i !== careersAt + 1));

/** The page a human would open. Its status is what decides "alive". */
const HOSTED = {
  ashby: (co) => `https://jobs.ashbyhq.com/${co.slug}`,
  greenhouse: (co) => `https://job-boards.greenhouse.io/${co.slug}`,
  lever: (co) => `https://jobs.lever.co/${co.slug}`,
  smartrecruiters: (co) => `https://careers.smartrecruiters.com/${co.slug}`,
  teamtailor: (co) => `https://${co.domain ?? `${co.slug}.teamtailor.com`}/jobs`,
  workable: (co) => `https://apply.workable.com/${co.slug}/`,
  workday: (co) => `https://${co.slug}.${co.host ?? 'wd3'}.myworkdayjobs.com/${co.site}`,
  recruitee: (co) => `https://${co.slug}.recruitee.com/`,
  personio: (co) => `https://${co.slug}.jobs.personio.de/`,
};

async function hostedStatus(co) {
  const url = HOSTED[co.ats]?.(co);
  if (!url) return 'no hosted page known';
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA } });
    return `${r.status === 200 ? '✓' : '✗'} hosted page HTTP ${r.status} (${url})`;
  } catch (e) {
    return `✗ hosted page unreachable: ${e.message} (${url})`;
  }
}

function newest(jobs) {
  const dates = jobs.map((j) => Date.parse(j.publishedAt ?? '')).filter(Number.isFinite);
  if (!dates.length) return 'newest req: no usable date on this ATS';
  const d = new Date(Math.max(...dates));
  const days = Math.round((Date.now() - d) / 86400000);
  return `newest req: ${d.toISOString().slice(0, 10)} (${days} day(s) ago)${days > 30 ? '  ⚠ stale: is this board still the live one?' : ''}`;
}

async function report(co, res) {
  const label = `${co.ats}/${co.slug}${co.site ? `/${co.site}` : ''}`;
  if (res.error) return console.log(`  ✗ ${label}: ${res.error}`);
  if (!res.jobs.length) return console.log(`  · ${label}: answers, but 0 reqs (wrong slug or casing, or genuinely empty)`);
  const plausible = res.jobs.filter((j) => !titleVerdict(j.title) && geo.ok(j)).length;
  console.log(`  ✓ ${label}: ${res.jobs.length} req(s), ${plausible} plausible for the profile`);
  console.log(`      ${await hostedStatus(co)}`);
  console.log(`      ${newest(res.jobs)}`);
  const sample = SHOW ? res.jobs : res.jobs.slice(0, 5);
  for (const j of sample) console.log(`      ${j.title.slice(0, 70)}  ·  ${(j.location || '?').slice(0, 40)}`);
  if (!SHOW && res.jobs.length > 5) console.log(`      … ${res.jobs.length - 5} more (--jobs to see all)`);
  console.log('      ⚠ check these titles look like THIS company before adding the slug.');
}

/** Read the ATS and slug off a company's own careers page. */
async function fromCareersPage(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  const html = await r.text();
  const patterns = [
    ['ashby', /jobs\.ashbyhq\.com\/([^/"'?#\s]+)/g],
    ['greenhouse', /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/"'?#&\s]+)/g],
    ['lever', /jobs\.(?:eu\.)?lever\.co\/([^/"'?#\s]+)/g],
    ['workable', /apply\.workable\.com\/([^/"'?#\s]+)/g],
    ['teamtailor', /([a-z0-9-]+)\.teamtailor\.com/g],
    ['smartrecruiters', /(?:jobs|careers)\.smartrecruiters\.com\/([^/"'?#\s]+)/g],
    ['recruitee', /([a-z0-9-]+)\.recruitee\.com/g],
    ['personio', /([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/g],
    ['workday', /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/"'?#\s]+)/g],
  ];
  const hits = new Map();
  for (const [ats, re] of patterns) {
    for (const m of html.matchAll(re)) {
      const co = ats === 'workday' ? { ats, slug: m[1], host: m[2], site: m[3] } : { ats, slug: decodeURIComponent(m[1]) };
      hits.set(`${ats}:${co.slug}:${co.site ?? ''}`, co);
    }
  }
  console.log(`Careers page HTTP ${r.status}, ${hits.size} ATS link(s) found.`);
  if (!hits.size) console.log('  None. The page may render its board in JavaScript: open it in a browser and read the network tab.');
  for (const co of hits.values()) await report(co, await fetchBoard(co));
}

if (careersAt !== -1) {
  await fromCareersPage(args[careersAt + 1]);
} else if (!positional.length) {
  console.log('usage: node probe.mjs "Company Name" | <ats> <slug> [--jobs] | workday <tenant> <site> [host] | --careers <url>');
  process.exit(1);
} else if (positional[0] === 'workday') {
  // Workday needs the tenant AND the site, both read off the careers URL:
  //   https://<tenant>.<host>.myworkdayjobs.com/<site>
  const [, slug, site, host] = positional;
  if (!slug || !site) {
    console.log('usage: node probe.mjs workday <tenant> <site> [host, default wd3]');
    process.exit(1);
  }
  const co = { ats: 'workday', slug, site, host };
  await report(co, await fetchBoard(co));
} else if (positional.length >= 2 && ADAPTERS[positional[0]]) {
  const [ats, slug] = positional;
  await report({ ats, slug }, await fetchBoard({ ats, slug }));
} else {
  const name = positional.join(' ');
  console.log(`Probing "${name}" across ${DISCOVERABLE.length} ATS (Workday needs tenant + site, see usage)…\n`);
  let any = false;
  for (const ats of DISCOVERABLE) {
    for (const slug of slugsFor(ats, name)) {
      const co = { ats, slug };
      const res = await fetchBoard(co, { timeout: 12000 });
      if (!res.error && res.jobs.length) { await report(co, res); any = true; break; }
    }
  }
  if (!any) {
    console.log('No ATS answered on any slug variant. Before writing "no public board":');
    console.log('  node probe.mjs --careers <the company\'s own careers URL>');
  } else {
    console.log('\nNo output for an ATS means no variant answered there.');
  }
}
