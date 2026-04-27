---
created: 2026-04-18T21:00:05.000Z
title: Correct PLAN.md placeholder CF team domain to actual production value
area: docs
files:
  - .planning/phases/00.5-access-encryption/PLAN.md (lines 255, 281)
---

## Problem

`.planning/phases/00.5-access-encryption/PLAN.md` references `npr.cloudflareaccess.com` as the Cloudflare team domain in two places:

- **Line 255 (Task B1 Step 2):** "Team domain: `npr` → `npr.cloudflareaccess.com` (or your preferred team slug)."
- **Line 281 (`.env.local` example):** `CF_ACCESS_TEAM_DOMAIN=npr.cloudflareaccess.com`

The **actual production team domain is `glh280.cloudflareaccess.com`** (confirmed via JWT `iss` claim inspection 2026-04-18 and via the live sign-in page hostname during the portal-access-denied debug on 2026-04-17).

Risk: anyone configuring env vars from PLAN.md — especially during disaster recovery, staging setup, or onboarding a new developer — will set `CF_ACCESS_TEAM_DOMAIN=npr.cloudflareaccess.com`. This causes `lib/access.ts` JWT `iss` verification to fail against every real Cloudflare-minted JWT, producing 401 from every authenticated request. Silent but total auth breakage.

## Solution

Edit `.planning/phases/00.5-access-encryption/PLAN.md`:

1. **Line 255:** Update "Team domain: `npr` → `npr.cloudflareaccess.com`" to reflect actual production value — either update to `glh280` → `glh280.cloudflareaccess.com`, OR keep `<team>` as a placeholder with an explicit note "actual production value is `glh280.cloudflareaccess.com` (set 2026-04-17 during P0.5 Stage B)"
2. **Line 281:** Update the `.env.local` example: `CF_ACCESS_TEAM_DOMAIN=glh280.cloudflareaccess.com`
3. Also check `.env.example` at repo root — if it has the same stale placeholder, update it consistently.

Optionally: add a short "Actual values" reference table at the end of Task B1 listing the real production team domain + AUD tag (AUD can be referenced as "see Railway env var `CF_ACCESS_AUD` for current value" without exposing it in docs).
