/**
 * Barrel for the split Drizzle schema (D-04).
 *
 * `auth.ts` holds cross-project tables (users, npi_access_log) — the template
 * extraction seam.
 * `app.ts` holds NPR Dashboard domain tables (tracks, stages, deals, audit_log).
 *
 * Consumers continue to `import { ... } from "@/db/schema"` — nothing downstream
 * had to change when the single-file schema became a directory.
 */
export * from "./auth";
export * from "./app";
