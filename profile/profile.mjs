// ============================================================================
// THE PROFILE — the single tuning surface of the whole pipeline.
//
// ⚠️ EXAMPLE VALUES until `CONFIGURED` is true. Every field below describes a
// fictional candidate so the tools run out of the box. The `job-scout-init`
// skill interviews the real candidate and rewrites this file; the SessionStart
// hook (tools/setup/check.mjs) keeps asking for that interview until it is done.
//
// Nothing else in the repo hardcodes candidate facts. If you find yourself
// editing a script to encode a preference, the preference belongs here.
//
// Read by: tools/linkedin/linkedin.mjs, tools/ats-watch/*.mjs,
//          tools/cv-to-send.sh (via tools/setup/profile-get.mjs), the dashboard,
//          both workflows, and every skill.
//
// Validate after any edit:  node tools/setup/validate.mjs
// ============================================================================

// Flipped to true by the init interview once every section below describes the
// real candidate. While false, the SessionStart hook asks for the interview.
export const CONFIGURED = false;

// --- Who ---------------------------------------------------------------------

export const CANDIDATE = {
  firstName: 'Example',
  lastName: 'Candidate',
  headline: 'Full-stack engineer, TypeScript',
  yearsExperience: 2,
  currentRole: 'Software Engineer at ExampleCorp',
  baseCity: 'Berlin',
  baseCountry: 'Germany',
  // The address used on applications. ⚠️ Never the current employer's address:
  // replies land there, and so does the evidence of the search.
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
  // Real notice period at the current job, as it stands TODAY. Recompute it
  // when tenure crosses a threshold: announcing a stale notice period in an
  // interview is a self-inflicted wound (the source pipeline once quoted three
  // months when the contract said two weeks).
  noticePeriod: '1 month',
};

// --- What ---------------------------------------------------------------------

export const TARGET = {
  // Job titles that ARE the role. Used to phrase searches, never to filter.
  titles: [
    'Software Engineer', 'Full Stack Engineer', 'Backend Engineer',
    'Product Engineer', 'Frontend Engineer', 'AI Engineer',
  ],
  // A title must contain one of these words to be looked at by the ATS poller
  // and discovery at all (they only see titles). Keep it broad.
  roleWords: ['engineer', 'developer', 'swe', 'software', 'développeur', 'entwickler'],
  // Seniority band, in years of experience REQUIRED by the posting body.
  // ≥ drop → hard exclusion. ≥ flag and < drop → comes through with a warning.
  years: { flag: 3, drop: 5 },
  // Salary floor, gross per year, in `currency`. A posting whose displayed
  // range TOPS OUT below this is dropped. No displayed range is a warning, and
  // ⚠️ the range may be written in PROSE in the body ("Package: 41k max") with
  // the structured field empty: the triage reads the body for that reason.
  salaryFloor: 60000,
  salaryTarget: [65000, 80000],
  currency: 'EUR',
  // Company tiers, best first. Used to rank, never to exclude.
  preferredTiers: [
    'frontier AI labs',
    'AI-native products',
    'big tech',
    'strong product scale-ups',
    'remote-first devtools',
  ],
  // The shape of the job, in one sentence, quoted in every agent prompt.
  // The source candidate's version: "a mid-level engineer in an already formed
  // team, no people management, no company to found, no filmed test".
  shape: 'An individual-contributor engineering role in an already formed team.',
};

// --- Stack --------------------------------------------------------------------

export const STACK = {
  // Signals looked for in the BODY of a posting. Word boundaries apply.
  // ⚠️ A tool name that is also a common word is NOT a signal: 'vite' was
  // removed in the source pipeline because it is an everyday French adverb
  // ("répondre vite") and let a mechanical-engineering agency through.
  positive: [
    'typescript', 'javascript', 'react', 'next.js', 'nextjs', 'node.js', 'nodejs',
    'nestjs', 'nest.js', 'express', 'remix', 'svelte', 'vue.js', 'vuejs',
    'graphql', 'tailwind', 'prisma', 'trpc', 'turborepo',
  ],
  // Stacks that close the job when they DOMINATE the body (negatives ≥ positives).
  // ⚠️ Word boundaries are mandatory: a naive includes('java') fires on
  // "javascript" and kills every good posting.
  negativeInBody: [
    'java', 'spring boot', 'spring framework', 'jakarta ee', 'j2ee', 'hibernate',
    'php', 'symfony', 'laravel', 'drupal', 'wordpress',
    '.net', 'dotnet', 'c#', 'asp.net', 'blazor', 'entity framework',
  ],
  // ⚠️ THE TITLE OVERRULES THE BODY. "Java Fullstack Developer" survived triage
  // in the source pipeline because the body also mentioned React. A closed
  // language in the title closes the job whatever the body's balance is.
  // ⚠️ And the reverse trap exists too: a title announcing the RIGHT stack
  // ("Node.js Fullstack / React") over a body that says "Java Spring,
  // mandatory". A good title never dispenses from reading the body.
  negativeInTitle: [
    'java', 'php', 'symfony', 'laravel', 'magento', 'drupal', 'wordpress',
    '.net', 'c#', 'asp.net', 'python', 'golang', 'go /', 'rust', 'ruby', 'rails',
    'scala', 'kotlin', 'c++', 'delphi', 'cobol', 'abap',
  ],
  // ⚠️ AN ENUMERATION OF ACCEPTED LANGUAGES IS NOT A REQUIRED STACK. "at least
  // one language SUCH AS Java, Python, C++, C#, Go, Rust, OR TypeScript" was
  // dropped as "dominant Java/C#" and cost a big-tech new-grad posting. A
  // negative whose every occurrence sits in a sentence carrying one of these
  // markers AND a positive is excused.
  enumerationMarkers: [
    'such as', 'one or more of', 'one of the following', 'at least one',
    'e.g', 'for example', 'like ', 'including',
    'tel que', 'telle que', 'tels que', 'par exemple', 'comme ', 'au moins un',
    'wie z.b', 'zum beispiel',
  ],
};

// --- Titles that place a posting outside the band ------------------------------
// ⚠️ All title lists are matched as SUBSTRINGS (lowercased) unless noted, and
// substring matching bites both ways: 'structure' would drop "Data
// Infrastructure", and 'solutions architect' does NOT cover the singular
// "Solution Architect". Test every addition on a real dump with `retriage`.

export const TITLE = {
  // Hard exclusion. Word-boundary match too, so "Software Engineer Intern"
  // (no trailing space) is caught without 'intern ' catching "Internal Tools".
  tooJunior: [
    'intern ', 'internship', 'trainee', 'apprentice', 'apprenticeship',
    'werkstudent', 'working student', 'praktikum', 'stage', 'stagiaire',
    'alternance', 'alternant', 'apprenti', 'contrat pro',
  ],
  // Hard exclusion, word-boundary match. The management and very-senior tier.
  // Set to [] to make lead roles a signal only.
  leadDrop: [
    'lead', 'tech lead', 'team lead', 'lead developer', 'lead dev',
    'principal', 'staff engineer', 'staff software engineer',
    'head of', 'director', 'vp', 'chief', 'cto',
    'engineering manager',
  ],
  // SIGNAL only on LinkedIn (the body is there to nuance: a "senior" title
  // whose body sets NO years floor is an open role in disguise, and those got
  // flagged ✔✔ instead of dropped). The ATS poller, which only has the title,
  // drops these outright.
  // ⚠️ Include the ABBREVIATIONS: "Sr Growth Engineer" sailed through a list
  // that only had 'senior'.
  tooSenior: [
    'senior', 'sr ', 'sr.', 'snr', 'lead', 'principal', 'staff', 'head of',
    'director', 'vp ', 'architect', 'expert', 'manager', 'chief', 'cto',
  ],
  // Adjacent functions that surface on the same keywords without being the job.
  // ⚠️ This list removes more noise than any other filter in the pipeline.
  // ⚠️ Since "no stack named" stopped being an exclusion (graduate programmes
  // name no technology on purpose), NON-SOFTWARE jobs also name no technology:
  // a cashier, a travel adviser and a mechanical engineer all passed as
  // "stack-agnostic" until their trades were listed here. Fixing it through the
  // BODY does not work: "development" also means business development. The
  // title is the only place these trades declare themselves.
  wrongFunction: [
    // quality, data, infra, security, support
    'qa ', 'q.a', 'quality assurance', 'quality engineer', 'test automation', 'sdet', 'tester',
    'data engineer', 'data scientist', 'data analyst', 'mlops', 'machine learning engineer',
    'research scientist', 'devops', 'sre ', 'site reliability', 'infrastructure engineer',
    'cloud engineer', 'platform engineer', 'sysadmin', 'network engineer',
    'security engineer', 'pentest', 'soc analyst', 'support engineer', 'technician', 'helpdesk',
    // product, project, sales, content
    'product owner', 'product manager', 'scrum master', 'business analyst',
    'project manager', 'consultant', 'account', 'commercial',
    'solutions engineer', 'solution engineer', 'sales engineer', 'business developer',
    'developer advocate', 'developer relations', 'technical writer', 'documentation engineer',
    'customer experience engineer', 'gtm engineer',
    'solutions architect', 'solution architect', 'ai strategist',
    // ⚠️ DO NOT exclude 'forward deployed engineer': it is a target title at
    // several AI labs, and it reads like a sales role but is not one.
    // platforms and niches
    'embedded', 'firmware', 'mobile developer', 'android', 'ios ',
    'magento', 'salesforce', 'sap ', 'sharepoint', 'dynamics',
    'game developer', 'game engineer', 'unity', 'unreal', 'game designer', 'gameplay',
    'cryptography', 'motion planning', 'computer vision', 'reinforcement learning',
    'hpc ', 'high performance computing', 'blockchain', 'smart contract',
    'data center', 'datacenter',
    // pure design (⚠️ NOT 'design engineer' nor bare 'designer': "Design
    // Engineer" is a real target title)
    'ux/ui designer', 'ui/ux designer', 'ux designer', 'ui designer',
    'graphic designer', 'motion designer',
    // logistics, retail, service
    'logistics', 'fulfilment', 'fulfillment', 'warehouse', 'supply chain',
    'customer service', 'retail', 'boutique', 'barista', 'banker',
    // non-software engineering (⚠️ NOT 'structure', NOT 'server')
    'mechanical', 'industrial engineer', 'process engineer', 'civil engineer',
    'aerospace engineer', 'hydraulic', 'thermal engineer', 'nuclear', 'chemical engineer',
  ],
};

// --- Where --------------------------------------------------------------------

export const GEO = {
  // The country name LinkedIn searches on (seoLocation). The real frontier is
  // usually the country, not a city: relocating inside it costs nothing.
  linkedinLocation: 'Germany',
  // Place names that mean "zero friction". Country first, then the cities that
  // appear in postings without the country name next to them.
  home: [
    'germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg',
    'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'leipzig',
  ],
  // Regions whose name INCLUDES home. A posting saying only "Europe" is
  // plausible; a posting saying "Remote - US" is not.
  inclusiveRegions: ['emea', 'europe', 'european', 'worldwide', 'global', 'anywhere'],
  // Remote acceptable at all?
  remoteOk: true,
  // Relocation inside the home country is not a cost. ⚠️ Never score "no
  // relocation needed" as a bonus: it silently over-ranks weak local postings.
  // Price the expensive city into the salary band instead.
  relocationWithinCountryOk: true,
  // Abroad = full immigration, months of runway. The floor is raised there, it
  // is not the same job at the same money. null = abroad is never considered.
  salaryFloorAbroad: 70000,
  notes: 'Anywhere in the EU is administratively cheap. Non-EU needs sponsorship '
    + 'and 2 to 3 months, so it must clear the raised floor to be rational.',
};

// --- Intermediaries: agencies, body shops, consultancies -----------------------
// The motive is the business model (placement at a client), not the size.

export const INTERMEDIARY = {
  // Names, matched as substrings of the normalised company name. This list
  // never catches them all: they are born faster than they are listed. It is
  // the phrase detector below that does the real work.
  names: [
    // global staffing and consulting
    'randstad', 'hays', 'michael page', 'page personnel', 'adecco', 'manpower',
    'robert half', 'robert walters', 'harvey nash', 'nigel frank',
    'frank recruitment', 'washington frank', 'darwin recruitment', 'austin fraser',
    'accenture', 'capgemini', 'atos', 'sopra steria', 'cognizant', 'infosys',
    'wipro', 'tata consultancy', 'hcl technologies', 'ntt data', 'devoteam',
    'deloitte', 'kpmg', 'pwc', 'mazars', 'jobgether', 'talent.io', 'hired',
    // add the local body shops of the candidate's market here (the init
    // interview proposes a list per country; France alone needed ~120 names)
  ],
  // ⚠️ SINGULAR IS THE SIGNAL. "our client" means the company you would be
  // placed at, so it is staffing. "our clients" plural is ordinary SaaS
  // vocabulary for "our users": putting it in hard exclusions wrongly killed
  // two real product companies. Plural = flag only.
  // ⚠️ "one of our clients" is a singular disguised as a plural: ONE client.
  // ⚠️ Recruiters who never say "client" still say they recruit FOR another
  // company: "we're working with a fast-growing…", "is hiring for a…".
  // ⚠️ APOSTROPHES: every phrase with one must exist with the straight (') AND
  // the typographic (’) apostrophe. Word-processed English postings use the
  // typographic one and slipped through a straight-only list.
  // ⚠️ NEVER add a headcount rule to catch 2-to-5-person agencies: it would
  // also drop real five-person startups.
  strongPhrases: [
    'our client ', 'on behalf of our client', 'for our client', 'one of our clients',
    'hiring for a client', 'client of ours', 'on behalf of a',
    'recruitment agency', 'staffing agency', 'recruitment consultancy',
    'headhunting', 'executive search', 'contract staffing', 'body leasing',
    'we recruit for', 'placed with one of our clients',
    'we are working with', "we're working with", 'we’re working with',
    'we are currently recruiting', "we're currently recruiting", 'we’re currently recruiting',
    'recruiting for a', 'is hiring for a', 'for a fast-growing', 'for a profitable',
    // French
    'notre client', 'pour le compte de', 'cabinet de recrutement', 'nous recrutons pour',
    'en régie', 'mise à disposition chez', 'chez nos clients', 'portage salarial',
    'chasse de tête', 'mon client final',
  ],
  weakPhrases: ['our clients', 'our consultants', 'nos clients', 'nos consultants'],
};

// --- Junior-friendly wording ---------------------------------------------------
// The strongest single predictor in the whole pipeline. In a market where
// almost every posting asks for 3 to 5 years, an explicit opening to a first
// experience is worth more than five matching framework names.
export const JUNIOR_OPEN = [
  'first experience', 'early career', 'new grad', 'new graduate',
  'recent graduate', 'graduate program', 'entry level',
  'no minimum years', 'no years of experience', 'we hire for potential',
  '1+ year', '1+ years', '2+ years', '0-2 years', '1-3 years', '2-3 years',
  'première expérience', 'jeune diplômé', 'début de carrière', '1 à 3 ans',
];

// --- Management scope ----------------------------------------------------------
// IC title, manager responsibilities (the "Founding Engineer" whose body asks
// to hire, onboard, and run contractors). A signal and a penalty, never an
// exclusion.
export const MANAGEMENT_SCOPE = [
  'lead the engineering team', 'manage the engineering team', 'build the team',
  'hire and grow', 'grow the team', 'manage a team of', 'own the roadmap for the team',
  'line management', 'people management', 'mentor and support mid-level and junior',
  'encadrer l\'équipe', 'diriger l\'équipe', 'contribuant au recrutement',
];

// --- LinkedIn (optional source) --------------------------------------------------
// Read-only client on LinkedIn's internal API. Needs a Chrome the agent can
// attach to, with the candidate logged in, for `auth` only. Everything else
// runs from the cached cookie. Set enabled: false to skip it entirely.

export const LINKEDIN = {
  enabled: true,
  // Filters applied to every axis. Raw API values (see tools/linkedin/vocab.mjs).
  base: {
    // ⚠️⚠️ The most expensive trap of the client: this filter cuts SERVER-SIDE.
    // A posting LinkedIn mislabels ("Mid-Senior" on a new-grad SDE-I role) is
    // excluded before triage, at any pagination depth. The source pipeline
    // widened to Entry + Associate + Mid-Senior and let the title rules drop
    // the senior ones: volume triples, nothing good is lost server-side.
    experience: ['2', '3', '4'],
    timePostedRange: ['r604800'], // rolling week: one scan a week is enough
    jobType: ['F'],               // full time
    sortBy: ['DD'],               // most recent first
  },
  // One axis per search angle. LinkedIn does not return the same results for
  // "typescript" and "react typescript": crossing angles catches what one
  // keyword misses. Axes are de-duplicated by jobId BEFORE any detail request.
  //
  // ⚠️ PAGINATION DEPTH is measured, not guessed. A page is 25 postings, and
  // `pages` must cover the total announced WITH the base filters applied, not
  // the raw total ("software engineer": 1 469 unfiltered, 69 filtered).
  // Measure with: node tools/linkedin/linkedin.mjs search -k "<kw>" -x entry,associate,mid-senior -p week -t fulltime --pages 1
  //
  // An axis may override the experience band (`experience: null` = no level
  // filter) and may target a COMPANY instead of keywords (`company: ['<id>']`,
  // resolve ids with `linkedin.mjs companies -k "<name>"`). Company axes exist
  // because LinkedIn's semantic ranking buries some employers' postings under
  // every generic keyword: the company facet is exact.
  axes: [
    { label: 'swe-en', keywords: 'software engineer', pages: 9 },
    { label: 'typescript', keywords: 'typescript', pages: 8 },
    { label: 'react', keywords: 'react typescript', pages: 5 },
    { label: 'node', keywords: 'node.js', pages: 4 },
    { label: 'fullstack', keywords: 'full stack engineer', pages: 5 },
    { label: 'backend', keywords: 'backend engineer', pages: 4 },
    { label: 'frontend', keywords: 'frontend engineer', pages: 4 },
    { label: 'product-engineer', keywords: 'product engineer', pages: 1 },
    { label: 'applied-ai', keywords: 'applied AI engineer', pages: 1 },
    // Graduate programmes: the family a level filter massacres. Keywords that
    // pin the level in the TEXT let the level filter go without volume blowing up.
    { label: 'new-grad', keywords: 'new grad software engineer', pages: 1, experience: null },
    { label: 'early-career', keywords: 'early career software engineer', pages: 1, experience: null },
    // { label: 'co-examplecorp', company: ['1234567'], pages: 2, experience: null },
  ],
  // Detail requests per scan (one request each, ~2 s with human pacing). ⚠️
  // This budget is RAISED, never lowered: a scan that does not read bodies is
  // useless, and a saturated budget silently decides what gets read. To save
  // requests, trim the pages of broad axes instead.
  detailBudget: 700,
  // The "recommended for you" feed (it is ordinary searches built from the
  // account's declared preferences, re-read at every run). A different angle,
  // not a duplicate of the scan.
  recommended: true,
};

// --- Application rules ----------------------------------------------------------

export const RULES = {
  // One application per company, even when several reqs match. Several at the
  // same employer read as spam, and each one spends the only cartridge there.
  oneApplicationPerCompany: true,
  // No cap on parallel applications: send on every qualified posting. What this
  // does NOT relax is reading the body first, and tailoring.
  maxParallelApplications: null,
  // Who presses Submit outside LinkedIn: 'agent' or 'human'. Sober filling
  // either way (one action per call, pauses, never two attempts on the same
  // widget, one send click). One ATS flagged an agent-driven submission as
  // possible spam: keep 'human' on priority targets if unsure.
  submittedBy: 'agent',
  // LinkedIn Easy Apply is ALWAYS clicked by the human. The client stays read
  // only: the submit endpoint is the most watched write of the site, and the
  // account at risk is the profile recruiters open after every application.
  easyApplyByHuman: true,
  // The agent may create candidate accounts in the candidate's name when an ATS
  // demands one to apply. Magic link preferred over "continue with LinkedIn".
  // Passwords are handed over in chat, NEVER written in the repo.
  // ⚠️ An account created is not an application sent.
  agentMayCreateAccounts: true,
  // Chasers. 'never' = an application is sent once, full stop (the source
  // candidate's decision). Answering an incoming mail or moving an engaged
  // process forward is never a chaser. Otherwise a number of days.
  followUps: 'never',
  // Hard exclusions on the FORM, decided by the candidate.
  // ⚠️ They hide in the form, not the posting: check the form's questions
  // BEFORE filling anything (work lost once: every field filled, then two
  // mandatory video fields appeared).
  refuseVideoAnswers: true,
  // Employee contracts only: no contractor, no "full-time contractor", no
  // freelance through an EOR the candidate pays for. "Remote EU" says where you
  // work, never under which contract: the vehicle hides in the form's
  // questions ("Full-time Employee (Spain residents only)" vs "Contractor").
  employeeOnly: true,
  // Founding / member-of-technical-staff roles in teams under ~5 people.
  excludeFoundingTinyTeams: true,
  // Never give the current salary. Answer with the expectation.
  neverDiscloseCurrentSalary: true,
  // Write a cover letter on postings in these languages (a French posting
  // refused in 7 hours with the letter field empty).
  coverLetterLanguages: ['fr', 'de'],
  // Every outbound message (mail, reply, chat, form free-text sent by mail) is
  // shown to the candidate as final text and waits for an explicit "send".
  outboundNeedsApproval: true,
};

// --- Resume files ------------------------------------------------------------------

export const RESUME = {
  // One base resume per posting language. The language of the resume FOLLOWS
  // the language of the posting, never the reverse. Paths relative to repo root.
  byLanguage: { en: 'profile/cv/cv.pdf', de: 'profile/cv/cv-de.pdf' },
  // ⚠️ The uploaded file ALWAYS carries this name, whatever the language or the
  // version. `cv.pdf` drowns among a hundred `cv.pdf`, and `cv-acme-fr.pdf`
  // tells the recruiter it was tailored for someone else. The working files
  // keep distinct names (cv_version in applications.csv traces them): the
  // upload copy is made apart by tools/cv-to-send.sh.
  uploadFileName: 'CANDIDATE_EXAMPLE_CV.pdf',
  // LaTeX sources compiled with xelatex, visual check mandatory after each build.
  latex: true,
};

// --- Automation around the scripts -------------------------------------------------

export const AUTOMATION = {
  // What interprets the digests when a scan script ends: 'none' (the session
  // does it, the default), 'codex' (`codex exec`, data passed on STDIN), or
  // 'claude' (`claude -p`).
  // ⚠️ If the Claude Code account is an EMPLOYER seat, never 'claude': a job
  // search running on it leaves a trace on the current employer's account.
  llmDelegate: 'none',
  // Scans run by hand. Do not schedule them (cron, CronCreate, systemd timers)
  // unless the candidate asks.
  scheduled: false,
};

// --- Mailbox --------------------------------------------------------------------

export const MAIL = {
  // How the agent reads the inbox, in plain words. The inbox review is done IN
  // CONTEXT by the agent, never by a pattern-matching script (one missed an
  // interview invitation, a big-tech rejection and every accented company name
  // in the same afternoon).
  access: 'Gmail through Composio (GMAIL_FETCH_EMAILS, GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID)',
};

// --- Dashboard ---------------------------------------------------------------------

export const DASHBOARD = {
  enabled: true,
  title: 'Applications',
  locale: 'en-GB',
  // Deployed behind HTTP Basic auth. The password lives in the host's
  // environment (DASHBOARD_PASSWORD), never here. Railway ids live in .env.
  basicAuthUser: 'candidate',
};

// --- Sourcing ------------------------------------------------------------------
// Feeds the bootstrap and web-search workflows. These are angles of attack on
// the open web, not a list of companies: the list of companies is the OUTPUT.

export const SOURCING = {
  // Job boards and aggregators worth sweeping in this market.
  aggregators: [
    'LinkedIn Jobs', 'Indeed', 'Glassdoor', 'Otta', 'Wellfound',
    'StepStone', 'Xing', 'Honeypot', 'Talent.io',
  ],
  // Remote-first boards. ⚠️ Most "remote" postings there are US-only.
  remoteBoards: ['RemoteOK', 'We Work Remotely', 'Himalayas', 'Remotive', 'NoDesk'],
  // VC portfolio boards: the cheapest way to find funded companies that appear
  // on no aggregator at all. ⚠️ The Y Combinator board serves DEAD postings
  // with no visible date: read `datePosted` in the page's JSON-LD, then use the
  // company's own board only.
  vcPortfolios: [
    'Index Ventures', 'Accel', 'Balderton', 'Point Nine', 'Cherry Ventures',
    'HV Capital', 'Earlybird', 'Y Combinator (Work at a Startup)',
    'Entrepreneur First',
  ],
  // Funding-news sources. A raise is followed by a hiring wave, and at that
  // moment the roles are on no aggregator yet.
  fundingNews: ['Sifted', 'TechCrunch EU', 'EU-Startups', 'Handelsblatt Tech'],
  // Named employers with no public board API, checked by hand by the web workflow.
  noPublicBoard: [],
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
