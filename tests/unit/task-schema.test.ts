import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
} from "@/lib/task-schema";

/**
 * Phase 2 Plan 02 Task 2 — task Zod schemas.
 *
 * Pure Zod validation tests for the three task mutation shapes that Plan 03
 * (task server actions) will consume. No DB, no mocks.
 *
 * Error copy sourced from UI-SPEC Tasks-tab Copywriting Contract.
 */
const validUuid = "00000000-0000-4000-8000-000000000001";
const validUuid2 = "00000000-0000-4000-8000-000000000002";
const validUuid3 = "00000000-0000-4000-8000-000000000003";

describe("createTaskSchema", () => {
  it("accepts a minimal valid task (dealId + title)", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "Order title search",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Order title search");
      // isNext default resolves to false on output
      expect(result.data.isNext).toBe(false);
    }
  });

  it("accepts a fully-populated task (all optional fields set)", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "Schedule closing",
      ownerUserId: validUuid2,
      dueDate: new Date("2026-05-01"),
      isNext: true,
      parentTaskId: validUuid3,
      advancesStageToId: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string title with 'Title is required.'", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "title")
        ?.message;
      expect(msg).toBe("Title is required.");
    }
  });

  it("rejects title longer than 200 chars with max-length copy", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "x".repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "title")
        ?.message;
      expect(msg).toBe("Title must be 200 characters or fewer.");
    }
  });

  it("rejects non-uuid dealId", () => {
    const result = createTaskSchema.safeParse({
      dealId: "not-a-uuid",
      title: "Order title search",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid ownerUserId", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "Order title search",
      ownerUserId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("defaults isNext to false on output when not provided (split input/output type pattern)", () => {
    const result = createTaskSchema.safeParse({
      dealId: validUuid,
      title: "Schedule closing",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isNext).toBe(false);
    }
  });
});

describe("updateTaskSchema", () => {
  it("accepts an id + one optional field (title change)", () => {
    const result = updateTaskSchema.safeParse({
      id: validUuid,
      title: "Order updated title",
    });
    expect(result.success).toBe(true);
  });

  it("accepts status transition to 'done'", () => {
    const result = updateTaskSchema.safeParse({
      id: validUuid,
      status: "done",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const result = updateTaskSchema.safeParse({
      id: validUuid,
      status: "archived",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys via .strict() (e.g., dealId should not be re-assigned)", () => {
    const result = updateTaskSchema.safeParse({
      id: validUuid,
      dealId: validUuid2, // unknown key — tasks cannot be re-parented to a new deal
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = updateTaskSchema.safeParse({ title: "x" });
    expect(result.success).toBe(false);
  });
});

describe("completeTaskSchema", () => {
  it("accepts a single id field", () => {
    const result = completeTaskSchema.safeParse({ id: validUuid });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const result = completeTaskSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });
});
