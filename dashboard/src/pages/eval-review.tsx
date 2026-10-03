import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, ExternalLink,
  FileText, Inbox, Mail, MessageSquareQuote, PenLine, Quote, Search, ShieldAlert, Star,
} from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { StatusBadge } from "@/components/status";
import {
  AXES, CHANNELS, ORIGIN, RECORDS, STORIES, TEXT_STATUS, applicationOf, failureKind, fmtDate, humanScores, isUnsourced,
  latestByRecord, mean, describeFailure, textOf, useAddScore, useScores, wasEdited, wordDiff, type AxisKey, type Score,
  type TextRecord,
} from "@/lib/evals";
import { CONFIG } from "@/lib/metrics";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type Filter = "todo" | "done" | "all";
const CHANNEL_ICON: Record<string, typeof Mail> = { mail: Mail, letter: FileText, ats_field: PenLine, recruiter_reply: MessageSquareQuote, linkedin: MessageSquareQuote };
const storyTitle = new Map(STORIES.map((s) => [s.id, s.title]));

export function EvalReviewPage({ id }: { id?: string }) {
  const scoresQ = useScores();
  const scores = humanScores(scoresQ.data);
  const latest = useMemo(() => latestByRecord(scores), [scores]);

  const [filter, setFilter] = useState<Filter>("todo");
  const [channel, setChannel] = useState("all");
  const [failingOnly, setFailingOnly] = useState(false);
  const [q, setQ] = useState("");

  const queue = RECORDS.filter((r) => {
    if (filter === "todo" && latest.has(r.id)) return false;
    if (filter === "done" && !latest.has(r.id)) return false;
    if (channel !== "all" && r.channel !== channel) return false;
    if (failingOnly && r.checks?.ok !== false) return false;
    const s = q.trim().toLowerCase();
    return !s || `${r.company} ${r.role} ${r.question ?? ""}`.toLowerCase().includes(s);
  });

  // The open text stays reachable even when the filter hides it (e.g. right after scoring it in "To score").
  const current = (id && RECORDS.find((r) => r.id === id)) || null;
  const index = current ? queue.findIndex((r) => r.id === current.id) : -1;
  const go = (r?: TextRecord) => r && navigate({ page: "eval-review", id: r.id });
  const next = () => go(index >= 0 ? queue[index + 1] : queue[0]);
  const prev = () => go(index > 0 ? queue[index - 1] : undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], [role=combobox]")) return;
      if (e.key === "j" || e.key === "ArrowRight") next();
      if (e.key === "k" || e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const done = latest.size;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
          <p className="text-muted-foreground text-sm">Read each text against the posting and its evidence, then score it.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-72">
          <Progress value={(done / Math.max(RECORDS.length, 1)) * 100} className="h-2" />
          <span className="text-muted-foreground tabular shrink-0 text-xs">{done}/{RECORDS.length} scored</span>
        </div>
      </div>

      {scoresQ.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--st-attention)]/50 bg-[var(--st-attention)]/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--st-attention)]" />
          <span>
            The scores API is not answering, so scoring is disabled. <code>bun dev</code> serves the page only: run{" "}
            <code>bun run build &amp;&amp; bun server.ts</code> with <code>DASHBOARD_PASSWORD</code> set, or start <code>bun dev</code>{" "}
            with <code>DASHBOARD_URL</code> and <code>DASHBOARD_PASSWORD</code> so <code>/api</code> is relayed to a running server.
          </span>
        </div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Queue: always visible on xl, replaced by the text on smaller screens once one is open. */}
        <Card className={cn("min-w-0 gap-3 self-start py-4 xl:sticky xl:top-20", current && "hidden xl:flex")}>
          <CardHeader className="gap-3 px-4">
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} variant="outline" size="sm" className="w-full">
              <ToggleGroupItem value="todo" className="flex-1">To score</ToggleGroupItem>
              <ToggleGroupItem value="done" className="flex-1">Scored</ToggleGroupItem>
              <ToggleGroupItem value="all" className="flex-1">All</ToggleGroupItem>
            </ToggleGroup>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, role, question" className="h-9 pl-8" />
            </div>
            <div className="flex gap-2">
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger size="sm" className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {Object.entries(CHANNELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={failingOnly ? "secondary" : "outline"} size="sm" onClick={() => setFailingOnly((v) => !v)} title="Only texts failing the checks">
                <ShieldAlert /> Failing
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <ScrollArea className="h-[60vh] xl:h-[calc(100vh-21rem)] [&_[data-radix-scroll-area-viewport]>div]:!block">
            <ul className="flex flex-col gap-0.5 px-2">
              {queue.map((r) => {
                const Icon = CHANNEL_ICON[r.channel] ?? FileText;
                const s = latest.get(r.id);
                const avg = s ? mean(Object.values(s.axes)) : null;
                return (
                  <li key={r.id}>
                    <a
                      href={`#/evaluations/review/${encodeURIComponent(r.id)}`}
                      className={cn("hover:bg-muted/70 flex gap-3 rounded-lg px-2.5 py-2 transition-colors", current?.id === r.id && "bg-muted")}
                    >
                      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{r.company}</span>
                          {r.checks?.ok === false && <ShieldAlert className="size-3.5 shrink-0 text-[var(--st-critical)]" aria-label="failing checks" />}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">{r.question ?? CHANNELS[r.channel] ?? r.channel}</div>
                        <div className="text-muted-foreground tabular text-[11px]">{fmtDate(r.date)}</div>
                      </div>
                      {avg != null ? (
                        <Badge variant="secondary" className="tabular h-5 self-center px-1.5">{avg.toFixed(1)}</Badge>
                      ) : (
                        <CircleDashed className="text-muted-foreground/60 size-4 self-center" aria-label="not scored" />
                      )}
                    </a>
                  </li>
                );
              })}
              {!queue.length && <li className="text-muted-foreground p-4 text-center text-sm">Nothing in this filter.</li>}
            </ul>
          </ScrollArea>
        </Card>

        {current ? (
          <Detail key={current.id} r={current} history={scores.filter((s) => s.record_id === current.id)} apiOk={scoresQ.isSuccess}
            position={index >= 0 ? `${index + 1} / ${queue.length}` : "outside filter"} onPrev={prev} onNext={next} canPrev={index > 0} canNext={index < queue.length - 1} />
        ) : (
          <Card className="hidden min-h-96 items-center justify-center xl:flex">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle>Pick a text to review</EmptyTitle>
                <EmptyDescription>
                  Choose one in the queue, or press <Kbd>j</Kbd> to open the first. <Kbd>j</Kbd> / <Kbd>k</Kbd> move through the queue.
                </EmptyDescription>
              </EmptyHeader>
              {queue[0] && <Button onClick={() => go(queue[0])}>Start reviewing <ArrowRight /></Button>}
            </Empty>
          </Card>
        )}
      </div>
    </>
  );
}

function Detail({ r, history, apiOk, position, onPrev, onNext, canPrev, canNext }: {
  r: TextRecord; history: Score[]; apiOk: boolean; position: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean;
}) {
  const text = textOf(r);
  const edited = wasEdited(r);
  const app = applicationOf(r);
  const failures = r.checks?.ok === false ? r.checks.failures : [];
  const unknown = (r.claims ?? []).filter(isUnsourced).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="xl:hidden" onClick={() => navigate({ page: "eval-review" })}>
          <ArrowLeft /> Queue
        </Button>
        <span className="text-muted-foreground tabular ml-auto text-xs">{position}</span>
        <Button variant="outline" size="icon" className="size-8" onClick={onPrev} disabled={!canPrev} aria-label="Previous text (k)"><ChevronLeft /></Button>
        <Button variant="outline" size="icon" className="size-8" onClick={onNext} disabled={!canNext} aria-label="Next text (j)"><ChevronRight /></Button>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-x-2 text-lg">
                {r.link ? (
                  <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                    {r.company} <ExternalLink className="text-muted-foreground size-3.5" />
                  </a>
                ) : r.company}
              </CardTitle>
              <CardDescription>{r.role} · {fmtDate(r.date)}</CardDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary">{CHANNELS[r.channel] ?? r.channel}</Badge>
                {r.lang && <Badge variant="outline" className="uppercase">{r.lang}</Badge>}
                <Badge variant="outline">{TEXT_STATUS[r.status] ?? r.status}</Badge>
                <Badge variant="outline">{ORIGIN[r.origin] ?? r.origin}</Badge>
                {app && <StatusBadge status={app.status} />}
                {edited && <Badge className="bg-[var(--st-attention)]/15 text-foreground">Edited before sending</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {r.question && (
                <div className="bg-muted/50 rounded-lg border p-3">
                  <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Question asked</div>
                  <p className="text-sm font-medium">{r.question}</p>
                </div>
              )}

              {failures.length > 0 && (
                <div className="rounded-lg border border-[var(--st-critical)]/40 bg-[var(--st-critical)]/5 p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[var(--st-critical)]">
                    <ShieldAlert className="size-4" /> {failures.length} failing check{failures.length > 1 ? "s" : ""}
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {failures.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Badge variant="outline" className="shrink-0">{failureKind(f)}</Badge>
                        <span className="text-muted-foreground min-w-0 break-words" title={f}>{describeFailure(f)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Tabs defaultValue="text">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="diff" disabled={!edited}>Draft vs sent</TabsTrigger>
                  <TabsTrigger value="evidence">
                    Evidence{unknown > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{unknown}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="pt-2">
                  <LengthMeter n={text.length} limit={r.limit} />
                  <p className="mt-3 text-[15px] leading-7 whitespace-pre-wrap">{text}</p>
                </TabsContent>

                <TabsContent value="diff" className="pt-2">
                  <p className="text-muted-foreground mb-3 text-xs">
                    <span className="rounded bg-[var(--st-critical)]/15 px-1 line-through">removed</span> from the agent's draft,{" "}
                    <span className="rounded bg-[var(--st-good)]/15 px-1">added</span> by you before sending. Every edit is a free label.
                  </p>
                  <p className="text-[15px] leading-7 whitespace-pre-wrap">
                    {wordDiff(r.draft, r.final ?? r.draft).map((p, i) =>
                      p.op === "same" ? <span key={i}>{p.text}</span>
                        : p.op === "del" ? <del key={i} className="rounded bg-[var(--st-critical)]/15 decoration-[var(--st-critical)]">{p.text}</del>
                          : <ins key={i} className="rounded bg-[var(--st-good)]/15 no-underline">{p.text}</ins>,
                    )}
                  </p>
                </TabsContent>

                <TabsContent value="evidence" className="flex flex-col gap-5 pt-2">
                  <Section title="Why this angle" icon={Star}>
                    <p className="text-muted-foreground text-sm leading-relaxed">{r.angle || "No angle recorded."}</p>
                  </Section>
                  <Section title="What the posting says" icon={Quote}>
                    {r.posting_quotes?.length ? (
                      r.posting_quotes.map((l) => (
                        <blockquote key={l} className="text-muted-foreground border-primary/40 border-l-2 pl-3 text-sm italic">{l}</blockquote>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--st-critical)]">No posting line quoted: the text may be generic by construction.</p>
                    )}
                  </Section>
                  <Section title="Stories used" icon={FileText}>
                    <div className="flex flex-col gap-1.5">
                      {(r.stories ?? []).map((s) => (
                        <div key={s} className="flex flex-wrap items-baseline gap-2 text-sm">
                          <Badge variant="secondary" className="font-mono text-[11px]">{s}</Badge>
                          <span className="text-muted-foreground">{storyTitle.get(s) ?? "not in the catalogue"}</span>
                        </div>
                      ))}
                      {!r.stories?.length && <p className="text-muted-foreground text-sm">None recorded.</p>}
                    </div>
                  </Section>
                  <Section title="Claims and their source" icon={CheckCircle2}>
                    <ul className="flex flex-col gap-1.5">
                      {(r.claims ?? []).map((c, i) => (
                        <li key={i} className={cn("flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm", isUnsourced(c) && "border-[var(--st-critical)]/40 bg-[var(--st-critical)]/5")}>
                          <span className="min-w-0">{c.text}</span>
                          <Badge variant={isUnsourced(c) ? "destructive" : "outline"} className="font-mono text-[11px]" title={isUnsourced(c) ? "Not an id of profile/stories.md" : undefined}>
                            {isUnsourced(c) ? `UNSOURCED ${c.source ?? ""}`.trim() : c.source}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </Section>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Previous scores</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-4">
                {history.slice().reverse().map((s) => (
                  <div key={s.id} className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs">{when(s.created_at)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {AXES.filter((a) => s.axes[a.key] != null).map((a) => (
                        <Badge key={a.key} variant="outline" className="tabular">{a.name} <b>{s.axes[a.key]}</b></Badge>
                      ))}
                    </div>
                    {s.comment && <p className="text-sm">{s.comment}</p>}
                    {s.rewrite && (
                      <Collapsible>
                        <CollapsibleTrigger className="text-primary flex items-center gap-1 text-xs font-medium">Your rewrite <ChevronDown className="size-3" /></CollapsibleTrigger>
                        <CollapsibleContent><p className="bg-muted/40 mt-2 rounded-md border p-3 text-sm whitespace-pre-wrap">{s.rewrite}</p></CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <ScoreForm r={r} apiOk={apiOk} onSaved={(andNext) => andNext && canNext && onNext()} />
      </div>
    </div>
  );
}

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString(CONFIG.locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function LengthMeter({ n, limit }: { n: number; limit?: number | null }) {
  if (!limit) return <span className="text-muted-foreground tabular text-xs">{n} characters</span>;
  const over = n > limit;
  return (
    <div className="flex items-center gap-3">
      <Progress value={Math.min((n / limit) * 100, 100)} className={cn("h-1.5 max-w-48", over && "[&>div]:bg-[var(--st-critical)]")} />
      <span className={cn("tabular text-xs", over ? "text-[var(--st-critical)]" : "text-muted-foreground")}>{n} / {limit} characters</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Star; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase"><Icon className="size-3.5" />{title}</h4>
      {children}
    </section>
  );
}

function ScoreForm({ r, apiOk, onSaved }: { r: TextRecord; apiOk: boolean; onSaved: (andNext: boolean) => void }) {
  const [axes, setAxes] = useState<Partial<Record<AxisKey, number | null>>>({});
  const [comment, setComment] = useState("");
  const [rewrite, setRewrite] = useState("");
  const add = useAddScore();
  const filled = Object.values(axes).filter((v) => v != null).length;

  const save = (andNext: boolean) =>
    add.mutate(
      { record_id: r.id, axes, comment, rewrite },
      {
        onSuccess: () => {
          toast.success(`Score saved for ${r.company}`);
          setAxes({}); setComment(""); setRewrite("");
          onSaved(andNext);
        },
        onError: (e) => toast.error(`Not saved: ${e.message}`),
      },
    );

  return (
    <Card className="self-start 2xl:sticky 2xl:top-20">
      <CardHeader>
        <CardTitle>Your score</CardTitle>
        <CardDescription>1 = bad, 5 = perfect. Leave an axis empty to skip it.</CardDescription>
        <CardAction><Badge variant="secondary" className="tabular">{filled}/{AXES.length}</Badge></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* One compact row per axis (label left, 1 to 5 right) so the whole form fits next to
            or right under the text; on a phone the scale goes full width under the label.
            Clicking the selected value again clears the axis. */}
        <div className="flex flex-col gap-3">
          {AXES.map((a) => (
            <div key={a.key} className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 2xl:grid-cols-1">
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.name}</div>
                <p className="text-muted-foreground text-xs leading-snug">{a.hint}</p>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                value={axes[a.key] != null ? String(axes[a.key]) : ""}
                onValueChange={(v) => setAxes((prev) => ({ ...prev, [a.key]: v ? Number(v) : null }))}
                className="w-full sm:w-auto 2xl:w-full"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <ToggleGroupItem
                    key={n}
                    value={String(n)}
                    className="tabular h-9 flex-1 sm:w-10 sm:flex-none 2xl:flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    aria-label={`${a.name} ${n}`}
                  >
                    {n}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="comment" className="text-sm font-medium">Comment</label>
          <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What's wrong, which story would have worked better…" />
        </div>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 self-start">
              <PenLine /> Write your own version <ChevronDown />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Textarea value={rewrite} onChange={(e) => setRewrite(e.target.value)} rows={8} placeholder="Your version becomes a reference example for future texts." />
          </CollapsibleContent>
        </Collapsible>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!apiOk || add.isPending || (!filled && !comment && !rewrite)} onClick={() => save(true)}>
            Save & next <ArrowRight />
          </Button>
          <Button variant="outline" disabled={!apiOk || add.isPending || (!filled && !comment && !rewrite)} onClick={() => save(false)}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
