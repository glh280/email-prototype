import { describe, it, expect } from "vitest";
import {
  advanceStageSchema,
  revertStageSchema,
} from "@/lib/stage-schema";

/**
 * Phase 2 Plan 02 Task 2 — stage advance + revert Zod schemas.
 *
 * Both schemas have identical shape; the forward/backward distinction is
 * enforced by the server actions (plan 04) against seeded stage sort_order,
 * not by Zod.
 */
const validUuid = "00000000-0000-4000-8000-000000000001";
const validUuid2 = "00000000-0000-4000-8000-000000000002";

describe("advanceStageSchema", () => {
  it("accepts a valid {dealId, targetStageId} pair", () => {
    const result = advanceStageSchema.safeParse({
      dealId: validUuid,
      targetStageId: validUuid2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid dealId", () => {
    const result = advanceStageSchema.safeParse({
      dealId: "not-a-uuid",
      targetStageId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid targetStageId", () => {
    const result = advanceStageSchema.safeParse({
      dealId: validUuid,
      targetStageId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing targetStageId", () => {
    const result = advanceStageSchema.safeParse({ dealId: validUuid });
    expect(result.success).toBe(false);
  });
});

describe("revertStageSchema", () => {
  it("accepts a valid {dealId, targetStageId} pair", () => {
    const result = revertStageSchema.safeParse({
      dealId: validUuid,
      targetStageId: validUuid2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid dealId", () => {
    const result = revertStageSchema.safeParse({
      dealId: "not-a-uuid",
      targetStageId: validUuid2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid targetStageId", () => {
    const result = revertStageSchema.safeParse({
      dealId: validUuid,
      targetStageId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing dealId", () => {
    const result = revertStageSchema.safeParse({ targetStageId: validUuid2 });
    expect(result.success).toBe(false);
  });
});
