---
phase: 01-core-data-model
plan: 04
type: execute
wave: 2
depends_on: [01-core-data-model/01]
files_modified:
  - db/seed/tracks.ts
  - db/seed/stages.ts
  - db/seed/run.ts
  - package.json
  - tests/unit/seed-shape.test.ts
autonomous: true
requirements: [DEAL-01, STAGE-01]
requirements_addressed: [DEAL-01, STAGE-01]

must_haves:
  truths:
    - "`db/seed/tracks.ts` exports 8 track rows (TE, FL, DP, PO, EC, SL, BL, GI) with default priorities per DEAL-01"
    - "`db/seed/stages.ts` exports 25 stage rows: 4 universal (track_id=null) + 10 Title & Escrow + 11 Funding & Lending"
    - "Running `npm run db:seed` inserts all 33 rows idempotently (safe to re-run)"
    - "Every stage is a valid track-scoped pair: either trackCode is null (universal) or matches one of the 8 track codes"
    - "`npm test tests/unit/seed-shape.test.ts` passes (validates counts, codes, sort_order uniqueness per scope)"
  artifacts:
    - path: "db/seed/tracks.ts"
      provides: "Static 8-row track seed data"
      exports: ["TRACK_SEEDS"]
    - path: "db/seed/stages.ts"
      provides: "Static 25-row stage seed data with trackCode pointer (null = universal)"
      exports: ["STAGE_SEEDS"]
    - path: "db/seed/run.ts"
      provides: "Idempotent seeder script — upserts tracks by code, then stages by code"
    - path: "package.json"
      provides: "New `db:seed` script"
  key_links:
    - from: "db/seed/run.ts"
      to: "db/schema/app.ts::tracks + stages"
      via: "Drizzle insert / onConflictDoUpdate"
      pattern: "onConflictDoUpdate"
    - from: "db/seed/stages.ts"
      to: "db/seed/tracks.ts"
      via: "trackCode string lookup (not FK — seeder resolves FK at insert time)"
---

<objective>
Seed the 8-track lookup table per DEAL-01 and the 25-stage hybrid list per STAGE-01 (4 universal + 10 Title & Escrow + 11 Funding & Lending). Implement D-01 (tracks + stages as lookup tables, not pgEnum). Provide an idempotent seeder script callable via `npm run db:seed` that uses Drizzle's `onConflictDoUpdate` to upsert by `code` (so re-running after a data tweak updates in place).

DP, PO, EC, SL, BL, GI ship with universal stages only in P1 per STAGE-01; track-specific stage lists for those 6 tracks are added in P10 calibration.

Purpose: Without seeded data, Plan 05 (New Deal form) has no track/stage options to render. This plan makes the data foundation usable.
Output: 33 seed rows in Postgres via `npm run db:seed`, static exports for form consumption, unit tests confirming counts and constraint pairings.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@.planning/phases/01-core-data-model/01-01-SUMMARY.md
@.planning/REQUIREMENTS.md
@db/schema/app.ts
@package.json

<interfaces>
DEAL-01 (REQUIREMENTS.md, verbatim — 8 tracks with default priorities):
| Code | Label | Default priority |
|------|-------|------------------|
| TE | Title & Escrow | HIGH |
| FL | Funding & Lending | HIGH |
| DP | Deal Planning & Structure | MEDIUM |
| PO | Partnership Opportunity | MEDIUM |
| EC | Education & Consulting | MEDIUM |
| SL | Seller Listing | MEDIUM |
| BL | Buyer Listing | MEDIUM |
| GI | General Inquiry | MEDIUM |

STAGE-01 (REQUIREMENTS.md, verbatim):
- Universal (4, track_id=NULL): `pre_screen_qualification`, `deal_structuring`, `file_completed` (terminal), `killed` (terminal)
- Title & Escrow (TE) — 10 stages in sequence: `title_order_opened`, `title_not_clear_to_close`, `title_clear_to_close`, `cd_ss_not_balanced`, `cd_ss_balanced`, `closing_scheduled`, `signing_completed`, `disbursed`, `recorded`, `policy_issued`
- Funding & Lending (FL) — 11 stages in sequence: `deal_team_assigned`, `preparing_lender_review_pkg`, `deal_pkg_submitted_to_lender`, `term_sheets_received`, `approval_decision_received`, `term_sheet_loi_received`, `uw_conditions_issued`, `uw_conditions_cleared`, `lender_docs_received`, `funding_conditions_cleared`, `funding_approval_received`
- DP, PO, EC, SL, BL, GI: universal stages only in P1.

Drizzle upsert pattern (drizzle-orm 0.45.2):
```typescript
await db.insert(tracks)
  .values(TRACK_SEEDS)
  .onConflictDoUpdate({
    target: tracks.code,
    set: {
      label: sql`excluded.label`,
      defaultPriority: sql`excluded.default_priority`,
      active: sql`excluded.active`,
      sortOrder: sql`excluded.sort_order`,
    },
  });
```
Verify this signature against `node_modules/drizzle-orm/pg-core/` types before writing code.

Type shapes (from Plan 01 schema):
```typescript
type NewTrack = { code: string; label: string; defaultPriority: "HIGH"|"MEDIUM"|"LOW"; active?: boolean; sortOrder: number };
type NewStage = { code: string; label: string; trackId: string | null; sortOrder: number; isTerminal?: boolean };
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write seed data files (tracks + stages) + seeder script</name>
  <files>db/seed/tracks.ts, db/seed/stages.ts, db/seed/run.ts, package.json</files>
  <read_first>
    - .planning/REQUIREMENTS.md (DEAL-01 table, STAGE-01 sequences — MUST be copied verbatim, not paraphrased)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-01 rationale, D-10 "default stage on creation = pre_screen_qualification")
    - db/schema/app.ts (exact column names and types from Plan 01)
    - drizzle.config.ts (for DB client pattern — seeder will need it)
    - lib/crypto.ts (reference for TS file style, JSDoc, non-skippable invariants)
    - package.json (existing scripts — add `db:seed` to the scripts block)
  </read_first>
  <action>
    Step 1 — Create `db/seed/tracks.ts`:

    ```typescript
    import type { NewTrack } from "@/db/schema";

    /**
     * 8 track lookup rows (DEAL-01).
     * sort_order drives the form selector's display order and aligns with the
     * UI-SPEC track badge color mapping (TE first, GI last).
     */
    export const TRACK_SEEDS: NewTrack[] = [
      { code: "TE", label: "Title & Escrow",            defaultPriority: "HIGH",   sortOrder: 10, active: true },
      { code: "FL", label: "Funding & Lending",         defaultPriority: "HIGH",   sortOrder: 20, active: true },
      { code: "DP", label: "Deal Planning & Structure", defaultPriority: "MEDIUM", sortOrder: 30, active: true },
      { code: "PO", label: "Partnership Opportunity",   defaultPriority: "MEDIUM", sortOrder: 40, active: true },
      { code: "EC", label: "Education & Consulting",    defaultPriority: "MEDIUM", sortOrder: 50, active: true },
      { code: "SL", label: "Seller Listing",            defaultPriority: "MEDIUM", sortOrder: 60, active: true },
      { code: "BL", label: "Buyer Listing",             defaultPriority: "MEDIUM", sortOrder: 70, active: true },
      { code: "GI", label: "General Inquiry",           defaultPriority: "MEDIUM", sortOrder: 80, active: true },
    ];
    ```

    Step 2 — Create `db/seed/stages.ts`. Use `trackCode` (string) not `trackId` because the seeder resolves the FK at insert time:

    ```typescript
    /** Seed row — trackCode null = universal (track_id NULL in DB). */
    export type StageSeed = {
      code: string;
      label: string;
      trackCode: "TE" | "FL" | null;  // P1 only seeds TE + FL track-specific stages
      sortOrder: number;
      isTerminal?: boolean;
    };

    /**
     * 25 stage rows (STAGE-01):
     *   4 universal + 10 TE + 11 FL.
     *
     * DP, PO, EC, SL, BL, GI tracks rely on universal stages only in P1;
     * their track-specific stage lists are calibrated in P10.
     *
     * sort_order namespace: universal 1–99, TE 100–199, FL 200–299 (leaves room
     * for P10 inserts without renumbering).
     */
    export const STAGE_SEEDS: StageSeed[] = [
      // Universal (4) — sort_order 10..40
      { code: "pre_screen_qualification", label: "Pre-Screen / Qualification", trackCode: null, sortOrder: 10 },
      { code: "deal_structuring",         label: "Deal Structuring",           trackCode: null, sortOrder: 20 },
      { code: "file_completed",           label: "File Completed",             trackCode: null, sortOrder: 30, isTerminal: true },
      { code: "killed",                   label: "Killed",                     trackCode: null, sortOrder: 40, isTerminal: true },

      // Title & Escrow (10) — sort_order 100..190
      { code: "title_order_opened",        label: "Title Order Opened",          trackCode: "TE", sortOrder: 100 },
      { code: "title_not_clear_to_close",  label: "Title — Not Clear to Close",  trackCode: "TE", sortOrder: 110 },
      { code: "title_clear_to_close",      label: "Title — Clear to Close",      trackCode: "TE", sortOrder: 120 },
      { code: "cd_ss_not_balanced",        label: "CD / SS — Not Balanced",      trackCode: "TE", sortOrder: 130 },
      { code: "cd_ss_balanced",            label: "CD / SS — Balanced",          trackCode: "TE", sortOrder: 140 },
      { code: "closing_scheduled",         label: "Closing Scheduled",           trackCode: "TE", sortOrder: 150 },
      { code: "signing_completed",         label: "Signing Completed",           trackCode: "TE", sortOrder: 160 },
      { code: "disbursed",                 label: "Disbursed",                   trackCode: "TE", sortOrder: 170 },
      { code: "recorded",                  label: "Recorded",                    trackCode: "TE", sortOrder: 180 },
      { code: "policy_issued",             label: "Policy Issued",               trackCode: "TE", sortOrder: 190 },

      // Funding & Lending (11) — sort_order 200..300
      { code: "deal_team_assigned",           label: "Deal Team Assigned",             trackCode: "FL", sortOrder: 200 },
      { code: "preparing_lender_review_pkg",  label: "Preparing Lender Review Pkg",    trackCode: "FL", sortOrder: 210 },
      { code: "deal_pkg_submitted_to_lender", label: "Deal Pkg Submitted to Lender",   trackCode: "FL", sortOrder: 220 },
      { code: "term_sheets_received",         label: "Term Sheets Received",           trackCode: "FL", sortOrder: 230 },
      { code: "approval_decision_received",   label: "Approval Decision Received",     trackCode: "FL", sortOrder: 240 },
      { code: "term_sheet_loi_received",      label: "Term Sheet / LOI Received",      trackCode: "FL", sortOrder: 250 },
      { code: "uw_conditions_issued",         label: "UW Conditions Issued",           trackCode: "FL", sortOrder: 260 },
      { code: "uw_conditions_cleared",        label: "UW Conditions Cleared",          trackCode: "FL", sortOrder: 270 },
      { code: "lender_docs_received",         label: "Lender Docs Received",           trackCode: "FL", sortOrder: 280 },
      { code: "funding_conditions_cleared",   label: "Funding Conditions Cleared",     trackCode: "FL", sortOrder: 290 },
      { code: "funding_approval_received",    label: "Funding Approval Received",      trackCode: "FL", sortOrder: 300 },
    ];
    ```

    Double-check the spelling and order against STAGE-01 in REQUIREMENTS.md. The stage `code` values MUST match verbatim so that later calibration and stage-advancement code can reference them by stable slug.

    Step 3 — Create `db/seed/run.ts` — an idempotent seeder that:
    1. Loads `.env.local` / `.env` (dotenv) — follows the same pattern as `drizzle.config.ts`
    2. Creates a Drizzle client connected to `DATABASE_URL`
    3. Upserts all 8 tracks via `onConflictDoUpdate({ target: tracks.code, set: {...} })`
    4. Reads back track codes → id mapping: `SELECT id, code FROM tracks`
    5. Resolves each stage's `trackId` by looking up `trackCode` in the map
    6. Upserts all 25 stages via `onConflictDoUpdate({ target: stages.code, set: {...} })`
    7. Logs counts: "Seeded 8 tracks, 25 stages"
    8. Closes the DB connection

    Pattern skeleton:
    ```typescript
    import { config } from "dotenv";
    config({ path: ".env.local" });
    config({ path: ".env" });

    import { drizzle } from "drizzle-orm/node-postgres";
    import { Pool } from "pg";
    import { tracks, stages } from "@/db/schema";
    import { sql } from "drizzle-orm";
    import { TRACK_SEEDS } from "./tracks";
    import { STAGE_SEEDS } from "./stages";

    async function main() {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle(pool);

      // 1. Upsert tracks
      await db.insert(tracks).values(TRACK_SEEDS).onConflictDoUpdate({
        target: tracks.code,
        set: {
          label: sql`excluded.label`,
          defaultPriority: sql`excluded.default_priority`,
          sortOrder: sql`excluded.sort_order`,
          active: sql`excluded.active`,
        },
      });

      // 2. Resolve codes → ids
      const trackRows = await db.select({ id: tracks.id, code: tracks.code }).from(tracks);
      const trackIdByCode = new Map(trackRows.map(r => [r.code, r.id]));

      // 3. Build stage NewStage[] with real track_id
      const stageInserts = STAGE_SEEDS.map(s => ({
        code: s.code,
        label: s.label,
        trackId: s.trackCode ? trackIdByCode.get(s.trackCode) ?? null : null,
        sortOrder: s.sortOrder,
        isTerminal: s.isTerminal ?? false,
      }));

      // 4. Upsert stages
      await db.insert(stages).values(stageInserts).onConflictDoUpdate({
        target: stages.code,
        set: {
          label: sql`excluded.label`,
          trackId: sql`excluded.track_id`,
          sortOrder: sql`excluded.sort_order`,
          isTerminal: sql`excluded.is_terminal`,
        },
      });

      console.log(`Seeded ${TRACK_SEEDS.length} tracks, ${STAGE_SEEDS.length} stages.`);
      await pool.end();
    }

    main().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    ```

    Verify the `drizzle-orm/node-postgres` import path by inspecting `package.json` dependencies (drizzle-orm 0.45.2) and `node_modules/drizzle-orm/` exports — DO NOT assume a default driver. If `pg` client + Drizzle integration uses a different path in 0.45.2, adjust accordingly.

    Step 4 — Add `db:seed` to `package.json` scripts. Use `tsx` if available or `ts-node` — inspect devDependencies first. If neither is present, add `tsx` as a devDependency (`npm install -D tsx`) and use:
    ```json
    "db:seed": "tsx db/seed/run.ts"
    ```

    Step 5 — Run `npm run db:seed`. It should exit 0 and print "Seeded 8 tracks, 25 stages."

    Step 6 — Verify via direct SQL:
    ```sql
    SELECT COUNT(*) FROM tracks;   -- 8
    SELECT COUNT(*) FROM stages;   -- 25
    SELECT COUNT(*) FROM stages WHERE track_id IS NULL;  -- 4 (universal)
    SELECT COUNT(*) FROM stages s JOIN tracks t ON s.track_id = t.id WHERE t.code = 'TE';  -- 10
    SELECT COUNT(*) FROM stages s JOIN tracks t ON s.track_id = t.id WHERE t.code = 'FL';  -- 11
    ```

    Step 7 — Run `npm run db:seed` a second time. It MUST exit 0 again with the same counts (idempotent upsert — `onConflictDoUpdate` rewrites existing rows).
  </action>
  <verify>
    <automated>npm run db:seed</automated>
  </verify>
  <done>
    - `db/seed/tracks.ts`, `db/seed/stages.ts`, `db/seed/run.ts` all exist
    - `package.json` has a `db:seed` script (tsx or equivalent)
    - Running `npm run db:seed` exits 0 and prints the seeded counts
    - Postgres has 8 tracks and 25 stages (4 universal + 10 TE + 11 FL)
    - Re-running `npm run db:seed` exits 0 idempotently (no duplicates, no errors)
  </done>
  <acceptance_criteria>
    - `ls db/seed/tracks.ts db/seed/stages.ts db/seed/run.ts` shows all three
    - `grep -c "^    { code:" db/seed/tracks.ts` returns 8
    - `grep -c "^      { code:" db/seed/stages.ts` returns 25 (or equivalent — count the StageSeed entries)
    - `grep -E "TE|FL|DP|PO|EC|SL|BL|GI" db/seed/tracks.ts` returns 8+ matches
    - `grep "pre_screen_qualification" db/seed/stages.ts` returns a match
    - `grep "funding_approval_received" db/seed/stages.ts` returns a match (last FL stage)
    - `grep "policy_issued" db/seed/stages.ts` returns a match (last TE stage)
    - `grep "isTerminal: true" db/seed/stages.ts` returns 2 matches (file_completed + killed)
    - `grep "onConflictDoUpdate" db/seed/run.ts` returns 2+ matches (tracks + stages)
    - `grep "\"db:seed\":" package.json` returns a match
    - `npm run db:seed` exits 0 on first run and on second run
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests for seed data shape</name>
  <files>tests/unit/seed-shape.test.ts</files>
  <read_first>
    - db/seed/tracks.ts (from Task 1)
    - db/seed/stages.ts (from Task 1)
    - .planning/REQUIREMENTS.md (DEAL-01 + STAGE-01 — the assertions encode these specs)
    - tests/unit/env.test.ts (pattern for pure in-process tests — no DB connection needed here)
  </read_first>
  <behavior>
    - Test 1: TRACK_SEEDS has exactly 8 entries
    - Test 2: Track codes equal the set {TE, FL, DP, PO, EC, SL, BL, GI} (no extras, no missing)
    - Test 3: TE and FL have defaultPriority="HIGH"; others have "MEDIUM"
    - Test 4: Track sortOrder values are all unique
    - Test 5: STAGE_SEEDS has exactly 25 entries
    - Test 6: Exactly 4 stages have trackCode === null (universal)
    - Test 7: Exactly 10 stages have trackCode === "TE"
    - Test 8: Exactly 11 stages have trackCode === "FL"
    - Test 9: Stage `code` values are all unique (no duplicates)
    - Test 10: file_completed and killed have isTerminal=true; no other stage does
    - Test 11: Within each track-scope (null, TE, FL), sortOrder values are unique (no collisions — stable ordering)
  </behavior>
  <action>
    Create `tests/unit/seed-shape.test.ts` as a pure vitest file — no DB connection. Imports static seed arrays and asserts their shape.

    ```typescript
    import { describe, it, expect } from "vitest";
    import { TRACK_SEEDS } from "@/db/seed/tracks";
    import { STAGE_SEEDS } from "@/db/seed/stages";

    describe("TRACK_SEEDS", () => {
      it("has 8 entries", () => {
        expect(TRACK_SEEDS).toHaveLength(8);
      });
      it("has all required codes", () => {
        const codes = TRACK_SEEDS.map(t => t.code).sort();
        expect(codes).toEqual(["BL", "DP", "EC", "FL", "GI", "PO", "SL", "TE"]);
      });
      it("TE and FL are HIGH priority; rest are MEDIUM", () => {
        const byCode = Object.fromEntries(TRACK_SEEDS.map(t => [t.code, t]));
        expect(byCode.TE.defaultPriority).toBe("HIGH");
        expect(byCode.FL.defaultPriority).toBe("HIGH");
        for (const c of ["DP","PO","EC","SL","BL","GI"]) {
          expect(byCode[c].defaultPriority).toBe("MEDIUM");
        }
      });
      it("sortOrder values are unique", () => {
        const sorts = TRACK_SEEDS.map(t => t.sortOrder);
        expect(new Set(sorts).size).toBe(sorts.length);
      });
    });

    describe("STAGE_SEEDS", () => {
      it("has 25 entries", () => {
        expect(STAGE_SEEDS).toHaveLength(25);
      });
      it("has 4 universal stages (trackCode null)", () => {
        expect(STAGE_SEEDS.filter(s => s.trackCode === null)).toHaveLength(4);
      });
      it("has 10 TE stages", () => {
        expect(STAGE_SEEDS.filter(s => s.trackCode === "TE")).toHaveLength(10);
      });
      it("has 11 FL stages", () => {
        expect(STAGE_SEEDS.filter(s => s.trackCode === "FL")).toHaveLength(11);
      });
      it("all stage codes are unique", () => {
        const codes = STAGE_SEEDS.map(s => s.code);
        expect(new Set(codes).size).toBe(codes.length);
      });
      it("only file_completed and killed are terminal", () => {
        const terminal = STAGE_SEEDS.filter(s => s.isTerminal === true).map(s => s.code).sort();
        expect(terminal).toEqual(["file_completed", "killed"]);
      });
      it("sortOrder unique within each track-scope", () => {
        for (const scope of [null, "TE", "FL"] as const) {
          const sorts = STAGE_SEEDS.filter(s => s.trackCode === scope).map(s => s.sortOrder);
          expect(new Set(sorts).size).toBe(sorts.length);
        }
      });
    });
    ```

    Run `npm test tests/unit/seed-shape.test.ts` and confirm all 10 assertions pass. Fix any discrepancy by correcting the seed data (never by loosening the test — the test encodes the spec).
  </action>
  <verify>
    <automated>npm test tests/unit/seed-shape.test.ts</automated>
  </verify>
  <done>
    - tests/unit/seed-shape.test.ts exists with the 10+ assertions above
    - `npm test tests/unit/seed-shape.test.ts` exits 0 with all tests passing
  </done>
  <acceptance_criteria>
    - `ls tests/unit/seed-shape.test.ts` returns the file
    - `grep -E "toHaveLength\\(8\\)|toHaveLength\\(25\\)|toHaveLength\\(4\\)|toHaveLength\\(10\\)|toHaveLength\\(11\\)" tests/unit/seed-shape.test.ts` returns 5+ matches
    - `grep "file_completed" tests/unit/seed-shape.test.ts` returns at least one match (terminal-stage assertion)
    - `grep "MEDIUM" tests/unit/seed-shape.test.ts` returns at least one match (priority-assertion)
    - `npm test tests/unit/seed-shape.test.ts` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `npm run db:seed` exits 0 on fresh DB, prints "Seeded 8 tracks, 25 stages." and is idempotent
2. `npm test tests/unit/seed-shape.test.ts` exits 0
3. Direct SQL confirms 8 tracks + 25 stages + 4 universal + 10 TE + 11 FL
4. No other test regressions (schema-shape, env, crypto, access, file-no tests all still pass)
</verification>

<success_criteria>
- DEAL-01 fully implemented: 8 tracks seeded with correct default priorities
- STAGE-01 fully implemented for P1: 4 universal + 10 TE + 11 FL (DP/PO/EC/SL/BL/GI left for P10)
- Idempotent seeder — safe to re-run after track/stage tweaks
- D-01 rationale honored: data lives in rows, not pgEnum types, so P10 calibration is `INSERT`, not `ALTER TYPE`
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-04-SUMMARY.md` documenting:
- Table of the 8 track codes/labels/priorities as shipped
- Full stage list grouped by scope (universal / TE / FL) with sort_order ranges
- The upsert strategy (onConflictDoUpdate) and why idempotency matters
- Any driver / dependency surprises (tsx install, drizzle-orm driver path)
</output>
