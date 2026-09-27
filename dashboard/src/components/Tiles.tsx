import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { APPLICATIONS, responseRate, countByStatus } from "@/lib/metrics";

function Tile({
  value,
  label,
  detail,
  accent,
  className,
}: {
  value: string | number;
  label: string;
  detail?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <div className="text-2xl font-semibold leading-none sm:text-3xl" style={{ color: accent ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="mt-2 text-sm font-medium text-balance" style={{ color: "var(--ink-2)" }}>
        {label}
      </div>
      {detail && (
        <div className="mt-0.5 text-xs text-pretty" style={{ color: "var(--ink-muted)" }}>
          {detail}
        </div>
      )}
    </Card>
  );
}

export function Tiles() {
  const byStatus = countByStatus(APPLICATIONS);
  const rate = responseRate(APPLICATIONS);
  const toFinish = byStatus.find((s) => s.status === "to_finish")!.n;
  const interviews = byStatus.find((s) => s.status === "interview")!.n;

  // 5 tiles on 2 columns left the last one orphaned on its row. It spans the
  // full width until there are 5 columns, which makes it read as an alert
  // banner rather than a leftover.
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile value={rate.sent} label="Applications sent" detail={`${APPLICATIONS.length} rows in total`} />
      <Tile
        value={byStatus.find((s) => s.status === "applied")!.n}
        label="Waiting for an answer"
        detail="No reply so far"
      />
      <Tile
        value={interviews}
        label={interviews === 1 ? "Interview" : "Interviews"}
        detail={interviews ? "Process engaged" : "None yet"}
        accent={interviews ? "var(--st-good)" : undefined}
      />
      <Tile
        value={`${Math.round(rate.rate * 100)} %`}
        label="Response rate"
        detail={`${rate.answered} answers out of ${rate.sent} sent`}
      />
      <Tile
        value={toFinish}
        label="To handle"
        detail={toFinish ? "prepared but never sent" : "nothing pending"}
        accent={toFinish > 0 ? "var(--st-attention)" : undefined}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}
