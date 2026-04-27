---
created: 2026-04-19T19:15:00.000Z
updated: 2026-04-19T19:30:00.000Z
title: Restore mock prototype as design reference — HIGH, P4 gate (merged todo)
area: infra
priority: HIGH
files:
  - (new branch) design-reference/prototype
  - components/ mock/ app/page.tsx app/deal/[id]/page.tsx — restored from git history
  - railway.json (may need per-branch variant for this service)
  - New Railway service — second instance serving mock UI
  - New Cloudflare subdomain + Access application
---

## Problem

The mock prototype dashboard (the pre-DB pixel-polished UI that served as the design contract for all P1–P3 UI work) was removed from master when Phase 0.5.1 moved the real app to `portal.utstitle.com`. Specifically:

- `e2220ce` (2026-04-17) — neutralized `/deal/[id]` mock coupling
- `616378f` (2026-04-17) — rewrote `/` against real DB queries, removing the final mock surfaces

The files that made up the prototype (`components/deals-view.tsx`, `components/deal-detail.tsx`, `mock/deals.ts`, `mock/helpers.ts`, `mock/types.ts`, and ~12 more component files) are all preserved in git history but no longer present in working tree.

**Why this matters NOW, before P4:**

P4 (Gmail Integration + Intake) begins UI work for 3 new surfaces: the intake form variants, the Linked Emails tab, and the intake-from-paste flow. Without a visual design reference, we'll either:

1. Redesign these surfaces from scratch (wasted work — the prototype already designed them)
2. Build them guessing what Carrie expects, then rework after UAT feedback (slow + frustrating)
3. Reference the prototype from git history as dead code (unreviewed, un-runnable, eyeball-read only)

A side-by-side running prototype at a separate URL solves all three: P4 UI can be built by loading the prototype in one tab and the live dashboard in another, comparing pixel-by-pixel. This is also how the upcoming **visual regression baseline** todo becomes actionable — the prototype is the "known-good visual" that informs what the production baseline should match.

## Audiences

This single deployment serves two audiences with different access shapes:

| Audience | Access needed | Authentication |
|---|---|---|
| **Design reference** (us — developers + Carrie for UI comparison) | Always on; daily during P4+ UI work | Same CF Access allow-list as prod (Mike + Carrie) |
| **External demo** (stakeholders, training, recruiting) | Occasional; by invitation | Widened CF Access allow-list OR time-boxed email-OTP policy |

**Strategy:** Ship with the narrow (design-reference) allow-list. When a specific demo need comes up, temporarily widen the Access policy for that session, then revert. This avoids the "always-exposed demo URL" risk while keeping the dev-facing reference always available.

## Scope

**Phase A — Restore the prototype to a runnable state** (~1 hour, local work):

1. Create a new branch `design-reference/prototype`
2. `git checkout 616378f~1 -- components/ mock/ app/page.tsx app/deal/[id]/page.tsx` — pulls the prototype files back without touching current master state. The `616378f~1` anchor is the commit right before the mock-removing rewrite landed.
3. Resolve any dependency drift (package.json may have moved forward; shadcn primitives may need adjustment; Next.js 16 breaking changes may require small edits)
4. Run `npm install && npm run dev` locally — confirm the prototype still renders and interacts as originally designed
5. Commit the restored state on `design-reference/prototype` branch only — do NOT merge to master

**Phase B — Deploy as a second Railway service** (~30 min, operator work in Railway + Cloudflare dashboards):

1. In Railway dashboard: create new service `npr-dashboard-design-ref` from the same GitHub repo, pointing to `design-reference/prototype` branch (NOT master)
2. Generate a public domain (either `design-ref.up.railway.app` default or a custom subdomain like `design.utstitle.com`)
3. Configure CF Access application for this new URL with the same policy shape as portal.utstitle.com (only Mike + Carrie initially)
4. Verify: operator navigates to the new URL, confirms it renders the pre-P0.5.1 prototype visually identical to the old experience

**Phase C — Update DEPLOY.md** (~10 min):

1. Add `design-reference/prototype` branch to the repo's branching strategy section
2. Document the second Railway service in the env inventory
3. Note in CLAUDE.md that the design reference URL is available for P4+ UI work
4. Add to §6 Recovery Runbook: if the design-reference service goes down, what to do (usually: nothing — it's non-critical)

## Acceptance

- [ ] `design-reference/prototype` branch exists on origin, contains a runnable copy of the mock UI from ~2026-04-17
- [ ] A working CF-Access-gated URL serves the prototype visually identical to the pre-P0.5.1 state
- [ ] URL is documented in DEPLOY.md §2 (Env Var Inventory) + CLAUDE.md
- [ ] P4 plan-phase output references this URL as the design source-of-truth for new UI surfaces
- [ ] Widening the CF Access policy for external demo is a documented operation (not a code change)

## Preconditions

- Second Railway service seat (Hobby plan allows 5, currently using 3; room for 2 more)
- Cloudflare Access application + subdomain config (30 min of dashboard work)
- **Cannot start before** all Railway/CF dashboard work from today's session is settled (don't multi-task config changes)

## Priority rationale — why HIGH

P4 starts adding UI. Without the prototype running, every P4 UI plan will have to reference git history to recover design intent, which is slow and error-prone. Investing ~2 hours now to restore it saves potentially days of design drift across P4–P6. Also unblocks the visual-regression-baseline todo which depends on it.

## Related

- `2026-04-19-visual-regression-baseline-before-p4.md` — the baseline-capture todo; needs this prototype to inform "what should the baseline look like"
- Commits `e2220ce` + `616378f` — where the prototype was retired
- Commit `5d9b054` — where the PROTOTYPE banner itself was removed

## History

- 2026-04-19 18:13 UTC — Created as MEDIUM priority for external-demo audience
- 2026-04-19 19:15 UTC — Second todo created at HIGH priority for design-reference audience
- 2026-04-19 19:30 UTC — Operator merged the two: one Railway service, one deployment, serves both. Removed the demo-audience duplicate; this file now covers both audiences via CF Access policy widening, not separate deployments.
