---
phase: 00.5.1-production-deploy-wire-up
plan: 02
type: execute
wave: 2
depends_on: ["00.5.1-01"]
files_modified:
  - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md
autonomous: false
requirements: [DEPLOY-07, DEPLOY-08]
requirements_addressed: [DEPLOY-07, DEPLOY-08]

must_haves:
  truths:
    - "Railway production project has a new `Postgres` service (Railway Hobby tier — confirmed via operator paste-back of tier/plan line from Railway dashboard Settings, NOT just presence of the service)"
    - "`railway variables --service npr-dashboard-prototype --kv` output contains a `DATABASE_URL` entry whose value references the Postgres service via `${{Postgres.DATABASE_URL}}` (NOT a literal connection string)"
    - "Railway UI shows a 'linked' / reference badge on the DATABASE_URL row of the `npr-dashboard-prototype` service (visual confirmation of reference-var wiring, paired with CLI resolution)"
    - "`railway variables --service npr-dashboard-prototype --kv` output contains `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, and `NEXT_PUBLIC_APP_BRAND_COLOR` entries with the exact canonical values pinned at planning time (no runtime forking)"
    - "`NEXT_PUBLIC_APP_DOMAIN` value is a BARE domain (no scheme, no path) — passes the `lib/env.ts` Zod regex `/^[a-zA-Z0-9.-]+$/`"
    - "`NEXT_PUBLIC_APP_BRAND_COLOR` value is `#0F172A` (the canonical default — pinned deterministically at planning time since `.env.local` has the key present but empty, so no local override applies)"
    - "Every checkpoint output is captured verbatim in `00.5.1-VERIFICATION.md` so the operator can copy-paste back confirmations and so future auditors can see what was set without querying Railway"
    - "Phase 0.5 CF Access topology is UNTOUCHED — `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ENCRYPTION_KEY` are not read, not rotated, not re-set by this plan"
    - "No `git push` is triggered by this plan — Railway is configured but the app service may still be on the stale `fa52cc5` build until Plan 03 pushes"
  artifacts:
    - path: ".planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md"
      provides: "Running log of every Railway dashboard action taken + every `railway variables` output observed (operator paste target)"
      contains: "Postgres provisioned"
  key_links:
    - from: "Railway Postgres service"
      to: "Railway npr-dashboard-prototype service DATABASE_URL"
      via: "Reference variable syntax ${{Postgres.DATABASE_URL}} (auto-syncs across password rotations) — visually confirmed via Railway UI 'linked' badge + CLI-resolved value"
      pattern: "${{Postgres.DATABASE_URL}}"
    - from: "Railway env vars (NEXT_PUBLIC_APP_*)"
      to: "lib/env.ts Zod schema"
      via: "Module-load validation — app refuses to boot if any required var missing"
      pattern: "NEXT_PUBLIC_APP_NAME"
---

<objective>
Provision the Railway Postgres service and wire all P1-required env vars onto the Next.js app service BEFORE Plan 03 ships code. This is entirely a Railway-dashboard + `railway` CLI operation; Claude cannot click Railway UI, so each step is a user-gated checkpoint (`checkpoint:human-action`) with precise navigation instructions and an expected `railway variables` output the operator pastes back for verification.

Each checkpoint follows the same rhythm:
1. Claude presents the exact click-path + expected outcome
2. Operator does it + runs a verification CLI command (and, for Task 1, pastes the Postgres tier/plan line from the Railway dashboard Settings page to confirm Hobby — guards against a Pro slip = $15 budget overrun)
3. Operator pastes the CLI output back into chat
4. Claude appends the output verbatim to `00.5.1-VERIFICATION.md` and advances

Purpose: Fulfills DEPLOY-07 (Postgres provisioned + linked via reference var) + DEPLOY-08 (NEXT_PUBLIC_APP_* env vars set) before Plan 03's `git push` would otherwise hard-crash the boot (P1+P2 code requires these env vars OR it throws from `lib/env.ts` during module load).

This plan is marked `autonomous: false` because the primary actions are in the Railway web UI — Claude can only READ state via `railway` CLI, cannot CREATE services or SET UI-level reference vars. The order is intentional: Postgres service must exist before a reference var can target it.

**Values pinned at planning time (no runtime forking):** `NEXT_PUBLIC_APP_NAME = NPR Dashboard`, `NEXT_PUBLIC_APP_DOMAIN = portal.utstitle.com`, `NEXT_PUBLIC_APP_BRAND_COLOR = #0F172A`. The brand color was investigated at planning time — `.env.local` has `NEXT_PUBLIC_APP_BRAND_COLOR=` set but empty (no local override), so `#0F172A` is the canonical default committed deterministically in this plan. No "check .env.local at runtime" fork.

Output: Postgres service live in Railway prod (Hobby tier confirmed) + 4 env vars set on the app service with deterministic values + every step recorded in `00.5.1-VERIFICATION.md`.
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
@.planning/phases/00.5.1-production-deploy-wire-up/01-prestart-hook-and-runbook-skeleton.md
@.planning/DEPLOY.md
@lib/env.ts

<interfaces>
<!-- The Zod schema any missing value would crash on. Values in checkpoints must satisfy ALL required fields. -->

From lib/env.ts (the boot-time validator):
```typescript
DATABASE_URL: z.string().url(),
CF_ACCESS_TEAM_DOMAIN: z.string().min(1),      // already set (P0.5) — DO NOT TOUCH
CF_ACCESS_AUD: z.string().min(1),              // already set (P0.5) — DO NOT TOUCH
NEXT_PUBLIC_APP_NAME: z.string().min(1),       // SET IN THIS PLAN
NEXT_PUBLIC_APP_DOMAIN: z.string().regex(/^[a-zA-Z0-9.-]+$/),  // BARE domain — SET IN THIS PLAN
NEXT_PUBLIC_APP_BRAND_COLOR: z.string().optional(),             // SET IN THIS PLAN (optional but we're setting it for parity with local)
ENCRYPTION_KEY: z.string().min(44).optional(), // already set (P0.5) — DO NOT TOUCH
```

Values pinned at planning time (DETERMINISTIC — no runtime forks):
- `NEXT_PUBLIC_APP_NAME` → `NPR Dashboard`
- `NEXT_PUBLIC_APP_DOMAIN` → `portal.utstitle.com` (the bare domain, no `https://`)
- `NEXT_PUBLIC_APP_BRAND_COLOR` → `#0F172A`

Brand-color pinning rationale (inspected at planning time):
- `.env.local` contains `NEXT_PUBLIC_APP_BRAND_COLOR=` — key present, VALUE empty (no local override).
- `.env.example` contains `NEXT_PUBLIC_APP_BRAND_COLOR=` — same, empty default.
- Therefore the canonical default committed to prod is `#0F172A` (slate-900). This matches the visual identity chosen for the app header and is the deterministic value this plan sets. No "if .env.local has X, use X" runtime branching.

Railway services that already exist (from P0.5):
- `tunnel` — cloudflared sidecar, healthy
- `npr-dashboard-prototype` — Next.js app, FAILED at `fa52cc5` but logs show Next.js booted (no DB queries ever ran)

Service being ADDED in this plan: `Postgres` (Railway Hobby tier, ~$5/mo, weekly snapshots, stays inside Railway private network — CONTEXT §Postgres Tier). Tier confirmation requires operator paste-back of the Settings → Plan line (not just service presence — Hobby-vs-Pro matters for the $15-20/mo budget).
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: CHECKPOINT — Provision Railway Postgres (Hobby tier) in the production environment + paste-back tier confirmation</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Postgres Tier + Cost (lines 40-54 — the locked decision; Hobby = ~$5/mo, Pro = $20/mo → budget overrun)
    - .planning/DEPLOY.md §2 Env Var Inventory (the table this checkpoint populates the DATABASE_URL row of)
    - .planning/STATE.md Key Decisions row for Railway Hobby (2026-04-18 P0.5.1 discuss — the authoritative source)
  </read_first>
  <what-automated>
    Before this checkpoint:
    - Plan 01 added `prestart` hook to `package.json` (ready to auto-migrate on first deploy)
    - Plan 01 created `.planning/DEPLOY.md` + `.planning/INITIAL_SEED_VERIFICATION.md`
    - All migrations 0000..0005 present in `drizzle/migrations/` and ready to run
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED:** Railway does not provide a CLI for provisioning add-on services. The Postgres service must be created via the Railway web dashboard. Claude cannot click. AND: tier confirmation (Hobby vs Pro) cannot be reliably read from `railway status --json` — Claude depends on the operator pasting the Settings → Plan line back, because a Pro slip = $15/mo budget overrun.

    **Operator instructions (paste-ready):**

    1. Open Railway dashboard: https://railway.com/dashboard
    2. Select the project containing services `tunnel` + `npr-dashboard-prototype` (the P0.5 project — if you're unsure, Claude can run `railway status --json` for you to confirm the project ID)
    3. Ensure the environment selector shows `production` (top of page)
    4. Click **+ Create** → **Database** → **Add PostgreSQL**
    5. Wait ~30 seconds for the service to provision — the service card should appear alongside `tunnel` and `npr-dashboard-prototype` with status `Deployed`
    6. Leave the service named `Postgres` (the default — reference variable syntax `${{Postgres.DATABASE_URL}}` depends on this exact name)
    7. **Confirm tier (CRITICAL — paste-back required):** Click the Postgres service → **Settings** → scroll to the **Plan** section.
       - Copy the exact plan line text as displayed (e.g., "Hobby", "$5/mo shared", or similar).
       - If `railway status --json --service Postgres` exposes a plan/tier field, include that output too.
       - **Paste this plan/tier line directly into chat** — Claude rejects the checkpoint if tier confirmation is absent or shows Pro/Team/Enterprise.

    **Verification CLI (operator runs + pastes output):**

    ```bash
    railway status --json
    ```

    Paste the full JSON output into chat. Claude will look for a services array entry with `name: "Postgres"` (or similar Postgres-indicating name).

    Then:

    ```bash
    railway variables --service Postgres --kv 2>&1 | head -20
    ```

    Paste that output too. Claude will look for `DATABASE_URL=postgresql://...` among the Postgres service's generated vars (Railway auto-creates DATABASE_URL, PGDATA, PGHOST, PGUSER, PGPASSWORD, PGDATABASE, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD).

    Also (for tier confirmation — in case the Railway CLI exposes it):

    ```bash
    railway status --json --service Postgres 2>&1
    ```

    Paste that output too if available (may or may not include a `plan` field depending on Railway CLI version).

    **Claude's action after the operator pastes output:**

    1. Confirm `Postgres` service is listed in `railway status --json`
    2. Confirm `DATABASE_URL` exists in the Postgres service's variables
    3. **Confirm tier is Hobby** — REQUIRED from the operator's pasted Settings → Plan line. Accept "Hobby", "$5/mo shared", or equivalent Hobby-indicating text. REJECT the checkpoint and ask the operator to switch/recreate if the tier shows "Pro", "Team", "Enterprise", or "$20/mo" — this would be a $15/mo budget overrun (CONTEXT §Postgres Tier).
    4. Append to `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` (create the file if it doesn't exist yet) a section titled `## Checkpoint 1 — Postgres provisioned (Hobby tier confirmed)` with:
       - Date/time of operator confirmation
       - Redacted first line of `railway status --json` (project id + service names only; no secrets)
       - Confirmation that `Postgres.DATABASE_URL` exists (without exposing the URL itself — redact the password portion `postgresql://user:***@host/db`)
       - **Tier paste-back (verbatim, from operator):** the exact Settings → Plan line (e.g., "Hobby" / "$5/mo shared")
       - Tier decision: Hobby — accepted (budget-compliant)
    5. Commit: `docs(00.5.1-02): VERIFICATION.md — Postgres service provisioned (Hobby tier confirmed)`

    **If operator reports an issue:**
    - If tier is Pro/Team/Enterprise → STOP. Ask user to downgrade or explicitly override the $15-20/mo budget ceiling. Do NOT advance.
    - If operator cannot produce a tier paste-back (e.g., Railway UI layout changed) → ask them to screenshot the Settings → Plan section. Do NOT advance on ambiguity.
    - If service was named anything other than `Postgres` → ask user to delete + recreate (reference variable syntax depends on this)
    - If provisioning hangs >5 min → check Railway status page + Railway support
  </action>
  <resume-signal>Paste the `railway status --json` output + `railway variables --service Postgres --kv` output + the EXACT Settings → Plan line showing "Hobby" (or equivalent). Claude advances to Task 2 after confirming Postgres service + DATABASE_URL are present AND tier is Hobby.</resume-signal>
  <acceptance_criteria>
    - Operator's pasted `railway status --json` includes a service named `Postgres` (or recognized Postgres service identifier)
    - Operator's pasted `railway variables --service Postgres --kv` includes a line starting `DATABASE_URL=postgresql://`
    - **Operator has pasted a Settings → Plan line showing "Hobby" / "$5/mo shared" / equivalent Hobby-indicating text** — tier paste-back is a required gate, not optional
    - Tier paste-back does NOT contain "Pro", "Team", "Enterprise", or "$20/mo" (would block checkpoint)
    - File `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` exists
    - `grep -c "Checkpoint 1" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "Postgres provisioned" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -cE "Hobby|\\$5/mo" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (tier confirmation recorded)
    - No raw DATABASE_URL password written to VERIFICATION.md (redact before commit)
    - Commit exists matching `^docs\(00\.5\.1-02\): VERIFICATION\.md — Postgres service provisioned`
  </acceptance_criteria>
  <done>Postgres service live in Railway production; DATABASE_URL auto-generated by Railway; TIER confirmed Hobby via operator paste-back (no Pro slip = $15/mo budget protected); checkpoint output appended to VERIFICATION.md with password redacted.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: CHECKPOINT — Wire DATABASE_URL to app service as a Railway reference variable (DEPLOY-07) + confirm 'linked' badge visible in Railway UI</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §In Scope (the ${{Postgres.DATABASE_URL}} reference pattern)
    - .planning/REQUIREMENTS.md line 172 (DEPLOY-07 exact wording — reference variable, not literal URL)
    - Previous VERIFICATION.md Checkpoint 1 (confirms Postgres service is named exactly `Postgres`)
  </read_first>
  <what-automated>
    After Checkpoint 1, Claude knows:
    - Postgres service name (confirmed from status --json)
    - Postgres tier (Hobby, confirmed via paste-back)
    - Railway auto-created `Postgres.DATABASE_URL` variable
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED:** The Railway CLI `railway variables --set KEY=VALUE` command DOES exist, and reference variables CAN be set via CLI in recent Railway versions. However, the syntax for reference variables through the CLI varies by Railway version, and a misfire sets a LITERAL string `${{Postgres.DATABASE_URL}}` (not the resolved value), which would fail `z.string().url()` validation on boot with a cryptic error. The dashboard UI has a dedicated "Reference Variable" picker that prevents this class of mistake.

    **Operator instructions (paste-ready):**

    1. Railway dashboard → select project → `npr-dashboard-prototype` service → **Variables** tab
    2. Click **+ New Variable**
    3. Click the **Reference** toggle (or "Add Reference" depending on Railway UI version) — NOT the plain "Raw Value" option
    4. Variable name: `DATABASE_URL`
    5. Service: **Postgres** (the service you provisioned in Checkpoint 1)
    6. Variable (on that service): **DATABASE_URL**
    7. Click **Add** (or "Save")
    8. **Visual confirmation (REQUIRED):** The variable row on the `npr-dashboard-prototype` Variables tab should display the name `DATABASE_URL` with a **link/reference badge** pointing to `Postgres.DATABASE_URL` — NOT a literal string. Confirm you can see this badge in the Railway UI before moving on.

    **Verification CLI (operator runs + pastes output):**

    ```bash
    railway variables --service npr-dashboard-prototype --kv 2>&1 | grep -i database_url
    ```

    Expected output format (Railway substitutes reference vars at resolve time, so `--kv` flag shows the RESOLVED value, which should be `postgresql://...`):

    ```
    DATABASE_URL=postgresql://postgres:<password>@<host>:<port>/railway
    ```

    Then (to confirm it's a reference var, not a literal):

    ```bash
    railway variables --service npr-dashboard-prototype 2>&1 | head -40
    ```

    In the non-kv output, the reference should be visibly annotated (Railway's CLI often shows a `→` or badge indicating the source service).

    Paste both outputs into chat.

    Also confirm in chat: "linked badge visible in Railway UI on DATABASE_URL row: yes/no" — this is a two-part verification (CLI-resolved value + UI visual badge).

    **Claude's action after operator pastes output:**

    1. Confirm `DATABASE_URL` is listed in `npr-dashboard-prototype` variables
    2. Confirm the resolved value starts `postgresql://` (i.e., Railway successfully interpolated, which is ONLY possible if it's a valid reference — a literal `${{Postgres.DATABASE_URL}}` would show as the literal string, failing `z.url()`)
    3. Confirm the operator reported "linked badge visible: yes" for the UI visual check
    4. Append to `00.5.1-VERIFICATION.md`:
       ```markdown
       ## Checkpoint 2 — DATABASE_URL wired as reference var (DEPLOY-07)

       - Date: <timestamp>
       - Service: npr-dashboard-prototype
       - Variable: DATABASE_URL → references ${{Postgres.DATABASE_URL}}
       - Resolved value starts: postgresql://postgres:***@<host-redacted>:5432/railway
       - Raw reference confirmed: yes (Railway CLI shows resolved URL, which would be impossible with a literal string)
       - Railway UI linked badge visible on DATABASE_URL row: yes (operator confirmed)
       ```
    5. Commit: `docs(00.5.1-02): VERIFICATION.md — DATABASE_URL reference wired (DEPLOY-07)`

    **If operator reports an issue:**
    - If `railway variables --kv` shows `DATABASE_URL=${{Postgres.DATABASE_URL}}` literally (the interpolation failed) → the variable was added as a plain string, not a reference. Operator needs to delete + re-add via the Reference picker.
    - If operator reports "linked badge visible: no" but the CLI resolves correctly → escalate. This mismatch is unusual; inspect UI state more carefully (may be a transient render).
    - If the resolved value is empty → Postgres service might still be provisioning; wait 60s + retry.
  </action>
  <resume-signal>Paste the `railway variables --service npr-dashboard-prototype` output showing resolved DATABASE_URL AND a confirmation line "linked badge visible in Railway UI: yes". Claude advances to Task 3 after confirming both CLI resolution + UI badge.</resume-signal>
  <acceptance_criteria>
    - Operator's pasted output shows `DATABASE_URL=postgresql://...` for service `npr-dashboard-prototype`
    - Resolved value is NOT the literal string `${{Postgres.DATABASE_URL}}`
    - Operator reported "linked badge visible in Railway UI: yes" for the DATABASE_URL row
    - `grep -c "Checkpoint 2" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "DEPLOY-07" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "linked badge" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (UI visual confirmation recorded)
    - No raw password written to VERIFICATION.md
    - Commit exists matching `^docs\(00\.5\.1-02\): VERIFICATION\.md — DATABASE_URL reference wired`
  </acceptance_criteria>
  <done>DATABASE_URL wired on app service as a reference to Postgres.DATABASE_URL; CLI confirms resolution to postgresql:// value; UI confirms linked badge on DATABASE_URL row; outlasts Postgres password rotations (DEPLOY-07 satisfied).</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: CHECKPOINT — Set NEXT_PUBLIC_APP_* env vars on the app service with DETERMINISTIC pinned values (DEPLOY-08)</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - lib/env.ts lines 22-28 (the exact Zod constraints — domain must match `/^[a-zA-Z0-9.-]+$/` regex)
    - .planning/REQUIREMENTS.md line 173 (DEPLOY-08 exact wording)
    - .planning/phases/01-core-data-model/02-env-vars-and-app-name-SUMMARY.md if present (historical reference only — actual values are pinned deterministically below, NOT read at runtime)
  </read_first>
  <what-automated>
    Values pinned at planning time (DETERMINISTIC — no runtime forks, no "check .env.local at execution time"):
    - `NEXT_PUBLIC_APP_NAME = "NPR Dashboard"`
    - `NEXT_PUBLIC_APP_DOMAIN = "portal.utstitle.com"` (bare, passes regex `/^[a-zA-Z0-9.-]+$/`)
    - `NEXT_PUBLIC_APP_BRAND_COLOR = "#0F172A"` (slate-900 — the canonical default)

    **Brand color pinning rationale (investigated at planning time):**
    - `.env.local` has `NEXT_PUBLIC_APP_BRAND_COLOR=` (key present, VALUE empty — no local override)
    - `.env.example` has `NEXT_PUBLIC_APP_BRAND_COLOR=` (same empty default)
    - Therefore `#0F172A` is the canonical default committed deterministically to prod. No runtime branching on "does .env.local have a value".
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED:** The `railway variables --set` CLI command CAN set plain-value env vars non-interactively. However, setting three at once through CLI risks silent failures (one succeeds, one fails with no rollback). The operator can batch-set via the dashboard UI which offers transactional feedback, OR use CLI and paste the output. Either path works; Claude proposes CLI-first because it's more deterministic.

    **Operator instructions — PREFERRED: CLI path (faster):**

    Run this exact command (copy-paste; do not hand-retype values — bare domain + color hex easy to fat-finger). **The values below are pinned deterministically at planning time — do NOT substitute from `.env.local` at runtime:**

    ```bash
    railway variables --service npr-dashboard-prototype \
      --set "NEXT_PUBLIC_APP_NAME=NPR Dashboard" \
      --set "NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com" \
      --set "NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A"
    ```

    **Alternate dashboard path** (if CLI feels risky):
    1. Railway dashboard → `npr-dashboard-prototype` → Variables tab
    2. Click **+ New Variable** three times, once per var
    3. Add each name/value pair above (plain strings, NOT reference vars this time) — values MUST match the pinned values exactly

    **Verification CLI (operator runs + pastes output):**

    ```bash
    railway variables --service npr-dashboard-prototype --kv 2>&1 | grep -E "^NEXT_PUBLIC_APP_"
    ```

    Expected output (three lines, EXACTLY these values):
    ```
    NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A
    NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com
    NEXT_PUBLIC_APP_NAME=NPR Dashboard
    ```

    Also run this to confirm nothing OTHER than expected changed (specifically: CF Access + ENCRYPTION_KEY still present, unchanged):

    ```bash
    railway variables --service npr-dashboard-prototype --kv 2>&1 | grep -cE "^(CF_ACCESS_TEAM_DOMAIN|CF_ACCESS_AUD|ENCRYPTION_KEY)="
    ```

    Expected output: `3` (three P0.5 variables still present).

    Paste both outputs into chat.

    **Claude's action after operator pastes output:**

    1. Confirm all three NEXT_PUBLIC_APP_* vars are present with EXACT pinned values:
       - `NEXT_PUBLIC_APP_NAME=NPR Dashboard`
       - `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com`
       - `NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A`
       (reject if any value deviates — no runtime substitution, no operator-choice variance)
    2. Verify NEXT_PUBLIC_APP_DOMAIN value matches regex `^[a-zA-Z0-9.-]+$` (no `https://`, no path)
    3. Confirm P0.5 variables (CF_ACCESS_*, ENCRYPTION_KEY) still present (didn't wipe them)
    4. Append to `00.5.1-VERIFICATION.md`:
       ```markdown
       ## Checkpoint 3 — NEXT_PUBLIC_APP_* env vars set with pinned values (DEPLOY-08)

       - Date: <timestamp>
       - Service: npr-dashboard-prototype
       - NEXT_PUBLIC_APP_NAME = NPR Dashboard (pinned at planning time)
       - NEXT_PUBLIC_APP_DOMAIN = portal.utstitle.com (bare domain, passes regex /^[a-zA-Z0-9.-]+$/, pinned at planning time)
       - NEXT_PUBLIC_APP_BRAND_COLOR = #0F172A (canonical default, pinned at planning time — .env.local has empty value so no local override applies)
       - Determinism confirmed: values committed deterministically, no runtime .env.local check
       - P0.5 vars preserved: CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD, ENCRYPTION_KEY all still present
       ```
    5. Commit: `docs(00.5.1-02): VERIFICATION.md — NEXT_PUBLIC_APP_* set with pinned values (DEPLOY-08)`

    **If operator reports an issue:**
    - `NEXT_PUBLIC_APP_DOMAIN` value contains `https://` → app will crash on boot (Zod regex rejects). Fix: `railway variables --service npr-dashboard-prototype --set "NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com"` (overwrites)
    - `NEXT_PUBLIC_APP_BRAND_COLOR` is set to anything other than `#0F172A` → fix: `railway variables --service npr-dashboard-prototype --set "NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A"` (values are pinned at planning time; drift is not acceptable)
    - P0.5 vars missing → STOP. Investigate before proceeding — that's an unrelated regression.
    - `railway variables --set` complains about quoting → use single quotes or escape the `#`: `"NEXT_PUBLIC_APP_BRAND_COLOR=\#0F172A"` (depends on shell; zsh particularly picky about `#`)
  </action>
  <resume-signal>Paste the `railway variables --service npr-dashboard-prototype --kv | grep NEXT_PUBLIC_APP_` output + the P0.5-preservation grep count. Claude advances to Plan 03 (deploy + verify) after confirming all env vars match pinned values exactly and P0.5 vars preserved.</resume-signal>
  <acceptance_criteria>
    - Operator's pasted output includes `NEXT_PUBLIC_APP_NAME=NPR Dashboard` (exact match to pinned value)
    - Operator's pasted output includes `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com` (exact match; NO `https://`, NO path)
    - Operator's pasted output includes `NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A` (exact match to pinned canonical default — no runtime substitution)
    - Domain value matches regex `^[a-zA-Z0-9.-]+$` (manually validated by Claude against lib/env.ts)
    - Preservation grep count for `CF_ACCESS_TEAM_DOMAIN|CF_ACCESS_AUD|ENCRYPTION_KEY` returns 3
    - `grep -c "Checkpoint 3" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "DEPLOY-08" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "portal.utstitle.com" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "#0F172A" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (pinned brand color recorded)
    - `grep -c "pinned" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (determinism recorded)
    - Commit exists matching `^docs\(00\.5\.1-02\): VERIFICATION\.md — NEXT_PUBLIC_APP_\* set`
  </acceptance_criteria>
  <done>All three NEXT_PUBLIC_APP_* vars present on app service with EXACT pinned values (no runtime substitution from .env.local); Zod regex satisfied for domain; P0.5 vars preserved; DEPLOY-08 satisfied.</done>
</task>

</tasks>

<verification>
- `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` exists with 3 checkpoint sections (one per task above)
- Operator-pasted `railway variables --service npr-dashboard-prototype --kv` output contains: `DATABASE_URL=postgresql://...`, `NEXT_PUBLIC_APP_NAME=NPR Dashboard`, `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com`, `NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A`
- Operator-pasted output also shows P0.5 vars still present (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD, ENCRYPTION_KEY)
- Operator paste-back confirms Postgres tier = Hobby (tier gate enforced — protects $15-20/mo budget)
- Operator paste-back confirms "linked badge visible" in Railway UI on DATABASE_URL row (UI + CLI two-part visual/resolution verification)
- 3 commits landed, one per checkpoint
- **No `git push` has been triggered** — Plan 03 owns the deploy step
- The app service in Railway is now fully configured to boot P1+P2 code the moment Plan 03 pushes master
</verification>

<success_criteria>
- [ ] Railway `Postgres` service exists + is deployed + operator-confirmed Hobby tier (not Pro/Team/Enterprise)
- [ ] App service `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference var, not literal) + linked badge visible in Railway UI
- [ ] App service `NEXT_PUBLIC_APP_NAME` = `NPR Dashboard` (pinned)
- [ ] App service `NEXT_PUBLIC_APP_DOMAIN` = `portal.utstitle.com` (pinned)
- [ ] App service `NEXT_PUBLIC_APP_BRAND_COLOR` = `#0F172A` (pinned canonical default — no runtime substitution)
- [ ] P0.5 env vars (CF_ACCESS_*, ENCRYPTION_KEY) preserved unchanged
- [ ] `00.5.1-VERIFICATION.md` has 3 checkpoint sections with dates + redacted outputs + tier paste-back + UI linked-badge confirmation
- [ ] DEPLOY-07 + DEPLOY-08 both verifiable from the VERIFICATION.md record
</success_criteria>

<output>
After completion, create `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-02-railway-provisioning-checkpoints-SUMMARY.md`. Note in the summary: (a) the exact Railway project + environment where provisioning happened, (b) the confirmed Postgres tier (Hobby) per operator paste-back, (c) that Plan 03 is unblocked, (d) that the app service is NOT yet deployed with the prestart hook — Plan 03's `git push` is what brings Plan 01's prestart hook into prod, (e) that all NEXT_PUBLIC_APP_* values were pinned deterministically at planning time (no runtime substitution).
</output>
