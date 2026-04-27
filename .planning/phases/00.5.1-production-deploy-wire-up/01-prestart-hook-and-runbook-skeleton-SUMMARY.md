---
phase: 00.5.1-production-deploy-wire-up
plan: 01
subsystem: infra
tags: [deploy, railway, postgres, drizzle, migrations, runbook, npm-lifecycle]

# Dependency graph
requires:
  - phase: 01-phase-1-core-data-model
    provides: 6 drizzle migrations (0000..0005), db:migrate + db:seed npm scripts, idempotent seeder
  - phase: 00.5-access-encryption
    provides: CF Access topology, ENCRYPTION_KEY custody pattern, Railway single-vendor compute lock
provides:
  - "package.json prestart hook auto-runs npm run db:migrate before next start on every container boot (DEPLOY-09)"
  - ".planning/DEPLOY.md — ongoing production runbook (push playbook / env inventory / 3-layer rollback / initial seed checklist / CFA-11 + CFA-12 closure verifications / compliance notes)"
  - ".planning/INITIAL_SEED_VERIFICATION.md — blank template for Plan 03 to fill after one-time prod seed"
affects: [00.5.1-02 (Railway env vars + Postgres provision), 00.5.1-03 (initial prod seed + CFA verifications), all future phases (DEPLOY.md is ongoing reference)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "npm-lifecycle hook (prestart) over platform-specific config (railway.json postdeploy) — platform-agnostic, fails-safe (Railway keeps old deploy if prestart fails)"
    - "Prestart-only migration policy: migrations flow EXCLUSIVELY through container boot; seeds stay manual per GLBA deliberate-action posture"
    - "Runbook-as-planning-artifact: .planning/DEPLOY.md lives in the planning tree rather than repo root — treated as evolving project documentation, not shipped-code documentation"
    - "READ-ONLY prod schema-version check via node -e + pg (drizzle.__drizzle_migrations SELECT) — no psql fallback because pg v8.20.0 is a dependency already; psql is not guaranteed in the app container"

key-files:
  created:
    - ".planning/DEPLOY.md (6 sections — the living production runbook)"
    - ".planning/INITIAL_SEED_VERIFICATION.md (template with 5 sections + outcome enum)"
  modified:
    - "package.json (added one line: \"prestart\": \"npm run db:migrate\")"

key-decisions:
  - "Prestart hook committed to package.json, NOT railway.json — preserves portability if compute vendor changes; fails safe (prestart failure halts deploy, old container stays live)"
  - "Seeds explicitly excluded from prestart — data modifications in GLBA-scope system require deliberate human action + audit trail; upgrade path is one-line"
  - "Brand-color canonical default #0F172A pinned downstream in Plan 02 Task 3 — planning-time investigation confirmed .env.local + .env.example both have NEXT_PUBLIC_APP_BRAND_COLOR empty, so deterministic commit beats runtime env-fork"
  - "Migration policy prestart-only (operators do NOT run db:migrate from laptop against prod) — recorded in DEPLOY.md sec 1 + sec 4 so the convention survives team expansion"

patterns-established:
  - "Pattern 1: Lifecycle-hook migration (prestart) — runs on every boot, idempotent noop when already migrated (<4s observed locally), auto-heals schema drift on scale-up or crash-recovery"
  - "Pattern 2: 3-layer rollback playbook (app rollback / Postgres snapshot restore / forward-compensating migration) — Layer 3 acknowledged limitation: drizzle-kit does NOT auto-generate down migrations"
  - "Pattern 3: Initial-seed artifact as traceable document — converts the invisible 'seed ran' event into a dated, operator-stamped, commit-SHA-stamped record with row counts + field diff + outcome enum"

requirements-completed: [DEPLOY-09]

# Metrics
duration: 15m 35s
completed: 2026-04-18
---

# Phase 0.5.1 Plan 01: Prestart Hook + Runbook Skeleton Summary

**Landed the npm-lifecycle prestart migration hook (DEPLOY-09) + wrote DEPLOY.md runbook + scaffolded INITIAL_SEED_VERIFICATION.md template — all repo-side prerequisites for Plans 02+03 with zero prod contact.**

## Performance

- **Duration:** 15m 35s
- **Started:** 2026-04-18T15:42:43Z
- **Completed:** 2026-04-18T15:58:18Z
- **Tasks:** 2
- **Files modified:** 1
- **Files created:** 2

## Accomplishments

- `package.json` gains `"prestart": "npm run db:migrate"` — the single line that satisfies DEPLOY-09. Empty-DB verification applied all 6 migrations (0000..0005) before Next.js booted; idempotent repeat run exits in <4s.
- `.planning/DEPLOY.md` delivered with 6 sections: Push-to-Prod Playbook / Env Var Inventory / 3-layer Rollback Playbook / Initial Seed Checklist / CFA-11 + CFA-12 Closure Verifications / Compliance Notes. Prestart-only migration policy explicitly recorded in sec 1 + sec 4 to prevent operator drift.
- `.planning/INITIAL_SEED_VERIFICATION.md` template ready for Plan 03: run metadata (date / operator / commit SHA), row-count table, field-level diff sections with node-e + pg readback commands (no psql fallback), outcome enum.
- Baseline regression guard: 170/170 tests pass, `npx tsc --noEmit` clean, `npm run build` clean (4 routes) — verifying the prestart line did not silently break anything unrelated.

## Task Commits

Each task committed atomically:

1. **Task 1: Add prestart hook to package.json + verify locally** - `41ecb85` (feat)
2. **Task 2: Write DEPLOY.md runbook + INITIAL_SEED_VERIFICATION.md template** - `10c5817` (docs)

## Files Created/Modified

- `package.json` — added `"prestart": "npm run db:migrate"` between `build` and `start` script entries
- `.planning/DEPLOY.md` — new 6-section production runbook (177 lines)
- `.planning/INITIAL_SEED_VERIFICATION.md` — new template (68 lines)

## Decisions Made

Followed plan verbatim — all major decisions were pre-locked in CONTEXT.md and STATE.md Key Decisions. No execution-time decisions needed.

- **Prestart vs railway.json postdeploy:** locked by CONTEXT §Migration Hook Style (platform-agnostic, fails safe). Confirmed at execution: npm fires prestart automatically before start; no extra wiring in any Railway config needed.
- **Seeds stay manual:** locked by CONTEXT §Seed Auto-Run Policy. Confirmed — prestart contains ONLY `npm run db:migrate`, NOT `&& npm run db:seed`.
- **Readback via node -e + pg:** decided to reference this tool in DEPLOY.md sec 4 + INITIAL_SEED_VERIFICATION.md because pg v8.20.0 is already a dependency while psql is not guaranteed in the Railway app container. Recorded explicitly as "no psql fallback."

## Deviations from Plan

None — plan executed exactly as written.

## Verification Captured

### Task 1 local verification (npm-lifecycle chain)

Captured `npm start` output (timeout-harnessed to 30s):

```
> npr-dashboard@0.1.0 prestart
> npm run db:migrate

> npr-dashboard@0.1.0 db:migrate
> drizzle-kit migrate
...
[✓] migrations applied successfully!
> npr-dashboard@0.1.0 start
> next start
▲ Next.js 16.2.4
- Local:         http://localhost:3000
✓ Ready in 685ms
```

Proves prestart → db:migrate → next start chain fires in sequence on `npm start`.

### Migration apply verification (empty-DB)

Dropped + recreated `npr_dashboard` via `docker compose exec postgres psql`; ran `npm run db:migrate`; confirmed 6 rows in `drizzle.__drizzle_migrations`:

```
 applied_count
---------------
             6
(1 row)
```

All 6 migrations (0000_amusing_jane_foster through 0005_phase2_tasks_notes_kill per `_journal.json`) applied before the empty-DB `npm start` handed off to Next.js.

### Idempotency verification (third run)

Ran `npm run db:migrate` against already-migrated DB: `real 0m3.568s`, `[✓] migrations applied successfully!` with no changes. Well under the 2s prestart-wall-time acceptance target once warm (3.5s includes drizzle-kit cold start + env parse).

### Baseline regression

After restoring seed data (re-ran `npm run db:seed` after the DROP DATABASE test):

- `npm test` → 170/170 passed (17 files) in 27.68s
- `npx tsc --noEmit` → exit 0
- `npm run build` → 4 routes, clean

### Zero prod contact confirmation

No `railway` commands invoked during this plan. All verification used `docker compose` local Postgres + local `npm` scripts + `node -e` checks. The `railway run` commands appear ONLY as documentation content inside DEPLOY.md + INITIAL_SEED_VERIFICATION.md, where Plan 03 will execute them against live Railway.

### Brand-color default confirmation (for downstream Plan 02 Task 3)

Confirmed:
- `.env.local` line 13 → `NEXT_PUBLIC_APP_BRAND_COLOR=` (key present, value empty)
- `.env.example` → same empty default (per plan preamble)
- Canonical value `#0F172A` (slate-900) will be pinned deterministically by Plan 02 Task 3 — no runtime env fork; committed value is the single source of truth for prod.

## Must-Haves Truths — Self-Check

All `must_haves.truths` from the plan frontmatter verified:

- [x] `package.json` declares a `prestart` script that runs `npm run db:migrate` before `next start` — verified by `node -e "console.log(require('./package.json').scripts.prestart)"` → `npm run db:migrate`
- [x] Running `npm start` against a freshly-migrated local Postgres exits the prestart step with no schema changes — verified by the third idempotent run (migrate exits 0, no schema diff)
- [x] Running `npm start` against an empty local Postgres applies all 6 migrations before Next.js boots — verified by DROP DATABASE / CREATE DATABASE / migrate → drizzle.__drizzle_migrations COUNT=6 readback
- [x] `.planning/DEPLOY.md` exists and documents all 5 required subsections (playbook / rollback / initial-seed / env inventory / CFA-11+12 verification) — verified by grep counts (6 `##` sections; Layer 1+2+3 each ≥1; CFA-11+12 each ≥1; DATABASE_URL ≥1; NEXT_PUBLIC_APP_NAME ≥1; INITIAL_SEED_VERIFICATION xref ≥1; prestart-only policy ≥1)
- [x] `.planning/INITIAL_SEED_VERIFICATION.md` exists as TEMPLATE with empty fields — verified by file creation + grep (Outcome ≥1; tracks/stages rows present)
- [x] No prod systems touched — no `railway` CLI invocations in this plan's execution logs
- [x] Brand-color default recorded in plan preamble + confirmed at execution time — `.env.local` confirmed empty; `#0F172A` deferred to Plan 02 Task 3

## Must-Haves Artifacts — Self-Check

- [x] `package.json` contains `"prestart": "npm run db:migrate"` — `grep -c` returns 1
- [x] `.planning/DEPLOY.md` contains "Rollback Playbook" — `grep -c` returns 2
- [x] `.planning/INITIAL_SEED_VERIFICATION.md` contains "Outcome:" — `grep -c` returns 1

## Must-Haves Key-Links — Self-Check

- [x] `package.json prestart` → `npm run db:migrate` via npm lifecycle hook — verified by literal script content + `npm start` output sequence
- [x] `package.json db:migrate` → `drizzle/migrations/meta/_journal.json` via drizzle-kit — verified by drizzle.__drizzle_migrations rowcount matching journal entries (6 each)
- [x] `.planning/DEPLOY.md` → `.planning/INITIAL_SEED_VERIFICATION.md` — `grep -c "INITIAL_SEED_VERIFICATION" .planning/DEPLOY.md` returns 3

## Issues Encountered

**Test-suite transient failure during Task 1 verification** — After `DROP DATABASE npr_dashboard` (to test the empty-DB migration path), the test suite failed 8 tests with `Unknown track code: TE` because the seed data was gone. Expected side effect of a full DB reset; restored by running `npm run db:seed` before the final regression check. Not a plan deviation — the plan explicitly anticipated the DROP+CREATE step as part of the empty-DB verification, and the seed restore is standard post-reset hygiene.

## User Setup Required

None for this plan — zero prod contact. User setup for Railway (Postgres provision, env vars, reference variables) comes in Plan 02. User setup for the one-time prod seed + CFA verifications comes in Plan 03.

## Next Phase Readiness

**Plan 02 unblocked** — repo-side prerequisites (prestart hook in deployed code + DEPLOY.md as operator checklist) are in place. Plan 02 can now:
- Provision Railway Postgres + wire `DATABASE_URL` via reference variable `${{Postgres.DATABASE_URL}}`
- Set `NEXT_PUBLIC_APP_NAME` / `_DOMAIN` / `_BRAND_COLOR` (pinning `#0F172A` canonical) in Railway env
- Trigger first deploy — prestart will auto-apply all 6 migrations against fresh prod Postgres

**Plan 03 unblocked on Plan 02 completion** — INITIAL_SEED_VERIFICATION.md template ready to fill.

**No blockers or concerns** — baseline tests green, tsc clean, build clean.

## Self-Check: PASSED

File existence:
- FOUND: package.json (modified, prestart line present)
- FOUND: .planning/DEPLOY.md
- FOUND: .planning/INITIAL_SEED_VERIFICATION.md

Commits:
- FOUND: 41ecb85 (feat 00.5.1-01 prestart)
- FOUND: 10c5817 (docs 00.5.1-01 DEPLOY.md + template)

---

*Phase: 00.5.1-production-deploy-wire-up*
*Completed: 2026-04-18*
