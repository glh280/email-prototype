# DEPLOY.md — Production Deploy Runbook

**Owner:** Mike Miller
**Last updated:** 2026-04-19 (§6 Recovery Runbook now includes 7 scenarios A-G: Custom Start Command incident, ClickUp import rollback, operator probes in prod, DATABASE_URL rotation, prestart migration failure, sql<Date> CTE bug, CF Access policy on wrong app; `railway.json` landed as config-as-code lock)
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
- Check `users` table: `railway ssh --service npr-dashboard-prototype npm run db:users:find` (lists all users). Filter by email with `-- --email somebody@example.com`. See §6 Scenario C for why `railway run -- node -e "pg..."` does not work (private-network hostname unreachable from laptop).
- Inspect tunnel logs for the JWT claims: `railway logs --service tunnel | grep -i jwt`

---

## 6. Recovery Runbook

Things that went wrong, how to un-break them, and what now prevents recurrence. Read top-down when production is misbehaving — the first matching scenario is the one to execute.

### Principles

1. **Code over UI.** Any config change that isn't in git drifts. `railway.json` is the source of truth for deploy config (startCommand, restartPolicy, builder). Dashboard Settings can be edited — they just don't take effect on next deploy.
2. **CLI over laptop-to-prod connections.** `railway run` executes locally and can't reach the Postgres private hostname `postgres.railway.internal`. Operator DB probes + one-shot scripts go through `railway ssh --service npr-dashboard-prototype npm run <verb>` — that executes *inside* the container where private DNS resolves.
3. **Dry-run before apply.** Every write-path script ships with `--dry-run` as the default and `--apply` as the explicit opt-in. Dry-runs against prod are safe and informative — they surface data-shape surprises before any write.
4. **Audit-first rollback.** `deals.source = "clickup_import"` (or similar provenance tags) in `audit_log.after_json` is how we identify rows to rollback or patch. Don't delete rows without an audit query confirming provenance first.

### Scenario A — Custom Start Command saved to Settings by mistake (2026-04-19 incident)

**Symptom:** Container may crash-loop on next restart; portal returns 503 or stays in "waking up" mode.

**Root cause:** Railway's **Settings → Deploy → Custom Start Command** field is a PERSISTENT CONFIG, not a one-shot execution. Saving anything there makes Railway run that value instead of `npm start` on every container boot.

**Prevention (now in place):** `railway.json` at repo root pins `deploy.startCommand: "npm start"`. Config-as-code overrides dashboard Settings on every deploy. Dashboard UI may still be edited but has no effect after next push.

**Recovery (if this happens again):**

1. **Assess blast radius.** `railway status --json --service npr-dashboard-prototype` → read `latestDeployment.meta.serviceManifest.deploy.startCommand`. If it equals `"npm start"` or is `null`, no action needed. If it's anything else, proceed.
2. **Clear the UI field.** Railway dashboard → service → Settings → Deploy → Custom Start Command → delete text → Save. This stops bleeding.
3. **Push railway.json if not already present.** `railway.json` with `deploy.startCommand: "npm start"` reinstates the correct command on next deploy automatically.
4. **Trigger a redeploy.** `git commit --allow-empty -m "chore: force redeploy after start-command incident" && git push origin master` — a no-op commit is the safest way to pick up railway.json's override.
5. **Verify.** `railway status --json` → commit hash matches HEAD, status SUCCESS, `startCommand` is `"npm start"` or null.

### Scenario B — ClickUp (or any external-source) import landed with wrong data shape

**Symptom:** Imported rows have wrong field values; `file_no`, `track_code`, or contact mappings don't match source.

**Recovery approach:** Audit-driven patch, not delete-and-retry. Deletes lose audit history; patches preserve it.

1. **Confirm provenance exists.** `railway ssh --service npr-dashboard-prototype npm run db:deals:inspect -- --source clickup_import --limit 50` — look for rows tagged with the import source. Their `after_json.clickup_*` fields hold the original source values.
2. **Write a patch script** following the shape of `db/seed/clickup-patch-file-no.ts`:
   - Read audit rows by source tag
   - Compare captured source value to current deal state
   - UPDATE the row + write a follow-on audit row documenting the rename
   - Dry-run by default; `--apply` to write
3. **Dry-run against prod:** `railway ssh --service npr-dashboard-prototype npm run db:patch:<verb>` — confirms patch count + collision safety before any writes.
4. **Apply:** same command with `-- --apply` appended.
5. **Verify:** `npm run db:deals:inspect` again to confirm target state.

### Scenario C — Operator probe / debugging in prod

**Goal:** Read prod DB state without risking writes, without exposing Postgres publicly, without running commands via the Railway dashboard UI.

**Pattern:** `railway ssh --service npr-dashboard-prototype npm run <verb>` where `<verb>` is a committed npm script in the repo.

Do NOT use:
- `railway run -- node -e "..."` — **does not work**. `railway run` executes locally with env injected; the Postgres private hostname is unreachable from a laptop. (DEPLOY.md historically suggested this; it was never actually working in the current network topology.)
- Inline `node -e "..."` over `railway ssh` — Node enters interactive REPL mode when stdin is a TTY. Shell-quoting complex scripts is fragile; always commit a small npm script instead.
- Dashboard Settings → any command-like field for one-shot execution. See Scenario A.

**Available probe scripts** (expand as needed):
- `npm run db:users:find -- --email foo@bar.com` — look up a user by email (case-insensitive); lists all if not found
- `npm run db:deals:inspect` — count + sample recent deals; `--source <tag>` filters audit rows by provenance; `--limit N` adjusts sample

### Scenario D — Stale connection errors after Railway variable edits

**Symptom:** App fails to connect to Postgres shortly after a variable change in Railway dashboard; logs show connection refused or authentication failure.

**Root cause:** Railway rotates DATABASE_URL on password changes. App containers cache the connection pool until restart.

**Recovery:**
1. Confirm current var: `railway variables --service npr-dashboard-prototype | grep DATABASE_URL` (redacted output — you're just confirming it's set)
2. Trigger app container restart: `git commit --allow-empty -m "chore: restart after db creds rotation" && git push origin master`
3. Verify: `railway logs --service npr-dashboard-prototype | tail -20` — look for clean `Ready in <N>ms` without connection errors

**Prevention:** `DATABASE_URL` in env is already a reference to `${{Postgres.DATABASE_URL}}` — rotations propagate automatically. Manual edits to DATABASE_URL should be rare. If forced, follow recovery above.

### Scenario F — Latent bug unmasked by first real-data population (sql<Date> CTE)

**Incident:** 2026-04-19. Immediately after the first ClickUp import populated the previously-empty `deals` table on prod, portal.utstitle.com started returning `TypeError: a.getTime is not a function` on `/`. The app had been green all day against the empty database.

**Root cause:** `lib/deals-query.ts` line ~61 used `sql<Date>` as a Drizzle TypeScript annotation around `max(audit_log.created_at)` inside a CTE. `sql<T>` is a **compile-time-only** annotation — Drizzle does not coerce the result at runtime. pg's automatic OID-based type parsing threads reliably through direct column plucks (like `deals.updated_at`) but does NOT always thread through CTE wrappers. When the CTE returned rows, `activityAt` came back as an ISO string, and downstream `relativeTime(d)` called `.getTime()` on it, throwing.

**Why tests didn't catch it:** All 298 unit tests passed. None of them exercised the list-query against a populated DB *and* rendered the result. The coverage gap was at the integration layer — the unit tests trusted Drizzle's type annotations at runtime, when they should have asserted `instanceof Date`.

**Fix:** Commit `6b9adfb` — map-time coercion at the query boundary:
```ts
return rows.map((row) => ({
  ...row,
  activityAt: row.activityAt instanceof Date
    ? row.activityAt
    : new Date(row.activityAt as unknown as string),
  // same for closingAt, fundingAt
})) as DealListRow[];
```

**Recovery sequence executed:**

1. `npm run db:rollback:clickup-import -- --apply` (audit-provenance-scoped delete; preserved manually-created rows)
2. Root-cause diagnosis by reading `lib/deals-query.ts` — the `sql<Date>` signature was the tell
3. Fix committed, pushed (commit `6b9adfb`), Railway built + deployed
4. Re-ran import, re-ran file_no patch, verified via `npm run smoke:query` (17/17 Date instances, 0 relativeTime throws)

**Prevention — how to not fall into this class of bug again:**

- **Treat `sql<T>` as a claim, not a guarantee.** Whenever you use `sql<Date>`, `sql<number>`, or any other typed SQL template, add a runtime coerce at the map boundary. The TypeScript generic is lying to you any time the value flows through a CTE, a coalesce, a cast, or any Drizzle wrapper that doesn't know the Postgres column's OID.
- **Populated-state integration tests.** For every SSR page that renders DB data, write at least one test that populates the DB and exercises the real query function. The unit-level tests verifying the CTE structure are not sufficient.
- **Visual regression baseline before production populates.** See `.planning/todos/pending/2026-04-19-visual-regression-baseline-before-p4.md` — this incident would have been caught in seconds by a rendered-page diff.

**Verification scripts added from this incident:**
- `npm run smoke:query` — directly invokes `queryDeals()` against prod, asserts Date types on all rows
- `npm run db:deals:inspect` — counts deals + samples recent rows with source tag
- `npm run db:rollback:clickup-import` — audit-driven bulk delete by provenance
- `npm run db:patch:clickup-file-no` — corrective UPDATE driven by audit provenance
- `npm run smoke:home` — in-container probe of SSR dispatch (localhost:3000 from the Railway app)

### Scenario G — CF Access policy on the wrong application

**Incident:** 2026-04-19 evening. Attempting to run Playwright UAT against prod via CF Access service token, requests returned 302 redirects to Google SSO instead of 200. CF's `service_token_status` JWT claim was `false` and `common_name` was empty — classic "token not recognized" signature. Access authentication logs showed **zero entries** for the probe requests despite hundreds of decisions-per-hour normally.

**Root cause:** The "Playwright UAT" service-auth policy was saved, correctly scoped to include the Playwright UAT service token, and visibly present in the Zero Trust dashboard's policy listing — but it was attached to a **different Access application** than the one protecting `portal.utstitle.com`. CF evaluates policies per-application; the portal.utstitle.com app had no service-auth policy of its own, so service-token requests fell through to the default Google-SSO identity provider, which rejected them.

**Diagnostic journey (preserved for future debugging):**

1. Decoded the 302 redirect's `meta` JWT payload via `npm run diag:cf-access` — surfaced `service_token_status: false`, `common_name: ""`, `auth_status: "NONE"`
2. Initial hypothesis: token not authenticated. Eliminated via dashboard inspection (Client IDs matched between `.env.local` and the Service Tokens list)
3. Second hypothesis: app-level "Accept service tokens" toggle off. Eliminated via Cloudflare docs — modern CF Access has no such toggle; a Service Auth policy alone is sufficient
4. Looked at **Access authentication logs** — zero entries for today's probes. This was the decisive finding. If CF had rejected the token, there'd be "access denied" entries. No entries at all meant CF never considered the request as a service-token login attempt.
5. Final hypothesis: policy on the wrong application. Confirmed when operator inspected the NPR Dashboard app's Policies tab directly — no Playwright UAT policy there. Policy was on a separate application.

**Fix:** Operator moved the Playwright UAT service-auth policy to the NPR Dashboard Access application. Subsequent requests returned HTTP 200 with valid content; both post-import smoke tests passed.

**Prevention / principles:**

- **Access authentication logs are the authoritative source** when debugging "CF Access blocked my request." Zero entries = "CF never considered this a login attempt" = usually means the policy isn't on the application you think it is. Denied entries with explicit reasons = "CF tried to authenticate and something rejected it" = real policy-level issue.
- **Service tokens authenticate AGAINST a specific Access application, not globally.** A token listed in "Service Tokens" exists at the account level, but it only grants access to applications whose policies explicitly include it. "I created a service token" and "the service token is allowed somewhere" are different states.
- **Duplicate apps with overlapping hostnames are easy to create and easy to lose track of.** If a project has multiple Access applications, audit which one gates which hostname before debugging policies.

**Diagnostic scripts added from this incident:**
- `npm run diag:cf-access` — decodes CF Access 302 redirects and surfaces the rejection JWT's reasoning fields. Does NOT itself fix anything; it removes ambiguity so the right fix is obvious.

### Scenario E — Migration failed in prestart

**Symptom:** New deploy never reports "Ready"; `railway logs` shows Drizzle error from prestart migration step; Railway keeps old deployment running (correct behavior).

**Recovery:**
1. **Read the error.** `railway logs --service npr-dashboard-prototype --deployment | grep -A 20 migrate` — Drizzle usually prints the failing SQL statement.
2. **Assess:** is the migration logically broken (bad SQL), or is it a data-shape conflict (existing row violates a new constraint)?
3. **For logical bugs:** fix the migration SQL in a new commit. Push. The prestart will re-attempt on next deploy. Do NOT edit the migration file in place — write a forward-compensating migration (add a new migration that fixes what the broken one did).
4. **For data-shape conflicts:** the migration is telling you prod data doesn't match your schema's assumption. Write a data cleanup migration BEFORE the constraint migration in the sequence.
5. **Never run `drizzle-kit migrate` from a laptop against prod** — see §1 Migration Policy. Migrations flow through prestart exclusively.

---

## 7. Compliance Notes

- **Postgres tier:** Railway Hobby (~$5/mo, weekly snapshots, ~100 max connections, stays inside Railway private network). Locked 2026-04-18 per STATE.md Key Decisions. PII protection comes from column-level encryption + CF Access + audit log, NOT from Postgres tier.
- **Single environment:** No staging (locked per CONTEXT §Staging Environment). Pre-prod surfaces = docker-compose + 170 unit tests + tsc + build + db:migrate against local DB.
- **Audit layers (P0.5 lock):** Layer 1 = `audit_log` table (every mutation), Layer 2 = `npi_access_log` (every decrypt), Layer 3 = CF Access dashboard logs (~6h on Free tier, supplementary). Logpush dropped (Enterprise-only).

---

*This runbook is living. Update at every phase transition where deploy posture changes.*
