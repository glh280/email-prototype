---
created: 2026-04-19T18:50:00.000Z
title: Replace CF_ACCESS_AUD dev-placeholder in .env.local with real AUD value
area: config
files:
  - .env.local (local-only — gitignored)
  - .env.example (checked-in template, update if it ships the placeholder)
  - lib/env.ts (Zod schema — may want to tighten the validator)
---

## Problem

While running `npm run diag:cf-access` on 2026-04-19 to debug a service-token rejection, the diagnostic output surfaced:

```
expected AUD      : dev-placeholder-aud-value
CF says AUD       : 49791d0ed8b6653955e36917d09d9b381cbdf846d84979c38c4a2d3458752b9c
⚠ AUD mismatch: CF_ACCESS_AUD in .env.local doesn't match the application the request hit.
```

`CF_ACCESS_AUD` in `.env.local` still holds the placeholder string `dev-placeholder-aud-value` — almost certainly a leftover from initial env wiring. The real value (shown in the CF-returned JWT's `aud` claim) is the 64-char hex SHA for the NPR Dashboard Access application.

## Impact

**Probably none in practice, today.** `CF_ACCESS_AUD` is consumed inside the app by `lib/access.ts` during in-app JWT validation (`verifyAccessJwt`). Because Cloudflare's tunnel injects the JWT directly and the app trusts its signature, AUD validation is a defense-in-depth layer — not the primary auth boundary.

**Possible impact:** If the AUD check in `verifyAccessJwt` is strict, authenticated users would be getting rejected at the app layer even though CF Access let them in. Since real users ARE getting through (Carrie's logins succeed), the AUD check is probably either lenient, disabled, or the placeholder value accidentally matches (unlikely) — worth reading `lib/access.ts` to confirm.

## Fix

1. Read the real AUD from the CF Zero Trust dashboard → Access → Applications → NPR Dashboard → Overview tab → Application Audience (AUD) Tag
2. Update `.env.local`: `CF_ACCESS_AUD=<real-64-char-hex>`
3. If `.env.example` still ships `dev-placeholder-aud-value`, update it to a clearly-comment-marked placeholder (e.g. `CF_ACCESS_AUD=your_application_aud_from_cf_dashboard_here`)
4. Verify by running `npm run diag:cf-access` and confirming the AUD matches
5. Verify `lib/env.ts` Zod validator for `CF_ACCESS_AUD` — if it doesn't already, tighten to require a 64-char hex string so this failure mode can't ship again

## Priority

LOW — not blocking anything. Silent defense-in-depth layer that's partially weakened. Pick up any session that's already touching auth config.

## Related

- Commit `a95f701` — `diag:cf-access` helper that surfaced this
- `.planning/DEPLOY.md §6 Scenario G` — CF Access policy-on-wrong-app incident where this was noticed
