---
created: 2026-04-18T21:00:20.000Z
title: Add regression test asserting Cache-Control no-store on authenticated responses
area: tests
files:
  - proxy.ts (asserted under test)
  - tests/ (new test file — location TBD: tests/unit/proxy.test.ts OR tests/e2e/auth-cache-control.spec.ts)
---

## Problem

Commit `cc2f459` (2026-04-18) added `Cache-Control: no-store, private` to `proxy.ts`'s authenticated-response success path. This header is the **load-bearing** defense against:

- Browser bfcache serving stale authenticated HTML after sign-out (no network request → proxy never runs → no auth check)
- HTTP disk/memory cache doing the same
- Cloudflare CDN edge cache doing the same for static-looking HTML bytes

The header is one line (`res.headers.set("Cache-Control", "no-store, private")`) and is trivially easy to accidentally remove during a future refactor — no test currently asserts its presence. Because the symptom (sign-out doesn't actually invalidate session) is **silent until exercised via sign-out + navigate-back**, regression would likely ship undetected.

CFA-06 is now formally satisfied but not test-covered.

## Solution

Pick ONE of (vitest preferred for CI speed; Playwright if you want end-to-end coverage):

### Option 1 — vitest unit test (fast, CI-friendly)

Create `tests/unit/proxy.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import type { NextRequest } from "next/server";

describe("proxy.ts Cache-Control header (CFA-06)", () => {
  beforeAll(() => {
    // Set required env vars for env.ts module load
    process.env.CF_ACCESS_TEAM_DOMAIN = "test.cloudflareaccess.com";
    process.env.CF_ACCESS_AUD = "test-aud";
    process.env.NEXT_PUBLIC_APP_NAME = "Test";
    process.env.NEXT_PUBLIC_APP_DOMAIN = "test.example.com";
    process.env.DATABASE_URL = "postgres://test";
    process.env.ENCRYPTION_KEY = "A".repeat(44); // valid base64 length
  });

  it("sets Cache-Control: no-store, private on authenticated responses", async () => {
    // Mock verifyAccessJwt to return valid claims
    vi.mock("@/lib/access", () => ({
      verifyAccessJwt: vi.fn().mockResolvedValue({ email: "test@example.com" }),
    }));
    const { default: proxy } = await import("@/proxy");
    const req = new Request("https://test.example.com/", {
      headers: { "cf-access-jwt-assertion": "fake-jwt" },
    }) as unknown as NextRequest;
    const res = await proxy(req);
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("returns 401 without Cache-Control on missing JWT", async () => {
    const { default: proxy } = await import("@/proxy");
    const req = new Request("https://test.example.com/") as unknown as NextRequest;
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });
});
```

Adjust mocking strategy to match project conventions (the existing suite uses `vi.doMock` + dynamic import in several places — `tests/unit/deal-actions.test.ts` is a good reference).

### Option 2 — Playwright e2e (end-to-end, slower but real)

Create `tests/e2e/auth-cache-control.spec.ts`:

- Pre-req: deployed staging environment (or local app running through the tunnel — harder to arrange)
- Sign in, navigate to `/`, assert the response `Cache-Control` header contains `no-store`
- This is more realistic but requires infrastructure the codebase doesn't yet have (no staging env spec exists)

Recommendation: **start with Option 1**. Add the Playwright version when a staging env is stood up in a later phase.

## Verification

After adding the test:
- `npm test` → 171/171 (adding 1-2 new assertions to the existing 170)
- Test file intentionally breaks if the Cache-Control line is removed from `proxy.ts` — confirm by commenting out the header line and running the test

## Related

- Debug file with full context: `.planning/debug/2026-04-18-signout-does-not-clear-session-resolved.md`
- Implementing commit: `cc2f459`
- CFA-06 in `REQUIREMENTS.md`
