#!/usr/bin/env node
// Offline check of the two decision functions, through the REAL code path
// (the module is imported, not reimplemented: a check that bypasses the real
// path checks nothing). No network, no session.
//
// Run after any edit of the triage, of the title lists or of the stack lists:
//   node tools/linkedin/test-triage.mjs
//
// ⚠️ These cases assume the EXAMPLE profile's stacks (JS/TS wanted, Java/.NET
// closed) and a salary floor above 41k. After the init interview rewrites the
// profile, adapt the cases to the real candidate rather than deleting them:
// each one encodes a trap that already cost an application somewhere.

import { triage, prefilterCard } from './linkedin.mjs';
import * as P from '../../profile/profile.mjs';

const HOME = P.GEO.home[0] ?? '';
const job = (over) => ({
  title: 'Software Engineer',
  companyName: 'Acme Software',
  formattedLocation: HOME,
  jobState: 'LISTED',
  closedAt: null,
  applies: 5,
  description: '',
  ...over,
});

let failed = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`✓ ${name}`);
  else { failed += 1; console.log(`✗ ${name}\n    ${JSON.stringify(detail)}`); }
};

// 1. An enumeration of accepted languages is not a required stack.
{
  const t = triage(job({
    description: 'Demonstrated experience with at least one general-purpose programming language '
      + 'such as Java, Python, C++, C#, Go, Rust, or TypeScript. Salary 70-90k€.',
  }));
  check('enumeration "such as Java ... or TypeScript" is kept', t.keep, t.drops);
  check('enumeration is flagged as options', t.flags.some((f) => f.includes('OPTIONS')), t.flags);
}

// 2. The title decides on the stack.
{
  const t = triage(job({ title: 'Développeur Java Fullstack', description: 'React, TypeScript, Java Spring.' }));
  check('"Java Fullstack" title drops', !t.keep && t.drops.some((d) => d.startsWith('stack in title')), t.drops);
}

// 3. Singular client = placement, plural = SaaS vocabulary.
{
  const strong = triage(job({ description: 'Pour notre client, éditeur SaaS, nous cherchons un dev TypeScript.' }));
  check('"notre client" drops', !strong.keep && strong.drops.some((d) => d.startsWith('intermediary')), strong.drops);
  const weak = triage(job({ description: 'Nos clients adorent notre produit TypeScript et React.' }));
  check('"nos clients" only flags', weak.keep && weak.flags.some((f) => f.includes('nos clients')), { drops: weak.drops, flags: weak.flags });
}

// 4. A band written in prose under the floor drops.
{
  const t = triage(job({ description: 'Node.js / TypeScript, cœur du réacteur. Package : 41k maximum.' }));
  const expectDrop = P.TARGET.salaryFloor > 41000;
  check(
    `prose band 41k vs floor ${P.TARGET.salaryFloor} ${expectDrop ? 'drops' : 'passes'}`,
    expectDrop ? t.drops.some((d) => d.startsWith('band')) : !t.drops.some((d) => d.startsWith('band')),
    t.drops,
  );
}

// 5. A marketing sentence masking the real years floor is flagged.
{
  const t = triage(job({
    description: "Séniorité : Confirmé(e) 5-10 ans d'expérience. Dans 2 ans, tu auras acquis "
      + "5 ans d'expérience professionnelle. TypeScript, React. 65-80k€.",
  }));
  check('ambiguous years floor is flagged', t.flags.some((f) => f.includes('AMBIGUOUS FLOOR')), { drops: t.drops, flags: t.flags });
}

// 6. RULED_OUT matches across straight and typographic apostrophes.
{
  const t = triage(
    job({ companyName: 'Armée de l’air et de l’espace', description: 'TypeScript, React.' }),
    { ruledOut: { "armée de l'air et de l'espace": 'citizenship required (test)' } },
  );
  check('RULED_OUT matches a typographic apostrophe', t.drops.some((d) => d.startsWith('ruled out')), t.drops);
}

// 7. The prefilter catches a title ENDING in "Intern".
{
  const why = prefilterCard({ title: 'Software Engineer Intern', company: 'Acme' });
  check('prefilter drops "Software Engineer Intern"', Boolean(why) && why.startsWith('level'), why);
  const internal = prefilterCard({ title: 'Software Engineer, Internal Tools', company: 'Acme' });
  check('prefilter keeps "Internal Tools"', internal === null, internal);
}

// 8. A dead posting drops whatever its body says.
{
  const t = triage(job({ jobState: 'CLOSED', description: 'TypeScript React' }));
  check('closed posting drops', !t.keep && t.drops.some((d) => d.startsWith('posting')), t.drops);
}

console.log(failed ? `\n✗ ${failed} check(s) failed` : '\n✓ all checks pass');
process.exit(failed ? 1 : 0);
