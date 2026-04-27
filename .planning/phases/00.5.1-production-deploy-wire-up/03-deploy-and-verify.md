---
phase: 00.5.1-production-deploy-wire-up
plan: 03
type: execute
wave: 3
depends_on: ["00.5.1-01", "00.5.1-02"]
files_modified:
  - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md
  - .planning/INITIAL_SEED_VERIFICATION.md
autonomous: false
requirements: [CFA-11, CFA-12, DEPLOY-07, DEPLOY-08, DEPLOY-09]
requirements_addressed: [CFA-11, CFA-12, DEPLOY-07, DEPLOY-08, DEPLOY-09]

must_haves:
  truths:
    - "A deploy from `origin/master` (HEAD contains the prestart hook from Plan 01 + all P1/P2 code) reaches Railway status=SUCCESS"
    - "Railway deploy logs show the prestart hook ran `npm run db:migrate` and applied migrations 0000..0005 against the newly-provisioned prod Postgres before Next.js booted"
    - "App boot succeeded without Zod env-validation errors (all 4 new env vars from Plan 02 are read successfully)"
    - "Prod `drizzle.__drizzle_migrations` journal contains 6 applied entries (0000..0005) — verified READ-ONLY via `node -e` + `pg`; NO local `drizzle-kit migrate` invocation touches prod (prestart-only policy)"
    - "`railway run --service npr-dashboard-prototype -- npm run db:seed` exits 0 against prod Postgres and prints `Seeded 8 tracks, 25 stages.`"
    - "Post-seed readback shows `SELECT count(*) FROM tracks` = 8 and `SELECT count(*) FROM stages` = 25; all rows match the source `db/seed/tracks.ts` + `db/seed/stages.ts` content"
    - "`curl -I https://npr-dashboard-prototype-production.up.railway.app` returns 403, 404, connection refused, or timeout (CFA-11 satisfied — direct origin blocked)"
    - "After CF Access login at `https://portal.utstitle.com`, the `<AppHeader>` avatar displays the real Google identity name/email tied to the signed-in user (NOT the fallback `CD` initials for a non-Carrie user) — CFA-12 satisfied"
    - "Every command output + verification step recorded in `00.5.1-VERIFICATION.md` and `.planning/INITIAL_SEED_VERIFICATION.md`"
  artifacts:
    - path: ".planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md"
      provides: "Extended with Checkpoints 4-8 (deploy trigger, deploy success, migrations applied, CFA-11 direct-origin test, CFA-12 avatar test)"
      contains: "Checkpoint 4"
    - path: ".planning/INITIAL_SEED_VERIFICATION.md"
      provides: "Filled-in template with actual row counts, field-level diff, date, commit SHA, outcome"
      contains: "verified"
  key_links:
    - from: "git push origin master"
      to: "Railway build + deploy"
      via: "Railway GitHub integration (auto-deploy on push)"
      pattern: "railway status --json"
    - from: "Railway container boot"
      to: "drizzle migrations applied"
      via: "package.json prestart hook from Plan 01 (prestart-only policy — no local drizzle-kit invocation)"
      pattern: "prestart"
    - from: "npm run db:seed via railway run"
      to: "Postgres tracks + stages tables"
      via: "onConflictDoUpdate upsert (idempotent, proven in P1 Plan 04)"
      pattern: "Seeded 8 tracks"
    - from: "curl direct Railway origin"
      to: "403/404/timeout response"
      via: "Railway Public Networking config + Cloudflare Tunnel exclusive routing"
      pattern: "HTTP/.* (403|404)"
    - from: "CF Access JWT claims"
      to: "components/app-header.tsx avatar rendering"
      via: "lib/current-user.ts (reads verified JWT claims, not raw CF_Authorization cookie)"
      pattern: "current-user"
---

<objective>
With Plan 01 landed in the repo (prestart hook, DEPLOY.md, seed template) and Plan 02 landed in Railway (Postgres service, DATABASE_URL reference, NEXT_PUBLIC_APP_* env vars), this plan executes the actual ship: push to prod, watch the deploy, run the one-time seed, and verify both P0.5 deferrals (CFA-11 direct origin blocked + CFA-12 avatar shows real user).

**Plan shape:** Every user-gated checkpoint pauses for operator confirmation because (a) `git push` is destructive-ish (cannot be un-pushed cleanly), (b) `npm run db:seed` writes to prod and GSD rules forbid Claude running destructive ops against prod without explicit human go-ahead, (c) CFA-12 requires a browser session that Claude cannot initiate. Claude runs all monitoring + READ-ONLY readback commands via `railway` CLI in between checkpoints.

**Prestart-only migration policy (locked):** Migrations run EXCLUSIVELY via the container's `prestart` hook (where a failure halts the deploy via health check — Railway keeps the old container running). This plan does NOT invoke `drizzle-kit migrate` or `npm run db:migrate` against prod from the operator's laptop — that would bypass the `prestart` safety net and use the operator's local migration files rather than the deployed code's. Schema-version checks in this plan are READ-ONLY queries against the `drizzle.__drizzle_migrations` journal table using the `pg` package (v8.20.0, confirmed in package.json).

Purpose: Closes all 5 Phase 0.5.1 requirement IDs (CFA-11, CFA-12, DEPLOY-07, DEPLOY-08, DEPLOY-09) with observable, repeatable evidence. After this plan lands, any future phase can ship with a single `git push origin master` and the prestart hook + Railway env vars carry the weight.
Output: Production deploy of current `master` (P1+P2 code) running healthy at `portal.utstitle.com`, prod Postgres seeded with 8 tracks + 25 stages, 5 requirement IDs closed, 2 verification artifacts written.
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
@.planning/phases/00.5.1-production-deploy-wire-up/02-railway-provisioning-checkpoints.md
@.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md
@.planning/DEPLOY.md
@.planning/INITIAL_SEED_VERIFICATION.md
@.planning/phases/00.5-access-encryption/P05-CLOSURE.md

# Source of truth for seed readback diff
@db/seed/tracks.ts
@db/seed/stages.ts
@db/seed/run.ts

# Avatar rendering path — the CFA-12 target
@components/app-header.tsx
@lib/current-user.ts

<interfaces>
<!-- What's in Railway after Plan 02 completes -->

Railway production (post-Plan-02 state):
- Service `tunnel` — cloudflared sidecar (unchanged from P0.5)
- Service `Postgres` — Hobby tier, empty (no migrations applied, no seed data)
- Service `npr-dashboard-prototype` — STILL on `fa52cc5` (pre-P1), env vars updated but code not redeployed
- Env vars on `npr-dashboard-prototype`: DATABASE_URL (ref → Postgres), NEXT_PUBLIC_APP_NAME/_DOMAIN/_BRAND_COLOR (new), CF_ACCESS_* + ENCRYPTION_KEY (preserved from P0.5)

What `git push origin master` will ship:
- All commits since `fa52cc5` (includes P1 Plans 01-06 + P2 Plans 01-06 + P0.5.1 Plan 01's prestart hook + DEPLOY.md)
- Migrations 0001..0005 present (will auto-apply on first boot via the new prestart hook)
- `db/seed/tracks.ts` + `db/seed/stages.ts` shipped but NOT auto-run (seeds stay manual per CONTEXT §Seed Auto-Run Policy)

Expected deploy sequence (watchable via `railway logs`):
1. Railway receives push webhook
2. Build runs `next build` → outputs `.next/`
3. Container starts → npm invokes prestart → `drizzle-kit migrate` applies all 6 migrations (0000..0005) in order
4. npm invokes start → `next start` → Next.js boots on the configured port
5. cloudflared tunnel already up → traffic from `portal.utstitle.com` routes to the new container

Seed sources (what `npm run db:seed` will UPSERT):
- `TRACK_SEEDS` (db/seed/tracks.ts): 8 rows — TE, FL (HIGH); DP, PO, EC, SL, BL, GI (MEDIUM)
- `STAGE_SEEDS` (db/seed/stages.ts): 25 rows — 4 universal + 10 TE + 11 FL

Package availability (confirmed in package.json):
- `pg` v8.20.0 — available at runtime in the prod container. Used for READ-ONLY schema-version checks + seed readback via `railway run -- node -e`.
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: CHECKPOINT — Operator runs `git push origin master`; Claude watches the Railway deploy with 60s poll snapshots</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - Current `git log --oneline -5` to confirm HEAD contains Plan 01's prestart commit
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md Checkpoints 1-3 (confirms Railway is ready)
    - .planning/DEPLOY.md §1 Push-to-Prod Playbook (the sequence this task executes for the first time)
  </read_first>
  <what-automated>
    Before the checkpoint fires, Claude runs:
    ```bash
    git status
    git log --oneline -10
    git rev-parse origin/master
    git rev-parse HEAD
    ```
    and reports: (a) working tree clean or has uncommitted changes (operator must decide whether to commit before push), (b) HEAD commit SHA + subject, (c) whether HEAD is ahead of origin/master (must be AHEAD or push is a noop).

    Also runs `railway status --json --service npr-dashboard-prototype` to capture the CURRENT (pre-push) deployment SHA and status. This becomes the "before" baseline for the deploy comparison.
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED:** Per GSD rules, Claude does not run `git push` without explicit user authorization. This is especially true for pushes to `master` that trigger production deploys. The operator owns the push; Claude owns the monitoring.

    **Operator instructions:**

    1. Review Claude's pre-flight report above. If working tree has uncommitted changes that should ship with this deploy, commit them first (or explicitly say "push as-is" if the uncommitted changes are intentional to leave out).
    2. Confirm you are on branch `master`: `git branch --show-current` → expect `master`
    3. Confirm you are ahead of origin: Claude already reported SHA diff; operator agrees.
    4. **Run the push:**
       ```bash
       git push origin master
       ```
    5. Expected: push succeeds, prints list of commits pushed + `master -> master`
    6. Reply in chat: "pushed" (or paste the full `git push` output if anything unusual)

    **Claude's action after operator confirms "pushed" — poll in 60-second batches with chat snapshots:**

    To avoid a silent 8-minute wait, Claude polls in **60-second batches** (up to 8 batches / 8 minutes total). After each batch, Claude emits a short status snapshot to chat so the operator can interrupt if something's wrong.

    Poll loop (pseudo):
    ```
    for batch in 1..8:
      sleep 60
      STATUS=$(railway status --json --service npr-dashboard-prototype | jq -r '.status // .deployments[0].status')
      TAIL=$(railway logs --service npr-dashboard-prototype 2>&1 | tail -1)
      emit to chat: "Poll $batch/8: status=$STATUS, latest log line: $TAIL"
      if STATUS in [SUCCESS, FAILED, CRASHED]: break
    ```

    Status transitions to expect (may take 2-5 minutes total; hard ceiling 8 minutes):
    - `status: "BUILDING"` — Railway is running `next build`
    - `status: "DEPLOYING"` — container starting
    - `status: "SUCCESS"` — boot succeeded (prestart migrations ran + Next.js up)
    - OR `status: "FAILED"` / `CRASHED` — something broke; see escalation below

    After terminal status (SUCCESS/FAILED/CRASHED) OR 8-minute hard timeout, fetch the deploy logs:
    ```bash
    railway logs --service npr-dashboard-prototype 2>&1 | tail -200
    ```

    Grep the logs for the expected markers:
    - `> prestart` or `npm run db:migrate` (proves prestart hook fired)
    - `Applying migration 0001_conscious_tarantula` (or similar drizzle-kit output showing at least one migration applied — first boot will apply all 6)
    - `▲ Next.js` or `Ready in` (proves Next.js booted)
    - ABSENCE of `Environment validation failed:` (would indicate lib/env.ts Zod rejected)
    - ABSENCE of `ECONNREFUSED` / `database ... does not exist` (would indicate DATABASE_URL resolution failed)

    Append to `00.5.1-VERIFICATION.md`:
    ```markdown
    ## Checkpoint 4 — Deploy triggered + completed (DEPLOY-09 evidence)

    - Date: <timestamp>
    - Operator-pushed SHA: <git rev-parse HEAD>
    - Railway deploy status: SUCCESS
    - Build time: <N seconds>
    - Poll snapshots (60s cadence):
      - Poll 1/8: status=<status>, latest log line: <tail>
      - Poll 2/8: status=<status>, latest log line: <tail>
      - ...
    - Key log markers found:
      - prestart fired: yes
      - Migrations applied (first boot): 0000..0005 (6 migrations)
      - Next.js booted: yes
      - Zod env errors: none
      - DB connection errors: none

    ### Log excerpts (redacted)
    \`\`\`
    <paste 30 lines of relevant log output, redacting any URLs that contain passwords>
    \`\`\`
    ```

    Commit: `docs(00.5.1-03): VERIFICATION.md — production deploy SUCCESS (DEPLOY-09)`

    **Escalation — if deploy status is FAILED / CRASHED / timeout:**
    - Fetch logs: `railway logs --service npr-dashboard-prototype 2>&1 | tail -300`
    - Common failure modes + responses:
      - `Environment validation failed: NEXT_PUBLIC_APP_DOMAIN: must be a bare domain` → Plan 02 Checkpoint 3 set a bad value. Use `railway variables --service npr-dashboard-prototype --set "NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com"` to fix, then Railway dashboard → Redeploy.
      - `drizzle-kit migrate: DATABASE_URL not set` → Plan 02 Checkpoint 2's reference var failed to resolve. Re-inspect via dashboard.
      - `Error: relation "deals" does not exist` on first boot → prestart didn't run. Check `package.json` in the deployed commit via `railway run --service npr-dashboard-prototype -- cat package.json | grep prestart`; if missing, the wrong commit shipped.
    - Offer Layer 1 rollback (DEPLOY.md §3) if the operator wants to revert before debugging.
    - Do NOT proceed to Task 2 until deploy is SUCCESS.
    - The operator MAY interrupt the poll loop early (e.g., after Poll 2 if logs show a fatal error) — Claude respects the interrupt and jumps to the escalation branch.
  </action>
  <resume-signal>Operator types "pushed" after running `git push origin master`. Claude polls Railway in 60-second batches (max 8) + emits snapshot to chat per batch + fetches logs + verifies markers + appends to VERIFICATION.md. Advances to Task 2 only when deploy is SUCCESS.</resume-signal>
  <acceptance_criteria>
    - Operator confirmed push via "pushed" message or equivalent
    - Claude emitted at least 1 poll snapshot to chat ("Poll N/8: status=..., latest log line: ...") during the wait — confirms the 60-second cadence was followed, not a silent long-poll
    - `railway status --json --service npr-dashboard-prototype` shows `status: "SUCCESS"` for a deployment newer than the pre-push baseline
    - `railway logs --service npr-dashboard-prototype` contains at least one of: `npm run db:migrate`, `Applying migration`, `drizzle-kit migrate`
    - `railway logs` does NOT contain `Environment validation failed:` or `ECONNREFUSED`
    - `grep -c "Checkpoint 4" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "DEPLOY-09" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "Poll " .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (poll snapshots recorded)
    - Commit exists matching `^docs\(00\.5\.1-03\): VERIFICATION\.md — production deploy SUCCESS`
  </acceptance_criteria>
  <done>Railway deploy SUCCESS; prestart hook proven to have fired migrations; Next.js booted with all env vars resolving; 60s poll snapshots recorded; log excerpt recorded in VERIFICATION.md.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: CHECKPOINT — Operator authorizes one-time prod seed; Claude runs seed + READ-ONLY schema-version check + readback + fills INITIAL_SEED_VERIFICATION.md</name>
  <files>.planning/INITIAL_SEED_VERIFICATION.md, .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - .planning/INITIAL_SEED_VERIFICATION.md (the template from Plan 01 — Claude fills this in now)
    - db/seed/tracks.ts (the source of truth for the 8 track rows — read the const TRACK_SEEDS values)
    - db/seed/stages.ts (the source of truth for the 25 stage rows — read the const STAGE_SEEDS values)
    - db/seed/run.ts (confirms the output message format `Seeded 8 tracks, 25 stages.`)
    - .planning/DEPLOY.md §4 Initial Seed Checklist (the runbook this executes)
    - package.json (confirm `pg` v8.20.0 in dependencies — the tool for read-only readback)
  </read_first>
  <what-automated>
    After operator authorizes the seed, Claude runs a READ-ONLY schema-version check (NOT a migration invocation — prestart-only policy) using the `pg` package that is confirmed present in `package.json` (v8.20.0):

    ```bash
    railway run --service npr-dashboard-prototype -- node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      (async () => {
        await c.connect();
        const r = await c.query(\"SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 6\");
        console.log('drizzle.__drizzle_migrations (latest 6 entries):');
        console.table(r.rows);
        console.log('Row count:', r.rowCount);
        await c.end();
      })();
    "
    ```

    Expected: 6 rows returned (one per migration 0000..0005, ordered by id DESC). This proves the prestart hook from Task 1's deploy applied all migrations. ZERO writes, ZERO `drizzle-kit migrate` invocation.

    If row count is not 6 (e.g., 0, or fewer than expected), that means the deployed code's prestart hook did NOT apply migrations as expected. STOP and escalate — the deploy landed but the migration chain is incomplete. Alternate diagnostic: `railway logs --service npr-dashboard-prototype | grep -A 2 "prestart"` to confirm prestart output from Task 1.

    Then runs the seed:
    ```bash
    railway run --service npr-dashboard-prototype -- npm run db:seed
    ```
    Captures stdout. Expected output: `Seeded 8 tracks, 25 stages.` exit 0.

    Then runs readback queries. Because `pg` v8.20.0 is confirmed in `package.json` dependencies, use it directly — no `psql` fallback (`psql` is not guaranteed available in the app container):

    ```bash
    railway run --service npr-dashboard-prototype -- node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      (async () => {
        await c.connect();
        const tracks = await c.query('SELECT code, label, default_priority FROM tracks ORDER BY code');
        const stages = await c.query(\"SELECT s.code, s.label, t.code AS track_code, s.sort_order, s.is_terminal FROM stages s LEFT JOIN tracks t ON s.track_id = t.id ORDER BY t.code NULLS FIRST, s.sort_order\");
        console.log('TRACKS (' + tracks.rowCount + ' rows):');
        console.table(tracks.rows);
        console.log('STAGES (' + stages.rowCount + ' rows):');
        console.table(stages.rows);
        await c.end();
      })();
    "
    ```
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED:** Per GSD rules, Claude does not run commands that modify production data without explicit human authorization. Seeding is a data modification. Even though `onConflictDoUpdate` makes it safe to re-run, the FIRST run against an empty DB is the canonical "initialize prod" moment and deserves a deliberate gate.

    **Operator instructions:**

    1. Review: this runs `railway run --service npr-dashboard-prototype -- npm run db:seed` against your production Postgres. It will INSERT 8 tracks + 25 stages. Idempotent via `onConflictDoUpdate` (proven in P1 Plan 04), but still a data modification.

    2. **PRE-FLIGHT: ENCRYPTION_KEY trailing-`=` sanity check (one-line paste-back).** Before proceeding to seed, run:
       ```bash
       railway variables --service npr-dashboard-prototype --kv | grep ^ENCRYPTION_KEY= | awk -F= '{print $NF}' | tr -d "\n" | tr -d " "
       ```
       Or use the Railway dashboard: open `npr-dashboard-prototype` service → Variables → reveal `ENCRYPTION_KEY` → copy only the **last character** visible.

       **Expected:** `=` (the trailing base64 padding character; 32-byte keys base64-encode to exactly 44 chars ending in `=`).

       **Why this check:** Trailing `=` is the single most common loss when ENCRYPTION_KEY is round-tripped through copy/paste, quoted incorrectly, or re-entered by hand. Without it, base64 decode succeeds (non-strict) but produces wrong bytes → `lib/crypto.ts` will silently encrypt/decrypt against a different effective key than the P0.5-backed-up value in 1Password. This is pre-flight because we do NOT want to discover a key regression AFTER seeding data that would be irrecoverable.

       **Paste-back format:** `ENCRYPTION_KEY trailing char: =` (literal equals sign). If ANYTHING ELSE (blank, quote, newline, letter, number), STOP — do not say "seed prod." Reconcile against the 1Password backup first (P0.5 mandate).

    3. If the trailing-`=` check passes AND you want to proceed, reply: **"seed prod"** (or any clear affirmative like "go ahead" / "run seed").

    4. If you want to wait or investigate first, reply with your concern and Claude will hold.

    **Claude's action after operator says "seed prod":**

    1. **READ-ONLY schema-version precheck (NO migration invocation — prestart-only policy):**
       Run the `node -e` + `pg` SELECT against `drizzle.__drizzle_migrations` shown in what-automated above. Expect 6 rows (one per 0000..0005).

       If the journal has fewer than 6 entries, that means Task 1's prestart did NOT apply all migrations. STOP and escalate — the wrong code shipped or prestart failed silently. Alternate diagnostic: `railway logs --service npr-dashboard-prototype | grep -A 2 "prestart"` to confirm the prestart output from the Task 1 deploy.

       **Do NOT run `drizzle-kit migrate` or `npm run db:migrate` against prod from this machine.** Migrations flow exclusively through the container's `prestart` hook (where a failure halts the deploy via health check — Railway keeps the old container).

    2. **Run the seed:**
       ```bash
       railway run --service npr-dashboard-prototype -- npm run db:seed
       ```
       Expected stdout: `Seeded 8 tracks, 25 stages.` Exit 0.
       If it outputs a different tally or a Zod error, STOP and capture the error — likely a mismatch between shipped seed file and schema.

    3. **Readback — run the `node -e` + `pg` readback command shown in what-automated above.** Capture the TRACKS + STAGES table output verbatim. No `psql` fallback — `pg` v8.20.0 is confirmed present in `package.json` and is the ONLY readback path.

    4. **Diff against source seed files:**
       Read `db/seed/tracks.ts` `TRACK_SEEDS` const. Compare each row's `code` + `label` + `defaultPriority` against the readback table's corresponding row. Expect exact match on 8 rows.
       Read `db/seed/stages.ts` `STAGE_SEEDS` const. Compare each row's `code` + `label` + `sortOrder` + `isTerminal` + resolved track code against the readback. Expect exact match on 25 rows.

    5. **Fill in `.planning/INITIAL_SEED_VERIFICATION.md`** (the template from Plan 01). Populate each blank:
       - Date of seed run: <ISO timestamp>
       - Operator: <name from git config or "pair-run with Claude">
       - Prod commit SHA: `git rev-parse origin/master` (the one deployed)
       - Row counts table: fill with actual values (8/25/4/10/11)
       - tracks readback paste: drop the table output in the code block (from the `node -e` + `pg` output)
       - stages readback paste: drop the table output in the code block (from the `node -e` + `pg` output)
       - Diff vs source seed files:
         - If exact match: "verified — all 8 track rows + 25 stage rows match source seed files byte-for-byte on code/label/default_priority/sort_order/is_terminal"
         - If mismatch: list the mismatched fields + investigate
       - Outcome: check the "verified" box (strike out the other two bullets) OR fill in mismatch details

    6. Append a summary entry to `00.5.1-VERIFICATION.md`:
       ```markdown
       ## Checkpoint 5 — Initial prod seed executed + verified

       - Date: <timestamp>
       - Schema-version precheck (READ-ONLY): drizzle.__drizzle_migrations = 6 rows (0000..0005) — prestart-only policy honored, no drizzle-kit invocation from operator laptop
       - Seed command: `railway run --service npr-dashboard-prototype -- npm run db:seed`
       - Exit code: 0
       - Output: Seeded 8 tracks, 25 stages.
       - Readback (via `node -e` + `pg` v8.20.0): 8 tracks, 25 stages (4 universal + 10 TE + 11 FL)
       - Diff vs source: verified (or mismatch details)
       - Full verification artifact: .planning/INITIAL_SEED_VERIFICATION.md
       ```

    7. Commit (single commit covering both files):
       ```
       docs(00.5.1-03): VERIFICATION.md + INITIAL_SEED_VERIFICATION.md — prod seeded + diff verified
       ```

    **Do NOT run the seed a second time unless the operator explicitly asks.** The idempotency of `onConflictDoUpdate` makes it safe but the audit trail should reflect one authorized seed event, not multiple.

    **Do NOT run `drizzle-kit migrate` / `npm run db:migrate` against prod from the operator's laptop at any point in this task.** Migrations are prestart-only.
  </action>
  <resume-signal>Operator says "seed prod" (or explicit affirmative). Claude runs the READ-ONLY schema-version check + seed + readback + diff + fills INITIAL_SEED_VERIFICATION.md + appends to 00.5.1-VERIFICATION.md + commits. Advances to Task 3a after INITIAL_SEED_VERIFICATION.md outcome is "verified" (or mismatch resolved).</resume-signal>
  <acceptance_criteria>
    - **PRE-FLIGHT:** Operator has pasted back `ENCRYPTION_KEY trailing char: =` (literal equals) BEFORE saying "seed prod." If the pasted character is anything else, the checkpoint MUST NOT advance.
    - READ-ONLY schema-version check returned 6 rows from `drizzle.__drizzle_migrations` (prestart applied 0000..0005)
    - ZERO invocations of `drizzle-kit migrate` or `npm run db:migrate` targeted at prod in this task's execution trace (prestart-only policy)
    - `railway run -- npm run db:seed` exit code 0
    - Seed output contains `Seeded 8 tracks, 25 stages.` (or equivalent per db/seed/run.ts format)
    - Readback (via `node -e` + `pg`, NOT `psql`) shows 8 rows in `tracks`
    - Readback shows 25 rows in `stages` (split: 4 universal + 10 TE + 11 FL)
    - `.planning/INITIAL_SEED_VERIFICATION.md` no longer has placeholder underscores in the "Row Counts" section (fields filled)
    - `grep -c "verified" .planning/INITIAL_SEED_VERIFICATION.md` returns at least 1 (outcome set)
    - `grep -c "Checkpoint 5" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "prestart-only" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (policy recorded in audit)
    - Commit exists matching `^docs\(00\.5\.1-03\): VERIFICATION\.md \+ INITIAL_SEED_VERIFICATION\.md`
  </acceptance_criteria>
  <done>Prod Postgres seeded with 8 tracks + 25 stages; schema version verified READ-ONLY (no drizzle-kit invocation from laptop); diff against source files verified; INITIAL_SEED_VERIFICATION.md filled in with outcome = verified; commit landed.</done>
</task>

<task type="auto">
  <name>Task 3a: Run CFA-11 direct-origin verification (autonomous — no operator input)</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/00.5-access-encryption/P05-CLOSURE.md SC1 section (the deferred item this closes)
    - .planning/DEPLOY.md §5 Closure Verifications (the exact commands to run)
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Verification of CFA-11
  </read_first>
  <action>
    **CFA-11 — Direct origin blocked. Fully autonomous; no operator input required.**

    Run from the local machine (NOT inside Railway — `railway run` would bypass CF which isn't the test point):
    ```bash
    curl -I --max-time 10 https://npr-dashboard-prototype-production.up.railway.app
    ```

    Capture exit code + the full response headers (or timeout message).

    **Interpret the result:**
    - HTTP 403 / 404 / 530 / connection refused / timeout → **PASS** (CFA-11 satisfied). Railway is not exposing the service beyond the Cloudflare Tunnel.
    - HTTP 200 with actual app HTML → **FAIL** (CFA-11 not satisfied; GLBA-relevant hole). Escalate: the Railway Public Networking setting for `npr-dashboard-prototype` may be enabled when it should be "Private networking only" or similar. Surface this in the verification with a loud warning + do NOT mark the phase complete.
    - HTTP 302 redirect to Cloudflare Access login → **PASS** (the Tunnel is configured with a public endpoint that redirects through CF; still blocks direct origin traffic from reaching the app).

    Append to `00.5.1-VERIFICATION.md`:
    ```markdown
    ## Checkpoint 6 — CFA-11 direct-origin block verified

    - Date: <timestamp>
    - Command: `curl -I --max-time 10 https://npr-dashboard-prototype-production.up.railway.app`
    - HTTP status: <actual status code, or "timeout">
    - Response headers (redacted): <paste, redact any cf-ray or unique identifiers>
    - Outcome: PASS — direct origin returns <status>, no authenticated app content served
    - Closes P0.5 SC1 deferral (see P05-CLOSURE.md)
    ```

    Commit: `docs(00.5.1-03): VERIFICATION.md — CFA-11 direct-origin verified (P0.5 SC1 closed)`

    No operator input is required for this task — Claude runs `curl` directly and interprets the result. Advances to Task 3b after the VERIFICATION.md append + commit land.
  </action>
  <verify>
    <automated>test -f .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md; grep -c "Checkpoint 6" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md; grep -c "CFA-11" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `curl -I https://npr-dashboard-prototype-production.up.railway.app` response captured in VERIFICATION.md
    - Captured status is one of: 403, 404, 530, connection-refused, timeout, or CF-Access-redirect (NOT a bare 200 with app content)
    - `grep -c "Checkpoint 6" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "CFA-11" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "P05-CLOSURE" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1 (cross-ref to SC1 deferral)
    - Commit exists matching `^docs\(00\.5\.1-03\): VERIFICATION\.md — CFA-11 direct-origin verified`
  </acceptance_criteria>
  <done>CFA-11 autonomous verification complete; direct origin response captured + interpreted; P0.5 SC1 deferral closed; commit landed.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3b: CHECKPOINT — CFA-12 browser-observed avatar verification (operator required — browser session)</name>
  <files>.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/00.5-access-encryption/P05-CLOSURE.md SC3 section (the deferred item this closes)
    - components/app-header.tsx (confirm how avatar is rendered — what the fallback "CD" text would look like vs real identity)
    - lib/current-user.ts (the code path that reads JWT claims — reference it in the CFA-12 write-up)
    - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-CONTEXT.md §Verification of CFA-12
  </read_first>
  <what-automated>
    Claude cannot open a browser. The CFA-12 verification requires a live CF Access login via Google IdP + MFA, which is inherently a human-only interaction (no CLI/API substitute). This is why Task 3 from the original plan is split: Task 3a (CFA-11, fully autonomous curl) runs before this checkpoint; Task 3b (CFA-12, browser-observed) is the single remaining human-gated step for the phase.

    Claude will not proceed with any automation until the operator reports back from the browser session.
  </what-automated>
  <action>
    **WHY THIS IS HUMAN-GATED (checkpoint:human-action):** CFA-12 verification requires opening `https://portal.utstitle.com` in a browser, completing CF Access sign-in (Google IdP + MFA), and visually observing the `<AppHeader>` avatar rendered from verified JWT claims. Claude cannot open a browser, cannot complete MFA, and cannot take a screenshot. This is one of the rare truly-manual verifications that has no CLI/API substitute.

    **Operator instructions (paste-ready):**

    1. Open `https://portal.utstitle.com` in a fresh incognito / private window (to force a new CF Access session — no cached cookies).
    2. Complete CF Access sign-in:
       - CF Access login page → pick Google IdP
       - Google sign-in (use an account that has CF Access authorization, e.g., `mike@utstitle.com`)
       - Purpose justification (if prompted)
       - MFA challenge (TOTP / passkey / etc. if enrolled)
    3. After redirect, wait for the dashboard to load.
    4. Look at the `<AppHeader>` avatar in the top-right of the app.
    5. **Report back in chat with these three items:**
       - (a) The initials/name text shown in the `AppHeader` avatar (e.g., "MM", "Mike Miller", "mike@utstitle.com")
       - (b) The signed-in user's email (the Google account you used in step 2)
       - (c) Optional: a screenshot path / attachment, if feasible

    **Ambiguity guard:** If you sign in as Carrie Davis, the avatar "CD" is ambiguous with the fallback "CD" initials from the P0.5 era. Prefer signing in as Mike (or any non-Carrie user) for this verification so the fallback vs real-identity distinction is unambiguous.

    **Claude's action after operator reports avatar state:**

    1. **Validation logic:**
       - Parse the operator's reported avatar text (item a).
       - Parse the operator's reported email (item b).
       - Extract expected initials from the email / name: typically first letter of the local-part capitalized, or "FirstInitial LastInitial" if the Google profile has a full name.
       - Compare: does the reported avatar text match the signed-in user's identity?
         - Example PASS: signed-in email `mike@utstitle.com`, avatar "MM" (or "Mike Miller") → PASS (matches Mike).
         - Example FAIL: signed-in email `mike@utstitle.com`, avatar "CD" → FAIL (showing fallback/stale).
         - Example PASS: signed-in email `carrie@utstitle.com`, avatar "CD" → PASS IFF operator also confirms this was a conscious Carrie sign-in (else ambiguous — ask operator to retry with a non-Carrie user).
       - The avatar MUST reflect the signed-in user, NOT a hardcoded / stale initials fallback.

    2. If validation is FAIL (or ambiguous and no retry), run a quick diagnostic via the confirmed `pg` v8.20.0 path (NO psql fallback):
       ```bash
       railway run --service npr-dashboard-prototype -- node -e "
         const { Client } = require('pg');
         const c = new Client({ connectionString: process.env.DATABASE_URL });
         (async () => {
           await c.connect();
           const u = await c.query('SELECT id, email, name FROM users ORDER BY created_at');
           console.table(u.rows);
           await c.end();
         })();
       "
       ```
       Check whether the signed-in user's `users` row has a `name` populated. If NULL, `lib/current-user.ts` upsert didn't capture the name from the JWT — bug to file.

    3. Append to `00.5.1-VERIFICATION.md`:
       ```markdown
       ## Checkpoint 7 — CFA-12 avatar shows real identity (browser-observed)

       - Date: <timestamp>
       - Signed-in user email: <email>
       - Avatar displayed: <reported text/image from operator>
       - Expected avatar (derived from signed-in identity): <first initial + last initial or full name>
       - Match: YES (avatar = signed-in identity) / NO (avatar = fallback or mismatch)
       - Outcome: PASS (avatar matches signed-in user) OR FAIL (with root cause + users-table diagnostic)
       - lib/current-user.ts JWT-claim path confirmed: yes/no
       - users table row for this email: <populated / NULL / missing>
       - Closes P0.5 SC3 deferral (see P05-CLOSURE.md)
       ```

    4. Commit: `docs(00.5.1-03): VERIFICATION.md — CFA-12 avatar verified (P0.5 SC3 closed)`

    **If CFA-12 FAILs:** Capture the diagnostic output in VERIFICATION.md with "FAIL" outcome + create a follow-up note in STATE.md. Do NOT create a separate debug phase inline; file it for follow-up. The phase is mostly-complete; CFA-12 is the one open item to chase.
  </action>
  <resume-signal>Operator pastes avatar text + signed-in email in chat (optional: screenshot). On resume, Claude validates that the avatar matches the signed-in user's identity (not a fallback like "CD" for a non-Carrie user), appends Checkpoint 7 to VERIFICATION.md, and commits. Phase advances to success-criteria review after this commit.</resume-signal>
  <acceptance_criteria>
    - Operator has reported (a) avatar text + (b) signed-in email from a live `portal.utstitle.com` browser session
    - Claude's validation decision (PASS / FAIL with root cause) recorded in VERIFICATION.md Checkpoint 7
    - Avatar content matches the signed-in user's identity (PASS) OR FAIL is documented with users-table diagnostic output
    - If FAIL: follow-up note written to STATE.md (phase not marked complete until resolved or deferred with justification)
    - `grep -c "Checkpoint 7" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns 1
    - `grep -c "CFA-12" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 1
    - `grep -c "P05-CLOSURE" .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` returns at least 2 (one from Task 3a for SC1, one from Task 3b for SC3)
    - Commit exists matching `^docs\(00\.5\.1-03\): VERIFICATION\.md — CFA-12 avatar verified`
  </acceptance_criteria>
  <done>CFA-12 verified (avatar matches signed-in Google identity) OR failure root-caused + logged; P0.5 SC3 deferral closed; VERIFICATION.md complete; commit landed.</done>
</task>

</tasks>

<verification>
- `railway status --json --service npr-dashboard-prototype` → latest deployment status=SUCCESS
- `railway logs --service npr-dashboard-prototype | grep -i migrate` → at least one line showing migrations ran via prestart
- READ-ONLY schema-version check via `node -e` + `pg` → `drizzle.__drizzle_migrations` has 6 rows (0000..0005)
- ZERO `drizzle-kit migrate` / `npm run db:migrate` invocations targeted at prod from operator laptop (prestart-only policy)
- `railway run --service npr-dashboard-prototype -- node -e "const {Client}=require('pg'); ..."` readback → 8 rows in `tracks`, 25 rows in `stages` (NO psql fallback used)
- `curl -I https://npr-dashboard-prototype-production.up.railway.app` → NOT 200 with app content
- Operator-reported: browser at `https://portal.utstitle.com` shows real-identity avatar after CF Access login (CFA-12)
- `00.5.1-VERIFICATION.md` has 7 checkpoint sections (3 from Plan 02 + 4 from Plan 03: Ckpt 4 deploy, Ckpt 5 seed, Ckpt 6 CFA-11, Ckpt 7 CFA-12)
- `.planning/INITIAL_SEED_VERIFICATION.md` outcome = verified
- All 5 requirement IDs (CFA-11, CFA-12, DEPLOY-07, DEPLOY-08, DEPLOY-09) have observable evidence in VERIFICATION.md
</verification>

<success_criteria>
- [ ] `git push origin master` triggered a Railway deploy that reached status=SUCCESS (with 60s poll snapshots emitted during wait)
- [ ] Deploy logs show the prestart hook auto-applied all 6 migrations (0000..0005) before Next.js booted
- [ ] No Zod env validation errors in boot logs (all 4 new env vars resolved)
- [ ] READ-ONLY schema-version check (via `node -e` + `pg`, NOT `drizzle-kit migrate`) confirms `drizzle.__drizzle_migrations` has 6 entries
- [ ] `npm run db:seed` ran once against prod, exit 0, with readback (via `node -e` + `pg`, NOT `psql`) matching source seed files
- [ ] `.planning/INITIAL_SEED_VERIFICATION.md` filled in with outcome=verified
- [ ] `curl -I` against direct Railway origin returns 403/404/timeout (CFA-11 satisfied — Task 3a)
- [ ] Avatar at `portal.utstitle.com` shows real Google identity matching the signed-in user (CFA-12 satisfied — Task 3b) OR failure root-caused
- [ ] `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` contains Checkpoints 1-7 covering all 5 requirement IDs
- [ ] Phase 0.5.1 complete: any future phase can `git push origin master` and the deploy plumbing carries the weight
</success_criteria>

<output>
After completion, create `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-03-deploy-and-verify-SUMMARY.md`. Note in the summary:
- The git SHA that shipped (the first to land P1+P2 code in prod)
- Deploy duration (build + migrate + boot wall time) + total number of 60s poll snapshots emitted
- Final `railway status --json` snapshot of all three services
- Confirmation that migrations flowed exclusively through the container's `prestart` hook (no drizzle-kit invocation from operator laptop — prestart-only policy honored)
- Confirmation that all prod readback used `node -e` + `pg` v8.20.0 (no `psql` fallback)
- The outcome of CFA-12 specifically (this is the highest-chance-of-surprise verification — call out if avatar worked first try vs needed investigation)
- Any follow-up items (compliance debt, open P0.5 SC4 MFA restoration separate from this phase)
- Confirmation that every requirement ID (CFA-11, CFA-12, DEPLOY-07, DEPLOY-08, DEPLOY-09) has observable evidence tied to a specific checkpoint in 00.5.1-VERIFICATION.md
</output>
