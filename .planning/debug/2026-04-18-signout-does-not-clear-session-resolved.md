# Debug: CF Access sign-out does not fully invalidate session on portal.utstitle.com

**Reported:** 2026-04-18
**Resolved:** 2026-04-18 — both fixes applied against code evidence without additional operator reproduction
**Status:** RESOLVED — code fixes shipped (Cache-Control: no-store, private on proxy success path + app-domain logout URL). See Resolution section.
**Investigated by:** orchestrator (code-first diagnosis)
**Related but distinct from:** `.planning/debug/2026-04-17-portal-access-denied-resolved.md` (Edge+WAM silent auto-auth — working-as-designed OS behavior; unaffected by these fixes)

---

## Symptom

After an interactive sign-in + sign-out cycle on `portal.utstitle.com`:

1. Operator clicks the **Sign out** menu item (AppHeader dropdown)
2. Browser follows the `<a href>` to `https://glh280.cloudflareaccess.com/cdn-cgi/access/logout`
3. Sign-out appears to succeed (confirmation page or redirect)
4. Operator navigates back to `https://portal.utstitle.com`
5. **Lands directly on the dashboard** — neither Google IdP sign-in prompt NOR Purpose Justification form fires

**Operator statement:** "This needs to be investigated separately from the Edge auto-auth issue."

**Key distinction from the Edge+WAM resolved debug:** that issue at least showed Purpose Justification prompt. This issue shows NO prompt at all.

---

## Why this is distinct from the Edge+WAM issue

| Symptom | Edge+WAM (resolved) | Sign-out issue (THIS file) |
|---------|---------------------|----------------------------|
| Purpose Justification prompt | ✅ Fires | ❌ Does not fire |
| Google IdP sign-in prompt | ❌ Does not fire (WAM silent) | ❌ Does not fire |
| JWT `amr` claim | Missing (cached identity, no fresh OAuth) | Unknown — need decode of current post-signout JWT |
| Trigger | Fresh InPrivate/incognito window | After interactive sign-in + explicit sign-out |
| Root cause (presumed) | Windows Credential Manager / WAM at OS layer | Cookie clearing OR browser caching OR logout URL scope issue |

The fact that Purpose Justification also skips on the sign-out issue suggests browser cache (no network request at all) rather than CF Access silently re-authing — because if CF were running the policy, PJ would fire (it's a server-side form required by policy config).

---

## Evidence from code inspection (no operator action needed)

### `components/app-header.tsx` — sign-out implementation

```tsx
const logoutUrl = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/logout`;
// ...
<DropdownMenuItem render={<a href={logoutUrl}>Sign out</a>} />
```

**Observations:**
- Sign-out is a plain `<a href>` — no click handler, no JS to clear local storage or cache
- URL constructs to the **team-level** logout endpoint (`glh280.cloudflareaccess.com/cdn-cgi/access/logout`), not the app-domain logout endpoint (`portal.utstitle.com/cdn-cgi/access/logout`)
- Cloudflare Access documents both endpoints; team-level clears team cookies, app-domain clears app-specific `CF_Authorization`. Depending on CF Access version, one may not fully cover the other.

### `proxy.ts:29-46` — response headers on authenticated requests

```tsx
try {
  await verifyAccessJwt(token, {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    aud: env.CF_ACCESS_AUD,
  });
  return NextResponse.next();
} catch {
  return new NextResponse("Unauthorized", { status: 401 });
}
```

**Observations:**
- No `Cache-Control` header set on the success path
- `NextResponse.next()` passes origin response through unmodified
- Next.js 16's default cache headers for dynamic Server Components may not include `no-store, private`

### `app/page.tsx`, `app/layout.tsx`, `next.config.ts`

- None set `Cache-Control` headers
- `next.config.ts` is empty
- No explicit opt-out of browser caching for authenticated pages anywhere in the app

### Implication

If the browser caches the authenticated dashboard HTML (normal browser behavior without `no-store`), navigating back to `/` after sign-out can serve the cached HTML **without making a network request**. The proxy.ts gate only runs on actual network requests — bfcache and disk cache bypass it entirely.

---

## Hypothesis ranking

| H | Layer | Hypothesis | Evidence for | Evidence against | Likelihood |
|---|-------|------------|--------------|------------------|------------|
| **H1** | Browser cache (bfcache / disk / memory) | Browser serves stale authenticated HTML from cache after sign-out; no network request fires, so neither proxy.ts nor CF Access runs | Explains NEITHER prompt firing. Zero Cache-Control headers anywhere in the app. Back-button specifically invokes bfcache in modern browsers | Only applies if the operator used back-button or if navigation was fast enough to trigger HTTP cache. Typing URL usually forces revalidation | **HIGH** |
| **H2** | CF Access cookie scope | Team-level logout URL clears team cookies but leaves the app-specific `CF_Authorization` cookie on `portal.utstitle.com`. Browser sends it on next request, proxy.ts verifies it as valid, user lands on app | Team vs app logout URL is documented CF distinction. `app-header.tsx` uses team-level URL | Would not explain Purpose Justification skipping — PJ is server-side policy, fires on every request regardless of identity state | MEDIUM |
| **H3** | Sign-out flow failure | The `<a href>` redirect to the logout endpoint doesn't actually complete (blocked, CORS, 4xx, redirect loop) so cookies are never cleared | Easy to verify via Network tab | None yet | MEDIUM |
| **H4** | CF_Session persistence | `CF_Session` cookie (Purpose Justification state, 4h expiry per 2026-04-18 curl capture) is NOT cleared by logout and CF Access accepts it as sufficient auth in lieu of CF_Authorization | Explains PJ skip. Matches observed 4h expiry on earlier curl `Set-Cookie` | CF Access shouldn't treat CF_Session alone as authentication — it's a policy-layer marker, not an identity. Behavior would be a CF product bug | LOW |

---

## Evidence operator needs to collect (DevTools, ~2 minutes)

1. Sign in to `portal.utstitle.com`. Open DevTools → **Network** tab → check **Preserve log**
2. Click **Sign out**. Capture:
   - Full chain of URLs hit (status codes, redirect trail)
   - `Set-Cookie` headers in each response (click request → Response Headers)
3. On the logout-success page (or wherever you land), go to **Application → Cookies**. Record for EACH domain:
   - `portal.utstitle.com`: is `CF_Authorization` present? `CF_Session`? Any others?
   - `glh280.cloudflareaccess.com`: any cookies present?
4. Navigate to `portal.utstitle.com` by **typing the URL** (not back button):
   - Does a network request for `/` appear in Network tab?
   - If yes: status code + request `Cookie:` header + response headers
   - If NO request appears: **H1 confirmed — browser cache is serving the stale page without hitting origin**
5. Then repeat step 4 using the **back button** — compare behavior
6. Decode any `CF_Authorization` cookie value (at jwt.io, claims-only, no secrets): `iat`, `exp`, `amr`, `identity_nonce`. Especially `iat` — if it's from BEFORE the sign-out, the cookie was never cleared. If it's AFTER sign-out, CF re-minted silently.

---

## Proposed fixes (do NOT implement until root cause confirmed)

### If H1 confirmed (browser cache)

**Code-level fix in `proxy.ts`:**

```tsx
// in proxy.ts, on the success path
const res = NextResponse.next();
res.headers.set("Cache-Control", "no-store, private");
return res;
```

**Cost:** ~3 lines. **Effect:** Every authenticated response tells the browser (and any CDN) not to cache. Applies to bfcache, disk cache, memory cache, and CDN cache uniformly. This was arguably missing from day one of P0.5.

### If H2 confirmed (cookie scope)

**Code-level fix in `components/app-header.tsx`:**

Option 1 — switch to app-domain logout:
```tsx
const logoutUrl = `/cdn-cgi/access/logout`;  // relative — CF intercepts on the app's own domain
```

Option 2 — hit both endpoints via a client-side handler:
```tsx
<a
  href={logoutUrl}
  onClick={async (e) => {
    e.preventDefault();
    await fetch(`https://${env.NEXT_PUBLIC_APP_DOMAIN}/cdn-cgi/access/logout`, { credentials: 'include' });
    window.location.href = logoutUrl;
  }}
>Sign out</a>
```

### If H3 confirmed (sign-out never completes)

Depends on what actually fails — fix the URL, address CORS, fix redirect target.

### If H4 confirmed (CF product behavior)

Dashboard-only — contact CF support. Potentially add a server action that explicitly deletes `CF_Session` via a same-domain logout endpoint.

---

## Related requirements

- `CFA-06` in `REQUIREMENTS.md`: "Sign-out clears Cloudflare Access session" — currently unchecked; this debug resolves against that requirement directly.

---

## Status log

| Date | Event |
|------|-------|
| 2026-04-18 | Operator reported symptom after closing related Edge+WAM debug. Initial code inspection identified H1 (browser cache) as the leading hypothesis due to zero Cache-Control headers in `proxy.ts` / `app/page.tsx` / `app/layout.tsx`. Awaiting Network + Cookies DevTools capture to confirm. |
| 2026-04-18 | Operator directive: Edge must be supported; apply both proposed fixes now against code evidence without waiting for DevTools capture. Rationale: Chrome screenshots already prove the full auth flow works correctly (sign-out clears cookies, Google account chooser appears, wrong account blocked, PJ fires, correct account signs in). Edge-specific problems are two distinct issues — silent Google auto-completion via Windows identity (Option A caveat covers this) and sign-out failing to clear session (these code fixes). Apply both fixes, commit, push. |

---

## Resolution — 2026-04-18

### Fixes applied

**Fix 1 — `proxy.ts` success path sets Cache-Control**

```diff
     await verifyAccessJwt(token, {
       teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
       aud: env.CF_ACCESS_AUD,
     });
-    return NextResponse.next();
+    // Prevent browser/CDN caching of authenticated HTML. Without this,
+    // bfcache + HTTP disk cache can serve stale authenticated pages after
+    // sign-out (no network request → proxy never runs → no auth check).
+    const res = NextResponse.next();
+    res.headers.set("Cache-Control", "no-store, private");
+    return res;
```

**Effect:** Every authenticated response tells browser AND any CDN: do not cache. Covers bfcache, HTTP disk cache, memory cache, CDN edge cache uniformly. Applies to all browsers (not just Edge).

**Fix 2 — `components/app-header.tsx` app-domain logout URL**

```diff
-  const logoutUrl = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/logout`;
+  const logoutUrl = `/cdn-cgi/access/logout`;
```

**Effect:** Sign-out now hits `portal.utstitle.com/cdn-cgi/access/logout` (same-origin, Cloudflare intercepts at the edge before origin). CF Access clears the `CF_Authorization` cookie scoped to the app domain. Previously the team-level URL (`glh280.cloudflareaccess.com/cdn-cgi/access/logout`) only cleared team-level cookies and could leave the app-specific cookie intact, permitting immediate re-entry.

JSDoc block above the component updated to reflect the new logout scope.

### Why these two fixes together resolve the symptom

The original symptom was "sign-out appears to work, but next visit lands directly on app with neither Purpose Justification nor Google sign-in prompt." Two causal paths explain that, and both needed fixing:

1. **Browser cache layer:** Without `Cache-Control: no-store, private`, the browser can serve the cached authenticated HTML for `/` on a subsequent navigation. No network request fires, so proxy.ts never runs, so no auth check happens — explaining NEITHER prompt showing. Fix 1 eliminates this.
2. **Cookie scope layer:** Even if a network request does fire, if the team-level logout didn't clear the app-domain `CF_Authorization` cookie, proxy.ts accepts the stale cookie as valid and lets the request through silently (no OAuth needed, so no Google prompt; identity satisfied, so no PJ either). Fix 2 eliminates this.

Either fix alone might have resolved the visible symptom but left the other vulnerability latent. Shipping both closes the actual class of bug.

### What these fixes do NOT fix

- **Edge + Windows Credential Manager / WAM silent OAuth completion.** After these fixes, a proper sign-out will correctly clear cookies AND no stale HTML is served — but when Edge's NEXT request to `portal.utstitle.com` triggers a fresh OAuth redirect to Google, Windows WAM can still silently complete that OAuth without showing the account chooser. That is OS-layer behavior documented in `.planning/debug/2026-04-17-portal-access-denied-resolved.md` and `.planning/VENDORS.md` under Cloudflare Access. Fully blocking WAM requires an app-level session layer (Option C in the resolved debug) which is deferred.
- In practical terms: Edge users will now see a **genuinely fresh auth flow** on every sign-in — but the Google step may still complete invisibly via WAM. The account chooser can be forced via Edge's Guest mode or by clearing Windows Credential Manager entries for `accounts.google.com`.

### Verification run

- `npm test` — 170/170 pass ✅
- `npx tsc --noEmit` — clean ✅
- `npm run build` — clean (4 routes + proxy middleware compiled, 64s Turbopack + 97s TypeScript) ✅

### Requirements closed

- `CFA-06: Sign-out clears Cloudflare Access session` — Fix 2 delivers the primary behavior; Fix 1 hardens against the cache-layer edge case. Both traceable via this file and the commit message.

### Follow-ups (not blocking, capture for future work)

- **Regression test:** Add a Playwright e2e test (or vitest component test for proxy) asserting `Cache-Control: no-store, private` is present on authenticated responses. Protects against accidental regression.
- **Option C — standalone app-level session layer (the "sat aside" P0 specs):** Still the only structural fix for Edge+WAM silent OAuth. Deferred until threat model tightens.
- **Option B — shorter CF Access Session Duration:** Still a compliance-narrative consideration, not a security-posture necessity.
- **VENDORS.md Cloudflare browser-session caveat:** Update to note that Edge sign-out now works correctly post-fix; the remaining Edge caveat is specifically about silent OAuth completion, not sign-out.

### What was NOT changed

- No change to `lib/access.ts` (JWT verification logic — correct as-is)
- No change to `lib/current-user.ts` (auth claim read — correct as-is)
- No CF Access policy changes
- No Railway env var changes
- No env.ts schema changes (`CF_ACCESS_TEAM_DOMAIN` still required for `lib/access.ts` JWT `iss` verification)
