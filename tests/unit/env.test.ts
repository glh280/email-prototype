import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("env validation (P0.5 Stage B+)", () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env = { ...original };
  });
  afterEach(() => {
    process.env = original;
  });

  function setRequired() {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    process.env.CF_ACCESS_TEAM_DOMAIN = "npr.cloudflareaccess.com";
    process.env.CF_ACCESS_AUD = "a".repeat(64);
    // D-06 public branding — required from Plan 01-02 onwards
    process.env.NEXT_PUBLIC_APP_NAME = "NPR Dashboard";
    process.env.NEXT_PUBLIC_APP_DOMAIN = "portal.utstitle.com";
  }

  it("throws when DATABASE_URL is missing", async () => {
    setRequired();
    process.env.DATABASE_URL = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix is a Vite pattern, not typed
    await expect(import("@/lib/env?no-db")).rejects.toThrow();
  });

  it("throws when CF_ACCESS_TEAM_DOMAIN is missing", async () => {
    setRequired();
    process.env.CF_ACCESS_TEAM_DOMAIN = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?no-team")).rejects.toThrow();
  });

  it("throws when CF_ACCESS_AUD is missing", async () => {
    setRequired();
    process.env.CF_ACCESS_AUD = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?no-aud")).rejects.toThrow();
  });

  it("accepts the minimal required env", async () => {
    setRequired();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { env } = await import("@/lib/env?required");
    expect(env.DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
    expect(env.CF_ACCESS_TEAM_DOMAIN).toBe("npr.cloudflareaccess.com");
    expect(env.CF_ACCESS_AUD).toHaveLength(64);
    expect(env.ENCRYPTION_KEY).toBeUndefined();
  });

  it("rejects ENCRYPTION_KEY shorter than 44 chars (32-byte base64 minimum)", async () => {
    setRequired();
    process.env.ENCRYPTION_KEY = "too-short";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?short-key")).rejects.toThrow();
  });

  // D-06 — NEXT_PUBLIC_APP_NAME + NEXT_PUBLIC_APP_DOMAIN + optional brand color
  it("accepts NEXT_PUBLIC_APP_NAME and NEXT_PUBLIC_APP_DOMAIN", async () => {
    setRequired();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { env } = await import("@/lib/env?public-branding-ok");
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("NPR Dashboard");
    expect(env.NEXT_PUBLIC_APP_DOMAIN).toBe("portal.utstitle.com");
    expect(env.NEXT_PUBLIC_APP_BRAND_COLOR).toBeUndefined();
  });

  it("rejects missing NEXT_PUBLIC_APP_NAME", async () => {
    setRequired();
    process.env.NEXT_PUBLIC_APP_NAME = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?no-app-name")).rejects.toThrow(/NEXT_PUBLIC_APP_NAME/);
  });

  it("rejects missing NEXT_PUBLIC_APP_DOMAIN", async () => {
    setRequired();
    process.env.NEXT_PUBLIC_APP_DOMAIN = "";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?no-app-domain")).rejects.toThrow(/NEXT_PUBLIC_APP_DOMAIN/);
  });

  it("treats NEXT_PUBLIC_APP_BRAND_COLOR as optional", async () => {
    setRequired();
    delete process.env.NEXT_PUBLIC_APP_BRAND_COLOR;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    const { env } = await import("@/lib/env?brand-color-absent");
    expect(env.NEXT_PUBLIC_APP_BRAND_COLOR).toBeUndefined();
  });

  it("rejects NEXT_PUBLIC_APP_DOMAIN with a scheme (must be bare domain)", async () => {
    setRequired();
    process.env.NEXT_PUBLIC_APP_DOMAIN = "https://portal.utstitle.com";
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — cache-bust suffix
    await expect(import("@/lib/env?scheme-rejected")).rejects.toThrow(/must be a bare domain/);
  });
});
