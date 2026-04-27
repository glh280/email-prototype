---
status: partial
phase: 02-deal-detail-tasks-stages
source: [02-VERIFICATION.md]
started: 2026-04-17T23:00:00Z
updated: 2026-04-17T23:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual UAT of /deal/[id] — 4 mutation dialogs (advance, revert, close, kill)
expected: Each dialog matches UI-SPEC copy verbatim; AlertDialog role (role="alertdialog"); two-click confirm (dialog open + explicit primary CTA); toast fires with correct copy after mutation (advance: "Advanced to {label}"; revert: "Reverted to {label}"; close: "Marked closed"; kill: "Deal killed — {reason}"); page refreshes post-mutation; killed deals show overflow menu items as disabled ("Deal is killed"/"Deal is closed"). Destructive variant on Kill + Revert.
result: [pending]

### 2. 5-second undo toast on task complete — timing + copy variants
expected: After clicking "Complete" on a task, a Sonner toast appears with the appropriate copy and an Undo button. Copy variants: (a) no promotion + no stage advance → "Task completed. No next task."; (b) new is_next promoted → `Task completed. Next task is now "{newIsNext.title}". Undo?`; (c) stage auto-advanced → `Task completed. Milestone advanced to {stageAdvanced.toLabel}. Undo?`. Toast persists ~5 seconds. Clicking Undo reverses the mutation AND (if auto-promote happened) restores the prior is_next; if stage was auto-advanced, audit-lookup revert fires (via triggeringTaskId breadcrumb) OR aborts gracefully with "Cannot safely revert stage" toast if the audit row is missing.
result: [pending]

### 3. Audit tab filter chips URL-state behavior
expected: Clicking a filter chip (All/Deal/Tasks/Notes/Stage) pushes to URL `?tab=audit&auditFilter=<key>`. Page reloads (via router.push) with filtered rows. Invalid filter values (e.g., hand-typed `?auditFilter=garbage`) silently fall back to 'all' — no error. Chip active state (fill) reflects current filter. "Clear" or clicking "All" returns to unfiltered state.
result: [pending]

### 4. Stepper pip-click affordance — revert to past stage
expected: Past pips (completed stages) show cursor:pointer and visible focus ring on keyboard tab; clicking opens the RevertStageDialog with the target stage pre-filled. Current pip shows filled-primary + label. Future pips are disabled (cursor:default, no hover state). Keyboard navigation: Tab moves through pips; Enter/Space on a past pip opens revert dialog. Tooltips on hover show stage label + "Click to revert" for past pips.
result: [pending]

### 5. End-to-end flow through Cloudflare Access
expected: Navigate to https://portal.utstitle.com in a fresh browser session. Complete CF Access + Google IdP + MFA. Land on `/`. Click "New Deal" → create a test deal (track=TE, state=TX). Redirect to `/` with success toast. Click the new deal → lands on `/deal/[id]` with Overview tab active. Advance stage via dialog → toast + audit entry. Add a task via Tasks tab → task appears with is_next accent bar if first task. Kill the deal via overflow menu → reason required + system note appended + 2 audit rows. Open Audit tab → all mutations appear in reverse-chron with before→after diffs. Filter to 'Stage' → only stage.advance + stage.revert rows visible.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
