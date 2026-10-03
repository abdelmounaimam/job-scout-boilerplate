# Profile, everything the pipeline knows about the candidate

| File | What it is | Who reads it |
|---|---|---|
| `profile.mjs` | **the single tuning surface**: identity, target, stack, titles, geography, salary floor, intermediaries, LinkedIn axes, application rules, free-text writing rules, resume files, automation, mailbox, dashboard, sourcing angles | every tool, both workflows, every skill |
| `ruled-out.mjs` | companies closed **after reading a posting**, with the reason and the date | the LinkedIn triage, the ATS poller, the workflows |
| `experiences.md` | the experience canon, the original that the resume and the public profiles derive from | whoever tailors a resume or prepares an interview |
| `stories.md` | the story and fact catalogue, one stable id per row, each pointing at its source in the canon or the profile: **the only material a free-text output may use** | whoever writes a free text, and `evals/check.mjs`, which refuses an id that is not there |
| `cv/cv.tex` | the base resume (one `cv-<lang>.tex` per extra posting language) | `tools/cv-to-send.sh`, `tools/build-letter.sh` |
| `cv/letter.tex.tmpl` | the cover letter template, header filled from `CANDIDATE` | `tools/build-letter.sh` only |
| `cv/tailored/` | per-posting versions, named `cv-<company>-<lang>.pdf` / `letter-<company>-<lang>.pdf`; the `cv_version` column of the tracker points here | the form filling step |
| `cv/send/` | **gitignored**, one file only: the upload copy under `RESUME.uploadFileName` | the upload, and nothing else |

## The rule

**No candidate fact lives anywhere else.** If a script needs to know a preference, the preference belongs in `profile.mjs` and the script reads it (shell scripts through `node tools/setup/profile-get.mjs <PATH>`). A filter hardcoded in a tool is a filter that will be forgotten when the next thing changes.

## Free text draws on the catalogue, never on memory

Every free-text output is traced in `evals/records.jsonl` and checked by `evals/check.mjs` before the candidate sees it (spec in [`../evals/README.md`](../evals/README.md)). Its stories and facts come from `stories.md` and nowhere else: a story missing from the catalogue is added there first, with its source, and validated by the candidate. The candidate-specific inputs of the checks (dash rule, notice wordings, the blocklist that protects the current salary) are `WRITING` in `profile.mjs`.

## Resume language

The resume language follows the **language of the posting**, never the reverse, and never the candidate's preference. Map the files in `RESUME.byLanguage`.

## The uploaded file name

The file given to an upload field is **always** produced by `tools/cv-to-send.sh <lang|path>` and always carries `RESUME.uploadFileName` (`LASTNAME_FIRSTNAME_CV.pdf` style). Never rename the working files to get there: their distinct names are what the tracker's `cv_version` column traces.

## ⚠️ Check every resume visually before it is sent

After compiling (`cd profile/cv && xelatex cv.tex`, twice), render each page to an image and look at it. What to check: no experience entry has its bullets split across a page break, and no heading sits alone at the bottom of a page. The template protects against this and still breaks the moment content is added. **The visual check is the guarantee, not the template.**

```
pdftoppm -png -r 80 cv.pdf page    # then look at page-*.png, then delete them
```
