// Checks the layout of the Sankey diagram by computation.
//
// Why this script: the geometry of a Sankey is hard to check by eye, and even
// harder with no browser at hand. The counts change at every scan, so a layout
// that is right today can overlap tomorrow on other numbers. This replays the
// layout on the real data and fails loudly if anything leaves the frame.
//
// Wired into `predev` but DELIBERATELY NOT into `prebuild`: a cosmetic overlap
// must never break a deployment.
//
//   bun run check-funnel
import { APPLICATIONS, funnel, type FunnelNode } from "../src/lib/metrics.ts";
import { layout, GAP, HEIGHT, WIDTH, NODE_WIDTH, MARGIN, type PlacedNode } from "../src/lib/funnel-layout.ts";

const failures: string[] = [];
const ok = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const root = funnel(APPLICATIONS);

// An empty tracker draws no diagram (the component shows an empty state), and
// zero-height nodes would fail the label checks for a picture nobody sees.
// Without this exit, `bun dev` would refuse to start on a fresh clone.
if (!root.n) {
  console.log("funnel: empty tracker, nothing to lay out (the page shows an empty state)");
  process.exit(0);
}

const { nodes, ribbons, scale } = layout(root);

// 1. The tree is a partition: the sum of the branches equals the parent, or
//    applications get lost on the way without the drawing showing it.
(function checkSums(n: FunnelNode) {
  if (n.children.length) {
    const sum = n.children.reduce((s, e) => s + e.n, 0);
    ok(sum === n.n, `« ${n.label} » is ${n.n} but its branches add up to ${sum}`);
    n.children.forEach(checkSums);
  }
})(root);

// 2. No vertical overlap between two nodes of the same column.
const byColumn = new Map<number, PlacedNode[]>();
for (const n of nodes) {
  const l = byColumn.get(n.x) ?? [];
  l.push(n);
  byColumn.set(n.x, l);
}
for (const [x, list] of byColumn) {
  const sorted = [...list].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const room = cur.y - (prev.y + prev.h);
    ok(
      room >= GAP - 0.01,
      `column x=${x.toFixed(0)}: « ${prev.label} » and « ${cur.label} » are only ${room.toFixed(1)} px apart (minimum ${GAP})`,
    );
  }
}

// 3. Nothing leaves the frame.
for (const n of nodes) {
  ok(n.y >= -0.01, `« ${n.label} » overflows at the top (y=${n.y.toFixed(1)})`);
  ok(n.y + n.h <= HEIGHT + 0.01, `« ${n.label} » overflows at the bottom (bottom=${(n.y + n.h).toFixed(1)}, frame ${HEIGHT})`);
  ok(n.x + NODE_WIDTH <= WIDTH, `« ${n.label} » overflows on the right (x=${n.x.toFixed(1)})`);
}

// 4. The exit column labels do not run into each other. This is the real
//    constraint of the drawing: small nodes are a few pixels tall, their labels
//    decide the minimum gap.
const LINE_HEIGHT = 13; // 11.5 px font, leading included
const leaves = nodes.filter((n) => n.leaf).sort((a, b) => a.y - b.y);
for (let i = 1; i < leaves.length; i++) {
  const a = leaves[i - 1];
  const b = leaves[i];
  const centreGap = b.y + b.h / 2 - (a.y + a.h / 2);
  ok(
    centreGap >= LINE_HEIGHT,
    `labels « ${a.label} » and « ${b.label} » are ${centreGap.toFixed(1)} px apart centre to centre (minimum ${LINE_HEIGHT})`,
  );
}

// 5. Exit labels fit in the right margin. Width estimated generously: 6.3 px
//    per character for 11.5 px system-ui.
const PER_CHAR = 6.3;
for (const n of leaves) {
  const start = n.x + NODE_WIDTH + 10;
  const width = (String(n.n).length + 1) * PER_CHAR + 6 + n.label.length * PER_CHAR;
  ok(
    start + width <= WIDTH,
    `label « ${n.n} ${n.label} » overflows the frame (ends at ${(start + width).toFixed(0)}, frame ${WIDTH})`,
  );
}

// 6. Labels of pass-through nodes do not run into each other. Two lines, so a
//    32 px block centred on the node.
const PASS_BLOCK = 32;
const passes = nodes.filter((n) => !n.leaf);
for (const a of passes) {
  for (const b of passes) {
    if (a.key >= b.key) continue;
    const sameColumn = Math.abs(a.x - b.x) < 120;
    if (!sameColumn) continue;
    const gap = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2));
    ok(gap >= PASS_BLOCK, `pass-through labels « ${a.label} » and « ${b.label} » are ${gap.toFixed(1)} px apart (minimum ${PASS_BLOCK})`);
  }
}

// 7. Each internal node hands exactly its height to its outgoing ribbons.
for (const n of nodes) {
  if (n.leaf) continue;
  const out = n.children.reduce((s, e) => s + e.n * scale, 0);
  ok(Math.abs(out - n.h) < 0.01, `« ${n.label} »: outgoing ribbons ${out.toFixed(2)} px for a ${n.h.toFixed(2)} px node`);
}

// 8. The golden number of the file: the total must stay the number of rows.
ok(root.n === APPLICATIONS.length, `the root announces ${root.n} applications for ${APPLICATIONS.length} CSV rows`);

const cols = [...byColumn.keys()].sort((a, b) => a - b);
console.log(
  `funnel: ${nodes.length} nodes, ${ribbons.length} ribbons, ${cols.length} columns, scale ${scale.toFixed(2)} px per application`,
);
console.log(
  `  frame ${WIDTH}×${HEIGHT}, margins ${MARGIN.left}/${MARGIN.right}, height used ${Math.max(...nodes.map((n) => n.y + n.h)).toFixed(0)}`,
);
for (const n of leaves) console.log(`  ${String(n.n).padStart(3)}  ${n.label}  (${n.h.toFixed(1)} px)`);

if (failures.length) {
  console.error(`\n✗ ${failures.length} layout problem(s):`);
  for (const e of failures) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\n✓ layout valid");
