import { describe, it, expect } from "vitest";
import { parseMoney } from "@/lib/parse-money";

/**
 * Phase 1 Plan 05 Task 1 — parseMoney helper tests.
 *
 * parseMoney normalizes user-typed money strings (e.g. "$485,000") into
 * integer USD. Used on blur from $-prefix inputs in the New Deal form, so
 * copy-pastes like "$1,234.56" land in the form state as the integer 1234.
 *
 * Contract (11 behaviors from plan 05):
 *   - null / undefined / "" / whitespace-only  → null
 *   - "485000" / "485,000" / "$485,000"        → 485000
 *   - "$ 485,000 " (extra whitespace)          → 485000
 *   - "0"                                       → 0 (valid explicit zero)
 *   - "485,000.75" (decimals)                   → 485000 (truncate, don't round)
 *   - "abc" (garbage)                           → null
 *   - "-50" (negative)                          → null
 */
describe("parseMoney", () => {
  it("Test 1: empty string returns null", () => {
    expect(parseMoney("")).toBe(null);
  });

  it("Test 2: null returns null", () => {
    expect(parseMoney(null)).toBe(null);
  });

  it("Test 3: undefined returns null", () => {
    expect(parseMoney(undefined)).toBe(null);
  });

  it("Test 4: plain integer string returns integer", () => {
    expect(parseMoney("485000")).toBe(485000);
  });

  it("Test 5: comma-grouped string returns integer", () => {
    expect(parseMoney("485,000")).toBe(485000);
  });

  it("Test 6: $-prefix string returns integer", () => {
    expect(parseMoney("$485,000")).toBe(485000);
  });

  it("Test 7: extra whitespace around $-prefix + commas returns integer", () => {
    expect(parseMoney("$ 485,000 ")).toBe(485000);
  });

  it("Test 8: explicit zero returns 0 (not null)", () => {
    expect(parseMoney("0")).toBe(0);
  });

  it("Test 9: decimal portion is truncated (not rounded)", () => {
    expect(parseMoney("485,000.75")).toBe(485000);
  });

  it("Test 10: non-numeric garbage returns null", () => {
    expect(parseMoney("abc")).toBe(null);
  });

  it("Test 11: negative number returns null", () => {
    expect(parseMoney("-50")).toBe(null);
  });

  // Extra edge cases (non-blocking, but cheap to lock in)
  it("whitespace-only input returns null", () => {
    expect(parseMoney("   ")).toBe(null);
  });

  it("lone $ returns null", () => {
    expect(parseMoney("$")).toBe(null);
  });
});
