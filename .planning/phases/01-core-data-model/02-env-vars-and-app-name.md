---
phase: 01-core-data-model
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/env.ts
  - components/app-header.tsx
  - .env.example
  - .env.local
  - tests/unit/env.test.ts
autonomous: true
requirements: [OPS-01]
requirements_addressed: [OPS-01]

must_haves:
  truths:
    - "`lib/env.ts` Zod schema validates NEXT_PUBLIC_APP_NAME and NEXT_PUBLIC_APP_DOMAIN"
    - "`components/app-header.tsx` reads brand name from env, not a hardcoded string"
    - "`.env.example` documents the two new variables with placeholder values"
    - "`npm test tests/unit/env.test.ts` passes (new assertions for the two variables)"
  artifacts:
    - path: "lib/env.ts"
      provides: "Extended Zod schema with NEXT_PUBLIC_APP_NAME + NEXT_PUBLIC_APP_DOMAIN + optional NEXT_PUBLIC_APP_BRAND_COLOR"
      contains: "NEXT_PUBLIC_APP_NAME"
    - path: "components/app-header.tsx"
      provides: "Reads env.NEXT_PUBLIC_APP_NAME for brand text"
    - path: ".env.example"
      provides: "Documented placeholders for the two new vars"
  key_links:
    - from: "components/app-header.tsx"
      to: "lib/env.ts::env.NEXT_PUBLIC_APP_NAME"
      via: "import + read"
      pattern: "env\\.NEXT_PUBLIC_APP_NAME"
---

<objective>
Promote the hardcoded "NPR Dashboard" brand string and the `portal.utstitle.com` domain into Zod-validated `NEXT_PUBLIC_*` environment variables per D-06. Update the app header to read the brand name from the env module instead of using a string literal. Document both variables in `.env.example` and extend the env unit tests.

Purpose: Implements D-06 (template-extraction-friendly string promotion) and extends OPS-01 env-hygiene posture — new publicly-exposed branding is still validated at boot.
Output: Two new required `NEXT_PUBLIC_*` env vars + one optional, validated by Zod; header uses them.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-core-data-model/01-CONTEXT.md
@lib/env.ts
@components/app-header.tsx
@tests/unit/env.test.ts
@AGENTS.md

<interfaces>
Existing `env` export (from lib/env.ts):
```typescript
export const env: {
  DATABASE_URL: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  ENCRYPTION_KEY?: string;
  GMAIL_OAUTH_CLIENT_ID?: string;
  GMAIL_OAUTH_CLIENT_SECRET?: string;
  NODE_ENV: "development" | "test" | "production";
};
```

After this plan, the type MUST additionally include:
```typescript
NEXT_PUBLIC_APP_NAME: string;           // required, min 1
NEXT_PUBLIC_APP_DOMAIN: string;         // required, min 1 — no scheme, e.g. "portal.utstitle.com"
NEXT_PUBLIC_APP_BRAND_COLOR?: string;   // optional, hex or empty
```

Current app-header.tsx literal: line 48 has `NPR Dashboard` as text content, and line 49 has `prototype` as muted text. D-06 directs replacing the brand literal with `env.NEXT_PUBLIC_APP_NAME`; drop the `prototype` sub-label (D-10 region — "Rename 'prototype' label to read from env (or drop — see D-10)").
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend env.ts Zod schema and unit tests</name>
  <files>lib/env.ts, tests/unit/env.test.ts, .env.example, .env.local</files>
  <read_first>
    - lib/env.ts (current Zod schema — extend, do not rewrite)
    - tests/unit/env.test.ts (existing test pattern to follow)
    - .env.example (confirm what's already documented to avoid duplication)
    - .env.local (confirm real values present for local dev — NEVER commit)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-06 — exact var names and default guidance)
  </read_first>
  <behavior>
    - Test 1: Parsing env with all required vars present (including NEXT_PUBLIC_APP_NAME="NPR Dashboard" and NEXT_PUBLIC_APP_DOMAIN="portal.utstitle.com") succeeds
    - Test 2: Parsing env missing NEXT_PUBLIC_APP_NAME throws a validation error whose message includes "NEXT_PUBLIC_APP_NAME"
    - Test 3: Parsing env missing NEXT_PUBLIC_APP_DOMAIN throws a validation error whose message includes "NEXT_PUBLIC_APP_DOMAIN"
    - Test 4: NEXT_PUBLIC_APP_BRAND_COLOR is optional (parsing succeeds when absent)
    - Test 5: NEXT_PUBLIC_APP_DOMAIN is rejected when it includes a scheme (e.g., "https://portal.utstitle.com") — enforce bare-domain via regex
  </behavior>
  <action>
    Step 1 — In `lib/env.ts`, add three fields to the Zod schema object, inserting them after the CF_ACCESS_AUD line and before ENCRYPTION_KEY (grouped as "Public branding — D-06"):

    ```typescript
    // Public branding (D-06 — exposed to the browser as NEXT_PUBLIC_*)
    NEXT_PUBLIC_APP_NAME: z.string().min(1),
    NEXT_PUBLIC_APP_DOMAIN: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9.-]+$/, "must be a bare domain (no scheme, no path)"),
    NEXT_PUBLIC_APP_BRAND_COLOR: z.string().optional(),
    ```

    Do NOT change any existing field. Preserve the existing transition-note comment.

    Step 2 — Update `.env.example` to add (after the CF_ACCESS_* block, before any Gmail block):
    ```
    # Public branding (D-06) — used in header, logout redirect, CORS origin
    NEXT_PUBLIC_APP_NAME=NPR Dashboard
    NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com
    # Optional: hex color for primary brand tint; if blank, neutral theme applies
    NEXT_PUBLIC_APP_BRAND_COLOR=
    ```

    Step 3 — Update `.env.local` with the same real values (DO NOT COMMIT `.env.local` — it is gitignored). Verify with `grep NEXT_PUBLIC_APP_NAME .env.local`.

    Step 4 — Extend `tests/unit/env.test.ts` with 5 new assertions matching the behaviors above. Use vitest's isolated-environment pattern (the existing test file already does this — follow its pattern exactly, do not invent a new one). Example skeleton:
    ```typescript
    it("accepts NEXT_PUBLIC_APP_NAME and NEXT_PUBLIC_APP_DOMAIN", async () => {
      // Set process.env values then dynamic import lib/env
    });
    it("rejects missing NEXT_PUBLIC_APP_NAME", async () => { ... });
    it("rejects NEXT_PUBLIC_APP_DOMAIN with scheme", async () => { ... });
    ```

    If the existing test file uses `vi.resetModules()` + manual `process.env` mutation, use that same pattern verbatim.
  </action>
  <verify>
    <automated>npm test tests/unit/env.test.ts</automated>
  </verify>
  <done>
    - lib/env.ts Zod schema has NEXT_PUBLIC_APP_NAME (required), NEXT_PUBLIC_APP_DOMAIN (required, bare-domain regex), NEXT_PUBLIC_APP_BRAND_COLOR (optional)
    - .env.example documents all three with a clear comment
    - .env.local has real values for local dev
    - tests/unit/env.test.ts has 5+ new assertions, all passing
    - `npm run build` exits 0 (no TypeScript regressions from the new env fields)
  </done>
  <acceptance_criteria>
    - `grep -E "NEXT_PUBLIC_APP_NAME|NEXT_PUBLIC_APP_DOMAIN|NEXT_PUBLIC_APP_BRAND_COLOR" lib/env.ts` returns 3+ matches
    - `grep "NEXT_PUBLIC_APP_NAME=NPR Dashboard" .env.example` returns a match
    - `grep "NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com" .env.example` returns a match
    - `grep "NEXT_PUBLIC_APP_NAME" tests/unit/env.test.ts` returns at least 3 matches (test names + assertions)
    - `grep "must be a bare domain" tests/unit/env.test.ts` returns at least 1 match (testing the regex error path)
    - `npm test tests/unit/env.test.ts` exits 0 with 5+ new passing tests
    - `grep "^NEXT_PUBLIC_APP_NAME=" .env.local` returns a match (real value set for dev)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Read brand name from env in AppHeader</name>
  <files>components/app-header.tsx</files>
  <read_first>
    - components/app-header.tsx (current state — line 48 has literal "NPR Dashboard", line 49 has "prototype" sub-label)
    - lib/env.ts (confirm NEXT_PUBLIC_APP_NAME is now in the schema from Task 1)
    - .planning/phases/01-core-data-model/01-CONTEXT.md (D-06 — drop the "prototype" label per the D-10 bullet)
    - .planning/phases/01-core-data-model/01-UI-SPEC.md (confirm header styling — no visual regressions)
  </read_first>
  <action>
    Step 1 — In `components/app-header.tsx`, replace line 48's literal text `NPR Dashboard` with `{env.NEXT_PUBLIC_APP_NAME}`. The `env` import is already present at line 3. JSX will look like:
    ```tsx
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80">
      <div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
      {env.NEXT_PUBLIC_APP_NAME}
    </Link>
    ```

    Step 2 — DELETE the `<span>` with the `prototype` label (current lines 48's trailing `<span>` block). Per D-06/D-10 it is being dropped entirely (the portal is no longer a prototype — it's live at portal.utstitle.com).

    Step 3 — Leave the rest of the component unchanged (Avatar, DropdownMenu, logout URL — all fine).

    No test file change required — app-header has no existing unit test (it's a Server Component with async deps). Smoke-test is covered by the existing Playwright e2e.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
    - app-header.tsx renders `{env.NEXT_PUBLIC_APP_NAME}` instead of literal "NPR Dashboard"
    - The "prototype" sub-label is removed from the header
    - `npm run build` exits 0 (no new TS errors)
    - Existing Playwright smoke test (tests/e2e/smoke.spec.ts) still passes with the new env var set
  </done>
  <acceptance_criteria>
    - `grep "env.NEXT_PUBLIC_APP_NAME" components/app-header.tsx` returns a match
    - `grep -c "NPR Dashboard" components/app-header.tsx` returns 0 (no hardcoded brand text remains)
    - `grep -c "prototype" components/app-header.tsx` returns 0 (sub-label removed)
    - `npm run build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `npm test tests/unit/env.test.ts` exits 0
2. `npm run build` exits 0
3. Local dev (`npm run dev`) shows the brand name from NEXT_PUBLIC_APP_NAME in the header (manual) — not blocking but useful to sanity-check after Plan 01 lands.
</verification>

<success_criteria>
- D-06 fully implemented: NEXT_PUBLIC_APP_NAME + NEXT_PUBLIC_APP_DOMAIN validated by Zod; NEXT_PUBLIC_APP_BRAND_COLOR optional
- Header reads brand name from env — no more hardcoded string
- `.env.example` and `.env.local` both list the new vars; example has placeholders, local has real values
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-data-model/01-02-SUMMARY.md` documenting:
- The new env fields (names, validation rules, default strategy)
- Before/after diff snippets for lib/env.ts and app-header.tsx
- Confirmation that D-06 is fully implemented
- Any test patterns learned from the existing env.test.ts layout
</output>
