// Shared text helpers: matching, company-name comparison, and the two parsers
// the triage leans on (salary band, years required). Zero dependencies.
//
// Everything that compares a name read OUTSIDE (LinkedIn, an ATS, a mailbox)
// with a name typed INSIDE (the tracker, RULED_OUT) goes through here. The
// outside never spells a name the way you typed it, so both sides normalise.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Word-boundary match that treats + # . as word characters, so 'java' does
 * not fire on 'javascript', 'c' does not fire on 'c++', and '.net' works.
 */
export const hasWord = (text, word) =>
  new RegExp(`(^|[^a-z0-9+#.])${escapeRe(word.trim())}([^a-z0-9+#]|$)`, 'i').test(text ?? '');

/**
 * Flattens a company name for COMPARISON: lowercase, accents stripped, and
 * typographic apostrophes brought back to the straight one.
 * ⚠️ A company closed in RULED_OUT with a straight apostrophe came back at the
 * top of the next digest because LinkedIn renders its name with U+2019.
 */
export const flattenCompany = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'");

/** Normalised company name, split into WORDS, legal forms and noise removed. */
export const normCompany = (s) =>
  flattenCompany(s)
    .replace(/[.,'`"()\-/&]/g, ' ')
    .replace(/\b(sas|sasu|sarl|sa|gmbh|ag|bv|nv|inc|ltd|llc|plc|group|groupe|holding|technologies|technology|labs)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Do two names designate the same company?
 *
 * ⚠️⚠️ NEITHER strict equality NOR substring: both have bitten.
 * - SUBSTRING makes false positives: "nova" is inside "casanova", "ark" inside
 *   "parkside". A cross-check announced 5 fixes, 2 of them imaginary.
 * - STRICT EQUALITY makes false negatives: the tracker says "Maison Exemple",
 *   LinkedIn says "Maison Exemple Paris", so a company already in the tracker
 *   came back as new.
 * The rule that holds both: one name must be a leading run of WORDS of the
 * other. "maison exemple" ⊂ "maison exemple paris" ✔ · "nova" vs "casanova" ✘.
 */
export function sameCompany(a, b) {
  const x = normCompany(a);
  const y = normCompany(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w, i) => w === long[i]);
}

// --- salary ------------------------------------------------------------------

const CUR = '(?:€|eur|euros?|\\$|usd|£|gbp|chf|sek|nok|dkk|pln)';

/**
 * Salary band announced in the text, as { lo, hi } yearly amounts, or null.
 * Handles "45 000 - 55 000 €", "45-55 k€", "45k€ to 55k€", "$120,000 - $150,000",
 * "£60k-£70k". Amounts under 1000 are read as thousands.
 *
 * ⚠️ No currency conversion: the band is compared to the floor as written. The
 * dropped reason prints the band so a foreign currency is visible.
 * ⚠️ Hourly or monthly figures are ignored on purpose (range guard below):
 * re-aggregators republish US jobs paid by the hour.
 */
export function parseSalary(text) {
  if (!text) return null;
  const norm = text.replace(/[\u00a0\u202f]/g, ' ');
  const found = [];
  const num = '(\\d{2,3}(?:[\\s.,]?\\d{3})?)';
  const sep = '\\s*(?:[-–—/]|à|a|to|bis)\\s*';
  const patterns = [
    // 45-55k€, 45k-55k €, £60k-£70k, $120k to $150k
    new RegExp(`${CUR}?\\s*(\\d{2,3})\\s*k?\\s*${CUR}?${sep}${CUR}?\\s*(\\d{2,3})\\s*k\\s*${CUR}?`, 'gi'),
    // 45 000 - 55 000 €, €45,000 - €55,000, $120,000 – $150,000
    new RegExp(`${CUR}?\\s*${num}\\s*${CUR}?${sep}${CUR}?\\s*${num}\\s*${CUR}`, 'gi'),
    new RegExp(`${CUR}\\s*${num}${sep}${CUR}?\\s*${num}`, 'gi'),
  ];
  const scale = (raw) => {
    const n = Number(String(raw).replace(/[\s.,]/g, ''));
    return n < 1000 ? n * 1000 : n;
  };
  for (const re of patterns) {
    for (const m of norm.matchAll(re)) {
      const lo = scale(m[1]);
      const hi = scale(m[2]);
      if (lo >= 15000 && hi <= 900000 && hi >= lo) found.push({ lo, hi });
    }
  }
  if (!found.length) {
    // A single figure: "Package: 41k maximum", "up to 60k€".
    for (const m of norm.matchAll(new RegExp(`${CUR}?\\s*(\\d{2,3})\\s*k\\s*${CUR}?`, 'gi'))) {
      const v = Number(m[1]) * 1000;
      if (v >= 20000 && v <= 900000) found.push({ lo: v, hi: v });
    }
  }
  if (!found.length) return null;
  return { lo: Math.min(...found.map((f) => f.lo)), hi: Math.max(...found.map((f) => f.hi)) };
}

// --- years of experience -------------------------------------------------------

const EXP = '(?:expérience|experience|exp\\b|ancienneté|berufserfahrung|erfahrung)';
const UNIT = '(?:ans|années|annees|years|year|yrs|jahre|jahren)';
const YEAR_PATTERNS = () => [
  new RegExp(`(\\d{1,2})\\s*(?:à|a|-|–|to|bis)\\s*\\d{1,2}\\s*${UNIT}[^.]{0,50}?${EXP}`, 'g'),
  new RegExp(`${EXP}[^.]{0,50}?(\\d{1,2})\\s*(?:à|a|-|–|to|bis)\\s*\\d{1,2}\\s*${UNIT}`, 'g'),
  new RegExp(`(\\d{1,2})\\s*\\+?\\s*${UNIT}[^.]{0,50}?${EXP}`, 'g'),
  new RegExp(`(?:${EXP}|minimum of|at least|au moins|minimum|mindestens)[^.]{0,50}?(\\d{1,2})\\s*\\+?\\s*${UNIT}`, 'g'),
];

/** Every years figure tied to an experience word, sorted ascending, deduplicated. */
export function parseYearsSpread(text) {
  if (!text) return [];
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const found = new Set();
  for (const re of YEAR_PATTERNS()) {
    for (const m of t.matchAll(re)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 15) found.add(n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Years of experience REQUIRED, read in the body: the MINIMUM figure, or null.
 *
 * The context is mandatory: a number must sit next to an experience word, or
 * "launch in 2028" and "for 12 years" fire. On a range "3 to 5 years" the low
 * bound gates the application. Across several mentions the smallest wins:
 * better let through a demanding posting, which gets read, than drop a good one.
 * ⚠️ The minimum can be MASKED by marketing ("in 2 years you will have 5 years
 * of experience" next to "5-10 years"): triage flags the spread when the max
 * would have dropped it. Audited on 11 dropped postings: zero false positive.
 */
export function parseYears(text) {
  const all = parseYearsSpread(text);
  return all.length ? all[0] : null;
}

// --- CSV -------------------------------------------------------------------------

/** One CSV line, honouring quotes and doubled quotes. Strips a trailing \r. */
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.replace(/\r$/, ''));
}

/** Whole CSV text → array of rows. A quoted field may contain a newline. */
export function parseCsv(text) {
  const rows = [];
  let buf = '';
  for (const line of text.split('\n')) {
    buf = buf ? `${buf}\n${line}` : line;
    if (((buf.match(/"/g) ?? []).length) % 2 === 0) {
      if (buf.trim()) rows.push(parseCsvLine(buf));
      buf = '';
    }
  }
  if (buf.trim()) rows.push(parseCsvLine(buf));
  return rows;
}

/** CSV rows → objects keyed by the header. */
export function readCsvObjects(file) {
  if (!existsSync(file)) return [];
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (!header) return [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export const csvCell = (v) => {
  const s = v == null ? '' : String(v).replace(/\r?\n+/g, ' ').trim();
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows, columns) =>
  [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n');

// --- the tracker ----------------------------------------------------------------

export const APPLICATIONS_CSV = join(REPO_ROOT, 'applications', 'applications.csv');

/**
 * Companies and LinkedIn job ids already in the tracker. Read BY COLUMN NAME:
 * ⚠️ a hardcoded cell index once compared company names with job titles, so
 * the dedup never matched and an already-applied company topped the digest.
 */
export function loadHistory(file = APPLICATIONS_CSV) {
  const rows = readCsvObjects(file);
  const companies = rows.map((r) => r.company).filter(Boolean);
  const jobIds = new Set(
    rows.map((r) => /jobs\/view\/(\d+)/.exec(r.link ?? '')?.[1]).filter(Boolean),
  );
  return {
    rows,
    companies,
    jobIds,
    matchesCompany: (name) => companies.some((c) => sameCompany(c, name)),
  };
}

/** RULED_OUT lookup with the same normalisation as the tracker. */
export function ruledOutReason(ruledOut, companyName) {
  const company = flattenCompany(companyName);
  const key = Object.keys(ruledOut).find((k) => {
    const f = flattenCompany(k).trim();
    return company === f || sameCompany(k, companyName);
  });
  return key ? ruledOut[key] : null;
}
