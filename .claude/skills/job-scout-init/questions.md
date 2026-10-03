# Question bank for the init interview

Ready-to-use `AskUserQuestion` payloads, round by round. Adapt the option wording to the candidate (their years of experience, their market) before asking. Recommended option first. Maximum 4 questions per call, 2 to 4 options each; "Other" is always added by the tool, so never add it.

Free-text rounds are listed as plain prompts.

---

## Round 0: materials (free text)

> Before the questions: do you have a resume I can read (PDF or LaTeX path)? A LinkedIn export, a portfolio, past cover letters? I will read them first and only ask what they do not answer. Also: will this repo live on GitHub? It will hold personal data, so it must be private.

## Round 1: identity (free text, prefilled)

> Here is what I read from your resume: <name, headline, years, current role, city, country, email, phone, links>. Please correct anything wrong, and give me:
> 1. The email to use on applications. Never your current employer's address.
> 2. Your right to work, country by country, in your own words.
> 3. Your notice period as your contract states it today (please check the contract, it often changed with tenure).
> 4. Should your current employer stay unaware of the search?

## Round 2: target

```json
{ "questions": [
  { "header": "Seniority", "question": "Postings state the years they require. Which band should the triage apply?", "multiSelect": false,
    "options": [
      { "label": "Drop 5+, flag 3-4 (Recommended)", "description": "Fits 1 to 3 years of experience: a 5-year floor is a real wall, 3 to 4 is worth reading." },
      { "label": "Drop 4+, flag 3", "description": "Stricter: only postings open to early careers." },
      { "label": "Drop 7+, flag 5", "description": "For 4 to 6 years of experience." },
      { "label": "No years filter", "description": "Everything comes through, the years are only shown." } ] },
  { "header": "Tiers", "question": "Which company types do you prefer, best first? (ranking only, nothing is excluded)", "multiSelect": true,
    "options": [
      { "label": "AI labs and AI-native", "description": "Frontier labs, AI-first products." },
      { "label": "Big tech", "description": "Large engineering sites in your market." },
      { "label": "Product scale-ups", "description": "Funded product companies, series B and later." },
      { "label": "Early startups", "description": "Seed and series A." } ] }
] }
```

Then free text: target titles (propose a list), the shape of the job in one sentence.

## Round 3: stack

```json
{ "questions": [
  { "header": "Closed stacks", "question": "Which stacks close a job when they dominate the posting?", "multiSelect": true,
    "options": [
      { "label": "Java / JVM", "description": "java, spring boot, hibernate, jakarta ee, kotlin in the title" },
      { "label": "PHP", "description": "php, symfony, laravel, drupal, wordpress, magento" },
      { "label": ".NET / C#", "description": ".net, dotnet, c#, asp.net, blazor, entity framework" },
      { "label": "Python-only back end", "description": "python in the title, django or flask as the core" } ] },
  { "header": "More stacks", "question": "Any of these too?", "multiSelect": true,
    "options": [
      { "label": "Go", "description": "golang in the title" },
      { "label": "Ruby / Rails", "description": "ruby, rails" },
      { "label": "Scala", "description": "scala" },
      { "label": "C++ / Rust", "description": "c++, rust" } ] },
  { "header": "Not the job", "question": "Which adjacent functions are NOT your job? They surface on the same keywords.", "multiSelect": true,
    "options": [
      { "label": "QA and testing", "description": "qa, quality assurance, test automation, sdet" },
      { "label": "Data and ML", "description": "data engineer/scientist/analyst, mlops, ML engineer, research scientist" },
      { "label": "Infra, SRE, security", "description": "devops, sre, platform, cloud, network, security, sysadmin" },
      { "label": "Product, sales, support", "description": "product owner/manager, solutions/sales engineer, devrel, support" } ] },
  { "header": "Niches", "question": "And these niches?", "multiSelect": true,
    "options": [
      { "label": "Mobile and embedded", "description": "android, ios, embedded, firmware" },
      { "label": "Games", "description": "game developer, unity, unreal" },
      { "label": "Enterprise platforms", "description": "salesforce, sap, sharepoint, dynamics, magento" },
      { "label": "Crypto and research niches", "description": "blockchain, smart contract, computer vision, reinforcement learning, hpc" } ] }
] }
```

Non-software trades (logistics, retail, mechanical and process engineering) are always excluded: they name no technology and would otherwise pass as "stack-agnostic".

## Round 4: geography

```json
{ "questions": [
  { "header": "Frontier", "question": "Where can you work without friction?", "multiSelect": false,
    "options": [
      { "label": "My country, any city (Recommended)", "description": "Relocating inside the country is not a cost: the city is priced into the salary instead." },
      { "label": "Only some cities", "description": "You will list them." },
      { "label": "My country plus regional remote", "description": "Remote roles employable from your country, e.g. EU-wide." },
      { "label": "Anywhere that sponsors", "description": "Abroad is a real option, at a raised floor." } ] },
  { "header": "Remote", "question": "Is fully remote acceptable?", "multiSelect": false,
    "options": [
      { "label": "Yes (Recommended)", "description": "Only when the BODY says your country is employable, never on a badge." },
      { "label": "No", "description": "On-site or hybrid only." } ] },
  { "header": "Abroad", "question": "Postings abroad (immigration, 2 to 3 months, relocation costs)?", "multiSelect": false,
    "options": [
      { "label": "Raised floor (Recommended)", "description": "Considered only above a higher salary you will give." },
      { "label": "Never", "description": "Always dropped." },
      { "label": "Same floor", "description": "Treated like home." } ] }
] }
```

## Round 5: money (free text)

> Currency, and your floor: the gross yearly figure below which you walk away. Then the range you will actually ask for. The floor is not the ask. Your current salary is optional and only for calibration: it is never written in the profile and never given to a recruiter.

## Round 6: rules (two calls)

```json
{ "questions": [
  { "header": "Agencies", "question": "Recruitment agencies, body shops and consultancies placing you at a client?", "multiSelect": false,
    "options": [
      { "label": "Hard exclusion (Recommended)", "description": "Detected by name and by phrases like 'our client' (singular)." },
      { "label": "Flag only", "description": "They come through with a warning." } ] },
  { "header": "Video", "question": "Forms that require a recorded video answer?", "multiSelect": false,
    "options": [
      { "label": "Refuse (Recommended)", "description": "The posting is dropped. The form is checked for video fields BEFORE anything is filled." },
      { "label": "Accept", "description": "You record them yourself." } ] },
  { "header": "Lead roles", "question": "Lead, staff, principal, head of, manager titles?", "multiSelect": false,
    "options": [
      { "label": "Hard exclusion", "description": "Dropped on the title. A form can still requalify a role as lead: forms are read first." },
      { "label": "Signal only", "description": "They come through with a warning." } ] },
  { "header": "Founding", "question": "Founding engineer or member of technical staff in a team under about 5 people?", "multiSelect": false,
    "options": [
      { "label": "Exclude", "description": "Full ownership of front, back and infra from day one." },
      { "label": "Keep", "description": "Judged case by case." } ] }
] }
```

```json
{ "questions": [
  { "header": "Contract", "question": "Which contracts are acceptable?", "multiSelect": false,
    "options": [
      { "label": "Employee only (Recommended)", "description": "No contractor, no EOR you pay for. 'Remote EU' says where, never under which contract: the form's questions tell." },
      { "label": "Contractor OK", "description": "The floor then has to cover social charges and no unemployment rights." } ] },
  { "header": "Submit", "question": "Outside LinkedIn, who presses Submit?", "multiSelect": false,
    "options": [
      { "label": "The agent, soberly", "description": "One action per call, one send click, then the mailbox confirms." },
      { "label": "Always me", "description": "The agent fills and re-reads, you click." } ] },
  { "header": "Accounts", "question": "May the agent create candidate accounts in your name when an ATS demands one?", "multiSelect": false,
    "options": [
      { "label": "Yes (Recommended)", "description": "Magic link preferred over LinkedIn login. Passwords given to you in chat, never written in the repo." },
      { "label": "Ask me each time", "description": "The agent stops at the account wall." } ] },
  { "header": "Follow-ups", "question": "Chasing applications that got no answer?", "multiSelect": false,
    "options": [
      { "label": "Never (Recommended)", "description": "An application is sent once. Answering a mail or moving an engaged process is not chasing." },
      { "label": "After 14 days", "description": "One polite chaser, then nothing." } ] }
] }
```

## Round 7: languages

```json
{ "questions": [
  { "header": "Languages", "question": "Which languages are postings in your market written in?", "multiSelect": true,
    "options": [
      { "label": "English", "description": "One English resume." },
      { "label": "French", "description": "One French resume, and a cover letter on French postings." },
      { "label": "German", "description": "One German resume." },
      { "label": "Spanish", "description": "One Spanish resume." } ] },
  { "header": "Resume source", "question": "How are your resumes produced?", "multiSelect": false,
    "options": [
      { "label": "LaTeX in this repo (Recommended)", "description": "Built from profile/cv/cv.tex, one per language, checked visually." },
      { "label": "Existing PDFs", "description": "You drop them in profile/cv/." } ] }
] }
```

Then free text: cover-letter languages, confirm the upload name `LASTNAME_FIRSTNAME_CV.pdf`.

## Round 8: sources

```json
{ "questions": [
  { "header": "LinkedIn", "question": "Use the read-only LinkedIn client?", "multiSelect": false,
    "options": [
      { "label": "Yes (Recommended)", "description": "Wide coverage, low ceiling. Needs Chrome with you logged in, once, for auth." },
      { "label": "No", "description": "Public ATS boards and the web only." } ] },
  { "header": "Web sweep", "question": "How often should the multi-agent web search run?", "multiSelect": false,
    "options": [
      { "label": "Weekly (Recommended)", "description": "It finds companies the poller cannot see. Costs tokens." },
      { "label": "On demand", "description": "Only when you ask." } ] }
] }
```

## Round 9: mailbox

```json
{ "questions": [
  { "header": "Mailbox", "question": "How can the agent read your inbox for replies?", "multiSelect": false,
    "options": [
      { "label": "Gmail via Composio", "description": "GMAIL_FETCH_EMAILS then full message fetch." },
      { "label": "A Gmail MCP server", "description": "Whatever mail tool is connected to Claude Code." },
      { "label": "Another mail tool", "description": "You will describe it." },
      { "label": "None", "description": "You paste the relevant mails yourself." } ] }
] }
```

## Round 10: dashboard

```json
{ "questions": [
  { "header": "Dashboard", "question": "The applications dashboard (funnel, pace, sources, bands)?", "multiSelect": false,
    "options": [
      { "label": "Local only (Recommended)", "description": "bun dev in dashboard/, reloads when the tracker changes." },
      { "label": "Railway, password protected", "description": "Deployed after every tracker write, HTTP Basic auth mandatory." },
      { "label": "None", "description": "The CSV is enough." } ] }
] }
```

## Round 11: automation

```json
{ "questions": [
  { "header": "Interpreter", "question": "When a scan script ends, what reads the output?", "multiSelect": false,
    "options": [
      { "label": "Nothing, in session (Recommended)", "description": "You open a session and the agent reads the digests." },
      { "label": "Codex", "description": "codex exec on a personal subscription, data passed on stdin." },
      { "label": "Claude CLI", "description": "claude -p. Never on an employer seat." } ] },
  { "header": "Employer seat", "question": "Is your Claude Code account paid by your current employer?", "multiSelect": false,
    "options": [
      { "label": "No, it is mine", "description": "No constraint." },
      { "label": "Yes, employer seat", "description": "Then no automation runs on it: a job search would leave a trace there." } ] },
  { "header": "Schedule", "question": "Should scans run on a schedule?", "multiSelect": false,
    "options": [
      { "label": "By hand (Recommended)", "description": "You say 'scan' when you want one." },
      { "label": "Scheduled", "description": "Installed only after a first manual run worked." } ] }
] }
```

## Round 12: free-text writing

```json
{ "questions": [
  { "header": "Dashes", "question": "Should the checks refuse a dash used as punctuation (—, –, or a spaced hyphen) in your application texts?", "multiSelect": false,
    "options": [
      { "label": "Yes, refuse them (Recommended)", "description": "Recruiters increasingly read the em dash as a sign of generated text. Hyphens inside words still pass." },
      { "label": "No, I write with dashes", "description": "The check is turned off; every other check stays." } ] },
  { "header": "Scoring", "question": "Where will you score the texts the agent writes for you?", "multiSelect": false,
    "options": [
      { "label": "In the dashboard (Recommended)", "description": "Evaluations tab, six axes from 1 to 5, a comment, your own version. Needs the server running (deployed, or bun server.ts locally)." },
      { "label": "In the conversation only", "description": "You correct the drafts; the draft/final diff in evals/records.jsonl is still recorded and still teaches." } ] }
] }
```

Then free text: the notice period as each posting language writes it, and every written form of the current compensation (turned into `WRITING.forbiddenPatterns`, tested before writing).
