# Candidate accounts created on ATS

Which accounts exist, under which identifier, and what they required. The next pass needs to know that a tenant demands an account, a verification mail, or a CAPTCHA.

⚠️⚠️ **NO PASSWORD IN THIS FILE, EVER, nor anywhere in the repo** (not in a digest, not in the tracker, not in a commit message). A generated password is handed to the candidate in the conversation and stored in their own password manager. This file only says that an account exists.

Authorisation: `RULES.agentMayCreateAccounts` in `profile/profile.mjs`. Scope of that authorisation:

- **Only to file an application** on an ATS that demands an account. No account on anything else.
- **Identity from `answers-bank.md`**, never the current employer's address. Keep one exact spelling of the email (some providers treat dotted and undotted forms as distinct accounts on the ATS side).
- **Prefer a magic link to « continue with LinkedIn »**: the social login ties the candidate account to the profile recruiters open, and grants rights to the ATS.
- A password is generated strong, **within the tenant's rules** (length windows are common, one enterprise suite caps at 18 characters, others forbid three identical characters in a row), and handed over in the conversation.
- **An image CAPTCHA at signup goes to the human.** Never bypass it.
- **An account that already exists with an unknown password**: the candidate decides (give it, sign in with a provider, or a reset). A reset changes the password of an account that belongs to them: never without explicit consent.
- ⚠️⚠️ **An account created is not an application sent.** Many tenants require an email verification before the application exists. The row in `applications.csv` stays `to_finish` until the verification link is followed AND an acknowledgment arrives.
- Log in the tracker row that the application needed an account.

## Accounts

| ATS / site | Identifier (email) | Created on | Verified | Required by | Notes (verification sender, CAPTCHA, pre-existing profile to re-read…) |
|---|---|---|---|---|---|
| | | | | | |

## Tenant notes

Per-tenant traps met while creating an account (a postback link that answers nothing, a verification sender, a password rule), one short section each.
