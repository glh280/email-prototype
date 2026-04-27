---
phase: 03-people-map-contacts-registry
plan: 02
type: execute
wave: 2
depends_on:
  - 03-people-map-contacts-registry/01
files_modified:
  - lib/contact-schema.ts
  - lib/role-slots.ts
  - tests/unit/contact-schema.test.ts
  - tests/unit/role-slots.test.ts
autonomous: true
requirements:
  - PEOPLE-02
  - PEOPLE-05

must_haves:
  truths:
    - "Application code has a single canonical module that enumerates the 12 role slots and which tracks each slot applies to"
    - "Unknown role-slot string is rejected by a pure function returning a structured validation result (for server actions to surface as field errors)"
    - "createContactSchema + updateContactSchema + upsertDealPersonSchema + removeDealPersonSchema all parse with .strict() so unknown keys are rejected (same pattern as P2 updateDealSchema)"
    - "upsertDealPersonSchema accepts { dealId, role, contactId (nullable for lender_partner free-text), freeTextValue (for lender_partner only) } and rejects unknown roles"
  artifacts:
    - path: lib/role-slots.ts
      provides: "Canonical role-slot registry with per-track applicability matrix + isRoleValidForTrack()"
      contains: "ROLE_SLOTS"
    - path: lib/contact-schema.ts
      provides: "Zod schemas for contact CRUD + deal_people upsert/remove"
      contains: "createContactSchema"
    - path: tests/unit/contact-schema.test.ts
      provides: "Behavioral tests for all 4 schemas + .strict() unknown-key rejection"
      contains: "describe(\"createContactSchema\""
    - path: tests/unit/role-slots.test.ts
      provides: "Tests proving 12 slots × 8 tracks matrix + isRoleValidForTrack() coverage"
      contains: "isRoleValidForTrack"
  key_links:
    - from: lib/role-slots.ts
      to: db/seed/tracks.ts
      via: "role-slot track codes match the 8 seeded tracks (TE, FL, DP, PO, EC, SL, BL, GI)"
      pattern: "TE|FL|DP|PO|EC|SL|BL|GI"
    - from: lib/contact-schema.ts
      to: lib/role-slots.ts
      via: "upsertDealPersonSchema role field validated against ROLE_SLOTS"
      pattern: "import.*role-slots"
---

<objective>
Write the canonical role-slot registry (`lib/role-slots.ts`) and Zod contracts (`lib/contact-schema.ts`) that every P3 server action and UI form consumes. This plan is pure unit-testable logic — no DB, no I/O.

**Purpose:** Satisfy PEOPLE-02 (role slot taxonomy) and PEOPLE-05 (application-code role enforcement) in a single place so server actions (Plan 04) and UI (Plan 05/06) stay in sync. Putting the slot taxonomy in a module instead of hardcoding it in actions means P10 calibration edits happen in one file.

**Output:**
- `lib/role-slots.ts` — exports `ROLE_SLOTS` (12 entries with per-track applicability), `RoleSlotCode` type union, `isRoleValidForTrack(role, trackCode)`, `SLOTS_FOR_TRACK(trackCode)` helpers
- `lib/contact-schema.ts` — exports `createContactSchema`, `updateContactSchema`, `upsertDealPersonSchema`, `removeDealPersonSchema`
- Full co-located test coverage in `tests/unit/`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/REQUIREMENTS.md
@lib/deal-schema.ts
@lib/task-schema.ts
@lib/stage-schema.ts
@lib/note-schema.ts
@db/seed/tracks.ts
@.planning/phases/02-deal-detail-tasks-stages/02-shared-zod-schemas-SUMMARY.md

<interfaces>
From db/seed/tracks.ts — 8 track codes:
```typescript
// TE (Title & Escrow)       — HIGH
// FL (Funding & Lending)     — HIGH
// DP (Deal Planning)         — MEDIUM
// PO (Partnership Opp)       — MEDIUM
// EC (Education & Consulting) — MEDIUM
// SL (Seller Listing)        — MEDIUM
// BL (Buyer Listing)         — MEDIUM
// GI (General Inquiry)       — MEDIUM
```

From lib/deal-schema.ts (canonical .strict() + split-parse pattern to MATCH):
```typescript
export const updateDealSchema = z
  .object({ ... })
  .strict();
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author lib/role-slots.ts registry + tests (RED → GREEN). Canonical per-track role-slot matrix.</name>
  <files>
    lib/role-slots.ts
    tests/unit/role-slots.test.ts
  </files>
  <read_first>
    - .planning/REQUIREMENTS.md §PEOPLE-02 (exact slot list + notes — especially "may be bound to main_contact via VIEW-05", "autosuggest from partner contacts", "free-text lender_partner distinct from mortgage_partner")
    - db/seed/tracks.ts (8 track codes — exact strings)
    - .planning/ROADMAP.md Phase 3 requirements listing (duplicate slot list)
  </read_first>
  <behavior>
    - `ROLE_SLOTS` is a readonly array of 12 entries. Each entry: `{ code, label, appliesToTracks, source, notes }`
    - `source` ∈ `"contact_fk" | "free_text"` — `lender_partner` is `free_text`; the other 11 are `contact_fk`
    - `appliesToTracks` is either the literal `"ALL"` or a non-empty subset of `["TE","FL","DP","PO","EC","SL","BL","GI"]`
    - `isRoleValidForTrack(role, trackCode)` returns `true` iff role exists in ROLE_SLOTS AND (appliesToTracks === "ALL" OR trackCode ∈ appliesToTracks)
    - `isRoleValidForTrack("banana","TE")` → false (unknown role)
    - `isRoleValidForTrack("main_contact","TE")` → true (universal slot)
    - `isRoleValidForTrack("title_partner","FL")` → **should operator-confirm**; draft defaults to `false` because title_partner is Title-and-Escrow-specific per PEOPLE-02 note "autosuggest from partner contacts" context. If operator pushes back, widen. (This is an intentional conservative default documented in the test and the module docstring.)
    - `slotsForTrack("TE")` returns every ROLE_SLOTS entry where that track is applicable
    - `ROLE_SLOT_CODES` is a `readonly string[]` suitable for Zod's `z.enum([...])` consumption
  </behavior>
  <action>
    1. Write `tests/unit/role-slots.test.ts` FIRST (RED). Cover:
       - `ROLE_SLOTS.length === 12`
       - `ROLE_SLOTS.map(s =&gt; s.code).sort()` deep-equals sorted `['borrower','consultant_partner','directing_agent','internal_owner','lender_partner','listing_agent','main_contact','mortgage_partner','seller','tc_partner','title_partner','tl_partner']`
       - Exactly ONE slot has `source: "free_text"` and it's `lender_partner`
       - `isRoleValidForTrack("main_contact", "GI") === true` (universal)
       - `isRoleValidForTrack("internal_owner", "EC") === true` (universal — every deal has an owner)
       - `isRoleValidForTrack("title_partner", "TE") === true`
       - `isRoleValidForTrack("title_partner", "FL") === false` (TE-specific)
       - `isRoleValidForTrack("mortgage_partner", "FL") === true`
       - `isRoleValidForTrack("mortgage_partner", "TE") === true` (both TE and FL deals commonly have mortgage partners)
       - `isRoleValidForTrack("lender_partner", "FL") === true`
       - `isRoleValidForTrack("listing_agent", "TE") === true`
       - `isRoleValidForTrack("listing_agent", "SL") === true`
       - `isRoleValidForTrack("directing_agent", "EC") === true` (every deal can have a directing agent)
       - `isRoleValidForTrack("banana", "TE") === false` (unknown role)
       - `isRoleValidForTrack("main_contact", "ZZ") === false` (unknown track)
       - `slotsForTrack("TE").length &gt;= 8` and includes `title_partner`
       - `slotsForTrack("GI").length &gt;= 3` and includes `main_contact`, `internal_owner`, `directing_agent`
    2. Run `npm test -- role-slots`. Expect RED.

    3. Write `lib/role-slots.ts`:

       ```typescript
       /**
        * Canonical per-track role-slot registry for PEOPLE-02 / PEOPLE-05.
        *
        * Single source of truth — edit HERE when P10 calibrates slot applicability.
        * Server actions call isRoleValidForTrack() to reject unknown slots (PEOPLE-05).
        * UI calls slotsForTrack() to render the right set of slot rows per deal.
        *
        * `source` disambiguates how the slot is filled:
        *   - "contact_fk": deal_people.contact_id points to a contacts row (autosuggest)
        *   - "free_text":  lender_partner — actual lender often not in the registry;
        *                   stored via a dedicated contact row whose org field carries
        *                   the lender name, OR (future) via a sidecar free-text column.
        *                   Plan 04 implements free_text as "create a minimal contact
        *                   with full_name=&lt;text&gt;, role_hint='lender', no email" — the
        *                   simplest path that keeps the deal_people shape uniform.
        */
       export const ALL_TRACKS = ["TE","FL","DP","PO","EC","SL","BL","GI"] as const;
       export type TrackCode = typeof ALL_TRACKS[number];

       export type RoleSlotSource = "contact_fk" | "free_text";

       export type RoleSlot = {
         code: string;
         label: string;
         appliesToTracks: "ALL" | readonly TrackCode[];
         source: RoleSlotSource;
         notes?: string;
       };

       export const ROLE_SLOTS: readonly RoleSlot[] = [
         { code: "directing_agent",   label: "Directing Agent",   appliesToTracks: "ALL", source: "contact_fk" },
         { code: "main_contact",      label: "Main Contact",      appliesToTracks: "ALL", source: "contact_fk", notes: "Lead name on file. Formerly 'primary contact'." },
         { code: "internal_owner",    label: "Internal Owner",    appliesToTracks: "ALL", source: "contact_fk", notes: "Us — the team member on the file. Mirrors deals.internal_owner until P10 calibrates." },
         { code: "title_partner",     label: "Title Partner",     appliesToTracks: ["TE"], source: "contact_fk", notes: "Autosuggest from partner contacts." },
         { code: "borrower",          label: "Borrower",          appliesToTracks: ["TE","FL","DP"], source: "contact_fk", notes: "May mirror main_contact per VIEW-05." },
         { code: "seller",            label: "Seller",            appliesToTracks: ["TE","SL"], source: "contact_fk" },
         { code: "mortgage_partner",  label: "Mortgage Partner",  appliesToTracks: ["TE","FL","DP"], source: "contact_fk", notes: "Mortgage brokerage partner. Autosuggest from partner contacts." },
         { code: "lender_partner",    label: "Lender",            appliesToTracks: ["FL","DP"],      source: "free_text", notes: "Actual lender on the deal. Often not in the registry — stored as a minimal contact row with org=&lt;lender name&gt;." },
         { code: "tc_partner",        label: "TC Partner",        appliesToTracks: ["TE"], source: "contact_fk", notes: "Transaction Coordinator. Autosuggest from partner contacts." },
         { code: "tl_partner",        label: "TL Partner",        appliesToTracks: ["TE","FL"], source: "contact_fk", notes: "Title Liaison partner. Autosuggest from partner contacts." },
         { code: "consultant_partner", label: "Consultant Partner", appliesToTracks: ["EC","DP","PO"], source: "contact_fk" },
         { code: "listing_agent",     label: "Listing Agent",     appliesToTracks: ["TE","SL","BL"], source: "contact_fk" },
       ] as const;

       export const ROLE_SLOT_CODES = ROLE_SLOTS.map((s) =&gt; s.code) as readonly string[];
       export type RoleSlotCode = typeof ROLE_SLOTS[number]["code"];

       export function isRoleValidForTrack(role: string, trackCode: string): boolean {
         if (!(ALL_TRACKS as readonly string[]).includes(trackCode)) return false;
         const slot = ROLE_SLOTS.find((s) =&gt; s.code === role);
         if (!slot) return false;
         if (slot.appliesToTracks === "ALL") return true;
         return (slot.appliesToTracks as readonly string[]).includes(trackCode);
       }

       export function slotsForTrack(trackCode: TrackCode): readonly RoleSlot[] {
         return ROLE_SLOTS.filter((s) =&gt;
           s.appliesToTracks === "ALL" || (s.appliesToTracks as readonly string[]).includes(trackCode),
         );
       }
       ```

    4. Re-run `npm test -- role-slots`. Expect GREEN. If any assertion in the "applies to which tracks" matrix fails, surface in plan SUMMARY as an operator-confirm — DO NOT rewrite the test to match a wrong draft. The matrix values above are a best-effort draft; operator (Carrie via Mike) may calibrate in P10 per REQUIREMENTS note "track-specific stage lists for DP/PO/EC/SL/BL/GI are added during calibration week". If operator supplies corrections pre-execute, update the literals above in action step 3 accordingly.
  </action>
  <verify>
    <automated>npm test -- role-slots &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/role-slots.ts` exists and exports `ROLE_SLOTS`, `RoleSlotCode`, `TrackCode`, `ROLE_SLOT_CODES`, `isRoleValidForTrack`, `slotsForTrack`, `ALL_TRACKS`
    - `grep -c "code:" lib/role-slots.ts` returns `>= 12`
    - `grep "lender_partner" lib/role-slots.ts` shows `source: "free_text"`
    - `tests/unit/role-slots.test.ts` passes with at least 16 assertions (length=12, code-set match, per-slot track checks, isRoleValidForTrack(unknown_role)→false, isRoleValidForTrack(unknown_track)→false, slotsForTrack membership checks)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Role-slot taxonomy is encoded as pure data with a tested enforcement function. PEOPLE-02 taxonomy is authoritative in one file; PEOPLE-05 enforcement primitive is tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author lib/contact-schema.ts + tests. Contact CRUD + deal_people upsert/remove Zod contracts with .strict().</name>
  <files>
    lib/contact-schema.ts
    tests/unit/contact-schema.test.ts
  </files>
  <read_first>
    - lib/deal-schema.ts (canonical `.strict()` pattern from P2; email "accept empty string OR valid email" union pattern; z.input/z.infer split; split-parse comment)
    - lib/task-schema.ts (canonical P2 module structure — header docstring + paired tests)
    - lib/role-slots.ts (after Task 1 — consume `ROLE_SLOT_CODES` for role enum)
    - .planning/phases/02-deal-detail-tasks-stages/02-shared-zod-schemas-SUMMARY.md (canonical decisions: .strict over .partial; split-parse for composite inputs; error copy style)
  </read_first>
  <behavior>
    - `createContactSchema` parses `{ fullName, roleHint?, org?, email?, phone?, notes? }` with trim + length bounds identical to lib/deal-schema email pattern (accept empty string OR valid email; nullable+optional). `.strict()` rejects unknown keys
    - `updateContactSchema` is `.strict()` partial-shape (same fields + `.optional()` each) — no id in schema (split-parse pattern); rejects unknown keys
    - `contactIdSchema` = `{ id: z.string().uuid() }` — sibling of P2's dealIdSchema, for split-parse
    - `upsertDealPersonSchema` = `{ dealId: uuid, role: z.enum(ROLE_SLOT_CODES), contactId: uuid.nullable().optional(), freeTextValue: z.string().trim().min(1).max(200).nullable().optional() }`. `.strict()`. Validation-only (not track-aware — track gate is in the server action via isRoleValidForTrack)
    - `removeDealPersonSchema` = `{ dealId: uuid, role: z.enum(ROLE_SLOT_CODES) }`. `.strict()`
    - Tests cover: every schema parses a valid happy-path input; every schema rejects an unknown key via `.strict()`; email rejects garbage; fullName trimmed + min(1); uuid rejects non-uuids
  </behavior>
  <action>
    1. Write `tests/unit/contact-schema.test.ts` FIRST (RED). Write at least 24 assertions — follow the cadence in `tests/unit/deal-schema.test.ts`:
       - 6 createContactSchema: happy, trimmed, email empty string accepted, email garbage rejected, unknown-key rejected by `.strict()`, fullName min(1) rejected when empty string after trim
       - 5 updateContactSchema: happy partial, empty object accepted (no-op diff), unknown-key rejected, email garbage rejected, fullName max(200) rejected when oversized
       - 2 contactIdSchema: valid uuid, rejects "not-a-uuid"
       - 7 upsertDealPersonSchema: happy with contactId, happy with freeTextValue (no contactId), role=unknown rejected, dealId non-uuid rejected, unknown-key rejected, role='lender_partner' + freeTextValue='Wells Fargo' accepted, freeTextValue empty-string trimmed rejected
       - 4 removeDealPersonSchema: happy, unknown role rejected, unknown-key rejected, missing dealId rejected

       Run `npm test -- contact-schema`. Expect RED.

    2. Write `lib/contact-schema.ts`:

       ```typescript
       import { z } from "zod";
       import { ROLE_SLOT_CODES } from "@/lib/role-slots";

       /**
        * Zod contracts for PEOPLE-01..05.
        *
        * Mirrors the P2 pattern (lib/deal-schema.ts):
        *   - `.strict()` on every .object() so unknown keys fail fast
        *   - Email: z.union([z.literal(""), z.string().trim().email(...)]).nullable().optional()
        *   - Split-parse for composite-input server actions: contactIdSchema parsed first,
        *     then updateContactSchema.safeParse(rest) — `.and()` does NOT propagate .strict()
        *
        * PEOPLE-05 enforcement LAYER: role enum comes from lib/role-slots.ts so adding/
        * removing a slot is a one-file edit. Track-compatibility check (isRoleValidForTrack)
        * runs in the server action, not the Zod layer — slots can be valid for a given
        * deal's track only after we read the deal row.
        */

       export const createContactSchema = z.object({
         fullName: z.string({ message: "Full name is required." }).trim().min(1, "Full name is required.").max(200, "Full name must be 200 characters or fewer."),
         roleHint: z.string().trim().max(100).nullable().optional(),
         org: z.string().trim().max(200).nullable().optional(),
         email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right.")]).nullable().optional(),
         phone: z.string().trim().max(50).nullable().optional(),
         notes: z.string().trim().max(2000).nullable().optional(),
       }).strict();

       export type CreateContactInput = z.infer&lt;typeof createContactSchema&gt;;

       export const updateContactSchema = z.object({
         fullName: z.string().trim().min(1, "Full name is required.").max(200).optional(),
         roleHint: z.string().trim().max(100).nullable().optional(),
         org: z.string().trim().max(200).nullable().optional(),
         email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right.")]).nullable().optional(),
         phone: z.string().trim().max(50).nullable().optional(),
         notes: z.string().trim().max(2000).nullable().optional(),
       }).strict();

       export type UpdateContactInput = z.infer&lt;typeof updateContactSchema&gt;;

       export const contactIdSchema = z.object({
         id: z.string().uuid("That contact id isn't valid."),
       }).strict();

       export const upsertDealPersonSchema = z.object({
         dealId: z.string().uuid(),
         role: z.enum(ROLE_SLOT_CODES as [string, ...string[]], { message: "Unknown role slot." }),
         contactId: z.string().uuid().nullable().optional(),
         freeTextValue: z.string().trim().min(1).max(200).nullable().optional(),
       }).strict();

       export type UpsertDealPersonInput = z.infer&lt;typeof upsertDealPersonSchema&gt;;

       export const removeDealPersonSchema = z.object({
         dealId: z.string().uuid(),
         role: z.enum(ROLE_SLOT_CODES as [string, ...string[]], { message: "Unknown role slot." }),
       }).strict();

       export type RemoveDealPersonInput = z.infer&lt;typeof removeDealPersonSchema&gt;;
       ```

    3. Re-run `npm test -- contact-schema`. Expect GREEN. Full `npm test` also GREEN.
  </action>
  <verify>
    <automated>npm test -- contact-schema &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `lib/contact-schema.ts` exists and exports: `createContactSchema`, `updateContactSchema`, `contactIdSchema`, `upsertDealPersonSchema`, `removeDealPersonSchema`, plus type aliases
    - `grep -c "\.strict()" lib/contact-schema.ts` returns `>= 5`
    - `grep "import.*role-slots" lib/contact-schema.ts` returns a match (role enum consumed)
    - `tests/unit/contact-schema.test.ts` has >= 24 assertions, all passing
    - `npx tsc --noEmit` exits 0
    - Full `npm test` green (no regressions on P1/P2 suites)
  </acceptance_criteria>
  <done>All four P3 Zod contracts exist with .strict() unknown-key rejection and the role enum pulls from lib/role-slots.ts. Server actions (Plan 04) can import and re-validate input without re-declaring the shape.</done>
</task>

</tasks>

<verification>
- `npm test` green: baseline + new role-slots assertions + new contact-schema assertions
- `npx tsc --noEmit` clean
- `lib/role-slots.ts` and `lib/contact-schema.ts` both exist and export the documented surface
- No DB connection touched, no server action imports — pure contract layer
</verification>

<success_criteria>
PEOPLE-02 slot taxonomy is encoded once. PEOPLE-05 track-applicability enforcement primitive is tested. Every downstream plan consumes these modules; any slot calibration in P10 is a one-file edit to `lib/role-slots.ts`.
</success_criteria>

<output>
After completion, create `.planning/phases/03-people-map-contacts-registry/03-02-contact-and-role-slot-zod-schemas-SUMMARY.md`.
</output>
