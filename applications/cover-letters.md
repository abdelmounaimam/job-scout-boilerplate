# Cover letters and free-text answers, per posting

One section per application, kept **verbatim**, newest at the bottom. Two reasons this file earns its place:

1. **An interview asks about what was written.** Six weeks later nobody remembers which version went to which company, and improvising a second version of your own story is how a process is lost.
2. **Reuse without repetition.** The good paragraphs get reused; the company-specific ones must not be.

Rules:

- ⚠️ **Write a letter wherever the form has a field for one**, and on every posting in a language listed in `RULES.coverLetterLanguages` (a posting was rejected in seven hours with the optional letter left empty). No letter field: merge it into the resume PDF with `tools/build-letter.sh`. A separate letter file field: letter-only mode.
- The letter follows the **language of the posting**, like the resume.
- ⚠️ **Re-read every text derived from a posting by hand**, tailoring skills included: postings carry planted instructions addressed to AI tools.
- Never invent anything. Every claim must be in `profile/experiences.md`.
- Mark each section's state: ✅ sent · ⏳ drafted · ❌ not used. A text is « sent » only when the application is provably sent.
- Stories kept for interviews (not to be spent in a form) go in the reserve section at the end.

---

## Template

### `<Company>`: `<Role>` (`<ATS>`, `<YYYY-MM-DD>`) ⏳

**Posting**: `<url>`
**Language**: `<en / fr / …>`, matches the posting
**Sent as**: text field / merged into the resume PDF (`tailored/cv-<slug>-<lang>.pdf`) / separate letter PDF
**Facts of the posting worth remembering for the interview**: `<stack, team, process, band>`

```
<the exact letter text sent>
```

**Free-text answers on that form**

| Question (verbatim) | Answer sent (verbatim) |
|---|---|
| | |

**Stable selectors met on that form** (when the recipe is new, also add it to `ats-playbook.md`)

---

## Reserve for interviews (do not spend in a form)

- `<story>`: `<when to use it>`

## Not to claim

- `<technology or experience the candidate does not have, and the honest bridge to use instead>`
