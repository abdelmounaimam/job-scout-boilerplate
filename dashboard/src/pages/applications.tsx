import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, FileText, MapPin, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, SortHeader, inSet } from "@/components/data-table";
import { StatusBadge } from "@/components/status";
import { APPLICATIONS, daysSince, money, statusOf, type Application } from "@/lib/metrics";
import { CHANNELS, RECORDS, TEXT_STATUS, fmtDate, sameCompany } from "@/lib/evals";
import { useIsMobile } from "@/hooks/use-mobile";

/** A salary band in the profile's locale, "€60K to €80K". */
export const band = (c: Application) => (c.salary ? `${money(c.salary.min, c.salary.currency)} to ${money(c.salary.max, c.salary.currency)}` : "");

const columns: ColumnDef<Application, any>[] = [
  {
    accessorKey: "date",
    meta: { label: "Date", className: "w-24" },
    header: ({ column }) => <SortHeader column={column} title="Date" />,
    cell: ({ row }) => <span className="tabular text-muted-foreground whitespace-nowrap">{fmtDate(row.original.date)}</span>,
  },
  {
    accessorKey: "company",
    meta: { label: "Company" },
    header: ({ column }) => <SortHeader column={column} title="Company" />,
    cell: ({ row }) => (
      <div className="max-w-[16rem] min-w-0">
        <div className="truncate font-medium">{row.original.company}</div>
        <div className="text-muted-foreground truncate text-xs md:hidden">{row.original.role}</div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    meta: { label: "Role", className: "hidden md:table-cell" },
    header: "Role",
    cell: ({ getValue }) => <span className="line-clamp-1 max-w-[22rem]">{getValue()}</span>,
  },
  {
    accessorKey: "status",
    meta: { label: "Status" },
    header: ({ column }) => <SortHeader column={column} title="Status" />,
    filterFn: inSet,
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  },
  {
    accessorKey: "sourceFamily",
    meta: { label: "Source", className: "hidden lg:table-cell" },
    header: "Source",
    filterFn: inSet,
    cell: ({ getValue }) => <Badge variant="secondary" className="font-normal">{getValue()}</Badge>,
  },
  // Hidden on purpose: it only exists so the search box also matches the notes.
  { accessorKey: "notes", header: "Notes", enableHiding: false, enableSorting: false },
  {
    id: "salary",
    accessorFn: (c) => c.salary?.max ?? 0,
    meta: { label: "Salary band", className: "hidden xl:table-cell" },
    header: ({ column }) => <SortHeader column={column} title="Band" />,
    cell: ({ row }) => <span className="tabular text-muted-foreground whitespace-nowrap">{band(row.original) || "not shown"}</span>,
  },
];

export function ApplicationsPage() {
  const [open, setOpen] = useState<Application | null>(null);
  const isMobile = useIsMobile();
  const data = useMemo(() => APPLICATIONS, []);
  const texts = open ? RECORDS.filter((r) => sameCompany(r.company, open.company)) : [];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm">Every tracker row. Click a row for the full notes.</p>
      </div>
      <Card>
        <CardContent>
          <DataTable
            key={String(isMobile)}
            data={data}
            columns={columns}
            facets={[
              { column: "status", title: "Status", label: (v) => <StatusBadge status={v} className="border-0 px-0" /> },
              { column: "sourceFamily", title: "Source" },
            ]}
            searchPlaceholder="Search company, role, notes…"
            initialSorting={[{ id: "date", desc: true }]}
            initialVisibility={{ notes: false }}
            onRowClick={setOpen}
            empty="No application yet: the tracker is empty."
          />
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{open.company}</SheetTitle>
                <SheetDescription>{open.role}</SheetDescription>
                <div className="flex flex-wrap gap-2 pt-1">
                  <StatusBadge status={open.status} />
                  <Badge variant="secondary">{open.sourceFamily}</Badge>
                  <Badge variant="outline" className="tabular">{fmtDate(open.date)} · {daysSince(open.date)} days ago</Badge>
                </div>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-6 text-sm">
                <p className="text-muted-foreground text-xs">{statusOf(open.status).help}</p>
                <dl className="grid gap-3">
                  {open.remote && <Info icon={MapPin} label="Location / remote" value={open.remote} />}
                  {open.salaryRaw && <Info icon={Wallet} label="Salary shown" value={open.salaryRaw} />}
                  {open.cv && <Info icon={FileText} label="Resume version sent" value={open.cv} />}
                </dl>
                {open.link && (
                  <Button variant="outline" asChild className="self-start">
                    <a href={open.link} target="_blank" rel="noreferrer">Open the posting <ExternalLink /></a>
                  </Button>
                )}
                {texts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="font-medium">Free texts written for it</h3>
                    {texts.map((r) => (
                      <a key={r.id} href={`#/evaluations/review/${encodeURIComponent(r.id)}`} className="hover:bg-muted/60 rounded-lg border p-2.5 text-xs">
                        <span className="font-medium">{r.question ?? CHANNELS[r.channel] ?? r.channel}</span>
                        <span className="text-muted-foreground"> · {fmtDate(r.date)} · {TEXT_STATUS[r.status] ?? r.status}{r.checks?.ok === false ? " · failing checks" : ""}</span>
                      </a>
                    ))}
                  </div>
                )}
                {open.notes && (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-medium">Notes</h3>
                    <p className="text-muted-foreground bg-muted/40 rounded-lg border p-3 leading-relaxed whitespace-pre-wrap">{open.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="break-words">{value}</dd>
      </div>
    </div>
  );
}
