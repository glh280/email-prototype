import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, type JWK } from "jose";
import { verifyAccessJwt, type AccessConfig } from "@/lib/access";

const TEAM_DOMAIN = "test.cloudflareaccess.com";
const AUD = "test-aud-0123456789abcdef";
const ISS = `https://${TEAM_DOMAIN}`;
const CONFIG: AccessConfig = { teamDomain: TEAM_DOMAIN, aud: AUD };

/**
 * Test harness:
 *   - Generate an RS256 key pair before tests run.
 *   - Provide a local JWKSet (containing only the public key) to verifyAccessJwt
 *     via the optional `jwks` injection point so tests don't hit the network.
 *   - mintTestToken signs a token with the private key; the default claims can
 *     be overridden per test to produce invalid AUD / ISS / missing email etc.
 */

let privateKey: CryptoKey;
let jwks: ReturnType<typeof makeJwksFn>;

function makeJwksFn(publicJwk: JWK) {
  // A local JWKSet that matches the shape `jose.createRemoteJWKSet` returns —
  // it's a function that takes a JWT header and returns the matching key.
  return async () => {
    const { importJWK } = await import("jose");
    return importJWK(publicJwk, "RS256");
  };
}

async function mintTestToken(overrides: Partial<Record<string, unknown>> = {}) {
  const payload = {
    email: "carrie@utstitle.com",
    sub: "u-carrie",
    ...overrides,
  };
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer((overrides.iss as string) ?? ISS)
    .setAudience((overrides.aud as string) ?? AUD)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

beforeAll(async () => {
  const keypair = await generateKeyPair("RS256");
  privateKey = keypair.privateKey;
  const publicJwk = await exportJWK(keypair.publicKey);
  jwks = makeJwksFn(publicJwk);
});

describe("verifyAccessJwt", () => {
  it("rejects a missing token", async () => {
    await expect(verifyAccessJwt(undefined, CONFIG, { jwks })).rejects.toThrow(/missing/i);
  });

  it("rejects a malformed token", async () => {
    await expect(verifyAccessJwt("not-a-jwt", CONFIG, { jwks })).rejects.toThrow();
  });

  it("rejects a token with the wrong AUD", async () => {
    const token = await mintTestToken({ aud: "different-aud" });
    await expect(verifyAccessJwt(token, CONFIG, { jwks })).rejects.toThrow(/aud/i);
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await mintTestToken({ iss: "https://evil.cloudflareaccess.com" });
    await expect(verifyAccessJwt(token, CONFIG, { jwks })).rejects.toThrow(/iss/i);
  });

  it("rejects a token with NEITHER email nor common_name", async () => {
    const token = await mintTestToken({ email: undefined, common_name: undefined });
    await expect(verifyAccessJwt(token, CONFIG, { jwks })).rejects.toThrow(/email.*common_name|common_name.*email/i);
  });

  it("extracts email from verified claims (not header)", async () => {
    const token = await mintTestToken({ email: "mike@utstitle.com" });
    const claims = await verifyAccessJwt(token, CONFIG, { jwks });
    expect(claims.email).toBe("mike@utstitle.com");
    expect(claims.sub).toBe("u-carrie");
  });

  // Service-token authentication (CF Access Service Auth policy).
  // Service-token JWTs have `common_name` (the token's client ID) but no `email` claim.
  // We synthesize a stable service: email so downstream code (upsertUserFromAccess,
  // audit_log attribution) treats the service identity as a distinct user row per token.

  it("accepts a service-token JWT (common_name present, email absent)", async () => {
    const token = await mintTestToken({
      email: undefined,
      common_name: "01234567-89ab-cdef-0123-456789abcdef.access",
    });
    const claims = await verifyAccessJwt(token, CONFIG, { jwks });
    expect(claims.email).toBe("service:01234567-89ab-cdef-0123-456789abcdef.access@cf-access");
    expect(claims.common_name).toBe("01234567-89ab-cdef-0123-456789abcdef.access");
  });

  it("synthesizes a default name for service-token JWTs missing a name claim", async () => {
    const token = await mintTestToken({
      email: undefined,
      common_name: "uat-playwright.access",
    });
    const claims = await verifyAccessJwt(token, CONFIG, { jwks });
    expect(claims.name).toBe("CF Access Service (uat-playwright.access)");
  });

  it("prefers explicit email when both email and common_name are present (defensive)", async () => {
    const token = await mintTestToken({
      email: "mike@utstitle.com",
      common_name: "should-be-ignored.access",
    });
    const claims = await verifyAccessJwt(token, CONFIG, { jwks });
    expect(claims.email).toBe("mike@utstitle.com");
    // common_name is still surfaced in claims for diagnostics, but NOT used to
    // override the authoritative user email:
    expect(claims.common_name).toBe("should-be-ignored.access");
  });

  it("service-identity synthesized email is stable per common_name (idempotent identity key)", async () => {
    const cn = "regression-ci.access";
    const token1 = await mintTestToken({ email: undefined, common_name: cn });
    const token2 = await mintTestToken({ email: undefined, common_name: cn });
    const c1 = await verifyAccessJwt(token1, CONFIG, { jwks });
    const c2 = await verifyAccessJwt(token2, CONFIG, { jwks });
    expect(c1.email).toBe(c2.email);
    expect(c1.email).toBe(`service:${cn}@cf-access`);
  });
});
