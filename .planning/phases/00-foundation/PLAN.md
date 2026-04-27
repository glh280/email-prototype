# Phase 0 — Foundation (Adapted to Existing Prototype)

> **Context:** The prototype (rev 5) is live at `https://npr-dashboard-prototype-production.up.railway.app` with Next.js 16.2.4 + Tailwind + shadcn/ui (Base UI). Scaffold already exists; deploy already works. This plan adapts the original P0 (which assumed a fresh scaffold) to pick up from the current state and wire in auth + database without breaking the prototype UX.
>
> **Original greenfield P0 preserved in git history** — see commit `57f33ac`.

**Goal:** Add Postgres + Drizzle + Auth.js v5 (Google OAuth + allowlist) + Zod env validation to the existing prototype. End state: signing in with an allowlisted Google account works on local + Railway. The prototype's mock data still renders once signed in — P1 replaces it with DB reads.

**Architecture:** Additive only. No existing prototype component is rewritten except `app-header.tsx` (to pull real session). New files land in `lib/`, `db/`, `drizzle/`, `app/api/auth/`, `app/(auth)/sign-in/`, `tests/`, and root-level config files.

**Tech stack (already installed):** Next.js 16.2.4, React 19, Tailwind, shadcn/ui (Base UI), Sonner, TypeScript.

**Tech stack (to install this phase):** Auth.js v5 (beta), Drizzle ORM + drizzle-kit, pg, Zod, Vitest, Playwright, @auth/drizzle-adapter.

---

## Working directory

All commands run from `C:\NPR_Dashboard`. Windows / Git Bash shell. Use forward slashes in npm scripts and config.

## Prerequisites (user-side)

- ✅ Node ≥ 20 (currently v24.14)
- ✅ npm ≥ 10
- ✅ Git
- ✅ Railway project `npr-dashboard-prototype`
- ✅ GitHub repo `glh280/npr-dashboard-prototype` (created rev-5)
- ❌ **Docker Desktop installed + running** — needed for Task 3 (local Postgres)
- ❌ **Google Cloud OAuth Client ID + Secret** — needed for Task 5 (walkthrough included)

Tasks 1 and 2 can run before Docker/Google are ready. Tasks 3, 5, 8 pause on those prereqs.

---

## File structure after this phase

```
C:\NPR_Dashboard\
├── .env.example                         # NEW (committed)
├── .env.local                           # NEW (gitignored — user creates)
├── docker-compose.yml                   # NEW
├── drizzle.config.ts                    # NEW
├── vitest.config.ts                     # NEW
├── playwright.config.ts                 # NEW
├── middleware.ts                        # NEW — gates authenticated routes
├── app/
│   ├── (auth)/sign-in/page.tsx          # NEW
│   ├── api/auth/[...nextauth]/route.ts  # NEW
│   ├── layout.tsx                       # UNCHANGED
│   ├── page.tsx                         # UNCHANGED (prototype)
│   └── deal/[id]/page.tsx               # UNCHANGED
├── components/
│   ├── app-header.tsx                   # MODIFIED — real session instead of "CD"
│   └── (all other prototype files)      # UNCHANGED
├── db/
│   └── schema.ts                        # NEW — users/accounts/sessions/verification_tokens
├── drizzle/
│   └── migrations/0000_*.sql            # NEW — generated
├── lib/
│   ├── env.ts                           # NEW — Zod-validated env
│   ├── db.ts                            # NEW — Drizzle client
│   ├── auth.ts                          # NEW — Auth.js config + allowlist
│   └── utils.ts                         # UNCHANGED (shadcn cn helper)
├── tests/
│   ├── unit/env.test.ts                 # NEW
│   ├── unit/auth-allowlist.test.ts      # NEW
│   └── e2e/smoke.spec.ts                # NEW
├── mock/                                # UNCHANGED — still source of truth until P1
└── (prototype files all preserved)
```

---

## Task 1 — Install dependencies

**Files:** `package.json`, `package-lock.json`.

- [ ] **Step 1: Install runtime + dev deps**

```bash
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm pg zod
npm install -D drizzle-kit @types/pg dotenv vitest @vitest/ui @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add scripts to `package.json`** — replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 3: Verify dev server still starts**

```bash
npm run dev
```

Visit `http://localhost:3000` — rev-5 prototype renders unchanged. Ctrl+C.

- [ ] **Step 4: Commit + push**

```bash
git add package.json package-lock.json
git commit -m "chore(p0): install auth/db/test dependencies"
git push
```

---

## Task 2 — Zod env validation (TDD)

**Files:** `lib/env.ts`, `tests/unit/env.test.ts`, `vitest.config.ts`, `.env.example`.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
```

- [ ] **Step 2: Write failing test `tests/unit/env.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it("throws when required vars are missing", async () => {
    process.env.DATABASE_URL = "";
    process.env.AUTH_SECRET = "";
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_SECRET = "";
    process.env.ALLOWED_EMAILS = "";
    await expect(import("@/lib/env?missing")).rejects.toThrow();
  });

  it("parses ALLOWED_EMAILS as lowercase trimmed list", async () => {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.GOOGLE_CLIENT_ID = "x.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.ALLOWED_EMAILS = "Carrie@utstitle.com, MIKE@utstitle.com";
    const { env } = await import("@/lib/env?ok");
    expect(env.ALLOWED_EMAILS).toEqual(["carrie@utstitle.com", "mike@utstitle.com"]);
  });
});
```

- [ ] **Step 3: Run, verify fail**

```bash
npm test
```

- [ ] **Step 4: Create `lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_EMAILS: z
    .string()
    .min(1)
    .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  AUTH_TRUST_HOST: z.coerce.boolean().default(false),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Environment validation failed:\n${issues}`);
}

export const env = parsed.data;
```

- [ ] **Step 5: Run, verify pass**

```bash
npm test
```

- [ ] **Step 6: Create `.env.example`**

```
# Copy to .env.local and fill with real values. .env.local is gitignored.

# Postgres (local dev: docker-compose provides this)
DATABASE_URL=postgres://npr:npr@localhost:5432/npr_dashboard

# Auth.js — generate with: openssl rand -base64 32
AUTH_SECRET=replace-me-with-32-plus-char-random

# Google OAuth (Cloud Console → APIs & Services → Credentials)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx

# Comma-separated emails allowed to sign in
ALLOWED_EMAILS=carrie@utstitle.com,mike@utstitle.com

# Auth.js v5 behind proxy (Railway) — true in prod, false locally
AUTH_TRUST_HOST=false

# Auth.js v5 — set in prod to the deployed URL; unset locally
# AUTH_URL=https://npr-dashboard-prototype-production.up.railway.app
```

- [ ] **Step 7: Commit + push**

```bash
git add lib/env.ts tests/unit/env.test.ts vitest.config.ts .env.example package.json package-lock.json
git commit -m "feat(p0): zod-validated env module with allowlist parsing"
git push
```

---

## Task 3 — Local Postgres via Docker + Drizzle schema

**Prereq:** Docker Desktop installed + running.

```bash
docker --version && docker compose version && docker info
```

If any fail, pause here until Docker Desktop is running.

**Files:** `docker-compose.yml`, `drizzle.config.ts`, `db/schema.ts`, `lib/db.ts`, `drizzle/migrations/0000_*.sql`, `.env.local`, `.gitignore`.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: npr
      POSTGRES_PASSWORD: npr
      POSTGRES_DB: npr_dashboard
    ports:
      - "5432:5432"
    volumes:
      - npr_pg_data:/var/lib/postgresql/data

volumes:
  npr_pg_data:
```

- [ ] **Step 2: Start local Postgres**

```bash
docker compose up -d
docker compose ps
```

- [ ] **Step 3: Create `.env.local`**

```bash
cat > .env.local <<EOF
DATABASE_URL=postgres://npr:npr@localhost:5432/npr_dashboard
AUTH_SECRET=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=placeholder.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=placeholder
ALLOWED_EMAILS=carrie@utstitle.com,mike@utstitle.com
AUTH_TRUST_HOST=false
EOF
```

Google values are placeholders until Task 5.

- [ ] **Step 4: Ensure `.env.local` is gitignored**

Next.js default `.gitignore` already has `.env*` which covers this. Add explicit lines for clarity:

```bash
printf "\n# env\n.env\n.env.local\n.env*.local\n\n# drizzle studio temp\n.drizzle/\n" >> .gitignore
```

- [ ] **Step 5: Create `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 6: Create `db/schema.ts`** (Auth.js-compatible tables)

```ts
import { pgTable, text, timestamp, uuid, integer, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (v) => ({ pk: primaryKey({ columns: [v.identifier, v.token] }) }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 7: Create `lib/db.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });
```

- [ ] **Step 8: Generate + apply migration**

```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 9: Verify**

```bash
docker compose exec postgres psql -U npr -d npr_dashboard -c "\dt"
```

Expected: `users`, `accounts`, `sessions`, `verification_tokens`, `__drizzle_migrations` all present.

- [ ] **Step 10: Commit + push**

```bash
git add docker-compose.yml drizzle.config.ts db/schema.ts lib/db.ts drizzle/migrations/ .gitignore
git commit -m "feat(p0): drizzle + local postgres + auth-compatible schema"
git push
```

---

## Task 4 — Auth.js v5 + Google + allowlist (TDD)

**Files:** `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `tests/unit/auth-allowlist.test.ts`.

- [ ] **Step 1: Write failing allowlist test**

```ts
// tests/unit/auth-allowlist.test.ts
import { describe, it, expect } from "vitest";
import { isAllowed } from "@/lib/auth";

describe("email allowlist", () => {
  const allowed = ["carrie@utstitle.com", "mike@utstitle.com"];
  it("permits an allowlisted email", () => {
    expect(isAllowed("carrie@utstitle.com", allowed)).toBe(true);
  });
  it("permits case-insensitively", () => {
    expect(isAllowed("CARRIE@UTSTITLE.COM", allowed)).toBe(true);
  });
  it("rejects a non-allowlisted email", () => {
    expect(isAllowed("stranger@example.com", allowed)).toBe(false);
  });
  it("rejects undefined", () => {
    expect(isAllowed(undefined, allowed)).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isAllowed("", allowed)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm test
```

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export function isAllowed(email: string | null | undefined, allowed: string[]): boolean {
  if (!email) return false;
  return allowed.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ user }) {
      return isAllowed(user.email, env.ALLOWED_EMAILS);
    },
  },
  pages: { signIn: "/sign-in" },
  secret: env.AUTH_SECRET,
  trustHost: env.AUTH_TRUST_HOST,
});
```

- [ ] **Step 4: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 5: Run, verify pass**

```bash
npm test
```

Expected: 5/5 pass.

- [ ] **Step 6: Commit + push**

```bash
git add lib/auth.ts app/api/auth/ tests/unit/auth-allowlist.test.ts
git commit -m "feat(p0): auth.js v5 with google provider and email allowlist"
git push
```

---

## Task 5 — Google Cloud OAuth setup (user-side)

- [ ] **Step 1:** https://console.cloud.google.com → project `npr-dashboard` (create if needed).
- [ ] **Step 2:** APIs & Services → Library → enable **Gmail API**.
- [ ] **Step 3:** OAuth consent screen
  - User type: **External**
  - App name: NPR Dashboard
  - Support + developer emails: your email
  - Scopes: `userinfo.email`, `userinfo.profile`, `gmail.readonly`, `gmail.send`
  - Test users: Carrie's email, your email
- [ ] **Step 4:** Credentials → Create → OAuth client ID → Web application
  - Authorized JavaScript origins:
    - `http://localhost:3000`
    - `https://npr-dashboard-prototype-production.up.railway.app`
  - Authorized redirect URIs:
    - `http://localhost:3000/api/auth/callback/google`
    - `https://npr-dashboard-prototype-production.up.railway.app/api/auth/callback/google`
  - Save; copy Client ID + Secret.
- [ ] **Step 5:** Paste into `.env.local` replacing the placeholders.

No commit — `.env.local` is gitignored.

---

## Task 6 — Sign-in page + middleware + session-aware header

**Files:** `app/(auth)/sign-in/page.tsx` (new), `middleware.ts` (new), `components/app-header.tsx` (modified).

- [ ] **Step 1: Create `app/(auth)/sign-in/page.tsx`**

```tsx
import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-8 w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">NPR Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in with your Google account.</p>
        </div>
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
          <Button type="submit" className="w-full">Continue with Google</Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Access is limited to allowlisted emails. Contact Mike if you need access.
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `middleware.ts`** at repo root

```ts
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3: Rewrite `components/app-header.tsx`** to use real session

```tsx
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  const initials = (user?.name ?? user?.email ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {user?.email ?? "not signed in"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={async () => { "use server"; await signOut({ redirectTo: "/sign-in" }); }}>
            <button type="submit" className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded-sm">
              Sign out
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

Note: `AppHeader` is now an async server component. `app/page.tsx` and `app/deal/[id]/page.tsx` already render it inside async server components — no changes needed there.

- [ ] **Step 4: Local smoke**

```bash
npm run dev
```

Visit `http://localhost:3000`:
- Expected: redirect to `/sign-in`
- Click Continue with Google → consent screen
- Sign in with allowlisted email → redirected, prototype home loads with your real name in avatar menu
- Try with a non-allowlisted email → rejected

Ctrl+C.

- [ ] **Step 5: Commit + push**

```bash
git add app/ middleware.ts components/app-header.tsx
git commit -m "feat(p0): sign-in page, middleware gate, session-aware header"
git push
```

---

## Task 7 — Playwright smoke test

**Files:** `playwright.config.ts`, `tests/e2e/smoke.spec.ts`.

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Write `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("unauthenticated / redirects to /sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: /NPR Dashboard/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
});

test("sign-in page shows allowlist note", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText(/Access is limited to allowlisted emails/i)).toBeVisible();
});
```

- [ ] **Step 3: Run**

```bash
npm run test:e2e
```

Expected: 2/2 pass.

- [ ] **Step 4: Commit + push**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(p0): playwright smoke for unauth redirect"
git push
```

---

## Task 8 — Railway env vars, Postgres service, migrations

- [ ] **Step 1:** Railway UI → `npr-dashboard-prototype` service → Variables. Add:

```
AUTH_SECRET=<NEW value: openssl rand -base64 32 — do NOT reuse local>
AUTH_TRUST_HOST=true
AUTH_URL=https://npr-dashboard-prototype-production.up.railway.app
GOOGLE_CLIENT_ID=<same as .env.local>
GOOGLE_CLIENT_SECRET=<same as .env.local>
ALLOWED_EMAILS=carrie@utstitle.com,mike@utstitle.com
```

- [ ] **Step 2: Add Postgres service**

Railway project → **+ New → Database → PostgreSQL**. After provisioning, in the web service Variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

(That `${{...}}` is Railway's internal reference. It auto-resolves to the Postgres URL.)

- [ ] **Step 3: Run migrations against Railway Postgres**

From local, using the Railway Postgres public URL (copy from its Variables tab):

```bash
DATABASE_URL="<paste Railway Postgres URL>" npm run db:migrate
```

- [ ] **Step 4: Push to trigger redeploy**

If Task 9 (GitHub connect) is done, `git push` auto-deploys. If not, do Task 9 first then push.

- [ ] **Step 5: Verify**

Visit `https://npr-dashboard-prototype-production.up.railway.app`:
- Expected: redirect to `/sign-in`
- Sign in with Carrie's email → prototype home loads
- Non-allowlisted email → rejected

If you see `redirect_uri_mismatch`, Google Cloud Console's redirect URIs don't include the Railway URL exactly — re-check Task 5.

---

## Task 9 — Connect GitHub to Railway (one-time, if not already done)

Fixes the intermittent `/up` CLI upload timeouts by moving to push-based deploys.

- [ ] Railway UI → `npr-dashboard-prototype` service → Settings → Source → **Connect GitHub repo**
- [ ] Select `glh280/npr-dashboard-prototype`, branch `master`
- [ ] Enable "Auto deploy on push"
- [ ] From now on: `git push` triggers a deploy. No more CLI gambles.

---

## Phase 0 completion checklist

- [ ] `npm test` passes locally (7 unit tests)
- [ ] `npm run test:e2e` passes locally (2 smoke tests)
- [ ] Local: Carrie signs in → sees the prototype with her real name in avatar
- [ ] Local: non-allowlisted email is rejected
- [ ] Railway URL: same flow works end-to-end
- [ ] Postgres on Railway has the 4 Auth.js tables
- [ ] `.env*` and `.env.local` gitignored; no real secrets in committed files
- [ ] `grep -rE "AUTH_SECRET|GOOGLE_CLIENT_(ID|SECRET)=|sk-ant-" .` returns nothing real
- [ ] `AUDIT.md` present at repo root
- [ ] `.env.example` has placeholders only

When all boxes check: **P0 done. Proceed to P1 (deals table + list view reading from DB).**

---

## Notes for P1+

- The prototype's `mock/deals.ts` stays as-is during P0. P1 introduces the `deals` table, rewrites `app/page.tsx` to read from DB, and deletes the mock file once `getActiveDeals()` is wired.
- `AUDIT.md` maps every remaining interactive surface to the module that will power it.
- Every new feature after P0 writes through a `lib/audit.ts::recordChange()` helper (created in P1).
- Anthropic + ClickUp + GHL keys don't ship until P6/P7/P8.

## Rollback plan

If Task 6 breaks the prototype (middleware blocks / causes loops):

```bash
rm middleware.ts
git commit -am "revert: temporarily disable middleware"
git push
```

This restores anonymous access. Fix the middleware, push again.
