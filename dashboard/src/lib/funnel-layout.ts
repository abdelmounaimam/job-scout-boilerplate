import type { FunnelNode } from "@/lib/metrics";

/** Layout of the Sankey diagram, kept apart from the drawing.
 *
 *  ⚠️ WHY THIS FILE EXISTS instead of living inside the component: this is
 *  geometry, so it is checked by computation, not by eye. The script
 *  `scripts/check-funnel.ts` replays this function on the real data and checks
 *  that no node overlaps another, no label runs into another, the sum of the
 *  branches equals the parent, and nothing leaves the frame. Left inside the
 *  component, none of that could have been checked without a browser.
 *
 *  ⚠️ WHY NOT Recharts' `Sankey`, although it is installed: it places no label
 *  and requires custom `node` and `link` renderers, which means writing the
 *  whole drawing anyway while losing control of the placement. Here the meaning
 *  rests entirely on the labels, since the rule of the dashboard is that colour
 *  never carries the meaning alone. And the graph is a TREE of eleven nodes
 *  (each node has exactly one parent): the layout is computed exactly, with no
 *  relaxation iterations, and with no ribbon crossing by construction.
 *
 *  Three drawing rules:
 *  1. A terminal node is pushed to the last column, as d3-sankey does. That
 *     gathers every exit label on one edge instead of scattering them among the
 *     ribbons.
 *  2. Leaves are stacked in the depth-first order of the tree: that is what
 *     guarantees no ribbon crosses another.
 *  3. A node's height is STRICTLY proportional to its count, and an internal
 *     node aligns on its first leaf. The gaps inserted between leaves therefore
 *     tilt the ribbons: that is intended, the alternative would be to distort
 *     the heights. */

export const WIDTH = 1060;
export const HEIGHT = 440;
export const MARGIN = { top: 10, bottom: 10, left: 16, right: 236 };
export const NODE_WIDTH = 12;
/** Vertical gap between two leaves. It serves the labels first: the smallest
 *  nodes are a few pixels tall, and the gap is what keeps their labels apart. */
export const GAP = 15;

export type PlacedNode = FunnelNode & {
  x: number;
  y: number;
  h: number;
  leaf: boolean;
};

export type Ribbon = { key: string; d: string; color: string; title: string };

export function layout(root: FunnelNode): {
  nodes: PlacedNode[];
  ribbons: Ribbon[];
  scale: number;
} {
  // 1. Flatten, keeping the depth and the depth-first order.
  const flat: { n: FunnelNode; depth: number }[] = [];
  (function descend(n: FunnelNode, depth: number) {
    flat.push({ n, depth });
    for (const e of n.children) descend(e, depth + 1);
  })(root, 0);

  const maxDepth = Math.max(...flat.map((p) => p.depth));
  const column = (p: { n: FunnelNode; depth: number }) => (p.n.children.length ? p.depth : maxDepth);

  // 2. Scale: every column must fit in the usable height, gaps included. The
  //    most constraining one wins, never an average.
  const usable = HEIGHT - MARGIN.top - MARGIN.bottom;
  const columns = new Map<number, { count: number; nodes: number }>();
  for (const p of flat) {
    const c = columns.get(column(p)) ?? { count: 0, nodes: 0 };
    c.count += p.n.n;
    c.nodes += 1;
    columns.set(column(p), c);
  }
  const rawScale = Math.min(
    ...[...columns.values()].map((c) => (c.count > 0 ? (usable - (c.nodes - 1) * GAP) / c.count : Infinity)),
  );
  // An empty tracker makes every column empty: without this guard the scale is
  // Infinity and every height becomes NaN.
  const scale = Number.isFinite(rawScale) ? rawScale : 0;

  const stepX = maxDepth > 0 ? (WIDTH - MARGIN.left - MARGIN.right - NODE_WIDTH) / maxDepth : 0;

  // 3. Stack the leaves in traversal order, then align each internal node on
  //    its first leaf.
  const placed = new Map<string, PlacedNode>();
  let cursor = MARGIN.top;
  for (const p of flat) {
    if (p.n.children.length) continue;
    placed.set(p.n.key, {
      ...p.n,
      leaf: true,
      x: MARGIN.left + column(p) * stepX,
      y: cursor,
      h: p.n.n * scale,
    });
    cursor += p.n.n * scale + GAP;
  }
  const firstLeaf = (n: FunnelNode): FunnelNode => (n.children.length ? firstLeaf(n.children[0]) : n);
  for (const p of flat) {
    if (!p.n.children.length) continue;
    placed.set(p.n.key, {
      ...p.n,
      leaf: false,
      x: MARGIN.left + column(p) * stepX,
      y: placed.get(firstLeaf(p.n).key)!.y,
      h: p.n.n * scale,
    });
  }

  // 4. Ribbons: the parent's right edge is shared between its children in
  //    order, and the child's left edge receives its whole height.
  const ribbons: Ribbon[] = [];
  for (const { n } of flat) {
    const source = placed.get(n.key);
    if (!source) continue;
    let offset = 0;
    for (const child of n.children) {
      const target = placed.get(child.key)!;
      const x0 = source.x + NODE_WIDTH;
      const x1 = target.x;
      const xm = (x0 + x1) / 2;
      const top0 = source.y + offset;
      const bottom0 = top0 + child.n * scale;
      const top1 = target.y;
      const bottom1 = target.y + target.h;
      ribbons.push({
        key: `${n.key}->${child.key}`,
        color: child.color,
        title: `${child.n} of ${n.n} · ${n.label} → ${child.label}`,
        d:
          `M${x0},${top0}` +
          `C${xm},${top0} ${xm},${top1} ${x1},${top1}` +
          `L${x1},${bottom1}` +
          `C${xm},${bottom1} ${xm},${bottom0} ${x0},${bottom0}Z`,
      });
      offset += child.n * scale;
    }
  }

  return { nodes: [...placed.values()], ribbons, scale };
}
