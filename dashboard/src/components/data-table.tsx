import { useState } from "react";
import {
  flexRender, getCoreRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel,
  useReactTable, type Column, type ColumnDef, type ColumnFiltersState, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, ListFilter, Search, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Multi-select filter on a column: an empty selection means "everything". */
export const inSet = (row: any, id: string, value: string[]) => !value?.length || value.includes(String(row.getValue(id)));

export function SortHeader<T>({ column, title, className }: { column: Column<T, unknown>; title: string; className?: string }) {
  const s = column.getIsSorted();
  return (
    <Button variant="ghost" size="sm" className={cn("-ml-2 h-8 px-2", className)} onClick={() => column.toggleSorting(s === "asc")}>
      {title}
      {s === "asc" ? <ArrowUp /> : s === "desc" ? <ArrowDown /> : <ChevronsUpDown className="opacity-40" />}
    </Button>
  );
}

export type Facet = { column: string; title: string; label?: (v: string) => React.ReactNode };

function FacetFilter<T>({ column, title, label }: { column: Column<T, unknown>; title: string; label?: (v: string) => React.ReactNode }) {
  const values = [...column.getFacetedUniqueValues().entries()].sort((a, b) => b[1] - a[1]);
  const selected = new Set((column.getFilterValue() as string[]) ?? []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <ListFilter />
          {title}
          {selected.size > 0 && <Badge variant="secondary" className="ml-0.5 rounded-sm px-1.5 font-normal">{selected.size}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {values.map(([v, count]) => (
          <DropdownMenuCheckboxItem
            key={String(v)}
            checked={selected.has(String(v))}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => {
              const next = new Set(selected);
              if (on) next.add(String(v)); else next.delete(String(v));
              column.setFilterValue(next.size ? [...next] : undefined);
            }}
          >
            <span className="flex flex-1 items-center gap-2 truncate">{label ? label(String(v)) : String(v)}</span>
            <span className="text-muted-foreground tabular ml-auto text-xs">{count}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DataTable<T>({
  data, columns, facets = [], searchPlaceholder = "Search…", initialSorting = [], initialVisibility = {},
  onRowClick, pageSize = 20, empty = "No results.",
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  facets?: Facet[];
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  initialVisibility?: VisibilityState;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  empty?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize } },
  });

  const filtered = globalFilter || columnFilters.length > 0;
  const { pageIndex } = table.getState().pagination;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" />
        </div>
        {facets.map((f) => {
          const col = table.getColumn(f.column);
          return col ? <FacetFilter key={f.column} column={col} title={f.title} label={f.label} /> : null;
        })}
        {filtered && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setGlobalFilter(""); setColumnFilters([]); }}>
            Reset <X />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto hidden h-9 sm:flex">
              <Columns3 /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllColumns().filter((c) => c.getCanHide()).map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                {(c.columnDef.meta as any)?.label ?? c.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={(h.column.columnDef.meta as any)?.className}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef.meta as any)?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">{empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {table.getFilteredRowModel().rows.length} row{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
          {filtered ? ` of ${data.length}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular hidden sm:inline">
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
