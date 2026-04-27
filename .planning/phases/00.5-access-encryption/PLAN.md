# Phase 0.5 — Cloudflare Access + Encryption Scaffolding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the Auth.js scaffolding landed in P0 with Cloudflare Access. Deploy Cloudflare Tunnel so the Railway origin accepts no public traffic. Add `@47ng/cloak` encryption helpers and the `npi_access_log` audit table. Scaffold `.planning/VENDORS.md`. End state: signing in through `portal.utstitle.com` lands you in the prototype with your real identity; any NPI columns added later are automatically encrypted + audited; vendor management register exists.

**Architecture:** Additive **and** subtractive. This phase undoes the Auth.js commits landed in P0 (`fc8da45` through `14b902c`) via forward commits, then adds Cloudflare-native equivalents. No rewrites of earlier commit history.

**Tech stack changes:**
- **Remove:** `next-auth`, `@auth/drizzle-adapter`
- **Add:** `@47ng/cloak`, `jose` (may already be transitive — confirm)
- Cloudflare services: Access + Tunnel (R2 arrives in P5.5 with the Documents feature — not in this phase)

---

## Prerequisites

Before any task can run, confirm:
- ✅ Node ≥ 20 (v24.14 confirmed)
- ✅ Docker Desktop running (local Postgres still needed)
- ✅ GitHub repo `glh280/npr-dashboard-prototype` exists
- ❌ **Cloudflare account with Zero Trust enabled** — USER
- ❌ **utstitle.com DNS delegated to Cloudflare (or a CNAME on portal.utstitle.com pointing to CF)** — USER
- ❌ **`cloudflared` CLI installed locally for testing** — USER (optional; sidecar uses the image)

USER prereqs gate Stage B tasks. Stage A + parts of Stage C can proceed without them.

---

## Stage A — Revert Auth.js (forward commits)

### Task A1 — Uninstall Auth.js packages

**Files:** `package.json`, `package-lock.json`.

- [ ] **Step 1:** Uninstall

```bash
npm uninstall next-auth @auth/drizzle-adapter
```

- [ ] **Step 2:** Verify `jose` is still present (needed for Access JWT verification in Task B3):

```bash
npm ls jose 2>&1 | head -5
```

If not present, install: `npm install jose`

- [ ] **Step 3:** Commit

```bash
git add package.json package-lock.json
git commit -m "chore(p0.5): remove next-auth and drizzle-adapter"
git push
```

### Task A2 — Delete Auth.js files

**Files to delete:**
- `lib/auth.ts`
- `lib/allowlist.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/(auth)/sign-in/page.tsx`
- `tests/unit/auth-allowlist.test.ts`

- [ ] **Step 1:** Delete the files

```bash
rm lib/auth.ts lib/allowlist.ts
rm -rf "app/api/auth" "app/(auth)"
rm tests/unit/auth-allowlist.test.ts
```

- [ ] **Step 2:** Remove Auth.js imports from `components/app-header.tsx` (still imports `auth` + `signOut` from `@/lib/auth`) — revert it to its pre-P0 state temporarily. It will be rewritten in Task B7:

```tsx
// components/app-header.tsx — temporary revert to pre-P0 prototype state
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3 bg-background">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80">
        <div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
        NPR Dashboard
        <span className="text-xs font-normal text-muted-foreground ml-2">prototype</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium">?</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">Not signed in yet</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">Waiting on Access wiring…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 3:** Temporarily disable `proxy.ts` so the app still compiles. Replace its contents with a no-op:

```ts
// proxy.ts — temporary no-op during P0.5 transition. Real Access gate lands in Task B4.
import { NextResponse } from "next/server";
export default function proxy() {
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4:** Update `lib/env.ts` to remove Auth.js-specific vars. Replace with placeholders for Access vars (real values in Task B2):

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1).optional(), // required once Access is live
  CF_ACCESS_AUD: z.string().min(1).optional(),         // required once Access is live
  ENCRYPTION_KEY: z.string().min(44).optional(),       // 32 bytes base64 = 44 chars; required once crypto is wired
  GMAIL_OAUTH_CLIENT_ID: z.string().min(1).optional(),      // P4/P5
  GMAIL_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),  // P4/P5
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Environment validation failed:\n${issues}`);
}
export const env = parsed.data;
```

Note: `CF_ACCESS_*` and `ENCRYPTION_KEY` are marked `.optional()` during P0.5 so the app builds in between tasks. Before Task B4 lands, we tighten them to required.

- [ ] **Step 5:** Update `tests/unit/env.test.ts` to match the new schema — remove `ALLOWED_EMAILS` / `AUTH_SECRET` / `GOOGLE_CLIENT_ID` assertions. Simplify to verify `DATABASE_URL` still requires a URL and the optional vars accept undefined.

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("env validation (post-Auth.js)", () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it("throws when DATABASE_URL is missing", async () => {
    process.env.DATABASE_URL = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix is a Vite pattern, not typed
    await expect(import("@/lib/env?no-db")).rejects.toThrow();
  });

  it("accepts minimal valid env", async () => {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { env } = await import("@/lib/env?minimal");
    expect(env.DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
    expect(env.CF_ACCESS_TEAM_DOMAIN).toBeUndefined();
  });
});
```

- [ ] **Step 6:** Run tests + build to confirm the app compiles

```bash
npm test
npm run build
```

Both should pass. If `components/app-header.tsx` or `app/page.tsx` still reference removed Auth.js symbols, fix those imports.

- [ ] **Step 7:** Commit

```bash
git add lib/ app/ tests/ components/app-header.tsx proxy.ts
git commit -m "chore(p0.5): remove Auth.js files and temporarily no-op the proxy gate"
git push
```

### Task A3 — Drop Auth.js-specific DB tables, keep `users`

**Files:** `db/schema.ts`, new migration file.

- [ ] **Step 1:** Edit `db/schema.ts` to remove `accounts`, `sessions`, `verificationTokens` exports and types; preserve `users` table but drop the `emailVerified` column (Auth.js-specific).

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2:** Generate the migration

```bash
npm run db:generate
```

- [ ] **Step 3:** Review the generated SQL — it should DROP `accounts`, `sessions`, `verification_tokens` and the `email_verified` column from `users`. If Drizzle emits anything else, investigate before applying.

- [ ] **Step 4:** Apply to local Postgres

```bash
npm run db:migrate
docker compose exec -T postgres psql -U npr -d npr_dashboard -c "\dt"
```

Expected: only `users` and `__drizzle_migrations` remain.

- [ ] **Step 5:** Commit

```bash
git add db/schema.ts drizzle/migrations/
git commit -m "chore(p0.5): drop Auth.js tables; keep minimal users table"
git push
```

---

## Stage B — Cloudflare Access integration

### Task B1 `[USER]` — Cloudflare Zero Trust + Access application + Google IdP + MFA + policy

This is executed entirely in the Cloudflare dashboard. Document completion by saving the AUD tag and team domain into `.env.local` (see Task B2).

**Note on Logpush:** Access Logpush requires Cloudflare Enterprise. On the Free tier (where we sit) we rely on the Cloudflare dashboard's built-in Access log view (retained ~6 hours for detail, longer for summaries) as a supplementary audit view. The app-level `change_history` + `npi_access_log` are the authoritative GLBA audit trail. *V2 backlog: daily cron polling the CF Access API to archive logs to R2 — not in P0.5.*

- [ ] **Step 1:** Create / log into Cloudflare Zero Trust account. Free plan; no billing needed.
- [ ] **Step 2:** Team domain: `npr` → `npr.cloudflareaccess.com` (or your preferred team slug).
- [ ] **Step 3:** Settings → Authentication → add **Google** as an identity provider (use Mike's Google account or Workspace).
- [ ] **Step 4:** Access → Applications → **Add application** → Self-hosted
  - Application name: `NPR Dashboard`
  - Session duration: **24 hours**
  - **Application domain:** `portal.utstitle.com`
  - Advanced → Purpose justification: **Required**
  - Save. Copy the **Application AUD tag** — needed in Task B2.
- [ ] **Step 5:** Policies → Add policy
  - Name: `Internal operators`
  - Action: **Allow**
  - Include: specific emails — enter Mike, Carrie, Steff, and partner emails (Nick, Jais, Jamey, Corey, Peter, Nehemiah, Tinos, Keleisha, Edward, Jeremiah)
  - Require: **Multi-factor Authentication**
  - Save.
- [ ] **Step 6:** Verify: visit `https://portal.utstitle.com` (will 521 until Tunnel is up — that's fine). You should be prompted for Google + MFA.

### Task B2 `[USER]` — Cloudflare Tunnel token

- [ ] **Step 1:** Networks → Tunnels → Create tunnel → name: `npr-dashboard-origin`
- [ ] **Step 2:** Save the **tunnel token** (long JWT-looking string). Copy it.
- [ ] **Step 3:** Add a **Public Hostname** route:
  - Hostname: `portal.utstitle.com`
  - Service: `http://web:3000` (Railway private service name for the Next.js app)
- [ ] **Step 4:** In `.env.local`, add:

```
CF_ACCESS_TEAM_DOMAIN=npr.cloudflareaccess.com
CF_ACCESS_AUD=<paste AUD tag from Task B1 step 4>
CF_TUNNEL_TOKEN=<paste tunnel token from step 2>
```

Note: `CF_TUNNEL_TOKEN` is only read by the sidecar service (Task B3), not the app. It's in `.env.local` for convenience, not validated in `lib/env.ts`.

### Task B3 — Deploy `cloudflared` sidecar to Railway

**Files:** `railway/tunnel/Dockerfile` (new).

- [ ] **Step 1:** Create `railway/tunnel/Dockerfile`:

```dockerfile
FROM cloudflare/cloudflared:latest
CMD ["tunnel", "--no-autoupdate", "run", "--token", "${CF_TUNNEL_TOKEN}"]
```

- [ ] **Step 2:** In Railway dashboard, add a new service to the `npr-dashboard-prototype` project:
  - Name: `tunnel`
  - Source: **Dockerfile** → path: `railway/tunnel/Dockerfile`
  - Environment variables: `CF_TUNNEL_TOKEN` = (from `.env.local`)
  - Networking: no public domain needed; private networking only

- [ ] **Step 3:** Deploy and verify in Cloudflare → Networks → Tunnels the tunnel shows **Healthy**.

- [ ] **Step 4:** Commit

```bash
git add railway/tunnel/
git commit -m "feat(p0.5): cloudflared sidecar deployed to Railway"
git push
```

### Task B4 — `lib/access.ts`: JWT validation + `getCurrentUser()` (TDD)

**Files:** `lib/access.ts` (new), `tests/unit/access.test.ts` (new).

- [ ] **Step 1:** Write failing tests `tests/unit/access.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { verifyAccessJwt } from "@/lib/access";

// We use a hand-rolled mock JWKS for isolation.
const mockTeamDomain = "test.cloudflareaccess.com";
const mockAud = "abc123aud";

describe("verifyAccessJwt", () => {
  it("rejects a missing token", async () => {
    await expect(verifyAccessJwt(undefined, { teamDomain: mockTeamDomain, aud: mockAud }))
      .rejects.toThrow(/missing/i);
  });

  it("rejects a malformed token", async () => {
    await expect(verifyAccessJwt("not-a-jwt", { teamDomain: mockTeamDomain, aud: mockAud }))
      .rejects.toThrow();
  });

  it("rejects a token with wrong AUD", async () => {
    // We mock the JWKS fetch to return a known key, then sign a token with the wrong aud
    // and assert verification fails. Implementation detail: use `jose` to mint test tokens.
    // Full mock setup is left to the implementer; assertion shape is what matters here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenWithWrongAud = await mintTestToken({ aud: "different-aud" });
    await expect(verifyAccessJwt(tokenWithWrongAud, { teamDomain: mockTeamDomain, aud: mockAud }))
      .rejects.toThrow(/aud/i);
  });

  it("extracts email from verified claims (not header)", async () => {
    const token = await mintTestToken({ aud: mockAud, email: "carrie@utstitle.com" });
    const claims = await verifyAccessJwt(token, { teamDomain: mockTeamDomain, aud: mockAud });
    expect(claims.email).toBe("carrie@utstitle.com");
  });
});

// Helper stub — implement during task
async function mintTestToken(_opts: { aud: string; email?: string }): Promise<string> {
  throw new Error("implement in task");
}
```

- [ ] **Step 2:** Run tests — all should fail (module doesn't exist).

```bash
npm test
```

- [ ] **Step 3:** Implement `lib/access.ts`. Use `jose` to verify against the remote JWKS:

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AccessClaims = JWTPayload & {
  email: string;
  sub: string;
  identity_nonce?: string;
  country?: string;
};

export type AccessConfig = {
  teamDomain: string; // e.g. "npr.cloudflareaccess.com"
  aud: string;        // Application AUD tag
};

let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksCacheKey: string | undefined;

function getJwks(teamDomain: string) {
  if (jwksCache && jwksCacheKey === teamDomain) return jwksCache;
  const url = new URL(`https://${teamDomain}/cdn-cgi/access/certs`);
  jwksCache = createRemoteJWKSet(url, {
    cacheMaxAge: 1000 * 60 * 60 * 24, // 24 hours
  });
  jwksCacheKey = teamDomain;
  return jwksCache;
}

export async function verifyAccessJwt(
  token: string | undefined,
  config: AccessConfig,
): Promise<AccessClaims> {
  if (!token) throw new Error("Access JWT missing from request");
  const jwks = getJwks(config.teamDomain);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${config.teamDomain}`,
    audience: config.aud,
  });
  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Access JWT missing email claim");
  }
  return payload as AccessClaims;
}
```

- [ ] **Step 4:** Implement the `mintTestToken` helper inside the test file using `jose`'s `SignJWT` plus a locally-generated key pair, then mock `createRemoteJWKSet` to return that public key. Full pattern: generate `KeyLike` with `generateKeyPair("RS256")`, pass the JWKS into the verify function via dependency injection (refactor `verifyAccessJwt` to accept an optional `jwks` param for testability).

- [ ] **Step 5:** Run tests — all 4 should pass. Iterate on the implementation until they do.

```bash
npm test
```

- [ ] **Step 6:** Commit

```bash
git add lib/access.ts tests/unit/access.test.ts
git commit -m "feat(p0.5): lib/access.ts — CF Access JWT verification with JWKS caching"
git push
```

### Task B5 — `lib/users.ts`: find-or-create by email

**Files:** `lib/users.ts` (new).

- [ ] **Step 1:** Create `lib/users.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type User } from "@/db/schema";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function upsertUserFromAccess(claims: { email: string; name?: string }): Promise<User> {
  const existing = await findUserByEmail(claims.email);
  if (existing) return existing;
  const [row] = await db
    .insert(users)
    .values({ email: claims.email, name: claims.name ?? null })
    .returning();
  return row;
}
```

- [ ] **Step 2:** Commit

```bash
git add lib/users.ts
git commit -m "feat(p0.5): users find/upsert on Access claims"
git push
```

### Task B6 — Rewrite `proxy.ts` to enforce Access JWT

**Files:** `proxy.ts`.

- [ ] **Step 1:** Update `lib/env.ts` to make `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` **required** now (tighten from `.optional()`):

```ts
// in lib/env.ts schema
CF_ACCESS_TEAM_DOMAIN: z.string().min(1),
CF_ACCESS_AUD: z.string().min(1),
```

- [ ] **Step 2:** Replace `proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessJwt } from "@/lib/access";
import { env } from "@/lib/env";

export default async function proxy(req: NextRequest) {
  const token = req.headers.get("cf-access-jwt-assertion") ?? undefined;
  try {
    await verifyAccessJwt(token, {
      teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
      aud: env.CF_ACCESS_AUD,
    });
    return NextResponse.next();
  } catch {
    // Unauthenticated — fail closed. Cloudflare Access should prevent this from happening
    // in production, but local dev and any origin-bypass attempt will land here.
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3:** Run build + Playwright smoke test:

```bash
npm run build
npm run test:e2e
```

Playwright test will fail because the old assertion expected a redirect to `/sign-in`; revise it in Step 4.

- [ ] **Step 4:** Update `tests/e2e/smoke.spec.ts` to match the new behavior:

```ts
import { test, expect } from "@playwright/test";

test("request without Access JWT returns 401", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(401);
  await expect(page.getByText(/unauthorized/i)).toBeVisible();
});
```

- [ ] **Step 5:** Re-run + commit

```bash
npm run test:e2e
git add proxy.ts lib/env.ts tests/e2e/smoke.spec.ts
git commit -m "feat(p0.5): proxy enforces CF Access JWT; fail-closed on missing/invalid"
git push
```

### Task B7 — Rewrite `components/app-header.tsx` to read Access claims

**Files:** `components/app-header.tsx`, `lib/current-user.ts` (new helper).

- [ ] **Step 1:** Create `lib/current-user.ts` — a server-side helper that reads the Access JWT from request headers (via `headers()` from `next/headers`), verifies, and returns the user.

```ts
import { headers } from "next/headers";
import { verifyAccessJwt } from "@/lib/access";
import { upsertUserFromAccess } from "@/lib/users";
import { env } from "@/lib/env";

export async function getCurrentUser() {
  const h = await headers();
  const token = h.get("cf-access-jwt-assertion") ?? undefined;
  const claims = await verifyAccessJwt(token, {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    aud: env.CF_ACCESS_AUD,
  });
  return upsertUserFromAccess({ email: claims.email, name: claims.name as string | undefined });
}
```

- [ ] **Step 2:** Rewrite `components/app-header.tsx` to use `getCurrentUser()`:

```tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { env } from "@/lib/env";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function AppHeader() {
  const user = await getCurrentUser();
  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const logoutUrl = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/logout`;
  return (
    <header className="flex items-center justify-between border-b px-6 py-3 bg-background">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80">
        <div className="h-6 w-6 rounded bg-slate-900 dark:bg-slate-100" />
        NPR Dashboard
        <span className="text-xs font-normal text-muted-foreground ml-2">prototype</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="h-8 w-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {user.email}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={logoutUrl} className="text-sm w-full block px-2 py-1.5 hover:bg-muted rounded-sm">
              Sign out
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 3:** Build check

```bash
npm run build
```

- [ ] **Step 4:** Commit

```bash
git add components/app-header.tsx lib/current-user.ts
git commit -m "feat(p0.5): header reads user from Access claims; sign-out links to CF logout"
git push
```

---

## Stage C — Encryption + NPI audit scaffolding

### Task C1 — Add `npi_access_log` table

**Files:** `db/schema.ts`, new migration.

- [ ] **Step 1:** Add to `db/schema.ts`:

```ts
export const npiAccessLog = pgTable("npi_access_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userEmail: text("user_email").notNull(),
  dealId: uuid("deal_id"),          // nullable — may not be in a deal context
  contactId: uuid("contact_id"),    // nullable
  fieldAccessed: text("field_accessed").notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
  purpose: text("purpose"),          // future: captured from UI when decryption is user-triggered
});

export type NpiAccessLog = typeof npiAccessLog.$inferSelect;
export type NewNpiAccessLog = typeof npiAccessLog.$inferInsert;
```

- [ ] **Step 2:** Generate + apply migration

```bash
npm run db:generate
npm run db:migrate
docker compose exec -T postgres psql -U npr -d npr_dashboard -c "\dt"
```

Expected: `npi_access_log` now appears.

- [ ] **Step 3:** Commit

```bash
git add db/schema.ts drizzle/migrations/
git commit -m "feat(p0.5): add npi_access_log table for NPI read audit"
git push
```

### Task C2 `[USER]` — Encryption key (Railway env + 1Password)

Cloudflare Secrets was initially considered but is a Workers-only feature, not reachable from a Railway-hosted Next.js app. Railway env var is the canonical store; 1Password is the disaster recovery backup.

- [ ] **Step 1:** Generate the key locally:

```bash
openssl rand -base64 32
```

**Save the output to 1Password immediately** (labeled "NPR Dashboard ENCRYPTION_KEY — production"). This is the disaster recovery copy — if Railway's env is wiped or the service is rebuilt, this is how we recover encrypted NPI. **If you lose this key, all encrypted data becomes unrecoverable.**

- [ ] **Step 2:** In Railway → web service → Variables → add `ENCRYPTION_KEY` with the value.

- [ ] **Step 3:** Also add to `.env.local` for local dev (use a DIFFERENT key locally so prod ciphertext can't be decrypted against a leaked dev key).

- [ ] **Step 4:** Tighten `lib/env.ts`:

```ts
ENCRYPTION_KEY: z.string().min(44), // 32 bytes base64 = 44 chars
```

**Key rotation (supported, not required for P0.5):** `@47ng/cloak` supports a multi-key read window. When rotating, add `ENCRYPTION_KEY_V2`, switch writes to v2 while reads accept v1 or v2, re-encrypt all columns with v2, then retire v1. Document the rotation in `change_history` as an `other` event.

### Task C3 — `lib/crypto.ts`: encrypt/decrypt with audit invariant (TDD)

**Files:** `lib/crypto.ts` (new), `tests/unit/crypto.test.ts` (new).

- [ ] **Step 1:** Install `@47ng/cloak`

```bash
npm install @47ng/cloak
```

- [ ] **Step 2:** Write failing test that asserts the audit invariant:

```ts
// tests/unit/crypto.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: insertSpy.mockResolvedValue(undefined) }),
  },
}));

describe("crypto.ts", () => {
  beforeEach(() => { insertSpy.mockClear(); });

  it("round-trips encrypted text", async () => {
    process.env.ENCRYPTION_KEY = "k1.aesgcm256.v1.QVNTRVNTT1JfV0FMTFlfMTIzNDU2Nzg5MDEyMzQ1Ng=="; // @47ng/cloak format
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const ciphertext = await encrypt("sensitive-value");
    expect(ciphertext).not.toBe("sensitive-value");
    const plaintext = await decrypt(ciphertext, {
      userEmail: "carrie@utstitle.com",
      fieldAccessed: "contacts.ssn",
    });
    expect(plaintext).toBe("sensitive-value");
  });

  it("INVARIANT: decrypt() always writes an npi_access_log row", async () => {
    process.env.ENCRYPTION_KEY = "k1.aesgcm256.v1.QVNTRVNTT1JfV0FMTFlfMTIzNDU2Nzg5MDEyMzQ1Ng==";
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const ciphertext = await encrypt("x");
    await decrypt(ciphertext, {
      userEmail: "carrie@utstitle.com",
      fieldAccessed: "contacts.ssn",
      dealId: "00000000-0000-0000-0000-000000000000",
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const args = insertSpy.mock.calls[0][0];
    expect(args.userEmail).toBe("carrie@utstitle.com");
    expect(args.fieldAccessed).toBe("contacts.ssn");
  });
});
```

- [ ] **Step 3:** Implement `lib/crypto.ts`:

```ts
import { CloakClient } from "@47ng/cloak";
import { db } from "@/lib/db";
import { npiAccessLog } from "@/db/schema";
import { env } from "@/lib/env";

const client = new CloakClient({ masterKeys: [env.ENCRYPTION_KEY] });

export async function encrypt(plaintext: string): Promise<string> {
  return client.encrypt(plaintext);
}

export type DecryptContext = {
  userEmail: string;
  fieldAccessed: string; // e.g. "contacts.ssn"
  dealId?: string;
  contactId?: string;
  purpose?: string;
};

/**
 * Decrypt ciphertext AND log the access. This function is the only path to
 * decrypt NPI — callers must provide context for the audit log.
 */
export async function decrypt(ciphertext: string, ctx: DecryptContext): Promise<string> {
  const plaintext = await client.decrypt(ciphertext);
  await db.insert(npiAccessLog).values({
    userEmail: ctx.userEmail,
    fieldAccessed: ctx.fieldAccessed,
    dealId: ctx.dealId ?? null,
    contactId: ctx.contactId ?? null,
    purpose: ctx.purpose ?? null,
  });
  return plaintext;
}
```

- [ ] **Step 4:** Run tests; both should pass.

```bash
npm test
```

Iterate until they do.

- [ ] **Step 5:** Commit

```bash
git add lib/crypto.ts tests/unit/crypto.test.ts package.json package-lock.json
git commit -m "feat(p0.5): lib/crypto.ts with non-skippable NPI access audit"
git push
```

### Task C4 — `.planning/VENDORS.md` scaffold

**Files:** `.planning/VENDORS.md` (new).

- [ ] **Step 1:** Create the file per the scaffold shape — see separate VENDORS.md spec in this phase directory.

- [ ] **Step 2:** Commit

```bash
git add .planning/VENDORS.md
git commit -m "docs(p0.5): vendor management register scaffold"
git push
```

---

## Phase 0.5 completion checklist

- [ ] `npm test` passes locally (all unit tests green, including crypto audit invariant)
- [ ] `npm run test:e2e` passes (revised smoke: unauth request → 401)
- [ ] Railway: both services (web + tunnel) show Healthy
- [ ] Cloudflare: Tunnel shows Healthy; Access app responds at `portal.utstitle.com` with Google + MFA prompt
- [ ] Signing in with an allowlisted email → prototype home loads; avatar shows real name + email
- [ ] Direct access attempt to the Railway origin (bypassing Cloudflare) returns 403/404
- [ ] Access JWT with tampered claims → 401
- [ ] `npi_access_log` table exists in prod Postgres
- [ ] `encrypt()` / `decrypt()` round-trip works locally
- [ ] Unit test proves `decrypt()` writes exactly one `npi_access_log` row
- [ ] `.planning/VENDORS.md` present with 6 vendor rows, all status PENDING
- [ ] No `@auth/*` or `next-auth` packages remain in `package.json`
- [ ] `lib/auth.ts`, `lib/allowlist.ts`, `app/api/auth/`, `app/(auth)/` all deleted

When all boxes check: **P0.5 done. Proceed to P1 (deals table + list view reading from DB).**

---

## Acceptance tests (cross-reference to checklist)

1. Direct origin access (bypassing Cloudflare) returns 403/404 — manual test with `curl` against the Railway service URL directly
2. Access JWT with invalid signature returns 401 — automated in `tests/unit/access.test.ts`
3. Access JWT with wrong AUD returns 401 — automated in `tests/unit/access.test.ts`
4. Valid Access JWT creates or retrieves the `users` row — automated via `upsertUserFromAccess` in integration test
5. MFA prompt fires on first Access login — manual verification in browser
6. `decrypt()` call produces corresponding `npi_access_log` row — automated invariant test in `tests/unit/crypto.test.ts`
7. Header email is disregarded when JWT claims email differs — automated in `tests/unit/access.test.ts` (implementation uses verified claims only)
8. Access session duration ≤ 24 hours — verified in CF dashboard (USER task)
9. Access "Purpose justification" enabled — verified in CF dashboard

## Rollback plan

If Access wiring breaks and users are locked out:
- **Fastest:** Cloudflare dashboard → Access app → disable policy temporarily (~30s). App becomes fully open, but origin is still Tunnel-isolated from public internet.
- **Alternative:** Railway → pause the `tunnel` sidecar. App becomes unreachable externally — safer than leaving it open.
- **Fallback:** the rev-5 prototype URL `npr-dashboard-prototype-production.up.railway.app` stays up independently during P0.5 build. Carrie's feedback loop is never interrupted.
