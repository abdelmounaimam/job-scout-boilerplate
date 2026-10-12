import { APPLICATIONS, funnel, SILENCE_DAYS } from "@/lib/metrics";
import { layout, HEIGHT, WIDTH, NODE_WIDTH } from "@/lib/funnel-layout";

/** Sankey diagram of the application funnel.
 *
 *  This file only draws. All the geometry lives in `@/lib/funnel-layout`, so it
 *  can be checked by computation: `bun run check-funnel` controls overlaps,
 *  sums and framing without a browser.
 *
 *  It answers a question no other block asks: out of a hundred applications
 *  sent, how many get an interview? */

/** Outline in the card's colour, so a label sitting on a ribbon stays readable
 *  without an opaque background. */
const HALO = { paintOrder: "stroke" as const, stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" as const };

export function Funnel() {
  const root = funnel(APPLICATIONS);
  if (!root.n) {
    return <p className="text-muted-foreground text-sm">The funnel appears with the first application in the tracker.</p>;
  }
  const { nodes, ribbons } = layout(root);
  const sent = root.children.find((e) => e.key === "sent")!;
  const interviews = sent.children.find((e) => e.key === "interview")!;
  const rate = sent.n ? (interviews.n / sent.n) * 100 : 0;
  const offers = interviews.children.find((e) => e.key === "offer")?.n ?? 0;

  return (
    <div>
      {/* Below 880 px the labels become unreadable, so the chart scrolls rather
          than shrinks; the sentence under it reads without the chart. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[880px]"
          role="img"
          aria-label={`Application funnel: ${root.n} prepared, ${sent.n} sent, ${interviews.n} interviews obtained, ${offers} offers`}
        >
          {ribbons.map((r) => (
            <path key={r.key} d={r.d} fill={r.color} className="[fill-opacity:0.16] transition-[fill-opacity] duration-150 hover:[fill-opacity:0.38]">
              <title>{r.title}</title>
            </path>
          ))}
          {nodes.map((n) => (
            <g key={n.key}>
              <rect x={n.x} y={n.y} width={NODE_WIDTH} height={Math.max(n.h, 2)} rx={3} fill={n.color}>
                <title>{`${n.label} · ${n.n} · ${n.help}`}</title>
              </rect>
              {n.leaf ? (
                // Exit column: one line, the number first, because it is the
                // column the eye runs down.
                <text x={n.x + NODE_WIDTH + 10} y={n.y + n.h / 2} dominantBaseline="middle" fontSize={11.5} fill="var(--muted-foreground)">
                  <tspan fontWeight={600} fill="var(--foreground)" className="tabular">{n.n}</tspan>
                  <tspan dx={6}>{n.label}</tspan>
                </text>
              ) : (
                // Pass-through node: two lines sitting on the ribbon.
                <text x={n.x + NODE_WIDTH + 12} y={n.y + n.h / 2} style={HALO}>
                  <tspan x={n.x + NODE_WIDTH + 12} dy={-2} fontSize={17} fontWeight={600} fill="var(--foreground)" className="tabular">{n.n}</tspan>
                  <tspan x={n.x + NODE_WIDTH + 12} dy={15} fontSize={11.5} fill="var(--muted-foreground)">{n.label}</tspan>
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed text-pretty">
        <strong className="text-foreground">
          {interviews.n} interview{interviews.n === 1 ? "" : "s"} out of {sent.n} sent, {rate.toFixed(1)}%{offers ? `, and ${offers} offer${offers > 1 ? "s" : ""}` : ""}.
        </strong>{" "}
        Furthest stage reached, not the latest status: an interview stays counted even if the process stopped after it. A silence
        beyond {SILENCE_DAYS} days counts as a rejection that was never written.
      </p>
    </div>
  );
}
