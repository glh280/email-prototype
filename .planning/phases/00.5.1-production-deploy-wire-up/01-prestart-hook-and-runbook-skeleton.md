---
phase: 00.5.1-production-deploy-wire-up
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - .planning/DEPLOY.md
  - .planning/INITIAL_SEED_VERIFICATION.md
autonomous: true
requirements: [DEPLOY-09]
requirements_addressed: [DEPLOY-09]

# Plan-wide preamble (inspected at planning time, not runtime):
# - `.env.local` contains NEXT_PUBLIC_APP_BRAND_COLOR= (key present, VALUE empty — no local override).
# - `.env.example` contains NEXT_PUBLIC_APP_BRAND_COLOR= (same empty default).
# - Therefore Plan 02 Task 3 pins NEXT_PUBLIC_APP_BRAND_COLOR = "#0F172A" as the canonical
#   default, committed deterministically to prod. No runtime forking on .env.local.
# This note exists so future readers of the plan can see the planning-time investigation
# that justifies the pinned value downstream in Plan 02.

must_haves:
  truths:
    - "`package.json` declares a `prestart` script that runs `npm run db:migrate` before `next start`"
    - "Running `npm start` against a freshly-migrated local Postgres exits the prestart step in <2s with no schema changes (idempotent migration noop)"
    - "Running `npm start` against an empty local Postgres applies all 6 migrations (0000..0005) before booting Next.js"
    - "`.planning/DEPLOY.md` exists and documents (a) push-to-prod playbook, (b) 3-layer rollback procedure (app rollback / data rollback / forward-compensating migration), (c) initial-seed checklist, (d) env-var inventory, (e) CFA-11 + CFA-12 verification commands"
    - "`.planning/INITIAL_SEED_VERIFICATION.md` exists as a TEMPLATE with empty fields ready for Plan 03 to fill in (date, prod commit SHA, row counts, field-level diff, outcome)"
    - "No prod systems are touched by this plan — only repo-side files and local docker-compose Postgres"
    - "Brand-color default recorded in plan preamble: .env.local has NEXT_PUBLIC_APP_BRAND_COLOR empty; canonical default #0F172A will be pinned deterministically in Plan 02 Task 3 (no runtime .env.local fork)"
  artifacts:
    - path: "package.json"
      provides: "prestart hook that auto-runs migrations on every container boot (DEPLOY-09)"
      contains: "\"prestart\": \"npm run db:migrate\""
    - path: ".planning/DEPLOY.md"
      provides: "Production deploy + rollback runbook — the ongoing reference for every future phase"
      contains: "Rollback Playbook"
    - path: ".planning/INITIAL_SEED_VERIFICATION.md"
      provides: "Template for documenting the one-time prod seed run (filled by Plan 03)"
      contains: "Outcome:"
  key_links:
    - from: "package.json prestart"
      to: "npm run db:migrate"
      via: "npm lifecycle hook (auto-fires before npm start) — node/npm feature independent of Next.js"
      pattern: "\"prestart\":"
    - from: "package.json db:migrate"
      to: "drizzle/migrations/meta/_journal.json"
      via: "drizzle-kit migrate reads journal + diffs against DB to apply pending migrations"
      pattern: "drizzle-kit migrate"
    - from: ".planning/DEPLOY.md"
      to: ".planning/INITIAL_SEED_VERIFICATION.md"
      via: "DEPLOY.md references the verification artifact in its initial-seed section"
      pattern: "INITIAL_SEED_VERIFICATION"
---

<objective>
Land all repo-side prerequisites before anything in Railway gets touched. Specifically: (a) add the `prestart` hook to `package.json` that satisfies DEPLOY-09 by auto-running migrations on every container boot, (b) write `.planning/DEPLOY.md` as the ongoing production runbook (push-to-prod playbook + 3-layer rollback per CONTEXT §Rollback Playbook), and (c) scaffold `.planning/INITIAL_SEED_VERIFICATION.md` as a template that Plan 03 will fill in after running the one-time prod seed.

Verification is local-only: `docker-compose up -d postgres` + `npm start` proves the prestart hook fires migrations before Next.js boots, and a second run confirms idempotency. **Zero prod contact** — Plan 02 is the first plan to touch Railway.

Purpose: Locks in the platform-agnostic migration auto-heal pattern (CONTEXT §Migration Hook Style) and produces the runbook that every subsequent deploy in this project will reference. Plans 02 + 03 cannot ship safely without DEPLOY.md as the operator's checklist and the prestart hook present in the deployed code.

**AGENTS.md compliance note:** The `prestart` script is an **npm lifecycle feature** — when you run `npm start`, npm automatically runs any script named `prestart` first. This is independent of Next.js. Next 16's breaking changes affect `next start` / runtime behavior, but the prestart mechanism itself is pure node/npm and has no Next-version coupling. No Next 16 docs reading is required for this hook's correctness.

Output: 1 modified file (package.json), 2 new docs (DEPLOY.md, INITIAL_SEED_VERIFICATION.md), 1 git commit per task.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md
@.planning/phases/00.5-access-encryption/P05-CLOSURE.md

# Repo files this plan touches or references
@package.json
@drizzle/migrations/meta/_journal.json
@docker-compose.yml
@db/seed/tracks.ts
@db/seed/stages.ts
@db/seed/run.ts
@lib/env.ts

<interfaces>
<!-- Existing scripts the prestart hook composes against — DO NOT modify db:migrate or db:seed -->

From package.json (existing scripts that already work):
```json
{
  "build": "next build",
  "start": "next start",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx db/seed/run.ts"
}
```

Migration journal entries currently on disk (drizzle/migrations/meta/_journal.json — read-only here):
- 0000_amusing_jane_foster
- 0001_conscious_tarantula
- 0002_yummy_nick_fury
- 0003_fat_dark_phoenix
- 0004_next_file_no_function
- 0005_phase2_tasks_notes_kill

All 6 are present locally; prod has applied 0 of them (P0.5 prod runs from `fa52cc5`, pre-P1 — see CONTEXT §Reusable Assets).

Locked decision (CONTEXT §Migration Hook Style):
> `package.json` `prestart` (NOT `railway.json postdeploy`) — platform-agnostic, runs every boot, fails-safe (Railway keeps old deploy if prestart fails).

Locked decision (CONTEXT §Seed Auto-Run Policy):
> `prestart` runs `npm run db:migrate` ONLY. Seeds stay manual via `railway run npm run db:seed` per GLBA "deliberate human action for data modifications" posture.

Brand-color planning-time investigation (for Plan 02 Task 3 downstream):
- `.env.local` → `NEXT_PUBLIC_APP_BRAND_COLOR=` (empty)
- `.env.example` → `NEXT_PUBLIC_APP_BRAND_COLOR=` (empty)
- Plan 02 Task 3 will pin `#0F172A` as canonical default (slate-900), committed deterministically. No runtime fork.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add prestart hook to package.json + verify locally against docker-compose Postgres</name>
  <files>package.json</files>
  <read_first>
    - package.json (the file you're modifying — note the EXACT script-block formatting; preserve trailing-comma style and 2-space indent)
    - drizzle/migrations/meta/_journal.json (confirm 6 entries on disk)
    - docker-compose.yml (confirm POSTGRES_USER=npr / POSTGRES_PASSWORD=npr / POSTGRES_DB=npr_dashboard — these compose into the local DATABASE_URL)
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Migration Hook Style (lines 70-91 — the locked decision; copy the rationale comment style if you add one)
    - .env.local (if present) — confirm DATABASE_URL points to local Postgres so verification doesn't accidentally hit prod
    - AGENTS.md compliance: `prestart` is an **npm lifecycle feature** (node/npm, independent of Next.js) — npm auto-runs any script named `prestart` before `start`. No Next 16 docs reading required for this hook's correctness; Next-version changes affect `next start` runtime, not the lifecycle script mechanism itself.
  </read_first>
  <action>
    **Edit `package.json`.** Insert exactly ONE new line in the `scripts` block, immediately ABOVE the existing `"start": "next start"` line:

    ```json
    "prestart": "npm run db:migrate",
    ```

    The resulting `scripts` block must look like (preserving every other line verbatim):

    ```json
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "prestart": "npm run db:migrate",
      "start": "next start",
      "lint": "eslint",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
      "db:seed": "tsx db/seed/run.ts",
      "db:studio": "drizzle-kit studio"
    }
    ```

    **Why exactly that placement (per D-09 + CONTEXT §Migration Hook Style):**
    - npm fires `prestart` automatically before `start` (npm-script lifecycle — pure node/npm, independent of Next.js version); no extra wiring needed
    - Putting it right above `start` keeps the lifecycle pair visually adjacent
    - We do NOT add `npm run db:seed` to prestart — locked decision per CONTEXT §Seed Auto-Run Policy. Seeds stay manual.

    **Verify locally (do NOT touch prod — this is docker-compose only):**

    1. Confirm docker-compose Postgres is running: `docker compose ps postgres`. If not running, start it: `docker compose up -d postgres` and wait ~3s.
    2. Confirm `.env.local` `DATABASE_URL` points to local Postgres (`postgresql://npr:npr@localhost:5432/npr_dashboard`). If pointing anywhere else, ABORT and fix before continuing — running `npm start` against the wrong DB would apply migrations to prod.
    3. **First run (idempotent noop expected):** `npm start` and watch the output. Expected sequence:
        - `> npr-dashboard@0.1.0 prestart`
        - `> npm run db:migrate`
        - drizzle-kit prints "No migrations to apply" or applies 0 migrations
        - Next.js boots and prints `▲ Next.js ... Local: http://localhost:3000`
        - Hit Ctrl+C to kill — we just needed to prove the chain.
    4. **Empty-DB run (full migration apply expected):** Drop and re-create the local DB to simulate fresh prod:
        ```bash
        docker compose exec -T postgres psql -U npr -c "DROP DATABASE IF EXISTS npr_dashboard;"
        docker compose exec -T postgres psql -U npr -d postgres -c "CREATE DATABASE npr_dashboard;"
        ```
        Then `npm start` again. Expected: drizzle-kit applies all 6 migrations (0000..0005) before Next.js boots. Ctrl+C after Next.js logs `Local: http://localhost:3000`.
    5. **Idempotency confirmation:** Run `npm start` once more on the now-migrated DB. Expected: drizzle-kit reports zero pending, Next.js boots in <2s of prestart wall time.

    Capture the migrate-step output from steps 3, 4, 5 in the commit message body so future-you can grep it.

    Commit with message:
    ```
    feat(00.5.1-01): add prestart hook for auto-migration on container boot (DEPLOY-09)

    - Adds "prestart": "npm run db:migrate" to package.json scripts
    - Locked per CONTEXT §Migration Hook Style: package.json over railway.json (platform-agnostic, fail-safe)
    - Locked per CONTEXT §Seed Auto-Run Policy: seeds stay manual (GLBA deliberate action)
    - Verified locally: empty DB applies all 6 migrations; second run idempotent noop
    ```

    Do NOT add `npm run db:seed` to prestart. Do NOT add `railway.json`. Do NOT touch any other file.
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); if(p.scripts.prestart!=='npm run db:migrate'){console.error('prestart wrong:',p.scripts.prestart); process.exit(1)} else console.log('prestart OK')"; npm run db:migrate 2>&1 | tail -5; npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `node -e "console.log(require('./package.json').scripts.prestart)"` outputs `npm run db:migrate`
    - `grep -c '"prestart": "npm run db:migrate"' package.json` returns 1
    - `grep -c '"start": "next start"' package.json` returns 1 (existing start line preserved)
    - `grep -c 'db:seed' package.json | sed -n '1p'` returns 1 (db:seed STILL present as a script, but NOT inside prestart — verified by absence below)
    - `node -e "const p=require('./package.json'); process.exit(/db:seed/.test(p.scripts.prestart) ? 1 : 0)"` exits 0 (seeds NOT in prestart)
    - `npm run db:migrate` exits 0 against local docker-compose Postgres
    - `npm run build` exits 0 (no other file accidentally broken)
    - Commit exists with subject matching `^feat\(00\.5\.1-01\): add prestart hook`
  </acceptance_criteria>
  <done>package.json has prestart hook; local empty-DB run applies all 6 migrations before boot; second run is idempotent noop; commit landed.</done>
</task>

<task type="auto">
  <name>Task 2: Write .planning/DEPLOY.md runbook + .planning/INITIAL_SEED_VERIFICATION.md template</name>
  <files>.planning/DEPLOY.md, .planning/INITIAL_SEED_VERIFICATION.md</files>
  <read_first>
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Rollback Playbook (lines 118-128 — copy the 3-layer structure verbatim)
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Specifics (lines 167-197 — post-seed verification + CFA-11/12 commands)
    - .planning/phases/00.5-access-encryption/P05-CLOSURE.md (the SC1 + SC3 verification steps that DEPLOY.md inherits)
    - .planning/STATE.md Key Decisions rows for Postgres Hobby + migration hook + seed policy (search for "P0.5.1 discuss" — those rows ARE the source of truth this runbook documents)
    - .planning/REQUIREMENTS.md DEPLOY-07/08/09 + CFA-11/12 wording (the requirements this phase delivers)
    - lib/env.ts (the Zod schema — DEPLOY.md must list NEXT_PUBLIC_APP_NAME / _DOMAIN / _BRAND_COLOR + CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD + DATABASE_URL + ENCRYPTION_KEY in the env-var inventory section)
  </read_first>
  <action>
    **Create `.planning/DEPLOY.md`** with EXACTLY these sections (no extra prose between):

    ```markdown
    # DEPLOY.md — Production Deploy Runbook

    **Owner:** Mike Miller
    **Last updated:** 2026-04-18 (Phase 0.5.1)
    **Production URL:** https://portal.utstitle.com (CF Access gated)
    **Direct origin (must NOT be reachable):** https://npr-dashboard-prototype-production.up.railway.app

    ---

    ## 1. Push-to-Prod Playbook

    Standard workflow for any phase ship after Phase 0.5.1 completes:

    1. **Local pre-flight (REQUIRED before push):**
       - `npm test` → all green
       - `npx tsc --noEmit` → clean
       - `npm run build` → exits 0
       - `npm run db:migrate` against local docker-compose Postgres → exits 0 (proves the migrations Plan boot will run)
    2. **Push:** `git push origin master`
    3. **Watch deploy:** `railway status --json --service npr-dashboard-prototype` (or Railway dashboard → Deployments tab)
    4. **Confirm boot:** `railway logs --service npr-dashboard-prototype | tail -50` — look for:
       - `> prestart` then `drizzle-kit migrate` output (auto-applies pending migrations)
       - `▲ Next.js ... ready`
       - NO Zod env validation errors
    5. **Smoke-test live:**
       - Visit `https://portal.utstitle.com` → CF Access prompt → sign in → app loads
       - Run CFA-11 verification: `curl -I https://npr-dashboard-prototype-production.up.railway.app` → expect 403/404/timeout (NEVER 200)

    **Migration policy (prestart-only):** Migrations flow EXCLUSIVELY through the container's `prestart` hook. Do NOT run `drizzle-kit migrate` or `npm run db:migrate` against prod from an operator laptop — that bypasses the `prestart` safety net (where a failure halts the deploy via health check). If you need to check schema version, query `drizzle.__drizzle_migrations` READ-ONLY with `node -e` + `pg`.

    ---

    ## 2. Env Var Inventory

    All env vars validated by `lib/env.ts` Zod schema. App refuses to boot if any REQUIRED var is missing.

    | Var | Required? | Source | Notes |
    |-----|-----------|--------|-------|
    | `DATABASE_URL` | yes | Railway reference: `${{Postgres.DATABASE_URL}}` | Stays in sync across Postgres password rotations (DEPLOY-07) |
    | `CF_ACCESS_TEAM_DOMAIN` | yes | Cloudflare Zero Trust dashboard | Already set (P0.5) |
    | `CF_ACCESS_AUD` | yes | Cloudflare Access app AUD tag | Already set (P0.5) |
    | `NEXT_PUBLIC_APP_NAME` | yes | Set per-env in Railway | DEPLOY-08 (Phase 0.5.1) |
    | `NEXT_PUBLIC_APP_DOMAIN` | yes | Set per-env in Railway (bare domain, no scheme) | DEPLOY-08 (Phase 0.5.1) |
    | `NEXT_PUBLIC_APP_BRAND_COLOR` | optional | Set per-env in Railway | DEPLOY-08 (Phase 0.5.1) |
    | `ENCRYPTION_KEY` | required from C3 onward | Railway env (32-byte base64) + 1Password backup | P0.5 lock |
    | `GMAIL_OAUTH_CLIENT_ID` | optional (P4/P5) | Google Cloud Console | Per-user OAuth |
    | `GMAIL_OAUTH_CLIENT_SECRET` | optional (P4/P5) | Google Cloud Console | Per-user OAuth |

    To inspect prod values: `railway variables --service npr-dashboard-prototype --kv`

    ---

    ## 3. Rollback Playbook (3 layers)

    Per CONTEXT §Rollback Playbook (locked 2026-04-18). Pick the lowest layer that resolves the incident.

    ### Layer 1 — App-only rollback (most common)
    1. Railway dashboard → `npr-dashboard-prototype` service → Deployments tab
    2. Find the previous SUCCESS deployment (NOT the FAILED one you just pushed)
    3. Click ⋯ → **Rollback**
    4. Traffic swaps to the old container immediately
    5. **When it works:** bad code passed local tests but failed in prod (rare)
    6. **When it fails:** schema is already migrated forward — see Layer 3

    ### Layer 2 — Data rollback (Postgres restore)
    1. Railway dashboard → `Postgres` service → Backups tab
    2. Select latest snapshot (Hobby tier = weekly cadence per CONTEXT §Postgres Tier)
    3. Click "Restore" — creates a parallel Postgres or replaces in place (read Railway prompts carefully)
    4. **Acceptable during P0.5.1 → P4:** weekly cadence is fine because deals are non-authoritative pre-P10 (Carrie still in ClickUp).
    5. **Trigger to upgrade Hobby → Pro:** When Carrie's data becomes authoritative for daily ops, OR written GLBA Safeguards requires daily DB backups. Expected timing ~Phase 5 (per STATE.md Key Decisions row 2026-04-18).

    ### Layer 3 — Forward-compensating migration
    Used when Layers 1+2 cannot help (migration already applied, new code already shipped, no acceptable snapshot).

    1. Author a new migration file: `drizzle/migrations/000N_revert_<original_tag>.sql`
    2. Hand-write the compensating SQL (drizzle-kit does NOT auto-generate down migrations)
    3. Tip: open the original `0005_phase2_tasks_notes_kill.sql` and write the inverse statements (DROP TABLE for CREATE TABLE, ALTER TABLE DROP COLUMN for ADD COLUMN, etc.)
    4. Test locally: `docker compose down postgres && docker compose up -d postgres && npm run db:migrate`
    5. Update `drizzle/migrations/meta/_journal.json` per the existing P1-P2 rename pattern
    6. Commit + push — prestart hook applies it on next deploy
    7. **Acknowledged limitation:** down migrations are deferred per CONTEXT §Deferred Ideas. Compensating migrations are the documented fallback.

    ---

    ## 4. Initial Seed Checklist (one-time, executed in Phase 0.5.1 Plan 03)

    First-time seed against fresh prod Postgres. Documented in `.planning/INITIAL_SEED_VERIFICATION.md`.

    1. Confirm Postgres service is provisioned + reachable: `railway run --service npr-dashboard-prototype -- node -e "console.log(process.env.DATABASE_URL ? 'DATABASE_URL present' : 'MISSING')"`
    2. Confirm migrations applied via READ-ONLY schema-version check (prestart-only policy — do NOT invoke `drizzle-kit migrate` from laptop):
       ```bash
       railway run --service npr-dashboard-prototype -- node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});(async()=>{await c.connect();const r=await c.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 6');console.table(r.rows);await c.end();})();"
       ```
       Expect 6 rows (0000..0005 applied by prestart on previous deploy).
    3. Run seed: `railway run --service npr-dashboard-prototype -- npm run db:seed` → expect "Seeded 8 tracks, 25 stages."
    4. Read back + diff: see post-seed verification in INITIAL_SEED_VERIFICATION.md (use `node -e` + `pg` — `pg` v8.20.0 in dependencies; NO `psql` fallback)
    5. Document outcome (verified | mismatch — investigated | mismatch — escalated) in INITIAL_SEED_VERIFICATION.md with date + commit SHA

    Repeat seeds (after this initial run) are NOT auto-fired by deploy. Manual only per CONTEXT §Seed Auto-Run Policy. To re-seed: `railway run --service npr-dashboard-prototype -- npm run db:seed`. `onConflictDoUpdate` makes it safe to re-run.

    ---

    ## 5. Closure Verifications (Phase 0.5.1 — resolves P0.5 deferrals)

    ### CFA-11 — Direct origin returns 403/404 (resolves P0.5 SC1)
    From any machine NOT inside Railway:
    ```bash
    curl -I https://npr-dashboard-prototype-production.up.railway.app
    ```
    **Accept if:** HTTP 403, 404, connection refused, or timeout. Means Railway Public Networking does not expose the service beyond the Cloudflare Tunnel.
    **Reject if:** HTTP 200 + actual app HTML — that's a GLBA-relevant hole; escalate.

    Document the actual response code in `00.5.1-VERIFICATION.md`.

    ### CFA-12 — Avatar shows real Google identity (resolves P0.5 SC3)
    1. Sign in at `https://portal.utstitle.com` via CF Access
    2. Open browser dev tools → Application → Cookies → confirm `CF_Authorization` cookie present
    3. Inspect `<AppHeader>` avatar — should render the authenticated user's name + email from `lib/current-user.ts`, NOT the fallback `"CD"` initials
    4. Capture screenshot + the user.email payload in `00.5.1-VERIFICATION.md`

    If avatar still shows "CD" after a fresh deploy of latest master:
    - Verify Railway is on the latest commit (`railway status --service npr-dashboard-prototype --json` → check deploy SHA vs `git rev-parse origin/master`)
    - Check `users` table via `pg` readback: `railway run --service npr-dashboard-prototype -- node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});(async()=>{await c.connect();const r=await c.query('SELECT id,email,name FROM users');console.table(r.rows);await c.end();})();"`
    - Inspect tunnel logs for the JWT claims: `railway logs --service tunnel | grep -i jwt`

    ---

    ## 6. Compliance Notes

    - **Postgres tier:** Railway Hobby (~$5/mo, weekly snapshots, ~100 max connections, stays inside Railway private network). Locked 2026-04-18 per STATE.md Key Decisions. PII protection comes from column-level encryption + CF Access + audit log, NOT from Postgres tier.
    - **Single environment:** No staging (locked per CONTEXT §Staging Environment). Pre-prod surfaces = docker-compose + 170 unit tests + tsc + build + db:migrate against local DB.
    - **Audit layers (P0.5 lock):** Layer 1 = `audit_log` table (every mutation), Layer 2 = `npi_access_log` (every decrypt), Layer 3 = CF Access dashboard logs (~6h on Free tier, supplementary). Logpush dropped (Enterprise-only).

    ---

    *This runbook is living. Update at every phase transition where deploy posture changes.*
    ```

    **Create `.planning/INITIAL_SEED_VERIFICATION.md`** with EXACTLY this template (Plan 03 fills in the blank fields):

    ```markdown
    # Initial Seed Verification — Production Postgres

    **Phase:** 0.5.1 Plan 03 (one-time)
    **Status:** TEMPLATE — fill in after running prod seed

    ---

    ## Run Metadata

    - **Date of seed run:** _________________
    - **Operator:** _________________
    - **Prod commit SHA at time of seed:** _________________
    - **Railway service:** `npr-dashboard-prototype`
    - **Railway environment:** `production`
    - **Postgres service:** `Postgres` (Railway Hobby tier)
    - **Command run:** `railway run --service npr-dashboard-prototype -- npm run db:seed`

    ---

    ## Row Counts (actual vs expected)

    | Table | Expected | Actual | Match? |
    |-------|----------|--------|--------|
    | `tracks` | 8 (TE, FL, DP, PO, EC, SL, BL, GI) | ___ | ___ |
    | `stages` (total) | 25 | ___ | ___ |
    | `stages` WHERE `track_id IS NULL` (universal) | 4 (`pre_screen_qualification`, `deal_structuring`, `file_completed`, `killed`) | ___ | ___ |
    | `stages` WHERE `track_id = (SELECT id FROM tracks WHERE code='TE')` | 10 | ___ | ___ |
    | `stages` WHERE `track_id = (SELECT id FROM tracks WHERE code='FL')` | 11 | ___ | ___ |

    ---

    ## Field-Level Diff

    Compare prod row contents against source seed files (`db/seed/tracks.ts` + `db/seed/stages.ts`). Fields to diff per row:

    - `tracks`: `code`, `label`, `default_priority`
    - `stages`: `code`, `label`, `track_id` (resolved → track code via join), `sort_order`, `is_terminal`

    **Diff method:** Run a SELECT against prod tables, paste the result here, and visually compare against source seed file content. (No automated diff tool — small data, manual eyeballing is fine for the one-time check.)

    **Readback tool:** `node -e` + `pg` (v8.20.0 in dependencies). No `psql` fallback — `psql` is not guaranteed available in the app container.

    ### tracks (paste prod readback output below)

    ```
    <paste output of: railway run --service npr-dashboard-prototype -- node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});(async()=>{await c.connect();const r=await c.query('SELECT code,label,default_priority FROM tracks ORDER BY code');console.table(r.rows);await c.end();})();">
    ```

    Diff vs `db/seed/tracks.ts` `TRACK_SEEDS`: _________________

    ### stages (paste prod readback output below)

    ```
    <paste output of: railway run --service npr-dashboard-prototype -- node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});(async()=>{await c.connect();const r=await c.query(\"SELECT s.code,s.label,t.code AS track_code,s.sort_order,s.is_terminal FROM stages s LEFT JOIN tracks t ON s.track_id=t.id ORDER BY t.code NULLS FIRST,s.sort_order\");console.table(r.rows);await c.end();})();">
    ```

    Diff vs `db/seed/stages.ts` `STAGE_SEEDS`: _________________

    ---

    ## Outcome

    Pick one + delete the others:

    - [ ] **verified** — row counts + field-level diffs all match. Prod seed is correct.
    - [ ] **mismatch — investigated and resolved** — describe the mismatch + the fix:
      _________________
    - [ ] **mismatch — escalated** — describe the mismatch + escalation context:
      _________________

    ---

    ## Cross-Reference

    - Runbook: `.planning/DEPLOY.md` §4 Initial Seed Checklist
    - Source seed files: `db/seed/tracks.ts`, `db/seed/stages.ts`, `db/seed/run.ts`
    - Phase reference: `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md` §Specifics

    ---

    *This file is created blank in Phase 0.5.1 Plan 01 and filled in by Plan 03 after the one-time prod seed runs.*
    ```

    **Verify both files exist + headings present:**

    ```bash
    test -f .planning/DEPLOY.md && grep -c "^## " .planning/DEPLOY.md
    test -f .planning/INITIAL_SEED_VERIFICATION.md && grep -c "^## " .planning/INITIAL_SEED_VERIFICATION.md
    ```

    Expected: DEPLOY.md returns 6 (six `##` headings). INITIAL_SEED_VERIFICATION.md returns 5 (five `##` headings).

    Commit with message:
    ```
    docs(00.5.1-01): add DEPLOY.md runbook + INITIAL_SEED_VERIFICATION.md template

    - DEPLOY.md: 6 sections (playbook / env inventory / 3-layer rollback / initial-seed checklist / closure verifications for CFA-11+12 / compliance notes)
    - INITIAL_SEED_VERIFICATION.md: template with run metadata + row counts + field diff sections + outcome enum (Plan 03 fills in)
    - All content sourced from CONTEXT.md locked decisions + STATE.md Key Decisions rows
    - Prestart-only migration policy recorded in §1 + §4; readback via `node -e` + `pg` (no psql fallback)
    ```
  </action>
  <verify>
    <automated>test -f .planning/DEPLOY.md && echo "DEPLOY.md exists" || echo "MISSING DEPLOY.md"; test -f .planning/INITIAL_SEED_VERIFICATION.md && echo "INITIAL_SEED_VERIFICATION.md exists" || echo "MISSING template"; grep -c "^## " .planning/DEPLOY.md; grep -c "Rollback Playbook" .planning/DEPLOY.md; grep -c "CFA-11" .planning/DEPLOY.md; grep -c "CFA-12" .planning/DEPLOY.md; grep -c "INITIAL_SEED_VERIFICATION" .planning/DEPLOY.md; grep -c "Outcome" .planning/INITIAL_SEED_VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/DEPLOY.md` exists
    - File `.planning/INITIAL_SEED_VERIFICATION.md` exists
    - `grep -c "^## " .planning/DEPLOY.md` returns 6
    - `grep -c "^## " .planning/INITIAL_SEED_VERIFICATION.md` returns 5
    - `grep -c "Rollback Playbook" .planning/DEPLOY.md` returns at least 1
    - `grep -c "Layer 1" .planning/DEPLOY.md` returns at least 1
    - `grep -c "Layer 2" .planning/DEPLOY.md` returns at least 1
    - `grep -c "Layer 3" .planning/DEPLOY.md` returns at least 1
    - `grep -c "CFA-11" .planning/DEPLOY.md` returns at least 1
    - `grep -c "CFA-12" .planning/DEPLOY.md` returns at least 1
    - `grep -c "DATABASE_URL" .planning/DEPLOY.md` returns at least 1
    - `grep -c "NEXT_PUBLIC_APP_NAME" .planning/DEPLOY.md` returns at least 1
    - `grep -c "INITIAL_SEED_VERIFICATION" .planning/DEPLOY.md` returns at least 1 (cross-ref present)
    - `grep -c "prestart-only" .planning/DEPLOY.md` returns at least 1 (migration policy recorded)
    - `grep -c "Outcome" .planning/INITIAL_SEED_VERIFICATION.md` returns at least 1
    - `grep -c "tracks" .planning/INITIAL_SEED_VERIFICATION.md` returns at least 1
    - `grep -c "stages" .planning/INITIAL_SEED_VERIFICATION.md` returns at least 1
    - Commit exists with subject matching `^docs\(00\.5\.1-01\): add DEPLOY\.md runbook`
  </acceptance_criteria>
  <done>DEPLOY.md exists with 6 sections including 3-layer rollback + CFA-11/12 verification commands + prestart-only migration policy; INITIAL_SEED_VERIFICATION.md template exists with empty fields ready for Plan 03; commit landed.</done>
</task>

</tasks>

<verification>
- `node -e "console.log(require('./package.json').scripts.prestart)"` → `npm run db:migrate`
- `npm run db:migrate` → exits 0 against local docker-compose Postgres
- `npm run build` → exits 0
- `.planning/DEPLOY.md` and `.planning/INITIAL_SEED_VERIFICATION.md` both exist with the section structure called out above
- `.planning/DEPLOY.md` records the prestart-only migration policy (§1 + §4) and references `node -e` + `pg` readback (no psql fallback)
- 2 commits landed: `feat(00.5.1-01): add prestart hook` + `docs(00.5.1-01): add DEPLOY.md runbook`
- Zero prod systems contacted (this plan is local-only)
</verification>

<success_criteria>
- [ ] `package.json` has `"prestart": "npm run db:migrate"` line in the scripts block
- [ ] Local empty-DB `npm start` applies all 6 migrations before Next.js boots
- [ ] `.planning/DEPLOY.md` documents push-to-prod, env inventory, 3-layer rollback, initial seed checklist, CFA-11/12 verification, compliance notes, prestart-only migration policy
- [ ] `.planning/INITIAL_SEED_VERIFICATION.md` template ready for Plan 03 to populate (with `node -e` + `pg` readback commands, no psql fallback)
- [ ] No prod state changed by this plan
- [ ] DEPLOY-09 requirement closed by package.json prestart line (verifiable + visible to executors)
- [ ] Plan preamble records brand-color planning-time investigation (.env.local empty → #0F172A canonical default pinned downstream in Plan 02)
</success_criteria>

<output>
After completion, create `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-01-prestart-hook-and-runbook-skeleton-SUMMARY.md` using the standard SUMMARY template. Note in the summary: (a) which migration applied during the empty-DB local verification, (b) the exact npm output captured for the prestart-fires-then-start chain, (c) confirmation that NO prod systems were contacted, (d) confirmation that brand-color canonical default `#0F172A` is committed as the value Plan 02 Task 3 will pin (no runtime fork).
</output>
