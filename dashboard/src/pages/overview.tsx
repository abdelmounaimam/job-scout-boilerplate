import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowUpRight, BellRing, CalendarCheck2, Clock3, Hourglass, PencilLine, Send, TrendingUp, Trophy } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Kpi } from "@/components/kpi";
import { Funnel } from "@/components/funnel";
import { StatusBadge, StatusIcon } from "@/components/status";
import { APPLICATIONS, CONFIG, chasersDue, countByStatus, daysSince, responseRate } from "@/lib/metrics";
import { fmtDate } from "@/lib/evals";

/** Applications per ISO week (Monday start), gaps filled with zero. */
function perWeek() {
  const monday = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const m = new Map<string, { sent: number; dropped: number }>();
  for (const c of APPLICATIONS) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) continue;
    const k = monday(c.date);
    const e = m.get(k) ?? { sent: 0, dropped: 0 };
    if (c.sent) e.sent++; else e.dropped++;
    m.set(k, e);
  }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  const out = [];
  for (let t = Date.parse(keys[0]); t <= Date.parse(keys[keys.length - 1]); t += 7 * 86_400_000) {
    const k = new Date(t).toISOString().slice(0, 10);
    out.push({ week: k, ...(m.get(k) ?? { sent: 0, dropped: 0 }) });
  }
  return out;
}

const weekConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  dropped: { label: "Never sent", color: "var(--st-neutral)" },
} satisfies ChartConfig;

const shortDate = (iso: string) => fmtDate(iso, { day: "numeric", month: "short" });

type Action = { id: number; company: string; role: string; link: string; why: "Waiting on you" | "To finish" | "Chaser due" };

export function OverviewPage() {
  const rep = responseRate(APPLICATIONS);
  const counts = countByStatus(APPLICATIONS);
  const n = (s: string) => counts.find((c) => c.status === s)!.n;
  const weeks = perWeek();
  const thisWeek = weeks.at(-1);
  const maxCount = Math.max(...counts.map((c) => c.n), 1);
  const offers = APPLICATIONS.filter((c) => c.status === "offer");

  // "Waiting on you" is not a chaser: the company answered and waits for you.
  // Chasers only show when the profile sets RULES.followUps to a number of
  // days; with the default policy ('never') chasersDue() returns nothing.
  const actions: Action[] = [
    ...APPLICATIONS.filter((c) => c.myCourt)
      .sort((a, b) => daysSince(b.date) - daysSince(a.date))
      .map((c) => ({ ...c, why: "Waiting on you" as const })),
    ...APPLICATIONS.filter((c) => c.status === "to_finish").map((c) => ({ ...c, why: "To finish" as const })),
    ...chasersDue(APPLICATIONS).map((c) => ({ ...c, why: "Chaser due" as const })),
  ];
  const recent = APPLICATIONS.filter((c) => c.sent).slice(0, 7);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Where the search stands, read from applications.csv.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          label="Offers"
          value={offers.length}
          hint={offers.length ? offers.map((c) => c.company).join(", ") : "None yet"}
          icon={Trophy}
          tone={offers.length ? "var(--st-good)" : undefined}
        />
        <Kpi label="Applications sent" value={rep.sent} hint={`${APPLICATIONS.length} tracker rows`} icon={Send} />
        <Kpi label="Waiting for an answer" value={n("applied")} hint="No reply so far" icon={Hourglass} tone="var(--st-pending)" />
        <Kpi label="Interviews" value={n("interview")} hint={n("interview") ? "Process under way" : "None right now"} icon={CalendarCheck2} tone={n("interview") ? "var(--st-good)" : undefined} />
        <Kpi label="Response rate" value={`${Math.round(rep.rate * 100)}%`} hint={`${rep.answered} answers to ${rep.sent} sent`} icon={TrendingUp} />
        <Kpi
          label="To finish"
          value={n("to_finish")}
          hint={n("to_finish") ? "Prepared, never sent" : "Nothing pending"}
          icon={PencilLine}
          tone={n("to_finish") ? "var(--st-attention)" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What happens to applications</CardTitle>
          <CardDescription>From prepared to the furthest stage reached</CardDescription>
        </CardHeader>
        <CardContent>
          <Funnel />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly activity</CardTitle>
            <CardDescription>
              Applications per week{thisWeek ? ` · ${thisWeek.sent} sent this week` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={weekConfig} className="aspect-auto h-60 w-full">
              <BarChart data={weeks} margin={{ left: 0, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="week" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Week of ${shortDate(String(v))}`} />} />
                <Bar dataKey="sent" stackId="a" fill="var(--color-sent)" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="dropped" stackId="a" fill="var(--color-dropped)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
            <CardDescription>Latest known status of every row</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {counts.map((c) => (
              <div key={c.status} className="flex flex-col gap-1.5" title={c.help}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <StatusIcon status={c.status} className="size-4" />
                    {c.label}
                  </span>
                  <span className="tabular font-medium">{c.n}</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${(c.n / maxCount) * 100}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs your action</CardTitle>
            <CardDescription>
              They answered and wait for you, or a form is ready to send
              {CONFIG.followUps != null ? `, or a chaser is due after ${CONFIG.followUps} days` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!actions.length && <p className="text-muted-foreground text-sm">Nothing to do today.</p>}
            {actions.map((c) => (
              <a key={c.id + c.why} href={c.link || undefined} target="_blank" rel="noreferrer" className="hover:bg-muted/60 flex items-center gap-3 rounded-lg border p-3 transition-colors">
                {c.why === "Waiting on you" ? (
                  <Clock3 className="size-4 shrink-0 text-[var(--st-good)]" />
                ) : c.why === "To finish" ? (
                  <PencilLine className="size-4 shrink-0 text-[var(--st-attention)]" />
                ) : (
                  <BellRing className="size-4 shrink-0 text-[var(--st-pending)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.company}</div>
                  <div className="text-muted-foreground truncate text-xs">{c.role}</div>
                </div>
                <Badge variant="secondary">{c.why}</Badge>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest sent</CardTitle>
            <CardDescription>The most recent applications that actually went out</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <a href="#/applications">All <ArrowUpRight /></a>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {!recent.length && <p className="text-muted-foreground text-sm">Nothing sent yet.</p>}
            {recent.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.company}</div>
                  <div className="text-muted-foreground truncate text-xs">{shortDate(c.date)} · {c.role}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
