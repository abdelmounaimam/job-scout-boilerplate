# Interview preparation

One folder per company, opened the day a process starts (status `interview` in `applications/applications.csv`, marker `INTERVIEW OBTAINED` in its notes).

```
interview-prep/
  <company>/
    README.md                  the process at a glance, kept current
    YYYY-MM-DD-<stage>.md      one dated document per stage (recruiter screen, technical, system design, hiring manager, final)
    glassdoor.md               output of the Glassdoor brief (optional)
```

## When the invitation arrives

1. **Answer it first.** Every session starts with the inbox review; an invitation left unanswered costs a process. Set `WAITING FOR MY REPLY` in the tracker notes until the answer is sent, and show the candidate the exact reply before sending anything.
2. Create `<company>/README.md` with: the role and its link, the date applied and the `cv_version` sent, every stage announced (format, length, people, tools, what « no preparation needed » actually covers), dates and meeting links, and the contacts' names.
3. **Read the process the company publishes** (engineering blog, careers page, interview guide). Many publish exactly what they test.
4. **Run the Glassdoor brief** before any stage: `node tools/glassdoor/glassdoor.mjs brief "<company>" --out interview-prep/<company>/glassdoor.md`. It gives the salary grid with every percentile (not only the displayed band), the interview reports with **the questions actually asked**, and employee reviews. ⚠️ Chrome must run (`tools/browser/launch-chrome.sh`): Cloudflare blocks the direct mode after a dozen pages.

## For each stage

- One dated document: what the stage tests, the material to prepare, the drills, the questions to ask them.
- **Defend everything claimed in the application.** Re-read the exact resume version (`cv_version`) and the texts in `applications/cover-letters.md`. Any claim you cannot defend under a follow-up question is removed from the story now, not discovered live.
- Prepare stories that show alignment before execution and how feedback was integrated. Never invent a collective story to fit a feedback.
- **A weak point identified in advance is consolidated with margin, not in the last three days.** Illness or an unexpected event can cancel the whole last-minute window; a live implementation that stumbles on a known weak point costs the stage.
- Practice thinking aloud when the format says so.
- Logistics: the real notice period (`CANDIDATE.noticePeriod`), the salary expectation (never the current salary), availability.

## After each stage

- Write what happened the same day: questions asked, what went well, what did not, the self-diagnosis.
- On a rejection, record the reason given, and compare it to the self-diagnosis. A rejection that produces a rule goes into `CLAUDE.md` or `docs/LESSONS.md`.
- On a rejection at a late stage, add a cooldown to `profile/ruled-out.mjs` with its end date if re-applying too early would hurt.
- Moving an engaged process forward (an interview done, no news after the announced delay) is not a chaser.
