---
status: partial
phase: 01-core-data-model
source: [01-VERIFICATION.md]
started: 2026-04-17T22:10:00Z
updated: 2026-04-18T22:55:00Z
---

## Current Test

[partial — automation blocked; tests 1+2 pending manual operator review; test 3 blocked on CF Access session replay]

## Tests

### 1. Visual UAT of `/deal/new` accordion form
expected: Three accordion sections render ("File basics" open, "Property details" collapsed, "Financials & dates" collapsed). Track selector shows 8 options with colored dots (TE blue, FL green, DP purple, PO pink, EC amber, SL rose, BL teal, GI gray). Selecting a track pre-fills Priority with the track's default. Property State shows US codes. File # preview pill reads `Will be assigned: ~XX-2026-{nnnn}` then updates to `~{STATE}-2026-{nnnn}` after state selection. Money fields (sales_price, loan_amount, estimated_down, earnest_money, est_rehab, arv) show `$` prefix and format on blur (e.g. "485000" → "$485,000"). Closing/Funding date popover shows a calendar. Sticky footer with Cancel (outline) + Create Deal (primary). Inline field errors on blur; toast on submit with errors. Pixel-level match to UI-SPEC Page 2.
result: [pending]

### 2. Visual UAT of `/` list view (5-second-glance test)
expected: Columns appear left→right in VIEW-01 order (Tracking, Priority, File #, Main Contact, Address, Milestone, Progress/Next Task, Task Due By, Quick Note, Activity). Track badges render with 8 distinct pastel backgrounds. Priority pills show HIGH (red dot+pill), MEDIUM (amber dot+pill), LOW (hollow gray). File # is mono-spaced, clickable. Em-dash placeholder is visually subtle. Activity column renders relative time ("2m", "yesterday"). Row click navigates to `/deal/{id}`; File # cmd-click opens new tab. Filter bar: Needs me toggles primary fill; multi-selects show count; date popovers work; Clear all appears only when a filter is set. Default sort is activity_desc. **Core-value check: Carrie can glance at the dashboard and identify what needs attention within 5 seconds.**
result: [pending]

### 3. End-to-end deal creation through Cloudflare Access (production)
expected: From a fresh browser session — navigate to https://portal.utstitle.com, Cloudflare Access challenges with Google IdP sign-in (MFA deferred to later phase per operator direction 2026-04-18), land on `/` dashboard list, click "New Deal", fill out a deal (track=TE, priority inherited, title, property_state=TX, money fields), submit, verify redirect to `/?created=TX-2026-NNNN` with success toast, verify the new row appears in the list with the correct file_no. Check `audit_log` table (via psql) for the create row. **Browser note:** in Edge, the Google sign-in step may complete silently via Windows Credential Manager / WAM — that's expected (documented in VENDORS.md); what matters is whether a fresh incognito/Guest window ends up authenticated as the correct user with a working session.
result: blocked
blocked_by: cf-access-automation-session-replay
reason: "Playwright automated UAT against CF-Access-gated prod was attempted via two paths (service token + session cookie replay) during the 2026-04-18 session. Both blocked at the CF Access layer — service token required policy-binding dashboard work, cookie replay returned `auth_status: NONE` (session invalidated, likely by CFA-06 sign-out testing earlier in the session). Full investigation captured in `.planning/todos/pending/2026-04-18-playwright-uat-cf-session-replay-blocker.md`. Operator can still exercise this flow manually in a browser (~2 min) — the automation blocker does NOT indicate a P1 feature bug."

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
