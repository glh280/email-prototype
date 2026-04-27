---
created: 2026-04-18T22:50:00.000Z
title: Playwright UAT against CF-Access-gated prod is blocked — both service token + cookie replay paths rejected
area: tests
files:
  - playwright.uat.config.ts (harness scaffolding — cookie-injection approach committed)
  - tests/e2e/uat/p1-uat.spec.ts (5 evidence-capture tests, currently non-runnable against prod)
  - lib/access.ts (service-identity support code shipped in `98e6b15` — remains useful for future service-token setups)
  - .planning/phases/01-core-data-model/01-HUMAN-UAT.md (Test 3 marked blocked)
---

## Problem

Automated UAT against `portal.utstitle.com` (CF Access gated) could not be stood up today despite building the full Playwright harness. Two auth approaches were attempted; both blocked at the Cloudflare Access layer.

### Path A — Service Token (CF Access Service Auth policy)

- Service token created + stored as `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` in `.env.local`
- `lib/access.ts` extended to support service-identity JWTs (common_name claim, no email) — synthesized `service:{common_name}@cf-access` email. Shipped in commit `98e6b15`. 174/174 tests pass.
- Playwright `extraHTTPHeaders` sent the token on every request
- **Blocker:** CF Access returns 302 → Google OAuth with meta JWT showing `service_token_status: false` despite operator adding a policy with "Service Auth" action. Diagnosis indeterminate — could be policy binding not truly Service Auth, token not in include rule, or policy attached to wrong application.

### Path B — Cookie injection (session-cookie replay)

- Operator signed into `portal.utstitle.com` in live browser, copied `CF_Authorization` JWT cookie value, pasted into `.env.local` as `CF_AUTHORIZATION_COOKIE`
- `playwright.uat.config.ts` + `tests/e2e/uat/p1-uat.spec.ts` updated to inject cookie via `context.addCookies()` in `beforeEach` hook (Domain=portal.utstitle.com, HttpOnly, Secure, SameSite=Lax)
- **Blocker:** CF Access returns 302 → Google OAuth with meta JWT showing `auth_status: "NONE"`. Same behavior via direct curl with matching Edge User-Agent. Cookie is structurally valid (proper JWT, unexpired, correct aud/iss/email) but CF treats it as a dead session.
- **Likely root cause of Path B block:** operator's session was invalidated by testing the CFA-06 sign-out fix earlier in the same session. CF Access's `/cdn-cgi/access/logout` endpoint clears server-side session state in addition to cookies — any cookie copied from that session becomes server-side-invalid even though it still parses as a valid JWT client-side. *Our working sign-out fix is literally what's blocking the replay — not a bug.*

## Why "no more debugging" was the right operator call

Both paths hit CF-side behavior we can't change from our side:
- Path A: CF's policy-binding UI is subtle; "Service Auth" vs "Allow + Service Token Include" is a distinction that isn't obvious and consumed multiple rounds to diagnose
- Path B: CF's session-replay rejection is **security-correct** — a session cookie that was signed out SHOULD be invalidated server-side. Our own code enforces this correctly.

Continued iteration would be operator dashboard work + cookie-refresh cycles, not productive development.

## Solution approaches (future, NOT for today)

Ranked by structural robustness:

### Option 1 — Playwright storageState with full browser cookie dump

- Operator uses a browser extension (e.g. EditThisCookie, Cookie Editor) to export ALL cookies for `portal.utstitle.com` + `glh280.cloudflareaccess.com` as a JSON file
- Save to `.playwright-uat/storage-state.json` (gitignored)
- Playwright uses `storageState: '.playwright-uat/storage-state.json'` in config
- Brings BOTH `CF_Authorization` AND `CF_AppSession` AND team-domain cookies in one shot — the paired state CF expects
- **Cost:** operator-driven cookie refresh ~daily
- **Cleanest path to quick UAT evidence**

### Option 2 — `mcp__Claude_in_Chrome__*` to drive operator's real Chrome

- Operator installs Claude in Chrome extension + grants permission
- Claude drives operator's live (signed-in) browser session directly — no cookie replay needed
- **Cost:** extension install + per-session attachment
- **Benefit:** no storage state to refresh; uses whatever session is live

### Option 3 — Re-attempt service token with explicit Service Auth policy dashboard walkthrough

- Requires operator to step through CF Zero Trust Access → Applications → NPR Dashboard → Policies tab with screen share or documented screenshots
- Needs verification that policy Action column literally shows "Service Auth", NOT "Allow"
- **Cost:** ~20 min of operator + Claude co-debugging
- **Benefit:** headless, long-lived, CI-compatible once working

### Option 4 — Accept manual UAT as the P1+P2 validation model

- Operator manually clicks through UAT items in their browser (~5-10 min per phase)
- Captures screenshots if needed
- Records findings in `*-HUMAN-UAT.md` directly
- **Cost:** operator time per phase
- **Benefit:** zero setup; works immediately

## Revisit triggers

- Phase 3 UAT is ready (needs same harness if automating)
- CFA-06 regression suspected (Cache-Control or logout-URL regression would warrant automated verification)
- Compliance docs require automated E2E evidence for audit trail
- Operator requests automated UAT for a specific regression concern

## What's committed and usable today

- `lib/access.ts` service-identity support (keep — useful once Option 3 works)
- `playwright.uat.config.ts` + `tests/e2e/uat/p1-uat.spec.ts` harness (keep — full cookie-injection scaffold ready for Option 1)
- `npm run test:uat` script (keep — wired up, just needs working auth path)
- `lib/access.ts` + `tests/unit/access.test.ts` — 4 new unit tests for service-identity JWT handling (all passing, independent of this blocker)

## What's NOT committed (by design)

- The actual cookie value operator pasted (in `.env.local`, gitignored, now invalidated anyway since session died)
- The service token credentials (also in `.env.local`, gitignored)

## Cross-reference

- CFA-06 resolution: `.planning/debug/2026-04-18-signout-does-not-clear-session-resolved.md` (the sign-out fix that ironically blocks Path B replay)
- Service token investigation notes: captured inline in CLI probes during this session — NOT written to a debug file since outcome was "stop debugging per operator direction"
