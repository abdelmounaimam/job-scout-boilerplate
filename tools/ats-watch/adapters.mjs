// ATS adapters, shared by watch.mjs (daily poller), discover.mjs (weekly
// discovery) and probe.mjs (one-off slug check).
//
// Each adapter normalises to:
//   { id, title, location, url, publishedAt, remote, pay, body? }
//
// No authentication anywhere: these endpoints are public JSON. No browser, no
// cookie, nothing that can be tied back to an account. That is the single
// reason this pipeline can run unattended in cron.
//
// Adding an ATS is a one-file change. Do it here, never in a caller.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

/** Slug → Teamtailor host. An explicit `domain` in the watchlist wins: several
 *  tenants serve their feed from a custom domain and <slug>.teamtailor.com 404s. */
const ttHost = (co) => (typeof co === 'object' && co.domain ? co.domain : `${co.slug ?? co}.teamtailor.com`);

/** Teamtailor schema.org address → readable string. The JSON feed has no
 *  location field at all; it lives in `_jobposting.jobLocation[].address`. */
function ttPlace(item) {
  const places = item._jobposting?.jobLocation ?? [];
  const parts = places.map((p) => {
    const a = p.address ?? {};
    return [a.addressLocality, a.addressCountry].filter(Boolean).join(', ');
  }).filter(Boolean);
  return [...new Set(parts)].join(' / ');
}

export const ADAPTERS = {
  ashby: {
    url: (co) => `https://api.ashbyhq.com/posting-api/job-board/${co.slug ?? co}?includeCompensation=true`,
    parse: (d) => (d.jobs ?? []).map((j) => ({
      id: j.id ?? j.jobUrl,
      title: j.title ?? '',
      location: [j.location, ...(j.secondaryLocations ?? []).map((x) => x.location ?? x)]
        .filter(Boolean).join(' / '),
      url: j.jobUrl,
      publishedAt: j.publishedAt ?? null,
      // ⚠️ Ashby's remote flag is wrong in BOTH directions. Postings marked
      // isRemote: true have turned out to require five days on site, and
      // postings labelled with one country have turned out to be worldwide.
      // Indicative only: the body is the only authority.
      remote: Boolean(j.isRemote),
      pay: j.compensation?.compensationTierSummary ?? null,
      // The public board API returns full descriptions for free. Worth a regex
      // for `\d+\+? years?` before spending the single application a company gets.
      body: j.descriptionPlain ?? null,
    })),
  },

  greenhouse: {
    url: (co) => `https://boards-api.greenhouse.io/v1/boards/${co.slug ?? co}/jobs`,
    parse: (d) => (d.jobs ?? []).map((j) => ({
      id: String(j.id),
      title: j.title ?? '',
      location: j.location?.name ?? '',
      url: j.absolute_url,
      publishedAt: j.updated_at ?? null,
      remote: /remote/i.test(j.location?.name ?? ''),
      pay: null,
    })),
  },

  lever: {
    url: (co) => `https://api.lever.co/v0/postings/${co.slug ?? co}?mode=json`,
    parse: (d) => (Array.isArray(d) ? d : []).map((j) => ({
      id: j.id,
      title: j.text ?? '',
      location: j.categories?.location ?? '',
      url: j.hostedUrl,
      // ⚠️ Lever's createdAt is NOT a publication date: evergreen reqs show
      // 2018 or 2020. Never judge freshness from it. When a company runs both
      // Lever and Ashby, Ashby's publishedAt is the one that means something.
      publishedAt: null,
      remote: /remote/i.test(j.categories?.location ?? ''),
      pay: null,
    })),
  },

  // ⚠️ The identifier is CASE SENSITIVE, and this is silent: `Acme` answers,
  // `acme` returns an empty list rather than an error. A lowercased slug looks
  // exactly like a company with no open roles.
  // ⚠️ Paginated, 100 per page. Large employers have thousands, hence the cap.
  smartrecruiters: {
    paged: true,
    url: (co, offset = 0) =>
      `https://api.smartrecruiters.com/v1/companies/${co.slug ?? co}/postings?limit=100&offset=${offset}`,
    more: (d, seen) => seen < Math.min(d.totalFound ?? 0, 300),
    parse: (d) => (d.content ?? []).map((j) => ({
      id: String(j.id),
      title: j.name ?? '',
      location: j.location?.fullLocation
        ?? [j.location?.city, j.location?.country].filter(Boolean).join(', '),
      url: `https://jobs.smartrecruiters.com/${j.company?.identifier}/${j.id}`,
      publishedAt: j.releasedDate ?? null,
      remote: Boolean(j.location?.remote),
      pay: null,
    })),
  },

  // A JSON Feed, so it carries `content_html`: the ONLY adapter that delivers
  // the posting body without a second request. Location comes from the
  // schema.org block, not from the feed itself.
  teamtailor: {
    url: (co) => `https://${ttHost(co)}/jobs.json`,
    parse: (d) => (d.items ?? []).map((j) => ({
      id: j.id,
      title: j.title ?? '',
      location: ttPlace(j),
      url: j.url,
      publishedAt: j.date_published ?? null,
      remote: /\b(remote|work from home|hybrid)\b/i.test(j.content_html ?? ''),
      pay: null,
      body: j.content_html ?? null,
    })),
  },

  // ⚠️⚠️ WORKABLE RATE-LIMITS HARD, AND THAT IS A MEASUREMENT TRAP, NOT A
  // COLLECTION ONE. In the source pipeline a mass probe concluded "416 slugs
  // scanned, zero live boards". The conclusion was FALSE: the probe ran ten
  // requests concurrently, Workable answered 429, and the script's
  // `if (!r.ok) continue` made throttling indistinguishable from an absent
  // board. Re-measured at three concurrent requests: 351 of 416 responses were
  // 429, and three real boards had been there the whole time.
  //
  // The general rule, well beyond Workable: A MASS PROBE THAT RETURNS ZERO MUST
  // BE RE-MEASURED SLOWLY BEFORE IT IS WRITTEN DOWN AS A FACT.
  //
  // Hence `slow: 900`: never two Workable calls less than 900 ms apart.
  workable: {
    slow: 900,
    url: (co) => `https://apply.workable.com/api/v1/widget/accounts/${co.slug ?? co}?details=true`,
    // ⚠️ Location is FLAT here (`city`, `state`, `country`), not under a
    // `location` object like every other ATS. Copying another adapter's shape
    // yields an empty location on every posting, which then reads as "unknown".
    parse: (d) => (d.jobs ?? []).map((j) => ({
      id: j.shortcode ?? j.id,
      title: j.title ?? '',
      location: [j.city, j.state, j.country].filter(Boolean).join(', ')
        || (typeof j.location === 'string' ? j.location : ''),
      url: j.url ?? j.shortlink ?? j.application_url,
      publishedAt: j.published_on ?? j.created_at ?? null,
      remote: Boolean(j.telecommuting),
      pay: null,
      body: j.description ?? null,
    })),
  },

  // Workday. THE ATS of large industrial employers, and the reason this adapter
  // exists: aerospace, automotive, defence and rail groups are almost all on it,
  // and none of them appear on the startup-oriented boards above.
  //
  // ⚠️ It needs TWO identifiers, not one: the tenant and the SITE name, and the
  // site name is not derivable from the company name. Read both off the careers
  // URL, which has the shape:
  //     https://<tenant>.<host>.myworkdayjobs.com/<site>
  // and the API sits at /wday/cxs/<tenant>/<site>/jobs. `probe.mjs` therefore
  // cannot guess a Workday board from a name alone: give it the pair.
  //
  // ⚠️ POST, not GET, and it needs a JSON body. A GET returns 405.
  // ⚠️ `limit` is capped at 20 server-side; asking for more silently returns 20.
  workday: {
    // Excluded from the weekly discovery: a slug alone is not enough, so
    // guessing would burn requests on combinations that cannot work.
    discover: false,
    paged: true,
    post: true,
    pageSize: 20,
    url: (co) => `https://${co.slug}.${co.host ?? 'wd3'}.myworkdayjobs.com/wday/cxs/${co.slug}/${co.site}/jobs`,
    body: (co, offset = 0) => JSON.stringify({
      appliedFacets: {},
      limit: 20,
      offset,
      searchText: co.searchText ?? '',
    }),
    // ⚠️⚠️ WORKDAY NE REND `total` QUE SUR LA PREMIÈRE PAGE. Les suivantes
    // renvoient `total: 0` tout en servant des résultats parfaitement valides.
    // Une condition écrite naïvement (`seen < d.total`) devient donc fausse dès
    // la deuxième page et la pagination s'arrête à 40 reqs sur 2 000, EN SILENCE :
    // un board plafonné ressemble trait pour trait à un petit board. C'est pour
    // ça que `more` reçoit le total mémorisé de la première page, et pas `d`.
    total: (d) => d.total ?? 0,
    more: (d, seen, knownTotal) => seen < Math.min(knownTotal, 400),
    parse: (d, co) => (d.jobPostings ?? []).map((j) => ({
      // ⚠️⚠️ `externalPath` and NOTHING ELSE as the id. A first version used
      // `bulletFields[0]`, which is NOT an identifier: on some tenants it is the
      // site name ("Head office - Mobilize"), shared by dozens of reqs. The
      // consequence is invisible to the eye: those postings all collapse onto one
      // key in `.seen.json`, so the poller treats as "already seen" a posting it
      // never showed. A non-unique id does not break the scan, it breaks the
      // scan's MEMORY, which is worse because it looks like it is working.
      id: j.externalPath,
      title: j.title ?? '',
      // ⚠️ Not every tenant serves `locationsText`. Some omit it entirely and
      // put the site in `bulletFields`. Without this fallback every posting from
      // those tenants reads "NO LOCATION", is kept by default, and cannot be
      // filtered geographically at all.
      location: j.locationsText
        ?? (j.bulletFields ?? []).find((b) => typeof b === 'string' && b.length < 60)
        ?? '',
      url: `https://${co.slug}.${co.host ?? 'wd3'}.myworkdayjobs.com/${co.site}${j.externalPath}`,
      // ⚠️ `postedOn` is a human phrase ("Posted 5 Days Ago"), not a date.
      publishedAt: j.postedOn ?? null,
      remote: /remote|télétravail/i.test(`${j.title} ${j.locationsText}`),
      pay: null,
    })),
  },

  recruitee: {
    url: (co) => `https://${co.slug ?? co}.recruitee.com/api/offers/`,
    parse: (d) => (d.offers ?? []).map((j) => ({
      id: String(j.id),
      title: j.title ?? '',
      location: [j.city, j.country].filter(Boolean).join(', ') || (j.location ?? ''),
      url: j.careers_url ?? j.url,
      publishedAt: j.published_at ?? null,
      remote: /remote/i.test(`${j.remote ?? ''} ${j.location ?? ''}`),
      pay: null,
      body: j.description ?? null,
    })),
  },

  personio: {
    url: (co) => `https://${co.slug ?? co}.jobs.personio.de/xml`,
    xml: true,
    parse: (xmlText) => {
      // Personio serves XML, not JSON. Small hand parse rather than a dependency:
      // the whole point of this toolchain is that it has none.
      const out = [];
      for (const [, block] of xmlText.matchAll(/<position>([\s\S]*?)<\/position>/g)) {
        const pick = (tag) => (block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`)) ?? [, ''])[1].trim();
        out.push({
          id: pick('id'),
          title: pick('name'),
          location: pick('office'),
          url: '', // needs the slug, so fetchBoard rewrites it below
          publishedAt: pick('createdAt') || null,
          remote: /remote/i.test(block),
          pay: null,
          body: pick('jobDescriptions') || null,
        });
      }
      return out;
    },
  },
};

/** ATS probed by the weekly discovery pass. */
export const DISCOVERABLE = Object.keys(ADAPTERS).filter((k) => ADAPTERS[k].discover !== false);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Per-ATS throttle. An adapter declaring `slow: N` never receives two calls
 * less than N milliseconds apart, whatever the caller's concurrency. This is
 * exactly what was missing when Workable returned 351 of 416 responses as 429
 * and the pipeline wrongly concluded it had no live boards at all.
 */
const nextCall = new Map();
async function waitTurn(ats) {
  const pause = ADAPTERS[ats]?.slow;
  if (!pause) return;
  const now = performance.now();
  const when = Math.max(now, nextCall.get(ats) ?? 0);
  nextCall.set(ats, when + pause);
  if (when > now) await sleep(when - now);
}

/** Fetch a whole board, pagination included. Returns { jobs } or { error }. */
export async function fetchBoard(co, { timeout = 20000 } = {}) {
  const a = ADAPTERS[co.ats];
  if (!a) throw new Error(`unknown ATS: ${co.ats}`);

  const get = async (url, body = null) => {
    // A 429 is retried. Treating it as "no board" is precisely the mistake that
    // cost the source pipeline three real companies for a week.
    for (let attempt = 0; ; attempt += 1) {
      await waitTurn(co.ats);
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), timeout);
      try {
        const init = body === null
          ? { signal: c.signal, headers: { 'user-agent': UA } }
          : {
            method: 'POST',
            signal: c.signal,
            body,
            headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json' },
          };
        const r = await fetch(url, init);
        if (r.status === 429 && attempt < 2) { await sleep(3000 * (attempt + 1)); continue; }
        if (!r.ok) return { error: `HTTP ${r.status}` };
        return { data: a.xml ? await r.text() : await r.json() };
      } catch (e) {
        return { error: e.name === 'AbortError' || e.name === 'TimeoutError' ? 'timeout' : e.message };
      } finally { clearTimeout(t); }
    }
  };

  if (!a.paged) {
    const r = await get(a.url(co));
    if (r.error) return { error: r.error };
    const jobs = a.parse(r.data, co);
    if (co.ats === 'personio') {
      for (const j of jobs) j.url = `https://${co.slug ?? co}.jobs.personio.de/job/${j.id}`;
    }
    return { jobs };
  }

  const jobs = [];
  const step = a.pageSize ?? 100;
  // Le total est mémorisé depuis la première page qui le porte : certains ATS ne
  // le rendent qu'une fois (voir le commentaire de l'adaptateur Workday). Il est
  // local à l'appel, donc deux boards sondés en parallèle ne se marchent pas dessus.
  let knownTotal = 0;
  for (let offset = 0; ; offset += step) {
    const r = await get(a.url(co, offset), a.post ? a.body(co, offset) : null);
    if (r.error) return offset === 0 ? { error: r.error } : { jobs };
    const page = a.parse(r.data, co);
    jobs.push(...page);
    knownTotal = Math.max(knownTotal, a.total?.(r.data) ?? 0);
    if (!page.length || !a.more(r.data, jobs.length, knownTotal)) break;
  }
  return { jobs };
}
