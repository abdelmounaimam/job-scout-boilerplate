import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATIONS, CONFIG, perDay } from "@/lib/metrics";

const shortDay = (iso: string) => new Date(iso).toLocaleDateString(CONFIG.locale, { day: "numeric", month: "short" });

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const n = payload[0].value as number;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-sm"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
    >
      <div className="font-medium">
        {new Date(label).toLocaleDateString(CONFIG.locale, { weekday: "long", day: "numeric", month: "long" })}
      </div>
      <div style={{ color: "var(--ink-2)" }}>
        {n} application{n === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function Timeline() {
  const data = perDay(APPLICATIONS);
  const total = data.reduce((s, d) => s + d.n, 0);
  const days = data.length;
  const active = data.filter((d) => d.n > 0).length;
  const peak = Math.max(1, ...data.map((d) => d.n));
  // Explicit ticks: Recharts picked five that did not land on round integers
  // for a peak of 21.
  const step = peak <= 5 ? 1 : peak <= 12 ? 2 : 5;
  const max = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sending pace</CardTitle>
        <CardDescription>
          {total} applications over {days} days · {active} active days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {/* ⚠️ No negative left margin: it clipped the first digit of the
                ticks, "20" displayed as "0" and the axis became unreadable. */}
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--axis)" }}
                minTickGap={18}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, max]}
                ticks={ticks}
                tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip content={<Tip />} cursor={{ fill: "var(--grid)", opacity: 0.45 }} />
              {/* 4px rounded end, anchored on the baseline.
                  ⚠️ Animation switched off on purpose: ResponsiveContainer
                  restarts the bars' growth at every re-measure, and they stayed
                  stuck at a fraction of their height (a peak of 21 was drawn as
                  a 4). Nothing to animate on a static dashboard anyway. */}
              <Bar dataKey="n" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
