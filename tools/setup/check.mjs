#!/usr/bin/env node
// SessionStart hook. Whatever it prints on stdout is added to the agent's
// context at the start of every session (Claude Code docs: plain-text stdout of
// a SessionStart hook is added as context). Wired in .claude/settings.json.
//
// Two jobs:
//   1. Not configured yet → tell the agent to run the onboarding interview
//      (the job-scout-init skill) before doing anything else. This is what
//      makes the boilerplate ask its questions on first launch.
//   2. Configured → a short status: tracker counts, replies owed, last digest,
//      last inbox review, LinkedIn session age, dated items coming due.
//
// ⚠️ It must NEVER break a session: no network, everything caught, exit 0.
// It ignores the JSON the hook runner writes on stdin.
//
// Manual run: node tools/setup/check.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DAY = 86400000;
const today = new Date();
const daysSince = (d) => Math.floor((today - d) / DAY);
const out = [];
const say = (s = '') => out.push(s);

function notConfigured(reasons) {
  say('=== JOB SCOUT: NOT CONFIGURED YET ===');
  say('Job Scout is not configured for this candidate yet. Before doing anything else, tell the');
  say('user and run the job-scout-init skill (the onboarding interview). It asks who they are, what');
  say('they are looking for, where, for how much, and how the pipeline should behave, then writes');
  say('profile/profile.mjs, the experience canon and the answer bank, and seeds the ATS watchlist.');
  say('Every tool reads the profile, so running a scan before the interview filters on the wrong person.');
  if (reasons.length) {
    say('');
    say('Why this message:');
    for (const r of reasons.slice(0, 8)) say(`  - ${r}`);
    if (reasons.length > 8) say(`  - and ${reasons.length - 8} more (node tools/setup/validate.mjs)`);
  }
  say('=====================================');
}

async function main() {
  let validate;
  try {
    ({ validate } = await import(pathToFileURL(join(ROOT, 'tools', 'setup', 'validate.mjs')).href));
  } catch (e) {
    notConfigured([`tools/setup/validate.mjs does not load: ${e.message}`]);
    return;
  }
  const { errors, profile: P } = await validate();
  if (!P || P.CONFIGURED !== true) {
    notConfigured(P ? ['profile/profile.mjs has CONFIGURED = false (example candidate)', ...errors] : errors);
    return;
  }
  if (errors.length) {
    say('=== JOB SCOUT: PROFILE INVALID ===');
    say('profile/profile.mjs is marked configured but does not validate. Tell the user, and fix it');
    say('(or rerun the relevant section of the job-scout-init skill) before running any tool:');
    for (const e of errors.slice(0, 10)) say(`  ✗ ${e}`);
    say('==================================');
    return;
  }

  say(`=== JOB SCOUT: ${P.CANDIDATE.firstName}'s pipeline ===`);

  // --- tracker -----------------------------------------------------------------
  let text;
  try {
    text = await import(pathToFileURL(join(ROOT, 'tools', 'lib', 'text.mjs')).href);
  } catch { /* the status degrades, it never fails */ }
  const csv = join(ROOT, 'applications', 'applications.csv');
  let waiting = [];
  if (text && existsSync(csv)) {
    const rows = text.readCsvObjects(csv);
    const counts = {};
    for (const r of rows) counts[r.status || '(no status)'] = (counts[r.status || '(no status)'] ?? 0) + 1;
    const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
    say(`Tracker: ${rows.length} application(s)${summary ? ` (${summary})` : ''}.`);
    waiting = rows.filter((r) => /WAITING FOR MY REPLY/i.test(r.notes ?? ''));
    const interviews = rows.filter((r) => /INTERVIEW OBTAINED/i.test(r.notes ?? ''));
    if (interviews.length) say(`Interviews obtained: ${interviews.map((r) => r.company).join(', ')}.`);
  } else {
    say('Tracker: applications/applications.csv not found or unreadable.');
  }
  if (waiting.length) {
    say(`⚠️⚠️ ${waiting.length} company(ies) WAITING FOR A REPLY FROM THE CANDIDATE: ${waiting.map((r) => r.company).join(', ')}.`);
    say('   An interview invitation left unanswered costs the process. Handle these first.');
  }

  // --- inbox review ------------------------------------------------------------
  // Convention: progress.md records each review on a line containing
  // "inbox review" and an ISO date, e.g. "Inbox review: done 2026-09-20".
  const progress = join(ROOT, 'progress.md');
  let lastReview = null;
  if (existsSync(progress)) {
    for (const line of readFileSync(progress, 'utf8').split('\n')) {
      if (!/inbox review/i.test(line)) continue;
      for (const m of line.matchAll(/(\d{4}-\d{2}-\d{2})/g)) {
        const d = new Date(`${m[1]}T12:00:00`);
        if (!Number.isNaN(+d) && (!lastReview || d > lastReview)) lastReview = d;
      }
    }
  }
  say(lastReview
    ? `Last inbox review recorded: ${lastReview.toISOString().slice(0, 10)} (${daysSince(lastReview)} day(s) ago).`
    : 'No inbox review recorded in progress.md yet.');
  say('RULE: every session starts with the inbox review (in context, by reading the mails), before any');
  say(`scan or triage. Replies to applications already sent are worth more than new postings. Mail access: ${P.MAIL?.access ?? 'unknown'}.`);

  // --- digests -------------------------------------------------------------------
  const dig = join(ROOT, 'digests');
  if (existsSync(dig)) {
    const dated = readdirSync(dig)
      .map((f) => /^(\d{4}-\d{2}-\d{2})/.exec(f)?.[1])
      .filter(Boolean)
      .sort();
    const last = dated.at(-1);
    say(last ? `Latest digest: ${last} (${daysSince(new Date(`${last}T12:00:00`))} day(s) ago).` : 'No digest yet: no scan has run.');
  }

  // --- LinkedIn session ------------------------------------------------------------
  if (P.LINKEDIN?.enabled) {
    const sf = join(ROOT, 'tools', 'linkedin', '.session.json');
    if (existsSync(sf)) {
      let captured = null;
      try { captured = new Date(JSON.parse(readFileSync(sf, 'utf8')).capturedAt); } catch { /* ignore */ }
      if (!captured || Number.isNaN(+captured)) captured = statSync(sf).mtime;
      say(`LinkedIn session captured ${daysSince(captured)} day(s) ago. Before concluding "nothing new", run doctor, never whoami.`);
    } else {
      say('LinkedIn is enabled but no session is cached: tools/browser/launch-chrome.sh, log in, then node tools/linkedin/linkedin.mjs auth.');
    }
  }

  // --- dated items -------------------------------------------------------------------
  const due = [];
  try {
    const { RULED_OUT } = await import(pathToFileURL(join(ROOT, 'profile', 'ruled-out.mjs')).href);
    for (const [k, v] of Object.entries(RULED_OUT ?? {})) {
      const m = /cooldown[^0-9]*(\d{4}-\d{2}-\d{2})/i.exec(v ?? '');
      if (!m) continue;
      const end = new Date(`${m[1]}T12:00:00`);
      const left = Math.ceil((end - today) / DAY);
      if (left <= 0) due.push(`cooldown on '${k}' ended ${m[1]}: remove it from RULED_OUT only with evidence to reapply`);
      else if (left <= 30) due.push(`cooldown on '${k}' ends ${m[1]} (in ${left} day(s))`);
    }
  } catch { /* ignore */ }
  if (existsSync(join(ROOT, 'railway.json'))) {
    const left = Math.ceil((new Date('2026-12-01T00:00:00') - today) / DAY);
    if (left > 0 && left <= 60) due.push(`railway.json stops working on 2026-12-01 (in ${left} day(s)): run \`railway config migrate\``);
    else if (left <= 0) due.push('railway.json is past its 2026-12-01 deprecation: the dashboard deploy needs `railway config migrate`');
  }
  if (due.length) {
    say('Dated items:');
    for (const d of due) say(`  - ${d}`);
  }

  say(`Rules in force: one application per company · follow-ups ${P.RULES?.followUps === 'never' ? 'NEVER' : `after ${P.RULES?.followUps} days`} · no outbound message without explicit approval · scans run by hand.`);
  say('To work: load the job-scout skill.');
  say('='.repeat(24 + P.CANDIDATE.firstName.length));
}

try {
  await main();
} catch (e) {
  out.push(`(job scout status unavailable: ${e.message})`);
}
if (!process.argv.includes('--quiet') || out[0]?.includes('NOT CONFIGURED')) process.stdout.write(`${out.join('\n')}\n`);
process.exit(0);
