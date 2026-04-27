---
created: 2026-04-18T19:25:30.263Z
title: Investigate CF Access session persistence across incognito windows
area: auth
files:
  - .planning/phases/00.5-access-encryption/CONTEXT.md
  - .planning/phases/00.5-access-encryption/PLAN.md
  - .planning/debug/2026-04-17-portal-access-denied.md (separate but related CF Access debug thread)
  - lib/access.ts (JWT verification — probably fine, but worth inspecting)
  - proxy.ts (Access enforcement — probably fine, but worth inspecting)
---

## Problem

**CF Access did not challenge for authentication in a fresh incognito window during Phase 0.5.1 CFA-12 verification (2026-04-18).**

Observed behavior (operator-reported):
1. Operator opened a fresh incognito window (Chrome)
2. Navigated to `https://portal.utstitle.com`
3. CF Access prompted for **Purpose Justification only** (CFA-09 — expected)
4. **Did NOT prompt for Google IdP sign-in** (unexpected if session was truly fresh)
5. Landed directly on the dashboard with Mike's identity (avatar shows `"M"` — see separate initials-bug todo)
6. Operator signed out, returned, observed the same behavior — no sign-in challenge, just Purpose Justification → direct access

**Security concern (HIGH priority — this is why this todo is more important than the initials bug):**

CF Access's design intent from P0.5 (CFA-01 through CFA-09) is that **every session boundary** should involve a full auth flow: Google IdP → MFA → JWT mint. If an incognito window — which by definition should have no CF Access session cookie — can reach the app without signing in, then either:

1. **CF Access session cookie is persisting across "fresh" windows** — possibly via Chrome profile-level identity sharing, browser cookie-store quirks, or CF Access domain-cookie behavior that's more aggressive than expected
2. **CF Access session is valid longer than configured** — P0.5 spec says 24h (CFA-08), but this would be concerning if a days-old session persists silently
3. **Google SSO is auto-completing** — if the operator is signed into Chrome with a Google account that's already authorized for CF Access, the incognito window may silently inherit Google's sign-in state even though it shouldn't have CF Access cookies
4. **Policy misconfiguration** — CF Access policy may not actually require re-auth for incognito-equivalent states

**Why it matters for GLBA posture:**

The `ENCRYPTION_KEY` is protected by CF Access + MFA at the access layer, on top of column-level encryption at the data layer. If CF Access sessions persist more than expected, the "MFA on every session" security boundary (CFA-05) is effectively weaker than documented. This needs investigation before we commit written GLBA Safeguards documentation that cites CF Access + MFA as a control.

**Why we didn't fix this inline during P0.5.1:**

CFA-12's acceptance criterion is narrow: "avatar reflects signed-in user, not stale fallback" — which PASSED. The session-behavior question is orthogonal and, per operator instruction (2026-04-18), needs a dedicated look at CF Access policy configuration rather than a quick inline fix. P0.5.1 closed cleanly with CFA-12 PASS; this todo captures the follow-up investigation.

## Solution

**Approach (investigation-first, fix-second — scope TBD until evidence is gathered):**

### Phase 1 — Evidence gathering (~30 min, no changes)

1. **Reproduce the behavior deterministically:**
   - Chrome: close ALL windows (including background Chrome profiles). Quit Chrome fully via Task Manager if needed.
   - Launch Chrome with a completely fresh profile: `chrome --user-data-dir=/tmp/fresh-profile --incognito` (or equivalent Windows path).
   - Navigate to `portal.utstitle.com`.
   - Document exactly what prompts appear.
   - Expected: Google IdP sign-in → Purpose Justification → MFA (if enrolled) → dashboard.
   - If sign-in is still skipped with a truly fresh Chrome profile, then the issue is more serious (CF Access session or cookie behavior, not Chrome profile sync).

2. **Test in a different browser entirely:**
   - Firefox private window or Safari private window — no Chrome profile inheritance possible
   - If sign-in IS required here, root cause is Chrome-specific profile identity sharing (less alarming)
   - If sign-in is NOT required here either, root cause is CF Access / cookie behavior (more alarming)

3. **Inspect Cloudflare Zero Trust dashboard:**
   - Navigate to CF Zero Trust → Access → Applications → `portal.utstitle.com`
   - Review Session Duration setting (should be 24h per P0.5 CFA-08)
   - Review Policy → Include/Exclude/Require rules — what triggers re-auth?
   - Check "Persist MFA session" setting — may be silently keeping MFA valid beyond the session boundary
   - Review the Access logs (Zero Trust → Logs → Access) for recent auth events from `portal.utstitle.com`

4. **Inspect JWT claims:**
   - On a fresh login, open dev tools → Application → Cookies
   - Find the `CF_Authorization` cookie
   - Decode the JWT at jwt.io (server claims only, no secrets)
   - Check `iat` (issued at), `exp` (expires), `aud`, `iss`
   - If `exp` is days in the future, the session is being minted with long validity
   - If `exp` matches 24h, something else is making it appear to persist

### Phase 2 — Decision point

After Phase 1 evidence:

- **If root cause is Chrome profile sync** (Firefox requires sign-in): This is well-known Chrome behavior, not a CF Access misconfiguration. Document in `.planning/VENDORS.md` under Cloudflare row as a known browser-cache caveat. No code change needed. Operator UAT procedure gets a "use Firefox or a fresh Chrome profile for truly-fresh testing" footnote.

- **If root cause is CF Access policy** (persists across browsers): Fix the policy in CF Zero Trust dashboard to match P0.5 spec. Then document the corrected configuration in `.planning/phases/00.5-access-encryption/CONTEXT.md` as an addendum. Consider adding a new requirement CFA-13 ("CF Access session required to re-challenge Google IdP after 24h + on new browser/device") to REQUIREMENTS.md.

- **If root cause is an app-side bug** (proxy.ts misvalidating session): Fix `proxy.ts` or `lib/access.ts`, add unit test covering session expiry, redeploy. Higher scope — probably warrants its own gsd:debug thread.

### Phase 3 — GLBA documentation update

Regardless of Phase 2 outcome:

- Update `.planning/VENDORS.md` Cloudflare row with a "Session behavior caveats" section explaining actual observed behavior + operator-UAT-procedure footnote
- Add a bullet to the written GLBA Safeguards program draft (future) that accurately describes when MFA is actually challenged vs. when session persistence takes over

**Cross-reference:**

- Related debug thread (DIFFERENT issue): `.planning/debug/2026-04-17-portal-access-denied.md` — CF Access POLICY blocking `mike@`/`info@`. That's a "cannot access" problem. This todo is the inverse — "can access without re-auth" problem. Both should be addressed but the two debug threads are independent.

**Why not use /gsd:debug for this:**

This is intentionally an investigation todo rather than a debug session because:
1. The problem scope isn't fully known yet — Phase 1 evidence gathering determines whether this is a 15-min config fix, a 2-hour policy rewrite, or a 1-day app-code fix
2. Operator wants to address this in a post-phase work batch, not mid-phase
3. Opening a debug session would imply "systematic debugging with persistent state" which is heavier than needed until we know the root cause

---

## Resolution (2026-04-18, post-/gsd:debug session)

**Answered — two distinct root causes identified and disposed separately:**

### Cause 1 — Microsoft Edge + Windows Credential Manager / WAM silent OAuth completion

Documented as working-as-designed OS behavior in:
- `.planning/debug/2026-04-17-portal-access-denied-resolved.md` (full evidence chain, JWT decode with missing `amr` claim)
- `.planning/VENDORS.md` Cloudflare row browser-session caveat

**Disposition:** Option A chosen — document, don't fix. Fully blocking WAM requires an app-level session layer (deferred "Option C" — resurrecting the shape of the P0 standalone-login specs). Revisit trigger: threat model tightens, Carrie starts using non-corporate-managed devices, or MFA is restored.

### Cause 2 — CF Access sign-out did not fully clear app-domain session

Fixed in commit `cc2f459` (2026-04-18):
- `proxy.ts` — authenticated responses now emit `Cache-Control: no-store, private` (prevents browser/CDN serving stale authenticated HTML after sign-out)
- `components/app-header.tsx` — logout URL changed from team-level to app-domain (`/cdn-cgi/access/logout`) so `CF_Authorization` cookie for `portal.utstitle.com` is actually cleared

Documented in `.planning/debug/2026-04-18-signout-does-not-clear-session-resolved.md`. Closes CFA-06.

### Winning diagnostic technique

**Phase 1 Step 4 of this todo's original plan** ("decode the JWT's `iat` / `exp` / `amr` claims at jwt.io") turned out to be the load-bearing evidence-gathering step — the missing `amr` claim on a fresh `iat` is what conclusively proved CF Access was using cached team-level identity rather than running fresh OAuth. Worth preserving as a pattern for future CF Access auth investigations.

**Moved to `done/` 2026-04-18.**
