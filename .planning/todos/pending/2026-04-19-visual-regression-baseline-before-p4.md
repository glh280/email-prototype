---
created: 2026-04-19T18:12:00.000Z
title: Capture visual-regression baseline before P4 — gate P4 on this completing
area: tests
files:
  - tests/e2e/uat/ (new visual-regression spec lands here)
  - .playwright-uat/baseline/ (new — image store on a dedicated branch)
  - playwright.uat.config.ts (may need screenshot-path config additions)
---

## Problem

Today (2026-04-19) production crashed with `TypeError: a.getTime is not a function` the moment the first ClickUp import populated the previously-empty deals table. The bug was in `lib/deals-query.ts` — `sql<Date>` threaded through a CTE returns a string at runtime, but TypeScript thought it was a `Date`, so the unit-test suite (298 tests) passed all day long. It took a **human loading the page** to surface the bug.

Root cause of the miss: the test suite covers unit-level contracts, but it never renders the authenticated pages with populated data and diffs against a known-good image. A visual regression baseline would have caught this in one run.

Every subsequent phase (P4 Gmail + intake, P5 email drafting, P5.5 documents, P6 LLM polish) adds more SSR complexity, more components, more failure modes that unit tests won't surface. Without a baseline captured NOW — against the known-good Phase-3 UI — future phases land blind.

## Scope

Capture full-page screenshots of every authenticated route at known-good current state:

- `/` (deal list) — with Carrie's identity, showing the 17 imported deals + any created after
- `/deal/[id]` — one screenshot per track that has data (GI, FL, DP, EC, PO, TE, SL, BL) — use stable representative deals
- `/contacts`
- `/contacts/[id]` (stub page)
- `/deal/new`

Store baseline under `.playwright-uat/baseline/` on a dedicated branch (e.g. `visual-baseline`) so the binaries don't bloat master history. Screenshots must be taken at a **fixed viewport size** (1280x800 desktop) and **fixed dark/light mode** so the diff has a stable comparator.

Diff strategy: `playwright-visual-comparisons` or `@playwright/test`'s built-in `toHaveScreenshot()` with a small pixel tolerance (~0.1%). The spec runs in CI on every PR once P4 begins.

## Preconditions / unblockers

- **CF Access automation still blocked** per the existing `2026-04-18-playwright-uat-cf-session-replay-blocker.md` todo. The baseline run needs a working Playwright → CF-Access-gated-prod path. Options:
  - (a) Refresh `CF_AUTHORIZATION_COOKIE` in `.env.local` at capture time (ops-heavy, 24h cookie)
  - (b) Convince Cloudflare Access policy to accept the existing service token (dashboard config — hits the "don't touch dashboard" rule)
  - (c) Capture against a local `next start` build with `DATABASE_URL` pointed at prod (hits the Postgres-private-hostname problem)
  - (d) Spin up a staging env (CONTEXT §Staging Environment says no, but worth revisiting if visual regression justifies the ongoing cost)

Option (a) is the pragmatic path for a one-time baseline capture. Option (b) is the right long-term solution if we can get the service token added to the allow rule.

## Acceptance

- [ ] `.playwright-uat/baseline/*.png` contains at least 10 known-good screenshots on the visual-baseline branch
- [ ] A Playwright spec (`tests/e2e/uat/visual-regression.spec.ts`) re-captures current state and diffs against baseline
- [ ] The spec runs cleanly against prod (green) before P4 planning begins
- [ ] P4 plan-phase output references this todo as a pre-flight check

## Priority

HIGH — gate P4. The sql<Date> incident cost ~90 minutes of incident response + rollback + debug + re-import. A visual regression test costs ~10 seconds on every push. Payback: one.

## Related

- `2026-04-18-playwright-uat-cf-session-replay-blocker.md` — auth automation blocker that must be resolved or worked around
- Commit `6b9adfb` — the sql<Date> fix this baseline would have protected against
- Commit `aea4d64` — railway.json + DEPLOY.md §6 recovery runbook (companion preventative measure)
