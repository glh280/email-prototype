# Phase 0 — Foundation — Context

## Goal

Scaffold Next.js + Postgres + Auth.js + shadcn/ui so Carrie can sign in to an empty dashboard shell at a Railway dev URL.

## Why This Phase First

Every subsequent phase writes to Postgres, depends on authentication, or renders components. Without the foundation (working auth, DB, deploy path), no later phase can produce a usable demo. This phase ends with "Carrie logs in, sees a blank dashboard." That's the floor every other phase builds on.

## Requirements Mapped to This Phase

AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, OPS-03, OPS-04, DEPLOY-01, DEPLOY-02, DEPLOY-04, DEPLOY-05, DEPLOY-06 (13 requirements total).

See `../../../REQUIREMENTS.md` for full text.

## Success Criteria

1. `npm run dev` locally serves the app at `localhost:3000` with the sign-in page visible
2. Signing in with an allowlisted Google account produces the empty dashboard shell (header, sign-out)
3. Signing in with a non-allowlisted email is rejected with a clear message
4. Playwright smoke test passes: unauthenticated user is redirected from `/` to `/sign-in`
5. The app is deployed to a Railway URL and Carrie can sign in there end-to-end

## Constraints

- **Platform:** Windows / Git Bash shell — use forward slashes, not backslashes, in npm scripts/config
- **Working dir:** `C:\NPR_Dashboard`
- **Cost target:** Phase 0 runtime cost ~$10–15/mo (Railway web + Postgres). No Anthropic API in this phase.
- **Secrets:** Never commit real env values. `.env.example` has placeholders only. Real values go in `.env.local` (gitignored) for dev and Railway env vars for prod.

## User-Side Prerequisites (blockers for specific tasks)

| Task | Prereq | Typical owner |
|---|---|---|
| Task 3 (local Postgres via docker-compose) | Docker Desktop installed + running | User |
| Task 7 (end-to-end sign-in test) | Google Cloud OAuth Client ID + Secret | User walkthrough |
| Task 9 (Railway deploy) | Railway account + new project | User walkthrough |

Tasks 1–2, 4–6, 8 can run without user prereqs. Tasks 3, 7, 9 pause until user input.

## Key Architectural Decisions Carried In From Brainstorming

- **Dashboard IS source of truth.** No two-way sync to ClickUp/GHL. Signal ingestion only.
- **Auth.js v5** with Google provider. OAuth scopes request Gmail read + send at signup (offline access) so later phases don't need re-consent.
- **Drizzle ORM** over Postgres. Migrations checked into `drizzle/migrations/`.
- **NextAuth email allowlist callback** is the only access gate. `ALLOWED_EMAILS` env var, case-insensitive match.
- **No runtime API keys in P0.** Anthropic/ClickUp/GHL keys arrive in P6/P7/P8 respectively.
- **Env validation with Zod** at import time (`lib/env.ts`). App refuses to start on missing/invalid env — prevents confusing runtime errors.

## Source Spec

Full design: `C:\Users\glh28\.claude\plans\curious-bubbling-lake.md` (sections 3, 4, 8).

## Execution Notes

The adjacent `PLAN.md` is the detailed 9-task implementation plan with every file path, every code block, every test, every commit message. Execute with:

- `superpowers:subagent-driven-development` (fresh subagent per task — recommended), OR
- `superpowers:executing-plans` (inline in current session), OR
- `/gsd:execute-phase 0` (GSD's native execution wrapper)
