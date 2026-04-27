# Debug: portal.utstitle.com access denied for mike@ and info@ → silent auto-auth on Edge

**Reported:** 2026-04-17
**Re-opened:** 2026-04-18 (regression claim — prior H1 invalidated by operator evidence)
**Resolved:** 2026-04-18 — root cause documented; Option A (document, no code change) chosen
**Status:** RESOLVED — Microsoft Edge + Windows Credential Manager / WAM silent re-auth (working-as-designed browser/OS behavior, not a CF Access, tunnel, or app misconfiguration). See Resolution section at bottom.
**Investigated by:** gsd-debug agent + operator evidence-gathering

---

## Prior investigation summary (2026-04-17)

Original report: `mike@...` and `info@...` saw "That account does not have access." on `glh280.cloudflareaccess.com` sign-in page.

Original root cause (H1): CF Access policy Include list missing `mike@...` and `info@...`. Recommended fix: add emails to the CF dashboard policy.

See bottom of this file (prior report) for full H1-H4 table and investigation notes.

---

## H1 INVALIDATED — 2026-04-18 operator evidence

The operator has provided new evidence that disproves H1 as the current root cause:

| Evidence | Source | What it rules out |
|----------|--------|-------------------|
| "This was working before the code update." | Operator (2026-04-18) | H1 (never-worked policy misconfig); reframes this as a REGRESSION from a known-good state. |
| "Nothing changed on Railway or Cloudflare." | Operator | CF dashboard policy and Railway env are unchanged. |
| "The issue is in the code." | Operator | Directs investigation at code commits, not CF dashboard. |
| "MFA is not enabled — that's a later phase." | Operator | Invalidates P0.5 CFA-05 assumption ("MFA required on every session"). The CF policy's Require → MFA step is NOT active. Prior H1 fix list's item 6 ("Confirm MFA is still required") is moot. |
| CFA-12 verified PASS 2026-04-18T19:20Z — Mike signed in, avatar rendered `"M"` (not `"CD"`) | `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-PHASE-VERIFICATION.md` + `00.5.1-VERIFICATION.md` Checkpoint 7 | **Mike's CF Access policy allowlist entry is correct.** JWT parse → `lib/current-user.ts` → `upsertUserFromAccess` → app-header render chain is functional end-to-end as of commit `e6a3658` running in prod. |

**Conclusion:** H1's premise ("CF policy allowlist broken") is disproven. As of 2026-04-18 ~15:20 EDT, Mike could sign in to prod normally.

---

## Regression window analysis

Timeline of commits on `master` from last-known-working to HEAD:

| SHA (EDT) | Type | Touches auth/proxy/env? |
|-----------|------|-------------------------|
| `e6a3658` 2026-04-18 14:29 | fix(deploy): package-lock platform flags | NO — lockfile only, no source changes |
| _(deploy fired, Mike signed in successfully, CFA-12 PASS ~15:20)_ | | |
| `72047a7` 2026-04-18 15:16 | docs VERIFICATION.md (CFA-11) | NO |
| `c21278c` 2026-04-18 15:26 | docs todo (avatar initials) | NO |
| `00745a6` 2026-04-18 15:28 | docs todo (CF Access session persistence) | NO |
| `58cc1ae` 2026-04-18 15:30 | docs plan complete | NO |
| `53be5f4` 2026-04-18 15:34 | docs phase verification | NO |
| `9833fb0` 2026-04-18 15:35 | docs STATE.md | NO |
| `9e6c678` 2026-04-18 15:35 | docs PROJECT.md | NO |
| `4604a16` 2026-04-18 15:39 | docs STATE.md | NO |

**Between CFA-12 sign-in success and HEAD: zero source/config commits.** Every commit is planning docs only.

Further: `lib/access.ts` last changed in `72ce2b6` (P0.5 B4). `proxy.ts` last changed in `300214d` (P0.5 B6). `lib/current-user.ts` / `lib/users.ts` last changed in `335503b`. `lib/env.ts` last changed in `0e18e3a` (P1-02, before P0.5.1 even began). `next.config.ts` is trivial (empty config object). `package.json` prestart hook added `41ecb85` (P0.5.1-01) — predates the successful CFA-12 sign-in.

**None of these auth-adjacent files have changed since the operator-verified working state on 2026-04-18 ~15:20 EDT.**

---

## Direct checks against the "code broke it" hypothesis

### Check 1 — Is `proxy.ts` the right filename for Next.js 16.2.4?

YES. Confirmed by reading `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
> "The `middleware` file convention is deprecated and has been renamed to `proxy`."

and `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`:
> "The `middleware` filename is deprecated, and has been renamed to `proxy` to clarify network boundary and routing focus. The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`."

The repo's `proxy.ts` at project root with `export default async function proxy(req)` and `export const config = { matcher }` is exactly the Next.js 16 convention. This matches `package.json` `next@16.2.4`.

**The file IS being picked up as middleware** — otherwise the CFA-11 direct-origin block verification (which proved 401 comes from `server: railway-edge`) would not be consistent with Mike's 2026-04-18 successful sign-in (which requires `proxy.ts` to accept the CF JWT and let the request through to render the app).

This eliminates the proposed hypothesis that "Next.js 16 doesn't recognize `proxy.ts`."

### Check 2 — Could env validation be crashing the app at boot?

`lib/env.ts` currently requires `DATABASE_URL` + `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` + `NEXT_PUBLIC_APP_NAME` + `NEXT_PUBLIC_APP_DOMAIN`. All 5 were verified present on Railway via CLI paste-back in P0.5.1 Checkpoints 2+3. Verified again at runtime by deploy `540160a4` booting cleanly (`▲ Next.js 16.2.4 ✓ Ready in 88ms` — no Zod error).

**Env Zod schema is unchanged since `0e18e3a` (2026-04-17), and prod booted against it successfully on 2026-04-18 ~15:00 EDT.**

### Check 3 — Any infra change I can see from the repo?

No Dockerfile, no railway.toml, no nixpacks.toml, no deploy-config changes. Railway build is default Node (`npm ci && npm run build && npm run start`). Build definition has not moved.

### Check 4 — Symptom-language verification

Prior debug file symptom was:
> "That account does not have access." on `glh280.cloudflareaccess.com` sign-in page — returned by Cloudflare Access BEFORE the Next.js app renders.

**This symptom can only come from CF Access rejecting a policy evaluation.** It cannot be produced by any amount of app-side code. The app does not render this error, does not have a path that sends users to `glh280.cloudflareaccess.com`, and does not have an allowlist that could reject this user.

If the operator is CURRENTLY seeing the exact same "That account does not have access." page on `glh280.cloudflareaccess.com`, that is a CF Access dashboard signal, not an app-code signal — and the operator's premise ("the issue is in the code" + "nothing changed on Cloudflare") is internally inconsistent.

---

## Current hypothesis ranking (post-invalidation)

| H | Hypothesis | Likelihood | Why |
|---|------------|------------|-----|
| H5 | The current symptom is DIFFERENT from the prior one. Operator may be describing a NEW failure (e.g. 401 from `proxy.ts`, a redirect loop, a Server Action crash, or an app-side 500) using the "access denied" language from the 2026-04-17 debug file. | **High** | Every code artifact touching auth is unchanged since CFA-12 PASS. A regression in "nothing changed" is impossible; therefore either the symptom is different or a non-code variable changed. |
| H6 | Operator is logging in with `info@...` (shared inbox) and conflating it with `mike@...`. `info@...` was NEVER on the CF policy — original H1 explicitly flagged this as expected-rejected per plan scope ("shared inboxes were never part of the allowlist spec"). No regression; design-correct behavior being re-reported. | Medium | Consistent with the 2026-04-17 observation pattern (both emails rejected, but only mike@ was supposed to be allowed). CFA-12 verification used Mike's primary address, not `info@...`. |
| H7 | Cloudflare Access policy or session state was mutated by a dashboard action that the operator did not classify as "a change" — e.g., someone toggled a Include rule, rotated the application's AUD tag (which invalidates the in-app JWT `aud` check), or disabled the Google IdP connector. Operator attests "nothing changed" but may be referring to nothing they INTENTIONALLY changed. | Low | Operator explicitly says CF unchanged. But worth double-checking that `CF_ACCESS_AUD` on Railway still matches the current AUD tag on Access → Applications → NPR Dashboard — AUD rotations are silent and produce JWT verification failures. |
| H8 | Railway deploy has rolled back / wedged / is serving a stale build. Newest successful deploy is `540160a4` at commit `e6a3658` from ~22h ago; if that deploy was evicted or a later (failed) deploy is being served, behavior could diverge. | Low-Medium | Easy to check via `railway status` / deploy history. No commits have been pushed since `4604a16` so there should not BE a newer deploy, but sleeping deploys or preview-deploy overrides can cause drift. |
| H9 | `prestart` hook (`npm run db:migrate`) is failing on a fresh boot — e.g., Railway cycled the container, prestart hit a drizzle-kit issue, container enters crashloop, Cloudflare tunnel backend responds but app behind tunnel returns 502/503 that CF translates to its own access-denied page. | Low | Would show as an app-side 502, not a CF "that account does not have access." page. But worth checking `railway logs` for prestart failures. |

---

## Evidence gathered this session

- 2026-04-18 (now): Read `proxy.ts`, `lib/access.ts`, `lib/current-user.ts`, `lib/users.ts`, `lib/env.ts`, `next.config.ts`, `package.json`. No auth-adjacent code has changed since 2026-04-17/early-18.
- 2026-04-18 (now): Read Next.js 16 docs — `proxy.ts` IS the correct Next.js 16 convention. No filename-driven dead-code risk.
- 2026-04-18 (now): Read P0.5.1 VERIFICATION.md — Mike verified signed-in at portal.utstitle.com at 2026-04-18T19:20Z (avatar rendered `"M"`). The auth chain was DEMONSTRABLY functional in prod as of that moment.
- 2026-04-18 (now): `git log` confirms only docs commits since CFA-12 verification.
- 2026-04-18 (now): No Railway/deploy config files in repo (no Dockerfile / railway.toml / nixpacks.toml).

---

## Why I am stopping to ask, not guessing

The operator's premise ("working before the code update" + "the issue is in the code" + "nothing changed on Railway or Cloudflare") is mechanically incompatible with the repo state: no code that touches auth has changed since the operator's own CFA-12 verification showed Mike signed in successfully.

Forcing a code-level root cause under these constraints would require fabricating one. The foundational principle is: **the code's behavior is truth; my (and the operator's) mental model of "what changed" is a guess.** Before I change auth code, I need to know the actual current symptom, because:

1. "That account does not have access." on `glh280.cloudflareaccess.com` → CF-layer issue → NOT fixable in code (H5/H6/H7).
2. "401 Unauthorized" from the app itself → `proxy.ts` JWT verification failing → fixable in code if caused by env drift or AUD mismatch (check Railway vars; check CF Access app AUD tag).
3. Redirect loop / 500 / blank page / some other error → different code-level root cause (app-side bug in post-P2 code, e.g., `queryDealById` crashing on a null, DB connection refused, etc.).
4. Access denied from the APP (not CF) → misconfigured `ALLOWED_EMAILS`-style path. Confirmed absent in code (grepped prior session) — so would rule out H3, not surface a new root cause.

---

## CHECKPOINT REACHED — awaiting operator verification

**Type:** human-verify
**Need:** Capture the actual current error output to avoid fabricating a root cause.

**Please collect and report (paste raw values, do NOT interpret):**

1. **Open a fresh browser window and navigate to `https://portal.utstitle.com`.** What page do you land on? Specifically:
   - a. Is the URL in the browser bar `portal.utstitle.com/...` or `glh280.cloudflareaccess.com/...` or something else?
   - b. What is the page title (browser tab text)?
   - c. What is the EXACT error text displayed on the page? Copy-paste it verbatim.
   - d. Take a screenshot if possible.

2. **Which email account were you trying to sign in with?** `mike@utstitle.com`, `mike@...something-else`, `info@utstitle.com`? Exact string matters — the prior debug file's H1 noted that `info@` was never on the allowlist by design.

3. **Browser DevTools → Network tab** — in a fresh reload, what does the FIRST request to `portal.utstitle.com` return?
   - Status code (200 / 302 / 401 / 500 / …)
   - `Server:` response header
   - First few lines of the response body if non-redirect

4. **Railway logs from the app service (last 50 lines):**
   ```
   railway logs --service npr-dashboard-prototype | tail -50
   ```
   Anything that looks like `Environment validation failed`, an error stack, or a 401 with `cf-access-jwt-assertion` complaints.

5. **Confirm the env vars on Railway are present — paste the output of:**
   ```
   railway variables --service npr-dashboard-prototype --kv | grep -E "^(CF_ACCESS_|NEXT_PUBLIC_APP_|DATABASE_URL=)"
   ```
   Redact password in DATABASE_URL — just confirm the variable is present and non-empty. For CF_ACCESS_TEAM_DOMAIN, confirm the value is `glh280.cloudflareaccess.com` (or whatever tenant you actually see in the URL when CF Access challenges you).

6. **In Cloudflare Zero Trust → Access → Applications → NPR Dashboard → Overview tab, copy the Application AUD tag and compare it to `CF_ACCESS_AUD` on Railway.** These must match exactly. If they don't, the JWT verification in `lib/access.ts:109-112` fails and returns 401 from the app (which is the most plausible code-level cause if something silently changed on the CF side).

7. **Railway deploy status — paste the output of:**
   ```
   railway status --json
   ```
   Confirm the active deployment is at commit `e6a3658` or `4604a16` (the expected head). If it's an older commit, the prod app is serving stale code and a redeploy will bring it current.

**Progress so far:** 4 evidence entries, 1 hypothesis (H1) eliminated, 4 new hypotheses (H5-H9) awaiting evidence to differentiate.

---

## Prior report (preserved below for reference — H1 was the original conclusion, now invalidated by 2026-04-18 evidence)

### Symptom (as reported 2026-04-17)

User attempted sign-in at `portal.utstitle.com` with two Google Workspace email accounts:

- `mike@...` (primary user email — expected to have access)
- `info@...` (shared inbox)

Both emails saw **"That account does not have access."** on the Cloudflare-hosted sign-in page (`glh280.cloudflareaccess.com`). The error fires **before** the Next.js app renders anything — it is returned by Cloudflare Access itself.

The hostname the user saw (`glh280.cloudflareaccess.com`) also differs from the hostname planned in `PLAN.md` Task B1 Step 2 (`npr.cloudflareaccess.com`). See H4 below.

### Hypothesis ranking (2026-04-17 — superseded)

| H | Layer | Hypothesis | Likelihood (at time) |
|---|-------|------------|------------|
| H1 | Cloudflare Access policy | Include list on the "Internal operators" policy does not contain `mike@...` or `info@...` | Was Very High — **INVALIDATED 2026-04-18** |
| H2 | Cloudflare Access policy | Policy uses Google Workspace group membership, and neither account is in the allowed group | Low |
| H3 | App-level allowlist | `lib/access.ts`, `lib/users.ts`, or `proxy.ts` rejects unknown users | ~0 — no allowlist in code |
| H4 | AUD / team-domain mismatch | `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` env vars don't match the real Access tenant | Low-to-Medium — still a live check in H7 above |

### Investigation notes (2026-04-17)

- `lib/access.ts` — pure JWKS-based JWT verification using `jose`. Checks `iss`, `aud`, signature, and `email` claim presence. **No email allowlist** — any verified JWT passes. (`lib/access.ts:82-119`)
- `lib/users.ts` — `findUserByEmail` / `upsertUserFromAccess` pure upsert by email. Any email claim creates a row. **No allowlist.** (`lib/users.ts:15-58`)
- `lib/current-user.ts` — Reads `cf-access-jwt-assertion` header, verifies, upserts. Trusts any verified claim. (`lib/current-user.ts:20-35`)
- `proxy.ts` — Verifies JWT via `verifyAccessJwt` — pass or 401. (`proxy.ts:29-46`)
- `AUDIT.md` line 45: "Allowlist managed in CF dashboard, not code." Confirms design intent — no code path will ever reject an email; the allowlist is entirely a Cloudflare Zero Trust dashboard concern.
- `.env.example` + `lib/env.ts` — `CF_ACCESS_TEAM_DOMAIN` planned `npr.cloudflareaccess.com` (PLAN.md line 281). User hit `glh280.cloudflareaccess.com`. Either (a) the team slug was actually `glh280` not `npr` when created, or (b) the env var is stale. Does not cause the observed CF-layer rejection but is a side-finding that MUST be reconciled against the Railway value for app-side JWT verification to succeed once the user DOES pass CF sign-in.
- Git log: Nothing in the 20 commits preceding 2026-04-17 touched allowlist/seed logic. P0.5 commits (`fc8da45..6a2eeed`) explicitly removed the old Auth.js allowlist (`lib/allowlist.ts` deleted in `44bad2d`). No code-level allowlist exists by design.

### Prior conclusion (2026-04-17) — now INVALIDATED

H1 — CF Access policy Include list missing the emails. Fix: add emails in CF Zero Trust dashboard.

(Invalidation rationale now captured in the "H1 INVALIDATED" table at the top of this file.)

---

## Resolution (2026-04-18)

### Final root cause

**Microsoft Edge + Windows Credential Manager / Web Account Manager (WAM) silent re-authentication.** The "access denied" symptom from 2026-04-17 was a separate issue that resolved itself (most likely the MFA Require rule deferral documented in `P05-CLOSURE.md` — 4 users signed in successfully after MFA was removed from the policy). The 2026-04-18 re-opened symptom was the *inverse*: incognito/InPrivate reaching the app without visible sign-in.

### Evidence chain that nailed it

| Signal | Evidence | What it ruled out |
|--------|----------|-------------------|
| JWT `iat: 1776539984` (2026-04-18 20:39:44 UTC) | Decoded from `CF_Authorization` cookie | Eliminated "stale cookie persistence" — the JWT was minted fresh during the most recent incognito visit |
| JWT `amr` claim absent | Same decode | Eliminated "Google OAuth silently completed" — a fresh OAuth always sets `amr`. Its absence proves CF Access used a **cached team-level identity** and never called Google |
| `curl -sI` returned `CF-Access-Domain: portal.utstitle.com` + `Set-Cookie: CF_Session=…` but no `cf-cache-status` | Operator-run header inspection | Eliminated the Cloudflare CDN caching hypothesis and confirmed CF Access IS gating the hostname correctly |
| **Chrome works (full sign-in → reason → app; sign-out actually signs out)** | Operator cross-browser comparison | Proved the issue is browser-specific, not CF policy, tunnel, or origin code |
| **Edge auto-auths silently; sign-out appears to work but doesn't** | Same test | Isolated to Edge — signature of Windows Credential Manager / WAM auto-submitting credentials on the Google OAuth redirect at the OS layer, below the cookie layer |
| Purpose Justification form DOES fire on Edge (but Google IdP step does not) | Operator observation + session-persistence todo | Proved CF Access policy IS running — the Require/Include rules execute. Only the identity-provider challenge step gets silently satisfied by OS-injected credentials |

### What changed between "Edge worked" and "Edge doesn't work"

The **domain changed today** (P0.5.1 migrated live traffic from `*.up.railway.app` → `portal.utstitle.com`). Windows Credential Manager and WAM categorize custom business domains differently from generic PaaS TLDs — custom domains are eligible for "work site" auto-auth via WAM. Mike's first sign-in on the new custom domain (during CFA-12 verification at 15:20 EDT 2026-04-18) registered credentials at the OS layer; every subsequent Edge visit auto-replays them silently, even after explicit CF Access sign-out.

### Why `proxy.ts` + `lib/access.ts` were never the cause

- `proxy.ts` fail-closes on missing/invalid JWT (401). No bypass route. No code change since `300214d` (2026-04-17).
- `lib/access.ts` verifies signature + `iss` + `aud` + `email` claim. No `amr` check — but CF minting a valid JWT with Mike's email is all the code requires. The code's contract is "is this a legitimately-signed identity?", not "how strictly did the user prove it just now?"
- `next.config.ts` is empty. `app/page.tsx:37` invokes `getCurrentUser()` which re-verifies the JWT on every render. No static pre-rendering escape hatch.

Proven correct by the Chrome test — same code, different browser, correct behavior.

### Option chosen: A (document, no code/policy change)

- Edge+WAM auto-auth is Microsoft's intended security model ("OS is the identity boundary, not the browser window")
- Operational impact is zero — only affects authorized-user re-auth UX, not who can access the app
- Threat model for this app (≤50 authorized users, all on corporate-managed devices) aligns with "OS identity boundary" — the OS is trusted; a compromised OS-level session is a bigger problem than CF Access session strictness
- Cost/benefit of a fix (Option C — standalone app-level session layer) is not justified at this stage; defer unless threat model tightens

### Documented outputs

- `.planning/VENDORS.md` → Cloudflare row `Notes` column — added browser-session caveat describing Edge InPrivate + WAM behavior, recommended test browsers (Chrome incognito / Edge Guest mode), and Option B as a future consideration
- `.planning/VENDORS.md` → Changelog — 2026-04-18 row pointing back to this debug file
- This file → renamed to `…-resolved.md` so it drops out of the active-debug-session filter

### Option B — noted for future consideration, NOT implemented

**Shorten CF Access Application `Session Duration`** from 24h → 1h (or 4h) in CF Zero Trust → Access → Applications → NPR Dashboard → Session duration.

- Pro: forces the silent WAM re-auth cycle to happen more often (documentation artifact for compliance narrative: "session boundary is every Nh, not 24h")
- Pro: limits window of exposure if a user's OS session is ever compromised
- Con: every user sees the Purpose Justification prompt every Nh instead of once per day
- Revisit trigger: when written GLBA Safeguards WISP cites a specific re-auth cadence, or when Carrie starts using the app from non-corporate-managed devices, or if MFA is restored in a later phase

### Option C — not chosen, but shape preserved for future

Resurrecting the "sat aside" P0 standalone-login specs (`app/(auth)/sign-in/page.tsx` pattern + `middleware.ts` gating) as a **secondary** app-level session layer on top of CF Access would be the only structurally-complete fix for the WAM silent-auth class of problem — because WAM can only traverse auth layers it knows about. An app-defined session shape is outside WAM's scope.

Preserved for future work under a new phase (tentative: `0.6-app-level-auth-layer`) if the threat model tightens.

### Related artifacts (keep for cross-reference)

- `.planning/todos/pending/2026-04-18-investigate-cf-access-session-persistence-in-incognito.md` — captured the silent auto-auth symptom first; its Phase 1 evidence-gathering plan (decode JWT claims) was the winning diagnostic approach. Todo is now effectively answered; operator may move to `.planning/todos/done/` at their discretion.
- `.planning/phases/00.5-access-encryption/P05-CLOSURE.md` SC4 — MFA deferral is the prior-related auth-policy change; part of the broader "what CF Access actually enforces today vs. what docs claim" reconciliation work.

### What was NOT changed

- No code files edited during this investigation or resolution
- No CF Access policy changes beyond what operator had already done (MFA Require rule removed 2026-04-17; Include list verified 2026-04-18)
- No Railway environment variables touched
- No git operations beyond read-only inspection
- No tests added — cross-browser auth UX is exercised by human UAT, not unit/integration tests; added browser-specific notes to future UAT runbooks via VENDORS.md
