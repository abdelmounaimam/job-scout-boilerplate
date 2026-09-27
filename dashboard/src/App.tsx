import { useEffect, useState } from "react";
import { Tiles } from "@/components/Tiles";
import { Funnel } from "@/components/Funnel";
import { StatusBreakdown, SourceBreakdown } from "@/components/Breakdown";
import { Timeline } from "@/components/Timeline";
import { Actions } from "@/components/Actions";
import { Salaries } from "@/components/Salaries";
import { Table } from "@/components/Table";
import { CONFIG, GENERATED_AT } from "@/lib/metrics";

function ThemeButton() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    if (dark === null) return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <button
      onClick={() => setDark((v) => (v === null ? !window.matchMedia("(prefers-color-scheme: dark)").matches : !v))}
      className="rounded-md border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
      aria-label="Toggle theme"
    >
      Theme
    </button>
  );
}

function generatedOn() {
  try {
    return new Date(GENERATED_AT).toLocaleString(CONFIG.locale, { dateStyle: "long", timeStyle: "short" });
  } catch {
    return GENERATED_AT;
  }
}

export default function App() {
  useEffect(() => {
    document.title = `${CONFIG.title} dashboard`;
  }, []);

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{CONFIG.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Read from <code>applications/applications.csv</code> · data of {generatedOn()}
          </p>
        </div>
        <ThemeButton />
      </header>

      <div className="flex flex-col gap-4">
        <Tiles />

        <Funnel />

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Actions />
          <StatusBreakdown />
        </div>

        <Timeline />

        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <SourceBreakdown />
          <Salaries />
        </div>

        <Table />
      </div>

      <footer className="mt-8 text-xs" style={{ color: "var(--ink-muted)" }}>
        The dashboard changes nothing: <code>applications.csv</code> stays the source of truth. Run{" "}
        <code>bun run data</code> after a scan, or keep <code>bun dev</code> running, which reloads by itself when the CSV
        changes.
      </footer>
    </div>
  );
}
