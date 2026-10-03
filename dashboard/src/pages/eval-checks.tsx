import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, SortHeader, inSet } from "@/components/data-table";
import { CHANNELS, RECORDS, failureKind, fmtDate, isUnsourced, type TextRecord } from "@/lib/evals";
import { navigate } from "@/lib/router";

type Row = TextRecord & { kinds: string[]; failures: number; channelLabel: string };
type Claim = { text: string; source: string; company: string; id: string; date: string };

const rows: Row[] = RECORDS.map((r) => {
  const f = r.checks?.ok === false ? r.checks.failures : [];
  return { ...r, kinds: [...new Set(f.map(failureKind))], failures: f.length, channelLabel: CHANNELS[r.channel] ?? r.channel };
});

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "date", meta: { label: "Date", className: "w-24" }, header: ({ column }) => <SortHeader column={column} title="Date" />, cell: ({ getValue }) => <span className="tabular text-muted-foreground whitespace-nowrap">{fmtDate(getValue())}</span> },
  {
    accessorKey: "company", meta: { label: "Company" }, header: ({ column }) => <SortHeader column={column} title="Company" />,
    cell: ({ row }) => (
      <div className="max-w-[14rem] min-w-0">
        <div className="truncate font-medium">{row.original.company}</div>
        <div className="text-muted-foreground truncate text-xs">{row.original.question ?? row.original.role}</div>
      </div>
    ),
  },
  { accessorKey: "channelLabel", meta: { label: "Channel", className: "hidden md:table-cell" }, header: "Channel", filterFn: inSet, cell: ({ getValue }) => <Badge variant="secondary" className="font-normal">{getValue()}</Badge> },
  {
    id: "kind", accessorFn: (r) => r.kinds[0] ?? "Passing", meta: { label: "Failures" }, header: "Failures",
    // Filter on ANY of the row's failure kinds, not just the first.
    filterFn: (row, _id, value: string[]) => !value?.length || value.some((v) => (v === "Passing" ? !row.original.kinds.length : row.original.kinds.includes(v))),
    getUniqueValues: (r) => (r.kinds.length ? r.kinds : ["Passing"]),
    cell: ({ row }) => row.original.kinds.length ? (
      <div className="flex max-w-[22rem] flex-wrap gap-1">{row.original.kinds.map((k) => <Badge key={k} variant="outline" className="font-normal">{k}</Badge>)}</div>
    ) : <span className="flex items-center gap-1 text-xs text-[var(--st-good)]"><ShieldCheck className="size-3.5" /> passing</span>,
  },
  { accessorKey: "failures", meta: { label: "Count", className: "text-right" }, header: ({ column }) => <SortHeader column={column} title="#" className="ml-auto" />, cell: ({ getValue }) => <span className="tabular block text-right">{getValue()}</span> },
];

const claimColumns: ColumnDef<Claim, any>[] = [
  { accessorKey: "text", meta: { label: "Claim" }, header: "Claim", cell: ({ getValue }) => <span className="line-clamp-2 max-w-[28rem]">{getValue()}</span> },
  { accessorKey: "source", meta: { label: "Source given", className: "hidden md:table-cell" }, header: "Source given", cell: ({ getValue }) => <Badge variant="destructive" className="font-mono text-[11px]">{getValue() || "none"}</Badge> },
  { accessorKey: "company", meta: { label: "Company" }, header: ({ column }) => <SortHeader column={column} title="Company" />, cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
  { accessorKey: "date", meta: { label: "Date", className: "hidden sm:table-cell" }, header: ({ column }) => <SortHeader column={column} title="Date" />, cell: ({ getValue }) => <span className="tabular text-muted-foreground whitespace-nowrap">{fmtDate(getValue())}</span> },
];

export function EvalChecksPage() {
  const [tab, setTab] = useState("texts");
  const claims = useMemo<Claim[]>(() => RECORDS.flatMap((r) => (r.claims ?? []).filter(isUnsourced).map((c) => ({ text: c.text, source: c.source, company: r.company, id: r.id, date: r.date }))), []);
  const failing = rows.filter((r) => r.failures).length;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checks</h1>
        <p className="text-muted-foreground text-sm">
          What <code>evals/check.mjs</code> blocks before a text reaches you: dashes, language, length, current salary, notice period,
          a posting line quoted, and every claim and number traced to the story catalogue. Results as recorded in each record's{" "}
          <code>checks</code> field.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4 text-[var(--st-critical)]" />{failing} of {RECORDS.length} texts fail at least one check</CardTitle>
          <CardDescription>Click a row to open the text in the review queue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="texts">Texts</TabsTrigger>
              <TabsTrigger value="claims">Unsourced claims <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{claims.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="texts" className="pt-3">
              <DataTable
                data={rows}
                columns={columns}
                facets={[{ column: "kind", title: "Failure" }, { column: "channelLabel", title: "Channel" }]}
                initialSorting={[{ id: "failures", desc: true }]}
                onRowClick={(r) => navigate({ page: "eval-review", id: r.id })}
                searchPlaceholder="Search company or question…"
              />
            </TabsContent>
            <TabsContent value="claims" className="pt-3">
              <p className="text-muted-foreground mb-3 text-sm">
                Facts in texts whose source is not an id of <code>profile/stories.md</code>. Either a gap in the catalogue (add the row,
                with its source, once you validated it) or a fabrication (score its truth low and add it to the known don'ts).
              </p>
              <DataTable data={claims} columns={claimColumns} initialSorting={[{ id: "date", desc: true }]} onRowClick={(c) => navigate({ page: "eval-review", id: c.id })} searchPlaceholder="Search a claim…" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
