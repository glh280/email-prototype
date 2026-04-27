import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Run DB-touching test files serially. Multiple files (file-no.test.ts,
    // create-deal-action.test.ts) manipulate the shared per-year Postgres
    // sequence `deals_file_no_YYYY_seq` and the `deals` / `audit_log` tables.
    // Parallelism across files causes OID cache invalidation and counter
    // collisions (see Plan 05 deviation log). Within a single file, tests
    // still run sequentially by default (same describe block).
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
