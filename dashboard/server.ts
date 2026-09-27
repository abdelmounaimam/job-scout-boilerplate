/**
 * Static server for the dashboard, behind HTTP Basic authentication.
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

console.log(`Dashboard served on port ${PORT}, authentication on (user « ${USER} »).`);
