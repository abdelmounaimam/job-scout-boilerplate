import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const CSV = resolve(__dirname, "../applications/applications.csv");
const PROFILE = resolve(__dirname, "../profile/profile.mjs");
const RECORDS = resolve(__dirname, "../evals/records.jsonl");

/** Regenerates the JSON as soon as the tracker, the profile or the traced free
 *  texts change, so the dashboard follows scans and applications without
 *  restarting the server. */
function watchTracker() {
  return {
    name: "watch-applications-csv",
    configureServer(server: any) {
      server.watcher.add([CSV, PROFILE, RECORDS]);
      server.watcher.on("change", (path: string) => {
        if (path !== CSV && path !== PROFILE && path !== RECORDS) return;
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

export default defineConfig({
  plugins: [react(), tailwindcss(), watchTracker()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: { port: 5180, open: true },
});
