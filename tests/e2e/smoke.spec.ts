import { test, expect } from "@playwright/test";

/**
 * Post-P0.5 smoke: app is behind Cloudflare Access. Any request to the app
 * origin without a valid `Cf-Access-Jwt-Assertion` header must return 401.
 *
 * These tests run against `localhost:3000` with dev-placeholder CF_ACCESS_*
 * values in .env.local — no tunnel, no real Access JWT, so the proxy fails
 * closed as designed.
 */

test("unauthenticated request to / returns 401", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(401);
  expect(await response.text()).toContain("Unauthorized");
});

test("unauthenticated request to /deal/d_elm_st returns 401", async ({ request }) => {
  const response = await request.get("/deal/d_elm_st");
  expect(response.status()).toBe(401);
});

test("request with invalid JWT returns 401", async ({ request }) => {
  const response = await request.get("/", {
    headers: { "cf-access-jwt-assertion": "obviously.not.a.valid.jwt" },
  });
  expect(response.status()).toBe(401);
});
