// Title and company filters shared by watch.mjs, discover.mjs and probe.mjs.
// They see a TITLE, a LOCATION and a company name, nothing else: no body.
//
// The rules come from profile/profile.mjs and are the same lists the LinkedIn
// triage applies, with one deliberate difference: senior titles are DROPPED
// here, where the LinkedIn triage only flags them. LinkedIn has the posting
// body to nuance ("senior" title, no years floor in the body = open role in
// disguise); the poller has nothing but the title.

import { TARGET, TITLE, STACK, GEO, INTERMEDIARY } from '../../profile/profile.mjs';
import { RULED_OUT } from '../../profile/ruled-out.mjs';
import { hasWord, flattenCompany, ruledOutReason, loadHistory } from '../lib/text.mjs';
import { makeGeo } from '../lib/geo.mjs';

export const geo = makeGeo(GEO);

/**
 * Why a title is NOT the role, or null when it plausibly is.
 * ⚠️ Substring matching bites both ways (see the TITLE block of the profile):
 * test every list change on real boards with `watch.mjs --all`.
 */
export function titleVerdict(title) {
  const t = (title ?? '').toLowerCase();
  if (!TARGET.roleWords.some((w) => t.includes(w.toLowerCase()))) return 'not the role';
  // `includes` alone misses "Software Engineer Intern" ('intern ' has a
  // trailing space so it does not catch "Internal Tools"): the word boundary
  // on the trimmed term catches a title that ENDS with it.
  const junior = TITLE.tooJunior.find((x) => t.includes(x) || hasWord(t, x.trim()));
  if (junior) return `level (${junior.trim()})`;
  const fn = TITLE.wrongFunction.find((x) => t.includes(x));
  if (fn) return `adjacent function (${fn.trim()})`;
  // Word boundary: 'lead' must not catch "leadership", 'vp' must not catch anything.
  const lead = TITLE.leadDrop.find((x) => hasWord(t, x));
  if (lead) return `management tier (${lead.trim()})`;
  const senior = TITLE.tooSenior.find((x) => t.includes(x));
  if (senior) return `out of band (${senior.trim()})`;
  const veto = STACK.negativeInTitle.find((x) => hasWord(t, x));
  if (veto) return `stack in title (${veto.trim()})`;
  return null;
}

/** Does the company NAME give away an agency, a body shop or a consultancy? */
export const intermediaryName = (name) => {
  const n = flattenCompany(name);
  return INTERMEDIARY.names.find((s) => n.includes(flattenCompany(s).trim())) ?? null;
};

/** Structural closure written by hand in profile/ruled-out.mjs, or null. */
export const ruledOut = (name) => ruledOutReason(RULED_OUT, name);

/**
 * Has an application already gone out at this company?
 *
 * ⚠️⚠️ Read from the TRACKER AT RUNTIME, never from a flag written once in the
 * watchlist. The source pipeline stored `applied: false` in the watchlist at
 * promotion time, without looking at the tracker: a board promoted the week an
 * interview was running there came back marked ★ ACTIONABLE on the very req of
 * that interview, inviting a second application. A manual `applied: true` in
 * the watchlist is still honoured (applications made before the tracker began).
 */
export function appliedChecker() {
  const history = loadHistory();
  return (co) => Boolean(co.applied) || history.matchesCompany(co.name ?? co.slug ?? '');
}

/** A company name → the slugs worth probing. */
export function slugVariants(name) {
  const base = name.toLowerCase().trim();
  const noAmp = base.replace(/\s*&\s*/g, ' and ');
  const out = new Set([
    base.replace(/[^a-z0-9.]+/g, ''),          // "Weights & Biases" -> "weightsbiases", "acme.ai" kept
    base.replace(/[^a-z0-9]+/g, ''),           // drops dots too
    base.replace(/[^a-z0-9]+/g, '-'),          // "Cal.com" -> "cal-com"
    noAmp.replace(/[^a-z0-9]+/g, ''),
    base.split(/[\s.]+/)[0].replace(/[^a-z0-9]+/g, ''), // first word only
  ]);
  return [...out].filter((s) => s.length >= 2 && s.length <= 40);
}

/** ⚠️ SmartRecruiters is the one ATS whose identifier is CASE SENSITIVE:
 *  `Acme` answers, `acme` returns an empty list rather than an error. Feeding
 *  it lowercase variants makes every company look like it has no open roles. */
export function slugsFor(ats, name) {
  if (ats !== 'smartrecruiters') return slugVariants(name);
  const raw = name.replace(/[^A-Za-z0-9]+/g, '');
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
  return [...new Set([cap, raw])].filter((s) => s.length >= 2 && s.length <= 40);
}
