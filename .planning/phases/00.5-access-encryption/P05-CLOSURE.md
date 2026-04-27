# Phase 0.5 Closure — Live Smoke Test & Remaining Success Criteria

**Date:** 2026-04-17
**Status:** P0.5 marked complete in STATE.md (commit `6a2eeed`), but live smoke test revealed 3 success criteria still need verification. This doc tracks closure.

---

## Summary

After a live debugging session on 2026-04-17, `portal.utstitle.com` successfully authenticated Mike Miller through the full chain: **CF Access policy → Google IdP → Purpose justification → JWT mint → Cloudflare Tunnel → Railway private network → Next.js app**. The prototype dashboard rendered with his session.

This proves the architecture works end-to-end. However, three P0.5 success criteria remain in caveat states that require closure before P0.5 is considered truly complete.

---

## Success criteria rubric (2026-04-17 post-smoke-test)

| SC | Criterion | Status | Notes |
|----|-----------|--------|-------|
| 1 | Direct Railway origin (bypassing CF) returns 403/404 | ⚠️ Not live-tested | See verification step below |
| 2 | Invalid JWT returns 401 | ✅ Passed | `tests/unit/access.test.ts` |
| 3 | Valid JWT upserts users row; avatar displays real name/email | ⚠️ Avatar showed "CD" during smoke test | Likely stale Railway deploy — see verification step |
| 4 | MFA prompt fires on first Access login | 🔴 Temporarily disabled | MFA Require rule removed in CF Access policy to unblock Mike's sign-in. Restoration pending Google Workspace 2SV enrollment. |
| 5 | Purpose justification enabled, 24h session | ✅ Passed | Mike saw "reason for login" prompt during smoke test |
| 6 | `encrypt()` / `decrypt()` round-trip | ✅ Passed | `tests/unit/crypto.test.ts` |
| 7 | `decrypt()` always writes `npi_access_log` row (invariant) | ✅ Passed | `tests/unit/crypto.test.ts` invariant test |
| 8 | `.planning/VENDORS.md` exists with 6 vendors PENDING | ✅ Passed | Committed during P0.5 Stage C |
| 9 | All Auth.js code + packages removed | ✅ Passed | Stage A forward-revert commits |

**Score:** 6 passed · 2 need verification · 1 tracked as compliance debt

---

## Verification steps (user actions)

### SC1 — Direct origin bypass returns 403/404

**Why it matters:** GLBA defense-in-depth — if someone discovers the Railway-assigned URL, they must not be able to bypass CF Access to reach the app.

**Steps:**
1. Open a new browser tab (any browser, not incognito required).
2. Navigate directly to: `https://npr-dashboard-prototype-production.up.railway.app`
3. **Expected:** 403 Forbidden, 404 Not Found, or the app refuses to render because the `Cf-Access-Jwt-Assertion` header is absent (depends on whether proxy.ts rejects cleanly or Railway's Public Networking is configured to block direct access entirely).
4. **Unacceptable:** the prototype dashboard renders without any authentication. That would mean CF Access is trivially bypassable.

**Result (fill in):** ___________________

**If fails:** P0.5 task B6 (proxy enforces CF Access JWT) didn't fully land, OR Railway is exposing the service publicly despite tunnel-only intent. Dig into `proxy.ts` and Railway's networking settings.

---

### SC3 — Avatar displays real user

**Why it matters:** Confirms `lib/current-user.ts` + `app-header.tsx` are actually reading from CF Access JWT claims, not mock data.

**Root cause hypothesis (most likely):** Railway is serving a stale build — "rev 5 final retry" deployed before P0.5 tasks B6/B7 landed. The live code doesn't include the dynamic-initials `app-header.tsx` rewrite.

**Steps:**
1. Confirm Railway's current deploy commit:
   - Railway dashboard → `npr-dashboard-prototype` service → Deployments tab
   - Note the active deployment's commit SHA (if visible) or deploy timestamp
   - Compare to local `git log origin/master -1` (should be `6a2eeed` or later)
2. If Railway is behind origin/master, trigger a redeploy:
   - Option A: Railway dashboard → latest deployment → ⋯ → **Redeploy**
   - Option B: Terminal → `railway up` in the project directory
   - Option C: Enable "Auto Deploy" on the GitHub integration so future commits deploy automatically
3. Wait for deploy to complete (~2 min)
4. Mike (or another allowlisted user) signs in at `portal.utstitle.com` in fresh incognito
5. **Expected:** Avatar shows Mike's Google Workspace first initial (likely "M", or "MM" if Google sends `name: "Mike Miller"` in the claim)
6. **Unacceptable:** Avatar still shows "CD" even after fresh deploy of latest master

**Result (fill in):** ___________________

**If still fails after fresh deploy:** Real bug. Likely candidates:
- `app/page.tsx` is rendering a different (mock) header component instead of `<AppHeader />`
- `lib/current-user.ts` is returning a cached / wrong user
- `users` table has a pre-existing row with `name: "Carrie Davis"` being returned for Mike by mistake in `upsertUserFromAccess()`

---

### SC4 — MFA Require rule restored

**Current state:** MFA Require rule removed from CF Access "Allow internal team" policy during 2026-04-17 debug session. Four users (carrie, mike, ashley, stephanie) signed in without MFA enforcement. Violates `CFA-05`.

**Why it was removed:** Google IdP wasn't asserting MFA in the sign-in response, because none of the users have 2-Step Verification enrolled on their Google Workspace accounts. The Require rule rejected them until 2SV is in place.

**Restoration runbook:**

#### Step 1 — Enforce 2SV at Google Workspace admin level (one-time)

1. Google Workspace Admin Console: `admin.google.com`
2. Security → Authentication → **2-Step Verification**
3. Select the organizational unit (or "All users" if the whole Workspace)
4. Set: **Allow users to turn on 2-Step Verification** → ON
5. Set: **Enforcement** → "On" with a grace period (recommended: 7 days)
6. Choose method: recommend **Any** or **Any except verification codes via text**
7. Save

#### Step 2 — Each user enrolls (individual action)

Each of carrie, mike, ashley, stephanie must, before the grace period expires:
1. Sign into `myaccount.google.com`
2. Security → 2-Step Verification → **Get Started**
3. Enroll a method (Authenticator app recommended; SMS as fallback)
4. Save backup codes

#### Step 3 — Re-add MFA Require rule in CF Access

1. CF Zero Trust → Access → Applications → **NPR Dashboard** → Policies → Edit "Allow internal team"
2. Scroll to **Require** section → click **+ Add require**
3. Selector: **Authentication Method** → Value: **MFA**
4. Save policy

#### Step 4 — Verify SC4

1. User signs out of all Google sessions
2. Fresh incognito, navigate to `portal.utstitle.com`
3. **Expected:** Google prompts for 2SV during sign-in; CF Access accepts the MFA assertion; user lands on dashboard
4. **Unacceptable:** "That account does not have access" returns — means Google isn't propagating the MFA claim. Debug by checking the JWT's `amr` claim in the tunnel logs.

**Result (fill in):** ___________________

---

## Compliance debt tracking

| Debt | Severity | Owner | Target close |
|------|----------|-------|--------------|
| MFA Require rule disabled (CFA-05 violation) | HIGH | Mike (Google Workspace admin) | Before any real-deal data touches the system |
| SC1 direct-origin bypass not live-tested | MEDIUM | Mike | Within this week |
| SC3 avatar showing wrong user | MEDIUM (likely stale deploy) | Resolves on Railway redeploy | Today |

---

## When is P0.5 truly complete?

All three of:
- [x] ~~End-to-end smoke test passed — Mike signed in on 2026-04-17~~
- [ ] SC1 verified (direct origin bypass blocked)
- [ ] SC3 verified (avatar displays real user after fresh deploy)
- [ ] SC4 restored (MFA Require rule re-enabled after 2SV enrollment)

Once those three checkboxes are filled, update STATE.md with a "P0.5 closure complete" entry and delete the debt lines above.
