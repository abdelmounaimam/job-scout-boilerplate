import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APPLICATIONS, CONFIG, statusOf } from "@/lib/metrics";
import records from "@/data/records.json";

/** One free-text output traced by the agent. Full schema in evals/README.md. */
type TextRecord = {
  id: string;
  date: string;
  company: string;
  role: string;
  link?: string;
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

type Score = {
  id: number;
  record_id: string;
  rater: string;
  axes: Record<string, number | null>;
  comment: string | null;
  rewrite: string | null;
  created_at: string;
};

/** Must stay aligned with AXES in server.ts and the rubric in evals/README.md. */
const AXES: { key: string; name: string; question: string }[] = [
  { key: "truth", name: "Truth", question: "Is everything true and defensible in an interview? 1 = one invention" },
  { key: "relevance", name: "Relevance", question: "Does it answer THIS question and THIS posting?" },
  { key: "story_choice", name: "Story choice", question: "Was it the right story? If not, which one, in the comment" },
  { key: "honesty", name: "Honesty", question: "Are the real gaps owned without self-sabotage?" },
  { key: "specificity", name: "Specificity", question: "Could it have gone elsewhere unchanged? 1 = yes" },
  { key: "tone", name: "Tone", question: "Does it sound like me?" },
];

const RECORDS = (records as TextRecord[]).slice().sort((a, b) => b.date.localeCompare(a.date));

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The outcome is read from the tracker, never copied into the record.
 *  ⚠️ Company names are matched on whole leading words, never as substrings: a
 *  substring match finds a short name inside an unrelated longer one. */
function applicationOf(r: TextRecord) {
  const a = norm(r.company);
  if (!a) return undefined;
  return APPLICATIONS.find((c) => {
    const b = norm(c.company);
    return b === a || b.startsWith(a + " ") || a.startsWith(b + " ");
  });
}

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString(CONFIG.locale, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function Evaluations() {
  const [scores, setScores] = useState<Score[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<"to_score" | "scored" | "all">("to_score");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scores")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((s: Score[]) => {
        setScores(s);
        setApiOk(true);
      })
      .catch(() => setApiOk(false));
  }, []);

  const scored = useMemo(() => new Set(scores.filter((s) => s.rater === "human").map((s) => s.record_id)), [scores]);

  const list = RECORDS.filter((r) => {
    if (filter === "to_score" && scored.has(r.id)) return false;
    if (filter === "scored" && !scored.has(r.id)) return false;
    const q = search.trim().toLowerCase();
    return !q || `${r.company} ${r.role} ${r.channel}`.toLowerCase().includes(q);
  });
  const record = RECORDS.find((r) => r.id === chosen) ?? list[0] ?? null;

  if (!RECORDS.length) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            No text to evaluate: <code>evals/records.jsonl</code> is empty or missing. Every free text the agent writes is
            traced there before you see it (<code>evals/README.md</code>).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {apiOk === false && (
        <p className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--st-attention)" }}>
          The scores API does not answer: scoring is disabled. Locally, <code>bun dev</code> serves the page only; run{" "}
          <code>bun run build && bun server.ts</code> to score.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle>Free texts</CardTitle>
            <CardDescription>
              {scored.size} scored out of {RECORDS.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-1">
              {([["to_score", "To score"], ["scored", "Scored"], ["all", "All"]] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium"
                  style={{
                    borderColor: filter === v ? "var(--series-1)" : "var(--border)",
                    color: filter === v ? "var(--series-1)" : "var(--ink-2)",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Company, role, channel"
              className="rounded-md border bg-transparent px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
            <ul className="flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto lg:max-h-[70vh]">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setChosen(r.id);
                      // On a phone the detail sits BELOW the list: scroll to it,
                      // or the tap looks like it did nothing.
                      if (window.matchMedia("(max-width: 1023px)").matches)
                        requestAnimationFrame(() =>
                          document.getElementById("text-detail")?.scrollIntoView({ behavior: "smooth" }),
                        );
                    }}
                    className="flex w-full min-w-0 flex-col rounded-md px-2 py-1.5 text-left text-sm"
                    style={{ background: record?.id === r.id ? "var(--grid)" : "transparent" }}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {r.checks && !r.checks.ok && (
                        <span title="failing its checks" style={{ color: "var(--st-critical)" }}>✗</span>
                      )}
                      {scored.has(r.id) && <span title="scored" style={{ color: "var(--st-good)" }}>✓</span>}
                      <span className="truncate">{r.company}</span>
                    </span>
                    <span className="truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                      {r.date} · {r.channel} · {r.question ? r.question.slice(0, 40) : r.role}
                    </span>
                  </button>
                </li>
              ))}
              {!list.length && (
                <li className="px-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  Nothing in this filter.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {record && (
          <Detail
            key={record.id}
            r={record}
            history={scores.filter((s) => s.record_id === record.id)}
            apiOk={apiOk === true}
            onScore={(s) => setScores((v) => [...v, s])}
          />
        )}
      </div>
    </div>
  );
}

function Detail({
  r,
  history,
  apiOk,
  onScore,
}: {
  r: TextRecord;
  history: Score[];
  apiOk: boolean;
  onScore: (s: Score) => void;
}) {
  const text = r.final ?? r.draft;
  const corrected = r.final != null && r.final.trim() !== r.draft.trim();
  const app = applicationOf(r);
  const st = app ? statusOf(app.status) : null;

  return (
    <div id="text-detail" className="flex min-w-0 scroll-mt-4 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {r.link ? (
              <a href={r.link} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {r.company}
              </a>
            ) : (
              r.company
            )}
            <span className="font-normal" style={{ color: "var(--ink-2)" }}>
              {r.role}
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge>{r.channel}</Badge>
            {r.lang && <Badge>{r.lang}</Badge>}
            <Badge>{r.status}</Badge>
            <Badge>{r.origin}</Badge>
            {st && (
              <Badge color={st.color}>
                application: {st.icon} {st.label}
              </Badge>
            )}
            <Badge>
              {text.length}
              {r.limit ? ` / ${r.limit}` : ""} chars
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {r.checks && !r.checks.ok && (
            <section className="rounded-md border px-3 py-2" style={{ borderColor: "var(--st-critical)" }}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--st-critical)" }}>
                Failing checks
              </h4>
              <ul className="list-disc pl-5">
                {r.checks.failures.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}

          {r.question && (
            <Block title="Question asked">
              <p className="font-medium">{r.question}</p>
            </Block>
          )}

          {!!r.posting_quotes?.length && (
            <Block title="What the posting says">
              {r.posting_quotes.map((l) => (
                <blockquote
                  key={l}
                  className="border-l-2 pl-3 italic"
                  style={{ borderColor: "var(--axis)", color: "var(--ink-2)" }}
                >
                  {l}
                </blockquote>
              ))}
            </Block>
          )}

          {r.angle && (
            <Block title="Why this angle">
              <p style={{ color: "var(--ink-2)" }}>{r.angle}</p>
            </Block>
          )}

          <Block title={corrected ? "Text sent (corrected by you)" : r.final ? "Text sent" : "Agent's draft"}>
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
          </Block>
          {corrected && (
            <details>
              <summary
                className="cursor-pointer text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--ink-muted)" }}
              >
                The agent's first draft
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {r.draft}
              </p>
            </details>
          )}

          {!!r.stories?.length && (
            <Block title="Stories used">
              <div className="flex flex-wrap gap-1.5">
                {r.stories.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </Block>
          )}

          {!!r.claims?.length && (
            <Block title="Facts and their source">
              <ul className="flex flex-col gap-1">
                {r.claims.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <span>{c.text}</span>
                    <Badge>{c.source}</Badge>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </CardContent>
      </Card>

      <Scoring r={r} apiOk={apiOk} onScore={onScore} />

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous scores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {history.map((s) => (
              <div key={s.id} className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {s.rater} · {when(s.created_at)}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AXES.filter((a) => s.axes[a.key] != null).map((a) => (
                    <Badge key={a.key}>
                      {a.name} {s.axes[a.key]}
                    </Badge>
                  ))}
                </div>
                {s.comment && <p style={{ color: "var(--ink-2)" }}>{s.comment}</p>}
                {s.rewrite && (
                  <details>
                    <summary className="cursor-pointer text-xs">Rewrite</summary>
                    <p className="mt-1 whitespace-pre-wrap">{s.rewrite}</p>
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Scoring({ r, apiOk, onScore }: { r: TextRecord; apiOk: boolean; onScore: (s: Score) => void }) {
  const [axes, setAxes] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [state, setState] = useState<string>("");

  async function save() {
    setState("sending");
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: r.id, rater: "human", axes, comment, rewrite }),
    }).catch(() => null);
    if (!res?.ok) {
      setState(`failed: ${res ? ((await res.json().catch(() => ({}))).error ?? res.status) : "network"}`);
      return;
    }
    onScore(await res.json());
    setAxes({});
    setComment("");
    setRewrite("");
    setState("ok");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your score</CardTitle>
        <CardDescription>1 = bad, 5 = perfect. An axis left empty is not scored.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {AXES.map((a) => (
          <div key={a.key} className="flex flex-col gap-1.5">
            <div>
              <span className="text-sm font-medium">{a.name}</span>
              <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                {a.question}
              </span>
            </div>
            <div className="flex gap-1.5" role="radiogroup" aria-label={a.name}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = axes[a.key] === n;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAxes((v) => ({ ...v, [a.key]: on ? null : n }))}
                    className="h-10 w-10 rounded-md border text-sm font-semibold"
                    style={{
                      borderColor: on ? "var(--series-1)" : "var(--border)",
                      background: on ? "var(--series-1)" : "transparent",
                      color: on ? "#fff" : "var(--ink-2)",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Comment
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What is wrong, the story that would have worked better..."
            className="rounded-md border bg-transparent px-2.5 py-1.5 font-normal"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your version (optional, it becomes a reference example)
          <textarea
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            rows={6}
            className="rounded-md border bg-transparent px-2.5 py-1.5 font-normal"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={!apiOk || state === "sending"}
            className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--series-1)", color: "#fff" }}
          >
            Save
          </button>
          {state === "ok" && (
            <span className="text-sm" style={{ color: "var(--st-good)" }}>
              Saved.
            </span>
          )}
          {state.startsWith("failed") && (
            <span className="text-sm" style={{ color: "var(--st-critical)" }}>
              {state}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        {title}
      </h4>
      {children}
    </section>
  );
}
