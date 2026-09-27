import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATIONS, CONFIG, STATUSES, money, statusOf, salaryRanges } from "@/lib/metrics";

/** Ranges shown by the postings, placed against the negotiation floor. One band
 *  per company, so no categorical palette: the colour repeats the status,
 *  always doubled by the icon in the legend.
 *
 *  Only ranges in the profile's currency are drawn: bands in another currency
 *  cannot sit on the same axis without a conversion nobody asked for. They stay
 *  readable in the table. */
export function Salaries() {
  const rows = salaryRanges(APPLICATIONS).filter((l) => l.currency === CONFIG.currency);
  if (!rows.length) return null;

  const floor = CONFIG.salaryFloor;
  const max = Math.max(...rows.map((l) => l.max), floor ? floor * 2.5 : 0);
  const pos = (v: number) => (v / max) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranges shown</CardTitle>
        <CardDescription>
          {rows.length} postings out of {APPLICATIONS.length} show a band
          {floor ? ` · the vertical line is the ${money(floor)} floor` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col gap-2">
          {rows.map((l) => {
            const s = statusOf(l.status);
            const underFloor = floor != null && l.max < floor;
            return (
              // Below sm, company and amount took 208 px out of 350, leaving
              // almost nothing for the bar. The side columns tighten, and the
              // name truncates rather than crushing the bar.
              <div
                key={l.company}
                className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2 sm:grid-cols-[7.5rem_1fr_5.5rem] sm:gap-3"
              >
                <span className="truncate text-sm" style={{ color: "var(--ink-2)" }} title={l.company}>
                  {l.company}
                </span>
                <div className="relative h-3">
                  {floor != null && (
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-px"
                      style={{ left: `${pos(floor)}%`, background: "var(--axis)" }}
                      aria-hidden
                    />
                  )}
                  <div
                    className="absolute h-2 rounded-full"
                    style={{
                      left: `${pos(l.min)}%`,
                      width: `${Math.max(pos(l.max) - pos(l.min), 1.5)}%`,
                      top: 2,
                      background: s.color,
                      opacity: underFloor ? 0.4 : 1,
                    }}
                    title={`${s.label}: ${money(l.min)} to ${money(l.max)}`}
                  />
                </div>
                <span className="tabular text-right text-xs whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>
                  {money(l.min)}–{money(l.max)}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
        >
          {Object.entries(STATUSES)
            .filter(([k]) => rows.some((l) => l.status === k))
            .map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span aria-hidden style={{ color: s.color }}>
                  {s.icon}
                </span>
                {s.label}
              </span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
