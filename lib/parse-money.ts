/**
 * Parse a user-typed money string into integer USD (whole dollars).
 *
 * Used on blur from $-prefix inputs in the New Deal form (Phase 1 Plan 05).
 * The deal schema stores money fields as `integer` (whole dollars, per
 * UI-SPEC + db/schema/app.ts). A future money-type refactor can reshape.
 *
 * Accepts:
 *   - "485000"       → 485000
 *   - "485,000"      → 485000
 *   - "$485,000"     → 485000
 *   - "$ 485,000 "   → 485000
 *   - "485,000.75"   → 485000  (decimals truncated, never rounded)
 *   - "0"            → 0       (valid explicit zero)
 *
 * Returns null for:
 *   - null / undefined / ""            (nothing typed)
 *   - whitespace-only                  (no signal)
 *   - "abc" / other non-numeric        (tolerant — Zod nonnegative() catches later)
 *   - "-50" / any negative             (money fields are non-negative by contract)
 *   - lone "$"                         (no value to parse)
 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // Strip $ and commas and all internal whitespace; keep digits, dot,
  // and a leading minus so we can explicitly reject negatives below.
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;

  // Reject negative numbers explicitly (money fields are non-negative).
  if (cleaned.startsWith("-")) return null;

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;

  return Math.trunc(parsed);
}
