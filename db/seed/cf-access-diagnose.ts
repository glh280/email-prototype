/**
 * cf-access-diagnose.ts — decode the CF Access redirect JWT to see exactly
 * why a service-token-authenticated request is being rejected.
 *
 * When CF Access refuses a service token, it returns 302 with a JSON
 * Web Token embedded in the redirect URL's `meta` query param. The
 * payload contains fields that reveal CF's reasoning:
 *   - service_token_status: boolean — did CF accept the token?
 *   - auth_status: "NONE" | "OK" | ... — overall auth state
 *   - common_name: string — which service token (if any) was identified
 *   - aud: string — the Access Application AUD the request targeted
 *   - mtls_auth, is_warp, is_gateway — other auth flavors CF considered
 *
 * This is read-only; makes one HTTP request to portal.utstitle.com.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;
const EXPECTED_AUD = process.env.CF_ACCESS_AUD;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("▶ CF Access service-token diagnosis\n");
  console.log(`  client_id prefix  : ${CLIENT_ID!.slice(0, 12)}…`);
  console.log(`  expected AUD      : ${EXPECTED_AUD ?? "(not set in .env.local)"}`);
  console.log();

  const res = await fetch("https://portal.utstitle.com/", {
    redirect: "manual",
    headers: {
      "CF-Access-Client-Id": CLIENT_ID!,
      "CF-Access-Client-Secret": CLIENT_SECRET!,
    },
  });

  console.log(`  HTTP status       : ${res.status}`);
  if (res.status === 200) {
    console.log("\n✓ Service token accepted. No further diagnosis needed.");
    return;
  }

  const location = res.headers.get("location") ?? "";
  const metaParam = new URL(location).searchParams.get("meta");
  if (!metaParam) {
    console.log("  (no `meta` param in redirect URL — cannot decode)");
    return;
  }

  const parts = metaParam.split(".");
  if (parts.length < 2) {
    console.log("  (meta param isn't a JWT; got " + parts.length + " parts)");
    return;
  }

  // JWT payload is URL-safe base64; pad and decode
  const payloadRaw = parts[1];
  const padded = payloadRaw + "=".repeat((4 - (payloadRaw.length % 4)) % 4);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));

  console.log("\n  ── CF Access meta JWT payload ──");
  for (const [k, v] of Object.entries(payload)) {
    // Skip noisy fields
    if (["app_session_hash", "nonce", "redirectURL", "typ"].includes(k)) continue;
    const str =
      typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    console.log(`    ${k.padEnd(24)}: ${str}`);
  }

  console.log("\n  ── diagnosis ──");
  const sts = payload.service_token_status;
  const aud = payload.aud;
  const cn = payload.common_name;

  if (sts === false) {
    console.log("  ✗ service_token_status: false");
    console.log("    → CF Access received the headers but no policy accepted them.");
    console.log("    → Possible causes (in likely order):");
    console.log("      (1) Application's 'Accept service tokens' option is OFF at the app level");
    console.log("          (Applications → [app] → Policies → Authentication → Accept service tokens)");
    console.log("      (2) The Include rule references a DIFFERENT service token than the");
    console.log("          one whose client_id we're sending. Verify the token ID in the");
    console.log("          Include rule matches .env.local's CF_ACCESS_CLIENT_ID.");
    console.log("      (3) The service token was revoked/expired and a new token with the");
    console.log("          same name was generated but .env.local still has the old secret.");
    console.log("      (4) The policy is on a DIFFERENT Access application (there may be");
    console.log("          multiple apps sharing hostname patterns).");
  }
  if (cn === "") {
    console.log(
      "  • common_name is empty → CF did not even attempt to bind the token",
    );
    console.log("    to an identity. Suggests (1) or the headers aren't reaching CF.");
  }
  if (EXPECTED_AUD && aud && EXPECTED_AUD !== aud) {
    console.log(
      `  ⚠ AUD mismatch: expected ${EXPECTED_AUD}, CF says ${aud}`,
    );
    console.log(
      "    CF_ACCESS_AUD in .env.local doesn't match the application the request hit.",
    );
  } else if (aud) {
    console.log(`  ✓ AUD matches .env.local: ${aud}`);
  }
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
