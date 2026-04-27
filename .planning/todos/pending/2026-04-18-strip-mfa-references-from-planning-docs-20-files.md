---
created: 2026-04-18T21:00:10.000Z
title: Strip MFA references from planning docs — 20 files, MFA formally deferred
area: docs
files:
  - .planning/REQUIREMENTS.md (CFA-05)
  - .planning/ROADMAP.md (line 62)
  - .planning/PROJECT.md (line 62)
  - .planning/STATE.md (lines 34, 84, 106, 136, 268 — keep historical session log as-is, only update forward-looking sections)
  - .planning/VENDORS.md (line 24 — already updated with browser caveat, may need MFA-specific scrub)
  - .planning/template-extraction-plan.md (lines 206, 224)
  - AUDIT.md (lines 45, 359)
  - .planning/phases/00.5-access-encryption/CONTEXT.md (lines 14, 34)
  - .planning/phases/00.5-access-encryption/PLAN.md (covered by sibling todo — MFA Require rule strip)
  - .planning/phases/00.5-access-encryption/P05-CLOSURE.md (SC4 — reframe from "restoration pending" to "formally deferred")
  - .planning/phases/01-core-data-model/01-HUMAN-UAT.md (line 24)
  - .planning/phases/01-core-data-model/01-VERIFICATION.md (lines 26, 225, 236)
  - .planning/phases/02-deal-detail-tasks-stages/02-HUMAN-UAT.md (line 32)
  - .planning/phases/00.5.1-production-deploy-wire-up/03-deploy-and-verify.md (lines 463, 468, 477, 583)
  - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md (lines 225, 340, 395, 439)
  - .planning/phases/00.5.1-production-deploy-wire-up/00.5.1-PHASE-VERIFICATION.md (lines 161, 181)
  - proxy.ts (line 14 — stale "Google + MFA" JSDoc comment)
---

## Problem

Per operator direction 2026-04-18: MFA is **explicitly deferred to a later phase**, not a temporary compliance debt awaiting 2SV enrollment. Current planning docs still describe MFA as an active requirement / part of the expected auth flow in ~20 places, creating contradictions between:

- The stated architecture (per docs) — CF Access + Google IdP + MFA
- The actual shipped architecture — CF Access + Google IdP only (MFA policy rule removed 2026-04-17 per `P05-CLOSURE.md`)
- The forward plan — MFA is a later-phase deliverable

Secondary risk: the same runbook-as-code pattern that caused today's sign-out bug (stale instructions silently re-introducing removed behavior). The sibling todo `2026-04-18-strip-mfa-require-rule-from-p05-plan-runbook.md` covers the single highest-risk instance (PLAN.md Task B1 Step 5); this todo covers the remaining ~19 files.

## Solution

Edit each file to reflect MFA's deferred status. Grouped by edit type (full file list + canonical line numbers are in `.planning/debug/2026-04-17-portal-access-denied-resolved.md` under §"All 20 files with stale MFA references"):

**Formally mark CFA-05 deferred:**
- `.planning/REQUIREMENTS.md:21` — add `[DEFERRED]` prefix or move to a dedicated "Deferred requirements" section with explicit revisit trigger
- `P05-CLOSURE.md` SC4 — reframe from "Temporarily disabled — restoration pending 2SV enrollment" to "Formally deferred to later phase per operator direction 2026-04-18"

**Scope/requirement descriptions (CF Access vendor descriptions, AUDIT.md, VENDORS.md, CONTEXT.md):** remove "MFA" from "CF Access provides auth + MFA + logs" style descriptions; state "Google IdP auth (MFA deferred)" instead.

**UAT / verification expected-flow docs:** replace "Google IdP + MFA" with "Google IdP" in expected test flow descriptions.

**Code comment:** `proxy.ts:14` — update `→ Cloudflare Access challenges (Google + MFA) if no session` → `→ Cloudflare Access challenges (Google IdP) if no session (MFA deferred to a later phase)`.

**STATE.md historical session log:** **keep as-is** — those are historical records of what was set up and when. Only update forward-looking priority sections.

## Workflow suggestion

Run as `/gsd:quick "strip MFA from planning docs per operator deferral 2026-04-18 — 20 files"`. Atomic commit preserves the narrative shift. Sibling todo (PLAN.md Task B1 Step 5) can roll into same quick-task or stay separate.

**Cross-reference:** canonical file list with line numbers is in `.planning/debug/2026-04-17-portal-access-denied-resolved.md` under §"All 20 files with stale MFA references" (bucket table).
