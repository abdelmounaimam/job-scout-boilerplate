import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Kpi({
  label, value, hint, icon: Icon, tone, className,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon; tone?: string; className?: string }) {
  return (
    <Card className={cn("@container/card shadow-xs", className)}>
      <CardHeader className="gap-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardDescription className="min-w-0 truncate" title={label}>{label}</CardDescription>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/60"
            style={tone ? { color: tone } : undefined}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <CardTitle className="tabular text-2xl font-semibold @[220px]/card:text-3xl" style={tone ? { color: tone } : undefined}>
          {value}
        </CardTitle>
        {hint && <p className="text-muted-foreground line-clamp-2 text-xs">{hint}</p>}
      </CardHeader>
    </Card>
  );
}
