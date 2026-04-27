import { defineConfig } from "@playwright/test";
import { config as dotenvConfig } from "dotenv";
import * as path from "node:path";

/**
 * Playwright configuration for live production UAT runs against
 * `https://portal.utstitle.com`.
 *
 * Authentication: Path B (cookie injection). The operator signs in once in
 * their real browser, copies the `CF_Authorization` cookie value from DevTools,
 * and stores it in `.env.local` as `CF_AUTHORIZATION_COOKIE=<jwt>`. Playwright
 * injects that cookie into every test's browser context before navigation, so
 * requests reach CF Access pre-authenticated as the real user identity.
 *
 * Trade-off: the cookie expires ~24h after issue. If tests start 302-redirecting
 * to `accounts.google.com`, the cookie is stale — refresh it in DevTools and
 * paste the new value into `.env.local`.
 *
 * Separate from the default `playwright.config.ts` (which targets localhost:3000
 * with the smoke.spec.ts suite). This config never spins up a web server —
 * it tests the running Railway-deployed production app.
 *
 * Run with: npm run test:uat
 */

dotenvConfig({ path: path.resolve(__dirname, ".env.local") });

const cookie = process.env.CF_AUTHORIZATION_COOKIE;

if (!cookie || cookie.length < 100) {
  throw new Error(
    "Missing (or suspiciously short) CF_AUTHORIZATION_COOKIE in .env.local. " +
      "Sign in to https://portal.utstitle.com in your browser, open DevTools → " +
      "Application → Cookies → find `CF_Authorization` for portal.utstitle.com, " +
      "copy the value, and paste into .env.local as CF_AUTHORIZATION_COOKIE=<value>.",
  );
}

export default defineConfig({
  testDir: "./tests/e2e/uat",
  testMatch: /.+\.spec\.ts$/,
  fullyParallel: false, // Serial: UAT may create data; parallel mutations blur findings
  reporter: [
    ["list"],
    ["html", { outputFolder: ".playwright-uat/report", open: "never" }],
    ["json", { outputFile: ".playwright-uat/results.json" }],
  ],
  outputDir: ".playwright-uat/test-results",
  timeout: 60_000,
  use: {
    baseURL: "https://portal.utstitle.com",
    trace: "on",
    screenshot: "on",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false,
    // Cookie injection happens per-test via `context.addCookies(...)` in a
    // beforeEach hook — see `tests/e2e/uat/p1-uat.spec.ts`. We don't set it
    // at config level because Playwright contexts are fresh per worker; the
    // hook ensures every test's context has the cookie before navigation.
  },
});
