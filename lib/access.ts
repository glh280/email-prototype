import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

/**
 * jose v6 dropped the `KeyLike` export. The verify function accepts either a
 * key getter (JWTVerifyGetKey, from createRemoteJWKSet) or a direct key
 * (CryptoKey | Uint8Array). We model the latter as `CryptoKey | Uint8Array`
 * plus an async factory used by tests.
 */
type DirectKey = CryptoKey | Uint8Array;
type KeyFactory = () => Promise<DirectKey>;

/**
 * Cloudflare Access JWT verification.
 *
 * Cloudflare Access sits in front of the Next.js app (via the cloudflared
 * tunnel sidecar). On every authenticated request it attaches the user's
 * signed identity as a JWT in the `Cf-Access-Jwt-Assertion` header. This
 * module verifies that JWT against Cloudflare's JWKS and returns the claims.
 *
 * Security-critical points:
 * - The JWT is authoritative; the `Cf-Access-Authenticated-User-Email` header
 *   is NOT trusted alone (any misconfigured origin bypass would let attackers
 *   forge it). Email must come from the verified JWT claims.
 * - `aud` (audience) must match the Access application's AUD tag.
 * - `iss` (issuer) must match the team domain.
 *
 * Caching: JWKS fetches are cached by `jose` for 10 minutes by default. On
 * cache miss or expiry, it refetches the key set from Cloudflare's JWKS URL
 * `https://<teamDomain>/cdn-cgi/access/certs`.
 */

export type AccessClaims = JWTPayload & {
  email: string;
  sub: string;
  identity_nonce?: string;
  country?: string;
  name?: string;
  /**
   * Service-token identifier. Present on JWTs minted by CF Access under a
   * "Service Auth" policy (see CF Zero Trust → Access → Service Auth). For
   * service-token authentication, `email` is synthesized as
   * `service:{common_name}@cf-access` so downstream identity handling treats
   * each service token as a distinct user row.
   */
  common_name?: string;
};

export type AccessConfig = {
  /** e.g. "npr.cloudflareaccess.com" — no protocol, no trailing slash */
  teamDomain: string;
  /** Application AUD tag from Cloudflare Access → Applications → <app> */
  aud: string;
};

/**
 * Options for `verifyAccessJwt`. Production callers omit `jwks`, so the
 * remote set from Cloudflare is used. Unit tests inject a local JWKSet
 * backed by a test key pair to avoid network + key-rotation concerns.
 */
export type VerifyOptions = {
  jwks?: JWTVerifyGetKey | KeyFactory;
};

let remoteJwksCache:
  | { teamDomain: string; jwks: JWTVerifyGetKey }
  | undefined;

function getJwks(teamDomain: string): JWTVerifyGetKey {
  if (remoteJwksCache && remoteJwksCache.teamDomain === teamDomain) {
    return remoteJwksCache.jwks;
  }
  const url = new URL(`https://${teamDomain}/cdn-cgi/access/certs`);
  const jwks = createRemoteJWKSet(url);
  remoteJwksCache = { teamDomain, jwks };
  return jwks;
}

/**
 * Verify a Cloudflare Access JWT and return its claims.
 *
 * Two identity paths are supported:
 *
 *   1. **User identity** — interactive Google IdP sign-in. JWT has `email` claim
 *      set to the authenticated user's address. Returned as-is.
 *   2. **Service-token identity** — CF Access "Service Auth" policy. JWT has
 *      `common_name` (the service token's client ID) but NO `email` claim. We
 *      synthesize a stable `email = service:{common_name}@cf-access` so
 *      downstream identity handling (`upsertUserFromAccess`, audit attribution)
 *      treats each service token as a distinct user row. The default `name` is
 *      also synthesized if not already present on the JWT.
 *
 * Either claim suffices; if both are present, email is authoritative and
 * common_name is surfaced for diagnostics without overriding email.
 *
 * @throws {Error} "missing" if token is undefined/empty
 * @throws {Error} signature/audience/issuer failures from `jose`
 * @throws {Error} if BOTH email and common_name claims are absent
 */
export async function verifyAccessJwt(
  token: string | undefined,
  config: AccessConfig,
  opts: VerifyOptions = {},
): Promise<AccessClaims> {
  if (!token) {
    throw new Error("Access JWT missing from request");
  }

  // `jose.jwtVerify` accepts either a JWTVerifyGetKey function (what
  // createRemoteJWKSet returns), or a single KeyLike/Uint8Array. The
  // test-injected `() => Promise<KeyLike>` matches the latter after one await.
  // Resolve the key callback: production path uses the remote JWKS; tests
  // inject a no-arg async factory. Normalize both to the JWTVerifyGetKey
  // shape that `jwtVerify` expects.
  let keyCb: JWTVerifyGetKey;
  if (opts.jwks) {
    // If the injected value has length 0 (takes no args), wrap it so it
    // matches JWTVerifyGetKey's (protectedHeader, token) signature.
    keyCb =
      (opts.jwks as KeyFactory).length === 0
        ? (async () => (await (opts.jwks as KeyFactory)()) as unknown as CryptoKey)
        : (opts.jwks as JWTVerifyGetKey);
  } else {
    keyCb = getJwks(config.teamDomain);
  }

  const { payload } = await jwtVerify(token, keyCb, {
    issuer: `https://${config.teamDomain}`,
    audience: config.aud,
  });

  const email =
    typeof payload.email === "string" && payload.email.length > 0
      ? payload.email
      : undefined;
  const commonName =
    typeof payload.common_name === "string" && payload.common_name.length > 0
      ? payload.common_name
      : undefined;

  if (!email && !commonName) {
    throw new Error(
      "Access JWT missing both email and common_name claims (neither user nor service identity)",
    );
  }

  // Service-token identity path: fabricate a stable `service:{common_name}@cf-access`
  // email so the rest of the app (upsertUserFromAccess, audit_log attribution)
  // doesn't need to know whether the caller is a human or a CF Service Token.
  // Each token gets its own user row — audit trails stay distinguishable.
  if (!email && commonName) {
    return {
      ...payload,
      email: `service:${commonName}@cf-access`,
      name:
        typeof payload.name === "string"
          ? payload.name
          : `CF Access Service (${commonName})`,
    } as AccessClaims;
  }

  // Standard user-identity path: email is authoritative. common_name (if
  // present on the JWT) is preserved in returned claims for diagnostics but
  // NOT used to override the user's email.
  return payload as AccessClaims;
}
