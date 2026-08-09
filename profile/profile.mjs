// ============================================================================
// THE PROFILE — the single tuning surface of the whole pipeline.
//
// ⚠️ EXAMPLE VALUES. Every field below describes a fictional candidate so the
// tools run out of the box. Run the `job-scout-init` skill (or edit by hand)
// to replace them. Nothing else in the repo should hardcode candidate facts:
// if you find yourself editing a script to encode a preference, the preference
// belongs here instead.
//
// Read by: tools/ats-watch/watch.mjs, tools/ats-watch/discover.mjs,
//          tools/ats-watch/probe.mjs, and every workflow prompt.
// ============================================================================

// --- Who ---------------------------------------------------------------------

export const CANDIDATE = {
  name: 'Example Candidate',
  headline: 'Full-stack engineer, TypeScript',
  yearsExperience: 2,
  currentRole: 'Software Engineer at ExampleCorp',
  baseCity: 'Berlin',
  baseCountry: 'Germany',
  email: 'candidate@example.com',
  phone: '+49 000 000 000',
  links: {
    linkedin: 'https://www.linkedin.com/in/example',
    github: 'https://github.com/example',
    portfolio: 'https://example.com',
  },
  // Work authorisation, in plain words. Agents quote this when they check a
  // posting: it decides which countries are reachable at all.
  workAuthorization: 'Full work rights in Germany. Anywhere else in the EU is a '
    + 'registration formality. Outside the EU requires sponsorship.',
};

// --- What ---------------------------------------------------------------------

export const TARGET = {
  // Job titles that ARE the role. Used to phrase searches, not to filter.
  titles: [
    'Software Engineer', 'Full Stack Engineer', 'Backend Engineer',
    'Product Engineer', 'Frontend Engineer', 'AI Engineer',
  ],
  // Seniority band, in years. Postings above `maxYears` are dropped, postings
  // between `flagYears` and `maxYears` come through with a warning.
  minYears: 0,
  flagYears: 3,
  maxYears: 5,
  // Salary floor. A posting whose displayed range TOPS OUT below this is dropped.
  // A posting with no displayed range is a warning, never a silent pass.
  salaryFloor: 60000,
  currency: 'EUR',
  // Company tiers, best first. Used to rank, never to exclude.
  preferredTiers: [
    'frontier AI labs',
    'AI-native products',
    'big tech',
    'strong product scale-ups',
    'remote-first devtools',
  ],
};

// --- Stack --------------------------------------------------------------------

export const STACK = {
  // Signals looked for in the BODY of a posting.
  positive: [
    'typescript', 'javascript', 'react', 'next.js', 'nextjs', 'node.js', 'nodejs',
    'nestjs', 'nest.js', 'express', 'remix', 'svelte', 'vue.js', 'vuejs',
    'graphql', 'tailwind', 'prisma', 'trpc', 'postgres', 'postgresql',
  ],
  // Hard exclusions found in the BODY. ⚠️ Match on word boundaries: a naive
  // `includes('java')` fires on "javascript" and kills every good posting.
  negativeInBody: [
    'java', 'spring boot', 'spring framework', 'jakarta ee', 'j2ee', 'hibernate',
    'php', 'symfony', 'laravel', 'drupal', 'wordpress',
    '.net', 'dotnet', 'c#', 'asp.net', 'blazor', 'entity framework',
  ],
  // ⚠️ THE TITLE OVERRULES THE BODY. "Java Fullstack Developer" survived triage
  // in the source pipeline because the body also mentioned React. A closed
  // language in the title closes the job whatever the body's balance is.
  negativeInTitle: [
    'java', 'php', 'symfony', 'laravel', 'magento', 'drupal', 'wordpress',
    '.net', 'c#', 'asp.net', 'python', 'golang', 'go /', 'rust', 'ruby', 'rails',
    'scala', 'kotlin', 'c++', 'delphi', 'cobol', 'abap',
  ],
};

// --- Titles that place a posting outside the band ------------------------------

export const TITLE = {
  tooJunior: [
    'intern', 'internship', 'trainee', 'apprentice', 'apprenticeship',
    'werkstudent', 'working student', 'praktikum', 'stage', 'stagiaire',
    'alternance', 'alternant',
  ],
  // ⚠️ Include the ABBREVIATIONS. Verified against live boards: "Sr Growth
  // Engineer" and "Sr AI Engineer" sailed through a list that only had
  // 'senior', and came back marked actionable.
  tooSenior: [
    'senior', 'sr ', 'sr.', 'snr', 'lead', 'principal', 'staff', 'head of',
    'director', 'vp ', 'architect', 'expert', 'manager', 'chief', 'cto',
  ],
  // Adjacent functions that surface on the same keywords without being the job.
  // ⚠️ This list removes more noise than any other filter in the pipeline.
  wrongFunction: [
    'qa ', 'q.a', 'quality assurance', 'test automation', 'sdet', 'tester',
    'data engineer', 'data scientist', 'data analyst', 'mlops',
    'machine learning engineer', 'research scientist',
    'devops', 'sre ', 'site reliability', 'infrastructure engineer',
    'cloud engineer', 'platform engineer', 'sysadmin', 'network engineer',
    'security engineer', 'pentest', 'soc analyst',
    'support engineer', 'technician', 'helpdesk',
    'product owner', 'product manager', 'scrum master', 'business analyst',
    'project manager', 'consultant', 'account',
    'solutions engineer', 'solution engineer', 'sales engineer',
    'business developer', 'developer advocate', 'developer relations',
    'technical writer', 'documentation engineer',
    'embedded', 'firmware', 'mobile developer', 'android', 'ios ',
    'magento', 'salesforce', 'sap ', 'sharepoint', 'dynamics',
    'game developer', 'game engineer', 'unity', 'unreal', 'gameplay',
    // ⚠️ DO NOT exclude 'forward deployed engineer': it is a target title at
    // several AI labs, and it reads like a sales role but is not one.
  ],
};

// --- Where --------------------------------------------------------------------

export const GEO = {
  // Place names that mean "zero friction". Country first, then the cities that
  // appear in postings without the country name next to them.
  home: [
    'germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg',
    'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'leipzig',
  ],
  // Regions whose name INCLUDES home. A posting saying only "Europe" is
  // plausible; a posting saying "Remote - US" is not.
  inclusiveRegions: ['emea', 'europe', 'european', 'worldwide', 'global', 'anywhere'],
  // Relocation inside the home country is not a cost. ⚠️ Never score "no
  // relocation needed" as a bonus: it silently over-ranks weak local postings
  // and under-ranks the best ones. Price the expensive city into the salary
  // band instead.
  relocationWithinCountryOk: true,
  // Countries reachable but expensive: full immigration, months of runway.
  // The floor is raised there, it is not the same job at the same money.
  salaryFloorAbroad: 70000,
  notes: 'Anywhere in the EU is administratively cheap. Non-EU needs sponsorship '
    + 'and 2 to 3 months, so it must clear the raised floor to be rational.',
};

// --- Intermediaries: agencies, body shops, consultancies -----------------------

export const INTERMEDIARY = {
  // Names. This list never catches them all: they are born faster than they are
  // listed. It is the phrase detector below that does the real work.
  names: [
    'randstad', 'hays', 'michael page', 'page personnel', 'adecco', 'manpower',
    'robert half', 'robert walters', 'harvey nash', 'nigel frank',
    'frank recruitment', 'darwin recruitment', 'austin fraser', 'ampersand',
    'accenture', 'capgemini', 'atos', 'sopra steria', 'cognizant', 'infosys',
    'wipro', 'tata consultancy', 'hcl technologies', 'ntt data', 'devoteam',
  ],
  // ⚠️ SINGULAR IS THE SIGNAL. "our client" means the company you would be
  // placed at, so it is staffing. "our clients" plural is ordinary SaaS
  // vocabulary for "our users": putting it in hard exclusions wrongly killed
  // two real product companies in the source pipeline. Plural = flag only.
  strongPhrases: [
    'our client ', 'on behalf of our client', 'for our client',
    'recruitment agency', 'staffing agency', 'recruitment consultancy',
    'headhunting', 'executive search', 'contract staffing', 'body leasing',
    'we recruit for', 'placed with one of our clients',
  ],
  weakPhrases: ['our clients', 'our consultants'],
};

// --- Junior-friendly wording ---------------------------------------------------
// The strongest single predictor in the whole pipeline. In a market where
// almost every posting asks for 3 to 5 years, an explicit opening to a first
// experience is worth more than five matching framework names.
export const JUNIOR_OPEN = [
  'first experience', 'early career', 'new grad', 'new graduate',
  'recent graduate', 'graduate program', 'entry level', 'junior',
  'no minimum years', 'no years of experience', 'we hire for potential',
  '1+ year', '1+ years', '2+ years', '0-2 years', '1-3 years', '2-3 years',
];

// --- Management scope ----------------------------------------------------------
// IC title, manager responsibilities. A signal and a penalty, never an
// exclusion: a genuine founding-engineer role is still a target.
export const MANAGEMENT_SCOPE = [
  'lead the engineering team', 'manage the engineering team', 'build the team',
  'hire and grow', 'grow the team', 'manage a team of', 'own the roadmap for the team',
  'line management', 'people management',
];

// --- Companies closed on purpose ------------------------------------------------
// Written by hand AFTER reading a posting body, with the reason and the date.
// Distinct from applications.csv, which only knows companies already applied to.
// Without this, the same company gets re-read and re-rejected every single scan.
export const RULED_OUT = {
  // 'examplecorp': 'Python in production, verified 2026-01-15',
};

// --- Sourcing ------------------------------------------------------------------
// Feeds the bootstrap and web-search workflows. These are angles of attack on
// the open web, not a list of companies: the list of companies is the OUTPUT.
export const SOURCING = {
  // Job boards and aggregators worth sweeping in this market. Replace with the
  // ones that actually matter where the candidate is looking.
  aggregators: [
    'LinkedIn Jobs', 'Indeed', 'Glassdoor', 'Otta', 'Wellfound',
    'StepStone', 'Xing', 'Honeypot', 'Talent.io',
  ],
  // Remote-first boards. ⚠️ Most "remote" postings there are US-only.
  remoteBoards: ['RemoteOK', 'We Work Remotely', 'Himalayas', 'Remotive', 'NoDesk'],
  // VC portfolio boards: the cheapest way to find funded companies that appear
  // on no aggregator at all.
  vcPortfolios: [
    'Index Ventures', 'Accel', 'Balderton', 'Point Nine', 'Cherry Ventures',
    'HV Capital', 'Earlybird', 'Y Combinator (Work at a Startup)',
    'Entrepreneur First',
  ],
  // Funding-news sources. A raise is followed by a hiring wave, and at that
  // moment the roles are on no aggregator yet.
  fundingNews: ['Sifted', 'TechCrunch EU', 'EU-Startups', 'Handelsblatt Tech'],
  // Segments the bootstrap workflow fans out over. One agent per segment.
  segments: [
    'AI labs and AI-native products in the home market',
    'AI labs and AI-native products elsewhere in Europe that employ remotely',
    'developer tools and infrastructure companies, remote-first',
    'fintech and B2B SaaS scale-ups in the home market',
    'big tech engineering sites in the home market',
    'recently funded seed and series A companies in the home market',
  ],
};

// --- Application rules ----------------------------------------------------------

export const RULES = {
  // One application per company, even when several reqs match. Three
  // applications at the same employer read as spam.
  oneApplicationPerCompany: true,
  // No cap on parallel applications: send on every qualified posting. What this
  // does NOT relax is reading the body first, and tailoring.
  maxParallelApplications: null,
  // Who presses Submit. 'human' is the safe default and the one to keep on any
  // priority target: one ATS in the source pipeline flagged an agent-driven
  // submission as possible spam. 'agent' is allowed once the form filling has
  // proven calm and sober on that platform.
  submittedBy: 'human',
  // Resume language follows the language of the posting, never the reverse.
  resumeByLanguage: { en: 'cv.pdf', de: 'cv-de.pdf' },
  followUpAfterDays: 14,
};
