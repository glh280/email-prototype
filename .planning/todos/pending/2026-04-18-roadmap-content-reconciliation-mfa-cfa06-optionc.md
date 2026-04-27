---
created: 2026-04-18T21:45:00.000Z
title: Reconcile ROADMAP.md content drift — MFA deferral, CFA-06 closure, Option C placement
area: docs
files:
  - .planning/ROADMAP.md (lines 52-75 for P0.5, lines 291-303 for P10, new section TBD for Option C)
  - .planning/REQUIREMENTS.md (CFA-05 status, possible new requirement for app-level session layer)
---

## Problem

Three content-level drift points in ROADMAP.md surfaced during the 2026-04-18 CF Access investigation but NOT fixed inline (structural mechanical fixes were landed in the same session — this todo captures the remaining content decisions that need operator judgment).

Related to the ROADMAP structural fixes committed 2026-04-18: header count, missing P0.5.1 overview row, P2 row column shape, acceptance gate number alignment. All mechanical; content decisions split to this todo per operator direction "don't make the Option C strategic decision mid-session."

### Item 5 — Phase 0.5 SC4 "MFA prompt fires on first Access login"

**File:** `.planning/ROADMAP.md` line 62 (`Phase 0.5 Success criteria` list)

**Current state:** Listed as a success criterion, but:
- MFA Require rule was REMOVED on 2026-04-17 per `P05-CLOSURE.md` SC4 (to let 4 users sign in without 2SV enrollment)
- Operator formally DEFERRED MFA to a later phase on 2026-04-18 (not "temporarily disabled — restoration pending 2SV")
- Phase 0.5 is marked "Complete" in the Phase Status line

**The contradiction:** An active success criterion for a closed phase that was never met.

**Decision needed:**
- Option 5a: Mark SC4 as `[deferred]` with inline pointer to `P05-CLOSURE.md` and updated "deferred to later phase" language
- Option 5b: Remove SC4 entirely, renumber SCs 5-9 as 4-8, and add a §Deferred criteria note
- Option 5c: Leave SC4, add a footnote explaining the deferral, keep Phase Status "Complete"

Related action: `REQUIREMENTS.md:21` (CFA-05) needs the same deferral treatment — see sibling todo `2026-04-18-strip-mfa-references-from-planning-docs-20-files.md`.

### Item 6 — CFA-06 (Sign-out clears Cloudflare Access session) closure not reflected

**Current state:** Phase 0.5 Phase Status line (line 75) says "Complete — 11 commits shipped 2026-04-17" with no mention that CFA-06 was actually delivered 2026-04-18 via commit `cc2f459` (Cache-Control + app-domain logout URL fix). A reader working backward from "is CFA-06 done?" gets no signal from ROADMAP that it shipped.

**Decision needed:**
- Add a post-closure note to P0.5 Phase Status section: *"CFA-06 finalized 2026-04-18 — see commit `cc2f459` and debug file `.planning/debug/2026-04-18-signout-does-not-clear-session-resolved.md`"*
- OR: treat the CFA-06 closure as belonging to a new retroactive post-phase entry elsewhere

Simplest: append to Phase 0.5 Phase Status. One line, no restructuring.

### Item 7 — Deferred Option C (app-level session layer) has no roadmap placeholder

**Context:** During the 2026-04-18 Edge+WAM debug resolution, three options were considered for blocking silent OS-layer OAuth completion on Edge:
- Option A (chosen): document as working-as-designed, no code change
- Option B (future consideration): shorten CF Access Session Duration
- **Option C (deferred): app-level session layer** — shape preserved from the "sat aside" P0 Auth.js specs (`app/(auth)/sign-in/page.tsx` + `middleware.ts` pattern, now applied as secondary auth layer ON TOP OF CF Access)

Option C is the ONLY structurally-complete fix for WAM silent OAuth — app-level session challenge is outside WAM's scope. It's tracked in the resolved debug files + VENDORS.md as "deferred, revisit trigger: threat model tightens / Carrie uses non-corporate-managed devices / MFA restored in later phase."

**But there's no home for it in ROADMAP.** If the threat model tightens and this becomes a real deliverable, we have no phase number, no placement decision, no requirement ID.

**Decision needed (operator judgment — strategic, NOT mechanical):**

**Option 7a — Insert as Phase 0.6 `App-Level Auth Layer`**, positioned between P0.5 and P0.5.1 (or after P0.5.1). Pro: keeps the auth-work cluster together. Con: inserts between already-completed phases, odd numbering feel.

**Option 7b — Insert as Phase 10.5 `Hardening`** — alongside calibration-week cleanup, before v1 Acceptance Gate. Pro: late enough that threat model is clearer. Con: stays deferred for a long time.

**Option 7c — Add a new "## Deferred / Backlog" section** at the end of ROADMAP (after Acceptance Gate) that lists non-mandatory future work with revisit triggers. Option C goes there. Pro: honest "we might not do this" framing. Con: no scheduling; easy to forget.

**Option 7d — Make it a v2 milestone** — explicitly out of scope for v1, recorded in MILESTONES.md (if that file exists) or a roadmap footnote. Pro: crystal-clear scoping. Con: pushes the decision to milestone planning.

**Related requirement (new):** would need a `CFA-14` or similar in REQUIREMENTS.md defining the app-level session behavior.

## Solution

Run when ready to make these three content decisions:

1. Pick 5a / 5b / 5c for MFA SC4
2. Add the CFA-06 closure note to P0.5 Phase Status (one-line edit)
3. Decide 7a / 7b / 7c / 7d for Option C placement + file the decision in a one-commit ROADMAP edit

Can be done as one `/gsd:quick "reconcile ROADMAP content — MFA deferral + CFA-06 closure + Option C placement"` — short session with operator input on three choice points.

## Why not fixed inline today

Operator direction 2026-04-18: "X. Fix the 4 mechanical issues, capture 5-7 as a todo, then back to A.1 TDD. Don't make the Option C strategic decision mid-session." Strategic decisions deserve their own focused context rather than being folded into a tactical TDD session.
