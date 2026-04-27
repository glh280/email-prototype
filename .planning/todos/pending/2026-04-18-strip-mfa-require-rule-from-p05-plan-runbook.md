---
created: 2026-04-18T21:00:00.000Z
title: Strip MFA Require rule from P0.5 PLAN.md setup runbook
area: docs
files:
  - .planning/phases/00.5-access-encryption/PLAN.md (lines 248, 267, 269, 826, 847)
---

## Problem

`.planning/phases/00.5-access-encryption/PLAN.md` Task B1 Step 5 still instructs operators to add:

> - Require: **Multi-factor Authentication**

This is a **live runbook** that anyone recreating or duplicating the Cloudflare Access Application will follow. If MFA is deferred per operator direction 2026-04-18, the PLAN.md instruction will silently re-introduce MFA every time a new Access Application is stood up (prototype recreation, staging environment, disaster recovery, etc.).

This was the likely pathway by which MFA got re-enabled on the `portal.utstitle.com` Access Application during P0.5.1 domain migration — the MFA Require rule had been removed on 2026-04-17 per `P05-CLOSURE.md` SC4, but PLAN.md never reflected that decision.

## Solution

Edit `.planning/phases/00.5-access-encryption/PLAN.md`:

1. **Line 267:** Remove the `Require: Multi-factor Authentication` bullet from Task B1 Step 5
2. **Line 269:** Change "you should be prompted for Google + MFA" → "you should be prompted for Google sign-in"
3. **Line 248 (section header):** Change "Task B1 `[USER]` — Cloudflare Zero Trust + Access application + Google IdP + MFA + policy" → "...+ Google IdP + policy (MFA deferred)"
4. **Lines 826 + 847:** Update the phase-closure verification list entries that reference "Google + MFA" to reference "Google" only, or add a deferred note pointing to `P05-CLOSURE.md` SC4
5. Add a brief inline note at Task B1 Step 5: *"MFA deferred per operator direction 2026-04-18. Restoration runbook in `P05-CLOSURE.md` SC4 when 2SV enrollment completes in Google Workspace."*

Related: `CFA-05` in `REQUIREMENTS.md:21` should also be marked explicitly deferred (rolled into the broader MFA docs cleanup todo).
