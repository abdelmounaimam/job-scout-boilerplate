# Agent rules — job search pipeline

> **Entry point: [`.claude/skills/job-scout/SKILL.md`](./.claude/skills/job-scout/SKILL.md).** It orchestrates the five phases (collect, triage, judge, apply, follow up) and points at every detail document. **Read it at the start of a session.**
>
> The watch runs in the system crontab through `tools/daily-scan.sh` and `tools/weekly-discover.sh`. Those scripts **collect only**: they call no LLM and **never apply to anything**. They write digests to disk; interpretation happens in a session.

## Source of truth

- **`profile/profile.mjs` is the single tuning surface.** Filters, stack, geography, salary floor, sourcing angles, application rules. If a script needs to know a preference, it reads it from there. A filter hardcoded in a tool is a filter that gets forgotten at the next change.
- **`profile/experiences.md` is the experience canon.** The public profiles are exact mirrors of it; the resume is a derivative. Any change to an experience starts in the canon and propagates, and an unpropagated change is written down as debt at the bottom of that file.

## Collection

- **Prefer the public ATS APIs over scraping.** They are public JSON: no browser, no cookie, nothing tied to an account, which is the only reason this can run unattended.
- **Adapters live in `tools/ats-watch/adapters.mjs`**, shared by the poller, the discovery pass and the probe tool. Adding an ATS is a one-file change, never a change in a caller.
- **Never guess a slug.** Verify it with `node tools/ats-watch/probe.mjs "Company Name"` before adding it to the watchlist. A wrong slug is indistinguishable from a company with no openings.
- ⚠️ **A slug that answers is not proof it is the right company.** Name collisions are real and have happened twice. Read the returned titles before trusting a slug.
- ⚠️ **SmartRecruiters identifiers are case sensitive**, and a wrongly-cased one returns an empty list rather than an error.
- ⚠️ **Workable rate-limits hard.** A run of zeros from it is a measurement artefact until re-checked slowly. The general rule beyond Workable: **a mass probe that returns zero gets re-measured at low speed before it is written down as a fact.**
- ⚠️ **Remote flags are wrong in both directions.** Postings marked remote have required five days on site; postings labelled with one country have been worldwide. **Only the body counts.**
- ⚠️ **A location field can be wrong by an ocean.** One posting listed in a tiny European village was on-site in Los Angeles: the geocoder had latched onto a real place name that is also a common word. Any improbable location gets verified in the body.
- ⚠️ **The title overrules the body on stack.** "Java Fullstack Developer" is closed even when the body also lists the right framework.

## Applying

- ⚠️ **Never automate a login-walled account's write endpoints.** Reading is one thing; a submit on a social or job-board account is the most watched endpoint there is, and the risk lands on the account itself, which is exactly the surface recruiters look at after every application.
- **Who presses Submit is set in `RULES.submittedBy` in `profile.mjs`.** `human` is the safe default. One ATS flagged an agent-driven submission as possible spam and it never went out.
- **Sober filling, always**: one action per call, pauses between them, never two attempts on the same widget, one single send click. Two attempts on a stubborn widget, then ask for a human click.
- **After any send, demand positive proof**: a POST in the network log, a success message, then the mailbox. **An empty network log proves nothing.** Never re-click on the strength of one.
- **One application per company.** Three at the same employer read as spam.
- **Never invent a story, never give the current salary, never tick an attestation on the candidate's behalf.**

## Outputs

- Watch digests: one CSV per scan in `digests/YYYY-MM-DD.csv`, plus a `-analysis.md` for what does not fit a table.
- Application tracking: `applications/applications.csv`, one row per application, written **while** filling the form.
- **Nothing disappears silently.** Every filtering step prints the count of drop reasons.
- Any reusable rule discovered goes back into this file or into `ats-playbook.md`. **A lesson left in a digest is paid for twice.**

## Style

- No dash used as punctuation in prose. Commas, colons, parentheses or a new sentence.
- Commit messages in the candidate's own voice, with no AI attribution trailer.
- ⚠️ **Nothing about this search belongs on an account owned by the current employer.** Not the LLM quota, not the browser profile, not the email address on an application.

## AGENTS.md

Every `CLAUDE.md` has an `AGENTS.md` **symlinked** to it, so other tools read exactly the same content with no risk of divergence. Never replace the symlink with a copy: mirror divergence is precisely the problem this pipeline fights everywhere else.
