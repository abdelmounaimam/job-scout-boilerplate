// Demo profile, read by scripts/build-data.mjs ONLY in demo mode
// (DASHBOARD_DEMO=1, `bun run demo`). It describes the same fictional
// candidate as the template's profile/profile.mjs, reduced to the fields the
// dashboard reads. Your real profile/profile.mjs is never opened in demo mode.

export const DASHBOARD = {
  title: 'Demo search',
  locale: 'en-GB',
};

export const TARGET = {
  salaryFloor: 60000,
  currency: 'EUR',
};

export const RULES = {
  followUps: 'never',
};
