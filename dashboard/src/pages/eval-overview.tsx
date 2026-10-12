import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ArrowRight, ClipboardCheck, FileWarning, Gauge, PenLine, ShieldAlert } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Kpi } from "@/components/kpi";
import { StatusBadge } from "@/components/status";
import {
  AXES, CHANNELS, RECORDS, applicationOf, failureKind, humanScores, isUnsourced, latestByRecord, mean, useScores, wasEdited,
} from "@/lib/evals";
import { statusOf } from "@/lib/metrics";

const axisConfig = { avg: { label: "Average", color: "var(--chart-1)" } } satisfies ChartConfig;
const failConfig = { n: { label: "Texts", color: "var(--st-critical)" } } satisfies ChartConfig;

export function EvalOverviewPage() {
  const { data, isSuccess } = useScores();
  const latest = latestByRecord(humanScores(data));
  const scored = [...latest.values()];

  const axisAvg = AXES.map((a) => ({ axis: a.name, avg: mean(scored.map((s) => s.axes[a.key])) }));
  const overall = mean(scored.flatMap((s) => Object.values(s.axes)));

  const failing = RECORDS.filter((r) => r.checks?.ok === false);
  const kinds = new Map<string, number>();
  for (const r of failing) for (const k of new Set(r.checks!.failures.map(failureKind))) kinds.set(k, (kinds.get(k) ?? 0) + 1);
  const kindData = [...kinds.entries()].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n);
  const unsourced = RECORDS.reduce((s, r) => s + (r.claims ?? []).filter(isUnsourced).length, 0);
  const edited = RECORDS.filter(wasEdited).length;

  const byChannel = Object.entries(CHANNELS)
    .map(([k, label]) => {
      const rs = RECORDS.filter((r) => r.channel === k);
      return { label, total: rs.length, scored: rs.filter((r) => latest.has(r.id)).length };
    })
    .filter((c) => c.total);

  // Score against outcome: weak signal (small n, unexplained rejections), shown as a hint, never as a grade.
  const outcomes = ["offer", "interview", "rejected", "applied"].map((st) => {
    const rs = RECORDS.filter((r) => applicationOf(r)?.status === st);
    return { st, n: rs.length, avg: mean(rs.map((r) => latest.get(r.id)).filter(Boolean).flatMap((s) => Object.values(s!.axes))) };
  });

  const lowest = scored
    .map((s) => ({ s, r: RECORDS.find((r) => r.id === s.record_id)!, avg: mean(Object.values(s.axes)) }))
    .filter((x) => x.r && x.avg != null)
    .sort((a, b) => a.avg! - b.avg!)
    .slice(0, 5);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation summary</h1>
          <p className="text-muted-foreground text-sm">How good the free-form texts are, and what to fix in the next ones.</p>
        </div>
        <Button asChild>
          <a href="#/evaluations/review">Review texts <ArrowRight /></a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Kpi label="Texts scored" value={`${latest.size}/${RECORDS.length}`} hint={<Progress value={(latest.size / Math.max(RECORDS.length, 1)) * 100} className="mt-1 h-1.5" />} icon={ClipboardCheck} />
        <Kpi label="Average score" value={overall != null ? overall.toFixed(2) : "none"} hint={isSuccess ? "Across every scored axis, out of 5" : "Scores API unreachable"} icon={Gauge} />
        <Kpi label="Failing checks" value={failing.length} hint={`of ${RECORDS.length} texts, before any human read`} icon={ShieldAlert} tone={failing.length ? "var(--st-critical)" : undefined} />
        <Kpi label="Unsourced claims" value={unsourced} hint={`${edited} texts edited by you before sending`} icon={FileWarning} tone={unsourced ? "var(--st-attention)" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average per axis</CardTitle>
            <CardDescription>Your latest score of each text, 1 to 5</CardDescription>
          </CardHeader>
          <CardContent>
            {latest.size ? (
              <ChartContainer config={axisConfig} className="aspect-auto h-64 w-full">
                <BarChart data={axisAvg} layout="vertical" margin={{ left: 8, right: 36 }}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="axis" width={96} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="avg" fill="var(--color-avg)" radius={4} isAnimationActive={false}>
                    <LabelList dataKey="avg" position="right" className="fill-foreground" fontSize={12} formatter={(v: any) => (v == null ? "" : Number(v).toFixed(1))} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-3 text-sm">
                <PenLine className="size-6" />
                No score yet. Averages appear after the first review.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What the checks catch</CardTitle>
            <CardDescription>Texts failing each deterministic check</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild><a href="#/evaluations/checks">Details</a></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={failConfig} className="aspect-auto h-64 w-full">
              <BarChart data={kindData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="kind" width={118} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="n" fill="var(--color-n)" radius={4} isAnimationActive={false}>
                  <LabelList dataKey="n" position="right" className="fill-foreground" fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Progress by channel</CardTitle>
            <CardDescription>Scored texts per kind of text</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {byChannel.map((c) => (
              <div key={c.label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span>{c.label}</span><span className="tabular text-muted-foreground">{c.scored}/{c.total}</span></div>
                <Progress value={(c.scored / c.total) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score vs outcome</CardTitle>
            <CardDescription>A weak hint, not a grade: small n and rejections without reasons</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {outcomes.map((o) => (
              <div key={o.st} className="flex items-center justify-between gap-3">
                <StatusBadge status={o.st} />
                <span className="text-muted-foreground text-xs">{o.n} texts</span>
                <span className="tabular w-12 text-right font-medium">{o.avg != null ? o.avg.toFixed(2) : "none"}</span>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">{statusOf("interview").label} should score higher once enough texts are reviewed.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lowest scored</CardTitle>
            <CardDescription>Where the next writing rule comes from</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lowest.length ? lowest.map(({ r, avg }) => (
              <a key={r.id} href={`#/evaluations/review/${encodeURIComponent(r.id)}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.company}</div>
                  <div className="text-muted-foreground truncate text-xs">{r.question ?? CHANNELS[r.channel]}</div>
                </div>
                <Badge variant="secondary" className="tabular">{avg!.toFixed(1)}</Badge>
              </a>
            )) : <p className="text-muted-foreground text-sm">Nothing scored yet.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
