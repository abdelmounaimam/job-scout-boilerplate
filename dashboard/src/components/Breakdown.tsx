import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { APPLICATIONS, countByStatus, perSourceFamily } from "@/lib/metrics";

/** Labelled horizontal bars.
 *
 *  Deliberate choice of form: NO pie or donut for the statuses. The dataviz
 *  skill's validator fails on these status hues treated as a categorical
 *  palette (colour-blind separation ΔE 4.1 in deuteranopia between the green
 *  "interview" and the red "rejected", 13.6 in normal vision between "posting
 *  closed" and "to finish"). A pie would put the meaning on colour alone, which
 *  is exactly what fails. Here every row carries icon + label + number: colour
 *  only reinforces. */
function BarRow({
  label,
  icon,
  color,
  n,
  total,
  help,
}: {
  label: string;
  icon?: string;
  color: string;
  n: number;
  total: number;
  help?: string;
}) {
  const pct = total ? (n / total) * 100 : 0;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1" title={help}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span aria-hidden className="text-xs" style={{ color }}>
            {icon}
          </span>
        )}
        <span className="truncate text-sm" style={{ color: "var(--ink-2)" }}>
          {label}
        </span>
      </div>
      <span className="tabular text-sm font-medium">{n}</span>
      <div className="col-span-2 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--grid)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, minWidth: n ? 4 : 0 }} />
      </div>
    </div>
  );
}

export function StatusBreakdown() {
  const rows = countByStatus(APPLICATIONS);
  const total = APPLICATIONS.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the applications stand</CardTitle>
        <CardDescription>{total} rows · an icon and a label per status, colour only reinforces</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((l) => (
          <BarRow key={l.status} label={l.label} icon={l.icon} color={l.color} n={l.n} total={total} help={l.help} />
        ))}
      </CardContent>
    </Card>
  );
}

const ORDINAL = ["var(--ordinal-4)", "var(--ordinal-3)", "var(--ordinal-2)", "var(--ordinal-1)"];

/** Sources are a magnitude, not identities: one blue hue dosed by rank, never
 *  one colour per source. */
export function SourceBreakdown() {
  const rows = perSourceFamily(APPLICATIONS);
  const total = APPLICATIONS.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the postings come from</CardTitle>
        <CardDescription>One hue, dosed by rank: it is a magnitude, not identities</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!rows.length && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            No application yet.
          </p>
        )}
        {rows.map((l, i) => (
          <BarRow
            key={l.name}
            label={l.name}
            color={ORDINAL[Math.min(i, ORDINAL.length - 1)]}
            n={l.n}
            total={total}
            help={l.interviews ? `${l.interviews} interview(s) from this source` : undefined}
          />
        ))}
      </CardContent>
    </Card>
  );
}
