import data from "@/data/applications.json";

export type Application = {
  id: number;
  date: string;
  company: string;
  role: string;
  source: string;
  sourceFamily: string;
  link: string;
  remote: string;
  salaryRaw: string;
  salary: { min: number; max: number; currency: string } | null;
  cv: string;
  status: Status;
  notes: string;
  /** Derived at build time from the note, because the status cannot say them.
   *  See the comments in scripts/build-data.mjs. */
  sent: boolean;
  interviewObtained: boolean;
  /** The company answered and is waiting for something from me. See
   *  MY_COURT_MARKER in build-data.mjs: not a chaser, a ball in my court. */
  myCourt: boolean;
};

export type Status = "offer" | "applied" | "interview" | "rejected" | "closed" | "to_finish" | "withdrawn";

export type Config = {
  title: string;
  locale: string;
  currency: string;
  salaryFloor: number | null;
  /** Days before a chaser is due, or null when the policy is "never chase". */
  followUps: number | null;
  /** True when built from dashboard/demo/ (DASHBOARD_DEMO=1): the sidebar says so. */
  demo?: boolean;
  /** Days added to the demo dates so the newest row is yesterday. */
  demoShiftDays?: number;
};

export const CONFIG = data.config as Config;
export const APPLICATIONS = (data.applications as Application[]).slice().sort((a, b) =>
  b.date.localeCompare(a.date),
);
export const GENERATED_AT = data.generatedAt as string;

/** Every status carries an icon AND a label: colour never carries the meaning
 *  alone. The dataviz skill's validator confirms it: these hues fail the
 *  separation thresholds when treated as a categorical palette.
 *
 *  `withdrawn` exists because its absence forced a lie: an application
 *  prepared then dropped by choice stayed in `to_finish`, so it showed as
 *  pending work in the Actions panel. It separates three different things:
 *  "not sent yet", "sent then rejected", and "decided not to send".
 *
 *  `offer` exists for the same reason: without it, a written offer stayed in
 *  `interview`, shown as a process still under way, and the most important
 *  outcome of the whole search appeared nowhere. Not to be confused with
 *  `closed`, which means the posting was taken down. */
export const STATUSES: Record<Status, { label: string; color: string; icon: string; help: string }> = {
  offer: { label: "Offer", color: "var(--st-good)", icon: "★", help: "Written offer received" },
  applied: { label: "Waiting", color: "var(--st-pending)", icon: "●", help: "Sent, no answer yet" },
  interview: { label: "Interview", color: "var(--st-good)", icon: "▲", help: "Process engaged" },
  to_finish: { label: "To finish", color: "var(--st-attention)", icon: "◆", help: "Form ready, not sent" },
  closed: { label: "Posting closed", color: "var(--st-serious)", icon: "■", help: "The role was cancelled, not a rejection of the profile" },
  rejected: { label: "Rejected", color: "var(--st-critical)", icon: "✕", help: "Negative answer received" },
  withdrawn: { label: "Withdrawn", color: "var(--st-neutral)", icon: "⊘", help: "Dropped by choice, never sent" },
};

export const STATUS_ORDER: Status[] = ["offer", "interview", "applied", "to_finish", "closed", "rejected", "withdrawn"];

/** Returns a status descriptor, with a fallback for an unknown status.
 *
 *  ⚠️⚠️ Born of a real incident: an orphan fragment of a note left in the CSV by
 *  a botched edit produced a phantom application whose `status` was a whole
 *  sentence. `STATUSES[c.status]` was then `undefined`, reading `.color` threw
 *  a TypeError at first render, and with no error boundary in the React tree the
 *  whole PAGE went blank: one CSV line switched the dashboard off.
 *
 *  The build now refuses such rows (see `scripts/build-data.mjs`), but a doubtful
 *  datum must NEVER be able to switch the page off: it must show as doubtful. */
export function statusOf(s: string) {
  return (
    STATUSES[s as Status] ?? {
      label: `Unknown status: ${s}`.slice(0, 40),
      color: "var(--st-neutral)",
      icon: "?",
      help: "Status missing from the CSV or malformed. Fix it in applications.csv.",
    }
  );
}

const DAY = 86_400_000;
export const TODAY = new Date().toISOString().slice(0, 10);

export function daysSince(iso: string) {
  return Math.floor((Date.parse(TODAY) - Date.parse(iso)) / DAY);
}

/** Money formatting follows the profile's locale and currency. */
export function money(n: number, currency = CONFIG.currency) {
  // ⚠️ Intl throws a RangeError on an invalid locale or currency code, and a
  // throw during render blanks the whole page. A typo in the profile must show
  // as a plain number, never switch the dashboard off.
  try {
    return new Intl.NumberFormat(CONFIG.locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n / 1000)}k ${currency}`;
  }
}

export function countByStatus(c: Application[]) {
  return STATUS_ORDER.map((s) => ({
    status: s,
    ...STATUSES[s],
    n: c.filter((x) => x.status === s).length,
  }));
}

/** Answers received on applications really sent.
 *  ⚠️ `to_finish` and `withdrawn` are out of the denominator: they did not go
 *  out, counting them would mechanically lower a rate they have nothing to do
 *  with.
 *  ⚠️ And a status filter is not enough: a `closed` row that was never
 *  applicable once made the tile say 72 sends when the truth was 71, and the
 *  funnel contradicted the tile on the same page. Hence `sent`, derived at
 *  build time, read by both. */
export function responseRate(c: Application[]) {
  const sent = c.filter((x) => x.sent);
  const answered = sent.filter((x) => x.status === "rejected" || x.status === "interview" || x.status === "offer" || x.status === "closed");
  return {
    sent: sent.length,
    answered: answered.length,
    rate: sent.length ? answered.length / sent.length : 0,
  };
}

export function perDay(c: Application[]) {
  const m = new Map<string, number>();
  for (const x of c) if (x.date) m.set(x.date, (m.get(x.date) ?? 0) + 1);
  const dates = [...m.keys()].sort();
  if (!dates.length) return [];
  const out: { date: string; n: number }[] = [];
  for (let t = Date.parse(dates[0]); t <= Date.parse(dates[dates.length - 1]); t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    out.push({ date: d, n: m.get(d) ?? 0 });
  }
  return out;
}

export function perSourceFamily(c: Application[]) {
  const m = new Map<string, { n: number; interviews: number }>();
  for (const x of c) {
    const e = m.get(x.sourceFamily) ?? { n: 0, interviews: 0 };
    e.n++;
    if (x.interviewObtained || x.status === "interview" || x.status === "offer") e.interviews++;
    m.set(x.sourceFamily, e);
  }
  return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n);
}

export function salaryRanges(c: Application[]) {
  return c
    .filter((x) => x.salary)
    .map((x) => ({ company: x.company, ...x.salary!, status: x.status }))
    .sort((a, b) => b.max - a.max);
}

/** Chasers due, ONLY when the profile sets a number of days. With the default
 *  policy ('never') this returns nothing and no block is shown: a page that
 *  offers chasers ends up sending them. */
export function chasersDue(c: Application[]) {
  if (CONFIG.followUps == null) return [];
  return c.filter(
    (x) => x.status === "applied" && x.sent && !x.interviewObtained && daysSince(x.date) >= CONFIG.followUps!,
  );
}

/** Beyond this number of days, a silence is no longer a wait, it is a rejection
 *  that was never written.
 *
 *  The threshold comes from the data of the search this was built for, not
 *  from a convention: three interview invitations out of four arrived within
 *  24 hours of the application, the fourth on day 10, and rejections on paper
 *  fell within 48 hours to 5 days. 21 days leaves twice the margin of the
 *  slowest case observed. Re-read it against YOUR data once some exists, and
 *  if an answer ever arrives later than this. */
export const SILENCE_DAYS = 21;

export type FunnelNode = {
  key: string;
  label: string;
  help: string;
  color: string;
  n: number;
  children: FunnelNode[];
};

/** The real funnel, from the CSV row to the last known state.
 *
 *  ⚠️ This is NOT a breakdown by status, and that is the whole point. A status
 *  carries only the last state: an application rejected after an interview is
 *  in `rejected`. Counting interviews by `status === "interview"` erases every
 *  conversion that ended badly. Hence `interviewObtained`, which keeps the stage
 *  reached and not only the outcome.
 *
 *  Each level is a PARTITION computed by a single classification, never by a
 *  series of independent filters: it is the only way to guarantee that no
 *  application gets lost on the way and that the sum of the branches always
 *  equals the parent. */
export function funnel(c: Application[]): FunnelNode {
  const sent = c.filter((x) => x.sent);
  const neverSent = c.filter((x) => !x.sent);

  type Outcome = "interview" | "no_answer" | "closed" | "rejected_on_paper";
  const outcome = (x: Application): Outcome =>
    x.interviewObtained || x.status === "interview" || x.status === "offer"
      ? "interview"
      : x.status === "applied"
        ? "no_answer"
        : x.status === "closed"
          ? "closed"
          : "rejected_on_paper";

  const by = (o: Outcome) => sent.filter((x) => outcome(x) === o);
  const interviews = by("interview");
  const noAnswer = by("no_answer");

  const leaf = (key: string, label: string, help: string, color: string, batch: Application[]): FunnelNode => ({
    key,
    label,
    help,
    color,
    n: batch.length,
    children: [],
  });

  return {
    key: "prepared",
    label: "Applications prepared",
    help: "A row in the tracker, whether it went out or not",
    color: "var(--series-1)",
    n: c.length,
    children: [
      {
        key: "sent",
        label: "Sent",
        help: "Sending proven, by the confirmation page or by the mailbox",
        color: "var(--series-1)",
        n: sent.length,
        children: [
          {
            key: "interview",
            label: "Interview obtained",
            help: "An invitation received, whatever came next",
            color: "var(--st-good)",
            n: interviews.length,
            children: [
              leaf(
                "offer",
                "Got an offer",
                "A written offer received",
                "var(--st-good)",
                interviews.filter((x) => x.status === "offer"),
              ),
              leaf(
                "ongoing",
                "Process ongoing",
                "Interview ahead or next stage engaged",
                "var(--st-good)",
                interviews.filter((x) => x.status === "interview"),
              ),
              leaf(
                "rejected_after",
                "Rejected after interview",
                "The process stopped after at least one conversation",
                "var(--st-critical)",
                interviews.filter((x) => x.status !== "interview" && x.status !== "offer"),
              ),
            ],
          },
          {
            key: "no_answer",
            label: "No answer",
            help: "No reply so far, neither a rejection nor an invitation",
            color: "var(--st-pending)",
            n: noAnswer.length,
            children: [
              leaf(
                "alive",
                "Answer still possible",
                `Less than ${SILENCE_DAYS} days since sending`,
                "var(--st-pending)",
                noAnswer.filter((x) => daysSince(x.date) < SILENCE_DAYS),
              ),
              leaf(
                "dead_silence",
                `Silent for ${SILENCE_DAYS}+ days`,
                "A rejection that was never written",
                "var(--st-critical)",
                noAnswer.filter((x) => daysSince(x.date) >= SILENCE_DAYS),
              ),
            ],
          },
          leaf(
            "rejected_on_paper",
            "Rejected on paper",
            "Rejected without any human conversation",
            "var(--st-critical)",
            by("rejected_on_paper"),
          ),
          leaf(
            "closed",
            "Closed after sending",
            "The role was cancelled, not a rejection of the profile",
            "var(--st-serious)",
            by("closed"),
          ),
        ],
      },
      leaf(
        "never",
        "Never sent",
        "Dropped by choice, or blocked by the ATS",
        "var(--st-neutral)",
        neverSent,
      ),
    ],
  };
}
