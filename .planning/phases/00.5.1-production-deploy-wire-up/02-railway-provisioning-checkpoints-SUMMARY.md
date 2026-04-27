---
plan: 02-railway-provisioning-checkpoints
phase: 00.5.1-production-deploy-wire-up
completed: 2026-04-18
operator: glh280
status: complete
---

# Plan 02: Railway Provisioning Checkpoints — SUMMARY

## One-liner

Railway production now has a `Postgres` service (Hobby tier, private network), the app service's `DATABASE_URL` wired as a runtime-resolved reference variable, and all P1 `NEXT_PUBLIC_APP_*` env vars set — three user-gated checkpoints executed entirely via Railway dashboard + CLI, zero code contact.

## Checkpoints executed (3/3)

| # | Checkpoint | Outcome | Key artifact |
|---|-----------|---------|--------------|
| 1 | Provision Railway Postgres (Hobby tier) | Service `Postgres` provisioned, tier confirmed Hobby via Settings → Plan paste-back. Password rotated post-exposure incident. | `postgres.railway.internal` connection established |
| 2 | Wire `DATABASE_URL` reference variable | Required CLI fallback with single-quoted value after UI paths stored literal instead of reference (2 UI attempts failed). CLI resolution authoritative. | `DATABASE_URL=${{Postgres.DATABASE_URL}}` runtime-interpolates to real connection string |
| 3 | Set `NEXT_PUBLIC_APP_*` env vars + P0.5 preservation audit | All 3 values set via CLI matching pinned canonical values. P0.5 CF Access + encryption vars preserved (grep count = 3). | 8 service variables cumulative: 2 CF Access + ENCRYPTION_KEY + DATABASE_URL + 3 NEXT_PUBLIC_APP_* + PORT |

## Key deliverables

- `DATABASE_URL` on `npr-dashboard-prototype` → reference to `${{Postgres.DATABASE_URL}}` (auto-propagates rotation)
- `NEXT_PUBLIC_APP_NAME=NPR Dashboard`
- `NEXT_PUBLIC_APP_DOMAIN=portal.utstitle.com` (bare domain, Zod-compliant)
- `NEXT_PUBLIC_APP_BRAND_COLOR=#0F172A` (canonical default, deterministic)
- Postgres service provisioned (Hobby tier, ~$5/mo, weekly snapshots, `postgres.railway.internal`)

## Tribal knowledge captured

1. **Password exposure → rotate immediately while blast radius is zero.** Railway-generated Postgres passwords landed in chat + terminal scrollback during paste-back. Rotated via Railway dashboard before wiring the reference variable; zero downstream impact because no service was yet consuming the creds.

2. **UI "+ New Variable" stores references as literals.** Railway's web UI variable form (tested via both direct + "Add Variable" banner flows) stored `${{Postgres.DATABASE_URL}}` as a literal string in this Railway version. `{}` icon rendered instead of chain icon. CLI resolution returned the literal `${{...}}` placeholder, confirming the reference never registered.

3. **CLI with single-quoted value is the reliable path.**
   ```bash
   railway variables --service <svc> --set 'KEY=${{Other.VAR}}'
   ```
   Single quotes prevent the shell from expanding `${{...}}` as a shell variable reference. This is now the recommended path for all future reference-variable setup in this project.

4. **UI vs CLI authority: CLI wins.** Railway UI icon remained `{}` even after CLI-set reference functioned correctly. CLI `railway variables --kv | grep ^KEY=` output is the authoritative signal — a resolved value confirms the reference, a literal `${{...}}` placeholder confirms it's broken.

5. **`railway variables --set` is upsert, not replace.** Confirmed empirically: 3 new `NEXT_PUBLIC_APP_*` vars added without clobbering the 3 P0.5-era vars (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ENCRYPTION_KEY`). Grep count verification confirmed preservation.

## Acceptance criteria (Plan 02)

All `must_haves.truths` from plan frontmatter satisfied:

- [x] Postgres service provisioned on Hobby tier (operator paste-back confirmed tier, not just presence)
- [x] `DATABASE_URL` on app service is a reference (`${{Postgres.DATABASE_URL}}`), CLI-resolved to a real connection string
- [x] CLI resolution substitutes for UI "linked badge" signal (Railway UI version variance documented; CLI is authoritative)
- [x] `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_APP_BRAND_COLOR` all set with pinned canonical values (no runtime forking)
- [x] `NEXT_PUBLIC_APP_DOMAIN` is a bare domain (passes Zod regex `/^[a-zA-Z0-9.-]+$/`)
- [x] `NEXT_PUBLIC_APP_BRAND_COLOR` is `#0F172A` (canonical default applied since `.env.local` had key empty)
- [x] Every checkpoint captured in `00.5.1-VERIFICATION.md`
- [x] P0.5 CF Access + encryption vars untouched (3/3 grep-verified)
- [x] No `git push` triggered by this plan

## Self-Check

**Self-Check: PASSED** (no FAILED marker; all acceptance criteria satisfied with operator paste-back evidence)

## Requirements closed

- **DEPLOY-07**: Railway Postgres provisioned + DATABASE_URL wired as reference variable (Checkpoints 1 + 2)
- **DEPLOY-08**: All 3 NEXT_PUBLIC_APP_* env vars set with pinned canonical values (Checkpoint 3)

## Files modified

- `.planning/phases/00.5.1-production-deploy-wire-up/00.5.1-VERIFICATION.md` — Checkpoints 1–3 logged with full operator paste-back
- `.planning/phases/00.5.1-production-deploy-wire-up/02-railway-provisioning-checkpoints-SUMMARY.md` — this file

## Next (Plan 03 — Wave 3)

Deploy + verify: operator pushes master, Claude monitors prestart migration, operator authorizes seed after ENCRYPTION_KEY trailing-`=` sanity check, Claude runs seed + readback + INITIAL_SEED_VERIFICATION.md diff, CFA-11 curl verification, CFA-12 incognito browser avatar verification. Closes Phase 0.5.1.
