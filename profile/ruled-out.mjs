// ============================================================================
// COMPANIES CLOSED ON PURPOSE — written by hand AFTER reading a posting body.
//
// Distinct from applications/applications.csv, which only knows the companies
// already applied to. Without this table, the same company is re-read and
// re-rejected at every scan: two companies read and closed on a Friday came
// back to the top of the Monday digest because nothing remembered the work.
//
// Rules for an entry:
//   - The key is the company name, lowercase. It is compared after
//     normalisation (accents stripped, typographic apostrophes flattened), so
//     "Armée de l’air" and "armee de l'air" match. A key also matches when it
//     is a leading run of words of the listed name ("acme" matches "Acme Labs").
//   - The value says WHY and WHEN, quoting the posting when possible.
//   - Only STRUCTURAL closures belong here: the stack, the nature of the
//     company (agency, marketplace, internal IT), the geography or the law
//     (citizenship, ITAR). A years floor does NOT belong here: it moves from
//     one req to the next at the same company.
//   - A closure that can reopen says so ("reopen if a mid-level React req appears").
//   - A cooldown after a rejection is an entry too, with its end date, so the
//     triage enforces it instead of a note nobody reads.
//
// Read by: triage() in tools/linkedin/linkedin.mjs, the ATS poller, both
// workflows (so agents do not bring these back).
// ============================================================================

export const RULED_OUT = {
  // 'examplecorp': 'back end in Scala, verified in the body of two reqs (2026-01-15)',
  // 'hirefast talent': 'agency: « we are working with a fast-growing fintech », client never named (2026-01-20)',
  // 'dreamco': 'COOLDOWN until 2027-01-22 (final-round rejection 2026-07-22 + 6 months)',
};
