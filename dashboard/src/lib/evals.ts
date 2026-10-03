import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import records from "@/data/records.json";
import stories from "@/data/stories.json";
import { APPLICATIONS, CONFIG, type Application } from "@/lib/metrics";

/** One free text written by the agent. Full schema in evals/README.md. */
export type TextRecord = {
  id: string;
  date: string;
  company: string;
  role: string;
  link?: string | null;
  channel: string;
  lang?: string;
  question?: string | null;
  limit?: number | null;
  posting_quotes?: string[];
  stories?: string[];
  claims?: { text: string; source: string }[];
  angle?: string;
  draft: string;
  final?: string | null;
  status: string;
  origin: string;
  checks?: { ok: boolean; failures: string[] } | null;
};

/** One row of the server's append-only `scores` table (server.ts). */
export type Score = {
  id: number;
  record_id: string;
  rater: string;
  axes: Record<string, number | null>;
  comment: string | null;
  rewrite: string | null;
  created_at: string;
};

/** One row of profile/stories.md, parsed by scripts/build-data.mjs. */
export type Story = { id: string; type: "story" | "fact"; title: string; proves: string; facts: string; source: string };

export const RECORDS = (records as TextRecord[])
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
export const STORIES = stories as Story[];
const STORY_IDS = new Set(STORIES.map((s) => s.id));

/** A claim whose source is not an id of the catalogue: either a gap in
 *  profile/stories.md or a fabrication. evals/check.mjs fails the record for
 *  it; the dashboard counts them so they stay visible after the fact. */
export const isUnsourced = (c: { source: string }) => !STORY_IDS.has(c.source);

/** Must stay aligned with AXES in server.ts and the rubric in evals/README.md. */
export const AXES = [
  { key: "truth", name: "Truth", hint: "Is everything true and defensible in an interview? 1 = something invented" },
  { key: "relevance", name: "Relevance", hint: "Does it answer THIS question for THIS posting?" },
  { key: "story_choice", name: "Story choice", hint: "Was it the right story? If not, which one (in the comment)" },
  { key: "honesty", name: "Honesty", hint: "Are real gaps owned without self-sabotage?" },
  { key: "specificity", name: "Specificity", hint: "Could it have been sent as is to another company? 1 = yes" },
  { key: "tone", name: "Tone", hint: "Does it sound like you?" },
] as const;
export type AxisKey = (typeof AXES)[number]["key"];

/** Labels of the record vocabulary of evals/check.mjs (CHANNELS, STATUSES). */
export const CHANNELS: Record<string, string> = {
  ats_field: "ATS field",
  letter: "Cover letter",
  mail: "Email",
  recruiter_reply: "Recruiter reply",
  linkedin: "LinkedIn",
};
export const TEXT_STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", dropped: "Dropped" };
export const ORIGIN: Record<string, string> = { live: "Live", backfill: "Backfill" };

export const textOf = (r: TextRecord) => r.final ?? r.draft;
export const wasEdited = (r: TextRecord) => r.final != null && r.final.trim() !== r.draft.trim();

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The application outcome is read from the tracker, never copied into the record.
 *  ⚠️ Company names are matched on whole leading words, never as substrings: a
 *  substring match finds a short name inside an unrelated longer one. */
export function sameCompany(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y + " ") || y.startsWith(x + " ");
}
export function applicationOf(r: TextRecord): Application | undefined {
  return APPLICATIONS.find((c) => sameCompany(c.company, r.company));
}

/** Groups a raw check failure of evals/check.mjs into a short family, for
 *  charts and filters. The raw message stays visible next to it. */
export function failureKind(e: string): string {
  if (e.startsWith("source unknown") || e.startsWith("story unknown")) return "Unsourced claim";
  if (e.startsWith("no line of the posting")) return "No posting quote";
  if (e.startsWith("number(s) without")) return "Unbacked number";
  if (e.startsWith("dash used")) return "Dash punctuation";
  if (e.startsWith("language detected")) return "Wrong language";
  if (/characters for a limit of/.test(e)) return "Over length";
  if (e.startsWith("current salary")) return "Current salary";
  if (e.startsWith("notice period")) return "Notice period";
  if (e === "empty text") return "Empty text";
  if (e.startsWith("missing field") || e.startsWith("unknown channel") || e.startsWith("unknown status") || e.startsWith("status sent"))
    return "Schema";
  return "Other";
}

/** A shorter rendering of a check message: the explanation in parentheses is
 *  dropped (the raw message stays available as a tooltip). */
export const describeFailure = (e: string) => e.replace(/\s*\([^)]*\)\s*$/, "");

/** Locale-aware dates, following DASHBOARD.locale of the profile. */
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "2-digit" }) {
  try {
    return new Date(iso).toLocaleDateString(CONFIG.locale, opts);
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------- scores API

async function fetchScores(): Promise<Score[]> {
  const r = await fetch("/api/scores");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useScores() {
  return useQuery({ queryKey: ["scores"], queryFn: fetchScores, retry: 1, staleTime: 30_000 });
}

export type NewScore = {
  record_id: string;
  axes: Partial<Record<AxisKey, number | null>>;
  comment?: string;
  rewrite?: string;
};

export function useAddScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NewScore) => {
      const r = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, rater: "human" }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      return body as Score;
    },
    onSuccess: (s) => qc.setQueryData<Score[]>(["scores"], (old) => [...(old ?? []), s]),
  });
}

/** Human scores only; the judge, once calibrated, writes with rater = "judge". */
export const humanScores = (s: Score[] | undefined) => (s ?? []).filter((x) => x.rater !== "judge");

/** Latest score per record: scoring a text again supersedes the older one. */
export function latestByRecord(scores: Score[]) {
  const m = new Map<string, Score>();
  for (const s of scores) {
    const prev = m.get(s.record_id);
    if (!prev || prev.created_at < s.created_at) m.set(s.record_id, s);
  }
  return m;
}

export function mean(values: (number | null | undefined)[]) {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Word-level diff (LCS) between the agent's draft and what was sent. Texts are
 *  a few hundred words, so the quadratic table stays small. */
export function wordDiff(a: string, b: string) {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const n = x.length, m = y.length;
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: { op: "same" | "del" | "add"; text: string }[] = [];
  const push = (op: "same" | "del" | "add", text: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { push("same", x[i]); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) push("del", x[i++]);
    else push("add", y[j++]);
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  return coalesce(out);
}

/** A word-level LCS on a heavily edited sentence interleaves one removed word,
 *  one added word, one removed word… which reads as noise. Changes separated
 *  only by whitespace are grouped into one block: everything removed, then
 *  everything added. */
function coalesce(parts: { op: "same" | "del" | "add"; text: string }[]) {
  const out: typeof parts = [];
  let del = "", add = "";
  const flush = () => {
    if (del) out.push({ op: "del", text: del });
    if (add) out.push({ op: "add", text: add });
    del = add = "";
  };
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const inBlock = del || add;
    if (p.op === "del") del += p.text;
    else if (p.op === "add") add += p.text;
    else if (inBlock && !p.text.trim() && k + 1 < parts.length && parts[k + 1].op !== "same") {
      // Whitespace between two changes belongs to both sides of the block.
      del += p.text;
      add += p.text;
    } else {
      flush();
      out.push(p);
    }
  }
  flush();
  return out;
}
