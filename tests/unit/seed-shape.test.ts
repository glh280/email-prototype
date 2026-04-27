import { describe, it, expect } from "vitest";
import { TRACK_SEEDS } from "@/db/seed/tracks";
import { STAGE_SEEDS } from "@/db/seed/stages";

/**
 * Seed-shape tests — pure in-process (no DB connection).
 *
 * These assertions encode DEAL-01 + STAGE-01 verbatim. If any of them start
 * failing, the fix is to correct the seed data, not to loosen the assertion.
 */

describe("TRACK_SEEDS (DEAL-01)", () => {
  it("has exactly 8 entries", () => {
    expect(TRACK_SEEDS).toHaveLength(8);
  });

  it("covers all required codes (no extras, no missing)", () => {
    const codes = TRACK_SEEDS.map((t) => t.code).sort();
    expect(codes).toEqual(["BL", "DP", "EC", "FL", "GI", "PO", "SL", "TE"]);
  });

  it("TE and FL are HIGH priority; the other six are MEDIUM", () => {
    const byCode = Object.fromEntries(TRACK_SEEDS.map((t) => [t.code, t]));
    expect(byCode.TE.defaultPriority).toBe("HIGH");
    expect(byCode.FL.defaultPriority).toBe("HIGH");
    for (const c of ["DP", "PO", "EC", "SL", "BL", "GI"]) {
      expect(byCode[c].defaultPriority).toBe("MEDIUM");
    }
  });

  it("sortOrder values are all unique", () => {
    const sorts = TRACK_SEEDS.map((t) => t.sortOrder);
    expect(new Set(sorts).size).toBe(sorts.length);
  });
});

describe("STAGE_SEEDS (STAGE-01)", () => {
  it("has exactly 25 entries", () => {
    expect(STAGE_SEEDS).toHaveLength(25);
  });

  it("has 4 universal stages (trackCode === null)", () => {
    expect(STAGE_SEEDS.filter((s) => s.trackCode === null)).toHaveLength(4);
  });

  it("has 10 Title & Escrow stages", () => {
    expect(STAGE_SEEDS.filter((s) => s.trackCode === "TE")).toHaveLength(10);
  });

  it("has 11 Funding & Lending stages", () => {
    expect(STAGE_SEEDS.filter((s) => s.trackCode === "FL")).toHaveLength(11);
  });

  it("all stage codes are unique", () => {
    const codes = STAGE_SEEDS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("only file_completed and killed are terminal", () => {
    const terminal = STAGE_SEEDS.filter((s) => s.isTerminal === true)
      .map((s) => s.code)
      .sort();
    expect(terminal).toEqual(["file_completed", "killed"]);
  });

  it("sortOrder values are unique within each track-scope", () => {
    for (const scope of [null, "TE", "FL"] as const) {
      const sorts = STAGE_SEEDS.filter((s) => s.trackCode === scope).map(
        (s) => s.sortOrder,
      );
      expect(new Set(sorts).size).toBe(sorts.length);
    }
  });

  it("every non-null trackCode is one of the 8 DEAL-01 track codes", () => {
    const validCodes = new Set(TRACK_SEEDS.map((t) => t.code));
    for (const s of STAGE_SEEDS) {
      if (s.trackCode !== null) {
        expect(validCodes.has(s.trackCode)).toBe(true);
      }
    }
  });

  it("includes the canonical universal codes (pre_screen_qualification, deal_structuring, file_completed, killed)", () => {
    const universalCodes = STAGE_SEEDS.filter((s) => s.trackCode === null)
      .map((s) => s.code)
      .sort();
    expect(universalCodes).toEqual(
      ["deal_structuring", "file_completed", "killed", "pre_screen_qualification"],
    );
  });
});
