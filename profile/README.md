# Profile — everything the pipeline knows about the candidate

| File | What it is | Who reads it |
|---|---|---|
| `profile.mjs` | **the single tuning surface**: filters, stack, geography, salary floor, sourcing angles, rules | the poller, the discovery pass, every workflow prompt |
| `experiences.md` | the experience canon, the original that the resume and the public profiles derive from | whoever tailors a resume or prepares an interview |
| `cv/` | the resume, one file per language, plus `cv/tailored/` for per-posting versions | the form filling step |

## The rule

**No candidate fact lives anywhere else.** If a script needs to know a preference, the preference belongs in `profile.mjs` and the script reads it. A filter hardcoded in a tool is a filter that will be forgotten when the next thing changes.

## Resume language

The resume language follows the **language of the posting**, never the reverse, and never the candidate's preference. Map the files in `RULES.resumeByLanguage`.

## ⚠️ Check every resume visually before it is sent

After compiling, render each page to an image and look at it. What to check: no experience entry has its bullets split across a page break, and no heading sits alone at the bottom of a page. A template can protect against this and still break the moment content is added. **The visual check is the guarantee, not the template.**

```
pdftoppm -png -r 80 cv.pdf page    # then look at page-*.png, then delete them
```
