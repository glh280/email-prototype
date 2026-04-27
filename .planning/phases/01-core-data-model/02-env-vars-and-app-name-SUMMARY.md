---
phase: 01-core-data-model
plan: 02
subsystem: ops
tags: [env, zod, branding, template-extraction, next-public]

# Dependency graph
requires:
  - phase: 00.5-access-encryption
    provides: lib/env.ts with Zod schema (CF_ACCESS_*, ENCRYPTION_KEY, DATABASE_URL)
  - phase: 01-core-data-model/01
    provides: canonical @/lib/db import path (untouched here)
provides:
  - "lib/env.ts extended with NEXT_PUBLIC_APP_NAME (required), NEXT_PUBLIC_APP_DOMAIN (required, bare-domain regex), NEXT_PUBLIC_APP_BRAND_COLOR (optional)"
  - "AppHeader reads brand name from env instead of hardcoded literal"
  - ".env.example + .env.local documented with D-06 public-branding block"
affects: [future-logout-redirect, future-cors-origin, template-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NEXT_PUBLIC_* env vars validated server-side in lib/env.ts Zod schema"
    - "Bare-domain regex enforcement (no scheme, no path) for domain env vars"
    - "Cache-bust dynamic-import test pattern retained from P0.5 env.test.ts"

key-files:
  created: []
  modified:
    - lib/env.ts
    - components/app-header.tsx
    - .env.example
    - .env.local
    - tests/unit/env.test.ts
    - tests/unit/crypto.test.ts

key-decisions:
  - "D-06 applied end-to-end: brand name + domain promoted to NEXT_PUBLIC_* env vars, validated at boot"
  - "D-06 + D-10 combined: 'prototype' sub-label dropped from AppHeader (portal is live, not a prototype)"
  - "NEXT_PUBLIC_APP_DOMAIN enforced as bare domain via regex /^[a-zA-Z0-9.-]+$/ — catches accidental 'https://' prefixes early"
  - "NEXT_PUBLIC_APP_BRAND_COLOR kept optional (no default) — component code can branch on presence instead of parsing an empty string"

patterns-established:
  - "Pattern: adding a required env var forces updating any test that bootstraps env via process.env mutation — catch via full-suite run after schema change (see Rule 3 deviation)"
  - "Pattern: cache-bust dynamic import ('@/lib/env?some-tag') lets each test own its own env snapshot without module cache pollution"

requirements-completed: [OPS-01]

# Metrics
duration: ~3m 24s
completed: 2026-04-17
---

# Phase 01 Plan 02: Env Vars and App Name Summary

**D-06 landed: NEXT_PUBLIC_APP_NAME / NEXT_PUBLIC_APP_DOMAIN / NEXT_PUBLIC_APP_BRAND_COLOR added to the Zod env schema; AppHeader now reads brand name from env (and the 'prototype' sub-label is gone); 28/28 tests green, build clean.**

## Performance

- **Duration:** ~3 min 24 sec
- **Started:** 2026-04-17T22:03:43Z
- **Completed:** 2026-04-17T22:07:07Z
- **Tasks:** 2 (Task 1 TDD RED+GREEN, Task 2 AppHeader edit)
- **Files modified:** 6 (no new files)

## Accomplishments

- **`lib/env.ts` schema extended** with a dedicated "Public branding (D-06)" block containing:
  - `NEXT_PUBLIC_APP_NAME: z.string().min(1)` — required
  - `NEXT_PUBLIC_APP_DOMAIN: z.string().min(1).regex(/^[a-zA-Z0-9.-]+$/, "must be a bare domain (no scheme, no path)")` — required
  - `NEXT_PUBLIC_APP_BRAND_COLOR: z.string().optional()` — optional (no default)
- **5 new assertions** in `tests/unit/env.test.ts` covering happy-path parse, missing-required error text, optional handling, and bare-domain regex rejection. Follows the existing cache-bust dynamic-import pattern exactly.
- **`components/app-header.tsx`** now renders `{env.NEXT_PUBLIC_APP_NAME}` instead of the literal "NPR Dashboard"; the "prototype" `<span>` sub-label was deleted per D-06 / D-10 (portal is live at portal.utstitle.com, no longer a prototype).
- **`.env.example`** documents all three vars with a "Public branding (D-06)" comment block inserted between CF_ACCESS_* and the NPI encryption block.
- **`.env.local`** populated with real dev values (gitignored — not committed).
- **Test suite:** 28/28 green (was 23/23 baseline; 5 new env assertions added).
- **Build + typecheck:** `npm run build` and `npx tsc --noEmit` both exit 0.

## Before / After Diff Snippets

### `lib/env.ts`

**Before:**
```typescript
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1),
  CF_ACCESS_AUD: z.string().min(1),

  // Column-level NPI encryption (required in C3+)
  // 32-byte base64 is 44 chars including padding
  ENCRYPTION_KEY: z.string().min(44).optional(),
```

**After:**
```typescript
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1),
  CF_ACCESS_AUD: z.string().min(1),

  // Public branding (D-06 — exposed to the browser as NEXT_PUBLIC_*)
  // Promoted from hardcoded strings so template-extraction users rebrand via env.
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9.-]+$/, "must be a bare domain (no scheme, no path)"),
  NEXT_PUBLIC_APP_BRAND_COLOR: z.string().optional(),

  // Column-level NPI encryption (required in C3+)
  // 32-byte base64 is 44 chars including padding
  ENCRYPTION_KEY: z.string().min(44).optional(),
```

### `components/app-header.tsx`

**Before** (lines 46-49):
```tsx
<div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
NPR Dashboard
<span className="text-xs font-normal text-muted-foreground ml-2">prototype</span>
</Link>
```

**After:**
```tsx
<div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
{env.NEXT_PUBLIC_APP_NAME}
</Link>
```

## Task Commits

1. **Task 1 TDD RED** — `65e598c` — `test(01-02): add failing tests for NEXT_PUBLIC_APP_NAME/DOMAIN/BRAND_COLOR` (5 new assertions against unmodified schema → 4 failing as expected)
2. **Task 1 TDD GREEN** — `0e18e3a` — `feat(01-02): extend env Zod schema with NEXT_PUBLIC_APP_NAME/DOMAIN/BRAND_COLOR` (schema + .env.example + crypto.test.ts fix; suite back to green at 28/28)
3. **Task 2** — `9ddba76` — `feat(01-02): AppHeader reads brand name from env.NEXT_PUBLIC_APP_NAME`

**Plan metadata commit:** produced after this SUMMARY.md write.

## D-06 Implementation Status

D-06 is **fully implemented**:

- [x] `NEXT_PUBLIC_APP_NAME=NPR Dashboard` in `.env.example` and `.env.local`
- [x] `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com` in `.env.example` and `.env.local`
- [x] `NEXT_PUBLIC_APP_BRAND_COLOR=` optional var documented with default-strategy note
- [x] `lib/env.ts` Zod schema validates all three at boot
- [x] `components/app-header.tsx` reads `NEXT_PUBLIC_APP_NAME` (no hardcoded brand string)
- [x] "prototype" sub-label dropped (combined D-06 + D-10 decision)

**Downstream consumers still to come** (future plans, not in this scope):
- Logout redirect URL currently interpolates `env.CF_ACCESS_TEAM_DOMAIN`; if/when a branded logout landing is wanted, it can read `env.NEXT_PUBLIC_APP_DOMAIN` instead. No change needed today.
- CORS origin — not currently enforced in the app; `proxy.ts` is Cloudflare-Access-gated and doesn't emit CORS headers. If ever needed, `env.NEXT_PUBLIC_APP_DOMAIN` is ready.

## Test Patterns Learned From env.test.ts

The existing test file in P0.5 established a clean pattern worth preserving across future env-schema edits:

1. **Save + restore `process.env`** in `beforeEach` / `afterEach`, not in each test — prevents test-leak bugs where one test's env mutation pollutes the next.
2. **`setRequired()` helper** sets the minimum set of vars needed for a successful parse. Tests that exercise error paths mutate from there (e.g., `process.env.NEXT_PUBLIC_APP_NAME = ""`).
3. **Cache-bust dynamic import** via a per-test query suffix like `import("@/lib/env?no-aud")` — Vite treats each as a fresh module, bypassing the module cache. No `vi.resetModules()` needed.
4. **Regex error messages surface in the thrown `Error`**: `rejects.toThrow(/must be a bare domain/)` lets one assertion prove both "the regex rejected it" and "the error message is actionable".
5. **Missing vs. empty:** `process.env.FOO = ""` (empty string) triggers `.min(1)` failure; `delete process.env.FOO` triggers "Required" failure. For optional fields, `delete` is the right test — setting empty string would actually pass `optional()`.

These patterns carry forward to every future env-schema extension (Gmail OAuth in P4/P5, R2 in P5.5, Anthropic API in P6).

## Decisions Made

None new — plan applied existing decisions D-06 and D-10 from CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] `tests/unit/crypto.test.ts` missing new required env vars**
- **Found during:** Task 1 GREEN phase (full-suite regression run)
- **Issue:** After extending the Zod schema with required `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_DOMAIN`, all 5 crypto tests started failing because their `beforeEach` block set up a minimal env (`DATABASE_URL`, `CF_ACCESS_*`, `ENCRYPTION_KEY`) but no branding vars. `lib/env.ts` validation threw during module import → tests crashed before assertions ran.
- **Fix:** Added `NEXT_PUBLIC_APP_NAME = "NPR Dashboard"` + `NEXT_PUBLIC_APP_DOMAIN = "portal.utstitle.com"` to the existing `beforeEach` in `tests/unit/crypto.test.ts`. No new imports; preserved the existing pattern.
- **Files modified:** `tests/unit/crypto.test.ts` (1 insertion in the beforeEach block)
- **Commit:** `0e18e3a` (bundled with the Task 1 GREEN feat commit — same logical change set)

Notably, the plan anticipated editing only `tests/unit/env.test.ts`; it did not flag that other test files also bootstrap env. The pattern worth capturing: **any tightening of required env vars must sweep all test files that mutate `process.env` before importing env-dependent modules.** Future env-schema plans should include this sweep in the plan's `<action>` block explicitly.

## Issues Encountered

None beyond the Rule 3 fix above.

## Authentication Gates

None. Purely a local code + env-file change.

## Known Stubs

None. All three new env vars are:
- Real values in `.env.local` for dev
- Real placeholder values in `.env.example` for onboarding
- Actually read by the AppHeader component (the one consumer this plan wired)

The optional `NEXT_PUBLIC_APP_BRAND_COLOR` is not consumed by any component today, but that's not a stub — the plan's scope was "validate at boot, make available." Future theming work will read it; the Zod schema guarantees its shape when that day arrives.

## User Setup Required

None — no external service configuration. Local `.env.local` was updated in place.

## Next Phase Readiness

- **Plan 03 (file_no generator):** unblocked; no env dependency.
- **Plan 04 (seed tracks + stages):** unblocked; no env dependency.
- **Plan 05 (new-deal form):** unblocked. If the form shows branded copy (e.g., "Create a new {APP_NAME} deal"), it can now read from `env.NEXT_PUBLIC_APP_NAME`.
- **Plan 06 (list view rewrite):** unblocked. Same branding access pattern available for page titles / metadata.
- **Future deployment:** Railway env vars for the production environment must include `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_DOMAIN` or the app will fail to boot. `.env.example` documents the names; deployment runbook should list them explicitly at next deploy.

## Self-Check

- [x] `lib/env.ts` has `NEXT_PUBLIC_APP_NAME` — VERIFIED (grep returns 3 matches across the three NEXT_PUBLIC_* fields)
- [x] `lib/env.ts` has `NEXT_PUBLIC_APP_DOMAIN` with bare-domain regex — VERIFIED
- [x] `lib/env.ts` has optional `NEXT_PUBLIC_APP_BRAND_COLOR` — VERIFIED
- [x] `.env.example` has `NEXT_PUBLIC_APP_NAME=NPR Dashboard` — VERIFIED (grep returns 1 match)
- [x] `.env.example` has `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com` — VERIFIED (grep returns 1 match)
- [x] `.env.local` has `NEXT_PUBLIC_APP_NAME=` set (real value for dev) — VERIFIED (grep returns 1 match)
- [x] `tests/unit/env.test.ts` has 5+ new assertions — VERIFIED (5 new `it(...)` blocks added after the ENCRYPTION_KEY case)
- [x] `tests/unit/env.test.ts` tests the bare-domain regex error path — VERIFIED ("must be a bare domain" grep returns 1 match)
- [x] `components/app-header.tsx` renders `{env.NEXT_PUBLIC_APP_NAME}` — VERIFIED (grep returns 1 match)
- [x] `components/app-header.tsx` no longer contains the literal "NPR Dashboard" — VERIFIED (grep returns 0 matches)
- [x] `components/app-header.tsx` no longer contains "prototype" — VERIFIED (grep returns 0 matches)
- [x] Commit `65e598c` (TDD RED) in git log — VERIFIED
- [x] Commit `0e18e3a` (TDD GREEN) in git log — VERIFIED
- [x] Commit `9ddba76` (Task 2) in git log — VERIFIED
- [x] `npm test` → 28/28 green — VERIFIED
- [x] `npm run build` → exit 0 — VERIFIED
- [x] `npx tsc --noEmit` → exit 0 — VERIFIED
- [x] All 4 must_haves.truths verified:
  - [x] "`lib/env.ts` Zod schema validates NEXT_PUBLIC_APP_NAME and NEXT_PUBLIC_APP_DOMAIN"
  - [x] "`components/app-header.tsx` reads brand name from env, not a hardcoded string"
  - [x] "`.env.example` documents the two new variables with placeholder values"
  - [x] "`npm test tests/unit/env.test.ts` passes (new assertions for the two variables)"
- [x] Requirement OPS-01 marked complete

## Self-Check: PASSED

---
*Phase: 01-core-data-model*
*Completed: 2026-04-17*
