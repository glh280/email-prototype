import { describe, it, expect } from "vitest";
import { parseFilterParams, serializeFilterParams } from "@/lib/filter-params";

/**
 * Phase 1 Plan 06 Task 1 — URL filter param parser/serializer tests.
 *
 * Pure vitest (no DB). Exercises the 9 behaviors in the plan:
 *   - Defaults when empty
 *   - CSV parsing for multi-select (track, priority)
 *   - Tolerant filtering: unknown codes dropped, not throws
 *   - Date-range parsing
 *   - Invalid date-range → null
 *   - needsMe / overdue toggle semantics
 *   - Sort whitelist + invalid → default
 *   - Round-trip via serializeFilterParams (defaults omitted)
 *
 * Per D-12: AND across groups, OR within multi-select (query layer concern;
 * parser only validates and normalizes).
 * Per D-13: default sort = "activity_desc".
 */

describe("parseFilterParams (Phase 1 Plan 06)", () => {
  it("returns defaults when given an empty object", () => {
    const result = parseFilterParams({});
    expect(result).toEqual({
      needsMe: false,
      track: [],
      milestone: [],
      priority: [],
      overdue: false,
      closing: null,
      funding: null,
      taskDue: null,
      sort: "activity_desc",
    });
  });

  it('splits a CSV track param: "TE,FL" → ["TE","FL"]', () => {
    const result = parseFilterParams({ track: "TE,FL" });
    expect(result.track).toEqual(["TE", "FL"]);
  });

  it("filters out unknown track codes tolerantly (no throw)", () => {
    const result = parseFilterParams({ track: "TE,INVALID" });
    expect(result.track).toEqual(["TE"]);
  });

  it('parses priority multi-select: "HIGH,MEDIUM" + drops invalids', () => {
    const a = parseFilterParams({ priority: "HIGH,MEDIUM" });
    expect(a.priority).toEqual(["HIGH", "MEDIUM"]);
    const b = parseFilterParams({ priority: "HIGH,BOGUS,LOW" });
    expect(b.priority).toEqual(["HIGH", "LOW"]);
  });

  it('parses a closing date range: "2026-04-01..2026-04-30" → { from, to }', () => {
    const result = parseFilterParams({ closing: "2026-04-01..2026-04-30" });
    expect(result.closing).not.toBeNull();
    expect(result.closing!.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(result.closing!.to.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("returns closing = null for an invalid range string", () => {
    const result = parseFilterParams({ closing: "invalid" });
    expect(result.closing).toBeNull();
  });

  it('needsMe="1" → true; "0" or absent → false', () => {
    expect(parseFilterParams({ needsMe: "1" }).needsMe).toBe(true);
    expect(parseFilterParams({ needsMe: "0" }).needsMe).toBe(false);
    expect(parseFilterParams({}).needsMe).toBe(false);
  });

  it("accepts whitelisted sort values and falls back to activity_desc for invalid", () => {
    expect(parseFilterParams({ sort: "file_no_asc" }).sort).toBe("file_no_asc");
    expect(parseFilterParams({ sort: "priority_desc" }).sort).toBe(
      "priority_desc",
    );
    expect(parseFilterParams({ sort: "task_due_asc" }).sort).toBe(
      "task_due_asc",
    );
    expect(parseFilterParams({ sort: "bogus" }).sort).toBe("activity_desc");
    expect(parseFilterParams({}).sort).toBe("activity_desc");
  });

  it("serializeFilterParams round-trips and omits defaults", () => {
    const parsed = parseFilterParams({
      needsMe: "1",
      track: "TE,FL",
      priority: "HIGH",
      closing: "2026-04-01..2026-04-30",
      sort: "activity_desc", // default — must be omitted
    });
    const serialized = serializeFilterParams(parsed);
    // defaults stripped
    expect(serialized.has("sort")).toBe(false);
    expect(serialized.has("overdue")).toBe(false);
    expect(serialized.has("milestone")).toBe(false);
    // non-defaults preserved
    expect(serialized.get("needsMe")).toBe("1");
    expect(serialized.get("track")).toBe("TE,FL");
    expect(serialized.get("priority")).toBe("HIGH");
    expect(serialized.get("closing")).toBe("2026-04-01..2026-04-30");
  });

  it("milestone multi-select CSV is preserved as given (stage codes validated in query)", () => {
    const result = parseFilterParams({
      milestone: "pre_screen_qualification,title_order_opened",
    });
    expect(result.milestone).toEqual([
      "pre_screen_qualification",
      "title_order_opened",
    ]);
  });

  it("overdue='1' → true", () => {
    expect(parseFilterParams({ overdue: "1" }).overdue).toBe(true);
    expect(parseFilterParams({ overdue: "0" }).overdue).toBe(false);
  });
});
