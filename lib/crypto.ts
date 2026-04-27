import { encryptString, decryptString } from "@47ng/cloak";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { npiAccessLog } from "@/db/schema";

/**
 * Convert 32 raw bytes into cloak's serialized key format.
 *
 * Format: `k1.aesgcm256.{base64url-encoded-raw-key}`
 * (see @47ng/cloak/dist/key.js — `formatKey` isn't re-exported from the
 * package root, so we build the string ourselves from the documented spec.)
 */
function rawBytesToCloakKey(raw: Uint8Array): string {
  const b64url = Buffer.from(raw).toString("base64url");
  return `k1.aesgcm256.${b64url}`;
}

/**
 * Column-level NPI encryption + non-skippable read audit.
 *
 * This module is the single path through which encrypted NPI fields enter and
 * leave the database. Protects against:
 *   - DB credential leak / backup exposure (data remains encrypted at rest
 *     beyond Postgres's own encryption)
 *   - Unaudited reads of NPI by internal users (every decrypt writes to
 *     npi_access_log before returning plaintext)
 *
 * Implementation notes:
 * - Uses @47ng/cloak (AES-GCM 256) for encryption primitives.
 * - ENCRYPTION_KEY is a raw 32-byte value, base64-encoded (from
 *   `openssl rand -base64 32`). We convert it to cloak's serialized format
 *   (`k1.aesgcm256.{base64url}`) on module load.
 * - The decrypt() function writes to npi_access_log BEFORE returning the
 *   plaintext. If the insert fails, decryption fails too — by design.
 */

/**
 * Lazy-initialized cloak-format key, parsed from env once per process.
 * Exported for testability but shouldn't be called outside this module.
 */
let _cloakKey: string | undefined;
function getCloakKey(): string {
  if (_cloakKey) return _cloakKey;
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY is not set. lib/crypto.ts requires a 32-byte base64-encoded key.",
    );
  }

  // Accept either format: raw 32-byte base64 (from `openssl rand -base64 32`,
  // what we ship in the PLAN) or the full cloak format (k1.aesgcm256.{b64url}).
  if (env.ENCRYPTION_KEY.startsWith("k1.aesgcm256.")) {
    _cloakKey = env.ENCRYPTION_KEY;
    return _cloakKey;
  }

  // Raw 32-byte base64 → Uint8Array → cloak format
  const raw = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (raw.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be a 32-byte (256-bit) base64 value; got ${raw.length} bytes.`,
    );
  }
  _cloakKey = rawBytesToCloakKey(new Uint8Array(raw));
  return _cloakKey;
}

/**
 * Encrypt a plaintext string. Safe to call on every write of an NPI field.
 * No audit entry — only reads are logged (writes are logged via the caller's
 * `change_history` row already, which is Layer 1 of the audit model).
 */
export async function encrypt(plaintext: string): Promise<string> {
  return encryptString(plaintext, getCloakKey());
}

/**
 * Context passed to decrypt() for the audit log entry. Callers MUST provide
 * the user + field; deal/contact are optional but help searchability.
 */
export type DecryptContext = {
  /** Email of the user whose session requested the decryption */
  userEmail: string;
  /** Fully-qualified column name, e.g. "contacts.ssn" */
  fieldAccessed: string;
  /** Associated deal, if known at decrypt-time */
  dealId?: string;
  /** Associated contact, if known at decrypt-time */
  contactId?: string;
  /** Optional user-supplied reason for the read (UI surfaces this later) */
  purpose?: string;
};

/**
 * Decrypt an NPI ciphertext AND log the read.
 *
 * INVARIANT: every call inserts exactly one row into npi_access_log. This is
 * enforced by the fact that the database insert happens BEFORE the plaintext
 * is returned. If the insert throws, the function throws. There is no code
 * path through this function that returns plaintext without logging.
 *
 * If you need to decrypt without logging for infrastructure reasons (e.g.
 * re-encrypting with a rotated key during a migration), do NOT use this
 * function — open a separate maintenance path that is code-reviewed
 * specifically for the lack of audit.
 */
export async function decrypt(ciphertext: string, ctx: DecryptContext): Promise<string> {
  await db.insert(npiAccessLog).values({
    userEmail: ctx.userEmail,
    fieldAccessed: ctx.fieldAccessed,
    dealId: ctx.dealId ?? null,
    contactId: ctx.contactId ?? null,
    purpose: ctx.purpose ?? null,
  });
  return decryptString(ciphertext, getCloakKey());
}

/** Reset the cached key. Exported ONLY for test isolation; do not call at runtime. */
export function _resetKeyCache(): void {
  _cloakKey = undefined;
}
