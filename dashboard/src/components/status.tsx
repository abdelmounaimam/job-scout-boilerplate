import { Ban, CalendarCheck2, CircleHelp, Clock3, DoorClosed, PencilLine, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusOf, type Status } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Every status has an icon AND a label: colour never carries meaning alone
 *  (the status hues fail the dataviz validator as a categorical palette). */
export const STATUS_ICON: Record<Status, LucideIcon> = {
  applied: Clock3,
  interview: CalendarCheck2,
  to_finish: PencilLine,
  closed: DoorClosed,
  rejected: XCircle,
  withdrawn: Ban,
};

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const Icon = STATUS_ICON[status as Status] ?? CircleHelp;
  return <Icon className={cn("size-3.5 shrink-0", className)} style={{ color: statusOf(status).color }} aria-hidden />;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const d = statusOf(status);
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)} title={d.help}>
      <StatusIcon status={status} />
      {d.label}
    </Badge>
  );
}
