import { describe, it, expect } from "vitest";
import {
  updateDealSchema,
  killDealSchema,
} from "@/lib/deal-schema";

/**
 * Phase 2 Plan 02 Task 1 — shared Zod schemas for deal update + kill.
 *
 * Pure Zod validation tests — no DB, no mocks. These encode the validation
 * contract the Overview-edit (plan 05) and kill-deal (plan 04) flows depend on.
 *
 * See UI-SPEC lines 240-300 (Overview edit copy) + 573-595 (Kill dialog copy)
 * for the error-message source of truth.
 */
describe("updateDealSchema", () => {
  it("accepts an empty object (no changes) — editability of a single field at a time", () => {
    const result = updateDealSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a single-field update (title only)", () => {
    const result = updateDealSchema.safeParse({ title: "Fresh title" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Fresh title");
    }
  });

  it("rejects empty-string title with 'Title is required.'", () => {
    const result = updateDealSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required.");
    }
  });

  it("rejects title longer than 200 chars", () => {
    const result = updateDealSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Title must be 200 characters or fewer.",
      );
    }
  });

  it("rejects an invalid priority value (not in HIGH/MEDIUM/LOW)", () => {
    const result = updateDealSchema.safeParse({ priority: "URGENT" });
    expect(result.success).toBe(false);
  });

  it("rejects the immutable field trackCode (strict schema — unknown key)", () => {
    // trackCode is a valid create field but NOT editable post-create (DEAL-02a).
    // .strict() rejects unknown keys loudly.
    const result = updateDealSchema.safeParse({ trackCode: "TE" });
    expect(result.success).toBe(false);
  });

  it("rejects the immutable field fileNo (strict schema — unknown key)", () => {
    const result = updateDealSchema.safeParse({ fileNo: "TX-2026-0001" });
    expect(result.success).toBe(false);
  });

  it("rejects status='killed' on updateDealSchema (kill flows through killDealSchema only)", () => {
    const result = updateDealSchema.safeParse({ status: "killed" });
    expect(result.success).toBe(false);
  });

  it("accepts valid status transitions active -> closed", () => {
    const result = updateDealSchema.safeParse({ status: "closed" });
    expect(result.success).toBe(true);
  });

  it("uppercases a 2-letter property state (transform still runs on optional fields)", () => {
    const result = updateDealSchema.safeParse({ propertyState: "tx" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.propertyState).toBe("TX");
    }
  });
});

describe("killDealSchema", () => {
  const validUuid = "00000000-0000-4000-8000-000000000001";

  it("rejects a reason shorter than 3 characters with copy from UI-SPEC", () => {
    const result = killDealSchema.safeParse({
      dealId: validUuid,
      reason: "ok", // 2 chars
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "reason")
        ?.message;
      expect(msg).toBe("Reason must be at least 3 characters.");
    }
  });

  it("rejects a reason longer than 2000 characters", () => {
    const result = killDealSchema.safeParse({
      dealId: validUuid,
      reason: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "reason")
        ?.message;
      expect(msg).toBe("Reason must be 2000 characters or fewer.");
    }
  });

  it("rejects a non-uuid dealId", () => {
    const result = killDealSchema.safeParse({
      dealId: "not-a-uuid",
      reason: "Client backed out of PSA",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid uuid dealId with a meaningful reason", () => {
    const result = killDealSchema.safeParse({
      dealId: validUuid,
      reason: "Client backed out of PSA",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("Client backed out of PSA");
    }
  });

  it("trims whitespace around reason before validating the min-length check", () => {
    // "  ok  " trims to "ok" (2 chars) → still too short → fails
    const result = killDealSchema.safeParse({
      dealId: validUuid,
      reason: "  ok  ",
    });
    expect(result.success).toBe(false);
  });
});
