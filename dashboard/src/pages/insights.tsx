import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StatusIcon } from "@/components/status";
import { APPLICATIONS, CONFIG, STATUSES, money, perDay, salaryRanges, statusOf } from "@/lib/metrics";
import { fmtDate } from "@/lib/evals";

const sourceConfig = {
  n: { label: "Applications", color: "var(--chart-1)" },
  interviews: { label: "Interviews", color: "var(--st-good)" },
} satisfies ChartConfig;
const dayConfig = { n: { label: "Applications", color: "var(--chart-1)" } } satisfies ChartConfig;

function bySource() {
  const m = new Map<string, { n: number; interviews: number; sent: number }>();
  for (const c of APPLICATIONS) {
    const e = m.get(c.sourceFamily) ?? { n: 0, interviews: 0, sent: 0 };
    e.n++;
    if (c.sent) e.sent++;
    if (c.interviewObtained || c.status === "interview") e.interviews++;
    m.set(c.sourceFamily, e);
  }
  return [...m.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.n - a.n);
}

const shortDate = (iso: string) => fmtDate(iso, { day: "numeric", month: "short" });

export function InsightsPage() {
  const sources = bySource();
  const days = perDay(APPLICATIONS);
  const active = days.filter((d) => d.n > 0).length;
  // Only the profile's currency is drawn on one axis: a USD and a EUR band on
  // the same scale would lie about both.
  const bands = salaryRanges(APPLICATIONS).filter((l) => l.currency === CONFIG.currency);
  const floor = CONFIG.salaryFloor;
  // The axis starts near the lowest band rather than at zero: bands are
  // compared with each other and with the floor, and from zero they all
  // crowd into the right half. Rounded to 10k so the ticks read cleanly.
  const lo = Math.floor((Math.min(...bands.map((l) => l.min), floor ?? Infinity) * 0.85) / 10_000) * 10_000;
  const hi = Math.ceil((Math.max(...bands.map((l) => l.max), floor ?? 0) * 1.05) / 10_000) * 10_000;
  const pos = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0);
  const k = (v: number) => money(v);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-muted-foreground text-sm">Which channels pay off, how fast applications go out, and what the postings pay.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where applications come from</CardTitle>
            <CardDescription>Applications and interviews obtained, per source</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sourceConfig} className="aspect-auto h-72 w-full">
              <BarChart data={sources} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="source" width={128} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="n" fill="var(--color-n)" radius={4} isAnimationActive={false} />
                <Bar dataKey="interviews" fill="var(--color-interviews)" radius={4} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="text-muted-foreground flex-wrap gap-x-4 gap-y-1 text-xs">
            {sources.filter((s) => s.sent).map((s) => (
              <span key={s.source}>
                {s.source}: <span className="text-foreground tabular font-medium">{((s.interviews / s.sent) * 100).toFixed(0)}%</span> interview rate
              </span>
            ))}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily rhythm</CardTitle>
            <CardDescription>
              {APPLICATIONS.length} applications over {days.length} days · {active} active days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dayConfig} className="aspect-auto h-72 w-full">
              <BarChart data={days} margin={{ left: 0, right: 4, top: 4 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => fmtDate(String(v), { weekday: "long", day: "numeric", month: "long" })} />} />
                {/* Animation off on purpose: ResponsiveContainer restarted the growth on
                    every re-measure and bars froze at a fraction of their height. */}
                <Bar dataKey="n" fill="var(--color-n)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {bands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Salary bands shown</CardTitle>
            <CardDescription>
              {bands.length} of {APPLICATIONS.length} postings show a band in {CONFIG.currency}
              {floor ? ` · the dashed line is your ${k(floor)} floor (TARGET.salaryFloor)` : ""} · axis from {k(lo)} to {k(hi)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {bands.map((l, i) => {
              const s = statusOf(l.status);
              const below = floor != null && l.max < floor;
              return (
                <div key={`${l.company}-${i}`} className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-2 sm:grid-cols-[10rem_1fr_7.5rem] sm:gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm">
                    <StatusIcon status={l.status} />
                    <span className="truncate" title={l.company}>{l.company}</span>
                  </span>
                  <div className="bg-muted/50 relative h-3 rounded-full">
                    {floor != null && (
                      <div className="absolute -top-1 -bottom-1 border-l border-dashed border-[var(--axis)]" style={{ left: `${pos(floor)}%` }} aria-hidden />
                    )}
                    <div
                      className="absolute top-0.5 h-2 rounded-full"
                      style={{ left: `${pos(l.min)}%`, width: `${Math.max(pos(l.max) - pos(l.min), 1.5)}%`, background: s.color, opacity: below ? 0.4 : 1 }}
                      title={`${s.label}: ${k(l.min)} to ${k(l.max)}`}
                    />
                  </div>
                  <span className="tabular text-muted-foreground text-right text-xs whitespace-nowrap">
                    {k(l.min)} to {k(l.max)}
                  </span>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="text-muted-foreground flex-wrap gap-x-4 gap-y-1 border-t text-xs">
            {Object.entries(STATUSES).filter(([key]) => bands.some((l) => l.status === key)).map(([key, s]) => (
              <span key={key} className="flex items-center gap-1.5"><StatusIcon status={key} />{s.label}</span>
            ))}
            {floor != null && <span>Faded: tops out below the floor</span>}
          </CardFooter>
        </Card>
      )}
    </>
  );
}
