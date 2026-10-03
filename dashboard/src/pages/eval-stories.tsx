import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, SortHeader, inSet } from "@/components/data-table";
import { CHANNELS, RECORDS, STORIES, fmtDate, humanScores, latestByRecord, mean, useScores, type Story } from "@/lib/evals";

type Row = Story & { uses: number; lastUsed: string; truth: number | null; choice: number | null; kind: string };

export function EvalStoriesPage() {
  const { data } = useScores();
  const latest = latestByRecord(humanScores(data));
  const [open, setOpen] = useState<Row | null>(null);

  const rows: Row[] = STORIES.map((s) => {
    const rs = RECORDS.filter((r) => r.stories?.includes(s.id) || r.claims?.some((c) => c.source === s.id));
    const sc = rs.map((r) => latest.get(r.id)).filter(Boolean);
    return {
      ...s,
      kind: s.type === "story" ? "Story" : "Fact",
      uses: rs.length,
      lastUsed: rs.map((r) => r.date).sort().at(-1) ?? "",
      truth: mean(sc.map((x) => x!.axes.truth)),
      choice: mean(sc.map((x) => x!.axes.story_choice)),
    };
  });

  const score = (v: number | null) => <span className="tabular text-muted-foreground">{v == null ? "none" : v.toFixed(1)}</span>;
  const columns: ColumnDef<Row, any>[] = [
    { accessorKey: "id", meta: { label: "Id" }, header: ({ column }) => <SortHeader column={column} title="Id" />, cell: ({ getValue }) => <Badge variant="secondary" className="font-mono text-[11px]">{getValue()}</Badge> },
    { accessorKey: "title", meta: { label: "Story" }, header: "Story", cell: ({ getValue }) => <span className="line-clamp-2 max-w-[26rem]">{getValue()}</span> },
    { accessorKey: "kind", meta: { label: "Type", className: "hidden md:table-cell" }, header: "Type", filterFn: inSet },
    { accessorKey: "uses", meta: { label: "Uses", className: "text-right" }, header: ({ column }) => <SortHeader column={column} title="Uses" />, cell: ({ getValue }) => <span className="tabular block text-right font-medium">{getValue()}</span> },
    { accessorKey: "truth", meta: { label: "Truth", className: "hidden sm:table-cell text-right" }, header: ({ column }) => <SortHeader column={column} title="Truth" />, cell: ({ getValue }) => <span className="block text-right">{score(getValue())}</span>, sortUndefined: "last" },
    { accessorKey: "choice", meta: { label: "Story choice", className: "hidden lg:table-cell text-right" }, header: ({ column }) => <SortHeader column={column} title="Choice" />, cell: ({ getValue }) => <span className="block text-right">{score(getValue())}</span> },
    { accessorKey: "lastUsed", meta: { label: "Last used", className: "hidden lg:table-cell" }, header: ({ column }) => <SortHeader column={column} title="Last used" />, cell: ({ getValue }) => <span className="tabular text-muted-foreground whitespace-nowrap">{getValue() ? fmtDate(getValue()) : "never"}</span> },
  ];

  const texts = open ? RECORDS.filter((r) => r.stories?.includes(open.id) || r.claims?.some((c) => c.source === open.id)) : [];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stories</h1>
        <p className="text-muted-foreground text-sm">
          The catalogue of <code>profile/stories.md</code>: the only stories and facts a text may use, how often each one is used, and how it scores.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{STORIES.filter((s) => s.type === "story").length} stories, {STORIES.filter((s) => s.type === "fact").length} facts</CardTitle>
          <CardDescription>A story that scores low on truth or choice is a candidate to rewrite, restrict or retire.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable data={rows} columns={columns} facets={[{ column: "kind", title: "Type" }]} initialSorting={[{ id: "uses", desc: true }]} onRowClick={setOpen} searchPlaceholder="Search a story…" empty="The catalogue is empty: profile/stories.md holds no [ST-…] or [FACT-…] row yet." />
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <Badge variant="secondary" className="w-fit font-mono">{open.id}</Badge>
                <SheetTitle className="text-lg leading-snug">{open.title}</SheetTitle>
                {open.proves && <SheetDescription>Proves: {open.proves}</SheetDescription>}
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-6 text-sm">
                {open.facts && (
                  <div><h3 className="mb-1 font-medium">Citable facts</h3><p className="text-muted-foreground">{open.facts}</p></div>
                )}
                <div><h3 className="mb-1 font-medium">Source</h3><p className="text-muted-foreground">{open.source}</p></div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium">Used in {texts.length} text{texts.length === 1 ? "" : "s"}</h3>
                  {texts.map((r) => (
                    <a key={r.id} href={`#/evaluations/review/${encodeURIComponent(r.id)}`} className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <span className="min-w-0 truncate"><b>{r.company}</b> <span className="text-muted-foreground">· {CHANNELS[r.channel] ?? r.channel}</span></span>
                      <span className="tabular text-muted-foreground shrink-0 text-xs">{fmtDate(r.date)}</span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
