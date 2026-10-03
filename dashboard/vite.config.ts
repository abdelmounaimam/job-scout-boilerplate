import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Same switch as scripts/build-data.mjs: in demo mode the watched inputs are
 *  the fictional files of dashboard/demo/, never your own. */
const DEMO = /^(1|true|yes)$/i.test(process.env.DASHBOARD_DEMO ?? "");
const INPUTS = DEMO
  ? ["applications.csv", "profile.mjs", "records.jsonl", "stories.md"].map((f) => resolve(__dirname, "demo", f))
  : [
      resolve(__dirname, "../applications/applications.csv"),
      resolve(__dirname, "../profile/profile.mjs"),
      resolve(__dirname, "../evals/records.jsonl"),
      resolve(__dirname, "../profile/stories.md"),
    ];

/** Regenerates the JSON as soon as the tracker, the profile, the traced free
 *  texts or the story catalogue change, so the dashboard follows scans and
 *  applications without restarting the server. */
function watchTracker() {
  return {
    name: "watch-applications-csv",
    configureServer(server: any) {
      server.watcher.add(INPUTS);
      server.watcher.on("change", (path: string) => {
        if (!INPUTS.includes(path)) return;
        try {
          execFileSync(process.execPath, [resolve(__dirname, "scripts/build-data.mjs")], { stdio: "inherit" });
          server.ws.send({ type: "full-reload" });
        } catch (e) {
          server.config.logger.error(`build-data failed: ${e}`);
        }
      });
    },
  };
}

/** Optional: relay `/api` to a running dashboard server (your deployed one, or
 *  a local `bun server.ts`), so scoring works from `bun dev` and every score
 *  lands in ONE database (two databases would make pull-scores.sh miss the
 *  local ones). Active only when both DASHBOARD_URL and DASHBOARD_PASSWORD are
 *  given at launch; without them the Evaluations pages stay read only and say
 *  so. The login is DASHBOARD_USER, else the same default as server.ts. Never
 *  active in demo mode: the demo must not write into a real database. */
const API_TARGET = process.env.DASHBOARD_URL;
const proxyApi =
  !DEMO && API_TARGET && process.env.DASHBOARD_PASSWORD
    ? {
        "/api": {
          target: API_TARGET,
          changeOrigin: true,
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${process.env.DASHBOARD_USER ?? "candidate"}:${process.env.DASHBOARD_PASSWORD}`).toString("base64"),
          },
        },
      }
    : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss(), watchTracker()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: { port: 5180, open: true, proxy: proxyApi },
});
