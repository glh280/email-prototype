# Phase 0.5 — Cloudflare Access + Encryption Scaffolding — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Brainstormed from user-provided spec update ("AUDIT.md — Spec Update: Cloudflare Access + R2 + GLBA Alignment")

<domain>

## Phase Boundary

Replace the Auth.js + Google OAuth + allowlist auth model (landed in P0 but not yet deployed to production) with Cloudflare Access as the authentication layer. Deploy Cloudflare Tunnel so the Railway origin accepts zero public traffic. Scaffold column-level NPI encryption via `@47ng/cloak` and a non-skippable `npi_access_log` audit table. Stand up `.planning/VENDORS.md` as the vendor-management register.

End state:
- App lives at `portal.utstitle.com`, gated by Cloudflare Access with MFA
- Every server action verifies the Access JWT against Cloudflare JWKS before acting
- `lib/crypto.ts` is ready so any NPI column added in future phases is encrypted + audited automatically
- VENDORS.md lists all 6 vendors with PENDING status

Not in this phase: creating R2 buckets (P5 when documents feature lands), NPI redaction helper for Anthropic (P6), any actual NPI columns (no such column exists yet).

</domain>

<decisions>

## Implementation Decisions

### Scope
- **Portal is internal only.** Users: Mike, Carrie, Steff, + a bounded set of deal desk partners (Nick, Jais, Jamey, Corey, Peter, Nehemiah, Tinos, Keleisha, Edward, Jeremiah). Hard cap: ≤50 seats to stay on Cloudflare Zero Trust Free tier.
- **No client-facing login surfaces.** If borrower document intake is ever needed, handled via separate magic-link pages with time-limited pre-signed URLs (not this phase).

### Auth model
- **Cloudflare Access replaces Auth.js entirely.** Auth.js files removed, deps uninstalled, Auth.js-specific DB tables dropped (keep `users`).
- Access enforces auth at the network edge before the app runs. App validates the `Cf-Access-Jwt-Assertion` header via JWKS — never trusts the `Cf-Access-Authenticated-User-Email` header alone.
- **MFA required** in Access policy.
- **Session: 24 hours** (tighten later if needed).
- **Purpose justification enabled** — captures a stated purpose on every login, logged in Access audit.

### Subdomain
- **`portal.utstitle.com`** — decided in brainstorming.

### Gmail OAuth (separate from auth, for P4/P5 Gmail API)
- **Per-user OAuth** — each user consents once when they first open a Gmail-integrated feature. Not domain-wide Workspace delegation. Scopes: `gmail.readonly` + `gmail.send` only. Env vars renamed `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` to disambiguate from the removed auth OAuth.

### Tunnel host
- **Cloudflare Tunnel runs as a sidecar service on Railway** — same project as the web app, connected via private networking. Single-vendor compute (Railway), single-vendor auth/edge (Cloudflare).

### Encryption library + key custody
- Library: **`@47ng/cloak`** — application-layer encryption, portable, no DB extension required.
- Master key: **Railway env var `ENCRYPTION_KEY`**, 32-byte base64-encoded. Cloudflare Secrets was considered but is a Workers-only feature, not reachable from a Railway-hosted Next.js app.
- **1Password backup** of the current key for disaster recovery — if the Railway env is wiped, the key is not lost.
- **Key rotation via dual-key read window** (`@47ng/cloak`'s multi-key mode): new encryptions use key v2 while decryptions accept v1 or v2, then v1 is retired after all columns are re-encrypted.

### Audit layers
Three layers in the architecture:
1. **App mutation audit** — `recordChange()` → `change_history` (already in prototype; P2 wires to DB) — **authoritative for GLBA**
2. **NPI read audit** — wrapped `decrypt()` → `npi_access_log` (new table added in P0.5) — **authoritative for GLBA**
3. **Cloudflare Access dashboard logs** — retained per Cloudflare Free tier window (~6 hours of detail). **Supplementary only**, not authoritative. *V2 backlog: daily cron polling the CF Access API to archive logs to R2 for long-term retention — post-MVP, not in P0.5.*

**Note:** Access Logpush was initially planned but requires Cloudflare Enterprise plan, not Free tier. Dropped from P0.5 scope; layers 1 and 2 carry the compliance load.

### Revert strategy
- **Forward-commit revert.** New commits remove Auth.js. History preserves the exploration. No force-push, no rebase. Seven P0 Auth.js commits (fc8da45 through 14b902c) stay in history; P0.5 commits undo them cleanly.

### Rollback plan
If Access wiring breaks and users are locked out:
- Cloudflare dashboard → Access app → temporarily disable policy (emergency bypass, ~30s)
- OR Railway → pause `cloudflared` sidecar → app becomes unreachable from outside (safer than public anon)
- Existing prototype URL `npr-dashboard-prototype-production.up.railway.app` stays up during P0.5 as Carrie's ongoing feedback surface.

### Prototype URL handling
- **Leave public until P0.5 finishes, then retire.** Rev 5 prototype keeps running at the current Railway URL during P0.5 build. Once Access is live at `portal.utstitle.com`, the prototype URL is either deleted or redirected. Zero disruption to Carrie's feedback loop.

### VENDORS.md scope
- **Scaffold only.** One row per vendor (Cloudflare, Railway, Google, Anthropic, ClickUp, GHL). Lists data touched, agreement type, status PENDING. Mike fills in DPA details. Annual review cadence documented.

### Deferred to later phases (tracked as REQ-IDs, not dropped)
- R2 bucket provisioning → P5 (no document feature until then)
- NPI redaction helper (`lib/anthropic.ts::redactNPI()`) → P6 (no Anthropic calls until then)
- `ssn_last4` blind-indexing column → added when an `ssn` column first appears
- Document retention lifecycle rules → deferred to GLBA program finalization

</decisions>

<code_context>

## Existing Code Insights

### Reusable assets
- `lib/env.ts` (Zod env validation) — keep, modify env list
- `lib/db.ts` (Drizzle client) — keep as-is
- `db/schema.ts` (users + Auth.js tables) — keep `users`, drop `accounts`/`sessions`/`verification_tokens`
- Playwright smoke test harness — keep, revise assertions for Access-gated routes
- Vitest config — keep as-is

### Established patterns
- `lib/allowlist.ts` was split from `lib/auth.ts` specifically so it could be unit-tested in Node runtime without dragging next-auth/Next.js internals. That separation pattern is applied again for `lib/access.ts` (JWT validation is pure and testable) vs. any eventual server-action glue.
- Every external call is wrapped with timeout + error boundary (documented in AUDIT.md §1).
- Forward-commit (no force-push) discipline established in prototype development.

### Integration points
- `proxy.ts` (formerly `middleware.ts`) is the gatekeeper — all requests pass through it. Revise to enforce Access JWT presence and validity.
- `components/app-header.tsx` reads session user — revise to read from Access context instead.
- `app/(auth)/sign-in/page.tsx` — **delete.** Cloudflare Access hosts the login flow; no app-side login page needed.
- `app/api/auth/[...nextauth]/route.ts` — **delete.** Auth.js route handler no longer needed.

</code_context>

<specifics>

## Specific Ideas

- Access JWT validation uses the `jose` library (already pulled transitively by next-auth; will stay in the dep tree for this purpose after Auth.js removal — confirm in implementation).
- `lib/access.ts::getCurrentUser()` must:
  1. Read `Cf-Access-Jwt-Assertion` header (missing → 401 via `proxy.ts`)
  2. Fetch Cloudflare JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (cache for 24h)
  3. Verify signature, `aud` claim, `iss` claim
  4. Extract email from **verified claims** — never from the raw header
  5. Upsert `users` row by email, return user record
- `lib/crypto.ts::decrypt()` must insert into `npi_access_log` on every call — unit test enforces this invariant (spy on DB insert during decrypt, fail if no insert)
- Test that an Access JWT with a tampered email claim is rejected (signature check catches this — verify explicitly)

</specifics>

<deferred>

## Deferred Ideas

- R2 bucket provisioning (P5 when documents feature exists)
- `lib/anthropic.ts::redactNPI()` helper (P6 when Anthropic integration exists)
- `ssn_last4` blind-index column (when an `ssn` column is first added)
- Document retention lifecycle rules (blocked on GLBA program finalization)
- `purchase_price` encryption decision (revisit at P1 review)
- Formal incident response plan (separate document, not in this repo)
- Workspace domain-wide Gmail delegation (alternative to per-user OAuth, revisit if we ever move onto Google Workspace)

</deferred>
