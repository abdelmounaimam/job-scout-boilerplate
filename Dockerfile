# Deployment image of the applications dashboard.
#
# ⚠️ Why a Dockerfile and not Nixpacks: the dashboard's package.json is nested
# in dashboard/, so Nixpacks detects no project at the root of the upload and
# does not provision bun (the build dies on "bun: command not found"). A
# Dockerfile guesses nothing.
#
# ⚠️ No railway.json next to it, on purpose: Railway deprecated railway.json and
# stops honouring it on 2026-12-01 (it pushes towards `.railway/railway.ts`).
# A Dockerfile at the root of the upload is detected without any config file,
# so there is nothing to migrate and nothing to break on that date.
#
# ⚠️ The oven/bun image has no node: every script of the dashboard is run with
# `bun`, never `node`.
FROM oven/bun:1

WORKDIR /app

# Only what the build reads. build-data.mjs reads ../applications/applications.csv,
# ../profile/profile.mjs, ../profile/stories.md (the story catalogue) and
# ../evals/records.jsonl (the free texts of the Evaluations pages), hence this
# tree, rebuilt by tools/deploy-dashboard.sh, which always ships a records file
# and a catalogue (empty when there is none yet).
# Explicit COPY lines rather than `COPY . .`: even if someone runs `railway up`
# from the repo root by mistake, the IMAGE holds nothing else. (The upload itself
# would still ship everything to the build servers: that is what the deploy
# script's temporary directory prevents.)
COPY applications/applications.csv applications/applications.csv
COPY profile/profile.mjs profile/profile.mjs
COPY profile/stories.md profile/stories.md
COPY evals/records.jsonl evals/records.jsonl
COPY dashboard/ dashboard/

RUN cd dashboard \
    && bun install --frozen-lockfile \
    && bun run build

WORKDIR /app/dashboard
ENV PORT=8080
EXPOSE 8080

# server.ts refuses to start without DASHBOARD_PASSWORD: that is intended.
# ⚠️ The scores of the Evaluations review queue are written to SQLite at SCORES_DB. Mount
# a volume at /data and set SCORES_DB=/data/scores.sqlite, or every deploy wipes
# them (see evals/README.md).
CMD ["bun", "server.ts"]
