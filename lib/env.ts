import { z } from "zod";

/**
 * Environment validation.
 *
 * Phase 0.5 transition note:
 * - Auth.js vars (AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS,
 *   AUTH_TRUST_HOST, AUTH_URL) removed in A2.
 * - Cloudflare Access vars (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD) are optional during
 *   P0.5 transition and will be tightened to required in B6 once proxy.ts enforces them.
 * - ENCRYPTION_KEY is optional until C3 (crypto.ts). Then tightened to required.
 * - GMAIL_* vars arrive in P4/P5 for Gmail API — left optional here.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),

  // Cloudflare Access — required now (B6 onwards) since proxy.ts enforces them
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1),
  CF_ACCESS_AUD: z.string().min(1),

  // Public branding (D-06 — exposed to the browser as NEXT_PUBLIC_*)
  // Promoted from hardcoded strings so template-extraction users rebrand via env.
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9.-]+$/, "must be a bare domain (no scheme, no path)"),
  NEXT_PUBLIC_APP_BRAND_COLOR: z.string().optional(),

  // Column-level NPI encryption (required in C3+)
  // 32-byte base64 is 44 chars including padding
  ENCRYPTION_KEY: z.string().min(44).optional(),

  // Gmail API (required in P4/P5 — per-user OAuth, not auth)
  GMAIL_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GMAIL_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Environment validation failed:\n${issues}`);
}

export const env = parsed.data;
