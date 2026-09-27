// Location reasoning, shared by the ATS poller, the discovery pass, the probe
// and the LinkedIn triage. Built from the GEO block of profile/profile.mjs.
//
// The whole problem in one sentence: a location field that says "Remote" does
// not mean "employable where the candidate lives", and a location field can be
// wrong by an entire ocean. In the source pipeline a posting listed as a tiny
// French village was in fact on-site in Los Angeles: the geocoder had latched
// onto a real commune whose name is a common word.
//
// So the rule encoded here is deliberately asymmetric:
//   home named            → keep
//   any foreign place named → drop, EVEN IF the posting also says "remote"
//   inclusive region named  → keep
//   bare "remote"           → keep, flagged as unverified
//
// A first naive version accepted bare "remote" everywhere and brought back
// San Francisco, Foster City and "Remote: United States". Hence the explicit
// city list: "San Francisco / Remote / Toronto" contains no country name at
// all, and the ATS marks it isRemote: true.

/** Countries, regions and large cities, used to detect a NAMED foreign place.
 *  The candidate's own entries are subtracted at build time, so this list can
 *  stay global and be reused for any profile. */
export const WORLD_MARKERS = [
  // countries and regions
  'us', 'usa', 'u.s', 'united states', 'america', 'canada', 'latam', 'brazil',
  'mexico', 'argentina', 'chile', 'colombia', 'apac', 'anz', 'australia',
  'new zealand', 'japan', 'korea', 'india', 'singapore', 'malaysia', 'indonesia',
  'philippines', 'vietnam', 'thailand', 'china', 'taiwan', 'hong kong',
  'israel', 'uae', 'saudi', 'qatar', 'turkey', 'egypt', 'nigeria', 'kenya',
  'south africa', 'morocco', 'tunisia',
  'uk', 'united kingdom', 'england', 'scotland', 'ireland', 'france', 'germany',
  'deutschland', 'spain', 'portugal', 'italy', 'netherlands', 'belgium',
  'luxembourg', 'switzerland', 'austria', 'poland', 'czech', 'czechia',
  'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'croatia', 'slovenia',
  'serbia', 'ukraine', 'estonia', 'latvia', 'lithuania', 'nordics', 'sweden',
  'denmark', 'norway', 'finland', 'iceland',
  // cities
  'san francisco', 'bay area', 'new york', 'nyc', 'redwood', 'foster city',
  'palo alto', 'mountain view', 'sunnyvale', 'seattle', 'austin', 'boston',
  'chicago', 'denver', 'atlanta', 'miami', 'los angeles', 'san diego',
  'toronto', 'montreal', 'vancouver', 'ottawa',
  'london', 'manchester', 'edinburgh', 'dublin', 'paris', 'lyon', 'marseille',
  'toulouse', 'bordeaux', 'lille', 'nantes', 'berlin', 'munich', 'münchen',
  'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf',
  'amsterdam', 'rotterdam', 'utrecht', 'brussels', 'antwerp', 'madrid',
  'barcelona', 'valencia', 'lisbon', 'lisboa', 'porto', 'milan', 'rome',
  'turin', 'zurich', 'geneva', 'basel', 'vienna', 'prague', 'warsaw', 'krakow',
  'budapest', 'bucharest', 'sofia', 'athens', 'stockholm', 'copenhagen', 'oslo',
  'helsinki', 'tallinn', 'riga', 'vilnius',
  'dubai', 'tel aviv', 'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'delhi',
  'pune', 'chennai', 'tokyo', 'osaka', 'seoul', 'shanghai', 'beijing',
  'sydney', 'melbourne', 'auckland', 'sao paulo', 'mexico city', 'buenos aires',
  'cairo', 'lagos', 'nairobi', 'cape town', 'johannesburg',
  // US states and provinces, which appear alone in ATS location fields
  'california', 'texas', 'washington', 'oregon', 'colorado', 'massachusetts',
  'illinois', 'georgia', 'florida', 'virginia', 'new jersey', 'pennsylvania',
  'ontario', 'quebec', 'british columbia',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyOf = (words) => new RegExp(`\\b(${words.map(escape).join('|')})\\b`, 'i');

/**
 * Build the location predicates for one profile.
 * @param {{home: string[], inclusiveRegions: string[]}} geo — the GEO block of profile.mjs
 */
export function makeGeo(geo) {
  const home = geo.home.map((s) => s.toLowerCase());
  const HOME = anyOf(home);
  // Everything in the world that is not the candidate's own turf. Subtracting
  // is what makes this file profile-independent.
  const FOREIGN = anyOf(WORLD_MARKERS.filter((m) => !home.includes(m)));
  const INCLUSIVE = anyOf(geo.inclusiveRegions);

  /** Full verdict, for the poller: keep or not, and why. */
  function verdict(job) {
    const loc = (job.location || '').toLowerCase();
    if (HOME.test(loc)) return { keep: true, tag: 'HOME' };
    // A named foreign place wins over any remote flag: "Remote (US)" is a US job.
    if (FOREIGN.test(loc)) return { keep: false, tag: `abroad (${loc.slice(0, 40)})` };
    if (INCLUSIVE.test(loc)) return { keep: true, tag: 'REGION (verify: employable from home?)' };
    if (job.remote || /\bremote|anywhere|worldwide\b/i.test(loc)) {
      return { keep: true, tag: 'REMOTE (unverified: employable from home?)' };
    }
    if (!loc) return { keep: true, tag: 'NO LOCATION (read the body)' };
    return { keep: false, tag: `abroad (${loc.slice(0, 40)})` };
  }

  return { isHome: (l) => HOME.test(l ?? ''), verdict, ok: (job) => verdict(job).keep };
}
