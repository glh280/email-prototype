---
created: 2026-04-18T21:00:15.000Z
title: Remove stale PROTOTYPE banner from app/layout.tsx — misleads real users
area: ui
files:
  - app/layout.tsx (lines 16-19 and 32-34)
---

## Problem

`app/layout.tsx` renders an amber banner on every page with text that is no longer true:

```tsx
// line 32-34
<div className="bg-amber-500/90 text-black text-xs font-medium tracking-tight py-1.5 px-4 text-center shadow-sm">
  PROTOTYPE — mock data only · no login · no database · no integrations · actions are simulated
</div>
```

All four claims are false post-P0.5:
- ❌ "mock data only" — app reads real Postgres via Drizzle (P1)
- ❌ "no login" — CF Access + Google IdP gates every request (P0.5)
- ❌ "no database" — Postgres provisioned and seeded (P0.5.1 verified 8 tracks + 25 stages in prod)
- ❌ "actions are simulated" — Server Actions write real audit log rows (P1/P2, 170/170 tests green)

Additionally, `metadata.title` at line 17 still says `"NPR Dashboard (prototype)"` — browser tab reads this.

## Risk

- **User confusion** — Carrie, partners, or any stakeholder viewing the app sees a banner contradicting what the app actually does
- **Liability signal** — for a system handling NPI and governed by GLBA, a banner claiming "no real data, actions are simulated" is dangerously at odds with reality. A compliance reviewer seeing this and then noticing NPI in the database would have a reasonable question
- **Demo credibility** — sharing the URL with anyone shows a banner that undermines trust in the work

## Solution

Edit `app/layout.tsx`:

1. **Delete the banner** (lines 32-34 — the amber `<div>`)
2. **Update metadata** (lines 16-19):
   - `title: "NPR Dashboard (prototype)"` → `title: "NPR Dashboard"`
   - `description: "Visual prototype — mock data, nothing is real."` → something accurate, e.g. `"Deal-centric dashboard for UTS title/lending/deal desk operations."` (match `CLAUDE.md`'s Project description)
3. Verify: `npm run build` still passes + `npx tsc --noEmit` clean.

Suggested commit: `fix(ui): remove stale PROTOTYPE banner + update layout metadata — P0.5+ ships real auth, DB, and mutations`.

## Related

- Project description for reference: `.claude/CLAUDE.md` → `## Project` section ("A visual, deal-centric dashboard for Carrie Davis…")
- This should probably run through `/gsd:quick` or a small inline fix; no planning artifact needed.

---

## Resolution (2026-04-18)

Banner removed + metadata updated. Changes:

- `app/layout.tsx` — deleted the amber `<div>` (lines 32-34)
- `metadata.title`: `"NPR Dashboard (prototype)"` → `"NPR Dashboard"`
- `metadata.description`: `"Visual prototype — mock data, nothing is real."` → `"Deal-centric dashboard unifying title, lending, deal desk, consulting, and partnership tracks for UTS/STM operations."`

Verification: `npx tsc --noEmit` clean, `npm test` 170/170 green. Build skipped (no structural change).

Completed inline before P1 UAT per operator direction 2026-04-18 — so UAT validates real app state, not app-plus-misleading-banner state.

**Moved to `done/`.**
