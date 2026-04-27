# Vendor Management Register

This register lists every third-party data processor the NPR Dashboard touches, what kind of data flows through them, the type of data-processing agreement required, current status, and the owner responsible for keeping it current.

**Purpose:** Supports the GLBA Safeguards Rule written information security program (WISP) requirement to identify and vet vendors with access to customer non-public personal information (NPI). This file is a living reference for the codebase; the authoritative WISP is maintained separately by Mike.

**Review cadence:** Annual review minimum. Also reviewed whenever a vendor is added, removed, or their scope materially changes.

**How to use this file:**
- Each row represents one vendor
- **Status values:** `PENDING` (DPA not confirmed), `ACTIVE` (DPA in place and current), `UNDER_REVIEW` (renegotiation or annual review in progress), `TERMINATED` (no longer used)
- `Data touched` describes what kind of information the vendor has access to. If NPI is involved, say so explicitly.
- `Agreement type` references the class of contract (standard DPA, BAA, custom agreement, none)
- `Owner` is the internal person responsible for this relationship

---

## Vendors

### Cloudflare

| Field | Value |
|---|---|
| Data touched | **All NPI in transit.** Access (authentication + MFA + request logs), Tunnel (network ingress), R2 (document storage — documents may contain NPI). Effectively a gateway to every byte that enters or leaves the system. |
| Agreement type | Standard Data Processing Addendum, accepted via Cloudflare dashboard |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | Single vendor consolidates auth + edge + storage. Zero Trust Free tier (≤50 seats). Access dashboard logs are retained per Cloudflare's Free tier window as a supplementary view only — the app-level `change_history` + `npi_access_log` are the authoritative GLBA audit trail. (Access Logpush is Enterprise-only; long-term retention is a v2 backlog item via cron polling the CF Access API.) **Browser session caveat (2026-04-18):** Microsoft Edge can silently complete the Google OAuth step via Windows Credential Manager / Web Account Manager (WAM) integration — CF Access mints a JWT from WAM-injected credentials without showing the Google account chooser, observable via the JWT's missing `amr` claim. This is working-as-designed Edge+Windows behavior, not a CF or app-side misconfiguration. For account-chooser-visible re-auth testing, use **Chrome incognito** or **Edge "Browse as guest"**, or clear Windows Credential Manager entries for `accounts.google.com`. **Sign-out flow (fixed 2026-04-18, debug `2026-04-18-signout-does-not-clear-session-resolved.md`):** logout now posts to the app-domain endpoint (`portal.utstitle.com/cdn-cgi/access/logout`) to clear the app-specific `CF_Authorization` cookie, and all authenticated responses set `Cache-Control: no-store, private` to prevent browser/CDN cache from serving stale authenticated HTML after sign-out. A proper sign-out correctly clears cookies in all browsers including Edge; on the next visit the OAuth redirect fires genuinely, though Edge+WAM may still complete that OAuth silently (inherent OS behavior). Future consideration: shorten CF Access Application `Session Duration` from 24h to something tighter (e.g. 1h or 4h) if compliance documentation requires a stricter stated re-auth cadence. Structural fix for WAM silent OAuth completion (app-level session layer — the deferred "Option C" from the prior debug) remains available if threat model tightens. |

### Railway

| Field | Value |
|---|---|
| Data touched | Managed Postgres (encrypted DB content; NPI fields are column-encrypted by `lib/crypto.ts`). App compute + `cloudflared` sidecar. |
| Agreement type | DPA via account settings |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | Field-level encryption in `lib/crypto.ts` limits blast radius if DB credentials or a backup are mishandled. Master key is a Railway env var (`ENCRYPTION_KEY`, 32-byte base64) with 1Password backup for disaster recovery. Key rotation supported via dual-key read window. |

### Google (Gmail API)

| Field | Value |
|---|---|
| Data touched | Gmail thread content (per-user OAuth, on-demand fetch). NPI possible — loan-related emails often contain SSN fragments, account numbers, income. |
| Agreement type | Per-user Google account DPA (or Workspace DPA if applicable). Scopes limited to `gmail.readonly` + `gmail.send`. |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | **Separate from Cloudflare Access** — Google is used for Gmail API only, not authentication. Each user consents individually when they first open a Gmail-integrated feature. No background polling. |

### Anthropic

| Field | Value |
|---|---|
| Data touched | Text snippets from intake extraction (Haiku) and email polish (Sonnet). May contain NPI **unless redacted**. |
| Agreement type | API account DPA (standard commercial terms) |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | **Mitigation: NPI redaction at the boundary.** `lib/anthropic.ts::redactNPI()` strips SSN patterns, DOB patterns, account numbers, driver-license numbers from any text before an API call. P6 deliverable — no Anthropic calls happen until then. $25/mo hard cap set in Anthropic Console. |

### ClickUp

| Field | Value |
|---|---|
| Data touched | Task metadata (titles, descriptions, statuses, assignments). Linked back to deals via `linked_clickup` table — ClickUp sees deal metadata only. |
| Agreement type | DPA via account |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | **Policy: no NPI in task titles or descriptions.** Enforced in code review (VENDOR-03). Deal-level partner info (which the prototype intentionally stores in a separate `Partner Profiles` ClickUp list, not in the main MAIN_WORKFLOW tasks) does not contain NPI — that list tracks vetting status, not borrower data. |

### GoHighLevel (FundLaunch360)

| Field | Value |
|---|---|
| Data touched | Contact lookup by email (optional enrichment for new-contact creation). Contact metadata may touch NPI (depends on what's stored in GHL). |
| Agreement type | DPA via account |
| Status | PENDING |
| Owner | Mike |
| Date accepted | — |
| Last reviewed | — |
| Notes | P8 deliverable — no GHL calls until then. Read-only from the app's perspective; the dashboard never writes to GHL. |

---

## Changelog

| Date | Change |
|---|---|
| 2026-04-17 | Initial scaffold created as part of Phase 0.5 spec update (Cloudflare Access + R2 + GLBA alignment). All rows PENDING until Mike confirms DPAs. |
| 2026-04-17 (rev 8) | Cloudflare row: clarified Access Logpush is Enterprise-only — dropped from plan; Free tier dashboard log window + app-level layers 1+2 handle GLBA audit. Railway row: master key is Railway env var + 1Password backup (Cloudflare Secrets was workers-only, not reachable from Railway). |
| 2026-04-18 | Cloudflare row: added browser session caveat documenting Microsoft Edge InPrivate + Windows Credential Manager / WAM silent re-auth behavior observed on `portal.utstitle.com` (debug session `2026-04-17-portal-access-denied-resolved.md`). Option A (document) chosen; Option B (shorter Session Duration) noted as future consideration. No code or policy changes. |
| 2026-04-18 | Cloudflare row: updated browser session caveat to reflect code fixes shipped for sign-out behavior (debug `2026-04-18-signout-does-not-clear-session-resolved.md`). `proxy.ts` now emits `Cache-Control: no-store, private` on authenticated responses; `app-header.tsx` uses app-domain logout URL (`/cdn-cgi/access/logout`) instead of team-level. CFA-06 closed. Edge+WAM silent OAuth completion remains an inherent OS behavior (Option C app-level session layer deferred). |

---

## Open items

- [ ] Mike accepts Cloudflare standard DPA in dashboard
- [ ] Mike confirms Railway DPA current via account settings
- [ ] Mike reviews Google DPA (per-user account or Workspace — pending TBD)
- [ ] Mike reviews Anthropic API DPA
- [ ] Mike confirms ClickUp DPA
- [ ] Mike confirms GHL DPA
- [ ] Annual review calendar reminder set (suggest December)
- [ ] Consider adding a vendor risk assessment sub-document once rows are marked ACTIVE
