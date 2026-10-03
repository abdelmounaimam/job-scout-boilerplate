#!/usr/bin/env node
// Validates profile/profile.mjs and profile/ruled-out.mjs: types, shapes, sanity.
//
//   node tools/setup/validate.mjs            full report, exit 1 on any error
//   node tools/setup/validate.mjs --quiet    prints nothing, exit code only
//   node tools/setup/validate.mjs --json     { errors, warnings } on stdout
//
// Errors break the pipeline (a tool would crash or silently filter wrong).
// Warnings are example values still in place, or files the profile points at
// that do not exist yet. Run it after every edit of the profile.
//
// ⚠️ The validator checks SHAPES, not TRUTH. It cannot know whether a salary
// floor or a work authorisation is right. Only the candidate can, which is why
// the init interview asks instead of inferring.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CAD', 'AUD', 'JPY', 'INR', 'SGD', 'BRL', 'MAD'];
const LLM_DELEGATES = ['none', 'codex', 'claude'];
const SUBMITTERS = ['agent', 'human'];
const LI_EXPERIENCE = ['1', '2', '3', '4', '5', '6'];
const LI_POSTED = ['r86400', 'r604800', 'r2592000', ''];
const LI_JOBTYPE = ['F', 'P', 'C', 'T', 'V', 'I', 'O'];
const LI_SORT = ['DD', 'R'];

export async function validate() {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  let P;
  try {
    P = await import(pathToFileURL(join(ROOT, 'profile', 'profile.mjs')).href);
  } catch (e) {
    return { errors: [`profile/profile.mjs does not load: ${e.message}`], warnings, profile: null };
  }

  const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const strList = (v, name, { min = 1 } = {}) => {
    if (!Array.isArray(v)) return err(`${name} must be an array`);
    if (v.length < min) err(`${name} must hold at least ${min} entr${min > 1 ? 'ies' : 'y'}`);
    v.forEach((x, i) => { if (typeof x !== 'string' || !x.length) err(`${name}[${i}] must be a non-empty string`); });
    const lower = v.filter((x) => typeof x === 'string').map((x) => x.toLowerCase());
    const dupes = lower.filter((x, i) => lower.indexOf(x) !== i);
    if (dupes.length) warn(`${name} has duplicates: ${[...new Set(dupes)].join(', ')}`);
    // Matching is done on lowercased text: an uppercase entry never matches.
    const upper = v.filter((x) => typeof x === 'string' && x !== x.toLowerCase());
    if (upper.length && !/titles|segments|aggregators|remoteBoards|vcPortfolios|fundingNews|noPublicBoard|preferredTiers/.test(name)) {
      err(`${name} entries are matched against LOWERCASED text, so these can never match: ${upper.join(', ')}`);
    }
  };
  const block = (name) => {
    const b = P[name];
    if (b == null || typeof b !== 'object') { err(`export ${name} is missing or not an object/array`); return null; }
    return b;
  };

  const CONFIGURED = P.CONFIGURED === true;
  if (typeof P.CONFIGURED !== 'boolean') err('export CONFIGURED must be a boolean');

  // --- CANDIDATE
  const C = block('CANDIDATE');
  if (C) {
    for (const k of ['firstName', 'lastName', 'headline', 'baseCity', 'baseCountry', 'email', 'phone', 'workAuthorization', 'noticePeriod']) {
      if (!isStr(C[k])) err(`CANDIDATE.${k} must be a non-empty string`);
    }
    if (!isNum(C.yearsExperience) || C.yearsExperience < 0) err('CANDIDATE.yearsExperience must be a number ≥ 0');
    if (isStr(C.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(C.email)) err(`CANDIDATE.email is not an email: ${C.email}`);
    if (/example\.(com|org)$/i.test(C.email ?? '')) (CONFIGURED ? err : warn)('CANDIDATE.email is still the example address');
    if (/^example$/i.test(C.firstName ?? '')) (CONFIGURED ? err : warn)('CANDIDATE.firstName is still the example value');
    if (/000 000/.test(C.phone ?? '')) (CONFIGURED ? err : warn)('CANDIDATE.phone is still the example value');
    if (C.links && typeof C.links === 'object') {
      for (const [k, v] of Object.entries(C.links)) {
        if (v && !/^https?:\/\//.test(v)) err(`CANDIDATE.links.${k} must be an http(s) URL`);
        if (/\/example\/?$|example\.com/.test(v ?? '')) warn(`CANDIDATE.links.${k} is still the example value`);
      }
    } else err('CANDIDATE.links must be an object');
  }

  // --- TARGET
  const T = block('TARGET');
  if (T) {
    strList(T.titles, 'TARGET.titles');
    strList(T.roleWords, 'TARGET.roleWords');
    strList(T.preferredTiers, 'TARGET.preferredTiers', { min: 0 });
    if (!T.years || !isNum(T.years.flag) || !isNum(T.years.drop)) err('TARGET.years must be { flag: number, drop: number }');
    else if (T.years.flag > T.years.drop) err('TARGET.years.flag must be ≤ TARGET.years.drop');
    if (!isNum(T.salaryFloor) || T.salaryFloor <= 0) err('TARGET.salaryFloor must be a positive number (gross per year)');
    else if (T.salaryFloor < 1000) err('TARGET.salaryFloor looks like thousands: write 60000, not 60');
    if (T.salaryTarget != null) {
      if (!Array.isArray(T.salaryTarget) || T.salaryTarget.length !== 2 || !T.salaryTarget.every(isNum)) err('TARGET.salaryTarget must be [low, high]');
      else if (isNum(T.salaryFloor) && T.salaryTarget[0] < T.salaryFloor) warn('TARGET.salaryTarget starts under the floor: the floor is not the ask');
    }
    if (!CURRENCIES.includes(T.currency)) err(`TARGET.currency must be an ISO code among ${CURRENCIES.join(', ')}`);
    if (!isStr(T.shape)) err('TARGET.shape must be a sentence');
  }

  // --- STACK
  const S = block('STACK');
  if (S) {
    strList(S.positive, 'STACK.positive');
    strList(S.negativeInBody, 'STACK.negativeInBody', { min: 0 });
    strList(S.negativeInTitle, 'STACK.negativeInTitle', { min: 0 });
    strList(S.enumerationMarkers, 'STACK.enumerationMarkers');
    const both = (S.positive ?? []).filter((x) => (S.negativeInBody ?? []).includes(x));
    if (both.length) err(`STACK: in both positive and negativeInBody: ${both.join(', ')}`);
    const vetoedPositive = (S.positive ?? []).filter((x) => (S.negativeInTitle ?? []).includes(x));
    if (vetoedPositive.length) err(`STACK: positive terms vetoed in titles: ${vetoedPositive.join(', ')}`);
  }

  // --- TITLE
  const TI = block('TITLE');
  if (TI) {
    strList(TI.tooJunior, 'TITLE.tooJunior', { min: 0 });
    strList(TI.leadDrop, 'TITLE.leadDrop', { min: 0 });
    strList(TI.tooSenior, 'TITLE.tooSenior', { min: 0 });
    strList(TI.wrongFunction, 'TITLE.wrongFunction', { min: 0 });
    // A wrongFunction entry that swallows the target title is invisible until
    // someone reads the output. Catch the obvious cases here.
    const titles = (T?.titles ?? []).map((t) => t.toLowerCase());
    for (const f of TI.wrongFunction ?? []) {
      const hit = titles.find((t) => t.includes(f));
      if (hit) err(`TITLE.wrongFunction '${f}' matches the target title '${hit}': it would drop your own job`);
    }
    for (const f of TI.leadDrop ?? []) {
      const hit = titles.find((t) => new RegExp(`(^|[^a-z0-9])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(t));
      if (hit) err(`TITLE.leadDrop '${f}' matches the target title '${hit}'`);
    }
    for (const f of TI.tooJunior ?? []) {
      const hit = titles.find((t) => t.includes(f));
      if (hit) warn(`TITLE.tooJunior '${f}' matches the target title '${hit}'`);
    }
    for (const bad of ['structure', 'server', 'design engineer', 'forward deployed']) {
      if ((TI.wrongFunction ?? []).includes(bad)) warn(`TITLE.wrongFunction holds '${bad}', which is known to drop real targets (substring match)`);
    }
  }

  // --- GEO
  const G = block('GEO');
  if (G) {
    if (!isStr(G.linkedinLocation)) err('GEO.linkedinLocation must be a place name LinkedIn understands, usually the country');
    strList(G.home, 'GEO.home');
    strList(G.inclusiveRegions, 'GEO.inclusiveRegions', { min: 0 });
    if (typeof G.remoteOk !== 'boolean') err('GEO.remoteOk must be a boolean');
    if (typeof G.relocationWithinCountryOk !== 'boolean') err('GEO.relocationWithinCountryOk must be a boolean');
    if (G.salaryFloorAbroad !== null && !isNum(G.salaryFloorAbroad)) err('GEO.salaryFloorAbroad must be a number, or null when abroad is never considered');
    if (isNum(G.salaryFloorAbroad) && T && isNum(T.salaryFloor) && G.salaryFloorAbroad < T.salaryFloor) {
      warn('GEO.salaryFloorAbroad is under TARGET.salaryFloor: abroad costs relocation, deposit and unpaid months');
    }
    if (C && isStr(C.baseCountry) && Array.isArray(G.home) && !G.home.includes(C.baseCountry.toLowerCase())) {
      warn(`GEO.home does not list the base country '${C.baseCountry.toLowerCase()}'`);
    }
  }

  // --- INTERMEDIARY
  const I = block('INTERMEDIARY');
  if (I) {
    strList(I.names, 'INTERMEDIARY.names', { min: 0 });
    strList(I.strongPhrases, 'INTERMEDIARY.strongPhrases');
    strList(I.weakPhrases, 'INTERMEDIARY.weakPhrases', { min: 0 });
    // The plural is SaaS vocabulary. It must never be a hard exclusion.
    for (const p of ['our clients', 'nos clients']) {
      if ((I.strongPhrases ?? []).includes(p)) err(`INTERMEDIARY.strongPhrases holds '${p}': the plural is ordinary SaaS vocabulary, keep it in weakPhrases`);
    }
    // Every apostrophe phrase must exist in both forms.
    const phrases = I.strongPhrases ?? [];
    for (const p of phrases) {
      if (p.includes("'") && !phrases.includes(p.replace(/'/g, '’'))) warn(`INTERMEDIARY.strongPhrases '${p}' has no typographic-apostrophe twin (’)`);
    }
  }

  if (!Array.isArray(P.JUNIOR_OPEN)) err('export JUNIOR_OPEN must be an array'); else strList(P.JUNIOR_OPEN, 'JUNIOR_OPEN', { min: 0 });
  if (!Array.isArray(P.MANAGEMENT_SCOPE)) err('export MANAGEMENT_SCOPE must be an array'); else strList(P.MANAGEMENT_SCOPE, 'MANAGEMENT_SCOPE', { min: 0 });

  // --- LINKEDIN
  const L = block('LINKEDIN');
  if (L) {
    if (typeof L.enabled !== 'boolean') err('LINKEDIN.enabled must be a boolean');
    const b = L.base ?? {};
    const inEnum = (arr, allowed, name) => {
      if (!Array.isArray(arr)) return err(`LINKEDIN.base.${name} must be an array`);
      arr.forEach((v) => { if (!allowed.includes(v)) err(`LINKEDIN.base.${name}: unknown raw value '${v}' (see tools/linkedin/vocab.mjs)`); });
    };
    inEnum(b.experience, LI_EXPERIENCE, 'experience');
    inEnum(b.timePostedRange, LI_POSTED, 'timePostedRange');
    inEnum(b.jobType, LI_JOBTYPE, 'jobType');
    inEnum(b.sortBy, LI_SORT, 'sortBy');
    if (!Array.isArray(L.axes)) err('LINKEDIN.axes must be an array');
    else {
      if (L.enabled && !L.axes.length) err('LINKEDIN.axes is empty while LinkedIn is enabled');
      const labels = new Set();
      L.axes.forEach((a, i) => {
        const at = `LINKEDIN.axes[${i}]`;
        if (!a || typeof a !== 'object') return err(`${at} must be an object`);
        if (!isStr(a.label)) err(`${at}.label must be a string`);
        else if (labels.has(a.label)) err(`${at}.label '${a.label}' is used twice`);
        else labels.add(a.label);
        if (!isStr(a.keywords) && !(Array.isArray(a.company) && a.company.length)) err(`${at} needs keywords or a company id list`);
        if (a.company && !(Array.isArray(a.company) && a.company.every((x) => /^\d+$/.test(String(x))))) err(`${at}.company must be numeric LinkedIn ids as strings (resolve with linkedin.mjs companies -k)`);
        if (!Number.isInteger(a.pages) || a.pages < 1 || a.pages > 40) err(`${at}.pages must be an integer between 1 and 40 (25 postings per page)`);
        if ('experience' in a && a.experience !== null && !(Array.isArray(a.experience) && a.experience.every((x) => LI_EXPERIENCE.includes(x)))) {
          err(`${at}.experience must be null (no level filter) or raw values like ['2','3']`);
        }
      });
      const requests = L.axes.reduce((n, a) => n + (a.pages ?? 0), 0);
      if (requests > 120) warn(`LINKEDIN.axes total ${requests} search pages per scan: human pacing makes that slow, trim broad axes`);
    }
    if (!Number.isInteger(L.detailBudget) || L.detailBudget < 1) err('LINKEDIN.detailBudget must be a positive integer');
    else if (L.detailBudget < 100) warn('LINKEDIN.detailBudget under 100: a saturated budget silently decides what gets read');
    if (typeof L.recommended !== 'boolean') err('LINKEDIN.recommended must be a boolean');
  }

  // --- RULES
  const R = block('RULES');
  if (R) {
    for (const k of ['oneApplicationPerCompany', 'easyApplyByHuman', 'agentMayCreateAccounts', 'refuseVideoAnswers', 'employeeOnly', 'excludeFoundingTinyTeams', 'neverDiscloseCurrentSalary', 'outboundNeedsApproval']) {
      if (typeof R[k] !== 'boolean') err(`RULES.${k} must be a boolean`);
    }
    if (!SUBMITTERS.includes(R.submittedBy)) err(`RULES.submittedBy must be one of ${SUBMITTERS.join(', ')}`);
    if (!(R.followUps === 'never' || (Number.isInteger(R.followUps) && R.followUps > 0))) err("RULES.followUps must be 'never' or a number of days");
    if (R.maxParallelApplications !== null && !(Number.isInteger(R.maxParallelApplications) && R.maxParallelApplications > 0)) err('RULES.maxParallelApplications must be null or a positive integer');
    strList(R.coverLetterLanguages, 'RULES.coverLetterLanguages', { min: 0 });
    if (R.outboundNeedsApproval === false) warn('RULES.outboundNeedsApproval is false: the agent may send mail without showing it first');
    if (R.easyApplyByHuman === false) warn('RULES.easyApplyByHuman is false: the LinkedIn client is read only and stays so, Easy Apply will still need a human');
  }

  // --- WRITING (inputs of evals/check.mjs)
  const W = block('WRITING');
  if (W) {
    if (typeof W.noDashPunctuation !== 'boolean') err('WRITING.noDashPunctuation must be a boolean');
    strList(W.noticeWords, 'WRITING.noticeWords');
    // Matched case-insensitively by evals/check.mjs, so no lowercase rule here
    // (German nouns keep their capital).
    for (const k of ['noticePhrasings', 'forbiddenPatterns']) {
      if (!Array.isArray(W[k])) { err(`WRITING.${k} must be an array of strings`); continue; }
      W[k].forEach((x, i) => { if (!isStr(x)) err(`WRITING.${k}[${i}] must be a non-empty string`); });
    }
    if (Array.isArray(W.forbiddenPatterns)) {
      for (const p of W.forbiddenPatterns) {
        try { new RegExp(p, 'i'); } catch (e) { err(`WRITING.forbiddenPatterns: invalid regular expression ${p}: ${e.message}`); }
      }
      if (CONFIGURED && R?.neverDiscloseCurrentSalary && !W.forbiddenPatterns.length) {
        warn('WRITING.forbiddenPatterns is empty: nothing stops the current salary from appearing in a free text');
      }
    }
    // The notice wordings must agree with the notice period itself: a profile
    // updated in one place only is how a stale notice reaches an interview.
    if (C && isStr(C.noticePeriod) && Array.isArray(W.noticePhrasings)) {
      const lower = W.noticePhrasings.map((x) => String(x).toLowerCase());
      if (W.noticePhrasings.length && !lower.includes(C.noticePeriod.toLowerCase())) {
        warn(`WRITING.noticePhrasings does not list CANDIDATE.noticePeriod ('${C.noticePeriod}'): update both in the same edit`);
      }
    }
  }
  const STORIES = join(ROOT, 'profile', 'stories.md');
  if (!existsSync(STORIES)) err('profile/stories.md is missing: evals/check.mjs reads the story and fact ids from it');
  else {
    const ids = [...readFileSync(STORIES, 'utf8').matchAll(/\[((?:ST|FACT)-[A-Z0-9-]+)\]/g)].map((m) => m[1]);
    const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupes.length) err(`profile/stories.md: id(s) used twice: ${[...new Set(dupes)].join(', ')}`);
    if (!ids.some((x) => x.startsWith('ST-'))) warn('profile/stories.md holds no story id: every free text will fail its checks');
    if (CONFIGURED && /fictional candidate/i.test(readFileSync(STORIES, 'utf8'))) err('profile/stories.md still holds the example rows (run the story catalogue step of job-scout-init)');
  }

  // --- RESUME
  const RS = block('RESUME');
  if (RS) {
    if (!RS.byLanguage || typeof RS.byLanguage !== 'object' || !Object.keys(RS.byLanguage).length) err('RESUME.byLanguage must map a language code to a PDF path');
    else {
      for (const [lang, p] of Object.entries(RS.byLanguage)) {
        if (!/^[a-z]{2}$/.test(lang)) err(`RESUME.byLanguage key '${lang}' must be a 2-letter language code`);
        if (!isStr(p) || !p.endsWith('.pdf')) err(`RESUME.byLanguage.${lang} must be a path to a .pdf`);
        else if (!existsSync(isAbsolute(p) ? p : join(ROOT, p))) warn(`RESUME.byLanguage.${lang}: ${p} does not exist yet (compile the LaTeX or drop the PDF there)`);
      }
    }
    if (!isStr(RS.uploadFileName) || !/^[^/\\]+\.pdf$/.test(RS.uploadFileName)) err('RESUME.uploadFileName must be a bare file name ending in .pdf, no path');
    else if (/example/i.test(RS.uploadFileName)) (CONFIGURED ? err : warn)('RESUME.uploadFileName is still the example value (use LASTNAME_FIRSTNAME_CV.pdf)');
    if (typeof RS.latex !== 'boolean') err('RESUME.latex must be a boolean');
    const langs = Object.keys(RS.byLanguage ?? {});
    for (const l of R?.coverLetterLanguages ?? []) {
      if (!langs.includes(l)) warn(`RULES.coverLetterLanguages has '${l}' but RESUME.byLanguage has no resume in that language`);
    }
  }

  // --- AUTOMATION, MAIL, DASHBOARD, SOURCING
  const A = block('AUTOMATION');
  if (A) {
    if (!LLM_DELEGATES.includes(A.llmDelegate)) err(`AUTOMATION.llmDelegate must be one of ${LLM_DELEGATES.join(', ')}`);
    if (typeof A.scheduled !== 'boolean') err('AUTOMATION.scheduled must be a boolean');
    if (A.llmDelegate === 'claude') warn("AUTOMATION.llmDelegate is 'claude': make sure the Claude account is NOT an employer seat");
  }
  const M = block('MAIL');
  if (M && !isStr(M.access)) err('MAIL.access must describe how the agent reads the inbox (or say "none")');
  const D = block('DASHBOARD');
  if (D) {
    if (typeof D.enabled !== 'boolean') err('DASHBOARD.enabled must be a boolean');
    if (!isStr(D.title)) err('DASHBOARD.title must be a string');
    if (!isStr(D.locale)) err('DASHBOARD.locale must be a BCP 47 locale, e.g. en-GB');
    if (!isStr(D.basicAuthUser)) err('DASHBOARD.basicAuthUser must be a string');
  }
  const SO = block('SOURCING');
  if (SO) {
    for (const k of ['aggregators', 'remoteBoards', 'vcPortfolios', 'fundingNews', 'noPublicBoard', 'segments']) {
      strList(SO[k], `SOURCING.${k}`, { min: k === 'segments' ? 1 : 0 });
    }
  }

  // --- RULED_OUT
  try {
    const RO = await import(pathToFileURL(join(ROOT, 'profile', 'ruled-out.mjs')).href);
    if (!RO.RULED_OUT || typeof RO.RULED_OUT !== 'object' || Array.isArray(RO.RULED_OUT)) err('profile/ruled-out.mjs must export RULED_OUT as an object');
    else {
      for (const [k, v] of Object.entries(RO.RULED_OUT)) {
        if (k !== k.toLowerCase()) err(`RULED_OUT key '${k}' must be lowercase`);
        if (!isStr(v)) err(`RULED_OUT['${k}'] needs a reason with a date`);
        else if (!/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}/.test(v)) warn(`RULED_OUT['${k}'] has no date in its reason`);
      }
    }
  } catch (e) {
    err(`profile/ruled-out.mjs does not load: ${e.message}`);
  }

  if (!CONFIGURED) warn('CONFIGURED is false: the profile still describes the example candidate. Run the job-scout-init skill.');

  return { errors, warnings, profile: P };
}

// --- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const { errors, warnings } = await validate();
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: !errors.length, errors, warnings }, null, 2));
  } else if (!args.includes('--quiet')) {
    for (const e of errors) console.log(`✗ ${e}`);
    for (const w of warnings) console.log(`⚠ ${w}`);
    console.log(errors.length
      ? `\n✗ ${errors.length} error(s), ${warnings.length} warning(s). Fix the errors before running any tool.`
      : `\n✓ profile valid${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`);
  }
  process.exitCode = errors.length ? 1 : 0;
}
