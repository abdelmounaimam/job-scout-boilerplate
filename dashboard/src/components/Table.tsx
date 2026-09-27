import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { APPLICATIONS, STATUS_ORDER, STATUSES, statusOf, daysSince, money, type Status } from "@/lib/metrics";

/** The table is also the "fallback" the dataviz skill demands: three status
 *  colours fall under 3:1 on the light background, so a reading without colour
 *  must exist. This is it. */
export function Table() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APPLICATIONS.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return `${c.company} ${c.role} ${c.source} ${c.remote}`.toLowerCase().includes(q);
    });
  }, [query, filter]);

  const chip = (active: boolean) => ({
    borderColor: "var(--border)",
    background: active ? "var(--grid)" : "transparent",
    color: "var(--ink-2)",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All applications</CardTitle>
        <CardDescription>
          {rows.length} of {APPLICATIONS.length} · clicking a company opens the posting
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-52 flex-1">
            <Input
              placeholder="Search a company, a role, a source…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")} className="rounded-md border px-2.5 py-1 text-xs font-medium" style={chip(filter === "all")}>
              All
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
                style={chip(filter === s)}
              >
                <span aria-hidden style={{ color: STATUSES[s].color }}>
                  {STATUSES[s].icon}
                </span>
                {STATUSES[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrolls BOTH ways, inside the block:
            - horizontally, because 5 columns do not fit under 720px and the
              page itself must never scroll sideways;
            - vertically, bounded, because dozens of rows lengthened the page
              endlessly and pushed the footer out of reach.
            The header stays sticky, or the column names are lost after ten
            rows. */}
        <div className="max-h-[32rem] overflow-auto overscroll-contain rounded-md">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10" style={{ background: "var(--surface)" }}>
              <tr style={{ color: "var(--ink-muted)" }} className="text-left text-xs">
                {["Company", "Role", "Status", "Sent", "Salary shown"].map((h) => (
                  <th key={h} className="border-b pb-2 font-medium" style={{ borderColor: "var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = statusOf(c.status);
                return (
                  <tr key={c.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3 font-medium">
                      {c.link ? (
                        <a href={c.link} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                          {c.company}
                        </a>
                      ) : (
                        c.company
                      )}
                    </td>
                    <td className="max-w-72 py-2 pr-3" style={{ color: "var(--ink-2)" }}>
                      {c.role}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge color={s.color} title={s.help}>
                        <span aria-hidden>{s.icon}</span>
                        {s.label}
                      </Badge>
                    </td>
                    <td className="tabular py-2 pr-3 whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                      {c.date}
                      <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                        {daysSince(c.date)} days ago
                      </span>
                    </td>
                    <td className="tabular py-2 pr-3 whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                      {c.salary ? (
                        `${money(c.salary.min, c.salary.currency)}–${money(c.salary.max, c.salary.currency)}`
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>not shown</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                    {APPLICATIONS.length ? "No application matches." : "No application yet. The first row of applications.csv will show here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
