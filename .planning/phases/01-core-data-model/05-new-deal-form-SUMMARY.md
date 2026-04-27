---
phase: 01-core-data-model
plan: 05
subsystem: ui/server-action/form
tags: [nextjs-server-action, react-hook-form, zod, shadcn-form, accordion, audit-log, transaction, money-parsing]

# Dependency graph
requires:
  - phase: 01-core-data-model
    plan: 01
    provides: deals + audit_log + tracks + stages schemas; @/lib/db canonical client
  - phase: 01-core-data-model
    plan: 03
    provides: generateFileNo(tx, state) + AppTx type (DEAL-02a atomicity)
  - phase: 01-core-data-model
    plan: 04
    provides: TRACK_SEEDS + STAGE_SEEDS (default pre_screen_qualification available)
provides:
  - app/deal/new/page.tsx (Server Component wrapper + file_no preview estimate)
  - app/deal/new/new-deal-form.tsx (Client Component — shadcn accordion, RHF + Zod, money UX)
  - app/deal/new/actions.ts (createDeal — transactional file_no + insert + audit)
  - lib/deal-schema.ts (shared createDealSchema + CreateDealInput / CreateDealFormInput)
  - lib/audit.ts (writeAuditLog helper — OPS-01 reusable)
  - lib/parse-money.ts (parseMoney — reusable $-prefix money parser)
  - components/ui/form.tsx (shadcn/ui Form wrapper wired to react-hook-form)
  - components/ui/label.tsx, accordion.tsx, calendar.tsx (shadcn primitives)
affects: [06-list-view-rewrite, P2 detail-page, P2 update/stage audit]

# Tech tracking
tech-stack:
  added:
    - "react-hook-form ^7.72.1 (deps)"
    - "@hookform/resolvers ^5.2.2 (deps) — zodResolver"
    - "react-day-picker ^9.14.0 (deps) — via shadcn Calendar"
    - "date-fns ^4.1.0 (deps) — Calendar peer"
  patterns:
    - "Split Zod input/output types (z.input vs z.infer) so react-hook-form's form state can hold optional defaults while the server action gets the resolved output"
    - "useForm generics: `useForm<FormInput, unknown, OutputInput>` — required when the schema has .default(...) transforms"
    - "$-prefix money input: raw string in DOM (defaultValue, uncontrolled), onBlur runs parseMoney and writes integer back via form.setValue + re-paints display text"
    - "All three mutations (file_no gen, deal insert, audit insert) live inside ONE db.transaction so atomicity is structural, not advisory — test 7 in create-deal-action.test.ts enforces the rollback invariant"
    - "Mocked next/navigation.redirect in tests by throwing a digest-tagged error the test catches — lets unit tests observe redirect intent without the full Next.js runtime"
    - "vitest `fileParallelism: false` — DB-touching test files must not race over shared per-year Postgres sequences"

key-files:
  created:
    - app/deal/new/page.tsx
    - app/deal/new/new-deal-form.tsx
    - app/deal/new/actions.ts
    - lib/deal-schema.ts
    - lib/audit.ts
    - lib/parse-money.ts
    - components/ui/form.tsx
    - components/ui/label.tsx
    - components/ui/accordion.tsx
    - components/ui/calendar.tsx
    - tests/unit/parse-money.test.ts
    - tests/unit/create-deal-action.test.ts
  modified:
    - vitest.config.ts  # fileParallelism: false
    - package.json      # react-hook-form, @hookform/resolvers, date-fns, react-day-picker
    - package-lock.json

key-decisions:
  - "Form input/output type split is a one-time interoperability fix between Zod v4 + RHF + .default() — future schemas with defaults should follow the same pattern"
  - "parseMoney truncates decimals (Math.trunc), never rounds — P1 schema is integer USD. If decimals matter in P2, the refactor lives in parse-money + schema + migration; the UI signal stays the same"
  - "Track color dot map TRACK_DOT_CLASSES is duplicated here vs Plan 06's lib/format.ts::trackBadgeClasses. Plan 06 consolidates them — new-deal-form will import from lib/format.ts after P06 lands. Inline duplication here avoids a P05→P06 ordering dependency."
  - "next/navigation.redirect is called after the transaction commits, outside any try/catch — matches the Next.js 16 redirecting.md pattern; the NEXT_REDIRECT digest-tagged error is re-thrown from the startTransition callback so React Router handles the navigation"
  - "Toaster was already mounted in app/layout.tsx from P0.5 — no layout change needed this plan"
  - "Auth gates: none — Cloudflare Access already protects all routes via proxy.ts; /deal/new and createDeal inherit this. getCurrentUser() throws if the JWT header is absent, which surfaces misconfiguration immediately."

patterns-established:
  - "Pattern: shared Zod schema lives at lib/{feature}-schema.ts; both form client AND server action import the same createDealSchema so validation is single-sourced"
  - "Pattern: writeAuditLog(tx, {...}) helper is transaction-scoped — any mutation that wants OPS-01 coverage passes its open tx; audit rollback comes free"
  - "Pattern: money UI via makeMoneyBlurHandler(field) — reusable factory writes parsed integer back to form state; any $-prefix input in P2 (detail-page edits) can adopt this verbatim"
  - "Pattern: server-action testing — mock next/navigation.redirect + next/cache.revalidatePath + @/lib/current-user; exercise the real DB via a pre-seeded test user; capture redirect via thrown NEXT_REDIRECT digest"

requirements-completed: [DEAL-02, DEAL-02a, DEAL-03, OPS-01]

# Metrics
duration: ~13m
completed: 2026-04-17
---

# Phase 01 Plan 05: New Deal Form Summary

**Ship `/deal/new` — sectioned-accordion form with react-hook-form + Zod + $-prefix money UX, whose `createDeal` server action atomically wraps file-no generation + deal insert + audit-log write in one `db.transaction`. DEAL-02, DEAL-02a, DEAL-03, and OPS-01 (partial, per D-05) shipped end-to-end.**

## Performance

- **Duration:** ~13m
- **Started:** 2026-04-17T22:34:00Z
- **Completed:** 2026-04-17T22:47:00Z
- **Tasks:** 4 (parseMoney TDD; schema + action TDD; shadcn primitives; form UI)
- **Files created/modified:** 14 (12 created + 2 modified; +package-lock)
- **Commits:** 7 task commits + this SUMMARY commit

## Route + Component Topology

```
/deal/new
├── app/deal/new/page.tsx            (Server Component — RSC boundary)
│   ├── AppHeader                    (existing — reads Cloudflare Access user)
│   ├── Back-to-deals link           → /
│   ├── h1 "New Deal" + subtitle     (UI-SPEC verbatim copy)
│   └── <NewDealForm />              (client boundary)
└── app/deal/new/new-deal-form.tsx   (Client Component — 'use client')
    ├── useForm<FormInput, _, Out>    (RHF + zodResolver)
    ├── Accordion (3 sections, file-basics open)
    │   ├── File basics              (track, priority, title, property state, file# preview, main contact name/email)
    │   ├── Property details          (address, type, sales price, loan type, transaction type)
    │   └── Financials & dates        (5 money fields + closing/funding dates + 2 CTC checkboxes)
    ├── onSubmit → startTransition → createDeal(data)
    └── Sticky footer: Cancel → /    |    Create Deal (Loader2 spinner)
```

Server-side on submit: `createDeal` (RSC action, `'use server'`) runs the transactional pipeline below, then redirects to `/?created={fileNo}` so the P06 list view can emit the `Deal {file_no} created.` toast.

## `createDeal` Transaction Sequence

Inside a single `db.transaction(async tx => ...)` call:

1. **Resolve track id** — `SELECT id FROM tracks WHERE code = $trackCode LIMIT 1`
2. **Resolve default stage id** — `SELECT id FROM stages WHERE code='pre_screen_qualification' AND track_id IS NULL LIMIT 1` (D-10 — universal default)
3. **Generate file_no** — `generateFileNo(tx, propertyState)` from Plan 03 (atomic Postgres `nextval` inside the same tx)
4. **Insert deal** — all validated fields; `status='active'`, `createdBy=user.id`, `internalOwner=user.id` (D-18 default), with `.returning()` for the audit row
5. **Write audit row** — `writeAuditLog(tx, { tableName: "deals", recordId, operation: "create", beforeJson: null, afterJson: newDeal, user })` (D-05)

After the transaction commits: `revalidatePath("/")` + `redirect('/?created=' + encodeURIComponent(fileNo))`. `redirect()` throws a NEXT_REDIRECT digest error and is called outside any try/catch per the Next.js 16 pattern.

**Invariant test:** `tests/unit/create-deal-action.test.ts` Test 7 mocks `writeAuditLog` to throw; asserts no deals row exists after the action throws (structural rollback).

## Next.js 16 Server Action Gotchas Found

1. **`redirect()` from `next/navigation` — not a return value.** It throws a special navigation error. Calling it inside `try/catch` eats the digest and breaks navigation. Fix: call it after the transaction completes, outside any catch block. The client-side `startTransition` callback handles the thrown NEXT_REDIRECT by re-throwing — checked via `err.digest.startsWith("NEXT_REDIRECT")`.
2. **`revalidatePath("/")` before `redirect()` is idiomatic** per `node_modules/next/dist/docs/01-app/02-guides/redirecting.md`. We followed that ordering.
3. **No client-side `redirect()` unwinding needed** — the server-action framework serializes the thrown error across the RSC boundary; the client just re-throws so React's transition boundary resolves navigation.

## shadcn Form Pattern Tweak

The **base-nova** shadcn preset (`style: "base-nova"` in components.json) does NOT ship a `form` primitive — it defers to base-ui's `Field` component. Because Plan 05 specifies react-hook-form + Zod (matching the canonical shadcn/ui Form composition), we:

1. Ran `npx shadcn@latest add label calendar accordion` — got 3 files (no `form.tsx`)
2. Installed `react-hook-form` + `@hookform/resolvers` manually
3. Hand-wrote `components/ui/form.tsx` mirroring the shadcn/ui Form API (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`)

One subtle fix: `FormField` generics order must match RHF 7.72's `ControllerProps<TFieldValues, TName, TTransformedValues>` — the original shadcn docs show the older order `<TFieldValues, TTransformedValues, TName>` which doesn't compile against current RHF types.

`<Slot>` is inlined locally (small React.cloneElement wrapper) rather than importing `@radix-ui/react-slot`, keeping base-nova's zero-Radix footprint.

## `parseMoney` Behavior Table

| Input                | Output  | Reason                             |
| -------------------- | ------- | ---------------------------------- |
| `null` / `undefined` | `null`  | nothing typed                      |
| `""` / `"   "`       | `null`  | whitespace-only                    |
| `"485000"`           | `485000`| plain integer                      |
| `"485,000"`          | `485000`| comma-grouped                      |
| `"$485,000"`         | `485000`| dollar-prefix                      |
| `"$ 485,000 "`       | `485000`| whitespace + prefix + commas       |
| `"0"`                | `0`     | explicit zero is valid             |
| `"485,000.75"`       | `485000`| decimals truncated (Math.trunc)    |
| `"abc"`              | `null`  | non-numeric                        |
| `"-50"`              | `null`  | negatives rejected                 |
| `"$"`                | `null`  | no digits after cleanup            |

**Wire points:** every `$-prefix` input in Section 2 and Section 3 (6 fields total: `salesPrice`, `loanAmount`, `estimatedDown`, `earnestMoney`, `estRehab`, `arv`) wires `onBlur={makeMoneyBlurHandler("<fieldName>")}`. The factory reads the raw DOM value, runs `parseMoney`, writes the integer (or `null`) back via `form.setValue`, then repaints the input with the formatted string `$485,000`.

## Track Color-Dot Map

`new-deal-form.tsx::TRACK_DOT_CLASSES` is the P05-local mirror of the eventual `lib/format.ts::trackBadgeClasses` that Plan 06 lands:

```ts
{ TE: "bg-blue-500", FL: "bg-green-500", DP: "bg-purple-500",
  PO: "bg-pink-500", EC: "bg-amber-500", SL: "bg-rose-500",
  BL: "bg-teal-500", GI: "bg-gray-400" }
```

After P06 introduces `lib/format.ts`, a follow-up refactor in that plan should replace this local map with the import to eliminate the duplicate. Tracked in the Next Phase Readiness section below.

## Decisions Implemented (with IDs)

| ID   | Implementation                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| D-05 | Audit row written in same tx as deal insert; userEmail denormalized (survives user deletion); before=null on create      |
| D-08 | Sectioned accordion — file-basics open, property-details + financials collapsed                                          |
| D-09 | Property section always visible (no per-track conditional rendering)                                                     |
| D-10 | Default stage resolved to universal `pre_screen_qualification` (track_id IS NULL)                                        |
| D-11 | Inline RHF + Zod validation; toast on submit error; redirect+toast on success                                            |
| D-17 | `createdBy` = getCurrentUser().id — populated from Cloudflare Access JWT                                                 |
| D-18 | `internalOwner` = createdBy on insert (editable later)                                                                   |
| D-19 | `status='active'` on insert; P2 adds closed/killed state machine                                                         |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn base-nova has no `form` primitive; react-hook-form not auto-installed**

- **Found during:** Task 3 (`npx shadcn@latest add form label calendar accordion`)
- **Issue:** The CLI wrote `label.tsx`, `calendar.tsx`, `accordion.tsx` but skipped `form.tsx` entirely (base-nova defers form composition to base-ui's native `Field` primitive). `react-hook-form` and `@hookform/resolvers` were NOT added to `package.json`.
- **Fix:** (a) Manually ran `npm install react-hook-form @hookform/resolvers`; (b) hand-wrote `components/ui/form.tsx` mirroring the canonical shadcn/ui Form API against react-hook-form types directly; (c) inlined a small `<Slot>` wrapper instead of pulling `@radix-ui/react-slot` to preserve base-nova's Radix-free footprint.
- **Files modified:** `components/ui/form.tsx` (created), `package.json`, `package-lock.json`
- **Commit:** `10668f7`

**2. [Rule 3 - Blocking] DB sequence race between file-no.test.ts and create-deal-action.test.ts under Vitest file-level parallelism**

- **Found during:** Task 2 (first full `npm test` after adding the new test file)
- **Issue:** Both tests manipulate the shared Postgres sequence `deals_file_no_YYYY_seq`. When vitest 4.1 ran them in parallel worker threads, they collided on `DROP SEQUENCE IF EXISTS` / `CREATE SEQUENCE IF NOT EXISTS` / `SELECT nextval(...)`, producing intermittent `could not open relation with OID …` errors from Postgres. Baseline 49/49 tests passed before this plan because no two test files touched the sequence.
- **Fix:** Added `fileParallelism: false` to `vitest.config.ts`. Tests within a file still run sequentially (describe-default), but different files now serialize. Also refactored `create-deal-action.test.ts` to NOT drop the sequence in its `beforeEach` — prefix/regex assertions tolerate any starting counter, which avoids being the source of races if the config gets reverted.
- **Files modified:** `vitest.config.ts`, `tests/unit/create-deal-action.test.ts`
- **Commit:** `dd83f05`

**3. [Rule 1 - Bug] Zod v4 `z.string().trim().min(1, msg)` doesn't fire on `undefined` input**

- **Found during:** Task 2 Test 6 (validation rejection with missing title)
- **Issue:** `z.string().trim().min(1, "Title is required.")` produces "Invalid input: expected string, received undefined" when the field is omitted, not the custom required message. This surfaced because the test submits a payload without `title` entirely (simulating an empty form submit).
- **Fix:** Passed `{ message: "Title is required." }` to the `z.string({ ... })` constructor so the undefined-type-check message also reads "Title is required." This mirrors Zod v4's documented way to override the invalid_type error.
- **Files modified:** `lib/deal-schema.ts`
- **Commit:** `848b70b` (fix landed alongside the feat commit — was discovered during the TDD GREEN phase, before the task's test commit was pushed)

**4. [Rule 1 - Bug] Zod `z.boolean().default(false)` creates an input/output type mismatch that RHF resolver typings reject**

- **Found during:** Task 4 typecheck (`npx tsc --noEmit`)
- **Issue:** When a Zod schema includes `.default(x)`, `z.infer` returns the shape with the field REQUIRED, but the form state legitimately holds it as optional (user hasn't typed yet). RHF's `useForm<T>` + `zodResolver<T>` typings conflict: resolver emits output-shape, form state wants input-shape.
- **Fix:** Added `CreateDealFormInput = z.input<typeof createDealSchema>` and parameterized `useForm<CreateDealFormInput, unknown, CreateDealInput>` so input/output shapes are split explicitly. The handler signature `(data: CreateDealInput) => void` now matches the resolved output type.
- **Files modified:** `lib/deal-schema.ts`, `app/deal/new/new-deal-form.tsx`
- **Commit:** `64765a2`

No other deviations. The Next.js 16 redirect/revalidatePath pattern worked on first try matching the docs.

## Auth Gates

None encountered. Cloudflare Access via `proxy.ts` already protects `/deal/new` and the server action by JWT verification at the edge. `getCurrentUser()` reads + re-verifies the JWT from request headers — it throws if missing, which would manifest as a server error but cannot happen inside the authenticated tunnel. Test harness stubbed `getCurrentUser()` via `vi.mock`.

## Task Commits

| Task                                | Commit    |
| ----------------------------------- | --------- |
| Task 1 RED: parseMoney tests        | `378c1b5` |
| Task 1 GREEN: parseMoney impl       | `aef00ae` |
| Task 2 RED: createDeal tests        | `67d9f58` |
| Task 2 GREEN: schema + audit + action| `848b70b` |
| Task 2 fix: vitest fileParallelism  | `dd83f05` |
| Task 3: shadcn primitives + form.tsx| `10668f7` |
| Task 4: page + new-deal-form        | `64765a2` |

Plan metadata commit follows this SUMMARY write.

## Files Created/Modified

- **Created** `lib/parse-money.ts` — pure TS money parser (no DB, no deps)
- **Created** `lib/deal-schema.ts` — shared Zod + `CreateDealInput` / `CreateDealFormInput`
- **Created** `lib/audit.ts` — `writeAuditLog(tx, ...)` helper
- **Created** `app/deal/new/page.tsx` — Server Component
- **Created** `app/deal/new/new-deal-form.tsx` — Client Component ('use client')
- **Created** `app/deal/new/actions.ts` — `createDeal` server action ('use server')
- **Created** `components/ui/form.tsx` — shadcn/ui Form wrapper wired to RHF
- **Created** `components/ui/label.tsx` — via shadcn CLI
- **Created** `components/ui/accordion.tsx` — via shadcn CLI (base-ui primitive)
- **Created** `components/ui/calendar.tsx` — via shadcn CLI (react-day-picker wrapper)
- **Created** `tests/unit/parse-money.test.ts` — 13 behaviors green
- **Created** `tests/unit/create-deal-action.test.ts` — 9 behaviors green
- **Modified** `vitest.config.ts` — `fileParallelism: false`
- **Modified** `package.json` + `package-lock.json` — +react-hook-form, +@hookform/resolvers, +date-fns, +react-day-picker

## Decisions Made

No new cross-plan decisions — Plan 05 applied D-05/D-08/D-09/D-10/D-11/D-17/D-18/D-19 as locked in CONTEXT.md.

## Issues Encountered

All four were auto-fixed inline (see Deviations above). None required architectural escalation.

## Explicit Waiver

**Per-section progress counter** ("3 / 5 filled" meta in each accordion section header, UI-SPEC Page 2): **DEFERRED.** Per CONTEXT.md D-08..D-16 "revisit after seeing it working" direction, and the plan's `<notes>` block. The form ships section headers without the inline counter; a P1 follow-up ticket tracks re-opening after Carrie's first usage session.

## Known Stubs

None. `/deal/new` creates real rows and writes real audit entries. The only duplicated data surface is `TRACK_DOT_CLASSES` in `new-deal-form.tsx` which mirrors the color map coming in Plan 06's `lib/format.ts` — flagged as a refactor target in `patterns-established` and `key-decisions` above, not a stub.

## User Setup Required

None. Cloudflare Access is already live, DB is migrated + seeded, `ENCRYPTION_KEY` is set, Toaster is mounted.

## Next Phase Readiness

- **Plan 06 (list view rewrite):**
  - Unblocked on data — `/deal/new` writes real `deals` rows so the list view has something to render
  - The `?created={fileNo}` URL param is the contract: Plan 06's `app/page.tsx` must read this search param and emit `toast.success("Deal {file_no} created.")` with a 4s duration (UI-SPEC Page 1 "Toasts" section). That toast can't be fired from the server action itself because it fires in the redirected context.
  - Plan 06 introduces `lib/format.ts::trackBadgeClasses` — after that lands, refactor `app/deal/new/new-deal-form.tsx` to `import { trackBadgeClasses } from '@/lib/format'` (or a sibling `trackDotClasses` export) and remove the local `TRACK_DOT_CLASSES` map
- **P2 (deal detail + edit):**
  - `writeAuditLog` helper is already generalized (`operation: 'create' | 'update' | 'delete'`) — P2 deal-update action wires the same helper inside its own `db.transaction` with `beforeJson`/`afterJson` diffs
  - `makeMoneyBlurHandler` pattern is transferable — detail-page edit form can reuse parseMoney + the same onBlur factory unchanged

## Self-Check

- [x] `lib/parse-money.ts` exists — FOUND
- [x] `lib/deal-schema.ts` exists — FOUND
- [x] `lib/audit.ts` exists — FOUND
- [x] `app/deal/new/page.tsx` exists — FOUND
- [x] `app/deal/new/new-deal-form.tsx` exists — FOUND
- [x] `app/deal/new/actions.ts` exists — FOUND
- [x] `components/ui/form.tsx` exists — FOUND
- [x] `components/ui/label.tsx` exists — FOUND
- [x] `components/ui/accordion.tsx` exists — FOUND
- [x] `components/ui/calendar.tsx` exists — FOUND
- [x] `tests/unit/parse-money.test.ts` exists — FOUND (13 tests green)
- [x] `tests/unit/create-deal-action.test.ts` exists — FOUND (9 tests green)
- [x] Commit `378c1b5` (parse-money RED) exists — VERIFIED via git log
- [x] Commit `aef00ae` (parse-money GREEN) exists — VERIFIED
- [x] Commit `67d9f58` (createDeal RED) exists — VERIFIED
- [x] Commit `848b70b` (createDeal GREEN) exists — VERIFIED
- [x] Commit `dd83f05` (vitest fileParallelism) exists — VERIFIED
- [x] Commit `10668f7` (shadcn primitives + form.tsx) exists — VERIFIED
- [x] Commit `64765a2` (page + form) exists — VERIFIED
- [x] `npm test tests/unit/parse-money.test.ts` → exit 0, 13 passing — VERIFIED
- [x] `npm test tests/unit/create-deal-action.test.ts` → exit 0, 9 passing — VERIFIED
- [x] `npm test` full suite → 71/71 passing (49 baseline + 13 parse-money + 9 create-deal-action) — VERIFIED
- [x] `npx tsc --noEmit` → exit 0, no output — VERIFIED
- [x] `npm run build` → compiled successfully, `/deal/new` route registered — VERIFIED
- [x] No file references `@/db/client` (grep returns 0 across all created files) — VERIFIED
- [x] `createDeal` wraps file_no + insert + audit in ONE `db.transaction` — VERIFIED (grep `db.transaction` in actions.ts)
- [x] Every `$-prefix` money field wires `onBlur` through `parseMoney` — VERIFIED (grep `makeMoneyBlurHandler` returns 6 usages)
- [x] Track `<SelectItem>` renders a colored dot — VERIFIED (`h-2 w-2 rounded-full mr-2` inline span)
- [x] Submit redirects to `/?created={fileNo}` — VERIFIED in actions.ts
- [x] All 9 must_haves.truths satisfied — VERIFIED
- [x] Requirements DEAL-02, DEAL-02a, DEAL-03, OPS-01 eligible to be marked complete — WILL BE MARKED via `requirements mark-complete`

## Self-Check: PASSED

---
*Phase: 01-core-data-model*
*Completed: 2026-04-17*
