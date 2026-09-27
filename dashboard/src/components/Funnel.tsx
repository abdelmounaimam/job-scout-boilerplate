import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
const HALO = {
  paintOrder: "stroke" as const,
  stroke: "var(--surface)",
  strokeWidth: 3,
  strokeLinejoin: "round" as const,
};

export function Funnel() {
  const root = funnel(APPLICATIONS);
  const { nodes, ribbons } = layout(root);

  const sent = root.children.find((e) => e.key === "sent")!;
  const interviews = sent.children.find((e) => e.key === "interview")!;
  const interviewRate = sent.n ? (interviews.n / sent.n) * 100 : 0;
  const pct = { format: (v: number) => v.toFixed(1) };

  return (
    <Card>
      <CardHeader>
        <CardTitle>What becomes of the applications</CardTitle>
        <CardDescription>
          The furthest stage reached, not the last status · an interview obtained still counts as such even when the
          process stopped afterwards
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!root.n ? (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            The funnel appears with the first application in the tracker.
          </p>
        ) : (
          <>
            {/* The diagram does not shrink under 880 px: below that the labels
                become unreadable, so it scrolls rather than shrinks. The text
                summary under the chart reads without it. */}
            <div className="-mx-1 overflow-x-auto px-1">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="h-auto w-full min-w-[880px]"
                role="img"
                aria-label={`Application funnel: ${root.n} prepared, ${sent.n} sent, ${interviews.n} interviews obtained`}
              >
                {ribbons.map((r) => (
                  <path
                    key={r.key}
                    d={r.d}
                    fill={r.color}
                    className="[fill-opacity:0.18] transition-[fill-opacity] duration-150 hover:[fill-opacity:0.4]"
                  >
                    <title>{r.title}</title>
                  </path>
                ))}

                {nodes.map((n) => (
                  <g key={n.key}>
                    <rect x={n.x} y={n.y} width={NODE_WIDTH} height={Math.max(n.h, 2)} rx={2} fill={n.color}>
                      <title>{`${n.label} · ${n.n} · ${n.help}`}</title>
                    </rect>

                    {n.leaf ? (
                      // Exit column: one line, right of the edge and outside
                      // the drawing. The number first, because it is the
                      // column the eye runs down.
                      <text x={n.x + NODE_WIDTH + 10} y={n.y + n.h / 2} dominantBaseline="middle" fontSize={11.5} fill="var(--ink-2)">
                        <tspan fontWeight={600} fill="var(--ink)" className="tabular">
                          {n.n}
                        </tspan>
                        <tspan dx={6}>{n.label}</tspan>
                      </text>
                    ) : (
                      // Pass-through node: two lines sitting on the ribbon.
                      <text x={n.x + NODE_WIDTH + 12} y={n.y + n.h / 2} style={HALO}>
                        <tspan x={n.x + NODE_WIDTH + 12} dy={-2} fontSize={17} fontWeight={600} fill="var(--ink)" className="tabular">
                          {n.n}
                        </tspan>
                        <tspan x={n.x + NODE_WIDTH + 12} dy={15} fontSize={11.5} fill="var(--ink-2)">
                          {n.label}
                        </tspan>
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>

            {/* The fallback without colour or chart: the two numbers the funnel
                exists to establish, in plain words. */}
            <p className="mt-3 text-xs leading-relaxed text-pretty" style={{ color: "var(--ink-muted)" }}>
              <strong style={{ color: "var(--ink-2)" }}>
                {interviews.n} interview{interviews.n === 1 ? "" : "s"} out of {sent.n} sent, that is{" "}
                {pct.format(interviewRate)} %.
              </strong>{" "}
              A silence of more than {SILENCE_DAYS} days is counted as a rejection that was never written.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
