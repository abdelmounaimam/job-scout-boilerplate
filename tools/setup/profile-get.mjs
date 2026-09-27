#!/usr/bin/env node
// Prints one value of profile/profile.mjs (or profile/ruled-out.mjs) by dotted
// path, so shell scripts read the profile instead of hardcoding candidate facts.
//
//   node tools/setup/profile-get.mjs RESUME.uploadFileName     → CANDIDATE_EXAMPLE_CV.pdf
//   node tools/setup/profile-get.mjs RESUME.byLanguage.en      → profile/cv/cv.pdf
//   node tools/setup/profile-get.mjs LINKEDIN.enabled          → true
//   node tools/setup/profile-get.mjs TARGET.titles             → ["Software Engineer",…]
//
// Strings and numbers print raw, arrays and objects print as JSON, null prints
// as an empty line. An unknown path exits 1 with the available keys, so a
// typo in a script fails loudly instead of reading as an empty value.

import * as P from '../../profile/profile.mjs';
import { RULED_OUT } from '../../profile/ruled-out.mjs';

const path = process.argv[2];
if (!path) {
  process.stderr.write('usage: node tools/setup/profile-get.mjs <EXPORT.key.subkey>\n');
  process.exit(2);
}

let cur = { ...P, RULED_OUT };
const walked = [];
for (const part of path.split('.')) {
  if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) {
    const keys = cur && typeof cur === 'object' ? Object.keys(cur).join(', ') : '(not an object)';
    process.stderr.write(`✗ unknown path "${path}" at "${[...walked, part].join('.')}"\n  available: ${keys}\n`);
    process.exit(1);
  }
  cur = cur[part];
  walked.push(part);
}

if (cur === null || cur === undefined) console.log('');
else if (typeof cur === 'object') console.log(JSON.stringify(cur));
else console.log(String(cur));
