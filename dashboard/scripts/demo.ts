// Runs the dashboard on the fictional dataset of dashboard/demo/, with a
// throwaway scores database, so the Evaluations pages work end to end.
//
//   bun run demo                 build on the demo data, seed a temp database, serve
//   bun run demo --skip-build    serve the last demo build again
//
// What it guarantees:
//   - your tracker, records, story catalogue and profile are NEVER read: the
//     build runs with DASHBOARD_DEMO=1 (see scripts/build-data.mjs);
//   - your scores database is NEVER opened: SCORES_DB is forced to a fresh
//     SQLite file in a temporary directory, seeded from demo/scores.jsonl and
//     deleted when the server stops, whatever SCORES_DB or
//     RAILWAY_VOLUME_MOUNT_PATH say in your environment.
//
// Environment (all optional): PORT (8080), DASHBOARD_USER ("demo"),
// DASHBOARD_PASSWORD (a random one is generated and printed when absent).
//
// ⚠️ The build writes the usual generated files (src/data/*.json and dist/)
// with the DEMO data. Run `bun run build` again before serving your own data.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";

const DASHBOARD = resolve(import.meta.dir, "..");
const DEMO = join(DASHBOARD, "demo");
const env = { ...process.env, DASHBOARD_DEMO: "1" };

if (!process.argv.includes("--skip-build")) {
  const build = Bun.spawnSync(["bun", "run", "build"], { cwd: DASHBOARD, env, stdout: "inherit", stderr: "inherit" });
  if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);
}

const data = JSON.parse(readFileSync(join(DASHBOARD, "src/data/applications.json"), "utf8"));
if (!data.config?.demo) {
  console.error("✗ src/data/applications.json is not a demo build. Run `bun run demo` without --skip-build.");
  process.exit(1);
}

// Same shift as the dates of the build, so a score never predates its text.
const shiftMs = (data.config.demoShiftDays ?? 0) * 86_400_000;
const dir = mkdtempSync(join(tmpdir(), "job-scout-demo-"));
const SCORES_DB = join(dir, "scores.sqlite");
const db = new Database(SCORES_DB, { create: true });
// ⚠️ Must stay identical to the CREATE TABLE of server.ts.
db.run(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL,
  rater TEXT NOT NULL,
  axes TEXT NOT NULL,
  comment TEXT,
  rewrite TEXT,
  created_at TEXT NOT NULL
)`);
const seed = join(DEMO, "scores.jsonl");
let seeded = 0;
if (existsSync(seed)) {
  const insert = db.query(
    "INSERT INTO scores (record_id, rater, axes, comment, rewrite, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const line of readFileSync(seed, "utf8").split("\n").filter((l) => l.trim())) {
    const s = JSON.parse(line);
    const at = new Date(Date.parse(s.created_at) + shiftMs).toISOString();
    insert.run(s.record_id, s.rater ?? "human", JSON.stringify(s.axes), s.comment ?? null, s.rewrite ?? null, at);
    seeded++;
  }
}
db.close();

const PORT = process.env.PORT ?? "8080";
const USER = process.env.DASHBOARD_USER ?? "demo";
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? `demo-${randomBytes(9).toString("base64url")}`;
const serverEnv: Record<string, string | undefined> = { ...env, PORT, DASHBOARD_USER: USER, DASHBOARD_PASSWORD: PASSWORD, SCORES_DB };
delete serverEnv.RAILWAY_VOLUME_MOUNT_PATH;
delete serverEnv.RAILWAY_ENVIRONMENT;

console.log(`\nDemo scores: ${seeded} seeded into ${SCORES_DB} (deleted on exit)`);
console.log(`Open http://127.0.0.1:${PORT}  user « ${USER} »  password « ${PASSWORD} »\n`);

const server = Bun.spawn(["bun", "server.ts"], { cwd: DASHBOARD, env: serverEnv, stdout: "inherit", stderr: "inherit" });
const cleanup = () => {
  server.kill();
  rmSync(dir, { recursive: true, force: true });
};
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
const code = await server.exited;
rmSync(dir, { recursive: true, force: true });
console.log("\nDemo stopped. Run `bun run build` before serving your own data again.");
process.exit(code);
