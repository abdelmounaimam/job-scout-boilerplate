export const meta = {
  name: 'job-scout-bootstrap',
  description: 'Build the ATS watchlist from zero: parallel agents search the open web for companies that fit this candidate, then every slug is verified against the live API before it is written',
  whenToUse: "Run ONCE when setting the pipeline up for a candidate, and again every 2 to 3 months for a wide re-sweep. It is the only step that finds companies nobody wrote down: the daily poller only sees boards already on the watchlist, and the weekly discovery only probes names already in the pool. Its real output is not a list of jobs, it is a verified watchlist plus a pool of names that keeps the weekly discovery productive for months.",
  phases: [
    { title: 'Profile', detail: 'read profile.mjs and turn it into a brief every searcher can carry' },
    { title: 'Sourcing', detail: 'one agent per market segment, each blind to the others' },
    { title: 'Resolve', detail: 'find each company real ATS and VERIFY the slug against the live API' },
    { title: 'Seed', detail: 'write watchlist.json, candidates.json and the bootstrap report' },
  ],
};

// ---------------------------------------------------------------------------
// Input
//   undefined                     → segments come from profile.mjs
//   "AI companies in Berlin"      → a free instruction that steers every angle
//   { brief, segments: [...] }    → full control
// ---------------------------------------------------------------------------
const input = typeof args === 'string' ? { brief: args } : (args ?? {});
const BRIEF = input.brief ?? 'no particular steer, use the profile as written';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PROFILE = {
  type: 'object',
  required: ['date', 'brief', 'segments'],
  properties: {
    date: { type: 'string', description: 'today, YYYY-MM-DD, from `date +%F`' },
    brief: {
      type: 'string',
      description: 'The candidate profile rewritten as a self-contained brief a searcher can act on: '
        + 'role and level, stack, hard exclusions, geography and work authorisation, salary floor, '
        + 'preferred company tiers. Every fact taken from profile.mjs, nothing invented.',
    },
    segments: { type: 'array', items: { type: 'string' }, description: 'market segments to fan out over' },
    alreadyWatched: { type: 'array', items: { type: 'string' }, description: 'company names already in watchlist.json' },
    alreadyPooled: { type: 'array', items: { type: 'string' }, description: 'names already in candidates.json' },
    ruledOut: { type: 'array', items: { type: 'string' }, description: 'keys of RULED_OUT in profile.mjs' },
  },
};

const SOURCED = {
  type: 'object',
  required: ['companies', 'coverage'],
  properties: {
    coverage: { type: 'string', description: 'what was actually searched, and what failed or was blocked' },
    companies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'why'],
        properties: {
          name: { type: 'string', description: 'the legal or common company name, spelled as they spell it' },
          careersUrl: { type: 'string', description: 'the careers page you actually opened' },
          atsGuess: { type: 'string', description: 'ashby, greenhouse, lever, smartrecruiters, teamtailor, workable, recruitee, personio, own site, unknown' },
          hiringNow: { type: 'boolean', description: 'true only if you saw open engineering roles yourself' },
          why: { type: 'string', description: 'one sentence on why this company fits THIS candidate' },
        },
      },
    },
  },
};

const RESOLVED = {
  type: 'object',
  required: ['verified', 'unresolved'],
  properties: {
    verified: {
      type: 'array',
      description: 'ONLY entries whose API call returned real reqs that look like this company',
      items: {
        type: 'object',
        required: ['name', 'ats', 'slug', 'reqCount', 'sampleTitles'],
        properties: {
          name: { type: 'string' },
          ats: { type: 'string' },
          slug: { type: 'string' },
          domain: { type: 'string', description: 'only for Teamtailor tenants on a custom domain' },
          reqCount: { type: 'integer' },
          plausibleForCandidate: { type: 'integer', description: 'how many of those reqs plausibly fit' },
          sampleTitles: { type: 'array', items: { type: 'string' }, description: 'proof the slug is the right company' },
        },
      },
    },
    unresolved: {
      type: 'array',
      description: 'companies with no queryable public board, or whose slug could not be confirmed',
      items: {
        type: 'object',
        required: ['name', 'reason'],
        properties: {
          name: { type: 'string' },
          careersUrl: { type: 'string' },
          reason: { type: 'string', description: 'own site / Avature / SuccessFactors / Taleo / no slug answered / probable name collision' },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Shared rules. Repeated in every prompt: sub-agents share no context, and an
// angle that forgets the salary floor returns noise.
// ---------------------------------------------------------------------------

const METHOD = `
METHOD, non negotiable:
- Use WebSearch and WebFetch. Go to the companies themselves, not to articles about them.
- A company counts only if you OPENED its careers page. A name seen in a listicle does not count.
- ⚠️ Aggregators serve CLOSED postings as if they were live, and search snippets lie about
  location and seniority. Always come back down to the company's own board.
- ⚠️ A req id containing PIPELINING-ONLY is a talent pool, not a funded role.
- ⚠️ A location field can be wrong by an ocean. Anything improbable is verified in the body.
- INVENT NOTHING. No URL rebuilt from memory, no assumed salary. If you did not see it, say so.
- Return FACTS, not enthusiasm. Your final message is read as data, not as a message to a person.
`.trim();

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

phase('Profile');
const prof = await agent(`
You are preparing a job-search sweep. The repository root is the current working directory.

1. Read \`profile/profile.mjs\` IN FULL and turn it into a self-contained brief (field \`brief\`).
   A searcher who reads only your brief must be able to judge a posting correctly: role, level,
   stack, hard exclusions, geography, work authorisation, salary floor, preferred company tiers.
   Take every fact from the file. Invent nothing, soften nothing.
2. Return the segments to fan out over: \`SOURCING.segments\` from the file, adjusted if this
   session's instruction calls for it. This session's instruction: ${BRIEF}
3. Return today's date with \`date +%F\`.
4. Return the names already in \`tools/ats-watch/watchlist.json\`, those already in
   \`tools/ats-watch/candidates.json\`, and the keys of \`RULED_OUT\`. Searchers must not
   spend their budget re-finding them.

Read the files. Do not guess, and write nothing.
`, { schema: PROFILE, label: 'profile:brief', phase: 'Profile' });

const DATE = prof?.date ?? 'unknown-date';
const known = new Set([
  ...(prof?.alreadyWatched ?? []),
  ...(prof?.alreadyPooled ?? []),
  ...(prof?.ruledOut ?? []),
].map((s) => s.toLowerCase().trim()));
const SEGMENTS = input.segments ?? prof?.segments ?? ['software companies hiring engineers'];

log(`Profile read. ${SEGMENTS.length} segments, ${known.size} names already known.`);

phase('Sourcing');
// Deliberate barrier: deduplication needs every angle at once, otherwise the
// same company found by three angles gets resolved three times.
const sourced = (await parallel(SEGMENTS.map((seg, i) => () => agent(`
You are sourcing EMPLOYERS, not job postings. Your segment, and only yours:

${seg}

CANDIDATE BRIEF:
${prof?.brief ?? '(profile unavailable, ask for nothing and return an empty list)'}

THIS SESSION'S INSTRUCTION: ${BRIEF}

${METHOD}

What makes a good entry: a company that plausibly hires at this candidate's level, on this
stack, in a place this candidate can actually work. A company with no opening TODAY is still
worth returning if it hires this profile at all: it goes into the discovery pool and gets
probed every week from then on.

Do NOT return: agencies, staffing firms, consultancies, body shops, or outsourcing companies.
The business model is the reason, not the size.

Already known, do not return these: ${[...known].slice(0, 120).join(', ') || '(none)'}

For each company, find its REAL careers page and say which board technology it uses. That
single fact is what makes the rest of the pipeline possible: a company on a queryable ATS gets
polled automatically forever, a company on a bespoke site has to be checked by hand.

Return 15 to 30 companies. Quality over volume: 15 you opened beats 30 you guessed.
`, { schema: SOURCED, label: `source:${i + 1}`, phase: 'Sourcing' })))).filter(Boolean);

const all = sourced.flatMap((s) => s.companies ?? []);
const seen = new Set();
const unique = [];
let dupes = 0;
let skipped = 0;
for (const c of all) {
  const k = (c.name ?? '').toLowerCase().trim();
  if (!k) continue;
  if (known.has(k)) { skipped += 1; continue; }
  if (seen.has(k)) { dupes += 1; continue; }
  seen.add(k);
  unique.push(c);
}

log(`Sourcing: ${all.length} raw entries → ${unique.length} unique (${dupes} duplicates, ${skipped} already known).`);

phase('Resolve');
// Batches rather than one agent per company: one agent per company would be
// more parallel and would burn the agent budget on process startup.
const BATCH = 12;
const batches = [];
for (let i = 0; i < unique.length; i += BATCH) batches.push(unique.slice(i, i + BATCH));

const resolved = (await parallel(batches.map((batch, i) => () => agent(`
You turn company names into VERIFIED ATS entries. ${batch.length} companies in your batch.

For EACH company, find which ATS it uses and confirm the exact slug by calling the live API.
The repository has a tool for exactly this, run it with Bash from the repo root:

    node tools/ats-watch/probe.mjs "Company Name"        # tries every ATS and slug variant
    node tools/ats-watch/probe.mjs ashby acme --jobs     # checks one exact pair

If the tool finds nothing, try the company's careers page yourself and read the URL it
redirects to: \`jobs.ashbyhq.com/<slug>\`, \`job-boards.greenhouse.io/<slug>\`,
\`jobs.lever.co/<slug>\`, \`<slug>.teamtailor.com\`, \`jobs.smartrecruiters.com/<Slug>\`,
\`apply.workable.com/<slug>\`, \`<slug>.recruitee.com\`, \`<slug>.jobs.personio.de\`.
Then confirm that slug with the probe tool. A slug read off a URL is a hypothesis; a slug that
returned reqs is a fact.

⚠️ TRAPS THAT COST REAL TIME:
- A slug that answers is NOT proof it is the right company. Two well-known cases: one Ashby
  slug that reads like a famous database company is a games payments platform, one Greenhouse
  slug that reads like a famous ORM is an unrelated fintech. ALWAYS read the returned job
  titles and confirm they match the company. Put anything suspicious in \`unresolved\` with
  reason "probable name collision".
- SmartRecruiters identifiers are CASE SENSITIVE and a wrongly-cased one returns an EMPTY LIST
  rather than an error, which looks exactly like a company with no openings.
- Teamtailor tenants can serve from a custom domain, in which case \`<slug>.teamtailor.com\`
  404s. Report the domain in the \`domain\` field.
- Workable rate-limits hard and answers 429. A run of zeros from Workable is a measurement
  artefact until it has been re-checked one slug at a time, slowly.
- Some companies have TWO boards duplicating the same reqs. Keep one.

COMPANIES:
${batch.map((c, k) => `${k + 1}. ${c.name} — careers: ${c.careersUrl ?? '?'} — guess: ${c.atsGuess ?? '?'}`).join('\n')}

CANDIDATE BRIEF (for the \`plausibleForCandidate\` count only):
${prof?.brief ?? ''}

Return every company: verified ones in \`verified\`, the rest in \`unresolved\` WITH the reason.
Nothing disappears silently. Write no files.
`, { schema: RESOLVED, label: `resolve:batch-${i + 1}`, phase: 'Resolve' })))).filter(Boolean);

const verified = resolved.flatMap((r) => r.verified ?? []);
const unresolved = resolved.flatMap((r) => r.unresolved ?? []);
// A verified board with zero plausible reqs today is still worth watching: the
// point of the poller is to catch the req that opens next month.
const withOpenings = verified.filter((v) => (v.plausibleForCandidate ?? 0) > 0);

log(`Resolve: ${verified.length} verified boards (${withOpenings.length} with a plausible req today), ${unresolved.length} unresolved.`);

phase('Seed');
const report = await agent(`
You are writing the result of a job-search bootstrap into the repository. Repo root is the
current working directory. Today is ${DATE}.

WRITE THREE THINGS:

1. \`tools/ats-watch/watchlist.json\` — MERGE, do not overwrite. Read the file first, keep
   \`_comment\`, \`_known_collisions\`, \`_no_public_api\` and every existing entry, then append
   one object per verified board:
   \`{ "name": "...", "ats": "...", "slug": "...", "applied": false, "note": "bootstrap ${DATE}" }\`
   plus \`"domain"\` when the batch reported one. Never add a slug that is not in the verified
   list below. Record any suspected collision under \`_known_collisions\` instead.
   Add the unresolved companies that have a real careers page under \`_no_public_api\`, keyed by
   name, with the URL and the board technology: they are the manual-check list.

2. \`tools/ats-watch/candidates.json\` — MERGE into \`names\`, deduplicated, keeping the existing
   entries. Add EVERY company sourced, verified or not, that is not already there. This is the
   pool the weekly discovery re-probes, so a company with no board today belongs in it.

3. \`digests/${DATE}-bootstrap.md\` — the report, in prose, no dashes used as punctuation:
   - what each segment covered and what failed
   - the verified boards, grouped by ATS, with req counts
   - the companies with no public API and how to check them by hand, with a suggested cadence
   - suspected name collisions
   - structural conclusions: which segments produced, which produced nothing and why.
     This part is what still has value in six months. The table is not.

VERIFIED BOARDS (${verified.length}):
${JSON.stringify(verified, null, 1)}

UNRESOLVED (${unresolved.length}):
${JSON.stringify(unresolved, null, 1)}

COVERAGE PER SEGMENT:
${sourced.map((s, i) => `- ${SEGMENTS[i] ?? '?'}: ${s.coverage}`).join('\n')}

SOURCING STATS: ${all.length} raw, ${dupes} cross-angle duplicates, ${skipped} already known.

Touch no other file. In particular do not touch applications.csv or profile.mjs.
Return a summary of at most 10 lines: how many boards are now watched, which companies deserve
a look this week, and what has to be checked by hand.
`, { label: 'seed:watchlist', phase: 'Seed' });

return {
  date: DATE,
  sourced: all.length,
  verifiedBoards: verified.length,
  boardsWithOpenings: withOpenings.length,
  unresolved: unresolved.length,
  report: `digests/${DATE}-bootstrap.md`,
  next: 'run `node tools/ats-watch/watch.mjs --reset` once to baseline the new boards, '
    + 'then `node tools/ats-watch/watch.mjs` daily',
  summary: report,
};
