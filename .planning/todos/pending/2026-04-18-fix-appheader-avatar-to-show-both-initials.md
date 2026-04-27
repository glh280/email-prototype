---
created: 2026-04-18T19:25:30.263Z
title: Fix AppHeader avatar to show both initials
area: ui
files:
  - components/app-header.tsx
  - lib/current-user.ts
  - tests/unit/current-user.test.ts (if exists, else create)
---

## Problem

The `AppHeader` avatar in the top-right of the deployed app (`portal.utstitle.com`) renders a single first-character initial (e.g., `"M"`) instead of both initials (`"MM"` for Mike Miller).

Discovered during Phase 0.5.1 CFA-12 verification (2026-04-18). Operator signed in via Cloudflare Access + Google IdP, observed:
- Signed-in user: Mike (expected initials: `"MM"` from "Mike Miller")
- Avatar rendered: `"M"` (only first character of first name)

**Scope — why this is LOW priority:**

The core CFA-12 invariant passed: the avatar DOES reflect the signed-in user's identity (it's `"M"` for Mike, NOT the P0.5-era `"CD"` fallback). The JWT claim is being parsed correctly, the user row is being upserted correctly, and the component is reading the right data. This is purely a display-layer initials-extraction bug.

**Root cause (educated guess, not yet inspected):**

Likely `lib/current-user.ts` or `components/app-header.tsx` is extracting initials via something like:
```typescript
// Current (buggy) — returns first char of first word only
const initials = user.name.split(' ')[0][0]; // "M" for "Mike Miller"

// Correct — returns concatenated first chars of each word
const initials = user.name.split(' ').map(w => w[0]).join(''); // "MM"
```

Or the component is slicing a single character instead of taking initials.

**Why P0.5 didn't catch this:**

P0.5 closure (`P05-CLOSURE.md`) observed a `"CD"` avatar when Mike was signed in — the team correctly identified that as "fallback initials, bug" and deferred SC3 as "likely stale Railway deploy, resolves on redeploy." The fix (CF Access live, JWT parse working) closed P0.5 SC3 at a high level but never snapshot-tested the actual correct-user-correct-initials state. This bug slipped through because P0.5 closure used the wrong-user-avatar as the evidence of the bug, not the right-user-avatar as evidence of the fix.

## Solution

**Approach (fast path — ~15 minutes):**

1. Inspect `components/app-header.tsx` — find the Avatar component and its initials prop source
2. If the initials logic lives in app-header.tsx, add a helper function (or use an existing one) that properly extracts multi-word initials
3. If the initials logic lives in `lib/current-user.ts` (e.g., a `getInitials` or similar helper), fix there
4. Edge cases to handle:
   - Single-word names (e.g., "Greg") → return just `"G"` (1 char)
   - Multi-word names (e.g., "Mike Miller") → return `"MM"` (first char of each word)
   - Names with extra whitespace (e.g., "Mike  Miller") → filter empty strings after split
   - Names longer than 2 words (e.g., "Mike Van Miller") → cap at 2 chars? Or allow 3? Design call — probably 2 for avatar real estate
   - Email-only identity (no display name) → use `email.split('@')[0]` first 1-2 chars uppercased
5. Add unit test in `tests/unit/` (likely `current-user.test.ts` or `app-header.test.ts`) covering the 5 edge cases above

**Recommended command for execution:** `/gsd:fast` or `/gsd:quick` — this is a single-file-ish change with a well-bounded scope and a real test suite to catch regressions.

**Cross-reference:**

- Phase 0.5.1 VERIFICATION.md §Checkpoint 7 (CFA-12) will document the "PASS with single-initial rendering bug" observation when Task 3b closes
- This todo is the follow-up for that observation
- Related debug thread: `.planning/debug/2026-04-17-portal-access-denied.md` (CF Access mike@/info@ policy) — separate issue, not related to initials
