import { describe, it, expect } from "vitest";
import {
  parseContactsFilterParams,
  serializeContactsFilterParams,
  hasAnyContactsFilter,
} from "@/lib/contacts-filter-params";

/**
 * Phase 3 Plan 05 Task 1 — /contacts URL-state helper tests (RED).
 *
 * Pure vitest (no DB). Mirrors tests/unit/filter-params.test.ts cadence but
 * the /contacts page has a single URL param today: `q`.
 *
 * Per D-07: URL-state is source of truth. Parser trims whitespace; serializer
 * omits the default (empty string) so the URL stays clean at /contacts.
 */

describe("parseContactsFilterParams", () => {
  it("returns default {q: ''} for empty search params", () => {
    expect(parseContactsFilterParams({})).toEqual({ q: "" });
  });

  it("returns {q: 'alice'} for q=alice", () => {
    expect(parseContactsFilterParams({ q: "alice" })).toEqual({ q: "alice" });
  });

  it("treats whitespace-only q as empty", () => {
    expect(parseContactsFilterParams({ q: "   " })).toEqual({ q: "" });
  });

  it("uses first element when q is given as array (Next.js 16 shape)", () => {
    expect(parseContactsFilterParams({ q: ["a", "b"] })).toEqual({ q: "a" });
  });

  it("trims leading/trailing whitespace but preserves internal spaces", () => {
    expect(parseContactsFilterParams({ q: "  hello world  " })).toEqual({
      q: "hello world",
    });
  });
});

describe("serializeContactsFilterParams", () => {
  it("omits q when empty (clean default URL)", () => {
    const result = serializeContactsFilterParams({ q: "" });
    expect(result.toString()).toBe("");
  });

  it("emits q=alice", () => {
    const result = serializeContactsFilterParams({ q: "alice" });
    expect(result.toString()).toBe("q=alice");
  });
});

describe("hasAnyContactsFilter", () => {
  it("returns false when q is empty", () => {
    expect(hasAnyContactsFilter({ q: "" })).toBe(false);
  });

  it("returns true when q has content", () => {
    expect(hasAnyContactsFilter({ q: "x" })).toBe(true);
  });
});
