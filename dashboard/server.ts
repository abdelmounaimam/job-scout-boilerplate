/**
 * Static server for the dashboard, plus the scores API of the Evaluations tab,
 * behind HTTP Basic authentication.
 *
 * ⚠️ WHY THIS SERVER EXISTS
 * This dashboard shows the whole job search: every company, every rejection,
 * the salary expectation, the notice period, and a `notes` field holding
 * details nobody else has any business reading. A hosting URL (Railway or any
 * other) is public and guessable, and the central rule of a search run while
 * employed is not to be spotted before signing, with a current employer who
 * could stumble on it. Keep the git repository private for the same reason.
 *
 * Hence the design choice: **the server FAILS AT STARTUP when no password is
 * set.** No default value, no "open while testing" mode. A configuration error
 * must break the deployment, never publish the data silently.
 */
import { existsSync } from "node:fs";
import { Database } from "bun:sqlite";

const PORT = Number(process.env.PORT ?? 8080);
const PASSWORD = process.env.DASHBOARD_PASSWORD;

if (!PASSWORD || PASSWORD.length < 12) {
  console.error(
    "REFUSING TO START: DASHBOARD_PASSWORD is missing or too short (12 characters minimum).\n" +
      "This dashboard holds personal job-search data and must never be served without authentication.\n" +
      "  railway variables --set DASHBOARD_PASSWORD=<a-long-password>",
  );
  process.exit(1);
}

/** The login: DASHBOARD_USER from the environment, else the profile's
 *  DASHBOARD.basicAuthUser, else a neutral default. The profile is optional at
 *  runtime so a stripped image still starts. */
async function resolveUser(): Promise<string> {
  if (process.env.DASHBOARD_USER) return process.env.DASHBOARD_USER;
  const profilePath = new URL("../profile/profile.mjs", import.meta.url);
  if (existsSync(profilePath)) {
    try {
      const profile = await import(profilePath.href);
      if (profile.DASHBOARD?.basicAuthUser) return String(profile.DASHBOARD.basicAuthUser);
    } catch (e) {
      console.warn(`profile unreadable, falling back to the default user: ${e}`);
    }
  }
  return "candidate";
}

const USER = await resolveUser();
const EXPECTED = "Basic " + btoa(`${USER}:${PASSWORD}`);

/** Constant-time comparison: a naive one leaks the length and the correct
 *  leading characters, which makes an oracle attack possible. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ROOT = new URL("./dist/", import.meta.url);

/**
 * Scores of the free-text outputs (Evaluations tab, spec in evals/README.md).
 *
 * ⚠️ This is the ONLY write the dashboard does. The applications stay read only
 * from the CSV; scores get their own database because they are born here, in
 * the page, and nowhere else. Texts are never written here, scores never by
 * the agent.
 *
 * ⚠️⚠️ The database must live on a persistent volume. A container's disk is
 * wiped at every deploy, and the dashboard is redeployed after every tracker
 * write: without a volume, every score vanishes at the next application,
 * silently. On Railway: a volume mounted at /data and SCORES_DB=/data/scores.sqlite.
 * When a volume is attached, Railway exposes RAILWAY_VOLUME_MOUNT_PATH and the
 * database goes there by default. tools/pull-scores.sh mirrors the scores into
 * the repo (evals/scores.jsonl) as a second copy.
 *
 * The table is append only: scoring a text again adds a row, the history stays.
 */
const AXES = ["truth", "relevance", "story_choice", "honesty", "specificity", "tone"] as const;
const RATERS = ["human", "judge"] as const;
const SCORES_DB =
  process.env.SCORES_DB ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH.replace(/\/$/, "")}/scores.sqlite` : "./scores.sqlite");
if (process.env.RAILWAY_ENVIRONMENT && !process.env.SCORES_DB && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.warn(
    "⚠️ WARNING: running on Railway with no volume and no SCORES_DB. Scores are written to the container's disk\n" +
      "and will be LOST at the next deploy. Mount a volume at /data and set SCORES_DB=/data/scores.sqlite.",
  );
}
const db = new Database(SCORES_DB, { create: true });
db.run(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL,
  rater TEXT NOT NULL,
  axes TEXT NOT NULL,
  comment TEXT,
  rewrite TEXT,
  created_at TEXT NOT NULL
)`);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

async function api(req: Request, path: string): Promise<Response> {
  if (path !== "/api/scores") return json({ error: "unknown route" }, 404);

  if (req.method === "GET") {
    const rows = db.query("SELECT * FROM scores ORDER BY id").all() as any[];
    return json(rows.map((r) => ({ ...r, axes: JSON.parse(r.axes) })));
  }

  if (req.method === "POST") {
    const b = (await req.json().catch(() => null)) as any;
    if (!b || typeof b.record_id !== "string" || !b.record_id) return json({ error: "record_id missing" }, 400);
    const axes: Record<string, number | null> = {};
    for (const a of AXES) {
      const v = b.axes?.[a];
      if (v == null) { axes[a] = null; continue; }
      if (!Number.isInteger(v) || v < 1 || v > 5) return json({ error: `${a} must be an integer from 1 to 5` }, 400);
      axes[a] = v;
    }
    if (Object.values(axes).every((v) => v == null) && !b.comment && !b.rewrite) return json({ error: "empty score" }, 400);
    const row = db
      .query(
        `INSERT INTO scores (record_id, rater, axes, comment, rewrite, created_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        b.record_id,
        RATERS.includes(b.rater) ? b.rater : "human",
        JSON.stringify(axes),
        b.comment || null,
        b.rewrite || null,
        new Date().toISOString(),
      ) as any;
    return json({ ...row, axes }, 201);
  }

  return json({ error: "method not allowed" }, 405);
}

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    // Every path is behind the check, the JS bundle included: it is the bundle
    // that carries the data.
    const header = req.headers.get("authorization") ?? "";
    if (!constantTimeEqual(header, EXPECTED)) {
      return new Response("Authentication required.", {
        status: 401,
        headers: {
          // The realm shows in the browser's login prompt.
          "WWW-Authenticate": 'Basic realm="Applications dashboard", charset="UTF-8"',
        },
      });
    }

    const path = new URL(req.url).pathname;
    if (path.startsWith("/api/")) return api(req, path);
    // Any unknown route falls back to index.html (single-page app).
    const target = path === "/" || !path.includes(".") ? "index.html" : path.slice(1);
    const file = Bun.file(new URL(target, ROOT));

    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    return new Response(file, {
      headers: {
        // Personal data: no shared cache, no indexing.
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
});

console.log(`Dashboard served on port ${PORT}, authentication on (user « ${USER} »), scores in ${SCORES_DB}.`);
