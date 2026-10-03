#!/usr/bin/env node
// Deterministic checks of the free-text outputs (layer 1 of evals/README.md).
//
//   node evals/check.mjs                      checks every record of evals/records.jsonl
//   node evals/check.mjs <id>                 one record only
//   node evals/check.mjs --write              also rewrites the `checks` field of each record
//   node evals/check.mjs --file <path.jsonl>  another records file (fixtures, tests)
//
// Exits 1 when a checked record fails, so it can guard a draft BEFORE it is
// shown to the candidate (and tools/build-letter.sh runs it before building).
//
// Nothing candidate-specific is hardcoded here. The inputs come from:
//   profile/profile.mjs   WRITING (dash rule, notice words and wordings, the
//                         blocklist protecting the current salary) and
//                         CANDIDATE.noticePeriod
//   profile/stories.md    the ids a record may cite, [ST-…] and [FACT-…]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DEFAULT_RECORDS = join(HERE, 'records.jsonl');
const STORIES = join(ROOT, 'profile', 'stories.md');

const P = await import(pathToFileURL(join(ROOT, 'profile', 'profile.mjs')).href);
const W = P.WRITING ?? {};

export const CHANNELS = ['ats_field', 'letter', 'mail', 'recruiter_reply', 'linkedin'];
export const STATUSES = ['draft', 'sent', 'dropped'];

/** Ids cited in square brackets in profile/stories.md. */
export function loadIds(path = STORIES) {
  if (!existsSync(path)) return new Set();
  return new Set([...readFileSync(path, 'utf8').matchAll(/\[((?:ST|FACT)-[A-Z0-9-]+)\]/g)].map((m) => m[1]));
}

// --- language ------------------------------------------------------------------
// A crude stop-word vote, enough to catch an English answer pasted into a
// French form. Only the languages listed here are checked; a record in another
// language skips this check rather than failing it.
const STOPWORDS = {
  en: /\b(i|you|your|we|is|the|and|for|with|in|my|which|that|not|have)\b/gi,
  fr: /\b(je|vous|votre|nous|est|les|des|une|pour|avec|dans|mon|mes|qui|que|pas)\b/gi,
  de: /\b(ich|sie|ihr|wir|ist|der|die|das|und|für|mit|nicht|ein|eine|mein)\b/gi,
  es: /\b(yo|usted|su|nosotros|es|el|los|las|una|para|con|en|mi|que|no)\b/gi,
};
export function detectLang(text) {
  let best = null, bestN = -1;
  for (const [lang, re] of Object.entries(STOPWORDS)) {
    const n = (text.match(re) ?? []).length;
    if (n > bestN) { best = lang; bestN = n; }
  }
  return best;
}

// --- notice period -------------------------------------------------------------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOTICE_WORDS = (W.noticeWords ?? []).map((w) => new RegExp(`(^|[^\\p{L}])${esc(w)}([^\\p{L}]|$)`, 'iu'));
const NOTICE_OK = [...new Set([P.CANDIDATE?.noticePeriod, ...(W.noticePhrasings ?? [])].filter(Boolean).map((s) => s.toLowerCase()))];
const FORBIDDEN = (W.forbiddenPatterns ?? []).map((p) => new RegExp(p, 'i'));
// The candidate's phone in any spacing ("+49 000 000 000", "+49000000000"),
// and any phone number in international format, are contact data.
const phoneDigits = String(P.CANDIDATE?.phone ?? '').replace(/\D/g, '');
const PHONE = new RegExp(
  [phoneDigits.length >= 6 ? phoneDigits.split('').join('[\\s().-]*') : null, '\\+\\d[\\d\\s().-]{7,}\\d']
    .filter(Boolean).join('|'),
  'g',
);

const numbers = (t) => [...String(t ?? '').matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.'));

/** Checks one record. Returns { ok, failures }. */
export function check(r, ids = loadIds()) {
  const failures = [];
  if (!r || typeof r !== 'object') return { ok: false, failures: ['not an object'] };
  for (const k of ['id', 'date', 'company', 'channel', 'lang', 'draft', 'status', 'origin']) {
    if (r[k] == null || r[k] === '') failures.push(`missing field: ${k}`);
  }
  if (r.channel && !CHANNELS.includes(r.channel)) failures.push(`unknown channel « ${r.channel} », expected one of ${CHANNELS.join(', ')}`);
  if (r.status && !STATUSES.includes(r.status)) failures.push(`unknown status « ${r.status} », expected one of ${STATUSES.join(', ')}`);
  if (r.status === 'sent' && !r.final) failures.push('status sent without `final`: record what really went out, corrections included');

  // The text that matters is what went out when it exists, the draft otherwise.
  const text = r.final ?? r.draft ?? '';
  if (!String(text).trim()) return { ok: false, failures: [...failures, 'empty text'] };

  // Text between quotation marks is quoted as is (a line of the posting keeps
  // its dashes and its numbers): it is excluded from the style and number checks.
  const outsideQuotes = text.replace(/[«"“][^»"”]*[»"”]/g, ' ');

  // Dash as punctuation: em dash, en dash, or a hyphen between two spaces.
  // Hyphens inside words (full-stack, e-mail) and line-leading bullets pass.
  if (W.noDashPunctuation) {
    const bad = outsideQuotes.split('\n').filter((l) => /[—–]/.test(l) || / - /.test(l.replace(/^\s*- /, '')));
    if (bad.length) failures.push(`dash used as punctuation: « ${bad[0].trim().slice(0, 70)} »`);
  }

  if (r.lang && STOPWORDS[r.lang]) {
    const got = detectLang(text);
    if (got !== r.lang) failures.push(`language detected ${got}, expected ${r.lang} (the text follows the posting's language)`);
  }
  if (r.limit && text.length > r.limit) failures.push(`${text.length} characters for a limit of ${r.limit} (the field would cut silently)`);

  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (m) failures.push(`current salary written: « ${m[0]} » (WRITING.forbiddenPatterns)`);
  }
  if (NOTICE_WORDS.some((re) => re.test(text)) && !NOTICE_OK.some((s) => text.toLowerCase().includes(s))) {
    failures.push(`notice period mentioned without one of: ${NOTICE_OK.join(' / ')}`);
  }

  const claims = Array.isArray(r.claims) ? r.claims : [];
  for (const c of claims) if (!ids.has(c?.source)) failures.push(`source unknown to profile/stories.md: ${c?.source}`);
  for (const s of r.stories ?? []) if (!ids.has(s)) failures.push(`story unknown to profile/stories.md: ${s}`);

  // Anti-fabrication: every number of the text is carried by a sourced claim.
  // Numbers quoted from the posting or the question, anything between
  // quotation marks, and contact data in a signature (the candidate's phone,
  // email, URLs) are excluded: they are contact details, not claims.
  const covered = new Set(claims.flatMap((c) => numbers(c?.text)));
  const quoted = new Set([...(r.posting_quotes ?? []), r.question ?? ''].flatMap(numbers));
  const contactFree = outsideQuotes
    .replace(/https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+\.[^\s@]+/g, ' ')
    .replace(PHONE, ' ');
  const orphans = [...new Set(numbers(contactFree))].filter((n) => !covered.has(n) && !quoted.has(n));
  if (orphans.length) failures.push(`number(s) without a sourced claim: ${orphans.join(', ')}`);

  if (!(r.posting_quotes ?? []).some((l) => l && String(l).trim())) {
    failures.push('no line of the posting quoted in posting_quotes (a text built on nothing specific is generic by construction)');
  }

  return { ok: failures.length === 0, failures };
}

export function readRecords(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${path}: line ${i + 1} is not valid JSON`); }
  });
}

// --- CLI -------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const fi = args.indexOf('--file');
  const file = fi >= 0 ? resolve(args[fi + 1] ?? '') : DEFAULT_RECORDS;
  const id = args.find((a, i) => !a.startsWith('--') && (fi < 0 || i !== fi + 1));

  if (!existsSync(file)) {
    console.log(`no records yet (${file} does not exist)`);
    process.exit(id ? 1 : 0);
  }
  const ids = loadIds();
  if (!ids.size) console.log('⚠ profile/stories.md holds no id: every claim will fail');
  const records = readRecords(file);
  let failed = 0, seen = 0;
  for (const r of records) {
    if (id && r.id !== id) continue;
    seen++;
    const res = check(r, ids);
    r.checks = res;
    if (!res.ok) failed++;
    console.log(`${res.ok ? '✓' : '✗'} ${r.id}${res.ok ? '' : '\n    ' + res.failures.join('\n    ')}`);
  }
  if (id && !seen) { console.log(`✗ no record with id ${id} in ${file}`); process.exit(1); }
  if (write) writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\n${failed} failing`);
  process.exit(failed ? 1 : 0);
}
