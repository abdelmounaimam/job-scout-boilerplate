export const meta = {
  name: 'job-scout-web',
  description: 'Multi-agent open-web search for qualified postings, verified one by one, then synthesised into a digest',
  whenToUse: "When the automatic watch is not enough: the poller only sees boards it already knows, and the weekly discovery only probes names already written down. This starts from the open web, along complementary angles, to find postings and companies on no list. Useful cadence: once a week, or on a targeted need (\"find me backend TypeScript roles in Berlin\").",
  phases: [
    { title: 'Context', detail: 'read applications.csv, watchlist and RULED_OUT: what is already seen or already closed' },
    { title: 'Search', detail: 'parallel web-search angles, each blind to the others' },
    { title: 'Verify', detail: 'open every retained posting and extract facts, not an opinion' },
    { title: 'Digest', detail: 'CSV plus analysis, and the names to pour into candidates.json' },
  ],
};

// ---------------------------------------------------------------------------
// Input
//   undefined                    → the profile as written
//   "backend TypeScript Berlin"  → a free instruction steering all angles
//   { brief, date, angles }      → full control
// ---------------------------------------------------------------------------
const input = typeof args === 'string' ? { brief: args } : (args ?? {});
const BRIEF = input.brief ?? 'the profile as written, no particular steer';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CONTEXT = {
  type: 'object',
  required: ['date', 'brief', 'applied', 'ruledOut', 'watched'],
  properties: {
    date: { type: 'string', description: 'today, YYYY-MM-DD, from `date +%F`' },
    brief: {
      type: 'string',
      description: 'profile/profile.mjs rewritten as a self-contained brief: role, level, stack, '
        + 'hard exclusions, geography, work authorisation, salary floor, preferred tiers. '
        + 'Facts from the file only.',
    },
    angles: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, instruction: { type: 'string' } } },
      description: 'six search angles built from the SOURCING block of profile.mjs: aggregators, '
        + 'the candidate\'s preferred tiers, remote-first boards, VC portfolios, recent funding, '
        + 'companies with no public board' },
    applied: { type: 'array', items: { type: 'string' }, description: '`company` column of applications/applications.csv' },
    ruledOut: { type: 'array', items: { type: 'string' }, description: 'RULED_OUT keys, plus companies closed for structural reasons in recent analyses' },
    watched: { type: 'array', items: { type: 'string' }, description: 'names in watchlist.json: already covered by the daily poller' },
    notes: { type: 'string', description: 'what a searcher should know before leaving: recent traps, roles that closed this week' },
  },
};

const LEADS = {
  type: 'object',
  required: ['leads', 'coverage'],
  properties: {
    coverage: { type: 'string', description: 'what was actually searched, and what failed or was blocked' },
    companiesFound: {
      type: 'array', items: { type: 'string' },
      description: 'credible companies crossed on the way, EVEN with no opening: they feed candidates.json',
    },
    leads: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'title', 'url', 'location'],
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string', description: 'the posting page you opened' },
          location: { type: 'string' },
          ats: { type: 'string' },
          postedAt: { type: 'string' },
          salaryShown: { type: 'string' },
          whyPlausible: { type: 'string', description: 'one sentence, quoting what you read' },
        },
      },
    },
  },
};

const VERDICTS = {
  type: 'object',
  required: ['postings'],
  properties: {
    postings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'title', 'url', 'live', 'verdict', 'why'],
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          live: { type: 'boolean', description: 'the page answers and the role is open, checked just now' },
          language: { type: 'string', description: 'the language the posting is written in' },
          realLocation: { type: 'string', description: 'the location read IN THE BODY, which beats the location field' },
          realRemote: { type: 'string', description: 'what the BODY says about remote, not the badge' },
          yearsRequired: { type: 'string', description: 'the number required, or "no floor stated"' },
          juniorOpening: { type: 'string', description: 'the junior-friendly wording VERBATIM, or empty' },
          salaryShown: { type: 'string' },
          stack: { type: 'string' },
          stackGaps: { type: 'string', description: 'technologies required that the candidate does not have' },
          managementScope: { type: 'string' },
          verdict: { type: 'string', enum: ['apply', 'read', 'drop'] },
          why: { type: 'string', description: 'MUST quote the line of the body the verdict rests on' },
        },
      },
    },
  },
};

const METHOD = `
METHOD, to respect:
- Use WebSearch and WebFetch. Go to the postings themselves, not to articles about them.
- A posting counts only if you opened ITS page. A title seen in a list does not count.
- ⚠️ Several large job sites sit behind bot protection and return 403 to any fetch, while search
  engines happily serve their DEAD urls as if live. Always revalidate against the underlying ATS
  or the company's own site.
- ⚠️ A req id containing PIPELINING-ONLY is a talent pool, not a funded role. Drop it.
- ⚠️ A location field can be wrong by an ocean: one posting listed in a tiny European village was
  on-site in Los Angeles. Any improbable location is verified IN THE BODY.
- INVENT NOTHING. No url rebuilt from memory, no assumed salary. If you did not see it, say so.
- Return FACTS, not an enthusiastic opinion.
`.trim();

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

phase('Context');
const ctx = await agent(`
You are preparing a job-posting search. The repository root is the current working directory.

1. Read \`profile/profile.mjs\` IN FULL and write the \`brief\`: a self-contained profile a searcher
   can act on alone. Facts from the file only, nothing softened, nothing invented.
2. Build six search \`angles\` from the \`SOURCING\` block of that file. One angle per approach,
   each written as a direct instruction to a searcher:
   a) the aggregators and job boards of this market, postings from the last 14 days;
   b) the candidate's preferred company tiers, going to THEIR careers pages, not aggregators;
   c) the remote-first boards, filtered aggressively: most "remote" there is region-locked and
      only the BODY says whether this candidate's country is employable;
   d) VC portfolio job boards: the cheapest way to find funded companies on no aggregator;
   e) companies that raised a seed, series A or series B in the last four months, via the funding
      news sources: a raise is followed by a hiring wave, before the roles reach any aggregator;
   f) companies with NO queryable public board, invisible to the daily poller: own site, custom
      Teamtailor domain, Avature, SuccessFactors, Taleo, or a plain email address.
3. Today's date, with \`date +%F\`.
4. The state of the pipeline, so searchers do not report what is already known:
   - companies already applied to: \`company\` column of \`applications/applications.csv\`
     (the one-application-per-company rule makes them pointless to search);
   - companies already closed: \`RULED_OUT\` in \`profile/profile.mjs\`, plus any company dropped
     for a structural reason in the two most recent \`digests/*-analysis.md\`;
   - companies already watched: \`name\` field of \`tools/ats-watch/watchlist.json\`. Still
     interesting, but the daily poller covers them, so flag them as such.
5. In \`notes\`: recent traps worth knowing, read in the latest \`digests/*-analysis.md\`.

Read the files, do not guess. Write nothing.
`, { schema: CONTEXT, label: 'context:pipeline', phase: 'Context' });

const seen = new Set([
  ...(ctx?.applied ?? []),
  ...(ctx?.ruledOut ?? []),
].map((s) => s.toLowerCase().trim()));
const watched = new Set((ctx?.watched ?? []).map((s) => s.toLowerCase().trim()));
const DATE = input.date ?? ctx?.date ?? 'unknown-date';
const ANGLES = input.angles ?? ctx?.angles ?? [];

log(`Context: ${seen.size} companies applied to or ruled out, ${watched.size} already watched, ${ANGLES.length} angles.`);

phase('Search');
// Deliberate barrier: deduplication needs every angle at once, otherwise the
// same posting found by three angles gets verified three times.
const harvest = (await parallel(ANGLES.map((a, i) => () => agent(`
You are searching for job postings. Your angle, and only yours:

${a.instruction}

CANDIDATE BRIEF:
${ctx?.brief ?? ''}

THIS SESSION'S INSTRUCTION: ${BRIEF}

${METHOD}

${ctx?.notes ? `RECENT TRAPS:\n${ctx.notes}\n` : ''}
Already applied to or already ruled out, do NOT report:
${[...seen].join(', ') || '(none)'}

Already watched by the daily poller (report only if the posting is genuinely strong):
${[...watched].slice(0, 80).join(', ') || '(none)'}

Return at most 12 leads, most recent first. Four leads you opened beat twelve you guessed.
Fill \`companiesFound\` generously: a credible company with no opening today still has value,
it goes into the weekly discovery pool.
`, { schema: LEADS, label: `search:${a.key ?? i + 1}`, phase: 'Search' })))).filter(Boolean);

const allLeads = harvest.flatMap((r) => r.leads ?? []);
const norm = (l) => `${(l.company ?? '').toLowerCase().trim()}|${(l.title ?? '').toLowerCase().trim()}`;
const keys = new Set();
const unique = [];
let dupes = 0;
let alreadyKnown = 0;
for (const l of allLeads) {
  if (seen.has((l.company ?? '').toLowerCase().trim())) { alreadyKnown += 1; continue; }
  const k = norm(l);
  if (keys.has(k)) { dupes += 1; continue; }
  keys.add(k);
  unique.push(l);
}

// One application per company: verifying five reqs from the same employer is waste.
const PER_COMPANY = 2;
const count = new Map();
const toVerify = [];
let capped = 0;
for (const l of unique) {
  const c = (l.company ?? '?').toLowerCase().trim();
  const n = count.get(c) ?? 0;
  if (n < PER_COMPANY) { toVerify.push(l); count.set(c, n + 1); } else { capped += 1; }
}

log(`Harvest: ${allLeads.length} raw leads → ${toVerify.length} to verify `
  + `(${dupes} duplicates, ${alreadyKnown} already known, ${capped} capped at ${PER_COMPANY} per company).`);

phase('Verify');
const BATCH = 5;
const batches = [];
for (let i = 0; i < toVerify.length; i += BATCH) batches.push(toVerify.slice(i, i + BATCH));

const verified = (await parallel(batches.map((batch, i) => () => agent(`
You verify job postings, one by one. For EACH of the ${batch.length} postings below:

1. Open the link. If the page does not answer, or the role is closed, set \`live: false\` and stop.
   ⚠️ Postings close in under 24 hours. This is the number one reason to drop one, not a detail.
2. READ THE WHOLE BODY, especially the MINIMUM qualifications.
   ⚠️ One posting in the source pipeline named 21 technologies, half of them absent from the
   candidate's CV, none of it visible from the title.
3. Extract the facts the schema asks for. Location and remote are read IN THE BODY, never from
   the badge or the structured field, which are wrong in both directions.
4. Give a verdict: \`apply\`, \`read\` or \`drop\`.
   \`why\` MUST quote the line of the body the verdict rests on. No vague summary.

CANDIDATE BRIEF:
${ctx?.brief ?? ''}

POSTINGS IN THIS BATCH:
${batch.map((l, k) => `${k + 1}. ${l.company} — ${l.title}\n   ${l.url}\n   stated location: ${l.location ?? '?'} · ats: ${l.ats ?? '?'} · stated salary: ${l.salaryShown ?? '?'}`).join('\n')}

Write no files. Return all ${batch.length} postings, including the ones you drop:
nothing disappears silently.
`, { schema: VERDICTS, label: `verify:batch-${i + 1}`, phase: 'Verify' })))).filter(Boolean);

const postings = verified.flatMap((v) => v.postings ?? []);
const kept = postings.filter((p) => p.live && p.verdict !== 'drop');
log(`Verify: ${postings.length} postings opened, ${kept.length} kept (apply or read).`);

phase('Digest');
const companiesFound = [...new Set(harvest.flatMap((r) => r.companiesFound ?? []))];

const report = await agent(`
You are writing the synthesis of a job-posting search. Repo root is the current working directory.

WRITE TWO FILES:

1. \`digests/${DATE}-web.csv\`, exactly these columns in this order:
   scan_date,verdict,why,title,company,location_remote,years_required,junior_opening,management_scope,salary_shown,stack,stack_gaps,level,posted_at,url
   One row per KEPT posting, \`apply\` verdicts first. Escape commas.

2. \`digests/${DATE}-web-analysis.md\`, prose, no dashes used as punctuation:
   - what each angle covered, and what failed.
   - the count of drop reasons. NOTHING disappears silently.
   - structural conclusions: companies to close permanently and why, traps hit, which angles
     produced and which did not. This is the part that still has value in six months, not the table.
   - the company names to pour into \`tools/ats-watch/candidates.json\`, listing FIRST the ones
     that are not already there (read the file to know).

VERIFIED DATA (${postings.length} postings opened):
${JSON.stringify(postings, null, 1)}

COVERAGE DECLARED PER ANGLE:
${harvest.map((r, i) => `- ${ANGLES[i]?.key ?? i + 1}: ${r.coverage}`).join('\n')}

COMPANY NAMES FOUND ALONG THE WAY (${companiesFound.length}):
${companiesFound.join(', ') || '(none)'}

HARVEST STATS: ${allLeads.length} raw leads, ${dupes} cross-angle duplicates,
${alreadyKnown} dropped as already applied or ruled out, ${capped} capped at ${PER_COMPANY} per company.

Modify NO other file. In particular touch neither candidates.json nor applications.csv:
you propose, the decision is made in session.
Return a summary of at most 10 lines: the postings to apply to first, one reason each.
`, { label: 'digest:synthesis', phase: 'Digest' });

return {
  date: DATE,
  digest: `digests/${DATE}-web.csv`,
  analysis: `digests/${DATE}-web-analysis.md`,
  rawLeads: allLeads.length,
  verified: postings.length,
  toApply: kept.filter((p) => p.verdict === 'apply').length,
  toRead: kept.filter((p) => p.verdict === 'read').length,
  companiesFound,
  summary: report,
};
