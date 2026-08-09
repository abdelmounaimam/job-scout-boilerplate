# ATS playbook — how to fill each kind of application form

> Recipes verified in real conditions, on real applications. This file is **candidate independent**: it describes platforms, not a person. Update it every time a new platform or a new trap is met, because a lesson left in a digest gets paid for twice.
>
> Prerequisite: a browser the agent can attach to. In this setup the human launches Chrome and the agent attaches over CDP; the browser is never launched from the agent's shell.

## Rules that hold on every platform

1. **Target the tab by its label before every command.** The browser is shared with normal human use: the active tab drifts, and a command lands on the wrong page. This has happened.
2. **Never trust element refs across commands.** They are invalidated by the smallest re-render. Use a label-based selector, or re-snapshot between actions.
3. **The visual is not proof.** Check every required field in the DOM (`value`, `checked`, `files.length`) right before submitting. A button can look selected while the underlying value was never registered.
4. **Upload the resume LAST.** Several ATS parse the resume to prefill and overwrite everything already typed.
5. **After a failed validation, reload and start over.** The form can be replaced by a server-rendered variant that loses the resume and the identity fields.
6. **The resume language follows the language of the posting.** Never the reverse.
7. **Log the application in `applications.csv` while filling it,** not afterwards, so nothing is lost if it jams.
8. **After any submit click, demand POSITIVE proof** before concluding anything, in this order: a POST in the network log, a success message on the page, then the mailbox.

---

## The three oracles, and which way each one points

This is the single most expensive lesson in the whole pipeline, learned by getting it wrong in both directions.

| Oracle | Proves a success | Proves a failure |
|---|---|---|
| The page | sometimes | **never** |
| The network log | **yes** (`POST → 200/204`) | **no** |
| The mailbox | **yes** | **yes** |

- **The page is not an oracle.** Several ATS close the application panel on a **successful** submission with no URL change, no thank-you text, and a form that is still filled in when reopened. Reading that as a failure and clicking Submit four more times is the natural mistake.
- **The network log is a POSITIVE oracle only.** A `POST → 200` proves the send. The **absence** of a POST proves nothing: the filter can miss the request, and the log can be cleared or truncated between the click and the read. One application was declared blocked on an empty network log and had in fact gone out, revealed by the confirmation email two hours later.
- **Only the mailbox settles the negative case.** Never re-click Submit on the strength of an empty network log. A duplicate application at a recruiter costs more than a send you can redo tomorrow.

---

## Anti-spam: how an application gets rejected as a bot

One ATS rejected a submission with **"Your application submission was flagged as possible spam"**. It never went out.

What caused it: many synthetic interactions on the same page — five different techniques on one combobox, several submit attempts, CDP mouse clicks, keyboard activation. The bot score climbed and the submission was blocked.

Three applications the same day, same platform:

| Filling style | Result |
|---|---|
| clean fill, one single submit through a normal click | ✅ first try |
| agent fills, **human clicks** the tricky widgets and Submit | ✅ sent |
| fill plus many synthetic retries, submit through focus + Enter | ❌ **flagged as spam** |

**Rules that follow, and they are cheap:**
- **Never retry a submission in a loop.** If the first send does not go through, stop and hand over. Every synthetic attempt makes the score worse.
- **Never fight a stubborn widget.** Two attempts maximum, then ask for a human click. Three seconds of a human's time unblocks what twenty minutes of scripting will not.
- **Sober filling.** One action per call, pauses between them, never two attempts on the same widget, one single submit click.
- The flag is **not permanent**: a later application on the same platform went through five days afterwards, with deliberately sober filling and a human pressing Submit.

---

## Ashby

`jobs.ashbyhq.com/<company>/<id>` · append `/application` to land straight on the form.

**Recipe**
1. Open `<url>/application`.
2. Fill text fields by visible label (`Full Name`, `Email`, `Phone Number`, `LinkedIn`, `Compensation Expectations`…).
3. Checkboxes and radios: click the `input` inside the `<label>` whose text starts with the right string.
4. **Resume last**, on the precise selector.
5. Verify the whole DOM, then click Submit.
6. Read the response: errors appear as "Your form needs corrections. Missing entry for required field: …".

**Traps, all verified**
- ⚠️ **There are TWO `input[type=file]`.** Index 0 is the "Autofill from resume" widget: dropping the resume there triggers a parse that **wipes name, email and salary expectation**. The real field is **`#_systemfield_resume`**. Always aim at that selector, never at `input[type=file]`.
- ⚠️ **One click per `eval` call.** Ticking several groups of checkboxes or radios inside a single `eval` registers only the **first** one. The DOM shows `checked = true` everywhere and the ATS still answers "Missing entry for required field". One call per click, with a pause.
- ⚠️ **Already-ticked but unregistered**: click to untick, then tick again, one call each. For a radio, go through another option and come back, otherwise no `change` event fires.
- ⚠️ **Ashby reveals required fields in WAVES.** It took three validation rounds on one form to discover fields absent from the initial mapping. Never conclude a form is complete before an accepted submission.
- ⚠️ **Inputs and textareas want opposite techniques.** For `input`, the React native setter updates the DOM but **not** the form state, and the submission is rejected with visually correct fields: use real events instead. For `textarea` it is the reverse, real typing fails and the native setter works:
  ```js
  const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  s.call(el, text); el.dispatchEvent(new Event('input',{bubbles:true}));
  ```
- ⚠️ **The Yes/No widget** is two presentational `<button>` plus a **hidden `input[type=checkbox]`** at `tabindex="-1"`. Clicking the buttons does nothing, by ref, by selector, by real CDP mouse or by keyboard. What works is `checkbox.click()` in `eval`, a real DOM click on the hidden input: **"Yes" is one click, "No" is TWO** (true then false). An untouched state is not "No", it is empty, so React must see the change.
  On some tenants this widget resists everything. Two attempts, then a human click.
- ⚠️ **Radios** yield to `document.getElementById(id).click()`, one call per button, aiming at the id of the `labeled-radio-N` and not the container. Ids look like `<question-uuid>_<group-uuid>-labeled-radio-<n>`. Map label to id through `label[for=...]` first, then verify `checked` group by group.
- ⚠️ **Ticking a checkbox can tick its NEIGHBOUR.** On a 22-checkbox group, 8 clicks produced 11 ticks; the three intruders were each immediately adjacent to a legitimately clicked box. This is not cosmetic: the application would have gone out claiming skills the candidate does not have.
  **Why the usual check misses it:** inside an Ashby group **all boxes share the same `id`**, so `input.labels[0].innerText` is ambiguous and can return a neighbour's label. Reading "by label" shows plausible names and hides the problem.
  **Reliable re-read, by DOM position:**
  ```js
  const block = [...document.querySelectorAll('[class*=fieldEntry]')][N];
  [...block.querySelectorAll('input[type=checkbox]')].map((c,i) => (c.checked?'[X] ':'[ ] ')+i);
  ```
  **Rule: after a checkbox group, COUNT.** If ticked boxes outnumber clicks emitted, re-read by position before sending. Unticking is clean: clicking an index touches no neighbour.
- ⚠️ **Location combobox**: write with the native setter, wait for suggestions, then `option.click()` in `eval`. **Scope the option search to the field** through `input.getAttribute('aria-controls')`: a global `querySelectorAll('[role=option]')` grabs the list of a date picker left open, and one such click silently overwrote a date.
  When typing is needed, press **Enter alone**, not ArrowDown then Enter: the first option is already highlighted, so ArrowDown moves down one and selects the wrong value. One such slip selected a Pacific territory instead of a European country.
  ⚠️ The absence of an asterisk in a label does not mean optional. A Location field that looked optional was required.
- ⚠️ There is an invisible reCAPTCHA (`g-recaptcha-response`) on these forms.
- ⚠️ **Read EVERY req on a board before choosing.** One company published 16 near-identical fullstack titles whose experience bars ranged from 2+ to 6+ years, invisible from the list. The public board API returns full descriptions for free: run a regex for `\d+\+? years?` before spending the single application that company gets.
- ⚠️ Some employers **cap applications** (one caps at 5 per 180 days across all roles). Check before spending one.
- ⚠️ A checkbox certifying that "I, the undersigned applicant, have personally completed this application", with dismissal as the stated consequence, **is an attestation only the candidate can make. The agent never ticks it,** even where the agent is otherwise allowed to submit.

---

## Greenhouse

`job-boards.greenhouse.io/<company>/jobs/<id>` (EU domain: `job-boards.eu.greenhouse.io`).
Stable ids: `#first_name`, `#last_name`, `#email`, `#phone`, `#country`, `#resume`, `#cover_letter`, `#cover_letter_text`, custom questions as `#question_<id>` (map labels through `label[for=...]`).

- ⚠️⚠️ **The first "Submit application" sends NOTHING.** It triggers an email containing an **8 character security code**, to be typed into eight separate fields `#security-input-0` … `#security-input-7`, then submitted again. In between the button goes `disabled` and **no message appears**: it looks exactly like a failure. Do not re-click, go read the mailbox. Success is the URL moving to `/confirmation`.
  Typing the code: focus `#security-input-0` then type the whole code, auto-advance fills the eight boxes.
- ⚠️ **The dropdowns are `react-select` whose input is 2 to 3 px wide.** No click ever reaches it, not by ref, not by selector, not by real CDP mouse. On some forms **nothing synthetic opens them at all**: `aria-expanded` stays `false` through focus + typing + Enter, through focus + ArrowDown, and through a direct click on the container. Worse, the only `[role=option]` elements in the DOM belong to the phone widget, which gives a convincing illusion that a list is open (Afghanistan +93, Åland Islands +358…).
  **What sometimes works**: `document.getElementById('<id>').focus()` in `eval`, then a real `ArrowDown` key press to open the menu, then typing to filter, then clicking `#react-select-<id>-option-N`. Read the options before choosing, never blind Enter.
  **When it does not: fill text, textareas and uploads, then hand over for the dropdowns and the send.** Three attempts maximum.
- ⚠️ **`cover_letter` is an `input[type=file]`, not a textarea,** on many tenants. A written letter has to be converted to PDF first.
- ⚠️ **Uploading the resume and clicking "Enter manually" for the letter re-render the form and WIPE every text field.** Correct order: dropdowns, then uploads, then the letter, and **text fields LAST**. Re-read everything before sending either way.
- ⚠️ After upload, the `input[type=file]` elements **disappear from the DOM**: `querySelectorAll('input[type=file]')` returns an empty list. The proof is the file name displayed in the page text.
- The plain-text cover letter accepts real input events. An `element.value = ...` assignment is reverted by React.

---

## Teamtailor

`<company>.teamtailor.com/jobs/<id>`, or a custom domain.

- **The form lives at `<posting-url>/applications/new`.** The "Apply" button on the posting page is unreliable: it exists in two copies, one `[disabled]` until the cookie banner is handled, and even after accepting, clicking it exposes no form in the DOM on some tenants. Going straight to `/applications/new` is the reliable path, not a workaround.
- Close the cookie banner **first**. It silently covers elements and disables buttons.
- ⚠️ **Two `input` elements share the SAME `name`, and one is hidden.** Teamtailor is Rails, and Rails renders a checkbox as a `hidden` input carrying `0` **placed first**, then the real visible box. So `document.querySelector('input[name="candidate[consent_given]"]')` systematically grabs **the hidden field**, where `click()` does nothing and `checked` stays false. Always filter on visibility, for **reading as well as writing**:
  ```js
  const real = [...document.querySelectorAll('input[name="candidate[consent_given]"]')]
    .find(i => i.offsetParent !== null);
  real.click();
  ```
  Tell-tale sign: the element found has `offsetParent === null`, no id, no class, and its siblings contain a second styled `INPUT` plus a `LABEL`.
- ⚠️ **The GDPR consent box yields only to a direct `input.click()` in `eval`.** A generic check helper reports success and leaves `checked=false`. Clicking the `label[for=...]` fails too, by double-toggling. And verify **by field name**, never by index: `querySelectorAll('input[type=checkbox]')[0]` lands on the cookie banner's own box and gives a false positive.
- ⚠️ **A field can be required by its LABEL and not by the DOM.** One submission was refused with **HTTP 422**, no usable error, no error class, because an Address field carried "Required" in its label text while its `required` attribute was `false`. It is a Google Places autocomplete: click the field, type real keystrokes, wait for the list, then ArrowDown + Enter. The selection fills nine hidden fields (`place_id`, `city`, `country`, `state`, `zip`, `lat`, `long`, `address`, `administrative_area`). Without them the server returns 422.
  **General rule: on a 422 with no message, look for fields whose LABEL says required, and ignore the DOM `required` attribute, which lies in both directions.**
- ⚠️ **The resume upload is a Dropzone: `input[type=file].files.length` reads 0 AFTER a successful upload.** The proof is the hidden text field holding the storage URL, plus the file name on screen.
- ⚠️ The panel is a fixed modal with its own scroll container: `scrollIntoView` scrolls the document, not the modal, so computed coordinates can land outside the panel and be read as an outside click that closes everything.
- ⚠️ The submit control is an **`<input type="submit">`** on some tenants, so a query filtered on `button` alone never finds it. Search `button, input[type=submit]`.
- **The page is not an oracle here** (see the oracle table). A successful send leaves the URL unchanged, shows no thank-you, and keeps every field filled. Settle it with `POST /applications → 200` in the network log, or the mailbox.
- Do not use "Apply with LinkedIn": it bypasses the tailored resume and the letter.

---

## Lever

`jobs.lever.co/<company>/<uuid>/apply`.

Fields: `resume` (`#resume-upload-input`), `name`, `email`, `phone`, `org`, `urls[LinkedIn]`, `urls[GitHub]`, `urls[Portfolio]`, optional `pronouns`, then free-text question cards `cards[<uuid>][field0]`, often **required**. Map each card to its question by walking up the DOM from the `textarea`: the uuid order is not guaranteed.

- ⚠️⚠️ **The location field is a 400-error trap.** The visible `#location-input` is a Google Places autocomplete and the real value goes into the hidden **`#selected-location`, which the server `JSON.parse`s**. Writing a plain string there fails the send with **HTTP 400** and `SyntaxError: Unexpected token 'L', "Lyon, France" is not valid JSON`. The field is optional: **leave it empty** and give the location in a free-text answer rather than guessing the Places schema.
- ⚠️ **A 400 empties the resume attachment** while keeping every text field. Re-check `#resume-upload-input.files.length` before any new click.
- ⚠️ The submit control is a `button[type="button"]` with class **`.template-btn-submit`**: a `button[type=submit]` query catches the cookie banner's hidden buttons instead. It is also **covered by the sticky header** when the page is scrolled to the bottom. Handle the cookie banner, scroll into view, then verify with `elementFromPoint` that the click point actually lands on the button.
- ⚠️ Some tenants add a drag-and-drop hCaptcha. Clicking Send shows no error when `h-captcha-response` is empty, which is exactly the "empty network log" trap described in the oracle table above.

---

## SmartRecruiters, Taleez and other regional ATS

- **Taleez** (`taleez.com/apply/<slug>/applying`): ⚠️⚠️ **double validation is mandatory.** `POST /api/public/apply → 200` is **not enough**: the page says "All you have to do is confirm your e-mail address!" and an email arrives. **Until its link is clicked the application is not received.** The only ATS met so far that requires a second gesture after the POST.
  Its four dropdowns render in a portal and yield to no synthetic click. They are **optional**: only the resume and identity are required. Two attempts, then move on. Side benefit: leaving "expected salary" empty avoids anchoring below the posted band.
- **Beetween** (`app.beetween.com/.../apply/job/<id>/<slug>`): a hash-route SPA where **the form does not exist in the DOM on load**. Click "Apply" first, the URL takes a `#apply` and the modal mounts. Fields are generated Vuetify ids with **no `name` attribute**: map through `label[for=<id>]` and re-check the ids every visit. Two buttons look alike, one opens the modal and one sends. A successful send returns **204 No Content**, the modal closes and nothing is displayed.

---

## Job boards that sit in front of an ATS

Several large job boards (the kind that host a company's postings under their own domain) share the same set of problems:

- ⚠️ **Applying requires an account on the board**, and the account's email is often **locked and `disabled`** in the form. Check which address that account uses: an application can otherwise go out from the **current employer's** address.
- ⚠️ A **terms-of-service modal** can block the page, with its dismiss button covered by the modal itself. That is a legal agreement: **the human clicks it**, not the agent.
- ⚠️ They are behind bot protection: 403 on any automated fetch, while displaying normally in a real browser. And search engines serve their **closed** URLs as if live. **Always revalidate against the underlying ATS**, and prefer applying on the company's own site where one exists: an application filed through a board is also harder to follow up.
- ⚠️ **A phone field can be a wrapper, not the input.** Clicking the wrapper moves focus onto the real generated input, after which typing works; filling the wrapper directly does not take.
- ⚠️ **Location autocompletes silently replace what was typed.** One typed a city and got the capital instead. Clear the field, retype, click the right suggestion, then re-read the value.
- ⚠️ **A summary popover can open over the form** and make every field inert: heights read 0 and values read empty although they are correctly filled. Close it before concluding anything.

---

## The transverse trap: focus

The single most repeated failure across every platform. **Typing goes to the element that has FOCUS, not to the selector aimed at**, and a click that misses its target leaves the focus somewhere else.

Real consequences observed: a city name typed into a phone field; an email typed into a name field; a 600 character note concatenated onto the end of a date field; a phone number written into a cover letter.

**Rule**: check `document.activeElement` right before typing, and **re-read the field right after**. On a multi-field form, re-read everything before sending. A fill on a field that is not visible writes into the previously focused field, every time.

---

## "Done" is not proof of a click

A click command answered **"✓ Done"** and **no POST was sent**: the command had matched an element carrying that text, a heading, not the `<button>`. The fields stayed filled, no error appeared, and nothing distinguished it from a blocked send.

**Reliable recipe**: get the real button by its exact `innerText` among `document.querySelectorAll('button')`, check it is visible and not `disabled`, then `scrollIntoView({block:'center'})` and `.click()` in the same `eval`. On one form the right button was the 4th visible one, the first three being "Upload file", an empty button and "Replace".

**A "Done" proves the command ran, not that it had an effect.**
