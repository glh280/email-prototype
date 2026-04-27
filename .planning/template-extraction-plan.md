# Template Extraction Plan — `glh280/nextjs-cf-access-starter`

**Purpose:** Handoff contract for a separate Claude Code session to extract the auth + encryption shell of NPR Dashboard into a reusable starter template for future consulting apps.

**Source repo:** `glh280/npr-dashboard-prototype` (this repo, at `C:\NPR_Dashboard`)
**Target repo:** `glh280/nextjs-cf-access-starter` (new, does not exist yet)
**Scope:** Full GLBA-grade stack — CF Access auth + Tunnel + column-level NPI encryption + 3-layer audit

**Author:** drafted 2026-04-17 during NPR debugging session while decisions were fresh
**Executor:** a separate Claude Code instance, invoked when the user is ready (likely post-NPR-P1 ship, or as a parallel side task)

---

## Why a separate session

Current session is focused on shipping NPR Dashboard v1. Template extraction is valuable but not on the critical path. A fresh Claude Code instance:
- Preserves this session's context window for NPR work
- Forces the template to be usable without tribal knowledge of NPR decisions
- Lets extraction happen asynchronously with clean git hygiene

---

## Handoff prompt (paste this into the new session)

```
I want to extract the Cloudflare Access + Tunnel + NPI encryption + audit shell from my
NPR Dashboard project into a reusable Next.js starter template. The source project is at
C:\NPR_Dashboard on this machine. The target is a new GitHub repo glh280/nextjs-cf-access-starter.

Read .planning/template-extraction-plan.md in the source repo for the full contract —
what to extract, what to strip, what to genericize, setup checklist, and smoke test script.

Do NOT modify the source repo except to update STATE.md with a note that template extraction
happened. Work in a new directory (e.g., C:\Users\glh28\Projects\nextjs-cf-access-starter)
and create the new repo there.

Break the work into 4 phases and commit after each:
1. Scaffold new repo + copy auth shell files verbatim
2. Genericize env vars and hardcoded strings (NPR → APP_NAME etc.)
3. Write setup checklist (README.md) and smoke test script
4. Verify on a throwaway Railway project end-to-end

Start by reading .planning/template-extraction-plan.md. Confirm you understand the scope
before writing any code.
```

---

## Scope — what's in the template

### Layer 1: Edge auth (MUST EXTRACT)

**Files to copy verbatim:**
- `lib/access.ts` — CF Access JWT verification with JWKS + test helpers
- `lib/current-user.ts` — reads JWT from headers, upserts user, returns canonical record
- `lib/users.ts` — find/upsert by email from Access claims
- `proxy.ts` (or whatever the middleware file is called) — edge JWT enforcement
- `lib/env.ts` — Zod-validated env module (extract CF_ACCESS_* portion; drop NPR-specific vars)
- `components/app-header.tsx` — generic avatar + logout header (replace "NPR Dashboard" with `APP_NAME`)

**Tests to copy:**
- `tests/unit/access.test.ts` — JWT verification test suite (6 tests)
- Any `tests/e2e/*` that tests the sign-in happy-path

### Layer 2: Infrastructure (MUST EXTRACT)

- `railway/tunnel/Dockerfile` — cloudflared sidecar (already generic — just keep as-is)
- `docker-compose.yml` — local Postgres for dev
- Root `.env.example` — with CF_ACCESS_*, TUNNEL_TOKEN, DATABASE_URL, ENCRYPTION_KEY placeholders

### Layer 3: Encryption + audit (MUST EXTRACT — this is the GLBA-grade differentiator)

**Files to copy:**
- `lib/crypto.ts` — `@47ng/cloak` wrapper with non-skippable audit invariant
- `db/schema.ts` sections for `users` and `npi_access_log` tables only

**Tests to copy:**
- `tests/unit/crypto.test.ts` — encrypt/decrypt round-trip + audit invariant tests

### Layer 4: UI shell (COPY GENERICALLY)

- `components/ui/*` (shadcn components — avatar, dropdown-menu, button, etc.)
- A minimal `app/page.tsx` that shows "Welcome, {user.name}" — demonstrates the auth flow works
- `app/layout.tsx` — basic with AppHeader and a body

---

## What to strip (DO NOT include in template)

### NPR-specific schema
- `deals` table and all related tables (`stages`, `tracks`, `deal_people`, `tasks`, `notes`, `email_drafts`, `linked_emails`, `linked_clickup`, etc.)
- Any schema rows referring to deal / task / stage concepts

### NPR-specific routes
- `app/deal/*` — all deal detail routes
- `app/contacts/*` — if exists
- `app/kanban/*` — if exists
- Any NPR-specific API routes

### NPR-specific UI
- Anything in `components/` that references deals, stages, milestones, tasks
- `mock/deals.ts` and all mock data
- The orange "PROTOTYPE — mock data only" banner
- Any dashboard-specific layouts

### NPR-specific planning / docs
- `.planning/` — entirely (too much NPR-specific context; template gets a fresh empty `.planning/` with just a placeholder)
- `AUDIT.md` at repo root — this is the prototype-to-production audit, NPR-specific
- Any phase-specific planning artifacts

### NPR-specific config
- `CLAUDE.md` — keep a generic version mentioning Cloudflare Access + Railway but strip project-specific details
- `AGENTS.md` — keep the Next.js 16 warning + generic content; strip project references
- Railway project config specific to NPR

---

## Environment variables to genericize

| NPR value | Template placeholder | Notes |
|-----------|---------------------|-------|
| `CF_ACCESS_TEAM_DOMAIN=glh280.cloudflareaccess.com` | `CF_ACCESS_TEAM_DOMAIN=<your-tenant>.cloudflareaccess.com` | Explain in setup |
| `CF_ACCESS_AUD=49791d0e...` | `CF_ACCESS_AUD=<from-cf-access-app-overview>` | 64-char hex |
| `TUNNEL_TOKEN=<npr-specific>` | `TUNNEL_TOKEN=<from-cf-tunnel-create>` | |
| `DATABASE_URL=postgres://npr:npr@localhost:5432/npr_dashboard` | `DATABASE_URL=postgres://user:pass@localhost:5432/myapp` | Local dev value |
| `ENCRYPTION_KEY=<32-byte-base64>` | `ENCRYPTION_KEY=<generate-with-openssl-rand>` | Include generation command in setup |
| Hardcoded app name "NPR Dashboard" | `APP_NAME=` env var read by `app-header.tsx`, `package.json` name, etc. | |
| Hardcoded domain "portal.utstitle.com" | `APP_DOMAIN=` env var | |

---

## Target repo structure

```
nextjs-cf-access-starter/
├── README.md                        # Setup checklist + smoke test instructions
├── .env.example                     # All required env vars with descriptive placeholders
├── .gitignore
├── package.json                     # Next.js 16 + Drizzle + shadcn + @47ng/cloak
├── tsconfig.json
├── next.config.ts
├── components.json                  # shadcn config
├── drizzle.config.ts
├── docker-compose.yml               # Local Postgres
├── railway/
│   └── tunnel/
│       └── Dockerfile              # cloudflared sidecar
├── db/
│   ├── schema/
│   │   └── auth.ts                 # users, npi_access_log (renamed to pii_access_log?)
│   └── migrations/                 # Initial migration for auth schema only
├── lib/
│   ├── access.ts                   # JWT verification
│   ├── current-user.ts
│   ├── users.ts
│   ├── env.ts                      # Zod-validated env
│   ├── crypto.ts                   # @47ng/cloak wrapper with audit invariant
│   └── db.ts                       # Drizzle client
├── app/
│   ├── layout.tsx
│   └── page.tsx                    # Minimal "Welcome, {user}" landing
├── components/
│   ├── app-header.tsx              # Reads APP_NAME from env
│   └── ui/                         # shadcn primitives
├── tests/
│   ├── unit/
│   │   ├── access.test.ts
│   │   └── crypto.test.ts
│   └── e2e/
│       └── auth-happy-path.test.ts
├── proxy.ts                        # Middleware
└── scripts/
    └── smoke-test.sh               # curl-based full-chain verification
```

---

## Setup checklist (README.md content outline)

The README is the template's most valuable artifact. It captures the 2 days of CF dashboard friction Mike learned the hard way.

Sections to include:

1. **Prerequisites**
   - Cloudflare account (free tier OK for small teams ≤50 users)
   - Cloudflare Zero Trust enabled (free)
   - Railway account
   - Google Workspace (or any OIDC IdP — the template should work with any)
   - Domain you control (for the app URL)

2. **Clone + install**
   - `git clone`, `npm install`, copy `.env.example` to `.env`

3. **Generate encryption key**
   - `openssl rand -base64 32`
   - Save to `.env` and a password manager (DO NOT commit)

4. **Set up Cloudflare Tunnel**
   - CF Zero Trust → Networks → Tunnels → Create
   - Copy TUNNEL_TOKEN
   - Add Public Hostname: subdomain + domain + service URL

5. **Set up Cloudflare Access application**
   - CF Zero Trust → Access → Applications → Create Self-hosted
   - Domain: your app URL
   - Policies: Include = specific emails; Require = MFA (AFTER users enroll 2SV)
   - Copy the AUD tag to `.env` as `CF_ACCESS_AUD`
   - Team domain goes in `.env` as `CF_ACCESS_TEAM_DOMAIN`

6. **Deploy to Railway**
   - Create project, connect GitHub repo
   - Add Postgres service
   - Add second service for cloudflared (point at `railway/tunnel/Dockerfile`)
   - Set env vars on web service: CF_ACCESS_*, ENCRYPTION_KEY, DATABASE_URL=${{Postgres.DATABASE_URL}}, APP_NAME, PORT=3000
   - Set env vars on tunnel service: TUNNEL_TOKEN

7. **Smoke test**
   - Run `./scripts/smoke-test.sh <your-app-url>`
   - Verifies: direct-origin bypass blocked, CF Access redirect fires, tunnel healthy, app renders

8. **Known gotchas** (the debugging lessons from NPR)
   - Team domain mismatch → env var must match live CF tenant, not plan assumption
   - Port mismatch → Railway auto-sets PORT=8080; pin PORT=3000 in service env vars
   - MFA Require rule → only works after users enroll 2SV in IdP
   - Email domain vs app domain → don't conflate
   - Shared mailboxes (info@) violate GLBA named-user audit → don't add them to CF Access Include list

9. **Next steps**
   - Add your schema in `db/schema/app.ts` (keep `auth.ts` as-is for easy template upgrades)
   - Add your routes under `app/`
   - Use `getCurrentUser()` in Server Components to get the signed-in user
   - Use `encrypt()` / `decrypt()` from `lib/crypto.ts` for any PII columns

---

## Smoke test script (scripts/smoke-test.sh outline)

```bash
#!/bin/bash
# Usage: ./scripts/smoke-test.sh <app-url>
# Verifies each layer of the CF Access + Tunnel + app chain

set -e

APP_URL="${1:-https://your-app-url}"
RAILWAY_DIRECT_URL="${RAILWAY_DIRECT_URL:-}"

# 1. Verify direct Railway origin is blocked (must 403/404)
# 2. Verify public URL redirects to CF Access sign-in
# 3. Verify CF Access application exists at expected AUD
# 4. (With valid JWT) verify app renders and user claims propagate

# Detailed implementation left to the extraction session
```

---

## "Do NOT touch" list — source repo integrity

The extraction session must NOT:
- Modify any `.planning/` content in the source repo
- Modify `AUDIT.md`, `CLAUDE.md`, `AGENTS.md` in the source repo
- Change git history of the source repo
- Push any branches to the source repo's origin
- Edit any `lib/` or `components/` files in the source repo (COPY out, don't move)

The extraction session MAY:
- Add a single line to `STATE.md` noting the date of extraction for traceability
- Create the new target repo in a different local directory
- Push the new target repo to its own GitHub origin

---

## Success criteria for the extraction session

1. `glh280/nextjs-cf-access-starter` exists on GitHub with a green "Use this template" button
2. Fresh clone → `npm install` → follow README → deploys to a throwaway Railway project in under 30 minutes
3. Smoke test script passes end-to-end on the throwaway project
4. Source repo (`npr-dashboard-prototype`) continues to work unchanged — NPR development uninterrupted
5. README captures the setup gotchas learned from NPR debugging

---

## When to execute this plan

**Not now.** NPR Dashboard v1 (Phases 1-10) is the priority. Candidates for when to spawn the extraction session:

- **Best:** After NPR P1 ships (fastest win — validates the auth shell works in its "real" context)
- **Good:** After NPR P10 calibration week (NPR is fully shipped; template captures all lessons)
- **Acceptable:** In parallel with NPR P1 planning (if you have the bandwidth for a second Claude Code session)
- **Don't:** Before NPR P1 is planned — too much churn risk if P1 requirements force changes to the auth shell
