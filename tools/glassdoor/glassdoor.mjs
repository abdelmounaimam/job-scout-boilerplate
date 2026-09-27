#!/usr/bin/env node
// Derived Glassdoor client, READ ONLY.
//
// Same method as the LinkedIn client: capture the traffic from a normal
// session, then replay the pages directly. Zero dependencies, Node 20+ (native
// fetch). See README.md.
//
// Scope: read a company's employee reviews, interview reports and salary grids
// BEFORE an interview. NO write on Glassdoor: no review posted, no "helpful"
// vote, nothing. The account is there to read, full stop.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flightOf, refsOf, pick, pickScalar } from './flight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(HERE, '.session.json');
const LAUNCH_HINT = '! tools/browser/launch-chrome.sh   (from the repo root)';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/145.0.0.0 Safari/537.36';

// Human pace. Cloudflare sits in front of Glassdoor and the cf_clearance cookie
// is tied to the IP and to the browser's fingerprint: burning it costs a whole
// session, so a manual intervention. Never go under a second.
const DELAY_MS = 1800;
const JITTER_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(DELAY_MS + Math.floor(Math.random() * JITTER_MS));

// --- sites ---------------------------------------------------------------------
//
// ⚠️ The URL paths differ between Glassdoor's national sites, and this is NOT a
// mechanical translation: on .fr, /Reviews/ becomes /Avis/, /Interview/ becomes
// /Entretien/ with an entirely different slug, and /Salary/ becomes /salaire/ in
// LOWER case.
//
// ⚠️⚠️ And the company name in the URL is not decorative: on .fr,
// `xx-Avis-E<id>.htm` returns 404 where `<Name>-Avis-E<id>.htm` returns 200.
// The canonical slug is needed, not only the id, and `resolveEmployer` fetches it.
//
// Verification status: the `fr` paths were derived and verified end to end. The
// `com` / `co.uk` paths follow Glassdoor's public URL pattern for those sites;
// check them once with `find` then `reviews --pages 1` before trusting a brief.
// Another national site: add a row here, reading its paths off a real page.
const SITES = {
  fr: {
    base: 'https://www.glassdoor.fr',
    lang: 'fr-FR,fr;q=0.9,en;q=0.8',
    reviews: (slug, id, p) => `/Avis/${slug}-Avis-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    interviews: (slug, id, p) =>
      `/Entretien/${slug}-questions-entretien-d-embauche-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    salaries: (slug, id, p) => `/salaire/${slug}-Salaires-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    reviewsIndex: '/Avis/index.htm',
  },
  com: {
    base: 'https://www.glassdoor.com',
    lang: 'en-US,en;q=0.9',
    reviews: (slug, id, p) => `/Reviews/${slug}-Reviews-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    interviews: (slug, id, p) =>
      `/Interview/${slug}-Interview-Questions-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    salaries: (slug, id, p) => `/Salary/${slug}-Salaries-E${id}${p > 1 ? `_P${p}` : ''}.htm`,
    reviewsIndex: '/Reviews/index.htm',
  },
};
SITES['co.uk'] = { ...SITES.com, base: 'https://www.glassdoor.co.uk', lang: 'en-GB,en;q=0.9' };

let SITE = SITES.com;

// --- session -----------------------------------------------------------------

const ab = (cdp, args) =>
  execFileSync('agent-browser', ['--cdp', cdp, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

/**
 * Exports the Glassdoor cookies from the Chrome driven over CDP.
 *
 * ⚠️ Same trap as on LinkedIn: `cookies get` is CARRIED BY THE ACTIVE TAB, not
 * by the browser. From an ATS tab it returns nothing of Glassdoor. So we switch
 * to a glassdoor tab first, and open one if none exists.
 */
function captureSession({ cdp = '9222' } = {}) {
  const tabs = JSON.parse(ab(cdp, ['tab', '--json']))?.data?.tabs ?? [];
  const gdTab = tabs.find((t) => /^https:\/\/(www\.)?glassdoor\./.test(t.url ?? ''));
  if (gdTab) {
    if (!gdTab.active) ab(cdp, ['tab', gdTab.tabId]);
  } else {
    ab(cdp, ['tab', 'new', `${SITE.base}/`]);
    ab(cdp, ['wait', '--load', 'networkidle']);
  }

  const parsed = JSON.parse(ab(cdp, ['cookies', 'get', '--json']));
  const all = parsed?.data?.cookies ?? parsed?.cookies ?? [];
  const mine = all.filter((c) => (c.domain ?? '').includes('glassdoor'));
  const jar = Object.fromEntries(mine.map((c) => [c.name, c.value]));

  if (!jar.gdId) {
    throw new Error('Cookie gdId missing: no Glassdoor session is open in this Chrome.');
  }
  if (!jar.cf_clearance) {
    // Not blocking, but it is cause number one of 403s a few minutes later.
    process.stderr.write(
      '⚠️  No cf_clearance cookie: Cloudflare is likely to refuse the calls.\n' +
        '   Open a Glassdoor page in Chrome, let the check pass, then run auth again.\n',
    );
  }

  const session = {
    capturedAt: new Date().toISOString(),
    cookie: mine.map((c) => `${c.name}=${c.value}`).join('; '),
    hasClearance: Boolean(jar.cf_clearance),
    loggedIn: Boolean(jar.at || jar.gdsid),
  };
  // 0600: the cookie is a credential. The file is gitignored; never commit it.
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
  return session;
}

function loadSession() {
  if (!existsSync(SESSION_FILE)) {
    throw new Error(
      'No session. Run first: node glassdoor.mjs auth\n' +
        `(Chrome must be running with a Glassdoor session open:\n ${LAUNCH_HINT})`,
    );
  }
  return JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
}

// --- HTTP layer ----------------------------------------------------------------

let requestCount = 0;

// Do calls still go through directly, or must they go back through the browser?
// Decided at the first block and kept for the rest of the run: once Cloudflare
// has refused, it refuses everything, no point retrying on every page.
let directBlocked = false;

const isCloudflareWall = (status, html) =>
  status === 403 || /<title>Security \| Glassdoor<\/title>/.test(html);

/** Fast path: direct fetch with the cookies, no browser. */
async function fetchDirect(url, session) {
  const res = await fetch(url, {
    headers: {
      cookie: session.cookie,
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': SITE.lang,
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'upgrade-insecure-requests': '1',
    },
  });
  const html = await res.text();
  return { status: res.status, html };
}

/**
 * Fallback path: the already driven Chrome loads the page, then we read the
 * rendered HTML. Slower, but it is the one path Cloudflare does not refuse,
 * since it is a real Chrome.
 */
function fetchViaBrowser(url, cdp) {
  ab(cdp, ['open', url]);
  const raw = ab(cdp, ['eval', 'document.documentElement.outerHTML']);
  // `eval` returns the value as JSON on the last line.
  const line = raw.trim().split('\n').pop();
  try {
    return { status: 200, html: JSON.parse(line) };
  } catch {
    return { status: 200, html: line };
  }
}

/**
 * ⚠️⚠️ THE HARD POINT OF THIS CLIENT, to read before changing it.
 *
 * The starting plan was "cookies + fetch, never a browser again". It works, then
 * it stops: the direct mode served about fifteen pages before Cloudflare
 * answered 403 to EVERYTHING, including the page that worked twenty minutes
 * earlier, and including right after an `auth` that brought back a brand new
 * cf_clearance cookie.
 *
 * The cause is not the cookie, it is the TLS FINGERPRINT. Cloudflare
 * fingerprints the TLS handshake, Node's is not Chrome's, and cf_clearance is
 * tied to the fingerprint that obtained it. A cookie taken from Chrome and
 * replayed from Node is therefore valid for a while, then burnt.
 *
 * Assumed conclusion: we do NOT try to imitate Chrome's fingerprint. We try the
 * direct mode, free when it passes, and fall back to the real browser as soon as
 * it stops passing. The useful work of this client was never the transport, it
 * is decoding the flight, in flight.mjs.
 */
async function getPage(url, session, { cdp = '9222' } = {}) {
  if (requestCount > 0) await pause();
  requestCount += 1;

  let status;
  let html;

  if (!directBlocked) {
    ({ status, html } = await fetchDirect(url, session));
    if (isCloudflareWall(status, html)) {
      directBlocked = true;
      process.stderr.write(
        '⚠️  Cloudflare refuses direct calls, switching to the browser.\n' +
          `   (Chrome must be running: ${LAUNCH_HINT})\n`,
      );
    }
  }

  if (directBlocked) {
    try {
      ({ status, html } = fetchViaBrowser(url, cdp));
    } catch (err) {
      throw new Error(
        `Neither the direct mode nor the browser could load ${url}\n` +
          `Cloudflare blocks the direct mode, and agent-browser answered: ${err.message}\n` +
          `Start Chrome then retry: ${LAUNCH_HINT}`,
      );
    }
    if (isCloudflareWall(status, html)) {
      throw new Error(
        `Cloudflare blocks the browser too on ${url}\n` +
          'Open the page by hand in Chrome, pass the check, then run again.',
      );
    }
  }

  if (status !== 200) throw new Error(`HTTP ${status} on ${url}`);

  // ⚠️ Glassdoor serves its 404s as 200. Do NOT look for the "we looked
  // everywhere" sentence in the HTML: it also lies in the bundle of valid
  // pages, which gets perfectly good pages rejected. The only reliable marker
  // is the <title>, generic on a 404 and descriptive otherwise.
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  if (/^Glassdoor(\s*\|\s*Glassdoor)?$/.test(title)) {
    throw new Error(`Page does not exist (404 served as 200): ${url}`);
  }

  const flight = flightOf(html);
  return { html, flight, refs: refsOf(flight) };
}

const U = {
  reviews: (slug, id, p = 1) => SITE.base + SITE.reviews(slug, id, p),
  interviews: (slug, id, p = 1) => SITE.base + SITE.interviews(slug, id, p),
  salaries: (slug, id, p = 1) => SITE.base + SITE.salaries(slug, id, p),
};

// --- extraction -----------------------------------------------------------------

function parseReviews({ flight, refs }) {
  const ratings = pick(flight, 'ratings', refs);
  const reviews = (pick(flight, 'reviews', refs) ?? []).filter(
    (r) => r && typeof r === 'object' && 'reviewId' in r,
  );
  return {
    ratings: ratings ?? null,
    // ⚠️ `ratings.reviewCount` counts ALL languages and exceeds the number shown
    // on a national site (180 against 116 on one company). Both are true, they
    // do not count the same thing. We return both.
    reviewCountAllLocales: ratings?.reviewCount ?? null,
    reviews: reviews.map((r) => ({
      id: r.reviewId,
      date: (r.reviewDateTime ?? '').slice(0, 10),
      summary: r.summary,
      jobTitle: r.jobTitle?.text ?? null,
      location: r.location?.name ?? null,
      currentJob: r.isCurrentJob,
      yearsAtCompany: r.lengthOfEmployment,
      pros: r.pros,
      cons: r.cons,
      advice: r.advice,
      overall: r.ratingOverall,
      workLife: r.ratingWorkLifeBalance,
      culture: r.ratingCultureAndValues,
      career: r.ratingCareerOpportunities,
      comp: r.ratingCompensationAndBenefits,
      leadership: r.ratingSeniorLeadership,
      recommends: r.ratingRecommendToFriend,
      ceo: r.ratingCeo,
      outlook: r.ratingBusinessOutlook,
      helpful: r.countHelpful,
      employerReplied: (r.employerResponses ?? []).length > 0,
    })),
  };
}

function parseInterviews({ flight, refs }) {
  const raw = (pick(flight, 'interviews', refs) ?? []).filter(
    (i) => i && typeof i === 'object' && 'outcome' in i,
  );
  const expCounts = pick(flight, 'interviewExperienceCounts', refs) ?? [];
  const chanCounts = pick(flight, 'interviewObtainedChannelCounts', refs) ?? [];
  const sum = pickScalar(flight, 'difficultySum');
  const n = pickScalar(flight, 'difficultySubmissionCount');
  return {
    total: pickScalar(flight, 'filteredInterviewCount'),
    questionCount: pickScalar(flight, 'interviewQuestionCount'),
    difficulty: sum && n ? Number((sum / n).toFixed(2)) : null,
    experience: Object.fromEntries(expCounts.map((c) => [c.type, c.count])),
    channels: Object.fromEntries(chanCounts.map((c) => [c.type, c.count])),
    interviews: raw.map((i) => ({
      id: i.id,
      date: (i.reviewDateTime ?? '').slice(0, 10),
      interviewedOn: (i.interviewDateTime ?? '').slice(0, 10) || null,
      jobTitle: i.jobTitle?.text ?? null,
      location: i.location?.name ?? null,
      outcome: i.outcome,
      experience: i.experience,
      difficulty: i.difficulty,
      durationDays: i.durationDays,
      source: i.source,
      process: i.processDescription,
      questions: (i.userQuestions ?? []).map((q) => (q.question ?? '').trim()),
    })),
  };
}

/**
 * ⚠️ The page shows a range like "42k - 52k", which is the P25-P75 of TOTAL
 * pay. A shortcut that costs dearly in a negotiation: the payload actually
 * carries nine percentiles, for BASE pay and for TOTAL pay separately. On one
 * company: base median 47k, total median 49k, total P90 55.2k. Saying "55k is
 * above the band" is therefore false; "55k is at the P90 of total pay" is true.
 * We return everything.
 */
const pcts = (stats) => Object.fromEntries((stats?.percentiles ?? []).map((p) => [p.ident, p.value]));

function parseSalaries({ flight, refs }) {
  const results = (pick(flight, 'results', refs) ?? []).filter(
    (r) => r && typeof r === 'object' && (r.jobTitle || r.salaryCount != null),
  );
  return {
    rows: results.map((r) => {
      const base = pcts(r.basePayStatistics);
      const total = pcts(r.totalPayStatistics);
      return {
        jobTitle: r.jobTitle?.text ?? r.jobTitle ?? null,
        n: r.salaryCount ?? null,
        currency: r.currency?.code ?? null,
        mostRecent: (r.mostRecent ?? '').slice(0, 10) || null,
        base: { p10: base.P10, p25: base.P25, median: base.P50, p75: base.P75, p90: base.P90 },
        total: { p10: total.P10, p25: total.P25, median: total.P50, p75: total.P75, p90: total.P90 },
      };
    }),
  };
}

// --- resolving a company -------------------------------------------------------

/**
 * Asks Glassdoor for an employer's canonical slug, from its id alone.
 *
 * This is the brick that unlocks everything else. `/Overview/-EI_IE<id>.htm`
 * answers 307 towards the canonical URL, and that URL carries the name PLUS the
 * character offsets of the name inside the slug:
 *   /Overview/Working-at-Acme-EI_IE1234567.11,15.htm
 * where `11,15` cuts "Acme" out of "Working-at-Acme". Glassdoor documents
 * itself where to read its own name, one only has to follow it.
 */
async function slugOf(id, session, opts) {
  // ⚠️ This slug-less URL is the one Cloudflare flags fastest: it is a shape no
  // human types. It goes through getPage, so through the browser fallback,
  // otherwise id resolution breaks before anything else.
  const page = await getPage(`${SITE.base}/Overview/-EI_IE${id}.htm`, session, opts);

  const urls = [
    /<link rel="canonical" href="([^"]+)"/.exec(page.html)?.[1] ?? '',
    /property="og:url" content="([^"]+)"/.exec(page.html)?.[1] ?? '',
  ].map((u) => {
    try {
      return decodeURIComponent(u);
    } catch {
      return u;
    }
  });
  for (const url of urls) {
    const m = /\/([^/]+)-EI_IE\d+\.(\d+),(\d+)\.htm/.exec(url);
    if (m) return m[1].slice(Number(m[2]), Number(m[3]));
  }
  const short = /"shortName":"([^"]+)"/.exec(page.flight)?.[1] ?? /"shortName":"([^"]+)"/.exec(page.html)?.[1];
  if (short) return short.replace(/\s+/g, '-');

  throw new Error(
    `No slug found for employer ${id}.\n` +
      'Work around it by passing the full Glassdoor URL instead of the id: the slug is in it.',
  );
}

/**
 * Resolves an argument into `{ id, slug }`.
 * Accepts a bare id, a Glassdoor URL, or a company name.
 */
async function resolveEmployer(arg, session, opts) {
  // ⭐ Preferred path: a Glassdoor URL ALREADY carries the slug and the id. Zero
  // requests, zero dependence on a URL shape Cloudflare dislikes. It is also
  // the real usage: paste the company's link.
  const fromUrl =
    /glassdoor\.[a-z.]+\/[^/]+\/(.+?)-(?:Avis|Reviews|Salaires|Salaries|questions-entretien-d-embauche|Interview-Questions)-E(\d{4,})/.exec(
      arg,
    );
  if (fromUrl) return { id: Number(fromUrl[2]), slug: fromUrl[1] };

  if (/^\d+$/.test(arg)) return { id: Number(arg), slug: await slugOf(Number(arg), session, opts) };

  const bareId = /[-_]EI?_?I?E(\d{4,})[._]/.exec(arg)?.[1];
  if (bareId) return { id: Number(bareId), slug: await slugOf(Number(bareId), session, opts) };

  // Search by name.
  // ⚠️ Two plausible URLs do NOT work, and each one costs an hour:
  //   /Avis/company-reviews.htm?sc.keyword=X  → 404
  //   /Avis/index.htm?keyword=X               → 200 but ignores the keyword and
  //                                             lists the biggest employers
  // The right one is /Search/results.htm?keyword=X, and its links carry the
  // `-EI_IE<id>.<start>,<end>.htm` format that says itself where the name is.
  const url = `${SITE.base}/Search/results.htm?keyword=${encodeURIComponent(arg)}`;
  const page = await getPage(url, session, opts);
  // ⚠️ Do NOT decode the whole HTML: `decodeURIComponent` throws "URI malformed"
  // as soon as a stray `%` sits in the page, and there always is one. Match on
  // the raw text, decode only the captured slug.
  const m = /\/([^/"']+)-EI_IE(\d{4,})\.(\d+),(\d+)\.htm/.exec(page.html);
  if (m) {
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* slug already readable */
    }
    return { id: Number(m[2]), slug: slug.slice(Number(m[3]), Number(m[4])) };
  }

  throw new Error(
    `No company found for « ${arg} ».\n` +
      "The most reliable is to paste the company's Glassdoor URL: the slug and the id are in it.\n" +
      '⚠️ And a company of fewer than ~50 people often has NO Glassdoor page at all.\n' +
      '   That is information in itself, not a failure: no public counterweight before signing.',
  );
}

// --- text rendering --------------------------------------------------------------

const pc = (x) => (x == null ? '?' : `${Math.round(x * 100)} %`);
const stars = (x) => (x == null ? '?' : `${x}/5`);

function showReviews(data, { limit }) {
  const r = data.ratings ?? {};
  console.log(`\nOverall ${stars(r.overallRating)}  ·  ${r.reviewCount ?? '?'} reviews (all languages)`);
  console.log(
    `Recommend ${pc(r.recommendToFriendRating)}  ·  Approve of CEO ${pc(r.ceoRating)}` +
      `${r.ratedCeo?.name ? ` (${r.ratedCeo.name})` : ''}  ·  Outlook ${pc(r.businessOutlookRating)}`,
  );
  console.log(
    `Work-life ${stars(r.workLifeBalanceRating)} · Culture ${stars(r.cultureAndValuesRating)} · ` +
      `Career ${stars(r.careerOpportunitiesRating)} · Pay ${stars(r.compensationAndBenefitsRating)} · ` +
      `Leadership ${stars(r.seniorManagementRating)}`,
  );
  for (const v of data.reviews.slice(0, limit)) {
    console.log(`\n── ${v.date}  ${stars(v.overall)}  ${v.summary ?? ''}`);
    const who = [
      v.jobTitle ?? 'role not given',
      v.currentJob ? 'current' : 'former',
      v.yearsAtCompany ? `${v.yearsAtCompany} yr` : null,
      v.location,
    ].filter(Boolean);
    console.log(`   ${who.join(' · ')}${v.employerReplied ? '  [employer replied]' : ''}`);
    if (v.pros) console.log(`   + ${v.pros.replace(/\n+/g, ' ')}`);
    if (v.cons) console.log(`   − ${v.cons.replace(/\n+/g, ' ')}`);
  }
}

function showInterviews(data, { limit }) {
  const e = data.experience ?? {};
  const tot = (e.POSITIVE ?? 0) + (e.NEGATIVE ?? 0) + (e.NEUTRAL ?? 0);
  console.log(
    `\n${data.total ?? '?'} interview reports · difficulty ${data.difficulty ?? '?'}/5 · ` +
      `${data.questionCount ?? '?'} questions recorded`,
  );
  if (tot) {
    console.log(
      `Experience: ${Math.round(((e.POSITIVE ?? 0) / tot) * 100)} % positive, ` +
        `${Math.round(((e.NEGATIVE ?? 0) / tot) * 100)} % negative`,
    );
  }
  const ch = Object.entries(data.channels ?? {});
  if (ch.length) console.log(`How they got in: ${ch.map(([k, v]) => `${k} ${v}`).join(' · ')}`);

  for (const i of data.interviews.slice(0, limit)) {
    console.log(`\n── ${i.date}  ${i.jobTitle ?? 'role not given'}${i.location ? ` · ${i.location}` : ''}`);
    console.log(
      '   ' +
        [i.outcome, i.experience, `difficulty ${i.difficulty}`, i.durationDays ? `${i.durationDays} d` : null, i.source]
          .filter(Boolean)
          .join(' · '),
    );
    if (i.process) console.log(`   ${i.process.replace(/\s+/g, ' ').slice(0, 700)}`);
    for (const q of i.questions) console.log(`   ❓ ${q.replace(/\s+/g, ' ').slice(0, 400)}`);
  }
}

const k = (v) => (v == null ? '?' : `${Math.round(v / 1000)}k`);
const kp = (v) => k(v).padStart(4);

function showSalaries(data, { limit }) {
  console.log('\n   n   base P25    median    P75      P90     role');
  for (const s of data.rows.slice(0, limit)) {
    console.log(
      `${String(s.n ?? '?').padStart(4)}    ${kp(s.base.p25)}      ${kp(s.base.median)}     ` +
        `${kp(s.base.p75)}    ${kp(s.base.p90)}     ${s.jobTitle ?? '?'}${s.currency ? ` (${s.currency})` : ''}`,
    );
  }
  console.log('\nBASE pay. Add --json for total pay and every percentile.');
}

// --- CLI ---------------------------------------------------------------------------

const HELP = `
Derived Glassdoor client, read only

  node glassdoor.mjs auth [--cdp 9222]     export the cookies from Chrome
  node glassdoor.mjs whoami                check the session answers
  node glassdoor.mjs find "<name>"         resolve a company name into an id

  node glassdoor.mjs reviews    <id|url|name> [--pages N] [--limit N] [--json]
  node glassdoor.mjs interviews <id|url|name> [--pages N] [--limit N] [--json]
  node glassdoor.mjs salaries   <id|url|name> [--pages N] [--limit N] [--json]
  node glassdoor.mjs brief      <id|url|name> [--pages N] [--out file.md]

Options
  --site com|co.uk|fr   national site (default: $GLASSDOOR_SITE, else com)
  --cdp 9222            CDP port of the Chrome to fall back on

Chrome must be running with a Glassdoor session open before \`auth\`:
  ${LAUNCH_HINT}
`;

function parseArgs(argv) {
  const out = { _: [], pages: 1, limit: 10, json: false, cdp: '9222', out: null, site: process.env.GLASSDOOR_SITE || 'com' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--pages') out.pages = Number(argv[++i]);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--cdp') out.cdp = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--site') out.site = argv[++i];
    else out._.push(a);
  }
  return out;
}

/** Aggregates N pages of one kind of content. */
async function collect(kind, { id, slug }, session, pages, opts) {
  const parse = { reviews: parseReviews, interviews: parseInterviews, salaries: parseSalaries }[kind];
  const listKey = { reviews: 'reviews', interviews: 'interviews', salaries: 'rows' }[kind];
  let merged = null;
  for (let p = 1; p <= pages; p += 1) {
    const page = await getPage(U[kind](slug, id, p), session, opts);
    const data = parse(page);
    if (!merged) merged = data;
    else merged[listKey] = merged[listKey].concat(data[listKey]);
    if (!data[listKey].length) break;
  }
  return merged;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    return;
  }

  if (!SITES[args.site]) {
    throw new Error(`Unknown site « ${args.site} ». Known: ${Object.keys(SITES).join(', ')} (add one in SITES).`);
  }
  SITE = SITES[args.site];

  if (cmd === 'auth') {
    const s = captureSession({ cdp: args.cdp });
    console.log(
      '✓ Session written to .session.json' +
        `\n  logged in   : ${s.loggedIn ? 'yes' : 'no (public reading only)'}` +
        `\n  cf_clearance: ${s.hasClearance ? 'yes' : 'NO'}`,
    );
    return;
  }

  const session = loadSession();

  if (cmd === 'whoami') {
    // Hit a real content page: that is what the client does next, so that is
    // what must be validated, not a separate account endpoint.
    const page = await getPage(SITE.base + SITE.reviewsIndex, session, { cdp: args.cdp });
    const name =
      /"userName":"([^"]+)"/.exec(page.flight)?.[1] ?? /"fullName":"([^"]+)"/.exec(page.flight)?.[1] ?? null;
    console.log(
      `✓ Cloudflare passed, page served (${Math.round(page.html.length / 1024)} KB) on ${SITE.base}` +
        (name ? `\n✓ Logged in as ${name}` : '\n⚠️  No name found: the session may be anonymous, public reading still works'),
    );
    return;
  }

  const target = args._[0];
  if (!target) throw new Error(`The « ${cmd} » command expects an id, a URL or a company name.`);

  const emp = await resolveEmployer(target, session, { cdp: args.cdp });
  const { id, slug } = emp;

  if (cmd === 'find') {
    console.log(`${id}  ${slug}`);
    return;
  }

  if (cmd === 'reviews' || cmd === 'interviews' || cmd === 'salaries') {
    const data = await collect(cmd, emp, session, args.pages, { cdp: args.cdp });
    if (args.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    ({ reviews: showReviews, interviews: showInterviews, salaries: showSalaries })[cmd](data, args);
    return;
  }

  if (cmd === 'brief') {
    const rev = await collect('reviews', emp, session, args.pages, { cdp: args.cdp });
    const itw = await collect('interviews', emp, session, args.pages, { cdp: args.cdp });
    const sal = await collect('salaries', emp, session, 1, { cdp: args.cdp });
    const md = renderBrief({ id, name: slug, rev, itw, sal });
    if (args.out) {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, md);
      console.log(`✓ Written to ${args.out}`);
    } else {
      console.log(md);
    }
    return;
  }

  throw new Error(`Unknown command: ${cmd}${HELP}`);
}

/** The pre-interview brief: what one wants to read the day before, in that order. */
function renderBrief({ id, name, rev, itw, sal }) {
  const r = rev.ratings ?? {};
  const e = itw.experience ?? {};
  const tot = (e.POSITIVE ?? 0) + (e.NEGATIVE ?? 0) + (e.NEUTRAL ?? 0);
  const L = [];
  L.push(`# Glassdoor: ${name ?? `employer ${id}`}`);
  L.push('');
  L.push(`> Read on ${new Date().toISOString().slice(0, 10)} by \`tools/glassdoor\` (${SITE.base}).`);
  L.push('> ⚠️ Glassdoor is self-selected and leans negative. What counts is what **repeats**');
  L.push('> across several years and several roles, never a single review.');
  L.push('> ⛔ Never mention Glassdoor in the interview: this serves to ask better questions.');
  L.push('');
  L.push('## Salaries');
  L.push('');
  L.push('Base pay, except the last column. The P25 to P75 range is the one the page shows;');
  L.push('the percentiles around it are in the payload but not on screen.');
  L.push('');
  L.push('| Role | n | P25 to P75 | Median | P90 | Total median |');
  L.push('|---|---|---|---|---|---|');
  for (const s of sal.rows.slice(0, 12)) {
    const cur = s.currency ? ` ${s.currency}` : '';
    L.push(
      `| ${s.jobTitle ?? '?'} | ${s.n ?? '?'} | ${k(s.base.p25)} to ${k(s.base.p75)}${cur} | ` +
        `**${k(s.base.median)}**${cur} | ${k(s.base.p90)}${cur} | ${k(s.total.median)}${cur} |`,
    );
  }
  L.push('');
  L.push('## Interviews');
  L.push('');
  L.push(`- **${itw.total ?? '?'} reports**, difficulty ${itw.difficulty ?? '?'} out of 5`);
  if (tot) {
    L.push(
      `- Experience: **${Math.round(((e.POSITIVE ?? 0) / tot) * 100)} % positive, ${Math.round(((e.NEGATIVE ?? 0) / tot) * 100)} % negative**`,
    );
  }
  L.push('');
  L.push('### The questions actually asked');
  L.push('');
  for (const i of itw.interviews) {
    for (const q of i.questions) {
      if (q) L.push(`- **${i.jobTitle ?? '?'}, ${i.date}**: « ${q.replace(/\s+/g, ' ')} »`);
    }
  }
  L.push('');
  L.push('### The processes described');
  L.push('');
  for (const i of itw.interviews.filter((x) => x.process)) {
    L.push(`**${i.jobTitle ?? '?'}, ${i.date}, ${i.location ?? '?'} · ${i.outcome} · ${i.experience}**`);
    L.push('');
    L.push(i.process.replace(/\s+/g, ' '));
    L.push('');
  }
  L.push('## Employee reviews');
  L.push('');
  L.push(`- Overall **${stars(r.overallRating)}**, ${r.reviewCount ?? '?'} reviews all languages`);
  L.push(
    `- Recommend **${pc(r.recommendToFriendRating)}** · Approve of CEO **${pc(r.ceoRating)}**${r.ratedCeo?.name ? ` (${r.ratedCeo.name})` : ''}`,
  );
  L.push(
    `- Work-life ${stars(r.workLifeBalanceRating)} · Culture ${stars(r.cultureAndValuesRating)} · Career ${stars(r.careerOpportunitiesRating)} · **Pay ${stars(r.compensationAndBenefitsRating)}** · Leadership ${stars(r.seniorManagementRating)}`,
  );
  L.push('');
  for (const v of rev.reviews) {
    L.push(`### ${v.date} · ${stars(v.overall)} · ${v.summary ?? ''}`);
    const who = [
      v.jobTitle ?? 'role not given',
      v.currentJob ? 'current' : 'former',
      v.yearsAtCompany ? `${v.yearsAtCompany} yr` : null,
      v.location,
    ].filter(Boolean);
    L.push('');
    L.push(`*${who.join(' · ')}*`);
    L.push('');
    if (v.pros) L.push(`**Pros**: ${v.pros.replace(/\n+/g, ' ')}`);
    if (v.cons) L.push(`**Cons**: ${v.cons.replace(/\n+/g, ' ')}`);
    L.push('');
  }
  return L.join('\n');
}

main().catch((err) => {
  process.stderr.write(`\n✗ ${err.message}\n`);
  process.exit(1);
});
