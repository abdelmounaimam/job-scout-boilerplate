import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATIONS, CONFIG, STATUSES, chasersDue, daysSince, type Application } from "@/lib/metrics";

/** The panel that answers the only question that matters on a Monday morning:
 *  what do I have to do today? */
export function Actions() {
  const toFinish = APPLICATIONS.filter((c) => c.status === "to_finish");
  // ⚠️ The ball is in MY court: the company answered and is waiting. This is not
  // a chaser, it is the opposite. See MY_COURT_MARKER in build-data.mjs.
  // Oldest first: the oldest delay is the one that costs.
  const myCourt = APPLICATIONS.filter((c) => c.myCourt).sort((a, b) => daysSince(b.date) - daysSince(a.date));
  // ⚠️ Chasers exist ONLY when the profile sets RULES.followUps to a number of
  // days. With the default 'never' this list is empty and the block does not
  // render at all: a page that offers chasers ends up sending them.
  const chasers = chasersDue(APPLICATIONS);
  const nothing = !toFinish.length && !myCourt.length && !chasers.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>To handle</CardTitle>
        <CardDescription>What is waiting for a move from you</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {nothing && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Nothing to do today.
          </p>
        )}

        {myCourt.length > 0 && (
          <Section title={`They are waiting for your reply (${myCourt.length})`} icon="⏳" color={STATUSES.interview.color} rows={myCourt} />
        )}

        {toFinish.length > 0 && (
          <Section
            title={`Ready, never sent (${toFinish.length})`}
            icon={STATUSES.to_finish.icon}
            color={STATUSES.to_finish.color}
            rows={toFinish}
          />
        )}

        {chasers.length > 0 && (
          <Section
            title={`Chasers due, ${CONFIG.followUps}+ days of silence (${chasers.length})`}
            icon={STATUSES.applied.icon}
            color={STATUSES.applied.color}
            rows={chasers}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, icon, color, rows }: { title: string; icon: string; color: string; rows: Application[] }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-2)" }}>
        <span aria-hidden style={{ color }}>
          {icon}
        </span>
        {title}
      </h4>
      {/* Below sm, the role goes UNDER the company name: side by side, a long
          title like "Full-Stack Engineer, Office of the CEO" crushed the name
          one wants to read first. */}
      <ul className="flex flex-col gap-1.5">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <a href={c.link} target="_blank" rel="noreferrer" className="truncate font-medium underline-offset-2 hover:underline">
              {c.company}
            </a>
            <span className="truncate text-xs sm:shrink-0 sm:text-right" style={{ color: "var(--ink-muted)" }} title={c.role}>
              {c.role}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
