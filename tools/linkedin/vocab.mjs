// LinkedIn search filter vocabulary: the raw values the Voyager API expects.
//
// These values are served by the API itself, from
// voyagerJobsDashSearchFilterClustersResource. `node linkedin.mjs filters -k <kw>`
// rediscovers them at any time, with live counts, so this file is a reading
// shortcut, not a frozen source of truth. If a value stops working, run
// `filters` and trust what it prints.
//
// ⚠️ Nothing about the CANDIDATE lives here. Stacks, titles, intermediaries,
// floors, geography and search axes are in profile/profile.mjs. This file only
// maps human words to API codes.

export const EXPERIENCE = {
  internship: '1',
  entry: '2',
  associate: '3',
  'mid-senior': '4',
  director: '5',
  executive: '6',
};

export const POSTED = {
  '24h': 'r86400',
  week: 'r604800',
  month: 'r2592000',
  any: '',
};

export const WORKPLACE = {
  onsite: '1',
  remote: '2',
  hybrid: '3',
};

export const JOB_TYPE = {
  fulltime: 'F',
  parttime: 'P',
  contract: 'C',
  temporary: 'T',
  volunteer: 'V',
  internship: 'I',
  other: 'O',
};

export const SORT = {
  recent: 'DD',
  relevant: 'R',
};

// Country geoIds, as EXAMPLES. A search normally uses the country NAME
// (`GEO.linkedinLocation` in the profile, sent as seoLocation), which needs no
// id at all. The id matters for `--geo` and for labelling the recommended
// feed, whose links carry numeric geoIds. Add yours: open a LinkedIn job
// search on the country and read `geoId=` in the URL.
export const GEO = {
  france: '105015875',
  'united states': '103644278',
  'united kingdom': '101165590',
  germany: '101282230',
  netherlands: '102890719',
  spain: '105646813',
  italy: '103350119',
  switzerland: '106693272',
  belgium: '100565514',
  ireland: '104738515',
  canada: '101174742',
  india: '102713980',
};

// City ids (populatedPlace) to tighten a country search, as EXAMPLES. They
// were read from the filter counters, so they only cover the cities that
// showed up that day. Find others with `filters -k <kw> -l <country>`.
export const CITIES = {
  paris: '101240143',
  lyon: '103815258',
  bordeaux: '104787182',
  nantes: '102565100',
  lille: '100323840',
  toulouse: '105073465',
};

/** geoId → short label, used to tag recommended axes. Labels, never filters. */
export const GEO_NAME = Object.fromEntries(
  Object.entries(GEO).map(([name, id]) => [id, name]),
);
